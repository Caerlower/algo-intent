import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWallet, WalletProvider } from '@txnlab/use-wallet-react';
import { GoogleAuthService, GoogleUser } from '../services/googleAuthService';

interface SocialWalletContextType {
  isGoogleConnected: boolean;
  googleUser: GoogleUser | null;
  googleWallet: { address: string; vaultKeyName: string; publicKey: string } | null;
  connectGoogleWallet: () => Promise<void>;
  disconnectGoogleWallet: () => Promise<void>;
  refreshGoogleWalletState: () => void;
}

const SocialWalletContext = createContext<SocialWalletContextType | null>(null);

export const useSocialWallet = () => {
  const context = useContext(SocialWalletContext);
  if (!context) {
    throw new Error('useSocialWallet must be used within a SocialWalletProvider');
  }
  return context;
};

interface SocialWalletProviderProps {
  children: React.ReactNode;
}

export const SocialWalletProvider: React.FC<SocialWalletProviderProps> = ({ children }) => {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [googleWallet, setGoogleWallet] = useState<{ address: string; vaultKeyName: string; publicKey: string } | null>(null);
  const [googleAuthService] = useState(() => GoogleAuthService.getInstance());

  // Check for existing Google session on mount and periodically
  useEffect(() => {
    const checkGoogleWallet = () => {
      const currentUser = googleAuthService.getCurrentUser();
      const currentWallet = googleAuthService.getCurrentWallet();
      
      if (currentUser && currentWallet) {
        setGoogleUser(currentUser);
        setGoogleWallet(currentWallet);
        setIsGoogleConnected(true);
      } else {
        setGoogleUser(null);
        setGoogleWallet(null);
        setIsGoogleConnected(false);
      }
    };

    // Check immediately
    checkGoogleWallet();

    // Check periodically to stay in sync
    const interval = setInterval(checkGoogleWallet, 2000);

    return () => clearInterval(interval);
  }, [googleAuthService]);

  const connectGoogleWallet = async () => {
    try {
      const result = await googleAuthService.signInWithGoogle();
      
      if (result.success && result.user && result.wallet) {
        setGoogleUser(result.user);
        setGoogleWallet(result.wallet);
        setIsGoogleConnected(true);
      } else {
        throw new Error(result.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error('Google wallet connection failed:', error);
      throw error;
    }
  };

  const disconnectGoogleWallet = async () => {
    try {
      await googleAuthService.signOut();
      setGoogleUser(null);
      setGoogleWallet(null);
      setIsGoogleConnected(false);
    } catch (error) {
      console.error('Google wallet disconnection failed:', error);
    }
  };

  const refreshGoogleWalletState = () => {
    const currentUser = googleAuthService.getCurrentUser();
    const currentWallet = googleAuthService.getCurrentWallet();
    
    if (currentUser && currentWallet) {
      setGoogleUser(currentUser);
      setGoogleWallet(currentWallet);
      setIsGoogleConnected(true);
    } else {
      setGoogleUser(null);
      setGoogleWallet(null);
      setIsGoogleConnected(false);
    }
  };

  const contextValue: SocialWalletContextType = {
    isGoogleConnected,
    googleUser,
    googleWallet,
    connectGoogleWallet,
    disconnectGoogleWallet,
    refreshGoogleWalletState,
  };

  return (
    <SocialWalletContext.Provider value={contextValue}>
      {children}
    </SocialWalletContext.Provider>
  );
};

// Enhanced hook that combines traditional wallet and Google wallet
export const useEnhancedWallet = () => {
  const traditionalWallet = useWallet();
  const socialWallet = useSocialWallet();

  // Determine the active address (Google wallet takes precedence)
  const activeAddress = socialWallet.googleWallet?.address || traditionalWallet.activeAddress;
  
  // Determine if any wallet is connected
  const isConnected = socialWallet.isGoogleConnected || !!traditionalWallet.activeAddress;

  // Enhanced transaction signer that handles Google wallet
  const enhancedSignTransactions = async (transactions: any[]) => {
    if (socialWallet.isGoogleConnected && socialWallet.googleWallet) {
      // Use Google wallet for signing
      const signedTransactions: Uint8Array[] = [];
      const googleAuthService = GoogleAuthService.getInstance();
      
      for (const transaction of transactions) {
        try {
          const result = await googleAuthService.signTransaction(transaction);
          if (result.signature) {
            // Parse the signature and attach it to the transaction
            const signatureBytes = new Uint8Array(Buffer.from(result.signature.split(':')[2], 'base64'));
            const signedTransaction = new Uint8Array(transaction.length + signatureBytes.length);
            signedTransaction.set(transaction);
            signedTransaction.set(signatureBytes, transaction.length);
            signedTransactions.push(signedTransaction);
          } else {
            throw new Error('Transaction signing failed: No signature returned');
          }
        } catch (error) {
          throw new Error(`Google wallet signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return signedTransactions;
    } else {
      // Use traditional wallet for signing
      return traditionalWallet.signTransactions(transactions);
    }
  };

  return {
    ...traditionalWallet,
    activeAddress,
    isConnected,
    signTransactions: enhancedSignTransactions,
    // Social wallet specific
    isGoogleConnected: socialWallet.isGoogleConnected,
    googleUser: socialWallet.googleUser,
    googleWallet: socialWallet.googleWallet,
    connectGoogleWallet: socialWallet.connectGoogleWallet,
    disconnectGoogleWallet: socialWallet.disconnectGoogleWallet,
    refreshGoogleWalletState: socialWallet.refreshGoogleWalletState,
  };
};
