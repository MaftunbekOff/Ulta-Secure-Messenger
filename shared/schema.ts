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

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Security settings for users
export const userSecuritySettings = pgTable("user_security_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  requireUsernameForReset: boolean("require_username_for_reset").default(false),
  requireSecurityQuestions: boolean("require_security_questions").default(false),
  requireLastActivity: boolean("require_last_activity").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  lastActivityLocation: varchar("last_activity_location", { length: 255 }),
  lastActivityIP: varchar("last_activity_ip", { length: 45 }),
  lastActivityDevice: varchar("last_activity_device", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Security questions for password recovery
export const securityQuestions = pgTable("security_questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  question: varchar("question", { length: 500 }).notNull(),
  answerHash: text("answer_hash").notNull(), // bcrypt hashed answer
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Sessions Management
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  deviceInfo: text("device_info"), // Browser, OS, Device name
  deviceType: varchar("device_type", { length: 20 }), // mobile, desktop, tablet
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6
  location: varchar("location", { length: 255 }), // City, Country
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  isCurrent: boolean("is_current").default(false), // Current session
  loginTime: timestamp("login_time").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
  logoutTime: timestamp("logout_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Login Activity & Audit Log
export const loginActivity = pgTable("login_activity", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }), // Store email even if user not found
  attemptType: varchar("attempt_type", { length: 20 }).notNull(), // login, logout, failed_login
  success: boolean("success").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  location: varchar("location", { length: 255 }),
  deviceInfo: text("device_info"),
  failureReason: varchar("failure_reason", { length: 100 }), // wrong_password, user_not_found, etc
  sessionId: uuid("session_id").references(() => userSessions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Two-Factor Authentication
export const userTwoFactorAuth = pgTable("user_two_factor_auth", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false),
  secret: text("secret"), // TOTP secret key (encrypted)
  backupCodes: text("backup_codes").array(), // Emergency backup codes
  phoneNumber: varchar("phone_number", { length: 20 }), // For SMS verification
  preferredMethod: varchar("preferred_method", { length: 20 }).default("app"), // app, sms, email
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Security Notifications & Alerts
export const securityNotifications = pgTable("security_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // login_alert, password_change, 2fa_enabled, etc
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"), // info, warning, critical
  isRead: boolean("is_read").default(false),
  ipAddress: varchar("ip_address", { length: 45 }),
  location: varchar("location", { length: 255 }),
  deviceInfo: text("device_info"),
  actionRequired: boolean("action_required").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Advanced Authentication (Biometric, WebAuthn)
export const userWebAuthn = pgTable("user_webauthn", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  deviceName: varchar("device_name", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }), // fingerprint, face, security_key
  counter: bigint("counter", { mode: "number" }).default(0),
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Network Security Settings
export const networkSecuritySettings = pgTable("network_security_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  allowVPN: boolean("allow_vpn").default(true),
  blockedCountries: text("blocked_countries").array(), // ISO country codes
  blockedIPs: text("blocked_ips").array(),
  allowedIPs: text("allowed_ips").array(), // Whitelist
  geoBlockingEnabled: boolean("geo_blocking_enabled").default(false),
  vpnDetectionEnabled: boolean("vpn_detection_enabled").default(false),
  deviceFingerprintingEnabled: boolean("device_fingerprinting_enabled").default(true),
  rateLimitingEnabled: boolean("rate_limiting_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Security Settings
export const chatSecuritySettings = pgTable("chat_security_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  encryptionLevel: varchar("encryption_level", { length: 20 }).default("standard"), // basic, standard, military
  selfDestructEnabled: boolean("self_destruct_enabled").default(false),
  defaultSelfDestructTime: integer("default_self_destruct_time").default(0), // minutes, 0 = disabled
  screenshotProtection: boolean("screenshot_protection").default(false),
  incognitoModeEnabled: boolean("incognito_mode_enabled").default(false),
  messageBackupEnabled: boolean("message_backup_enabled").default(true),
  autoDeleteAfterDays: integer("auto_delete_after_days").default(0), // 0 = never
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Self-Destructing Messages
export const selfDestructingMessages = pgTable("self_destructing_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull().unique(),
  destructTime: timestamp("destruct_time").notNull(),
  isDestroyed: boolean("is_destroyed").default(false),
  viewCount: integer("view_count").default(0),
  maxViews: integer("max_views").default(0), // 0 = unlimited
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance & Legal Settings
export const userComplianceSettings = pgTable("user_compliance_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: varchar("terms_version", { length: 20 }),
  privacyPolicyAcceptedAt: timestamp("privacy_policy_accepted_at"),
  privacyPolicyVersion: varchar("privacy_policy_version", { length: 20 }),
  cookieConsent: boolean("cookie_consent").default(false),
  marketingConsent: boolean("marketing_consent").default(false),
  ageVerified: boolean("age_verified").default(false),
  ageVerificationMethod: varchar("age_verification_method", { length: 50 }),
  gdprCompliant: boolean("gdpr_compliant").default(true),
  dataRetentionDays: integer("data_retention_days").default(2555), // ~7 years
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password Security Enhancement
export const passwordSecurity = pgTable("password_security", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  passwordHistory: text("password_history").array(), // Last 5 password hashes
  strengthScore: integer("strength_score").default(0), // 0-100
  lastChangeAt: timestamp("last_change_at").defaultNow(),
  changeRequired: boolean("change_required").default(false),
  changeRequiredReason: varchar("change_required_reason", { length: 100 }),
  autoChangeEnabled: boolean("auto_change_enabled").default(false),
  autoChangeDays: integer("auto_change_days").default(90),
  breachDetected: boolean("breach_detected").default(false),
  breachDetectedAt: timestamp("breach_detected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  chatMembers: many(chatMembers),
  sentMessages: many(messages),
  messageReads: many(messageReads),
  createdChats: many(chats),
  securitySettings: one(userSecuritySettings),
  securityQuestions: many(securityQuestions),
}));

export const userSecuritySettingsRelations = relations(userSecuritySettings, ({ one }) => ({
  user: one(users, { fields: [userSecuritySettings.userId], references: [users.id] }),
}));

export const securityQuestionsRelations = relations(securityQuestions, ({ one }) => ({
  user: one(users, { fields: [securityQuestions.userId], references: [users.id] }),
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

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email("Yaroqli email manzil kiriting"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token kerak"),
  newPassword: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
  confirmPassword: z.string().min(6, "Parolni tasdiqlang"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Parollar mos kelmaydi",
  path: ["confirmPassword"],
});

// Enhanced forgot password schema with additional verification
export const enhancedForgotPasswordSchema = z.object({
  email: z.string().email("Yaroqli email manzil kiriting"),
  username: z.string().optional(),
  birthDate: z.string().optional(),
  securityAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1, "Javob kiriting"),
  })).optional(),
});

// Security settings schemas
export const insertSecuritySettingsSchema = createInsertSchema(userSecuritySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSecuritySettingsSchema = z.object({
  requireUsernameForReset: z.boolean().optional(),
  requireSecurityQuestions: z.boolean().optional(),
  requireLastActivity: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

// Security questions schemas
export const insertSecurityQuestionSchema = createInsertSchema(securityQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  answerHash: true,
});

export const createSecurityQuestionSchema = z.object({
  question: z.string().min(5, "Savol kamida 5 ta belgidan iborat bo'lishi kerak").max(500),
  answer: z.string().min(2, "Javob kamida 2 ta belgidan iborat bo'lishi kerak"),
});

export const updateSecurityQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(5, "Savol kamida 5 ta belgidan iborat bo'lishi kerak").max(500),
  answer: z.string().min(2, "Javob kamida 2 ta belgidan iborat bo'lishi kerak"),
});

// Predefined security questions
export const PREDEFINED_SECURITY_QUESTIONS = [
  "Birinchi maktabingizning nomi nima edi?",
  "Birinchi uy hayvongiznig nomi nima edi?",
  "Onangizning qizlik familiyasi nima?",
  "Tug'ilgan shahringizning nomi nima?",
  "Birinchi do'stingizning ismi nima edi?",
  "Sevimli kitobingizning nomi nima?",
  "Birinchi ishjoying qayerda edi?",
  "Sevimli o'qituvchingizning familiyasi nima edi?",
] as const;

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
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type EnhancedForgotPasswordData = z.infer<typeof enhancedForgotPasswordSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Security types
export type UserSecuritySettings = typeof userSecuritySettings.$inferSelect;
export type InsertSecuritySettings = z.infer<typeof insertSecuritySettingsSchema>;
export type UpdateSecuritySettings = z.infer<typeof updateSecuritySettingsSchema>;
export type SecurityQuestion = typeof securityQuestions.$inferSelect;
export type InsertSecurityQuestion = z.infer<typeof insertSecurityQuestionSchema>;
export type CreateSecurityQuestion = z.infer<typeof createSecurityQuestionSchema>;
export type UpdateSecurityQuestion = z.infer<typeof updateSecurityQuestionSchema>;

// Advanced Security Types
export type UserSession = typeof userSessions.$inferSelect;
export type LoginActivity = typeof loginActivity.$inferSelect;
export type UserTwoFactorAuth = typeof userTwoFactorAuth.$inferSelect;
export type SecurityNotification = typeof securityNotifications.$inferSelect;
export type UserWebAuthn = typeof userWebAuthn.$inferSelect;
export type NetworkSecuritySettings = typeof networkSecuritySettings.$inferSelect;
export type ChatSecuritySettings = typeof chatSecuritySettings.$inferSelect;
export type SelfDestructingMessage = typeof selfDestructingMessages.$inferSelect;
export type UserComplianceSettings = typeof userComplianceSettings.$inferSelect;
export type PasswordSecurity = typeof passwordSecurity.$inferSelect;

// Insert schemas for new security tables
export const insertUserSessionSchema = createInsertSchema(userSessions, {
  id: true,
  createdAt: true,
  loginTime: true,
  lastActivity: true,
  logoutTime: true,
});

export const insertLoginActivitySchema = createInsertSchema(loginActivity, {
  id: true,
  createdAt: true,
});

export const insertUserTwoFactorAuthSchema = createInsertSchema(userTwoFactorAuth, {
  id: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
});

export const insertSecurityNotificationSchema = createInsertSchema(securityNotifications, {
  id: true,
  createdAt: true,
  expiresAt: true,
});

export const insertUserWebAuthnSchema = createInsertSchema(userWebAuthn, {
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertNetworkSecuritySettingsSchema = createInsertSchema(networkSecuritySettings, {
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatSecuritySettingsSchema = createInsertSchema(chatSecuritySettings, {
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSelfDestructingMessageSchema = createInsertSchema(selfDestructingMessages, {
  id: true,
  createdAt: true,
});

export const insertUserComplianceSettingsSchema = createInsertSchema(userComplianceSettings, {
  id: true,
  createdAt: true,
  updatedAt: true,
  termsAcceptedAt: true,
  privacyPolicyAcceptedAt: true,
});

export const insertPasswordSecuritySchema = createInsertSchema(passwordSecurity, {
  id: true,
  createdAt: true,
  updatedAt: true,
  lastChangeAt: true,
  breachDetectedAt: true,
});

// Update schemas for settings - using z.object().partial() instead
export const updateNetworkSecuritySettingsSchema = z.object({
  allowVPN: z.boolean().optional(),
  blockedCountries: z.array(z.string()).optional(),
  blockedIPs: z.array(z.string()).optional(),
  allowedIPs: z.array(z.string()).optional(),
  geoBlockingEnabled: z.boolean().optional(),
  vpnDetectionEnabled: z.boolean().optional(),
  deviceFingerprintingEnabled: z.boolean().optional(),
  rateLimitingEnabled: z.boolean().optional(),
});

export const updateChatSecuritySettingsSchema = z.object({
  encryptionLevel: z.enum(["basic", "standard", "military"]).optional(),
  selfDestructEnabled: z.boolean().optional(),
  defaultSelfDestructTime: z.number().optional(),
  screenshotProtection: z.boolean().optional(),
  incognitoModeEnabled: z.boolean().optional(),
  messageBackupEnabled: z.boolean().optional(),
  autoDeleteAfterDays: z.number().optional(),
});

export const updateUserComplianceSettingsSchema = z.object({
  cookieConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  ageVerified: z.boolean().optional(),
  ageVerificationMethod: z.string().optional(),
  gdprCompliant: z.boolean().optional(),
  dataRetentionDays: z.number().optional(),
});

export const updatePasswordSecuritySchema = z.object({
  strengthScore: z.number().optional(),
  changeRequired: z.boolean().optional(),
  changeRequiredReason: z.string().optional(),
  autoChangeEnabled: z.boolean().optional(),
  autoChangeDays: z.number().optional(),
  breachDetected: z.boolean().optional(),
});

export const updateUserTwoFactorAuthSchema = z.object({
  isEnabled: z.boolean().optional(),
  phoneNumber: z.string().optional(),
  preferredMethod: z.enum(["app", "sms", "email"]).optional(),
});
