import React, { useEffect, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { TradingService } from '../services/tradingService';
import { cn } from "@/lib/utils";

interface SwapWidgetProps {
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  onSwapCompleted?: (result: any) => void;
  onSwapFailed?: (error: any) => void;
}

const TESTNET_ASSETS = [
  { symbol: 'ALGO', id: 0, decimals: 6, name: 'Algorand', icon: 'https://cryptologos.cc/logos/algorand-algo-logo.png?v=026' },
  { symbol: 'USDC', id: 10458941, decimals: 6, name: 'USDC', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=026' },
];

const getAssetMeta = (symbol: string) => TESTNET_ASSETS.find(a => a.symbol === symbol) || TESTNET_ASSETS[0];

const tradingService = new TradingService();

const SwapWidget: React.FC<SwapWidgetProps> = ({ fromAsset, toAsset, amount, onSwapCompleted, onSwapFailed }) => {
  const { activeAddress, signTransactions, transactionSigner } = useWallet();
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
        signTransactions
      );
      setSwapResult(result);
      if (result.status === 'success') {
        onSwapCompleted?.(result);
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

  const fromMeta = getAssetMeta(from);
  const toMeta = getAssetMeta(to);

  return (
    <div className={cn(
      "w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-6 mx-auto",
      "text-foreground"
    )}>
      <div className="text-xl font-extrabold mb-4 tracking-tight text-center">Swap Tokens</div>
      {/* FROM FIELD */}
      <div className="w-full bg-muted/50 border border-border rounded-xl p-4 mb-1 flex flex-col relative">
        <div className="flex items-center mb-1.5">
          <span className={cn(
            "w-7 h-7 rounded-full text-white inline-flex items-center justify-center font-extrabold mr-2.5",
            from === 'ALGO' ? 'bg-emerald-500' : 'bg-blue-600'
          )}>{fromMeta.symbol[0]}</span>
          <span className="font-bold text-[1.05rem] mr-1.5">{fromMeta.name}</span>
          <span className="font-semibold text-muted-foreground text-[1.02rem]">{fromMeta.symbol}</span>
        </div>
        <div className="flex items-end justify-between">
          <input
            type="number"
            min={0}
            value={amt}
            onChange={e => setAmt(Number(e.target.value))}
            className="bg-transparent border-0 outline-none font-extrabold text-2xl text-foreground w-3/4"
            placeholder="0.00"
          />
          <div className="text-right text-muted-foreground font-semibold text-[1.05rem] mb-0.5">
            {fromUsd !== null ? `≈ $${fromUsd.toFixed(2)}` : ''}
          </div>
        </div>
      </div>
      {/* SWITCH BUTTON */}
      <button
        className="w-10 h-10 rounded-full bg-background border-2 border-border flex items-center justify-center -my-3 cursor-pointer z-10 relative"
        onClick={handleSwitch}
        title="Switch"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 7V21" />
            <path d="M10 11L14 7L18 11" />
            <path d="M18 17L14 21L10 17" />
          </g>
        </svg>
      </button>
      {/* TO FIELD */}
      <div className="w-full bg-muted/50 border border-border rounded-xl p-4 mb-3 flex flex-col relative">
        <div className="flex items-center mb-1.5">
          <span className={cn(
            "w-7 h-7 rounded-full text-white inline-flex items-center justify-center font-extrabold mr-2.5",
            to === 'ALGO' ? 'bg-emerald-500' : 'bg-blue-600'
          )}>{toMeta.symbol[0]}</span>
          <span className="font-bold text-[1.05rem] mr-1.5">{toMeta.name}</span>
          <span className="font-semibold text-muted-foreground text-[1.02rem]">{toMeta.symbol}</span>
        </div>
        <div className="flex items-end justify-between">
          <input
            type="text"
            value={quote && quote.toAmount ? quote.toAmount.toFixed(6) : ''}
            readOnly
            className="bg-transparent border-0 outline-none font-extrabold text-2xl text-foreground w-3/4"
            placeholder="0.00"
          />
          <div className="text-right text-muted-foreground font-semibold text-[1.05rem] mb-0.5">
            {quote && quote.toAmount && toUsd !== null ? `≈ $${toUsd.toFixed(2)}` : ''}
          </div>
        </div>
      </div>
      {/* Price Impact and Fee (below fields) */}
      {quote && (
        <div className="w-full mb-3 text-right text-muted-foreground font-semibold text-[1.01rem]">
          Fee: <span className="text-foreground font-bold">{quote.fee}</span>
        </div>
      )}
      <button
        onClick={handleSwap}
        disabled={loading || !activeAddress || !from || !to || !amt || from === to}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-md"
      >
        Swap
      </button>
      {error && <div className="text-red-600 mt-3 w-full text-center font-semibold">{error}</div>}
      {swapResult && swapResult.status === 'success' && (
        <div className="text-emerald-600 mt-3 w-full text-center font-semibold">
          Swap successful! <a href={`https://testnet.explorer.perawallet.app/tx/${swapResult.txid}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View on Explorer</a>
        </div>
      )}
      {!activeAddress && <div className="text-red-600 mt-3 text-center font-medium text-[1.01rem]">Connect your wallet to swap</div>}
    </div>
  );
};

export default SwapWidget; 