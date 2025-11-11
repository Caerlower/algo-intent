import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type NetworkType = 'testnet' | 'mainnet';

interface NetworkContextType {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
  isMainnet: boolean;
  isTestnet: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_STORAGE_KEY = 'algointent_network';

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Default to testnet for safety
  const [network, setNetworkState] = useState<NetworkType>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === 'testnet' || stored === 'mainnet') {
      return stored as NetworkType;
    }
    // Check environment variable as fallback
    const envNetwork = import.meta.env.VITE_ALGOD_NETWORK?.toLowerCase();
    if (envNetwork === 'testnet' || envNetwork === 'mainnet') {
      return envNetwork as NetworkType;
    }
    // Default to testnet
    return 'testnet';
  });

  // Persist to localStorage whenever network changes
  useEffect(() => {
    localStorage.setItem(NETWORK_STORAGE_KEY, network);
  }, [network]);

  const setNetwork = (newNetwork: NetworkType) => {
    setNetworkState(newNetwork);
  };

  const value: NetworkContextType = {
    network,
    setNetwork,
    isMainnet: network === 'mainnet',
    isTestnet: network === 'testnet',
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

