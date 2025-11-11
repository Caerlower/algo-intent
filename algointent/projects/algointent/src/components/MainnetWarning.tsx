import { useNetwork } from '@/providers/NetworkProvider';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

export function MainnetWarning() {
  const { isMainnet, setNetwork } = useNetwork();
  const location = useLocation();
  const isAppRoute = location.pathname === "/app";

  if (!isMainnet) {
    return null;
  }

  // Warning banner appears in the content area and scrolls with the page
  // On landing pages, add top margin to account for fixed navbar (64px = 16 in Tailwind)
  return (
    <div className={`w-full bg-background/95 border-b border-orange-500/20 backdrop-blur-sm ${!isAppRoute ? 'mt-16' : ''}`}>
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-1">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
            <p className="text-sm text-orange-500/90 leading-relaxed">
              You are running on <span className="font-medium">Algorand Mainnet</span>. This means all transactions will use real ALGO and assets. Please proceed with caution.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNetwork('testnet')}
            className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 font-medium shrink-0 text-xs px-3 h-7"
          >
            Switch to Testnet
          </Button>
        </div>
      </div>
    </div>
  );
}

