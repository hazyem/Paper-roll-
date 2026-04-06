import { 
  Material, 
  PaperRoll, 
  ActivityLog, 
  InsertMaterial, 
  InsertPaperRoll, 
  InsertActivityLog,
  ReceiveMaterialRequest,
  ReleaseMaterialRequest,
  AmendMaterialRequest,
  ReportFilterRequest,
  User,
  Role,
  RegisterUserRequest,
  UpdateUserRequest,
  CreateRoleRequest,
  userDataSchema,
  materials,
  paperRolls,
  activityLog,
  users,
  roles,
  userRoles
} from '@shared/schema';
import { z } from 'zod';
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db } from './db';
import { eq, and, desc, asc, gte, lte, isNull, count, sum, inArray } from 'drizzle-orm';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws; // Required for Pool to work in Node.js / serverless

// Type fix for SessionStore
type SessionStore = session.Store;

// Storage interface for all CRUD operations
export interface IStorage {
  // Materials
  getMaterials(): Promise<Material[]>;
  getMaterialByName(name: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  createMaterialSimple(name: string): Promise<Material>;

  // Paper Rolls
  getPaperRolls(isReleased?: boolean): Promise<PaperRoll[]>;
  getPaperRollById(id: number): Promise<PaperRoll | undefined>;
  getPaperRollByMaterialRollId(materialRollId: string): Promise<PaperRoll | undefined>;
  getPaperRollsByMaterialId(materialId: number, isReleased?: boolean): Promise<PaperRoll[]>;
  getPaperRollsByPurchaseOrder(purchaseOrderNumber: string, isReleased?: boolean): Promise<PaperRoll[]>;
  getPaperRollsBySalesOrder(salesOrderNumber: string): Promise<PaperRoll[]>;
  createPaperRoll(paperRoll: InsertPaperRoll): Promise<PaperRoll>;
  updatePaperRoll(id: number, data: Partial<InsertPaperRoll>): Promise<PaperRoll>;
  releasePaperRoll(id: number, salesOrderNumber: string, remarks?: string): Promise<PaperRoll>;

  // Activity Logs
  getActivityLogs(): Promise<ActivityLog[]>;
  getActivityLogsByMaterialRollId(materialRollId: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // User Management
  createUser(userData: z.infer<typeof userDataSchema>): Promise<User>;
  updateUser(userData: UpdateUserRequest): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  validateUser(username: string, password: string): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  
  // Role Management
  createRole(roleData: CreateRoleRequest): Promise<Role>;
  getRoles(): Promise<Role[]>;
  getRoleById(id: number): Promise<Role | undefined>;
  assignRoleToUser(userId: number, roleId: number): Promise<void>;
  removeRoleFromUser(userId: number, roleId: number): Promise<void>;
  getUserRoles(userId: number): Promise<Role[]>;

  // Business Logic Operations
  receiveMaterial(data: ReceiveMaterialRequest, username: string, userId?: number): Promise<PaperRoll[]>;
  releaseMaterial(data: ReleaseMaterialRequest, username: string, userId?: number): Promise<PaperRoll[]>;
  amendMaterial(data: AmendMaterialRequest, username: string, userId?: number): Promise<PaperRoll>;
  generateReport(filter: ReportFilterRequest): Promise<any>;
  
  // Dashboard data
  getDashboardStats(): Promise<{
    totalMaterials: number;
    pendingReleases: number;
    ordersReceived: number;
    totalWeight: number;
  }>;
  getRecentActivities(limit?: number): Promise<ActivityLog[]>;
  getMaterialStatus(limit?: number): Promise<any[]>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private materials: Map<number, Material>;
  private paperRolls: Map<number, PaperRoll>;
  private activityLogs: Map<number, ActivityLog>;
  private users: Map<number, User>;
  private roles: Map<number, Role>;
  private userRoles: Map<string, { userId: number, roleId: number }>;
  private materialIdCounter: number;
  private paperRollIdCounter: number;
  private activityLogIdCounter: number;
  private userIdCounter: number;
  private roleIdCounter: number;
  
  public sessionStore: session.Store;

  constructor() {
    this.materials = new Map();
    this.paperRolls = new Map();
    this.activityLogs = new Map();
    this.users = new Map();
    this.roles = new Map();
    this.userRoles = new Map();
    this.materialIdCounter = 1;
    this.paperRollIdCounter = 1;
    this.activityLogIdCounter = 1;
    this.userIdCounter = 1;
    this.roleIdCounter = 1;
    
    // Initialize session store
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });

    // Initialize with some material types
    const defaultMaterials = [
      { name: "Premium Gloss Paper" },
      { name: "Kraft Paper" },
      { name: "Matte Coated Paper" },
      { name: "Recycled Paper" },
      { name: "Newsprint" }
    ];
    
    defaultMaterials.forEach(mat => this.createMaterial(mat));

    // Initialize default roles after the class is fully defined
    // This will be done in the storage initialization
  }

  // Materials
  async getMaterials(): Promise<Material[]> {
    return Array.from(this.materials.values());
  }

  async getMaterialByName(name: string): Promise<Material | undefined> {
    const normalizedName = name.trim();
    return Array.from(this.materials.values()).find(
      (material) => material.name === normalizedName
    );
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const id = this.materialIdCounter++;
    const newMaterial: Material = { ...material, id };
    this.materials.set(id, newMaterial);
    return newMaterial;
  }
  
  async createMaterialSimple(name: string): Promise<Material> {
    return this.createMaterial({ name });
  }

  // Paper Rolls
  async getPaperRolls(isReleased?: boolean): Promise<PaperRoll[]> {
    let rolls = Array.from(this.paperRolls.values());
    
    if (isReleased !== undefined) {
      rolls = rolls.filter(roll => roll.isReleased === isReleased);
    }
    
    return rolls;
  }

  async getPaperRollById(id: number): Promise<PaperRoll | undefined> {
    return this.paperRolls.get(id);
  }

  async getPaperRollByMaterialRollId(materialRollId: string): Promise<PaperRoll | undefined> {
    return Array.from(this.paperRolls.values()).find(
      (roll) => roll.materialRollId === materialRollId
    );
  }

  async getPaperRollsByMaterialId(materialId: number, isReleased?: boolean): Promise<PaperRoll[]> {
    let rolls = Array.from(this.paperRolls.values()).filter(
      (roll) => roll.materialId === materialId
    );
    
    if (isReleased !== undefined) {
      rolls = rolls.filter(roll => roll.isReleased === isReleased);
    }
    
    return rolls;
  }

  async getPaperRollsByPurchaseOrder(purchaseOrderNumber: string, isReleased?: boolean): Promise<PaperRoll[]> {
    let rolls = Array.from(this.paperRolls.values()).filter(
      (roll) => roll.purchaseOrderNumber === purchaseOrderNumber
    );
    
    if (isReleased !== undefined) {
      rolls = rolls.filter(roll => roll.isReleased === isReleased);
    }
    
    return rolls;
  }

  async getPaperRollsBySalesOrder(salesOrderNumber: string): Promise<PaperRoll[]> {
    return Array.from(this.paperRolls.values()).filter(
      (roll) => roll.salesOrderNumber === salesOrderNumber
    );
  }

  async createPaperRoll(paperRoll: InsertPaperRoll): Promise<PaperRoll> {
    const id = this.paperRollIdCounter++;
    const newRoll: PaperRoll = { 
      id,
      materialId: paperRoll.materialId,
      materialRollId: paperRoll.materialRollId,
      purchaseOrderNumber: paperRoll.purchaseOrderNumber || null,
      declaredWeight: paperRoll.declaredWeight || null,
      actualWeight: paperRoll.actualWeight || null,
      currentWeight: paperRoll.currentWeight || null,
      salesOrderNumber: paperRoll.salesOrderNumber || null,
      receivedAt: new Date(),
      isReleased: false,
      releasedAt: null,
      remarks: paperRoll.remarks || null
    };
    this.paperRolls.set(id, newRoll);
    return newRoll;
  }

  async updatePaperRoll(id: number, data: Partial<InsertPaperRoll>): Promise<PaperRoll> {
    const existingRoll = this.paperRolls.get(id);
    if (!existingRoll) {
      throw new Error(`Paper roll with ID ${id} not found`);
    }
    
    const updatedRoll: PaperRoll = { ...existingRoll, ...data };
    this.paperRolls.set(id, updatedRoll);
    return updatedRoll;
  }

  async releasePaperRoll(id: number, salesOrderNumber: string, remarks?: string): Promise<PaperRoll> {
    const existingRoll = this.paperRolls.get(id);
    if (!existingRoll) {
      throw new Error(`Paper roll with ID ${id} not found`);
    }
    
    const updatedRoll: PaperRoll = { 
      ...existingRoll, 
      salesOrderNumber,
      isReleased: true,
      releasedAt: new Date(),
      currentWeight: 0, // When released, weight becomes zero
      remarks: remarks || existingRoll.remarks // Keep existing remarks or add new ones
    };
    
    this.paperRolls.set(id, updatedRoll);
    return updatedRoll;
  }

  // Activity Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }

  async getActivityLogsByMaterialRollId(materialRollId: string): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter((log) => log.materialRollId === materialRollId)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activityLogIdCounter++;
    const newLog: ActivityLog = { 
      id,
      materialRollId: log.materialRollId,
      action: log.action,
      materialName: log.materialName,
      performedBy: log.performedBy,
      details: log.details || null,
      performedAt: new Date(),
      userId: log.userId || null
    };
    this.activityLogs.set(id, newLog);
    return newLog;
  }

  // Business Logic Operations
  async receiveMaterial(data: ReceiveMaterialRequest, username: string): Promise<PaperRoll[]> {
    // Find or create material
    let material = await this.getMaterialByName(data.materialName);
    if (!material) {
      material = await this.createMaterial({ name: data.materialName });
    }

    const createdRolls: PaperRoll[] = [];

    // Create paper rolls for each material ID
    for (const roll of data.materialRolls) {
      // Check if material roll ID already exists
      const existingRoll = await this.getPaperRollByMaterialRollId(roll.materialRollId);
      if (existingRoll) {
        throw new Error(`Material ID ${roll.materialRollId} already exists`);
      }

      // Create new paper roll
      const newRoll = await this.createPaperRoll({
        materialId: material.id,
        materialRollId: roll.materialRollId,
        purchaseOrderNumber: data.purchaseOrderNumber,
        declaredWeight: roll.declaredWeight,
        actualWeight: roll.actualWeight,
        currentWeight: roll.actualWeight || roll.declaredWeight, // Use actual weight or declared weight as the current weight
        salesOrderNumber: null,
        isReleased: false,
        releasedAt: null,
        remarks: roll.remarks || data.remarks || null
      });

      // Create activity log with remarks
      let logDetails = `Received with PO: ${data.purchaseOrderNumber || 'Not specified'}, Declared Weight: ${roll.declaredWeight || 'No Data'}, Actual Weight: ${roll.actualWeight || 'No Data'}`;
      
      // Add remarks if available
      if (roll.remarks || data.remarks) {
        logDetails += `, Remarks: ${roll.remarks || data.remarks}`;
      }
      
      await this.createActivityLog({
        action: 'received',
        materialRollId: roll.materialRollId,
        materialName: material.name,
        performedBy: username,
        details: logDetails
      });

      createdRolls.push(newRoll);
    }

    return createdRolls;
  }

  async releaseMaterial(data: ReleaseMaterialRequest, username: string): Promise<PaperRoll[]> {
    const releasedRolls: PaperRoll[] = [];

    // Process each material roll with its current weight
    for (const materialRoll of data.materialRolls) {
      const { materialRollId, currentWeight } = materialRoll;
      
      // Find paper roll by material roll ID
      const paperRoll = await this.getPaperRollByMaterialRollId(materialRollId);
      if (!paperRoll) {
        throw new Error(`Material ID ${materialRollId} not found`);
      }

      if (paperRoll.isReleased) {
        throw new Error(`Material ID ${materialRollId} has already been released`);
      }

      // Check if weight needs to be updated before releasing
      if (currentWeight !== undefined && (!paperRoll.actualWeight && !paperRoll.currentWeight)) {
        // Update the current weight first
        await this.updatePaperRoll(paperRoll.id, { currentWeight });
      }

      // Get material name for the log
      const materials = Array.from(this.materials.values());
      const material = materials.find(m => m.id === paperRoll.materialId);
      const materialName = material ? material.name : 'Unknown Material';

      // Release the paper roll with remarks
      const releasedRoll = await this.releasePaperRoll(
        paperRoll.id, 
        data.salesOrderNumber,
        materialRoll.remarks || data.remarks
      );

      // Create activity log with remarks
      let logDetails = `Released with SO: ${data.salesOrderNumber}, Previous Weight: ${paperRoll.currentWeight || 'No Data'}`;
      
      // Add remarks if available
      if (materialRoll.remarks || data.remarks) {
        logDetails += `, Remarks: ${materialRoll.remarks || data.remarks}`;
      }
      
      await this.createActivityLog({
        action: 'released',
        materialRollId: materialRollId,
        materialName: materialName,
        performedBy: username,
        details: logDetails
      });

      releasedRolls.push(releasedRoll);
    }

    return releasedRolls;
  }

  async amendMaterial(data: AmendMaterialRequest, username: string): Promise<PaperRoll> {
    // Find paper roll by material roll ID
    const paperRoll = await this.getPaperRollByMaterialRollId(data.materialRollId);
    if (!paperRoll) {
      throw new Error(`Material ID ${data.materialRollId} not found`);
    }

    // Get material name for the log
    const materials = Array.from(this.materials.values());
    const material = materials.find(m => m.id === paperRoll.materialId);
    const materialName = material ? material.name : 'Unknown Material';

    // Prepare update data
    const updateData: Partial<InsertPaperRoll> = {};
    if (data.declaredWeight !== undefined) updateData.declaredWeight = data.declaredWeight;
    if (data.actualWeight !== undefined) updateData.actualWeight = data.actualWeight;
    if (data.currentWeight !== undefined) updateData.currentWeight = data.currentWeight;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    
    // If material was released, set it back to active
    if (paperRoll.isReleased) {
      updateData.isReleased = false;
      updateData.releasedAt = null;
      updateData.salesOrderNumber = null;
    }

    // Update the paper roll
    const updatedRoll = await this.updatePaperRoll(paperRoll.id, updateData);

    // Create activity log with remarks
    let logDetails = `${paperRoll.isReleased ? 'Reactivated material and ' : ''}Amended: ${
      data.declaredWeight !== undefined ? `Declared Weight: ${data.declaredWeight}, ` : ''
    }${
      data.actualWeight !== undefined ? `Actual Weight: ${data.actualWeight}, ` : ''
    }${
      data.currentWeight !== undefined ? `Current Weight: ${data.currentWeight}` : ''
    }`;
    
    // Add remarks if available
    if (data.remarks) {
      logDetails += `, Remarks: ${data.remarks}`;
    }
    
    await this.createActivityLog({
      action: 'amended',
      materialRollId: data.materialRollId,
      materialName: materialName,
      performedBy: username,
      details: logDetails
    });

    return updatedRoll;
  }

  async generateReport(filter: ReportFilterRequest): Promise<any> {
    const { reportType, filterValue, dateFrom, dateTo, onlyActive } = filter;
    
    let result: any = {};
    
    // Apply date filters if provided
    let startDate = dateFrom ? new Date(dateFrom) : null;
    let endDate = dateTo ? new Date(dateTo) : null;
    
    switch (reportType) {
      case 'material-id': {
        if (!filterValue) {
          throw new Error('Material ID is required for this report type');
        }
        
        const paperRoll = await this.getPaperRollByMaterialRollId(filterValue);
        if (!paperRoll) {
          throw new Error(`Material ID ${filterValue} not found`);
        }
        
        // Get the material by ID instead of by name
        const materials = Array.from(this.materials.values());
        const material = materials.find(m => m.id === paperRoll.materialId);
        const logs = await this.getActivityLogsByMaterialRollId(filterValue);
        
        result = {
          materialRollId: paperRoll.materialRollId,
          materialName: material ? material.name : 'Unknown Material',
          purchaseOrderNumber: paperRoll.purchaseOrderNumber,
          declaredWeight: paperRoll.declaredWeight,
          actualWeight: paperRoll.actualWeight,
          currentWeight: paperRoll.currentWeight,
          isReleased: paperRoll.isReleased,
          receivedAt: paperRoll.receivedAt,
          releasedAt: paperRoll.releasedAt,
          salesOrderNumber: paperRoll.salesOrderNumber,
          activityLogs: logs.filter(log => {
            if (!startDate && !endDate) return true;
            const logDate = new Date(log.performedAt);
            if (startDate && !endDate) return logDate >= startDate;
            if (!startDate && endDate) return logDate <= endDate;
            return logDate >= startDate! && logDate <= endDate!;
          })
        };
        break;
      }
      
      case 'material-name': {
        if (!filterValue) {
          throw new Error('Material name is required for this report type');
        }
        
        const material = await this.getMaterialByName(filterValue);
        if (!material) {
          throw new Error(`Material name ${filterValue} not found`);
        }
        
        const paperRolls = await this.getPaperRollsByMaterialId(material.id);
        const notReleasedRolls = paperRolls.filter(roll => !roll.isReleased);
        
        // Calculate totals
        const totalRolls = notReleasedRolls.length;
        const totalWeight = notReleasedRolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0);
        
        result = {
          materialName: material.name,
          totalRolls,
          totalWeight,
          rolls: notReleasedRolls.filter(roll => {
            if (!startDate && !endDate) return true;
            const rollDate = new Date(roll.receivedAt);
            if (startDate && !endDate) return rollDate >= startDate;
            if (!startDate && endDate) return rollDate <= endDate;
            return rollDate >= startDate! && rollDate <= endDate!;
          })
        };
        break;
      }
      
      case 'purchase-order': {
        if (!filterValue) {
          throw new Error('Purchase order number is required for this report type');
        }
        
        const paperRolls = await this.getPaperRollsByPurchaseOrder(filterValue);
        
        // Group by material
        const materialGroups: Record<string, PaperRoll[]> = {};
        for (const roll of paperRolls) {
          // Get the material by ID
          const materials = Array.from(this.materials.values());
          const material = materials.find(m => m.id === roll.materialId);
          const materialName = material ? material.name : 'Unknown Material';
          
          if (!materialGroups[materialName]) {
            materialGroups[materialName] = [];
          }
          
          materialGroups[materialName].push(roll);
        }
        
        result = {
          purchaseOrderNumber: filterValue,
          materialGroups: Object.entries(materialGroups).map(([materialName, rolls]) => {
            const filteredRolls = rolls.filter(roll => {
              if (!startDate && !endDate) return true;
              const rollDate = new Date(roll.receivedAt);
              if (startDate && !endDate) return rollDate >= startDate;
              if (!startDate && endDate) return rollDate <= endDate;
              return rollDate >= startDate! && rollDate <= endDate!;
            });
            
            return {
              materialName,
              totalRolls: filteredRolls.length,
              totalWeight: filteredRolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0),
              rolls: filteredRolls
            };
          })
        };
        break;
      }
      
      case 'sales-order': {
        if (!filterValue) {
          throw new Error('Sales order number is required for this report type');
        }
        
        const paperRolls = await this.getPaperRollsBySalesOrder(filterValue);
        
        result = {
          salesOrderNumber: filterValue,
          releasedMaterials: await Promise.all(paperRolls.filter(roll => {
            if (!startDate && !endDate) return true;
            if (!roll.releasedAt) return false;
            
            const releaseDate = new Date(roll.releasedAt);
            if (startDate && !endDate) return releaseDate >= startDate;
            if (!startDate && endDate) return releaseDate <= endDate;
            return releaseDate >= startDate! && releaseDate <= endDate!;
          }).map(async roll => {
            // Get the material by ID
            const materials = Array.from(this.materials.values());
            const material = materials.find(m => m.id === roll.materialId);
            return {
              materialRollId: roll.materialRollId,
              materialName: material ? material.name : 'Unknown Material',
              releasedAt: roll.releasedAt
            };
          }))
        };
        break;
      }
      
      case 'all-stock': {
        // Get all materials and paper rolls
        const allMaterials = await this.getMaterials();
        const allRolls = await this.getPaperRolls();
        
        // Filter rolls based on dates if provided
        const filteredRolls = allRolls.filter(roll => {
          // Skip released materials if onlyActive is true
          if (onlyActive && roll.isReleased) return false;
            
          if (!startDate && !endDate) return true;
          const rollDate = new Date(roll.receivedAt);
          if (startDate && !endDate) return rollDate >= startDate;
          if (!startDate && endDate) return rollDate <= endDate;
          return rollDate >= startDate! && rollDate <= endDate!;
        });
        
        // Organize data by material
        const materialSummaries: Record<number, {
          id: number;
          name: string;
          totalRolls: number;
          activeRolls: number;
          totalWeight: number;
          rolls: PaperRoll[];
        }> = {};
        
        // Initialize summary for each material
        allMaterials.forEach(material => {
          materialSummaries[material.id] = {
            id: material.id,
            name: material.name,
            totalRolls: 0,
            activeRolls: 0,
            totalWeight: 0,
            rolls: []
          };
        });
        
        // Fill summaries with roll data
        filteredRolls.forEach(roll => {
          if (materialSummaries[roll.materialId]) {
            materialSummaries[roll.materialId].totalRolls++;
            if (!roll.isReleased) {
              materialSummaries[roll.materialId].activeRolls++;
              materialSummaries[roll.materialId].totalWeight += roll.currentWeight || 0;
            }
            materialSummaries[roll.materialId].rolls.push(roll);
          }
        });
        
        // Calculate overall totals
        const totalRolls = filteredRolls.length;
        const activeRolls = filteredRolls.filter(roll => !roll.isReleased).length;
        const totalWeight = filteredRolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0);
        
        // Format final result
        // Get activity logs for materials
        const activityLogs = await this.getActivityLogs();
        
        result = {
          reportTitle: 'Complete Stock Report',
          generatedAt: new Date().toISOString(),
          summary: {
            totalMaterials: allMaterials.length,
            totalRolls,
            activeRolls,
            totalWeight
          },
          materials: Object.values(materialSummaries)
            .filter(summary => summary.totalRolls > 0)
            .map(summary => ({
              ...summary,
              history: activityLogs
                .filter(log => log.materialRollId && summary.rolls.some(roll => roll.materialRollId === log.materialRollId))
                .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
            }))
            .sort((a, b) => b.activeRolls - a.activeRolls)
        };
        break;
      }
      
      default:
        throw new Error(`Invalid report type: ${reportType}`);
    }
    
    return result;
  }

  // Dashboard data
  async getDashboardStats(): Promise<{
    totalMaterials: number;
    pendingReleases: number;
    ordersReceived: number;
    totalWeight: number;
  }> {
    const allRolls = await this.getPaperRolls();
    const activeRolls = allRolls.filter(roll => !roll.isReleased);
    
    // Count unique purchase orders
    const uniquePurchaseOrders = new Set();
    allRolls.forEach(roll => {
      if (roll.purchaseOrderNumber) {
        uniquePurchaseOrders.add(roll.purchaseOrderNumber);
      }
    });
    
    return {
      totalMaterials: activeRolls.length,
      pendingReleases: activeRolls.length,
      ordersReceived: uniquePurchaseOrders.size,
      totalWeight: activeRolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0)
    };
  }

  async getRecentActivities(limit: number = 5): Promise<ActivityLog[]> {
    const logs = await this.getActivityLogs();
    return logs.slice(0, limit);
  }

  async getMaterialStatus(): Promise<any[]> {
    const materials = await this.getMaterials();
    const activityLogs = await this.getActivityLogs();
    const result = [];
    
    for (const material of materials) {
      const paperRolls = await this.getPaperRollsByMaterialId(material.id, false);
      
      if (paperRolls.length > 0) {
        const activeRolls = paperRolls.filter(roll => !roll.isReleased);
        const totalWeight = activeRolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0);
        const materialLogs = activityLogs.filter(log => 
          paperRolls.some(roll => roll.materialRollId === log.materialRollId)
        ).sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
        
        result.push({
          materialName: material.name,
          totalRolls: paperRolls.length,
          activeRolls: activeRolls.length,
          totalWeight,
          lastActivity: materialLogs[0]?.performedAt || null,
          history: materialLogs
        });
      }
    }
    
    return result.sort((a, b) => b.activeRolls - a.activeRolls);
  }

  // User Management Methods
  async createUser(userData: z.infer<typeof userDataSchema>): Promise<User> {
    // Check if username already exists
    const existingUser = await this.getUserByUsername(userData.username);
    if (existingUser) {
      throw new Error(`Username ${userData.username} already exists`);
    }

    const id = this.userIdCounter++;
    const now = new Date();
    
    // Create the new user
    const newUser: User = {
      id,
      username: userData.username,
      passwordHash: userData.password, // For simplicity, not hashing in demo
      fullName: userData.fullName,
      email: userData.email || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      isAdmin: userData.isAdmin !== undefined ? userData.isAdmin : false,
      lastLogin: null,
      createdAt: now,
      updatedAt: now
    };
    
    this.users.set(id, newUser);
    
    // Assign roles if provided
    if (userData.roles && userData.roles.length > 0) {
      for (const roleId of userData.roles) {
        await this.assignRoleToUser(id, roleId);
      }
    }
    
    // Return the full user to auth.ts where the passwordHash will be removed before sending to client
    return newUser;
  }
  
  async updateUser(userData: UpdateUserRequest): Promise<User> {
    // We need to get the original user with the password
    const originalUser = await this.getUserByUsername(
      (await this.getUserById(userData.id))?.username || ''
    );
    
    if (!originalUser) {
      throw new Error(`User with ID ${userData.id} not found`);
    }
    
    // Check if username is being changed and already exists
    if (userData.username && userData.username !== originalUser.username) {
      const userWithUsername = await this.getUserByUsername(userData.username);
      if (userWithUsername && userWithUsername.id !== userData.id) {
        throw new Error(`Username ${userData.username} already exists`);
      }
    }
    
    // Update user details
    const updatedUser: User = {
      ...originalUser,
      username: userData.username || originalUser.username,
      passwordHash: userData.password ? userData.password : originalUser.passwordHash, // Note: auth.ts will hash this before updating
      fullName: userData.fullName || originalUser.fullName,
      email: userData.email !== undefined ? userData.email : originalUser.email,
      isActive: userData.isActive !== undefined ? userData.isActive : originalUser.isActive,
      isAdmin: userData.isAdmin !== undefined ? userData.isAdmin : originalUser.isAdmin,
      updatedAt: new Date()
    };
    
    this.users.set(userData.id, updatedUser);
    
    // Update roles if provided
    if (userData.roles && userData.roles.length > 0) {
      // Get current roles
      const currentRoles = await this.getUserRoles(userData.id);
      const currentRoleIds = currentRoles.map(role => role.id);
      
      // Roles to add (those in userData.roles but not in currentRoleIds)
      const rolesToAdd = userData.roles.filter(roleId => !currentRoleIds.includes(roleId));
      
      // Roles to remove (those in currentRoleIds but not in userData.roles)
      const rolesToRemove = currentRoleIds.filter(roleId => 
        userData.roles ? !userData.roles.includes(roleId) : true
      );
      
      // Add new roles
      for (const roleId of rolesToAdd) {
        await this.assignRoleToUser(userData.id, roleId);
      }
      
      // Remove old roles
      for (const roleId of rolesToRemove) {
        await this.removeRoleFromUser(userData.id, roleId);
      }
    }
    
    // Return without passwordHash for security
    const { passwordHash, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // Return without passwordHash for security
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(user => user.username === username);
    return user; // We need the passwordHash for authentication
  }
  
  async getUsers(): Promise<User[]> {
    // Return users without passwordHash for security
    return Array.from(this.users.values()).map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }
  
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    
    if (!user || !user.isActive) {
      return null;
    }
    
    // Simple direct comparison for demo purposes - in production, use proper hashing
    if (password === user.passwordHash) {
      // Update last login
      const updatedUser = { ...user, lastLogin: new Date() };
      this.users.set(user.id, updatedUser);
      
      return updatedUser;
    }
    
    return null;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user) {
      return false;
    }
    
    // Remove all user roles
    const userRoleKeys = Array.from(this.userRoles.keys())
      .filter(key => key.startsWith(`${id}:`));
    
    for (const key of userRoleKeys) {
      this.userRoles.delete(key);
    }
    
    // Remove the user
    return this.users.delete(id);
  }
  
  // Role Management Methods
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const id = this.roleIdCounter++;
    
    const newRole: Role = {
      id,
      name: roleData.name,
      description: roleData.description || null,
      createdAt: new Date()
    };
    
    this.roles.set(id, newRole);
    return newRole;
  }
  
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }
  
  async getRoleById(id: number): Promise<Role | undefined> {
    return this.roles.get(id);
  }
  
  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    // Check if user exists
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Check if role exists
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error(`Role with ID ${roleId} not found`);
    }
    
    // Create the user-role relationship
    const key = `${userId}:${roleId}`;
    this.userRoles.set(key, { userId, roleId });
  }
  
  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    const key = `${userId}:${roleId}`;
    this.userRoles.delete(key);
  }
  
  async getUserRoles(userId: number): Promise<Role[]> {
    // Get all userRole entries for this user
    const userRoleEntries = Array.from(this.userRoles.entries())
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([_, value]) => value);
    
    // Get the role objects
    const roles: Role[] = [];
    for (const entry of userRoleEntries) {
      const role = await this.getRoleById(entry.roleId);
      if (role) {
        roles.push(role);
      }
    }
    
    return roles;
  }
}

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Setup PostgreSQL session store
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      pool: this.pool,
      createTableIfMissing: true,
    });
  }

  // Materials
  async getMaterials(): Promise<Material[]> {
    return await db.select().from(materials);
  }

  async getMaterialByName(name: string): Promise<Material | undefined> {
    const normalizedName = name.trim();
    const [material] = await db.select().from(materials).where(eq(materials.name, normalizedName));
    return material;
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [newMaterial] = await db.insert(materials).values(material).returning();
    return newMaterial;
  }
  
  async createMaterialSimple(name: string): Promise<Material> {
    return this.createMaterial({ name });
  }

  // Paper Rolls
  async getPaperRolls(isReleased?: boolean): Promise<PaperRoll[]> {
    if (isReleased !== undefined) {
      return await db.select().from(paperRolls).where(eq(paperRolls.isReleased, isReleased));
    }
    
    return await db.select().from(paperRolls);
  }

  async getPaperRollById(id: number): Promise<PaperRoll | undefined> {
    const [roll] = await db.select().from(paperRolls).where(eq(paperRolls.id, id));
    return roll;
  }

  async getPaperRollByMaterialRollId(materialRollId: string): Promise<PaperRoll | undefined> {
    const [roll] = await db.select().from(paperRolls).where(eq(paperRolls.materialRollId, materialRollId));
    return roll;
  }

  async getPaperRollsByMaterialId(materialId: number, isReleased?: boolean): Promise<PaperRoll[]> {
    if (isReleased !== undefined) {
      return await db.select().from(paperRolls).where(
        and(
          eq(paperRolls.materialId, materialId),
          eq(paperRolls.isReleased, isReleased)
        )
      );
    }
    
    return await db.select().from(paperRolls).where(eq(paperRolls.materialId, materialId));
  }

  async getPaperRollsByPurchaseOrder(purchaseOrderNumber: string, isReleased?: boolean): Promise<PaperRoll[]> {
    if (isReleased !== undefined) {
      return await db.select().from(paperRolls).where(
        and(
          eq(paperRolls.purchaseOrderNumber, purchaseOrderNumber),
          eq(paperRolls.isReleased, isReleased)
        )
      );
    }
    
    return await db.select().from(paperRolls).where(eq(paperRolls.purchaseOrderNumber, purchaseOrderNumber));
  }

  async getPaperRollsBySalesOrder(salesOrderNumber: string): Promise<PaperRoll[]> {
    return await db.select().from(paperRolls).where(eq(paperRolls.salesOrderNumber, salesOrderNumber));
  }

  async createPaperRoll(paperRoll: InsertPaperRoll): Promise<PaperRoll> {
    const [newRoll] = await db.insert(paperRolls).values({
      ...paperRoll,
      receivedAt: new Date(),
      isReleased: false,
      releasedAt: null
    }).returning();
    
    return newRoll;
  }

  async updatePaperRoll(id: number, data: Partial<InsertPaperRoll>): Promise<PaperRoll> {
    const existingRoll = await this.getPaperRollById(id);
    if (!existingRoll) {
      throw new Error(`Paper roll with ID ${id} not found`);
    }
    
    const [updatedRoll] = await db.update(paperRolls)
      .set(data)
      .where(eq(paperRolls.id, id))
      .returning();
    
    return updatedRoll;
  }

  async releasePaperRoll(id: number, salesOrderNumber: string, remarks?: string): Promise<PaperRoll> {
    const existingRoll = await this.getPaperRollById(id);
    if (!existingRoll) {
      throw new Error(`Paper roll with ID ${id} not found`);
    }
    
    const [updatedRoll] = await db.update(paperRolls)
      .set({
        salesOrderNumber,
        isReleased: true,
        releasedAt: new Date(),
        currentWeight: 0,
        remarks: remarks || existingRoll.remarks
      })
      .where(eq(paperRolls.id, id))
      .returning();
    
    return updatedRoll;
  }

  // Activity Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    return await db.select().from(activityLog).orderBy(desc(activityLog.performedAt));
  }

  async getActivityLogsByMaterialRollId(materialRollId: string): Promise<ActivityLog[]> {
    return await db.select()
      .from(activityLog)
      .where(eq(activityLog.materialRollId, materialRollId))
      .orderBy(desc(activityLog.performedAt));
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLog).values({
      ...log,
      performedAt: new Date()
    }).returning();
    
    return newLog;
  }

  // Business Logic Operations
  async receiveMaterial(data: ReceiveMaterialRequest, username: string, userId?: number): Promise<PaperRoll[]> {
    // Find or create material
    let material = await this.getMaterialByName(data.materialName);
    if (!material) {
      material = await this.createMaterial({ name: data.materialName });
    }

    const createdRolls: PaperRoll[] = [];

    // Create paper rolls for each material ID
    for (const roll of data.materialRolls) {
      // Check if material roll ID already exists
      const existingRoll = await this.getPaperRollByMaterialRollId(roll.materialRollId);
      if (existingRoll) {
        throw new Error(`Material ID ${roll.materialRollId} already exists`);
      }

      // Create new paper roll with remarks field
      const newRoll = await this.createPaperRoll({
        materialId: material.id,
        materialRollId: roll.materialRollId,
        purchaseOrderNumber: data.purchaseOrderNumber,
        declaredWeight: roll.declaredWeight,
        actualWeight: roll.actualWeight,
        currentWeight: roll.actualWeight || roll.declaredWeight, // Use actual weight or declared weight as the current weight
        salesOrderNumber: null,
        remarks: roll.remarks || data.remarks || null
      });

      // Create activity log with remarks
      let logDetails = `Received with PO: ${data.purchaseOrderNumber || 'Not specified'}, Declared Weight: ${roll.declaredWeight || 'No Data'}, Actual Weight: ${roll.actualWeight || 'No Data'}`;
      
      // Add general remarks if available
      if (data.remarks) {
        logDetails += `, General remarks: ${data.remarks}`;
      }
      
      // Add individual roll remarks if available
      if (roll.remarks) {
        logDetails += `, Item remarks: ${roll.remarks}`;
      }
      
      await this.createActivityLog({
        action: 'received',
        materialRollId: roll.materialRollId,
        materialName: material.name,
        performedBy: username,
        userId,
        details: logDetails
      });

      createdRolls.push(newRoll);
    }

    return createdRolls;
  }

  async releaseMaterial(data: ReleaseMaterialRequest, username: string, userId?: number): Promise<PaperRoll[]> {
    const releasedRolls: PaperRoll[] = [];

    // Process each material roll with its current weight
    for (const materialRoll of data.materialRolls) {
      const { materialRollId, currentWeight } = materialRoll;
      
      // Find paper roll by material roll ID
      const paperRoll = await this.getPaperRollByMaterialRollId(materialRollId);
      if (!paperRoll) {
        throw new Error(`Material ID ${materialRollId} not found`);
      }

      if (paperRoll.isReleased) {
        throw new Error(`Material ID ${materialRollId} has already been released`);
      }

      // Check if weight needs to be updated before releasing
      if (currentWeight !== undefined && (!paperRoll.actualWeight && !paperRoll.currentWeight)) {
        // Update the current weight first
        await this.updatePaperRoll(paperRoll.id, { currentWeight });
      }

      // Get material name for the log
      const [material] = await db.select().from(materials).where(eq(materials.id, paperRoll.materialId));
      const materialName = material ? material.name : 'Unknown Material';

      // Release the paper roll with remarks
      const releasedRoll = await this.releasePaperRoll(
        paperRoll.id, 
        data.salesOrderNumber,
        materialRoll.remarks || data.remarks
      );

      // Create activity log with remarks
      let logDetails = `Released with SO: ${data.salesOrderNumber}, Previous Weight: ${paperRoll.currentWeight || 'No Data'}`;
      
      // Add remarks if available
      if (materialRoll.remarks || data.remarks) {
        logDetails += `, Remarks: ${materialRoll.remarks || data.remarks}`;
      }
      
      await this.createActivityLog({
        action: 'released',
        materialRollId: materialRollId,
        materialName: materialName,
        performedBy: username,
        userId,
        details: logDetails
      });

      releasedRolls.push(releasedRoll);
    }

    return releasedRolls;
  }

  async amendMaterial(data: AmendMaterialRequest, username: string, userId?: number): Promise<PaperRoll> {
    // Find paper roll by material roll ID
    const paperRoll = await this.getPaperRollByMaterialRollId(data.materialRollId);
    if (!paperRoll) {
      throw new Error(`Material ID ${data.materialRollId} not found`);
    }

    // Get material name for the log
    const [material] = await db.select().from(materials).where(eq(materials.id, paperRoll.materialId));
    const materialName = material ? material.name : 'Unknown Material';

    // Prepare update data
    const updateData: Partial<InsertPaperRoll> = {};
    if (data.declaredWeight !== undefined) updateData.declaredWeight = data.declaredWeight;
    if (data.actualWeight !== undefined) updateData.actualWeight = data.actualWeight;
    if (data.currentWeight !== undefined) updateData.currentWeight = data.currentWeight;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    
    // If material was released, set it back to active
    if (paperRoll.isReleased) {
      updateData.isReleased = false;
      updateData.releasedAt = null;
      updateData.salesOrderNumber = null;
    }

    // Update the paper roll
    const updatedRoll = await this.updatePaperRoll(paperRoll.id, updateData);

    // Create activity log with remarks
    let logDetails = `${paperRoll.isReleased ? 'Reactivated material and ' : ''}Amended: ${
      data.declaredWeight !== undefined ? `Declared Weight: ${data.declaredWeight}, ` : ''
    }${
      data.actualWeight !== undefined ? `Actual Weight: ${data.actualWeight}, ` : ''
    }${
      data.currentWeight !== undefined ? `Current Weight: ${data.currentWeight}` : ''
    }`;
    
    // Add remarks if available
    if (data.remarks) {
      logDetails += `, Remarks: ${data.remarks}`;
    }
    
    await this.createActivityLog({
      action: 'amended',
      materialRollId: data.materialRollId,
      materialName: materialName,
      performedBy: username,
      userId,
      details: logDetails
    });

    return updatedRoll;
  }

  async generateReport(filter: ReportFilterRequest): Promise<any> {
    const { reportType, filterValue, dateFrom, dateTo, onlyActive } = filter;
    
    let startDate = dateFrom ? new Date(dateFrom) : null;
    let endDate = dateTo ? new Date(dateTo) : null;
    
    switch (reportType) {
      case 'material-id': {
        if (!filterValue) {
          throw new Error('Material ID is required for this report type');
        }
        
        const paperRoll = await this.getPaperRollByMaterialRollId(filterValue);
        if (!paperRoll) {
          throw new Error(`Material ID ${filterValue} not found`);
        }
        
        // Get the material by ID
        const [material] = await db.select().from(materials).where(eq(materials.id, paperRoll.materialId));
        const logs = await this.getActivityLogsByMaterialRollId(filterValue);
        
        return {
          materialName: material?.name || 'Unknown Material',
          materialRollId: paperRoll.materialRollId,
          purchaseOrderNumber: paperRoll.purchaseOrderNumber,
          currentWeight: paperRoll.currentWeight,
          isReleased: paperRoll.isReleased,
          activityLogs: logs
        };
      }
      
      case 'material-name': {
        if (!filterValue) {
          throw new Error('Material name is required for this report type');
        }
        
        const material = await this.getMaterialByName(filterValue);
        if (!material) {
          throw new Error(`Material ${filterValue} not found`);
        }
        
        let query = db.select().from(paperRolls).where(eq(paperRolls.materialId, material.id));
        
        if (onlyActive) {
          query = query.where(eq(paperRolls.isReleased, false));
        }
        
        if (startDate) {
          query = query.where(gte(paperRolls.receivedAt, startDate));
        }
        
        if (endDate) {
          query = query.where(lte(paperRolls.receivedAt, endDate));
        }
        
        const rolls = await query;
        
        return {
          material,
          rolls
        };
      }
      
      case 'purchase-order': {
        if (!filterValue) {
          throw new Error('Purchase order number is required for this report type');
        }
        
        let query = db.select().from(paperRolls).where(eq(paperRolls.purchaseOrderNumber, filterValue));
        
        if (onlyActive) {
          query = query.where(eq(paperRolls.isReleased, false));
        }
        
        if (startDate) {
          query = query.where(gte(paperRolls.receivedAt, startDate));
        }
        
        if (endDate) {
          query = query.where(lte(paperRolls.receivedAt, endDate));
        }
        
        const rolls = await query;
        
        // Extract unique material IDs
        const materialIds = [...new Set(rolls.map(roll => roll.materialId))];
        
        // Get materials
        const materialsList = await db.select().from(materials).where(inArray(materials.id, materialIds));
        
        const materialsMap: Record<number, Material> = {};
        materialsList.forEach(mat => {
          materialsMap[mat.id] = mat;
        });
        
        return {
          purchaseOrderNumber: filterValue,
          rolls,
          materials: materialsMap
        };
      }
      
      case 'sales-order': {
        if (!filterValue) {
          throw new Error('Sales order number is required for this report type');
        }
        
        let query = db.select().from(paperRolls).where(eq(paperRolls.salesOrderNumber, filterValue));
        
        if (startDate) {
          query = query.where(gte(paperRolls.releasedAt, startDate));
        }
        
        if (endDate) {
          query = query.where(lte(paperRolls.releasedAt, endDate));
        }
        
        const rolls = await query;
        
        // Extract unique material IDs
        const materialIds = [...new Set(rolls.map(roll => roll.materialId))];
        
        // Get materials
        const materialsList = await db.select().from(materials).where(inArray(materials.id, materialIds));
        
        const materialsMap: Record<number, Material> = {};
        materialsList.forEach(mat => {
          materialsMap[mat.id] = mat;
        });
        
        return {
          salesOrderNumber: filterValue,
          rolls,
          materials: materialsMap
        };
      }
      
      case 'all-stock': {
        let query = db.select().from(paperRolls);
        
        if (onlyActive) {
          query = query.where(eq(paperRolls.isReleased, false));
        }
        
        if (startDate) {
          query = query.where(gte(paperRolls.receivedAt, startDate));
        }
        
        if (endDate) {
          query = query.where(lte(paperRolls.receivedAt, endDate));
        }
        
        const rolls = await query;
        
        // Extract unique material IDs
        const materialIds = [...new Set(rolls.map(roll => roll.materialId))];
        
        // Get materials
        const materialsList = await db.select().from(materials).where(inArray(materials.id, materialIds));
        
        const materialsMap: Record<number, Material> = {};
        materialsList.forEach(mat => {
          materialsMap[mat.id] = mat;
        });
        
        // Process rolls and group by material
        const materialGroups: any[] = [];
        const materialGroupMap: Record<number, any> = {};
        
        // Group rolls by material and process details
        rolls.forEach(roll => {
          const materialId = roll.materialId;
          const materialName = materialsMap[materialId]?.name || 'Unknown Material';
          
          if (!materialGroupMap[materialId]) {
            materialGroupMap[materialId] = {
              materialId,
              materialName,
              rolls: [],
              totalRolls: 0,
              totalWeight: 0
            };
            materialGroups.push(materialGroupMap[materialId]);
          }
          
          materialGroupMap[materialId].rolls.push(roll);
          materialGroupMap[materialId].totalRolls++;
          materialGroupMap[materialId].totalWeight += (roll.currentWeight || 0);
        });
        
        // Format final report
        const activeRolls = rolls.filter(roll => !roll.isReleased).length;
        
        return {
          reportTitle: "All Stock Report",
          generatedAt: new Date().toISOString(),
          date: {
            from: startDate ? startDate.toISOString() : null,
            to: endDate ? endDate.toISOString() : null
          },
          materialGroups,
          // Add the summary object expected by the frontend
          summary: {
            totalMaterials: materialGroups.length,
            totalRolls: rolls.length,
            activeRolls: activeRolls,
            totalWeight: materialGroups.reduce((sum, group) => sum + group.totalWeight, 0)
          },
          // Transform material groups into the format expected by the frontend
          materials: materialGroups.map(group => ({
            name: group.materialName,
            totalRolls: group.totalRolls,
            activeRolls: group.rolls.filter((roll: any) => !roll.isReleased).length,
            totalWeight: group.totalWeight,
            rolls: group.rolls
          }))
        };
      }
      
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }
  
  // Dashboard data
  async getDashboardStats(): Promise<{
    totalMaterials: number;
    pendingReleases: number;
    ordersReceived: number;
    totalWeight: number;
  }> {
    // Count total materials
    const [materialsCount] = await db.select({ count: count() }).from(materials);
    
    // Count pending releases (not released)
    const [pendingCount] = await db.select({ count: count() })
      .from(paperRolls)
      .where(eq(paperRolls.isReleased, false));
    
    // Count unique purchase orders
    const uniquePOs = await db.select({ po: paperRolls.purchaseOrderNumber })
      .from(paperRolls)
      .groupBy(paperRolls.purchaseOrderNumber);
    
    // Calculate total weight of current stock
    const [totalWeight] = await db.select({ 
      sum: sum(paperRolls.currentWeight)
    })
    .from(paperRolls)
    .where(eq(paperRolls.isReleased, false));
    
    return {
      totalMaterials: Number(materialsCount?.count || 0),
      pendingReleases: Number(pendingCount?.count || 0),
      ordersReceived: Number(uniquePOs.length),
      totalWeight: Number(totalWeight?.sum || 0)
    };
  }
  
  async getRecentActivities(limit: number = 5): Promise<ActivityLog[]> {
    return await db.select()
      .from(activityLog)
      .orderBy(desc(activityLog.performedAt))
      .limit(limit);
  }
  
  async getMaterialStatus(limit: number = 10): Promise<any[]> {
    // Get all materials
    const allMaterials = await this.getMaterials();
    
    const result: any[] = [];
    
    for (const material of allMaterials) {
      // Get all active rolls for this material
      const rolls = await this.getPaperRollsByMaterialId(material.id, false);
      
      if (rolls.length > 0) {
        // Calculate total weight
        const totalWeight = rolls.reduce((sum, roll) => {
          return sum + (roll.currentWeight || 0);
        }, 0);
        
        // Get the most recent activity for this material to sort by date
        const latestActivity = await db
          .select()
          .from(activityLog)
          .where(
            inArray(
              activityLog.materialRollId,
              rolls.map(roll => roll.materialRollId)
            )
          )
          .orderBy(desc(activityLog.performedAt))
          .limit(1);
        
        result.push({
          materialName: material.name,
          totalRolls: rolls.length,
          totalWeight,
          lastActivity: latestActivity[0]?.performedAt || new Date(0).toISOString()
        });
      }
    }
    
    // Sort by most recent activity and limit to 10
    return result
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, limit);
  }

  // User Management
  async createUser(userData: z.infer<typeof userDataSchema>): Promise<User> {
    const { roles: roleIds, ...user } = userData;
    
    // Insert the user
    const [newUser] = await db.insert(users).values({
      username: user.username,
      passwordHash: user.password, // For demo purposes, we're storing plain password
      fullName: user.fullName,
      email: user.email || null,
      isActive: user.isActive !== undefined ? user.isActive : true,
      isAdmin: user.isAdmin || false,
      createdAt: new Date()
    }).returning();
    
    // If roles were provided, assign them
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await this.assignRoleToUser(newUser.id, roleId);
      }
    }
    
    return newUser;
  }

  async updateUser(userData: UpdateUserRequest): Promise<User> {
    const { id, roles: roleIds, password, confirmPassword, ...updates } = userData;
    
    // First check if user exists
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Only update password if provided
    if (password) {
      updateData.passwordHash = password;
    }
    
    // Update the user
    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    // If roles were provided, clear existing roles and assign new ones
    if (roleIds && roleIds.length >= 0) {
      // Remove all existing roles
      await db.delete(userRoles).where(eq(userRoles.userId, id));
      
      // Assign new roles
      for (const roleId of roleIds) {
        await this.assignRoleToUser(id, roleId);
      }
    }
    
    return updatedUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || user.passwordHash !== password) {
      return null;
    }
    
    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));
    
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true; // Assume success if no error
  }

  // Role Management
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const [newRole] = await db.insert(roles).values({
      name: roleData.name,
      description: roleData.description || null,
      createdAt: new Date()
    }).returning();
    
    return newRole;
  }

  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  async getRoleById(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    await db.insert(userRoles).values({
      userId,
      roleId
    });
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    await db.delete(userRoles).where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId)
      )
    );
  }

  async getUserRoles(userId: number): Promise<Role[]> {
    const userRoleEntries = await db.select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    
    if (userRoleEntries.length === 0) {
      return [];
    }
    
    const roleIds = userRoleEntries.map(entry => entry.roleId);
    return await db.select().from(roles).where(inArray(roles.id, roleIds));
  }
}

// Use database storage
export const storage = new DatabaseStorage();

// Initialize default roles
async function initializeDefaultRoles() {
  try {
    // Check if roles already exist
    const existingRoles = await storage.getRoles();
    if (existingRoles.length === 0) {
      console.log("Creating default roles");
      // Create default roles
      await storage.createRole({ name: "Admin", description: "Administrator with full access" });
      await storage.createRole({ name: "Operator", description: "Can receive and release materials" });
      await storage.createRole({ name: "Viewer", description: "Can view materials but not modify" });
    }
    
    // Check if admin user exists
    const adminUser = await storage.getUserByUsername("admin");
    if (!adminUser) {
      console.log("Creating default admin user");
      await storage.createUser({
        username: "admin",
        password: "password123",
        fullName: "System Administrator",
        isActive: true,
        isAdmin: true,
      });
    }
    
    // Initialize with some material types if none exist
    const materials = await storage.getMaterials();
    if (materials.length === 0) {
      console.log("Creating default materials");
      const defaultMaterials = [
        { name: "Premium Gloss Paper" },
        { name: "Kraft Paper" },
        { name: "Matte Coated Paper" },
        { name: "Recycled Paper" },
        { name: "Newsprint" }
      ];
      
      for (const material of defaultMaterials) {
        await storage.createMaterial(material);
      }
    }
  } catch (error) {
    console.error("Error initializing default data:", error);
  }
}

// Call initialization function
initializeDefaultRoles();
