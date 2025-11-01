export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: GoogleUser;
  wallet?: {
    address: string;
    vaultKeyName: string;
    publicKey: string;
  };
  jwtToken?: string;
  error?: string;
}

export class GoogleAuthService {
  private readonly hashiApiUrl: string;
  private static instance: GoogleAuthService;
  private static isInitializing: boolean = false;
  private static initializationPromise: Promise<void> | null = null;

  constructor() {
    this.hashiApiUrl = import.meta.env.VITE_HASHI_API_URL || 'http://localhost:8081';
    
    // Validate required environment variables
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      console.error('VITE_GOOGLE_CLIENT_ID is not defined in environment variables');
    }
  }

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Initialize Google Identity Services
   */
  async initializeGoogleAuth(): Promise<void> {
    // Return existing promise if already initializing
    if (GoogleAuthService.isInitializing && GoogleAuthService.initializationPromise) {
      return GoogleAuthService.initializationPromise;
    }

    // Return immediately if already initialized
    if (window.google && window.google.accounts && window.google.accounts.id) {
      console.log('Google Identity Services already loaded');
      return Promise.resolve();
    }

    // Set initialization flag and create promise
    GoogleAuthService.isInitializing = true;
    GoogleAuthService.initializationPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google Auth can only be initialized in browser'));
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        // Wait for the existing script to load
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.accounts && window.google.accounts.id) {
            clearInterval(checkLoaded);
            GoogleAuthService.isInitializing = false;
            console.log('Google Identity Services loaded from existing script');
            resolve();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkLoaded);
          GoogleAuthService.isInitializing = false;
          reject(new Error('Timeout waiting for Google Identity Services to load'));
        }, 10000);
        return;
      }

      // Load the script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          GoogleAuthService.isInitializing = false;
          console.log('Google Identity Services loaded successfully');
          resolve();
        } else {
          GoogleAuthService.isInitializing = false;
          reject(new Error('Google Identity Services not loaded'));
        }
      };

      script.onerror = () => {
        GoogleAuthService.isInitializing = false;
        reject(new Error('Failed to load Google Identity Services'));
      };

      document.head.appendChild(script);
    });

    return GoogleAuthService.initializationPromise;
  }

  /**
   * Handle Google credential response
   */
  async handleCredentialResponse(response: any): Promise<AuthResponse> {
    try {
      // Send the credential to our backend
      const authResponse = await fetch(`${this.hashiApiUrl}/v1/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: response.credential,
        }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const result = await authResponse.json();
      
      if (result.success) {
        // Store JWT token in localStorage
        localStorage.setItem('hashi_jwt_token', result.jwtToken);
        localStorage.setItem('hashi_user', JSON.stringify(result.user));
        localStorage.setItem('hashi_wallet', JSON.stringify(result.wallet));
        
        return result;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      await this.initializeGoogleAuth();
      
      return new Promise((resolve) => {
        // Set up the callback to handle the response
        window.google.accounts.id.callback = async (response: any) => {
          const result = await this.handleCredentialResponse(response);
          resolve(result);
        };

        // Initialize with the client ID
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
          resolve({
            success: false,
            error: 'VITE_GOOGLE_CLIENT_ID is not defined',
          });
          return;
        }

        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: window.google.accounts.id.callback,
          });
          
          // Create a temporary button and trigger it
          const tempDiv = document.createElement('div');
          tempDiv.style.display = 'none';
          document.body.appendChild(tempDiv);
          
          // Render the Google Sign-In button
          if (window.google?.accounts?.id && typeof window.google.accounts.id.renderButton === 'function') {
            window.google.accounts.id.renderButton(tempDiv, {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              width: '250',
            });
          } else {
            throw new Error('Google Sign-In button renderer not available');
          }
          
          // Find and click the button
          const button = tempDiv.querySelector('div[role="button"]') as HTMLElement;
          if (button) {
            button.click();
          } else {
            throw new Error('Could not render Google sign-in button');
          }
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(tempDiv);
          }, 1000);
          
        } catch (promptError: unknown) {
          console.error('Google button error:', promptError);
          resolve({
            success: false,
            error: 'Failed to open Google sign-in: ' + (promptError instanceof Error ? promptError.message : 'Unknown error'),
          });
        }
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign-in failed',
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      // Clear local storage
      localStorage.removeItem('hashi_jwt_token');
      localStorage.removeItem('hashi_user');
      localStorage.removeItem('hashi_wallet');
      
      // Sign out from Google
      if (window.google) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): GoogleUser | null {
    try {
      const userStr = localStorage.getItem('hashi_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get current wallet from localStorage
   */
  getCurrentWallet(): { address: string; vaultKeyName: string; publicKey: string } | null {
    try {
      const walletStr = localStorage.getItem('hashi_wallet');
      return walletStr ? JSON.parse(walletStr) : null;
    } catch (error) {
      console.error('Error getting current wallet:', error);
      return null;
    }
  }

  /**
   * Get JWT token from localStorage
   */
  getJwtToken(): string | null {
    return localStorage.getItem('hashi_jwt_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.getJwtToken() && this.getCurrentUser());
  }

  /**
   * Sign transaction using Hashi backend
   */
  async signTransaction(transactionData: Uint8Array): Promise<{ signature: string }> {
    try {
      const token = this.getJwtToken();
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.hashiApiUrl}/v1/social-transactions/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionData: Buffer.from(transactionData).toString('base64'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transaction signing failed');
      }

      const result = await response.json();
      return { signature: result.signature };
    } catch (error) {
      console.error('Transaction signing error:', error);
      throw error;
    }
  }

  /**
   * Submit signed transaction to Algorand network
   */
  async submitTransaction(signedTransaction: Uint8Array): Promise<{ txId: string }> {
    try {
      const token = this.getJwtToken();
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.hashiApiUrl}/v1/social-transactions/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTransaction).toString('base64'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transaction submission failed');
      }

      const result = await response.json();
      return { txId: result.txId };
    } catch (error) {
      console.error('Transaction submission error:', error);
      throw error;
    }
  }
}

// Global type declarations for Google Identity Services
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          callback: (response: any) => void;
          disableAutoSelect: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}
