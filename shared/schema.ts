import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, uuid, primaryKey, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  birthDate: varchar("birth_date", { length: 10 }), // Format: YYYY-MM-DD
  phoneNumber: varchar("phone_number", { length: 20 }),
  displayUsername: varchar("display_username", { length: 50 }).unique(), // @username for profile
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  publicKey: text("public_key"), // RSA-4096 public key for end-to-end encryption
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }),
  isGroup: boolean("is_group").default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMembers = pgTable("chat_members", {
  chatId: uuid("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
  role: varchar("role", { length: 20 }).default("member"), // member, admin
}, (table) => ({
  pk: primaryKey({ columns: [table.chatId, table.userId] }),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: uuid("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").references(() => users.id),
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 20 }).default("text"), // text, image, file
  isEncrypted: boolean("is_encrypted").default(true),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReads = pgTable("message_reads", {
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.messageId, table.userId] }),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatMembers: many(chatMembers),
  sentMessages: many(messages),
  messageReads: many(messageReads),
  createdChats: many(chats),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  createdBy: one(users, { fields: [chats.createdBy], references: [users.id] }),
  members: many(chatMembers),
  messages: many(messages),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, { fields: [chatMembers.chatId], references: [chats.id] }),
  user: one(users, { fields: [chatMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  reads: many(messageReads),
}));

export const messageReadsRelations = relations(messageReads, ({ one }) => ({
  message: one(messages, { fields: [messageReads.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageReads.userId], references: [users.id] }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isOnline: true,
  lastSeen: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  editedAt: true,
});

export const insertChatMemberSchema = createInsertSchema(chatMembers).omit({
  joinedAt: true,
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: "Username must start with a letter and contain only letters, numbers, and underscores"
  }).refine((val) => !/__/.test(val), {
    message: "Username cannot contain consecutive underscores"
  }),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Tug'ilgan sana YYYY-MM-DD formatida bo'lishi kerak"
    })
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      // Exact age calculation
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1 >= 13 && age - 1 <= 120;
      }
      return age >= 13 && age <= 120;
    }, {
      message: "Yosh 13 dan 120 gacha bo'lishi kerak"
    })
    .refine((date) => {
      const birthDate = new Date(date);
      return !isNaN(birthDate.getTime()); // Valid date check
    }, {
      message: "Yaroqli sana kiriting"
    }),
});

// Profile schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().max(20).optional().or(z.literal("")).or(z.undefined()),
  displayUsername: z.string().optional().or(z.literal("")).or(z.undefined()).refine((val) => {
    if (!val || val === "") return true; // Empty values are allowed
    
    // Remove @ prefix for validation if present
    const username = val.startsWith('@') ? val.slice(1) : val;
    
    // Check length (5-32 characters after @)
    if (username.length < 5 || username.length > 32) return false;
    
    // Must start with letter
    if (!/^[a-zA-Z]/.test(username)) return false;
    
    // Only letters, numbers, and underscores allowed
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;
    
    // Cannot have consecutive underscores
    if (/__/.test(username)) return false;
    
    // Cannot end with underscore
    if (username.endsWith('_')) return false;
    
    return true;
  }, {
    message: "Username must be 5-32 characters, start with letter, contain only letters/numbers/underscores, no consecutive underscores, and not end with underscore"
  }),
  profileImageUrl: z.string().optional().or(z.literal("")).or(z.undefined()),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ChatMember = typeof chatMembers.$inferSelect;
export type InsertChatMember = z.infer<typeof insertChatMemberSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
