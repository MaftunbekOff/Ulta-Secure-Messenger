// This file is deprecated - use militaryEncryption.ts instead
// Simple XOR encryption with salt is still not secure

export function encrypt(text: string): string {
  throw new Error('Simple encryption is deprecated. Use militaryEncryption.ts instead.');
}

export function decrypt(encryptedText: string): string {
  throw new Error('Simple encryption is deprecated. Use militaryEncryption.ts instead.');
}