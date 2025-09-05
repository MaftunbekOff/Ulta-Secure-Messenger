import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import { 
  loginSchema, 
  registerSchema, 
  insertMessageSchema, 
  updateProfileSchema, 
  changePasswordSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  updateSecuritySettingsSchema,
  createSecurityQuestionSchema,
  updateSecurityQuestionSchema,
  enhancedForgotPasswordSchema
} from "@shared/schema";
import { generateKeyPair, encrypt as militaryEncrypt, decrypt as militaryDecrypt } from "./militaryEncryption";
import { parse } from "url";

const JWT_SECRET = process.env.JWT_SECRET || "ultrasecure-messenger-jwt-secret-2024";

// Multer configuration for avatar uploads
const avatarStorage = multer.memoryStorage();
const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface WebSocketMessage {
  type: 'message' | 'typing' | 'join_chat' | 'leave_chat' | 'user_online' | 'user_offline';
  chatId?: string;
  content?: string;
  senderId?: string;
  messageId?: string;
  timestamp?: string;
}

// Store WebSocket connections
const activeConnections = new Map<string, WebSocket>();
const userChatRooms = new Map<string, Set<string>>();

// Authentication middleware
const authenticate = async (req: AuthenticatedRequest, res: Response, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Placeholder for encrypt function - replace with actual encryption logic
const encrypt = (content: string): string => {
  // In a real application, this would use a robust encryption method
  // like AES or the military-grade encryption provided by militaryEncryption.
  // For demonstration, we'll use a placeholder that simulates encryption.
  // Replace this with actual encryption using militaryEncrypt or similar.
  try {
    return militaryEncrypt(content);
  } catch (e) {
    console.warn("Encryption failed for:", content, e);
    return `ENCRYPT_FAILED(${content})`;
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 12);

      // Generate RSA-4096 key pair for military-grade encryption
      const keyPair = generateKeyPair();

      // Create user with public key (private key stays on client)
      const user = await storage.createUser({
        ...validatedData,
        passwordHash,
        publicKey: keyPair.publicKey,
      });

      // Generate JWT
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
        // Send private key to client for end-to-end encryption
        privateKey: keyPair.privateKey
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  // Check username availability
  app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
      const { username } = req.params;

      if (!username || username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }

      const existingUser = await storage.getUserByUsername(username);
      res.json({ available: !existingUser });
    } catch (error: any) {
      res.status(500).json({ message: "Error checking username" });
    }
  });

  // Search users by username
  app.get('/api/users/search/:username', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { username } = req.params;

      if (!username || username.length < 2) {
        return res.status(400).json({ message: "Search term must be at least 2 characters" });
      }

      const user = await storage.getUserByUsername(username);
      if (user && user.id !== req.userId) {
        res.json({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isOnline: user.isOnline
        });
      } else {
        res.json(null);
      }
    } catch (error: any) {
      res.status(500).json({ message: "Error searching users" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update online status
      await storage.updateUserOnlineStatus(user.id, true);

      // Generate JWT
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.post('/api/auth/logout', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.userId) {
        await storage.updateUserOnlineStatus(req.userId, false);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Password reset routes
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal whether user exists for security
        return res.json({ message: "Agar email mavjud bo'lsa, parolni tiklash ko'rsatmalari yuborildi" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      // In a real app, you would send email here
      // For now, we'll return the token (in production, this should be sent via email)
      console.log(`🔑 Password reset token for ${email}: ${resetToken}`);
      
      res.json({ 
        message: "Parolni tiklash ko'rsatmalari email manzilingizga yuborildi",
        // DEVELOPMENT ONLY - remove in production
        resetToken: resetToken
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Parolni tiklashda xatolik" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = resetPasswordSchema.parse(req.body);

      // Find valid reset token
      const resetTokenRecord = await storage.getPasswordResetToken(token);
      if (!resetTokenRecord) {
        return res.status(400).json({ message: "Yaroqsiz yoki muddati o'tgan token" });
      }

      // Check if token is expired
      if (new Date() > new Date(resetTokenRecord.expiresAt)) {
        return res.status(400).json({ message: "Token muddati tugagan" });
      }

      // Check if token was already used
      if (resetTokenRecord.usedAt) {
        return res.status(400).json({ message: "Token allaqachon ishlatilgan" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(resetTokenRecord.email);
      if (!user) {
        return res.status(400).json({ message: "Foydalanuvchi topilmadi" });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password and mark token as used
      await storage.updateUserPassword(user.id, newPasswordHash);
      await storage.markPasswordResetTokenAsUsed(token);

      res.json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Parolni o'zgartirishda xatolik" });
    }
  });

  // Security settings endpoints
  app.get('/api/user/security-settings', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getUserSecuritySettings(req.userId!);
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          requireUsernameForReset: false,
          requireSecurityQuestions: false,
          requireLastActivity: false,
          twoFactorEnabled: false,
        });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: "Xavfsizlik sozlamalarini olishda xatolik" });
    }
  });

  app.put('/api/user/security-settings', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = updateSecuritySettingsSchema.parse(req.body);
      const updatedSettings = await storage.createOrUpdateSecuritySettings(req.userId!, settings);
      res.json(updatedSettings);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Xavfsizlik sozlamalarini yangilashda xatolik" });
    }
  });

  // Security questions endpoints
  app.get('/api/user/security-questions', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const questions = await storage.getUserSecurityQuestions(req.userId!);
      // Don't return answer hashes for security
      const safeQuestions = questions.map(q => ({
        id: q.id,
        question: q.question,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      }));
      res.json(safeQuestions);
    } catch (error: any) {
      res.status(500).json({ message: "Xavfsizlik savollarini olishda xatolik" });
    }
  });

  app.post('/api/user/security-questions', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const questionData = createSecurityQuestionSchema.parse(req.body);
      const newQuestion = await storage.createSecurityQuestion(req.userId!, questionData);
      
      // Return without answer hash
      const safeQuestion = {
        id: newQuestion.id,
        question: newQuestion.question,
        createdAt: newQuestion.createdAt,
        updatedAt: newQuestion.updatedAt,
      };
      
      res.json(safeQuestion);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Xavfsizlik savolini yaratishda xatolik" });
    }
  });

  app.put('/api/user/security-questions/:id', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const questionId = req.params.id;
      const updates = updateSecurityQuestionSchema.parse(req.body);
      const updatedQuestion = await storage.updateSecurityQuestion(questionId, updates);
      
      if (!updatedQuestion) {
        return res.status(404).json({ message: "Savol topilmadi" });
      }

      // Return without answer hash
      const safeQuestion = {
        id: updatedQuestion.id,
        question: updatedQuestion.question,
        createdAt: updatedQuestion.createdAt,
        updatedAt: updatedQuestion.updatedAt,
      };
      
      res.json(safeQuestion);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Xavfsizlik savolini yangilashda xatolik" });
    }
  });

  app.delete('/api/user/security-questions/:id', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const questionId = req.params.id;
      await storage.deleteSecurityQuestion(questionId);
      res.json({ message: "Savol muvaffaqiyatli o'chirildi" });
    } catch (error: any) {
      res.status(500).json({ message: "Savolni o'chirishda xatolik" });
    }
  });

  // Multi-step forgot password verification endpoints
  
  // Step 1: Email verification
  app.post('/api/auth/forgot-password/verify-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email manzil kiritish shart" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal whether user exists for security
        return res.json({ 
          message: "Email tekshirildi. Agar email mavjud bo'lsa, qo'shimcha tekshiruv talab qilinadi.",
          requiresAdditionalVerification: false
        });
      }

      // Get user's security settings
      const securitySettings = await storage.getUserSecuritySettings(user.id);
      
      // Check if additional verification is required
      const requiresVerification = securitySettings?.requireUsernameForReset || 
                                   securitySettings?.requireSecurityQuestions ||
                                   securitySettings?.requireLastActivity;

      if (!requiresVerification) {
        // Generate reset token directly
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour
        await storage.createPasswordResetToken(email, resetToken, expiresAt);

        console.log(`🔑 Direct reset token for ${email}: ${resetToken}`);
        
        return res.json({ 
          message: "Parolni tiklash ko'rsatmalari email manzilingizga yuborildi",
          requiresAdditionalVerification: false,
          resetToken: resetToken // DEVELOPMENT ONLY
        });
      }

      res.json({ 
        message: "Email tasdiqlandi. Qo'shimcha xavfsizlik tekshiruvi talab qilinadi.",
        requiresAdditionalVerification: true
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Email tekshirishda xatolik" });
    }
  });

  // Step 2: Account verification 
  app.post('/api/auth/forgot-password/verify-account', async (req, res) => {
    try {
      const { email, username, birthDate } = req.body;
      
      if (!email || !username) {
        return res.status(400).json({ message: "Email va username kiritish shart" });
      }

      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Ma'lumotlar noto'g'ri" });
      }

      // Get security settings
      const securitySettings = await storage.getUserSecuritySettings(user.id);
      
      // Verify username if required
      if (securitySettings?.requireUsernameForReset && username !== user.username) {
        return res.status(400).json({ message: "Username noto'g'ri" });
      }

      // Verify birth date if provided and user has one
      if (birthDate && user.birthDate && birthDate !== user.birthDate) {
        return res.status(400).json({ message: "Tug'ilgan sana noto'g'ri" });
      }

      // Check if security questions are required
      if (securitySettings?.requireSecurityQuestions) {
        const userQuestions = await storage.getUserSecurityQuestions(user.id);
        
        if (userQuestions.length > 0) {
          // Return questions (without answers)
          const questionsList = userQuestions.map(q => ({
            id: q.id,
            question: q.question
          }));

          return res.json({ 
            message: "Account ma'lumotlari tasdiqlandi. Xavfsizlik savollariga javob bering.",
            requiresSecurityQuestions: true,
            securityQuestions: questionsList
          });
        }
      }

      // Account verified, generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      console.log(`🔑 Account verified reset token for ${email}: ${resetToken}`);
      
      res.json({ 
        message: "Account tasdiqlandi. Reset token email manzilingizga yuborildi.",
        requiresSecurityQuestions: false,
        resetToken: resetToken // DEVELOPMENT ONLY
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Account tekshirishda xatolik" });
    }
  });

  // Step 3: Security questions verification
  app.post('/api/auth/forgot-password/verify-security', async (req, res) => {
    try {
      const { email, answers } = req.body;
      
      if (!email || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Email va javoblar kiritish shart" });
      }

      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Ma'lumotlar noto'g'ri" });
      }

      // Get user's security questions
      const userQuestions = await storage.getUserSecurityQuestions(user.id);
      
      if (userQuestions.length === 0) {
        return res.status(400).json({ message: "Xavfsizlik savollari topilmadi" });
      }

      if (answers.length !== userQuestions.length) {
        return res.status(400).json({ message: "Barcha savollarga javob berish shart" });
      }

      // Verify all answers
      for (let i = 0; i < userQuestions.length; i++) {
        const question = userQuestions[i];
        const userAnswer = answers[i];
        
        const isCorrect = await storage.verifySecurityAnswer(question.id, userAnswer);
        if (!isCorrect) {
          return res.status(400).json({ message: `${i + 1}-savol javobi noto'g'ri` });
        }
      }

      // All answers correct, generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      console.log(`🔑 Security verified reset token for ${email}: ${resetToken}`);
      
      res.json({ 
        message: "Xavfsizlik savollari tasdiqlandi. Reset token email manzilingizga yuborildi.",
        resetToken: resetToken // DEVELOPMENT ONLY
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Xavfsizlik savollarida xatolik" });
    }
  });

  // Enhanced forgot password endpoint with additional verification (legacy support)
  app.post('/api/auth/enhanced-forgot-password', async (req, res) => {
    try {
      const data = enhancedForgotPasswordSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        // Don't reveal whether user exists for security
        return res.json({ message: "Ma'lumotlar tekshirildi. Agar barcha ma'lumotlar to'g'ri bo'lsa, reset token yuboriladi." });
      }

      // Get user's security settings
      const securitySettings = await storage.getUserSecuritySettings(user.id);
      let isVerified = true;
      const requiredFields: string[] = [];

      // Check username if required
      if (securitySettings?.requireUsernameForReset) {
        if (!data.username || data.username !== user.username) {
          isVerified = false;
          requiredFields.push("username");
        }
      }

      // Check birth date if required (and user has birth date)
      if (user.birthDate && data.birthDate && data.birthDate !== user.birthDate) {
        isVerified = false;
      }

      // Check security questions if required
      if (securitySettings?.requireSecurityQuestions && data.securityAnswers) {
        for (const answer of data.securityAnswers) {
          const isCorrect = await storage.verifySecurityAnswer(answer.questionId, answer.answer);
          if (!isCorrect) {
            isVerified = false;
            break;
          }
        }
      }

      if (!isVerified) {
        return res.status(400).json({ 
          message: "Kiritilgan ma'lumotlar noto'g'ri",
          requiredFields 
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await storage.createPasswordResetToken(data.email, resetToken, expiresAt);

      console.log(`🔑 Enhanced password reset token for ${data.email}: ${resetToken}`);
      
      res.json({ 
        message: "Parolni tiklash ko'rsatmalari email manzilingizga yuborildi",
        // DEVELOPMENT ONLY
        resetToken: resetToken
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Parolni tiklashda xatolik" });
    }
  });

  // Health check endpoint for connection monitoring
  app.head('/api/health', (req, res) => {
    res.status(200).end();
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  app.get('/api/auth/me', authenticate, async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    
    // Ultra-fast timeout for immediate response
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ message: "Request timeout" });
      }
    }, 2000); // 2 second timeout

    try {
      const user = await storage.getUser(req.userId!);
      const responseTime = Date.now() - startTime;
      
      clearTimeout(timeout);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Ultra-minimal response payload
      const response = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isOnline: user.isOnline,
      };

      // Check if response already sent before setting headers
      if (!res.headersSent) {
        // Set all headers at once
        res.set({
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'X-Response-Time': `${responseTime}ms`,
          'X-Performance': responseTime < 50 ? 'ULTRA_FAST' : responseTime < 200 ? 'FAST' : 'SLOW'
        });

        res.json(response);
      }
    } catch (error) {
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;
      console.error(`Auth me error (${responseTime}ms):`, error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to fetch user" });
      }
    }
  });

  // Profile routes
  app.put('/api/profile', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = updateProfileSchema.parse(req.body);

      // Check if email is taken by another user
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser && existingUser.id !== req.userId) {
          return res.status(400).json({ message: "Email already taken by another user" });
        }
      }

      const updatedUser = await storage.updateUserProfile(req.userId!, validatedData);

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        birthDate: updatedUser.birthDate,
        phoneNumber: updatedUser.phoneNumber,
        displayUsername: updatedUser.displayUsername,
        profileImageUrl: updatedUser.profileImageUrl,
        isOnline: updatedUser.isOnline,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.put('/api/profile/password', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);

      // Get current user to verify current password
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 12);

      // Update password
      await storage.updateUserPassword(req.userId!, newPasswordHash);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to change password" });
    }
  });

  // Avatar upload endpoint
  app.post('/api/profile/avatar', authenticate, (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex');
      const fileExtension = path.extname(req.file.originalname) || '.jpg';
      const fileName = `avatar_${timestamp}_${randomId}${fileExtension}`;
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads', 'avatars');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      // Save file to uploads directory
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, req.file.buffer);
      
      // Create public URL for the image
      const profileImageUrl = `/uploads/avatars/${fileName}`;
      
      // Update user's profile image URL in database
      const updatedUser = await storage.updateUserProfile(req.userId!, {
        profileImageUrl
      });

      // Ensure JSON response
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: "Avatar uploaded successfully",
        profileImageUrl,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          birthDate: updatedUser.birthDate,
          phoneNumber: updatedUser.phoneNumber,
          displayUsername: updatedUser.displayUsername,
          profileImageUrl: updatedUser.profileImageUrl,
          isOnline: updatedUser.isOnline,
        }
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ message: error.message || "Failed to upload avatar" });
    }
  });

  // Chat routes with optimization
  app.get('/api/chats', authenticate, async (req: AuthenticatedRequest, res) => {
    let requestHandled = false;
    
    // Set timeout for slow connections
    const timeout = setTimeout(() => {
      if (!requestHandled && !res.headersSent) {
        requestHandled = true;
        res.status(408).json({ message: "Request timeout" });
      }
    }, 3000); // 3 second timeout

    try {
      const chats = await storage.getUserChats(req.userId!);
      
      clearTimeout(timeout);
      
      if (!requestHandled && !res.headersSent) {
        requestHandled = true;
        
        // Optimize response headers
        res.set({
          'Cache-Control': 'private, max-age=30', // 30 second cache
          'X-Response-Time': Date.now().toString(),
          'Content-Type': 'application/json'
        });
        
        // Fast JSON response
        res.json(chats);
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error('Chats fetch error:', error);
      
      if (!requestHandled && !res.headersSent) {
        requestHandled = true;
        res.status(500).json({ message: "Failed to fetch chats" });
      }
    }
  });

  app.post('/api/chats', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { participantId, isGroup, name } = req.body;

      let chat;
      if (isGroup) {
        chat = await storage.createChat({
          name,
          isGroup: true,
          createdBy: req.userId!,
        });

        await storage.addChatMember({ chatId: chat.id, userId: req.userId! });
        if (participantId) {
          await storage.addChatMember({ chatId: chat.id, userId: participantId });
        }
      } else {
        chat = await storage.findOrCreateDirectChat(req.userId!, participantId);
      }

      res.status(201).json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  // In-memory cache for messages
  const messageCache = new Map<string, { data: any[], timestamp: number }>();
  const CACHE_DURATION = 300000; // 5 minutes for much better performance
  const CONNECTION_TIMEOUT = 5000; // 5 seconds connection timeout

  app.get('/api/chats/:chatId/messages', authenticate, async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    
    try {
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const cacheKey = `${chatId}:${limit}:${offset}`;
      const cached = messageCache.get(cacheKey);

      // Ultra-fast cache hit - target <10ms
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        const responseTime = Date.now() - startTime;
        res.set({
          'Cache-Control': 'private, max-age=60',
          'X-Cache': 'HIT',
          'X-Response-Time': `${responseTime}ms`,
          'X-Performance': responseTime < 50 ? 'ULTRA_FAST' : 'FAST'
        });
        return res.json(cached.data);
      }

      // Ultra-optimized response headers for <50ms target
      const responseTime = Date.now() - startTime;
      res.set({
        'Cache-Control': 'private, max-age=120', // Longer cache for better performance
        'ETag': `"${chatId}-${limit}-${offset}-${Date.now()}"`,
        'X-Cache': 'MISS',
        'X-Response-Time': `${responseTime}ms`,
        'X-Performance': 'OPTIMIZING',
        'Content-Type': 'application/json; charset=utf-8'
      });

      // Ultra-fast database query with limit optimization
      const queryStartTime = Date.now();
      const messages = await storage.getChatMessages(
        chatId, 
        Math.min(Number(limit), 100), // Limit to 100 for speed
        Number(offset)
      );
      const queryTime = Date.now() - queryStartTime;

      console.log(`Found ${messages.length} messages for chat ${chatId}`);

      // Ultra-fast parallel message decryption
      const decryptStartTime = Date.now();
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          // Lightning-fast empty content check
          if (!msg.content) return { ...msg, content: '' };

          // Skip decryption for unencrypted messages
          if (!msg.isEncrypted) return { ...msg, content: msg.content };

          // Parallel decryption for encrypted messages
          try {
            const decrypted = await Promise.resolve(militaryDecrypt(msg.content));
            return { ...msg, content: decrypted };
          } catch (error) {
            return { ...msg, content: '[🔒 Encrypted]' };
          }
        })
      );
      const decryptTime = Date.now() - decryptStartTime;

      // Return messages in chronological order (oldest first)
      const sortedMessages = decryptedMessages.sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      // Cache with performance tracking
      const totalTime = Date.now() - startTime;
      const cacheData = {
        data: sortedMessages,
        timestamp: Date.now(),
        performance: {
          totalTime,
          queryTime,
          decryptTime,
          messageCount: sortedMessages.length
        }
      };
      
      messageCache.set(cacheKey, cacheData);

      // Aggressive cache cleanup for speed
      if (messageCache.size > 50) { // Smaller cache for speed
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, value] of messageCache.entries()) {
          if (now - value.timestamp > CACHE_DURATION) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => messageCache.delete(key));
      }

      // Ultra-fast response with performance headers
      res.set({
        'X-Total-Time': `${totalTime}ms`,
        'X-Query-Time': `${queryTime}ms`,
        'X-Decrypt-Time': `${decryptTime}ms`,
        'X-Message-Count': sortedMessages.length.toString(),
        'X-Performance-Grade': totalTime < 50 ? 'A+' : totalTime < 100 ? 'A' : 'B'
      });

      res.json(sortedMessages);
    } catch (error) {
      console.error(`Error fetching messages for chat ${req.params.chatId}:`, error);
      res.status(500).json({ 
        message: "Failed to fetch messages",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/chats/:chatId/messages', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { chatId } = req.params;
      const { content, messageType = 'text' } = req.body;

      // Validate input
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      if (!chatId) {
        return res.status(400).json({ message: "Chat ID is required" });
      }

      console.log(`📨 Creating message for chat ${chatId} from user ${req.userId}`);

      // Use military-grade encryption for message content
      let messageContent = content;
      let isEncrypted = false;

      try {
        messageContent = militaryEncrypt(content);
        isEncrypted = true;
      } catch (encryptError) {
        console.warn('Military encryption failed, storing unencrypted:', encryptError);
        // Store unencrypted if encryption fails
        messageContent = content;
        isEncrypted = false;
      }

      const message = await storage.createMessage({
        chatId,
        senderId: req.userId!,
        content: messageContent,
        messageType,
        isEncrypted,
      });

      // Get sender info
      const sender = await storage.getUser(req.userId!);

      const messageWithSender = {
        ...message,
        sender,
        content: content, // Send decrypted content to client
      };

      // Broadcast to WebSocket clients in this chat
      broadcastToChat(chatId, {
        type: 'message',
        chatId,
        messageId: message.id,
        content: content,
        senderId: req.userId!,
        timestamp: message.createdAt?.toISOString(),
      });

      // Clear message cache for this chat
      const cacheKeys = Array.from(messageCache.keys()).filter(key => key.startsWith(`${chatId}:`));
      cacheKeys.forEach(key => messageCache.delete(key));

      console.log(`✅ Message created successfully: ${message.id}`);
      res.status(201).json(messageWithSender);
    } catch (error) {
      console.error(`❌ Error creating message for chat ${req.params.chatId}:`, error);
      res.status(500).json({ 
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error",
        chatId: req.params.chatId
      });
    }
  });

  app.post('/api/messages/:messageId/read', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { messageId } = req.params;
      await storage.markMessageAsRead(messageId, req.userId!);
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Add endpoint for key generation
  app.post('/api/auth/generate-keys', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const keyPair = generateKeyPair();
      // In a real application, you'd securely store or distribute the private key.
      // For this example, we'll send it back, assuming client-side management.
      res.json({
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey // Be cautious with sending private keys
      });
    } catch (error: any) {
      res.status(500).json({ message: "Key generation failed", error: error.message });
    }
  });

  // Preview cache
  const previewCache = new Map<string, { preview: string, timestamp: number }>();
  const PREVIEW_CACHE_DURATION = 300000; // 5 minutes

  // Optimized message preview endpoint with caching
  app.post('/api/messages/decrypt-preview', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { content } = req.body;

      // Fast response for empty content
      if (!content) {
        return res.json({ preview: "No content" });
      }

      // Generate cache key from content hash
      const contentHash = Buffer.from(content).toString('base64').slice(0, 16);
      const cached = previewCache.get(contentHash);

      // Return cached preview if available
      if (cached && Date.now() - cached.timestamp < PREVIEW_CACHE_DURATION) {
        res.set({
          'Cache-Control': 'public, max-age=300',
          'X-Cache': 'HIT'
        });
        return res.json({ preview: cached.preview });
      }

      // Quick check for simple numeric content (skip decryption)
      if (/^\d{1,4}$/.test(content.trim())) {
        const preview = content.trim();
        previewCache.set(contentHash, { preview, timestamp: Date.now() });
        return res.json({ preview });
      }

      // Set response headers for better caching
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'ETag': `"${contentHash}"`, // Generate ETag
        'X-Cache': 'MISS'
      });

      let preview = content;

      // Try to decrypt military-grade messages
      if (content.startsWith('{') && (content.includes('encryptedContent') || content.includes('encrypted'))) {
        try {
          const decrypted = militaryDecrypt(content);
          preview = decrypted && decrypted !== content ? 
            (decrypted.length > 50 ? decrypted.substring(0, 47) + "..." : decrypted) :
            "🔒 End-to-end encrypted";
        } catch (error) {
          // Try fallback decryption
          try {
            const parsed = JSON.parse(content);
            if (parsed.encryptedContent || parsed.encrypted) {
              // Try simple base64 decode for preview
              const encodedContent = parsed.encryptedContent || parsed.encrypted;
              try {
                const decoded = Buffer.from(encodedContent, 'base64').toString('utf8');
                if (decoded && decoded !== encodedContent && decoded.length > 0) {
                  preview = decoded.length > 50 ? decoded.substring(0, 47) + "... (fallback)" : decoded + " (fallback)";
                } else {
                  preview = "🔒 End-to-end encrypted";
                }
              } catch (b64Error) {
                preview = "🔒 End-to-end encrypted";
              }
            } else {
              preview = "🔒 End-to-end encrypted";
            }
          } catch (parseError) {
            preview = "🔒 End-to-end encrypted";
          }
        }
      }
      // Handle legacy encrypted format (AES-256-CBC) - try to decrypt
      else if (content.startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.encrypted && parsed.iv && parsed.algorithm === 'aes-256-cbc') {
            // Legacy AES-256-CBC decryption
            try {
              const algorithm = 'aes-256-cbc';
              const key = crypto.scryptSync('ultrasecure-messenger-key', 'salt', 32);
              const iv = Buffer.from(parsed.iv, 'hex');

              const decipher = crypto.createDecipheriv(algorithm, key, iv);
              let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf8');
              decrypted += decipher.final('utf8');

              preview = decrypted.length > 50 ? decrypted.substring(0, 47) + "..." : decrypted;
            } catch (legacyDecryptError) {
              // Secure error handling without sensitive details
              preview = "🔒 Encrypted message";
            }
          } else if (parsed.encryptedContent && parsed.version) {
            // New military-grade format
            try {
              const decrypted = militaryDecrypt(content);
              preview = decrypted.length > 50 ? decrypted.substring(0, 47) + "..." : decrypted;
            } catch (militaryDecryptError) {
              preview = "🔒 End-to-end encrypted";
            }
          } else {
            // Regular JSON content - sanitize
            const sanitized = content.replace(/[<>&"']/g, '');
            preview = sanitized.length > 50 ? sanitized.substring(0, 47) + "..." : sanitized;
          }
        } catch (parseError) {
          // Not valid JSON, treat as regular text but sanitize
          const sanitized = content.replace(/[<>&"']/g, '');
          preview = sanitized.length > 50 ? sanitized.substring(0, 47) + "..." : sanitized;
        }
      }
      // Base64 encrypted content
      else if (content.length > 20 && /^[A-Za-z0-9+/]+=*$/.test(content)) {
        preview = "🔒 Encrypted content";
      }
      // Regular plain text - sanitize to prevent XSS
      else {
        const sanitized = content.replace(/[<>&"']/g, '');
        preview = sanitized.length > 50 ? sanitized.substring(0, 47) + "..." : sanitized;
      }

      // Cache the computed preview
      previewCache.set(contentHash, { preview, timestamp: Date.now() });

      res.json({ preview });
    } catch (error) {
      // No detailed error information in response
      const errorPreview = "🔒 Protected message";
      previewCache.set(contentHash, { preview: errorPreview, timestamp: Date.now() });
      res.json({ preview: errorPreview });
    }
  });

  // HTTP-only messaging (WebSocket handled by Go server)
  function notifyGoWebSocket(message: any) {
    // In production, use HTTP call to Go server or message queue
    // For now, we'll skip direct WebSocket broadcasting
    console.log('Message for Go WebSocket:', message);
  }

  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    perMessageDeflate: false
  });

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('WebSocket connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'join_chat') {
          ws.chatId = message.chatId;
          ws.userId = message.userId;
        } else if (message.type === 'send_message') {
          // Encrypt message content before storing
          const encryptedContent = encrypt(message.content);

          // Store encrypted message in database
          const [result] = await storage.insertMessage({
            content: encryptedContent,
            chatId: message.chatId,
            senderId: message.userId,
            createdAt: new Date(),
          });

          // Broadcast to all clients in the chat
          wss.clients.forEach((client) => {
            if (client.chatId === message.chatId && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'new_message',
                message: {
                  id: result.id,
                  content: result.content, // Keep encrypted for client-side decryption
                  senderId: result.senderId,
                  createdAt: result.createdAt,
                  chatId: result.chatId,
                }
              }));
            }
          });
        }
      } catch (error) {
        console.error('WebSocket error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Server encryption error'
        }));
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket disconnected');
    });
  });

  // Helper function to broadcast messages to a specific chat room
  function broadcastToChat(chatId: string, message: object) {
    const messageString = JSON.stringify(message);
    const recipients = userChatRooms.get(chatId);

    if (recipients) {
      recipients.forEach((recipientId) => {
        const connection = activeConnections.get(recipientId);
        if (connection && connection.readyState === WebSocket.OPEN) {
          connection.send(messageString);
        }
      });
    }
  }

  return httpServer;
}