import React, { useState } from 'react';
import { useEnhancedWallet } from '../providers/EnhancedWalletProvider';
import { ellipseAddress } from '../utils/ellipseAddress';
import ConnectWallet from './ConnectWallet';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Wallet, LogOut, User } from 'lucide-react';

const WalletConnectButton: React.FC = () => {
  const { wallets, activeAddress, isGoogleConnected, googleUser, googleWallet, disconnectGoogleWallet } = useEnhancedWallet();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

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
  };

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
          <DropdownMenuContent align="end">
            {isGoogleConnected && googleUser && (
              <DropdownMenuItem className="cursor-default">
                <span>{googleUser.name} ({googleUser.email})</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Disconnect</span>
            </DropdownMenuItem>
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