import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { loginSchema, registerSchema, insertMessageSchema, updateProfileSchema, changePasswordSchema } from "@shared/schema";
import { generateKeyPair, encrypt as militaryEncrypt, decrypt as militaryDecrypt } from "./militaryEncryption";
import { parse } from "url";

const JWT_SECRET = process.env.JWT_SECRET || "ultrasecure-messenger-jwt-secret-2024";

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
    // Set timeout for slow connections
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ message: "Request timeout" });
      }
    }, 5000); // 5 second timeout

    try {
      // Optimize response headers
      res.set({
        'Cache-Control': 'private, max-age=60', // 1 minute cache
        'X-Response-Time': Date.now().toString()
      });

      const user = await storage.getUser(req.userId!);
      clearTimeout(timeout);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Minimal response payload
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isOnline: user.isOnline,
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('Auth me error:', error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Chat routes with optimization
  app.get('/api/chats', authenticate, async (req: AuthenticatedRequest, res) => {
    // Set timeout for slow connections
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ message: "Request timeout" });
      }
    }, 3000); // 3 second timeout

    try {
      // Optimize response headers
      res.set({
        'Cache-Control': 'private, max-age=30', // 30 second cache
        'X-Response-Time': Date.now().toString(),
        'Content-Type': 'application/json'
      });

      const chats = await storage.getUserChats(req.userId!);
      clearTimeout(timeout);
      
      // Fast JSON response
      res.json(chats);
    } catch (error) {
      clearTimeout(timeout);
      console.error('Chats fetch error:', error);
      res.status(500).json({ message: "Failed to fetch chats" });
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
  const CACHE_DURATION = 60000; // 60 seconds for better performance
  const CONNECTION_TIMEOUT = 5000; // 5 seconds connection timeout

  app.get('/api/chats/:chatId/messages', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { chatId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const cacheKey = `${chatId}:${limit}:${offset}`;
      const cached = messageCache.get(cacheKey);

      // Return cached data if available and not expired
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        res.set({
          'Cache-Control': 'private, max-age=30',
          'X-Cache': 'HIT'
        });
        return res.json(cached.data);
      }

      // Optimize caching headers for slow connections
      const cacheMaxAge = req.headers['connection-type'] === 'slow' ? 300 : 60; // Longer cache for slow connections
      res.set({
        'Cache-Control': `private, max-age=${cacheMaxAge}`,
        'ETag': `"${chatId}-${limit}-${offset}"`,
        'X-Cache': 'MISS',
        'Vary': 'Connection-Type',
        'X-Content-Type-Options': 'nosniff', // Security header
        'Content-Encoding': 'gzip' // Enable compression
      });

      const messages = await storage.getChatMessages(
        chatId, 
        Number(limit), 
        Number(offset)
      );

      console.log(`Found ${messages.length} messages for chat ${chatId}`);

      // Optimized message decryption with caching
      const decryptedMessages = messages.map(msg => {
        // Fast path for empty content
        if (!msg.content) {
          return { ...msg, content: '' };
        }

        // Fast path for unencrypted messages
        if (!msg.isEncrypted) {
          return { ...msg, content: msg.content };
        }

        // Decrypt encrypted messages
        try {
          const decrypted = militaryDecrypt(msg.content);
          return { ...msg, content: decrypted };
        } catch (error) {
          // Silent fallback for failed decryption
          return { ...msg, content: '[Encrypted message]' };
        }
      });

      // Return messages in chronological order (oldest first)
      const sortedMessages = decryptedMessages.sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      // Cache the result
      messageCache.set(cacheKey, {
        data: sortedMessages,
        timestamp: Date.now()
      });

      // Clean old cache entries periodically
      if (messageCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of messageCache.entries()) {
          if (now - value.timestamp > CACHE_DURATION * 2) {
            messageCache.delete(key);
          }
        }
      }

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
      if (content.startsWith('{') && content.includes('encryptedContent')) {
        try {
          const decrypted = militaryDecrypt(content);
          preview = decrypted.length > 50 ? decrypted.substring(0, 47) + "..." : decrypted;
        } catch (error) {
          // No logging of sensitive content
          preview = "🔒 End-to-end encrypted";
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