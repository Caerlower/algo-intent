import React, { useState, useEffect, useMemo } from 'react';
import { useEnhancedWallet } from '../providers/EnhancedWalletProvider';
import { useNetwork } from '../providers/NetworkProvider';
import { getAlgodConfigForNetwork } from '../utils/network/getAlgoClientConfigs';
import { ellipseAddress } from '../utils/ellipseAddress';
import ConnectWallet from './ConnectWallet';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Wallet, LogOut, User, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { TransactionService } from '../services/transactionService';
import { toast } from 'sonner';

const WalletConnectButton: React.FC = () => {
  const { wallets, activeAddress, isGoogleConnected, googleUser, googleWallet, disconnectGoogleWallet } = useEnhancedWallet();
  const { network } = useNetwork();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [balance, setBalance] = useState<{ algo: number; assets: any[] } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showBalanceType, setShowBalanceType] = useState<'available' | 'total'>('available');
  const [isBalanceDropdownOpen, setIsBalanceDropdownOpen] = useState(false);

  // Get algod config based on selected network
  const algodConfig = useMemo(() => {
    return getAlgodConfigForNetwork(network);
  }, [network]);

  // Create transaction service with network-aware config
  const transactionService = useMemo(() => {
    return new TransactionService(algodConfig);
  }, [algodConfig]);

  useEffect(() => {
    if (activeAddress) {
      fetchBalance();
    } else {
      setBalance(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress, network]);

  const fetchBalance = async () => {
    if (!activeAddress) return;
    
    setIsLoadingBalance(true);
    try {
      const balanceData = await transactionService.getAccountBalance(activeAddress);
      setBalance(balanceData);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleDisconnect = async () => {
    if (isGoogleConnected) {
      await disconnectGoogleWallet();
    } else if (wallets) {
      const activeWallet = wallets.find((w) => w.isActive);
      if (activeWallet) {
        await activeWallet.disconnect();
      } else {
        localStorage.removeItem('@txnlab/use-wallet:v3');
        window.location.reload();
      }
    }
    setBalance(null);
  };

  const handleCopyAddress = async () => {
    if (activeAddress) {
      try {
        await navigator.clipboard.writeText(activeAddress);
        toast.success('Address copied to clipboard');
      } catch (error) {
        console.error('Failed to copy address:', error);
        toast.error('Failed to copy address');
      }
    }
  };

  // Calculate available balance (total - minimum balance requirement)
  const minimumBalance = 0.1; // Minimum balance requirement in ALGO
  const availableBalance = balance ? Math.max(0, balance.algo - minimumBalance) : 0;
  const displayBalance = showBalanceType === 'available' ? availableBalance : (balance?.algo || 0);

  return (
    <>
      {activeAddress ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="flex items-center gap-2">
              {isGoogleConnected ? (
                <User className="h-4 w-4" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {ellipseAddress(activeAddress)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            {/* Wallet Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {isGoogleConnected ? (
                    <User className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">
                    {ellipseAddress(activeAddress)}
                  </p>
                  {isGoogleConnected && googleUser && (
                    <p className="text-sm text-muted-foreground truncate">
                      {googleUser.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Balance Section */}
            <div className="p-4 border-b border-border">
              <div className="bg-muted/50 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-foreground">
                    {isLoadingBalance ? 'Loading...' : `${displayBalance.toFixed(4)} ALGO`}
                  </span>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBalanceDropdownOpen(!isBalanceDropdownOpen);
                      }}
                    >
                      {showBalanceType === 'available' ? 'Available' : 'Total'}
                      {isBalanceDropdownOpen ? (
                        <ChevronUp className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                    {isBalanceDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-[1]" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsBalanceDropdownOpen(false);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-[2] min-w-[120px]">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBalanceType('available');
                              setIsBalanceDropdownOpen(false);
                            }}
                          >
                            Available
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-t border-border"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBalanceType('total');
                              setIsBalanceDropdownOpen(false);
                            }}
                          >
                            Total
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected App Section (if applicable) */}
            {isGoogleConnected && (
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Social Login</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyAddress();
                }}
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </Button>
              <Button
                variant="destructive"
                className="flex-1 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisconnect();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Disconnect</span>
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={() => setIsConnectModalOpen(true)}>
          Connect Wallet
        </Button>
      )}
      <ConnectWallet openModal={isConnectModalOpen} closeModal={() => setIsConnectModalOpen(false)} />
    </>
  );
};

export default WalletConnectButton;