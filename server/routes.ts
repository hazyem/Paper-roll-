import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  receiveMaterialSchema, 
  releaseMaterialSchema, 
  amendMaterialSchema,
  reportFilterSchema,
  createMaterialSchema,
  loginSchema,
  registerUserSchema,
  updateUserSchema,
  createRoleSchema,
  userDataSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { setupAuth } from "./auth_new";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);
  // Get all materials
  app.get("/api/materials", async (req, res) => {
    try {
      const materials = await storage.getMaterials();
      res.json(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });
  
  // Create a new material type
  app.post("/api/materials", async (req, res) => {
    try {
      const data = createMaterialSchema.parse(req.body);
      const material = await storage.createMaterialSimple(data.name);
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating material:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create material" });
      }
    }
  });

  // Receive new order
  app.post("/api/receive", async (req, res) => {
    try {
      // First attempt to validate the data with the schema
      let validatedData;
      try {
        validatedData = receiveMaterialSchema.parse(req.body);
      } catch (validationError: any) {
        if (validationError.errors) {
          // Format zod validation errors for better frontend display
          const formattedErrors = validationError.errors.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message
          }));
          return res.status(400).json({
            message: "Validation failed",
            errors: formattedErrors
          });
        }
        // If it's not a structured zod error, throw it to the outer catch
        throw validationError;
      }

      // Check for already existing Material Roll IDs in the database
      for (const roll of validatedData.materialRolls) {
        const existingRoll = await storage.getPaperRollByMaterialRollId(roll.materialRollId);
        if (existingRoll) {
          return res.status(400).json({
            message: `Material ID ${roll.materialRollId} already exists in the system`
          });
        }
      }

      // Use the authenticated user if available
      const user = req.user as Express.User;
      const username = user ? user.fullName : (req.body.username || "System User");
      const userId = user ? user.id : undefined;

      const result = await storage.receiveMaterial(validatedData, username, userId);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error receiving material:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to receive material" });
      }
    }
  });

  // Release material
  app.post("/api/release", async (req, res) => {
    try {
      const data = releaseMaterialSchema.parse(req.body);
      // Use the authenticated user if available
      const user = req.user as Express.User;
      const username = user ? user.fullName : (req.body.username || "System User");
      const userId = user ? user.id : undefined;

      const result = await storage.releaseMaterial(data, username, userId);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error releasing material:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to release material" });
      }
    }
  });

  // Amend material details
  app.post("/api/amend", async (req, res) => {
    try {
      const data = amendMaterialSchema.parse(req.body);
      // Use the authenticated user if available
      const user = req.user as Express.User;
      const username = user ? user.fullName : (req.body.username || "System User");
      const userId = user ? user.id : undefined;

      const result = await storage.amendMaterial(data, username, userId);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error amending material:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to amend material" });
      }
    }
  });

  // Search material by ID
  app.get("/api/material/:materialRollId", async (req, res) => {
    try {
      const { materialRollId } = req.params;
      const paperRoll = await storage.getPaperRollByMaterialRollId(materialRollId);
      
      if (!paperRoll) {
        return res.status(404).json({ message: `Material ID ${materialRollId} not found` });
      }
      
      // Get the material name
      const materials = await storage.getMaterials();
      const material = materials.find(m => m.id === paperRoll.materialId);
      
      res.json({
        ...paperRoll,
        materialName: material ? material.name : "Unknown"
      });
    } catch (error) {
      console.error("Error fetching material:", error);
      res.status(500).json({ message: "Failed to fetch material details" });
    }
  });

  // Generate report
  app.post("/api/report", async (req, res) => {
    try {
      const filter = reportFilterSchema.parse(req.body);
      const report = await storage.generateReport(filter);
      res.json(report);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error generating report:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate report" });
      }
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const recentActivities = await storage.getRecentActivities(20); // Increased to 20 recent activities
      const materialStatus = await storage.getMaterialStatus(20); // Limit to 20 most recent materials
      
      res.json({
        stats,
        recentActivities,
        materialStatus
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Get rolls by material name
  app.get("/api/rolls/material/:materialName", async (req, res) => {
    try {
      const { materialName } = req.params;
      const decodedMaterialName = decodeURIComponent(materialName);
      console.log("Searching for material:", decodedMaterialName);
      
      const material = await storage.getMaterialByName(decodedMaterialName);
      
      if (!material) {
        // Try to find the material by case-insensitive lookup
        const allMaterials = await storage.getMaterials();
        const matchingMaterial = allMaterials.find(
          m => m.name.toLowerCase() === decodedMaterialName.toLowerCase()
        );
        
        if (!matchingMaterial) {
          return res.status(404).json({ message: `Material ${decodedMaterialName} not found` });
        }
        
        const paperRolls = await storage.getPaperRollsByMaterialId(matchingMaterial.id, false);
        return res.json(paperRolls);
      }
      
      const paperRolls = await storage.getPaperRollsByMaterialId(material.id, false);
      res.json(paperRolls);
    } catch (error) {
      console.error("Error fetching rolls by material:", error);
      res.status(500).json({ message: "Failed to fetch rolls" });
    }
  });

  // User authentication and management
  // Note: Basic auth routes (/api/register, /api/login, /api/logout, /api/user) 
  // are now set up by setupAuth() above
  
  // Update user
  app.put("/api/user/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Ensure the ID in the body matches the ID in the URL
      const data = updateUserSchema.parse({ ...req.body, id });
      
      // Remove confirmPassword from the data
      const { confirmPassword, ...updateData } = data;
      
      const updatedUser = await storage.updateUser(updateData);
      
      // Remove sensitive data before sending response
      const { passwordHash, ...userResponse } = updatedUser;
      
      res.json(userResponse);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating user:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update user" });
      }
    }
  });
  
  // Delete user
  app.delete("/api/user/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      
      // Remove sensitive data before sending response
      const userResponse = users.map(user => {
        const { passwordHash, ...userData } = user;
        return userData;
      });
      
      res.json(userResponse);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Role management
  
  // Create a new role
  app.post("/api/roles", async (req, res) => {
    try {
      const data = createRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating role:", error);
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create role" });
      }
    }
  });
  
  // Get all roles
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });
  
  // Assign role to user
  app.post("/api/users/:userId/roles/:roleId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roleId = parseInt(req.params.roleId);
      
      await storage.assignRoleToUser(userId, roleId);
      
      res.status(204).end();
    } catch (error) {
      console.error("Error assigning role:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to assign role" });
    }
  });
  
  // Remove role from user
  app.delete("/api/users/:userId/roles/:roleId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roleId = parseInt(req.params.roleId);
      
      await storage.removeRoleFromUser(userId, roleId);
      
      res.status(204).end();
    } catch (error) {
      console.error("Error removing role:", error);
      res.status(500).json({ message: "Failed to remove role" });
    }
  });
  
  // Get user roles
  app.get("/api/users/:userId/roles", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roles = await storage.getUserRoles(userId);
      
      res.json(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // Change password
  app.post("/api/change-password", async (req, res) => {
    try {
      // Ensure the user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Verify current password
      const user = await storage.getUserByUsername(req.user.username);
      if (!user || user.passwordHash !== currentPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Get the current user with full details to update
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the password, preserving other user details
      // Create update payload with required fields
      const updatePayload = {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.fullName,
        isActive: req.user.isActive || true,
        password: newPassword
      };
      
      // Only add email if it exists
      if (typeof req.user.email === 'string') {
        Object.assign(updatePayload, { email: req.user.email });
      }
      
      await storage.updateUser(updatePayload);
      
      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
