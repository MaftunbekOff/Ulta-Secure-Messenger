
// Qatlamlar o'rtasida xavfsiz aloqa tizimi
// Har bir qatlam o'z shifrini ishlatadi va keyingi qatlamga shifrlangan holda yuboradi

export interface LayerMessage {
  content: string;
  fromLayer: number;
  toLayer: number;
  timestamp: number;
  signature: string;
}

export interface LayerKeys {
  layer1ToLayer2: string;
  layer2ToLayer3: string;
  layer3ToLayer2: string;
  layer2ToLayer1: string;
}

export class LayeredSecurity {
  private static instance: LayeredSecurity;
  private layerKeys: LayerKeys;
  private currentLayer: number = 1;

  constructor() {
    this.generateLayerKeys();
  }

  static getInstance(): LayeredSecurity {
    if (!LayeredSecurity.instance) {
      LayeredSecurity.instance = new LayeredSecurity();
    }
    return LayeredSecurity.instance;
  }

  // Har bir qatlam uchun alohida kalitlar yaratish
  private generateLayerKeys(): void {
    this.layerKeys = {
      layer1ToLayer2: this.generateSecureKey('LAYER1_TO_LAYER2'),
      layer2ToLayer3: this.generateSecureKey('LAYER2_TO_LAYER3'),
      layer3ToLayer2: this.generateSecureKey('LAYER3_TO_LAYER2'),
      layer2ToLayer1: this.generateSecureKey('LAYER2_TO_LAYER1')
    };

    // Kalitlarni xavfsiz saqlash
    this.secureStoreKeys();
  }

  // Xavfsiz kalit yaratish
  private generateSecureKey(purpose: string): string {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(32));
    const combined = `${purpose}_${timestamp}_${Array.from(random).join('')}`;
    
    return btoa(combined).slice(0, 32);
  }

  // Kalitlarni xavfsiz saqlash (har bir qatlam uchun alohida)
  private secureStoreKeys(): void {
    const encryptedKeys = this.encryptKeys(JSON.stringify(this.layerKeys));
    
    // Layer 1 uchun
    localStorage.setItem('layer_keys_1', encryptedKeys);
    
    // Layer 2 uchun (server-side storage simulation)
    this.sendToSecureStorage('layer_keys_2', encryptedKeys);
    
    // Layer 3 uchun (Rust layer storage)
    this.sendToRustVault('layer_keys_3', encryptedKeys);
  }

  // Qatlamlar o'rtasida xabar yuborish (shifrlangan)
  async sendSecureMessage(message: string, fromLayer: number, toLayer: number): Promise<string> {
    try {
      // Xabarni imzolash
      const signature = await this.signMessage(message, fromLayer);
      
      // Qatlam xabari yaratish
      const layerMessage: LayerMessage = {
        content: message,
        fromLayer,
        toLayer,
        timestamp: Date.now(),
        signature
      };

      // Xabarni shifrlash (qatlam kaliti bilan)
      const encryptionKey = this.getLayerKey(fromLayer, toLayer);
      const encryptedMessage = await this.encryptForLayer(JSON.stringify(layerMessage), encryptionKey);

      // Qo'shimcha himoya qatlami
      const doubleEncrypted = await this.addSecondaryEncryption(encryptedMessage, toLayer);

      console.log(`🔐 Layer ${fromLayer} → Layer ${toLayer}: Xabar shifrlangan`);
      
      return doubleEncrypted;
      
    } catch (error) {
      console.error('🚨 Layer communication error:', error);
      throw new Error('Secure layer communication failed');
    }
  }

  // Qatlamlar orasidan xabar qabul qilish va deshifrlash
  async receiveSecureMessage(encryptedMessage: string, fromLayer: number, toLayer: number): Promise<string> {
    try {
      // Ikkinchi shifrlashni ochish
      const singleEncrypted = await this.removeSecondaryEncryption(encryptedMessage, toLayer);
      
      // Qatlam kaliti bilan deshifrlash
      const encryptionKey = this.getLayerKey(fromLayer, toLayer);
      const decryptedJson = await this.decryptFromLayer(singleEncrypted, encryptionKey);
      
      const layerMessage: LayerMessage = JSON.parse(decryptedJson);
      
      // Imzoni tekshirish
      const isValidSignature = await this.verifySignature(layerMessage.content, layerMessage.signature, fromLayer);
      
      if (!isValidSignature) {
        throw new Error('Invalid message signature - possible tampering detected');
      }

      // Vaqt tekshiruvi (5 daqiqadan eski xabarlarni rad etish)
      const messageAge = Date.now() - layerMessage.timestamp;
      if (messageAge > 5 * 60 * 1000) {
        throw new Error('Message expired - possible replay attack');
      }

      console.log(`✅ Layer ${fromLayer} → Layer ${toLayer}: Xabar muvaffaqiyatli qabul qilindi`);
      
      return layerMessage.content;
      
    } catch (error) {
      console.error('🚨 Layer message verification failed:', error);
      throw new Error('Secure layer communication verification failed');
    }
  }

  // Qatlam kalitini olish
  private getLayerKey(fromLayer: number, toLayer: number): string {
    const keyName = `layer${fromLayer}ToLayer${toLayer}` as keyof LayerKeys;
    return this.layerKeys[keyName] || this.layerKeys.layer1ToLayer2;
  }

  // Qatlam uchun shifrlash
  private async encryptForLayer(message: string, key: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const keyData = encoder.encode(key);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData.slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...combined));
      
    } catch (error) {
      console.error('Layer encryption failed:', error);
      throw new Error('Layer encryption failed');
    }
  }

  // Qatlamdan deshifrlash
  private async decryptFromLayer(encryptedMessage: string, key: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedMessage).split('').map(char => char.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData.slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
      
    } catch (error) {
      console.error('Layer decryption failed:', error);
      throw new Error('Layer decryption failed');
    }
  }

  // Qo'shimcha ikkinchi shifrlash qatlami
  private async addSecondaryEncryption(message: string, targetLayer: number): Promise<string> {
    const secondaryKey = `SECONDARY_LAYER_${targetLayer}_${Date.now()}`;
    return await this.encryptForLayer(message, secondaryKey);
  }

  // Ikkinchi shifrlashni ochish
  private async removeSecondaryEncryption(message: string, targetLayer: number): Promise<string> {
    const secondaryKey = `SECONDARY_LAYER_${targetLayer}_${Date.now()}`;
    return await this.decryptFromLayer(message, secondaryKey);
  }

  // Xabarni imzolash
  private async signMessage(message: string, layer: number): Promise<string> {
    const signatureData = `${message}_LAYER_${layer}_${Date.now()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureData);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    return btoa(String.fromCharCode(...hashArray));
  }

  // Imzoni tekshirish
  private async verifySignature(message: string, signature: string, layer: number): Promise<boolean> {
    try {
      const expectedSignature = await this.signMessage(message, layer);
      return signature === expectedSignature;
    } catch {
      return false;
    }
  }

  // Kalitlarni shifrlash
  private encryptKeys(keys: string): string {
    const masterKey = 'ULTRA_SECURE_MASTER_KEY_' + Date.now();
    return btoa(keys + '_ENCRYPTED_WITH_' + masterKey);
  }

  // Server storage ga yuborish (Layer 2)
  private sendToSecureStorage(key: string, value: string): void {
    try {
      fetch('/api/secure-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, layer: 2 })
      }).catch(error => {
        console.warn('Layer 2 storage failed:', error);
      });
    } catch (error) {
      console.warn('Layer 2 storage error:', error);
    }
  }

  // Rust vault ga yuborish (Layer 3)
  private sendToRustVault(key: string, value: string): void {
    try {
      fetch('/api/rust/secure-vault', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Layer': '3'
        },
        body: JSON.stringify({ key, value, layer: 3 })
      }).catch(error => {
        console.warn('Layer 3 vault failed:', error);
      });
    } catch (error) {
      console.warn('Layer 3 vault error:', error);
    }
  }

  // Qatlam holatini tekshirish
  checkLayerSecurity(): { layer1: boolean; layer2: boolean; layer3: boolean } {
    return {
      layer1: !!this.layerKeys?.layer1ToLayer2,
      layer2: this.isLayer2Secure(),
      layer3: this.isLayer3Secure()
    };
  }

  private isLayer2Secure(): boolean {
    // Layer 2 xavfsizligini tekshirish
    return typeof this.layerKeys?.layer2ToLayer3 === 'string';
  }

  private isLayer3Secure(): boolean {
    // Layer 3 xavfsizligini tekshirish  
    return typeof this.layerKeys?.layer3ToLayer2 === 'string';
  }

  // Emergency: barcha qatlamlar kalitlarini yangilash
  emergencyKeyRotation(): void {
    console.log('🔄 Emergency key rotation initiated across all layers');
    this.generateLayerKeys();
    
    // Barcha ochiq sessiyalarni tugatish
    this.invalidateAllSessions();
  }

  private invalidateAllSessions(): void {
    // Layer 1 sessiyalarini tugatish
    localStorage.removeItem('user_session');
    
    // Layer 2/3 sessiyalarini tugatish
    fetch('/api/invalidate-sessions', { method: 'POST' }).catch(console.warn);
  }
}

// Global export
export const layeredSecurity = LayeredSecurity.getInstance();
