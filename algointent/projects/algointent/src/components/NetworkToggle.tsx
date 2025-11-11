import { useNetwork } from '@/providers/NetworkProvider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function NetworkToggle() {
  const { network, setNetwork, isMainnet } = useNetwork();

  const toggleNetwork = () => {
    const newNetwork = network === 'testnet' ? 'mainnet' : 'testnet';
    setNetwork(newNetwork);
  };

  return (
    <div className="flex items-center gap-2">
      <Label 
        htmlFor="network-toggle" 
        className={cn(
          "text-sm font-medium cursor-pointer",
          isMainnet ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {network === 'testnet' ? 'Testnet' : 'Mainnet'}
      </Label>
      <Switch
        id="network-toggle"
        checked={isMainnet}
        onCheckedChange={toggleNetwork}
      />
    </div>
  );
}

