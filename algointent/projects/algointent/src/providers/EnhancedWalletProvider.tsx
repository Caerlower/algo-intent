import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { GoogleAuthService, GoogleUser } from '../services/googleAuthService';
import algosdk, { TransactionSigner } from 'algosdk';

interface SocialWalletContextType {
  isGoogleConnected: boolean;
  googleUser: GoogleUser | null;
  googleWallet: { address: string; vaultKeyName: string; publicKey: string } | null;
  connectGoogleWallet: () => Promise<void>;
  disconnectGoogleWallet: () => Promise<void>;
  refreshGoogleWalletState: () => void;
  pendingApproval: algosdk.Transaction[] | null;
  approvePendingApproval: () => void;
  rejectPendingApproval: () => void;
  requestApproval: (transactions: algosdk.Transaction[]) => Promise<boolean>;
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
  const [approvalTransactions, setApprovalTransactions] = useState<algosdk.Transaction[] | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);

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

  const handleApprovalDecision = useCallback((approved: boolean) => {
    approvalResolverRef.current?.(approved);
    approvalResolverRef.current = null;
    setApprovalTransactions(null);
  }, []);

  const requestApproval = useCallback((transactions: algosdk.Transaction[]): Promise<boolean> => {
    if (approvalResolverRef.current) {
      approvalResolverRef.current(false);
    }

    return new Promise<boolean>((resolve) => {
      approvalResolverRef.current = resolve;
      setApprovalTransactions(transactions);
    });
  }, []);

  const contextValue: SocialWalletContextType = {
    isGoogleConnected,
    googleUser,
    googleWallet,
    connectGoogleWallet,
    disconnectGoogleWallet,
    refreshGoogleWalletState,
    pendingApproval: approvalTransactions,
    approvePendingApproval: () => handleApprovalDecision(true),
    rejectPendingApproval: () => handleApprovalDecision(false),
    requestApproval,
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

  const extractSignatureBytes = (signature: string): Uint8Array => {
    const parts = signature.split(':');
    const base64Signature = parts[parts.length - 1];
    return new Uint8Array(Buffer.from(base64Signature, 'base64'));
  };

  const normalizeTransactionBytes = (txn: Uint8Array | algosdk.Transaction | any): Uint8Array => {
    if (txn instanceof Uint8Array) {
      return txn;
    }

    if (txn && typeof txn === 'object') {
      if (typeof txn.toByte === 'function') {
        return txn.toByte();
      }

      if (txn.byteLength !== undefined && typeof txn.byteLength === 'number' && typeof txn.slice === 'function') {
        return new Uint8Array(txn);
      }

      if (txn.bytes && txn.bytes instanceof Uint8Array) {
        return txn.bytes;
      }
    }

    throw new Error('Unsupported transaction format received for signing');
  };

  const googleTransactionSigner = useMemo<TransactionSigner | undefined>(() => {
    if (!socialWallet.isGoogleConnected || !socialWallet.googleWallet) {
      return undefined;
    }

    const googleAuthService = GoogleAuthService.getInstance();

    const signer: TransactionSigner = async (txnGroup, indexesToSign) => {
      const indexes = indexesToSign ?? txnGroup.map((_, index) => index);
      const decodedTransactions = indexes.map((index) => {
        const txnBytes = normalizeTransactionBytes(txnGroup[index]);
        return algosdk.decodeUnsignedTransaction(txnBytes);
      });

      const approved = await socialWallet.requestApproval(decodedTransactions);
      if (!approved) {
        throw new Error('User rejected the signing request');
      }

      const signedTransactions: Uint8Array[] = [];

      for (const index of indexes) {
        const txnBytes = normalizeTransactionBytes(txnGroup[index]);
        const decodedTxn = algosdk.decodeUnsignedTransaction(txnBytes);
        const messageToSign = decodedTxn.bytesToSign();

        const { signature } = await googleAuthService.signTransaction(messageToSign);
        if (!signature) {
          throw new Error('Transaction signing failed: No signature returned from Hashi signer');
        }

        const signatureBytes = extractSignatureBytes(signature);
        const signerAddress =
          socialWallet.googleWallet?.address || decodedTxn.sender.toString();
        const signedTxn = decodedTxn.attachSignature(signerAddress, signatureBytes);
        signedTransactions.push(new Uint8Array(signedTxn));
      }

      return signedTransactions;
    };

    return signer;
  }, [socialWallet.isGoogleConnected, socialWallet.googleWallet, socialWallet.requestApproval]);

  const enhancedSignTransactions = async (transactions: Uint8Array[]) => {
    if (googleTransactionSigner) {
      const indexes = transactions.map((_, index) => index);
      return googleTransactionSigner(transactions as unknown as algosdk.Transaction[], indexes);
    }

    return traditionalWallet.signTransactions(transactions);
  };

  return {
    ...traditionalWallet,
    activeAddress,
    isConnected,
    signTransactions: enhancedSignTransactions,
    transactionSigner: googleTransactionSigner ?? traditionalWallet.transactionSigner,
    // Social wallet specific
    isGoogleConnected: socialWallet.isGoogleConnected,
    googleUser: socialWallet.googleUser,
    googleWallet: socialWallet.googleWallet,
    connectGoogleWallet: socialWallet.connectGoogleWallet,
    disconnectGoogleWallet: socialWallet.disconnectGoogleWallet,
    refreshGoogleWalletState: socialWallet.refreshGoogleWalletState,
    pendingApproval: socialWallet.pendingApproval,
    approvePendingApproval: socialWallet.approvePendingApproval,
    rejectPendingApproval: socialWallet.rejectPendingApproval,
  };
};
