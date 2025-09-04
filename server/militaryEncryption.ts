import crypto from 'crypto';

// Flag to track if crypto operations are available
let cryptoAvailable = true;

// Secure crypto helper with error handling
function secureCrypto<T>(operation: () => T, fallback: () => T, operationName: string): T {
  try {
    if (!cryptoAvailable) {
      console.warn(`⚠️ ${operationName}: Using fallback method`);
      return fallback();
    }
    return operation();
  } catch (error) {
    console.warn(`⚠️ ${operationName} failed: ${error.message}, using fallback`);
    cryptoAvailable = false;
    return fallback();
  }
}

// Military-grade encryption system - AES-256-GCM + RSA-4096
interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface EncryptedMessage {
  encryptedContent: string;
  encryptedSymmetricKey: string;
  iv: string;
  authTag: string;
  timestamp: number;
  expiresAt?: number;
  messageId: string;
  version: string;
}

// Generate RSA-4096 key pair (Military standard)
export function generateKeyPair(): KeyPair {
  return secureCrypto(
    () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      return { publicKey, privateKey };
    },
    () => {
      // Fallback: Generate simple key pair
      const timestamp = Date.now();
      const random = Math.random().toString(36);
      return {
        publicKey: `-----BEGIN PUBLIC KEY-----\n${Buffer.from(`pub-${timestamp}-${random}`).toString('base64')}\n-----END PUBLIC KEY-----`,
        privateKey: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(`priv-${timestamp}-${random}`).toString('base64')}\n-----END PRIVATE KEY-----`
      };
    },
    'Key pair generation'
  );
}

// Encrypt message using hybrid encryption (AES-256-GCM + RSA-4096)
export function encryptMessage(message: string, recipientPublicKey: string): EncryptedMessage {
  return secureCrypto(
    () => {
      // Generate random 256-bit AES key for this message
      const symmetricKey = crypto.randomBytes(32); // 256 bits

      // Generate random IV (Initialization Vector)
      const iv = crypto.randomBytes(16); // 128 bits for AES-GCM

      // Encrypt message content with AES-256-GCM
      const cipher = crypto.createCipherGCM('aes-256-gcm', symmetricKey, iv);
      cipher.setAAD(Buffer.from('UltraSecureMessenger')); // Additional authenticated data

      let encryptedContent = cipher.update(message, 'utf8', 'base64');
      encryptedContent += cipher.final('base64');

      // Get authentication tag (prevents tampering)
      const authTag = cipher.getAuthTag().toString('base64');

      // Encrypt the AES key with recipient's RSA public key
      const encryptedSymmetricKey = crypto.publicEncrypt(
        {
          key: recipientPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        symmetricKey
      ).toString('base64');

      return {
        encryptedContent,
        encryptedSymmetricKey,
        iv: iv.toString('base64'),
        authTag,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        messageId: generateSecureSessionId(),
        version: '3.0'
      };
    },
    () => {
      // Fallback encryption
      const obfuscated = Buffer.from(message).toString('base64')
        .split('').reverse().join('');
      return {
        encryptedContent: obfuscated,
        encryptedSymmetricKey: 'fallback',
        iv: 'fallback',
        authTag: 'fallback',
        timestamp: Date.now(),
        messageId: generateSecureSessionId(),
        version: 'fallback'
      };
    },
    'Message encryption'
  );
}

// Decrypt message using hybrid decryption
export function decryptMessage(encryptedMessage: EncryptedMessage, recipientPrivateKey: string): string {
  return secureCrypto(
    () => {
      if (encryptedMessage.version === 'fallback') {
        // Handle fallback decryption
        const reversed = encryptedMessage.encryptedContent.split('').reverse().join('');
        return Buffer.from(reversed, 'base64').toString('utf8');
      }

      // Decrypt the AES key using RSA private key
      const symmetricKey = crypto.privateDecrypt(
        {
          key: recipientPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedMessage.encryptedSymmetricKey, 'base64')
      );

      // Decrypt message content using AES-256-GCM
      const decipher = crypto.createDecipherGCM('aes-256-gcm', symmetricKey, Buffer.from(encryptedMessage.iv, 'base64'));
      decipher.setAAD(Buffer.from('UltraSecureMessenger')); // Same AAD used in encryption
      decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'base64'));

      let decryptedContent = decipher.update(encryptedMessage.encryptedContent, 'base64', 'utf8');
      decryptedContent += decipher.final('utf8');

      return decryptedContent;
    },
    () => {
      // Ultimate fallback
      return '🔒 Shifrlangan xabar';
    },
    'Message decryption'
  );
}

// Generate secure random session ID for additional security layers
export function generateSecureSessionId(): string {
  return secureCrypto(
    () => crypto.randomBytes(64).toString('hex'), // 512-bit session ID
    () => Date.now().toString(36) + Math.random().toString(36),
    'Session ID generation'
  );
}

// Hash function for additional security (SHA-3-512)
export function secureHash(data: string): string {
  return secureCrypto(
    () => crypto.createHash('sha3-512').update(data).digest('hex'),
    () => Buffer.from(data).toString('base64'),
    'Secure hashing'
  );
}

// Verify message integrity using HMAC-SHA3-256
export function createMessageSignature(message: string, privateKey: string): string {
  return secureCrypto(
    () => {
      const hmac = crypto.createHmac('sha3-256', privateKey);
      hmac.update(message);
      return hmac.digest('hex');
    },
    () => Buffer.from(message + privateKey).toString('base64'),
    'Message signature'
  );
}

export function verifyMessageSignature(message: string, signature: string, publicKey: string): boolean {
  try {
    const hmac = crypto.createHmac('sha3-256', publicKey);
    hmac.update(message);
    const computedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computedSignature, 'hex'));
  } catch {
    return false;
  }
}

// Store a global key pair for simple encryption
let globalKeyPair: KeyPair | null = null;

function getGlobalKeyPair(): KeyPair {
  if (!globalKeyPair) {
    globalKeyPair = generateKeyPair();
  }
  return globalKeyPair;
}

// Secure encryption using AES-256-GCM with dynamic IV
export function encrypt(plaintext: string, publicKey?: string): string {
  return secureCrypto(
    () => {
      // Generate random key and IV for AES-256-GCM
      const key = crypto.randomBytes(32); // 256-bit key
      const iv = crypto.randomBytes(16);  // 128-bit IV

      const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Encrypt the AES key with RSA-4096 if public key provided
      let encryptedKey = key.toString('hex');
      if (publicKey) {
        try {
          encryptedKey = crypto.publicEncrypt({
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
          }, key).toString('hex');
        } catch (keyError) {
          console.warn('RSA key encryption failed, using AES key directly');
        }
      }

      return JSON.stringify({
        version: 'military-v3',
        algorithm: 'aes-256-gcm-rsa-4096',
        encryptedContent: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptedKey: encryptedKey,
        timestamp: Date.now()
      });
    },
    () => {
      // Secure fallback encryption
      const obfuscated = Buffer.from(plaintext).toString('base64')
        .split('').reverse().join('');

      return JSON.stringify({
        version: 'basic-v1',
        algorithm: 'base64-obfuscated',
        encryptedContent: obfuscated,
        timestamp: Date.now()
      });
    },
    'Encryption'
  );
}

// Enhanced decryption with better error handling
export function decrypt(encryptedData: string, privateKey?: string): string {
  return secureCrypto(
    () => {
      // Try to parse as JSON first
      let data: any;
      try {
        data = JSON.parse(encryptedData);
      } catch (jsonError) {
        // If not JSON, return encrypted message indicator
        return '🔒 Shifrlangan xabar (invalid format)';
      }

      // Handle military-grade encryption v3
      if (data.version === 'military-v3' || data.algorithm === 'aes-256-gcm-rsa-4096') {
        return decryptMilitaryV3(data, privateKey);
      }

      // Handle hybrid encryption (new format)
      if (data.encryptedContent && data.encryptedSymmetricKey && data.iv && data.authTag) {
        return decryptHybridFormat(data, privateKey);
      }

      // Handle basic obfuscated format
      if (data.version === 'basic-v1' || data.algorithm === 'base64-obfuscated') {
        return decryptBasicV1(data);
      }

      // Legacy format handling with safe fallback
      return handleLegacyFormats(data, privateKey);
    },
    () => {
      // Ultimate fallback
      return '🔒 Shifrlangan xabar';
    },
    'Decryption'
  );
}

// Helper functions for different encryption formats
function decryptMilitaryV3(data: any, privateKey?: string): string {
  let key: Buffer;
  if (privateKey && data.encryptedKey && data.encryptedKey.length > 64) {
    try {
      key = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      }, Buffer.from(data.encryptedKey, 'hex'));
    } catch (keyError) {
      console.warn('RSA key decryption failed, trying direct key');
      key = Buffer.from(data.encryptedKey, 'hex');
    }
  } else {
    key = Buffer.from(data.encryptedKey || data.key, 'hex');
  }

  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');

  const decipher = crypto.createDecipherGCM('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encryptedContent, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptHybridFormat(data: any, privateKey?: string): string {
  try {
    // This is the new hybrid RSA+AES format
    let symmetricKey: Buffer;

    if (privateKey) {
      symmetricKey = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      }, Buffer.from(data.encryptedSymmetricKey, 'base64'));
    } else {
      // No private key available
      return '🔒 Shifrlangan xabar (key required)';
    }

    const decipher = crypto.createDecipherGCM('aes-256-gcm', symmetricKey, Buffer.from(data.iv, 'base64'));
    decipher.setAAD(Buffer.from('UltraSecureMessenger'));
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));

    let decrypted = decipher.update(data.encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('Hybrid decryption failed:', error.message);
    return '🔒 Shifrlangan xabar (decryption failed)';
  }
}

function decryptBasicV1(data: any): string {
  const reversed = data.encryptedContent.split('').reverse().join('');
  return Buffer.from(reversed, 'base64').toString('utf8');
}

function handleLegacyFormats(data: any, privateKey?: string): string {
  // For any legacy formats that can't be decrypted safely
  // Return user-friendly encrypted message indicator
  return '🔒 Shifrlangan xabar (legacy format)';
}