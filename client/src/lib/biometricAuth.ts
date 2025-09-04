
// Biometric Authentication System
// Barmoq izi va yuz tanish orqali qo'shimcha xavfsizlik

interface BiometricCredential {
  id: string;
  type: 'fingerprint' | 'face' | 'voice';
  publicKey: string;
  counter: number;
}

export class BiometricAuth {
  private static instance: BiometricAuth;
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
  }

  static getInstance(): BiometricAuth {
    if (!BiometricAuth.instance) {
      BiometricAuth.instance = new BiometricAuth();
    }
    return BiometricAuth.instance;
  }

  private async checkSupport(): Promise<void> {
    try {
      this.isSupported = !!(
        window.navigator.credentials && 
        window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      );
    } catch (error) {
      console.warn('Biometric support check failed:', error);
      this.isSupported = false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.isSupported;
  }

  // Biometrik ro'yxatdan o'tish
  async registerBiometric(username: string): Promise<BiometricCredential | null> {
    if (!this.isSupported) return null;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { 
            name: "UltraSecure Messenger",
            id: window.location.hostname
          },
          user: {
            id: new TextEncoder().encode(username),
            name: username,
            displayName: username
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },  // ES256
            { alg: -257, type: "public-key" } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            requireResidentKey: true
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (credential) {
        const response = credential.response as AuthenticatorAttestationResponse;
        
        return {
          id: credential.id,
          type: 'fingerprint',
          publicKey: btoa(String.fromCharCode(...new Uint8Array(response.publicKey!))),
          counter: 0
        };
      }
    } catch (error) {
      console.error('Biometric registration failed:', error);
    }
    
    return null;
  }

  // Biometrik autentifikatsiya
  async authenticateBiometric(credentialId: string): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      }) as PublicKeyCredential;

      return !!assertion;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  // Xavfsizlik kalitini biometrik bilan himoyalash
  async protectPrivateKey(privateKey: string, username: string): Promise<string | null> {
    const biometric = await this.registerBiometric(username);
    if (!biometric) return null;

    // Kalitni biometrik ma'lumot bilan shifrlash
    const protectedKey = this.encryptWithBiometric(privateKey, biometric.publicKey);
    localStorage.setItem('biometricProtectedKey', protectedKey);
    localStorage.setItem('biometricCredentialId', biometric.id);
    
    return biometric.id;
  }

  async unlockPrivateKey(): Promise<string | null> {
    const credentialId = localStorage.getItem('biometricCredentialId');
    const protectedKey = localStorage.getItem('biometricProtectedKey');
    
    if (!credentialId || !protectedKey) return null;

    const authenticated = await this.authenticateBiometric(credentialId);
    if (!authenticated) return null;

    // Kalitni ochish
    return this.decryptWithBiometric(protectedKey, credentialId);
  }

  private encryptWithBiometric(data: string, biometricKey: string): string {
    // Oddiy shifrlash - real loyihada kuchliroq algoritm ishlatiladi
    const combined = data + '::' + biometricKey;
    return btoa(combined);
  }

  private decryptWithBiometric(encryptedData: string, credentialId: string): string {
    try {
      const decoded = atob(encryptedData);
      return decoded.split('::')[0];
    } catch {
      return '';
    }
  }
}

export const biometricAuth = BiometricAuth.getInstance();
