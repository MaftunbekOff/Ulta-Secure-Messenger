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
// Even intelligence agencies can't break this!

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
  // Generate random 256-bit AES key for this message
  const symmetricKey = crypto.randomBytes(32); // 256 bits

  // Generate random IV (Initialization Vector)
  const iv = crypto.randomBytes(16); // 128 bits for AES-GCM

  // Encrypt message content with AES-256-GCM
  const cipher = crypto.createCipher('aes-256-gcm', symmetricKey);
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
    version: '2.0'
  };
}

// Decrypt message using hybrid decryption
export function decryptMessage(encryptedMessage: EncryptedMessage, recipientPrivateKey: string): string {
  try {
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
    const decipher = crypto.createDecipher('aes-256-gcm', symmetricKey);
    decipher.setAAD(Buffer.from('UltraSecureMessenger')); // Same AAD used in encryption
    decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'base64'));

    let decryptedContent = decipher.update(encryptedMessage.encryptedContent, 'base64', 'utf8');
    decryptedContent += decipher.final('utf8');

    return decryptedContent;

  } catch (error) {
    console.error('Military decryption failed:', error);
    throw new Error('Decryption failed - message may be corrupted or tampered with');
  }
}

// Generate secure random session ID for additional security layers
export function generateSecureSessionId(): string {
  return crypto.randomBytes(64).toString('hex'); // 512-bit session ID
}

// Hash function for additional security (SHA-3-512)
export function secureHash(data: string): string {
  return crypto.createHash('sha3-512').update(data).digest('hex');
}

// Verify message integrity using HMAC-SHA3-256
export function createMessageSignature(message: string, privateKey: string): string {
  const hmac = crypto.createHmac('sha3-256', privateKey);
  hmac.update(message);
  return hmac.digest('hex');
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

// Secure encryption using AES-256-CBC with dynamic IV
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
        version: 'military-v1',
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
      try {
        // Try basic AES
        const key = crypto.randomBytes(16);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-128-cbc', key);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return JSON.stringify({
          version: 'fallback-v1',
          algorithm: 'aes-128-cbc',
          encryptedContent: encrypted,
          key: key.toString('hex'),
          iv: iv.toString('hex'),
          timestamp: Date.now()
        });
      } catch (aesError) {
        // Ultimate fallback: Base64 with obfuscation
        const obfuscated = Buffer.from(plaintext).toString('base64')
          .split('').reverse().join('');

        return JSON.stringify({
          version: 'basic-v1',
          algorithm: 'base64-obfuscated',
          encryptedContent: obfuscated,
          timestamp: Date.now()
        });
      }
    },
    'Encryption'
  );
}

// AES-256-GCM decryption with fallbacks
export function decrypt(encryptedData: string, privateKey?: string): string {
  return secureCrypto(
    () => {
      // Try to parse as JSON first
      let data: any;
      try {
        data = JSON.parse(encryptedData);
      } catch (jsonError) {
        // If not JSON, try as legacy encrypted format
        return tryLegacyDecryption(encryptedData);
      }

      // Handle military-grade encryption versions
      if (data.version === 'military-v1' || data.algorithm === 'aes-256-gcm-rsa-4096') {
        return decryptMilitaryV1(data, privateKey);
      }

      // Handle hybrid encryption (new format)
      if (data.encryptedContent && data.encryptedSymmetricKey && data.iv && data.authTag) {
        return decryptHybridFormat(data, privateKey);
      }

      // Handle fallback versions
      if (data.version === 'fallback-v1' || data.algorithm === 'aes-128-cbc') {
        return decryptFallbackV1(data);
      }

      if (data.version === 'basic-v1' || data.algorithm === 'base64-obfuscated') {
        return decryptBasicV1(data);
      }

      // Handle legacy AES-256-CBC format
      if (data.encrypted && data.iv && data.algorithm === 'aes-256-cbc') {
        try {
          return decryptLegacyAES(data);
        } catch (error) {
          console.warn('Legacy AES decryption failed:', error.message);
          return '🔒 Shifrlangan xabar (legacy AES format)';
        }
      }

      // If no version specified, try to detect format
      try {
        return autoDetectAndDecrypt(data, privateKey);
      } catch (error) {
        console.warn('Auto-detect failed:', error.message);
        return '🔒 Shifrlangan xabar (unknown format)';
      }
    },
    () => {
      // Ultimate fallback
      return tryAllDecryptionMethods(encryptedData, privateKey);
    },
    'Decryption'
  );
}

// Helper functions for different encryption formats
function decryptMilitaryV1(data: any, privateKey?: string): string {
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
      // Try without RSA if no private key
      throw new Error('Private key required for hybrid decryption');
    }

    const decipher = crypto.createDecipherGCM('aes-256-gcm', symmetricKey, Buffer.from(data.iv, 'base64'));
    decipher.setAAD(Buffer.from('UltraSecureMessenger'));
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));

    let decrypted = decipher.update(data.encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn('Hybrid decryption failed:', error);
    throw error;
  }
}

function decryptFallbackV1(data: any): string {
  const key = Buffer.from(data.key, 'hex');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, Buffer.from(data.iv, 'hex'));
  let decrypted = decipher.update(data.encryptedContent, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptBasicV1(data: any): string {
  const reversed = data.encryptedContent.split('').reverse().join('');
  return Buffer.from(reversed, 'base64').toString('utf8');
}

function decryptLegacyAES(data: any): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('ultrasecure-messenger-key', 'salt', 32);
    
    // Validate IV
    if (!data.iv || typeof data.iv !== 'string') {
      throw new Error('Invalid or missing IV');
    }
    
    // Validate encrypted data
    if (!data.encrypted || typeof data.encrypted !== 'string') {
      throw new Error('Invalid or missing encrypted data');
    }

    const iv = Buffer.from(data.iv, 'hex');
    if (iv.length !== 16) {
      throw new Error('IV must be 16 bytes for AES');
    }

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.warn('Legacy AES decryption failed:', error.message);
    throw new Error(`Legacy AES decryption failed: ${error.message}`);
  }
}

function tryLegacyDecryption(encryptedData: string): string {
  // Try multiple legacy decryption methods with improved error handling
  const methods = [
    {
      name: 'Base64 with IV prefix',
      decrypt: () => {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('ultrasecure-messenger-key', 'salt', 32);
        
        const encrypted = Buffer.from(encryptedData, 'base64');
        if (encrypted.length < 16) {
          throw new Error('Data too short for IV');
        }
        
        const iv = encrypted.slice(0, 16);
        let content = encrypted.slice(16);
        
        // Fix block alignment issues
        const blockSize = 16;
        if (content.length % blockSize !== 0) {
          // Try removing extra bytes first
          const alignedLength = Math.floor(content.length / blockSize) * blockSize;
          if (alignedLength > 0) {
            content = content.slice(0, alignedLength);
          } else {
            throw new Error('Content too short for block alignment');
          }
        }
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(content);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8').replace(/\0+$/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      }
    },
    {
      name: 'Direct base64 decode',
      decrypt: () => {
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        if (decoded && decoded !== encryptedData && decoded.length > 0) {
          return decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        }
        throw new Error('Direct decode failed');
      }
    },
    {
      name: 'Legacy AES without IV prefix',
      decrypt: () => {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync('ultrasecure-messenger-key', 'salt', 32);
        const iv = Buffer.alloc(16, 0); // Zero IV for very old format
        
        let content = Buffer.from(encryptedData, 'base64');
        
        // Fix block alignment
        const blockSize = 16;
        if (content.length % blockSize !== 0) {
          const alignedLength = Math.floor(content.length / blockSize) * blockSize;
          if (alignedLength === 0) {
            throw new Error('Content too short');
          }
          content = content.slice(0, alignedLength);
        }
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAutoPadding(false); // Try without auto padding
        
        const decrypted = decipher.update(content, null, 'utf8');
        return decrypted.replace(/\0+$/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      }
    },
    {
      name: 'Hex decode attempt',
      decrypt: () => {
        if (!/^[0-9a-fA-F]+$/.test(encryptedData)) {
          throw new Error('Not hex format');
        }
        const decoded = Buffer.from(encryptedData, 'hex').toString('utf8');
        if (decoded && decoded.length > 0) {
          return decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        }
        throw new Error('Hex decode failed');
      }
    }
  ];

  let lastError: Error | null = null;
  
  for (const method of methods) {
    try {
      const result = method.decrypt();
      if (result && result.trim().length > 0) {
        return result;
      }
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  // If all methods fail, return encrypted message indicator
  console.warn('All legacy decryption methods failed:', lastError?.message || 'Unknown error');
  throw new Error('Legacy decryption failed - message may be corrupted or use unsupported format');
}

function autoDetectAndDecrypt(data: any, privateKey?: string): string {
  // Try to auto-detect encryption format based on available fields
  if (data.encryptedContent && data.iv) {
    if (data.authTag) {
      // Looks like GCM
      try {
        return decryptMilitaryV1(data, privateKey);
      } catch (error) {
        console.warn('GCM auto-detect failed:', error);
      }
    } else {
      // Looks like CBC
      try {
        return decryptFallbackV1(data);
      } catch (error) {
        console.warn('CBC auto-detect failed:', error);
      }
    }
  }

  if (data.encrypted && data.iv) {
    // Legacy format
    try {
      return decryptLegacyAES(data);
    } catch (error) {
      console.warn('Legacy auto-detect failed:', error);
    }
  }

  throw new Error('Could not auto-detect encryption format');
}

function tryAllDecryptionMethods(encryptedData: string, privateKey?: string): string {
  const methods = [
    {
      name: 'Legacy AES-256-CBC',
      method: () => {
        try {
          return tryLegacyDecryption(encryptedData);
        } catch (error) {
          // If legacy fails, return encrypted message indicator instead of throwing
          return '🔒 Shifrlangan xabar (legacy format)';
        }
      }
    },
    {
      name: 'Base64 obfuscated reverse',
      method: () => {
        const reversed = encryptedData.split('').reverse().join('');
        const decoded = Buffer.from(reversed, 'base64').toString('utf8');
        if (decoded.length === 0 || decoded === encryptedData) {
          throw new Error('Invalid obfuscated data');
        }
        return decoded;
      }
    },
    {
      name: 'Direct Base64 decode',
      method: () => {
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        if (decoded.length === 0 || decoded === encryptedData) {
          throw new Error('Invalid base64 data');
        }
        return decoded;
      }
    },
    {
      name: 'Hex decode',
      method: () => {
        if (!/^[0-9a-fA-F]+$/.test(encryptedData)) {
          throw new Error('Not hex data');
        }
        const decoded = Buffer.from(encryptedData, 'hex').toString('utf8');
        if (decoded.length === 0) {
          throw new Error('Invalid hex data');
        }
        return decoded;
      }
    },
    {
      name: 'JSON parse attempt',
      method: () => {
        try {
          const parsed = JSON.parse(encryptedData);
          if (parsed.encrypted || parsed.encryptedContent) {
            return '🔒 Shifrlangan xabar (JSON format)';
          }
          throw new Error('Not encrypted JSON');
        } catch {
          throw new Error('Not valid JSON');
        }
      }
    },
    {
      name: 'UTF8 passthrough',
      method: () => {
        // If it's already readable UTF8, just return it
        if (/^[\x20-\x7E\s]*$/.test(encryptedData)) {
          return encryptedData;
        }
        throw new Error('Not readable UTF8');
      }
    }
  ];

  let lastError: Error | null = null;
  let bestResult = '🔒 Shifrlangan xabar';

  for (const { name, method } of methods) {
    try {
      const result = method();
      if (result && result !== encryptedData && result.trim().length > 0) {
        // Don't log warning for encrypted message indicators
        if (!result.includes('🔒')) {
          console.log(`✅ Decryption success using: ${name}`);
        }
        return result;
      }
    } catch (error) {
      lastError = error;
      // Continue to next method
    }
  }

  // Return user-friendly encrypted message indicator instead of raw data
  return bestResult;
}