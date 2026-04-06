import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define material types
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

// Define the paper rolls table
export const paperRolls = pgTable("paper_rolls", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull(),
  materialRollId: text("material_roll_id").notNull().unique(), // The unique ID for each roll (e.g., PR-2023-1458)
  purchaseOrderNumber: text("purchase_order_number"),
  declaredWeight: doublePrecision("declared_weight"),
  actualWeight: doublePrecision("actual_weight"),
  currentWeight: doublePrecision("current_weight"),
  salesOrderNumber: text("sales_order_number"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
  isReleased: boolean("is_released").notNull().default(false),
  remarks: text("remarks"),  // General remarks for the paper roll
});

// Define roles for user access control
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Define users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// User-Role relationships (many-to-many)
export const userRoles = pgTable("user_roles", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.roleId] }),
}));

// Define the activity log table to track operations
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // 'received', 'released', 'amended'
  materialRollId: text("material_roll_id").notNull(),
  materialName: text("material_name").notNull(),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
  performedBy: text("performed_by").notNull(),
  userId: integer("user_id").references(() => users.id),
  details: text("details"),
});

// Create insert schemas
export const insertMaterialSchema = createInsertSchema(materials);
export const insertPaperRollSchema = createInsertSchema(paperRolls).omit({ id: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true });
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLogin: true });

// Create a base user schema for storage operations without the confirmPassword field
export const userDataSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  fullName: z.string().min(1, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }).optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  roles: z.array(z.number()).optional(),
});
export const insertUserRoleSchema = createInsertSchema(userRoles);

// Create types
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;

export type PaperRoll = typeof paperRolls.$inferSelect;
export type InsertPaperRoll = z.infer<typeof insertPaperRollSchema>;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// Additional schemas for API operations
export const receiveMaterialSchema = z.object({
  materialName: z.string().min(1, { message: "Material name is required" }),
  purchaseOrderNumber: z.string().min(1, { message: "Purchase order number is required" }),
  remarks: z.string().optional(),
  materialRolls: z.array(z.object({
    materialRollId: z.string()
      .min(1, { message: "Material ID is required" })
      .refine(id => /^[A-Za-z0-9-]+$/.test(id), {
        message: "Material ID must only contain letters, numbers, and hyphens"
      }),
    declaredWeight: z.number().optional()
      .refine(val => val === undefined || val > 0, {
        message: "Declared weight must be greater than zero if provided"
      }),
    actualWeight: z.number().optional()
      .refine(val => val === undefined || val > 0, {
        message: "Actual weight must be greater than zero if provided"
      }),
    remarks: z.string().optional(),
  }))
  .min(1, { message: "At least one material roll is required" })
  // We removed the uniqueness check here as it's handled by the server through database lookups
  // We removed the weight requirement as both weights are optional
});

export const releaseMaterialSchema = z.object({
  materialRolls: z.array(z.object({
    materialRollId: z.string().min(1, { message: "Material ID is required" }),
    currentWeight: z.number().optional(),
    remarks: z.string().optional(),
  })),
  salesOrderNumber: z.string().min(1, { message: "Sales order number is required" }),
  remarks: z.string().optional(),
});

export const amendMaterialSchema = z.object({
  materialRollId: z.string().min(1, { message: "Material ID is required" }),
  declaredWeight: z.number().optional(),
  actualWeight: z.number().optional(),
  currentWeight: z.number().optional(),
  remarks: z.string().optional(),
});

export const reportFilterSchema = z.object({
  reportType: z.enum(['material-id', 'material-name', 'purchase-order', 'sales-order', 'all-stock']),
  filterValue: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  onlyActive: z.boolean().optional(),
});

export const createMaterialSchema = z.object({
  name: z.string().min(1, { message: "Material name is required" }),
});

// Auth related schemas
export const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
  remember: z.boolean().optional(),
});

export const registerUserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  confirmPassword: z.string(),
  fullName: z.string().min(1, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }).optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  roles: z.array(z.number()).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const updateUserSchema = z.object({
  id: z.number(),
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .optional(),
  confirmPassword: z.string().optional(),
  fullName: z.string().min(1, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }).optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  roles: z.array(z.number()).optional(),
}).refine(
  (data) => !data.password || data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

export const createRoleSchema = z.object({
  name: z.string().min(1, { message: "Role name is required" }),
  description: z.string().optional(),
});

export type ReceiveMaterialRequest = z.infer<typeof receiveMaterialSchema>;
export type ReleaseMaterialRequest = z.infer<typeof releaseMaterialSchema>;
export type AmendMaterialRequest = z.infer<typeof amendMaterialSchema>;
export type ReportFilterRequest = z.infer<typeof reportFilterSchema>;
export type CreateMaterialRequest = z.infer<typeof createMaterialSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type CreateRoleRequest = z.infer<typeof createRoleSchema>;
export type UserData = z.infer<typeof userDataSchema>;
