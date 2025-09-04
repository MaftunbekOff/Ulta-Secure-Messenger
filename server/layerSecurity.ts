
// Server-side qatlamlar xavfsizligi
// Layer 2 (Node.js server) va Layer 3 (Rust) orasidagi himoya

import { rustIntegration } from './rustIntegration';

export interface SecureLayerMessage {
  content: string;
  fromLayer: number;
  toLayer: number;
  timestamp: number;
  signature: string;
  sessionId: string;
}

export class ServerLayerSecurity {
  private static instance: ServerLayerSecurity;
  private layerKeys: Map<string, string> = new Map();

  constructor() {
    this.initializeLayerKeys();
  }

  static getInstance(): ServerLayerSecurity {
    if (!ServerLayerSecurity.instance) {
      ServerLayerSecurity.instance = new ServerLayerSecurity();
    }
    return ServerLayerSecurity.instance;
  }

  // Layer 2 va Layer 3 orasidagi kalitlarni yaratish
  private initializeLayerKeys(): void {
    this.layerKeys.set('layer2_to_layer3', this.generateSecureKey('L2_TO_L3'));
    this.layerKeys.set('layer3_to_layer2', this.generateSecureKey('L3_TO_L2'));
    this.layerKeys.set('layer1_to_layer2', this.generateSecureKey('L1_TO_L2'));
    this.layerKeys.set('layer2_to_layer1', this.generateSecureKey('L2_TO_L1'));

    console.log('🔐 Server layer security keys initialized');
  }

  private generateSecureKey(purpose: string): string {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const random = crypto.randomBytes(32).toString('hex');
    return `${purpose}_${timestamp}_${random}`.slice(0, 64);
  }

  // Rust layer ga xavfsiz xabar yuborish
  async sendToRustLayer(message: string, sessionId: string): Promise<string> {
    try {
      const layerMessage: SecureLayerMessage = {
        content: message,
        fromLayer: 2,
        toLayer: 3,
        timestamp: Date.now(),
        signature: await this.signMessage(message, 2),
        sessionId
      };

      const encrypted = await this.encryptForRust(JSON.stringify(layerMessage));
      
      // Rust integration orqali yuborish
      const rustResponse = await rustIntegration.processSecureMessage(encrypted);
      
      console.log('🦀 Message sent securely to Rust layer');
      return rustResponse;
      
    } catch (error) {
      console.error('🚨 Failed to send secure message to Rust:', error);
      throw new Error('Rust layer communication failed');
    }
  }

  // Rust layer dan xavfsiz xabar qabul qilish
  async receiveFromRustLayer(encryptedMessage: string): Promise<string> {
    try {
      const decrypted = await this.decryptFromRust(encryptedMessage);
      const layerMessage: SecureLayerMessage = JSON.parse(decrypted);

      // Imzo va vaqtni tekshirish
      if (!await this.verifyMessage(layerMessage)) {
        throw new Error('Message verification failed');
      }

      console.log('✅ Secure message received from Rust layer');
      return layerMessage.content;
      
    } catch (error) {
      console.error('🚨 Failed to receive secure message from Rust:', error);
      throw new Error('Rust layer message verification failed');
    }
  }

  // Client layer bilan xavfsiz aloqa
  async communicateWithClient(message: string, direction: 'send' | 'receive'): Promise<string> {
    const key = direction === 'send' ? 'layer2_to_layer1' : 'layer1_to_layer2';
    const layerKey = this.layerKeys.get(key);

    if (!layerKey) {
      throw new Error('Layer key not found');
    }

    if (direction === 'send') {
      return await this.encryptMessage(message, layerKey);
    } else {
      return await this.decryptMessage(message, layerKey);
    }
  }

  private async encryptForRust(message: string): Promise<string> {
    const key = this.layerKeys.get('layer2_to_layer3');
    if (!key) throw new Error('Rust layer key not found');
    
    return await this.encryptMessage(message, key);
  }

  private async decryptFromRust(encryptedMessage: string): Promise<string> {
    const key = this.layerKeys.get('layer3_to_layer2');
    if (!key) throw new Error('Rust layer key not found');
    
    return await this.decryptMessage(encryptedMessage, key);
  }

  private async encryptMessage(message: string, key: string): Promise<string> {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${encrypted}:${authTag}`;
  }

  private async decryptMessage(encryptedMessage: string, key: string): Promise<string> {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    
    const [encrypted, authTagHex] = encryptedMessage.split(':');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async signMessage(message: string, layer: number): Promise<string> {
    const crypto = require('crypto');
    const signatureData = `${message}_LAYER_${layer}_${Date.now()}`;
    
    return crypto.createHash('sha256').update(signatureData).digest('hex');
  }

  private async verifyMessage(layerMessage: SecureLayerMessage): Promise<boolean> {
    try {
      const expectedSignature = await this.signMessage(layerMessage.content, layerMessage.fromLayer);
      
      // Imzo tekshiruvi
      if (layerMessage.signature !== expectedSignature) {
        console.warn('🚨 Message signature verification failed');
        return false;
      }

      // Vaqt tekshiruvi (5 daqiqadan eski bo'lmasligi kerak)
      const messageAge = Date.now() - layerMessage.timestamp;
      if (messageAge > 5 * 60 * 1000) {
        console.warn('🚨 Message too old - possible replay attack');
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // Emergency: barcha kalitlarni yangilash
  rotateAllKeys(): void {
    console.log('🔄 Emergency server layer key rotation');
    this.layerKeys.clear();
    this.initializeLayerKeys();
  }

  // Layer xavfsizlik holatini tekshirish
  getSecurityStatus() {
    return {
      layer2Active: this.layerKeys.has('layer2_to_layer3'),
      layer3Connected: this.layerKeys.has('layer3_to_layer2'),
      clientConnected: this.layerKeys.has('layer1_to_layer2'),
      totalKeys: this.layerKeys.size,
      lastRotation: Date.now()
    };
  }
}

export const serverLayerSecurity = ServerLayerSecurity.getInstance();
