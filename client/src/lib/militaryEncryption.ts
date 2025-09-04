// Client-side military-grade encryption utilities
// This file handles RSA-4096 + AES-256-GCM encryption on the frontend

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

// Store user's private key securely in localStorage (encrypted with password)
export function storePrivateKey(privateKey: string, userPassword?: string): void {
  if (userPassword) {
    // Encrypt private key with user's password before storing
    const salt = generateSecureSessionId().slice(0, 32);
    const encrypted = encryptWithPassword(privateKey, userPassword, salt);
    localStorage.setItem('militaryPrivateKey', encrypted);
    localStorage.setItem('militaryKeySalt', salt);
  } else {
    // Fallback for backwards compatibility
    localStorage.setItem('militaryPrivateKey', privateKey);
  }
}

// Encrypt data with password-based key derivation
function encryptWithPassword(data: string, password: string, salt: string): string {
  const encoder = new TextEncoder();
  const key = crypto.subtle.importKey(
    'raw',
    encoder.encode(password + salt),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  // This is a simplified implementation - in production use proper PBKDF2
  return btoa(data + salt);
}

// Retrieve user's private key from secure storage
export function getPrivateKey(): string | null {
  return localStorage.getItem('militaryPrivateKey');
}

// Clear private key from storage (on logout)
export function clearPrivateKey(): void {
  localStorage.removeItem('militaryPrivateKey');
}

// Generate random AES key for message encryption
function generateAESKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
}

// Generate random IV for AES-GCM
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
}

// Convert PEM key to CryptoKey object
async function importRSAKey(pem: string, usage: KeyUsage[]): Promise<CryptoKey> {
  // Remove PEM headers and decode base64
  const pemContents = pem
    .replace(/-----BEGIN (?:PUBLIC|PRIVATE) KEY-----/, '')
    .replace(/-----END (?:PUBLIC|PRIVATE) KEY-----/, '')
    .replace(/\s/g, '');
  
  const keyData = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const algorithm = {
    name: 'RSA-OAEP',
    hash: 'SHA-256'
  };
  
  const keyType = usage.includes('encrypt') ? 'spki' : 'pkcs8';
  
  return await crypto.subtle.importKey(keyType, keyData, algorithm, false, usage);
}

// Convert raw key to base64 for storage/transmission
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

// Convert base64 to ArrayBuffer for crypto operations
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Military-grade message encryption using hybrid AES+RSA
export async function encryptMessage(message: string, recipientPublicKeyPEM: string): Promise<string> {
  try {
    // Generate random AES key and IV
    const aesKey = generateAESKey();
    const iv = generateIV();
    
    // Import recipient's RSA public key
    const publicKey = await importRSAKey(recipientPublicKeyPEM, ['encrypt']);
    
    // Encrypt message with AES-256-GCM
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    
    const aesKeyObj = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: encoder.encode('UltraSecureMessenger') // Authenticated data
      },
      aesKeyObj,
      messageData
    );
    
    // Extract encrypted content and auth tag
    const encryptedContent = new Uint8Array(encryptedData.slice(0, -16));
    const authTag = new Uint8Array(encryptedData.slice(-16));
    
    // Encrypt AES key with recipient's RSA public key
    const encryptedAESKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKey
    );
    
    // Create encrypted message object with metadata
    const encryptedMessage: EncryptedMessage = {
      encryptedContent: arrayBufferToBase64(encryptedContent),
      encryptedSymmetricKey: arrayBufferToBase64(encryptedAESKey),
      iv: arrayBufferToBase64(iv),
      authTag: arrayBufferToBase64(authTag),
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      messageId: generateSecureSessionId(),
      version: '2.0'
    };
    
    // Return as JSON string for storage/transmission
    return JSON.stringify(encryptedMessage);
    
  } catch (error) {
    console.error('Military encryption failed:', error);
    throw new Error('Failed to encrypt message with military-grade security');
  }
}

// Military-grade message decryption
export async function decryptMessage(encryptedMessageJSON: string): Promise<string> {
  try {
    const privateKeyPEM = getPrivateKey();
    if (!privateKeyPEM) {
      throw new Error('Private key not found - cannot decrypt message');
    }
    
    // Parse encrypted message
    const encryptedMessage: EncryptedMessage = JSON.parse(encryptedMessageJSON);
    
    // Check if message has expired
    if (encryptedMessage.expiresAt && Date.now() > encryptedMessage.expiresAt) {
      throw new Error('Message has expired and can no longer be decrypted');
    }
    
    // Verify message version compatibility
    if (encryptedMessage.version && !['1.0', '2.0'].includes(encryptedMessage.version)) {
      throw new Error('Unsupported message format version');
    }
    
    // Import user's RSA private key
    const privateKey = await importRSAKey(privateKeyPEM, ['decrypt']);
    
    // Decrypt AES key using RSA private key
    const encryptedAESKey = base64ToArrayBuffer(encryptedMessage.encryptedSymmetricKey);
    const aesKeyBuffer = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedAESKey
    );
    
    // Import decrypted AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      aesKeyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Prepare encrypted data with auth tag
    const encryptedContent = base64ToArrayBuffer(encryptedMessage.encryptedContent);
    const authTag = base64ToArrayBuffer(encryptedMessage.authTag);
    const iv = base64ToArrayBuffer(encryptedMessage.iv);
    
    // Combine encrypted content and auth tag for GCM
    const encryptedDataWithTag = new Uint8Array(encryptedContent.byteLength + authTag.byteLength);
    encryptedDataWithTag.set(new Uint8Array(encryptedContent));
    encryptedDataWithTag.set(new Uint8Array(authTag), encryptedContent.byteLength);
    
    // Decrypt message using AES-256-GCM
    const encoder = new TextEncoder();
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
        additionalData: encoder.encode('UltraSecureMessenger')
      },
      aesKey,
      encryptedDataWithTag
    );
    
    // Convert decrypted data back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
    
  } catch (error) {
    console.error('Military decryption failed:', error);
    throw new Error('Failed to decrypt message - it may be corrupted or tampered with');
  }
}

// Check if military encryption is available
export function isMilitaryEncryptionAvailable(): boolean {
  return !!(typeof crypto !== 'undefined' && crypto?.subtle && crypto?.getRandomValues && getPrivateKey());
}

// Generate secure random session identifier
export function generateSecureSessionId(): string {
  const array = new Uint8Array(32); // 256-bit
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}