import React, { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { ellipseAddress } from '../utils/ellipseAddress';
import ConnectWallet from './ConnectWallet';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Wallet, LogOut } from 'lucide-react';

const WalletConnectButton: React.FC = () => {
  const { wallets, activeAddress } = useWallet();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const handleDisconnect = async () => {
    if (wallets) {
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
              <Wallet className="h-4 w-4" />
              {ellipseAddress(activeAddress)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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