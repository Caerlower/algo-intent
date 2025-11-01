import { cn } from "@/lib/utils";
import SwapWidget from "./SwapWidget";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  status?: 'pending' | 'success' | 'error';
  txid?: string;
  imageUrl?: string;
  isPendingImage?: boolean;
  widgetParams?: {
    fromAsset?: string;
    toAsset?: string;
    amount?: number;
    fee?: string; // Store fee for transaction details
  };
  onSwapCompleted?: (result: any) => void;
  onSwapFailed?: (error: any) => void;
}

// Helper function to parse transaction details from content
const parseTransactionDetails = (content: string, widgetParams?: { fromAsset?: string; toAsset?: string; amount?: number; fee?: string }) => {
  const details: { [key: string]: string } = {};
  
  // Check if this is a balance check (not a transaction, so no fees)
  const isBalanceCheck = /balance|checking balance|balance:/i.test(content) && !/sent|sending|transfer|swap|nft|created/i.test(content);
  
  if (isBalanceCheck) {
    // Balance check details - show balance and assets, no fees
    const balanceMatch = content.match(/Balance:\s*(\d+\.?\d*)\s*ALGO/i);
    const assetsMatch = content.match(/Assets:\s*(\d+)/i);
    
    if (balanceMatch) {
      details.balance = `${balanceMatch[1]} ALGO`;
    }
    if (assetsMatch) {
      details.assets = `${assetsMatch[1]} assets`;
    }
    
    // No fees for balance checks
    return Object.keys(details).length > 0 ? details : null;
  }
  
  // Check if this is an NFT creation transaction
  const isNFTCreation = /nft.*created|created.*nft|asset id|asset id:/i.test(content);
  
  if (isNFTCreation) {
    // Extract Asset ID: "Asset ID: 748981539" or "Asset ID:748981539"
    const assetIdMatch = content.match(/Asset\s*ID:\s*(\d+)/i);
    if (assetIdMatch) {
      details.assetId = assetIdMatch[1];
    }
    
    // Extract Name: "Name: alginte" or "Name:alginte" - can be before or after Asset ID
    const nameMatch = content.match(/Name:\s*([^\n,]+)/i);
    if (nameMatch) {
      details.name = nameMatch[1].trim();
    }
    
    // NFT creation typically has a fee of 0.001 ALGO
    if (details.assetId || details.name) {
      details.fee = "0.001 ALGO";
    }
    
    return Object.keys(details).length > 0 ? details : null;
  }
  
  // Check if this is a swap transaction
  const isSwap = /swap|swapped|exchanged|converted/i.test(content) || (widgetParams?.fromAsset && widgetParams?.toAsset);
  
  if (isSwap) {
    // Swap transaction details
    // Try to extract swap pattern: "Transaction successful! SWAPPED 1 ALGO to USDC"
    const swapMatch = content.match(/SWAPPED\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(\w+)/i);
    
    if (swapMatch) {
      // Extract from swap message
      const fromAmount = swapMatch[1];
      const fromAsset = swapMatch[2];
      const toAsset = swapMatch[3];
      details.fromAmount = `${fromAmount} ${fromAsset}`;
      details.fromAsset = fromAsset;
      details.toAsset = toAsset;
      
      // Try to extract toAmount if available (might be in a different format)
      const toAmountMatch = content.match(/→\s*(\d+\.?\d*)\s*(\w+)/i);
      if (toAmountMatch) {
        details.toAmount = `${toAmountMatch[1]} ${toAmountMatch[2]}`;
      }
    } else if (widgetParams) {
      // Fall back to widget params if available
      const fromAmount = widgetParams.amount || 0;
      const fromAsset = widgetParams.fromAsset || 'ALGO';
      const toAsset = widgetParams.toAsset || 'USDC';
      details.fromAmount = `${fromAmount} ${fromAsset}`;
      details.fromAsset = fromAsset;
      details.toAsset = toAsset;
    }
    
    // Extract fee from widget params (stored there after swap completion) or use default
    if (widgetParams?.fee) {
      details.fee = widgetParams.fee;
    } else {
      details.fee = "0.001 ALGO"; // Default swap fee
    }
    
    return Object.keys(details).length > 0 ? details : null;
  }
  
  // Regular ALGO send transaction
  // Try to extract amount (e.g., "10 ALGO", "1.5 ALGO", "1.000000 ALGO")
  const amountMatch = content.match(/(\d+\.?\d*)\s*ALGO/i);
  if (amountMatch) {
    // Format amount nicely (remove trailing zeros if whole number)
    const amount = parseFloat(amountMatch[1]);
    details.amount = amount % 1 === 0 ? `${amount} ALGO` : `${amount.toFixed(6)} ALGO`;
  }
  
  // Try to extract recipient address (full address or truncated format)
  // Handles: "Sending X ALGO to ABC...DEF", "Transaction successful! X ALGO sent to ABC...DEF"
  const addressPatterns = [
    /([A-Z0-9]{58})/, // Full 58 char address
    /([A-Z0-9]{6,15})\.\.\.([A-Z0-9]{3,5})/, // Truncated format like "ABC...DEF"
    /(?:send|sent|to)\s+([A-Z0-9]{6,15})\.\.\.([A-Z0-9]{3,5})/i, // "send/sent to ABC...DEF"
    /(?:Sending|sent)\s+.*?\s+to\s+([A-Z0-9]{6,15})\.\.\.([A-Z0-9]{3,5})/i, // "Sending X ALGO to ABC...DEF"
  ];
  
  for (const pattern of addressPatterns) {
    const match = content.match(pattern);
    if (match) {
      if (match.length === 2) {
        // Full address
        details.to = match[1];
      } else if (match.length === 3) {
        // Truncated format
        details.to = `${match[1]}...${match[2]}`;
      }
      break;
    }
  }
  
  // Fee is typically 0.001 ALGO for basic transactions
  if (details.amount) {
    details.fee = "0.001 ALGO";
  }
  
  return Object.keys(details).length > 0 ? details : null;
};

const ChatMessage = ({ role, content, status, txid, imageUrl, isPendingImage, widgetParams, onSwapCompleted, onSwapFailed }: ChatMessageProps) => {
  const transactionDetails = role === "assistant" ? parseTransactionDetails(content, widgetParams) : null;
  const isSwap = transactionDetails?.fromAmount && transactionDetails?.toAmount;
  const isBalanceCheck = transactionDetails?.balance !== undefined || transactionDetails?.assets !== undefined;
  const isNFTCreation = transactionDetails?.assetId !== undefined || transactionDetails?.name !== undefined;
  // Show transaction details for swap success/error or regular sends, or balance checks, or NFT creation
  const showDetailsSection = transactionDetails && (status === 'success' || status === 'error' || (status === 'pending' && /send|sending|transfer|swap|balance|nft|create/i.test(content)));
  const hasSwapWidget = widgetParams && role === "assistant" && status !== 'success' && status !== 'error';
  
  // Extract main message text - for balance checks and NFT creation, show simplified message
  let mainContent = content;
  if (isBalanceCheck && status === 'success') {
    // Extract only the "Checking balance for..." part, remove balance info
    // Match "Checking balance for NLZWGP...GZTI." format (with period before Balance:)
    const checkingMatch = content.match(/^(Checking balance for\s+[A-Z0-9]+\.\.\.[A-Z0-9]+\.?)/i);
    if (checkingMatch) {
      mainContent = checkingMatch[1].trim();
    } else {
      // Fallback: show up to first "Balance:" mention
      mainContent = content.split(/Balance:/i)[0].trim();
    }
  } else if (isNFTCreation && status === 'success') {
    // For NFT creation, show only "NFT created successfully!" without the Asset ID and Name details
    const nftSuccessMatch = content.match(/^(.*?NFT.*?created.*?successfully!)/i);
    if (nftSuccessMatch) {
      mainContent = nftSuccessMatch[1].trim();
    } else {
      // Fallback: show up to "Asset ID:" or "Name:"
      mainContent = content.split(/Asset\s*ID:|Name:/i)[0].trim();
    }
  }
  
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {role === "assistant" && (
        <div className="flex-shrink-0 mr-2 sm:mr-3 mt-1">
          <div className="relative w-6 h-6 sm:w-8 sm:h-8">
            <div 
              className="absolute inset-0 rounded-full opacity-90 animate-pulse-glow"
              style={{
                background: 'var(--gradient-orb)',
              }}
            />
            <div 
              className="absolute inset-0.5 sm:inset-1 rounded-full bg-white/30 backdrop-blur-sm"
            />
          </div>
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-4 shadow-sm",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-primary/20"
        )}
      >
        {role === "assistant" && (
          <div className="text-primary text-xs sm:text-sm font-medium mb-2">
            Algo Intent
          </div>
        )}
        
        {/* Main message content */}
        <p className={cn(
          "text-xs sm:text-sm whitespace-pre-wrap break-words",
          showDetailsSection ? "mb-3" : "mb-0"
        )}>
          {mainContent || content}
        </p>
        
        {/* Swap Widget - embedded in message */}
        {hasSwapWidget && (
          <div className="mb-3">
            <SwapWidget
              fromAsset={widgetParams?.fromAsset}
              toAsset={widgetParams?.toAsset}
              amount={widgetParams?.amount}
              onSwapCompleted={onSwapCompleted}
              onSwapFailed={onSwapFailed}
            />
          </div>
        )}
        
        {/* Transaction Details Section - show below message content */}
        {showDetailsSection && transactionDetails && (
          <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
            {isBalanceCheck ? (
              <>
                {/* Balance check details - no fees */}
                {transactionDetails.balance && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Balance:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.balance}</span>
                  </div>
                )}
                {transactionDetails.assets && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Assets:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.assets}</span>
                  </div>
                )}
              </>
            ) : isNFTCreation ? (
              <>
                {/* NFT creation details */}
                {transactionDetails.name && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Name:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.name}</span>
                  </div>
                )}
                {transactionDetails.assetId && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Asset ID:</span>
                    <span className="text-xs font-semibold text-foreground font-mono">{transactionDetails.assetId}</span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Fee:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            ) : isSwap ? (
              <>
                {/* Swap transaction details */}
                {transactionDetails.fromAmount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">From:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.fromAmount}</span>
                  </div>
                )}
                {transactionDetails.toAmount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">To:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.toAmount}</span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Fee:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Regular ALGO send transaction details */}
                {transactionDetails.amount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Amount:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.amount}</span>
                  </div>
                )}
                {transactionDetails.to && (
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">To:</span>
                    <span className="text-xs font-mono text-foreground">
                      {transactionDetails.to.includes('...') 
                        ? transactionDetails.to
                        : transactionDetails.to.length > 15 
                        ? `${transactionDetails.to.substring(0, 6)}...${transactionDetails.to.substring(transactionDetails.to.length - 4)}`
                        : transactionDetails.to}
                    </span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Fee:</span>
                    <span className="text-xs font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Display image if present */}
        {imageUrl && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img 
              src={imageUrl} 
              alt="Uploaded content"
              className="max-w-full max-h-48 rounded-lg object-cover"
            />
          </div>
        )}
        
        {/* Status and Transaction ID - combined section */}
        <div className="mt-3 pt-2 border-t border-border/50">
          {status && (
            <div className={cn("flex items-center gap-2 mb-2 text-[10px] sm:text-xs", {
              "text-yellow-600": status === 'pending',
              "text-green-600": status === 'success',
              "text-red-600": status === 'error'
            })}>
              {status === 'pending' && (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              )}
              {status === 'success' && (
                <>
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Success</span>
                </>
              )}
              {status === 'error' && (
                <>
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>Failed</span>
                </>
              )}
            </div>
          )}
          
                  {txid && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      <span className="text-muted-foreground">TxID: </span>
                      <a 
                        href={`https://lora.algokit.io/testnet/transaction/${txid}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary underline hover:text-primary/80 font-mono"
                      >
                        {txid.substring(0, 8)}...{txid.substring(txid.length - 4)}
                      </a>
                    </div>
                  )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
