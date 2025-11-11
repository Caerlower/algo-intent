import React, { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { TradingService } from '../services/tradingService';
import { useNetwork } from '../providers/NetworkProvider';
import { getAlgodConfigForNetwork } from '../utils/network/getAlgoClientConfigs';
import { cn } from "@/lib/utils";

interface SwapWidgetProps {
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  onSwapCompleted?: (result: any) => void;
  onSwapFailed?: (error: any) => void;
}

// Network-specific asset configurations
const TESTNET_ASSETS = [
  { symbol: 'ALGO', id: 0, decimals: 6, name: 'Algorand', icon: 'https://cryptologos.cc/logos/algorand-algo-logo.png?v=026' },
  { symbol: 'USDC', id: 10458941, decimals: 6, name: 'USDC', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=026' },
];

const MAINNET_ASSETS = [
  { symbol: 'ALGO', id: 0, decimals: 6, name: 'Algorand', icon: 'https://cryptologos.cc/logos/algorand-algo-logo.png?v=026' },
  { symbol: 'USDC', id: 31566704, decimals: 6, name: 'USDC', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=026' },
];

const getAssetMeta = (symbol: string, network: 'testnet' | 'mainnet') => {
  const assets = network === 'mainnet' ? MAINNET_ASSETS : TESTNET_ASSETS;
  return assets.find(a => a.symbol === symbol) || assets[0];
};

const SwapWidget: React.FC<SwapWidgetProps> = ({ fromAsset, toAsset, amount, onSwapCompleted, onSwapFailed }) => {
  const { activeAddress, signTransactions, transactionSigner } = useWallet();
  const { network } = useNetwork();
  
  // Get algod config based on selected network
  const algodConfig = useMemo(() => {
    return getAlgodConfigForNetwork(network);
  }, [network]);
  
  const tradingService = useMemo(() => {
    return new TradingService(algodConfig);
  }, [algodConfig]);
  const [from, setFrom] = useState(fromAsset || 'ALGO');
  const [to, setTo] = useState(toAsset || 'USDC');
  const [amt, setAmt] = useState(amount || 1);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapResult, setSwapResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromUsd, setFromUsd] = useState<number | null>(null);
  const [toUsd, setToUsd] = useState<number | null>(null);

  // Fetch quote and USD values when from/to/amt changes
  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    setError(null);
    setFromUsd(null);
    setToUsd(null);
    if (!from || !to || !amt || isNaN(amt) || amt <= 0) return;
    setLoading(true);
    Promise.all([
      tradingService.getSwapQuote(from, to, amt),
      tradingService.getPrices([from, to])
    ])
      .then(([q, prices]) => {
        if (!cancelled) {
          setQuote(q);
          const fromPrice = prices.find(p => p.symbol === from)?.price;
          const toPrice = prices.find(p => p.symbol === to)?.price;
          setFromUsd(fromPrice ? amt * fromPrice : null);
          setToUsd(toPrice && q?.toAmount ? q.toAmount * toPrice : null);
        }
      })
      .catch(e => {
        if (!cancelled) setError('Could not fetch quote');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [from, to, amt]);

  const handleSwap = async () => {
    setLoading(true);
    setError(null);
    setSwapResult(null);
    try {
      const result = await tradingService.executeSwap(
        from,
        to,
        amt,
        transactionSigner,
        activeAddress!,
        signTransactions,
        algodConfig
      );
      setSwapResult(result);
      if (result.status === 'success') {
        // Pass quote data with swap result for transaction details
        onSwapCompleted?.({
          ...result,
          toAmount: quote?.toAmount,
          fee: quote?.fee,
          quote: quote
        });
      } else {
        setError(result.message);
        onSwapFailed?.(result);
      }
    } catch (e: any) {
      setError(e?.message || 'Swap failed');
      onSwapFailed?.(e);
    } finally {
      setLoading(false);
    }
  };

  // Swap from/to assets
  const handleSwitch = () => {
    setFrom(to);
    setTo(from);
    setQuote(null);
    setFromUsd(null);
    setToUsd(null);
  };

  const fromMeta = getAssetMeta(from, network);
  const toMeta = getAssetMeta(to, network);

  return (
    <div className={cn(
      "w-full bg-transparent",
      "text-foreground"
    )}>
      <div className="text-sm font-bold mb-3 text-foreground">Swap Tokens</div>
      {/* FROM FIELD */}
      <div className="w-full bg-primary/5 border border-primary/10 rounded-lg p-3 mb-2 flex flex-col relative">
        <div className="flex items-center mb-1.5">
          <span className={cn(
            "w-6 h-6 rounded-full text-white inline-flex items-center justify-center font-bold text-xs mr-2",
            from === 'ALGO' ? 'bg-emerald-500' : 'bg-blue-600'
          )}>{fromMeta.symbol[0]}</span>
          <span className="font-semibold text-sm mr-1">{fromMeta.name}</span>
          <span className="font-medium text-xs text-muted-foreground">{fromMeta.symbol}</span>
        </div>
        <div className="flex items-end justify-between">
          <input
            type="number"
            min={0}
            value={amt}
            onChange={e => setAmt(Number(e.target.value))}
            className="bg-transparent border-0 outline-none font-bold text-lg text-foreground w-3/4"
            placeholder="0.00"
          />
          <div className="text-right text-muted-foreground font-medium text-xs mb-0.5">
            {fromUsd !== null ? `≈ $${fromUsd.toFixed(2)}` : ''}
          </div>
        </div>
      </div>
      {/* SWITCH BUTTON */}
      <button
        className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center -my-2 cursor-pointer z-10 relative mx-auto"
        onClick={handleSwitch}
        title="Switch"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7V21" />
            <path d="M10 11L14 7L18 11" />
            <path d="M18 17L14 21L10 17" />
          </g>
        </svg>
      </button>
      {/* TO FIELD */}
      <div className="w-full bg-primary/5 border border-primary/10 rounded-lg p-3 mb-3 flex flex-col relative">
        <div className="flex items-center mb-1.5">
          <span className={cn(
            "w-6 h-6 rounded-full text-white inline-flex items-center justify-center font-bold text-xs mr-2",
            to === 'ALGO' ? 'bg-emerald-500' : 'bg-blue-600'
          )}>{toMeta.symbol[0]}</span>
          <span className="font-semibold text-sm mr-1">{toMeta.name}</span>
          <span className="font-medium text-xs text-muted-foreground">{toMeta.symbol}</span>
        </div>
        <div className="flex items-end justify-between">
          <input
            type="text"
            value={quote && quote.toAmount ? quote.toAmount.toFixed(6) : ''}
            readOnly
            className="bg-transparent border-0 outline-none font-bold text-lg text-foreground w-3/4"
            placeholder="0.00"
          />
          <div className="text-right text-muted-foreground font-medium text-xs mb-0.5">
            {quote && quote.toAmount && toUsd !== null ? `≈ $${toUsd.toFixed(2)}` : ''}
          </div>
        </div>
      </div>
      {/* Price Impact and Fee (below fields) */}
      {quote && (
        <div className="w-full mb-3 text-right text-muted-foreground text-xs">
          Fee: <span className="text-foreground font-semibold">{quote.fee}</span>
        </div>
      )}
      <button
        onClick={handleSwap}
        disabled={loading || !activeAddress || !from || !to || !amt || from === to}
        className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:bg-primary/90 transition-colors"
      >
        {loading ? 'Swapping...' : 'Swap'}
      </button>
      {error && <div className="text-red-600 mt-2 w-full text-center text-xs font-medium">{error}</div>}
              {swapResult && swapResult.status === 'success' && (
                <div className="text-emerald-600 mt-2 w-full text-center text-xs font-medium">
                  Swap successful! <a href={`https://lora.algokit.io/${network}/transaction/${swapResult.txid}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">View on Explorer</a>
                </div>
              )}
      {!activeAddress && <div className="text-red-600 mt-2 text-center text-xs font-medium">Connect your wallet to swap</div>}
    </div>
  );
};

export default SwapWidget; 