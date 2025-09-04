import {
  type User,
  type InsertUser,
  type Chat,
  type InsertChat,
  type Message,
  type InsertMessage,
  type ChatMember,
  type InsertChatMember,
  users,
  chats,
  chatMembers,
  messages,
  messageReads,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, ne } from "drizzle-orm";

// Renamed tables to avoid naming conflicts with imported schema types
import { users as usersTable, messages as messagesTable } from "@shared/schema";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string; profileImageUrl?: string }): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;

  // Chat operations
  createChat(chat: InsertChat): Promise<Chat>;
  getUserChats(userId: string): Promise<Array<Chat & {
    lastMessage?: Message & { sender: User };
    unreadCount: number;
    otherUser?: User;
  }>>;
  getChatById(chatId: string): Promise<Chat | undefined>;
  getChatMembers(chatId: string): Promise<Array<ChatMember & { user: User }>>;
  addChatMember(member: InsertChatMember): Promise<ChatMember>;
  removeChatMember(chatId: string, userId: string): Promise<void>;
  findOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat>;

  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getChatMessages(chatId: string, limit?: number, offset?: number): Promise<Array<Message & { sender: User }>>;
  markMessageAsRead(messageId: string, userId: string): Promise<void>;
  getUnreadMessageCount(chatId: string, userId: string): Promise<number>;
}

export class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private chats: Map<string, Chat> = new Map();
  private messages: Map<string, Message> = new Map();
  private chatMembers: Map<string, ChatMember[]> = new Map();
  private messageReads: Map<string, string[]> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    return users.find(user => user.username === username);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user: User = {
      id: generateId(),
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: null,
      publicKey: userData.publicKey || null,
      isOnline: false,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = isOnline ? null : new Date();
      user.updatedAt = new Date();
    }
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string; profileImageUrl?: string }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    Object.assign(user, {
      ...data,
      updatedAt: new Date()
    });

    this.users.set(userId, user);
    return user;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
    this.users.set(userId, user);
  }

  async createChat(chatData: InsertChat): Promise<Chat> {
    const chat: Chat = {
      id: generateId(),
      name: chatData.name || null,
      isGroup: chatData.isGroup || false,
      createdBy: chatData.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chats.set(chat.id, chat);
    return chat;
  }

  async getUserChats(userId: string): Promise<Array<Chat & {
    lastMessage?: Message & { sender: User };
    unreadCount: number;
    otherUser?: User;
  }>> {
    const result = [];
    const chatEntries = Array.from(this.chatMembers.entries());

    for (const [chatId, members] of chatEntries) {
      const isMember = members.some((member: ChatMember) => member.userId === userId);
      if (!isMember) continue;

      const chat = this.chats.get(chatId);
      if (!chat) continue;

      // Get last message
      let lastMessage: (Message & { sender: User }) | undefined;
      let lastMessageTime = 0;

      const messages = Array.from(this.messages.values());
      for (const message of messages) {
        if (message.chatId === chatId && message.createdAt) {
          const messageTime = message.createdAt.getTime();
          if (messageTime > lastMessageTime && message.senderId) {
            const sender = this.users.get(message.senderId);
            if (sender) {
              lastMessage = { ...message, sender };
              lastMessageTime = messageTime;
            }
          }
        }
      }

      // Get unread count
      const unreadCount = await this.getUnreadMessageCount(chatId, userId);

      // Get other user for direct chats
      let otherUser: User | undefined;
      if (!chat.isGroup) {
        const otherMember = members.find((member: ChatMember) => member.userId !== userId);
        if (otherMember && otherMember.userId) {
          otherUser = this.users.get(otherMember.userId);
        }
      }

      result.push({
        ...chat,
        lastMessage,
        unreadCount,
        otherUser,
      });
    }

    return result.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() || 0;
      const bTime = b.lastMessage?.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getChatById(chatId: string): Promise<Chat | undefined> {
    return this.chats.get(chatId);
  }

  async getChatMembers(chatId: string): Promise<Array<ChatMember & { user: User }>> {
    const members = this.chatMembers.get(chatId) || [];
    const result = [];

    for (const member of members) {
      if (member.userId) {
        const user = this.users.get(member.userId);
        if (user) {
          result.push({ ...member, user });
        }
      }
    }

    return result;
  }

  async addChatMember(memberData: InsertChatMember): Promise<ChatMember> {
    const member: ChatMember = {
      chatId: memberData.chatId || '',
      userId: memberData.userId || '',
      joinedAt: new Date(),
      role: memberData.role || 'member',
    };

    if (memberData.chatId) {
      const existingMembers = this.chatMembers.get(memberData.chatId) || [];
      existingMembers.push(member);
      this.chatMembers.set(memberData.chatId, existingMembers);
    }

    return member;
  }

  async removeChatMember(chatId: string, userId: string): Promise<void> {
    const members = this.chatMembers.get(chatId) || [];
    const filteredMembers = members.filter(m => m.userId !== userId);
    this.chatMembers.set(chatId, filteredMembers);
  }

  async findOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat> {
    // Look for existing direct chat
    const chatEntries = Array.from(this.chatMembers.entries());
    for (const [chatId, members] of chatEntries) {
      const chat = this.chats.get(chatId);
      if (chat && !chat.isGroup && members.length === 2) {
        const memberIds = members.map((member: ChatMember) => member.userId).filter(Boolean);
        if (memberIds.includes(user1Id) && memberIds.includes(user2Id)) {
          return chat;
        }
      }
    }

    // Create new direct chat
    const newChat = await this.createChat({
      isGroup: false,
      createdBy: user1Id,
    });

    // Add both users as members
    await this.addChatMember({ chatId: newChat.id, userId: user1Id });
    await this.addChatMember({ chatId: newChat.id, userId: user2Id });

    return newChat;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const message: Message = {
      id: generateId(),
      chatId: messageData.chatId || '',
      senderId: messageData.senderId || '',
      content: messageData.content,
      messageType: messageData.messageType || 'text',
      isEncrypted: messageData.isEncrypted || true,
      editedAt: null,
      createdAt: new Date(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async getChatMessages(chatId: string, limit = 50, offset = 0): Promise<Array<Message & { sender: User }>> {
    const allMessages = Array.from(this.messages.values());
    const chatMessages = allMessages
      .filter(m => m.chatId === chatId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(offset, offset + limit);

    const result = [];
    for (const message of chatMessages) {
      if (message.senderId) {
        const sender = this.users.get(message.senderId);
        if (sender) {
          result.push({ ...message, sender });
        }
      }
    }

    return result;
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const readers = this.messageReads.get(messageId) || [];
    if (!readers.includes(userId)) {
      readers.push(userId);
      this.messageReads.set(messageId, readers);
    }
  }

  async getUnreadMessageCount(chatId: string, userId: string): Promise<number> {
    let count = 0;
    const allMessages = Array.from(this.messages.values());

    for (const message of allMessages) {
      if (message.chatId === chatId && message.senderId !== userId) {
        const readers = this.messageReads.get(message.id) || [];
        if (!readers.includes(userId)) {
          count++;
        }
      }
    }

    return count;
  }
}

export class DatabaseStorage implements IStorage {
  // Ultra-fast user cache
  private userCache = new Map<string, { user: User, timestamp: number }>();
  private readonly USER_CACHE_TTL = 60000; // 60 seconds

  async getUser(userId: string): Promise<User | null> {
    try {
      // Check cache first for sub-millisecond response
      const cached = this.userCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.USER_CACHE_TTL) {
        return cached.user;
      }

      // Optimized query with specific fields only
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          isOnline: users.isOnline,
          passwordHash: users.passwordHash,
          publicKey: users.publicKey,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        // Cache the result
        this.userCache.set(userId, { user, timestamp: Date.now() });

        // Cleanup old cache entries
        if (this.userCache.size > 1000) {
          const now = Date.now();
          for (const [key, value] of this.userCache.entries()) {
            if (now - value.timestamp > this.USER_CACHE_TTL) {
              this.userCache.delete(key);
            }
          }
        }
      }

      return user || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db.update(users)
      .set({
        isOnline,
        lastSeen: isOnline ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; email?: string; profileImageUrl?: string }): Promise<User> {
    const result = await db.update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createChat(chatData: InsertChat): Promise<Chat> {
    const result = await db.insert(chats).values(chatData).returning();
    return result[0];
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    try {
      // Optimized query with specific fields only
      const userChats = await db
        .select({
          id: chats.id,
          name: chats.name,
          isGroup: chats.isGroup,
          createdAt: chats.createdAt,
          createdBy: chats.createdBy,
        })
        .from(chatMembers)
        .innerJoin(chats, eq(chatMembers.chatId, chats.id))
        .where(eq(chatMembers.userId, userId))
        .orderBy(desc(chats.createdAt))
        .limit(50); // Limit initial load

      return userChats;
    } catch (error) {
      console.error('getUserChats error:', error);
      return [];
    }
  }

  async getChatById(chatId: string): Promise<Chat | undefined> {
    const result = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    return result[0];
  }

  async getChatMembers(chatId: string): Promise<Array<ChatMember & { user: User }>> {
    const result = await db
      .select({
        member: chatMembers,
        user: users,
      })
      .from(chatMembers)
      .innerJoin(users, eq(chatMembers.userId, users.id))
      .where(eq(chatMembers.chatId, chatId));

    return result.map(({ member, user }) => ({ ...member, user }));
  }

  async addChatMember(memberData: InsertChatMember): Promise<ChatMember> {
    const result = await db.insert(chatMembers).values(memberData).returning();
    return result[0];
  }

  async removeChatMember(chatId: string, userId: string): Promise<void> {
    await db.delete(chatMembers)
      .where(and(
        eq(chatMembers.chatId, chatId),
        eq(chatMembers.userId, userId)
      ));
  }

  async findOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat> {
    // Look for existing direct chat between these two users
    const existingChatQuery = db
      .select({ chat: chats })
      .from(chats)
      .innerJoin(chatMembers, eq(chats.id, chatMembers.chatId))
      .where(and(
        eq(chats.isGroup, false),
        eq(chatMembers.userId, user1Id)
      ));

    const user1Chats = await existingChatQuery;

    for (const { chat } of user1Chats) {
      // Check if user2 is also a member of this chat
      const user2InChat = await db
        .select()
        .from(chatMembers)
        .where(and(
          eq(chatMembers.chatId, chat.id),
          eq(chatMembers.userId, user2Id)
        ))
        .limit(1);

      if (user2InChat.length > 0) {
        return chat;
      }
    }

    // Create new direct chat
    const newChat = await this.createChat({
      isGroup: false,
      createdBy: user1Id,
    });

    // Add both users as members
    await this.addChatMember({ chatId: newChat.id, userId: user1Id });
    await this.addChatMember({ chatId: newChat.id, userId: user2Id });

    return newChat;
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(messageData).returning();
    return result[0];
  }

  async getChatMessages(chatId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      // Ultra-optimized query with specific fields only
      const messagesResult = await db
        .select({
          id: messages.id,
          content: messages.content,
          senderId: messages.senderId,
          createdAt: messages.createdAt,
          isEncrypted: messages.isEncrypted,
          messageType: messages.messageType
        })
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(desc(messages.createdAt))
        .limit(Math.min(limit, 100)) // Cap at 100 for performance
        .offset(offset);

      return messagesResult;
    } catch (error) {
      console.error('getChatMessages error:', error);
      return [];
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    // Insert read receipt, ignoring if already exists
    await db.insert(messageReads)
      .values({ messageId, userId })
      .onConflictDoNothing();
  }

  async getUnreadMessageCount(chatId: string, userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(messages)
      .leftJoin(messageReads, and(
        eq(messageReads.messageId, messages.id),
        eq(messageReads.userId, userId)
      ))
      .where(and(
        eq(messages.chatId, chatId),
        ne(messages.senderId, userId),
        sql`${messageReads.messageId} IS NULL`
      ));

    return result[0]?.count || 0;
  }
}

// Use DatabaseStorage instead of MemoryStorage
export const storage = new DatabaseStorage();