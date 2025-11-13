import { cn } from "@/lib/utils";
import { useNetwork } from "@/providers/NetworkProvider";
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
    type?: string;
    assetId?: number;
    toAddress?: string;
    amountDisplay?: string;
    assetName?: string;
  };
  onSwapCompleted?: (result: any) => void;
  onSwapFailed?: (error: any) => void;
}

// Helper function to parse transaction details from content
const shortenAddressInline = (address: string) => {
  if (!address) return '';
  if (address.includes('...')) return address;
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const parseTransactionDetails = (
  content: string,
  widgetParams?: {
    fromAsset?: string;
    toAsset?: string;
    amount?: number;
    fee?: string;
    type?: string;
    assetId?: number;
    toAddress?: string;
    amountDisplay?: string;
    assetName?: string;
    to?: string;
  }
) => {
  const details: Record<string, any> = {};
  if (!content) return null;

  if (widgetParams?.type === 'nft_transfer') {
    const amountLabel =
      widgetParams.amountDisplay ??
      `${widgetParams.amount ?? 1} NFT${(widgetParams.amount ?? 1) === 1 ? '' : 's'}`;
    details.amount = amountLabel;
    if (widgetParams.toAddress) {
      details.to = shortenAddressInline(widgetParams.toAddress);
    }
    if (widgetParams.assetId !== undefined) {
      details.assetId = widgetParams.assetId.toString();
    }
    if (widgetParams.assetName) {
      details.assetName = widgetParams.assetName;
    }
    if (widgetParams.fee) {
      details.fee = widgetParams.fee;
    }
    details.nftTransfer = true;
    return details;
  }

  if (/executing atomic transaction|atomic transaction successful|atomic transaction failed/i.test(content)) {
    const transfers = [...content.matchAll(/(?:send|sent)\s+([\d.,]+)\s+([A-Za-z0-9]+)\s+to\s+([A-Z0-9.]+)/gi)];
    if (transfers.length > 0) {
      details.atomicTransfers = transfers.map(match => {
        const amount = match[1].replace(/,/g, '');
        const asset = match[2].toUpperCase();
        const to = match[3].replace(/[.,]+$/, '');
        return {
          displayAmount: `${amount} ${asset}`,
          amount,
          asset,
          to,
        };
      });
      const feeMatch = content.match(/total fee:\s*([\d.]+)\s*ALGO/i);
      if (feeMatch) {
        details.fee = `${feeMatch[1]} ALGO`;
      } else {
        const totalFee = (transfers.length * 0.001).toLocaleString(undefined, { maximumFractionDigits: 6 });
        details.fee = `${totalFee} ALGO`;
      }
      return details;
    }
  }

  // Detect single asset transfers (non-atomic) such as USDC
  const assetSendMatch = content.match(/(?:sending|send|sent)\s+([\d.,]+)\s+([A-Z0-9]+)\s+to\s+([A-Z0-9.]+)/i);
  if (assetSendMatch) {
    const amount = assetSendMatch[1].replace(/,/g, '');
    const assetSymbol = assetSendMatch[2].toUpperCase();
    if (assetSymbol !== 'ALGO') {
      details.amount = `${amount} ${assetSymbol}`;
      const recipient = assetSendMatch[3].replace(/[.,]+$/, '');
      details.to = shortenAddressInline(recipient);
      details.fee = details.fee || '0.001 ALGO';
    }
  }

  // Check if this is a price check
  const isPriceCheck = /current market prices|fetching.*prices|price/i.test(content) && !/sent|sending|transfer|swap|nft|created|balance/i.test(content);
  
  if (isPriceCheck) {
    // Extract price information from format: "ALGO: $0.1852 🟢+2.94%" or "ALGO: $0.1852 +2.94%"
    // Parse manually by finding price entries in the format: "SYMBOL: $PRICE EMOJI+CHANGE%"
    let priceEntries: Array<{ symbol: string; price: string; change: string }> = [];
    
    // Find all matches of the pattern: "SYMBOL: $PRICE ... CHANGE%"
    // Split by "Last updated:" to get the price section
    const priceSection = content.split(/Last updated:/i)[0];
    
    // Manual parsing: find all patterns like "SYMBOL: $PRICE ... CHANGE%"
    // Split by comma to get individual price entries, or use the whole section if no comma
    const priceParts = priceSection.includes(',') 
      ? priceSection.split(',').map(p => p.trim())
      : [priceSection.trim()];
    
    for (const part of priceParts) {
      // Look for pattern: "SYMBOL: $PRICE ... CHANGE%"
      // Match: ALGO: $0.1865 🟢+4.34%
      // Match symbol and price separately
      // Find symbol: "ALGO:"
      const symbolMatch = part.match(/([A-Z]+):/);
      // Find price: "$0.1865" - escape $ properly
      let priceMatch = part.match(/\$(\d+\.\d+)/);
      if (!priceMatch) {
        // Try without $ sign - look for price after the symbol
        const priceAfterSymbol = part.substring(part.indexOf(':') + 1);
        priceMatch = priceAfterSymbol.match(/(\d+\.\d+)/);
      }
      // Find change: "+4.34%" or "-4.34%"
      const changeMatch = part.match(/([+-]?\d+\.\d+)%/);
      
      if (symbolMatch && priceMatch && changeMatch) {
        const symbol = symbolMatch[1];
        const price = priceMatch[1];
        let change = changeMatch[1];
        
        // Ensure change has a sign
        if (!change.startsWith('+') && !change.startsWith('-')) {
          // Look for + or - before the change in the part
          const changeIndex = part.indexOf(change);
          const beforeChange = part.substring(0, changeIndex);
          const signMatch = beforeChange.match(/([+-])\s*$/);
          change = (signMatch ? signMatch[1] : '+') + change;
        }
        
        priceEntries.push({ symbol, price, change });
      }
    }
    
    if (priceEntries.length > 0) {
      // Store individual price entries for structured display
      details.priceEntries = JSON.stringify(priceEntries);
      
      // Extract last updated time if present
      const lastUpdatedMatch = content.match(/Last updated:\s*([^\n]+)/i);
      if (lastUpdatedMatch) {
        details.lastUpdated = lastUpdatedMatch[1].trim();
      }
    }
    
    return Object.keys(details).length > 0 ? details : null;
  }
  
  // Detect NFT transfer intents/success messages
  const nftSendingMatch = content.match(/sending\s+([\d.,]+)\s+nfts?\s*(?:"([^"]+)")?\s*\(asset id\s*(\d+)\)\s+to\s+([A-Z0-9.]+)/i);
  if (nftSendingMatch) {
    const quantity = nftSendingMatch[1].replace(/,/g, '');
    const assetName = nftSendingMatch[2];
    const assetId = nftSendingMatch[3];
    const rawRecipient = nftSendingMatch[4].replace(/[.,]+$/, '');
    const quantityNumber = Number(quantity);
    const unitLabel = quantityNumber === 1 ? 'NFT' : 'NFTs';

    details.amount = `${quantity} ${unitLabel}`;
    if (assetName) {
      details.assetName = assetName;
    }
    details.assetId = assetId;
    details.to = rawRecipient.includes('...') ? rawRecipient : `${rawRecipient.substring(0, 6)}...${rawRecipient.substring(rawRecipient.length - 4)}`;
    details.fee = details.fee || '0.001 ALGO';
    details.nftTransfer = true;
    return details;
  }

  if (widgetParams?.type === 'nft_transfer') {
    if (!details.amount && (widgetParams.amountDisplay || widgetParams.amount !== undefined)) {
      details.amount =
        widgetParams.amountDisplay ||
        `${widgetParams.amount} NFT${widgetParams.amount === 1 ? '' : 's'}`;
    }
    if (!details.to) {
      const addr = widgetParams.to ?? widgetParams.toAddress;
      if (addr) details.to = shortenAddressInline(addr);
    }
    if (!details.assetId && widgetParams.assetId !== undefined) {
      details.assetId = widgetParams.assetId.toString();
    }
    if (!details.assetName && widgetParams.assetName) {
      details.assetName = widgetParams.assetName;
    }
    if (!details.fee && widgetParams.fee) {
      details.fee = widgetParams.fee;
    }
    details.nftTransfer = true;
    return details;
  }

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
    details.nftCreation = true;
    // Extract Asset ID: "Asset ID: 748981539" or "Asset ID:748981539"
    const assetIdMatch = content.match(/Asset\s*ID:\s*(\d+)/i);
    if (assetIdMatch) {
      details.assetId = assetIdMatch[1];
    }
    
    // Extract Name: "Name: algointent" or "Name:algointent" - can be before or after Asset ID  
    const nameMatch = content.match(/Name:\s*([^\n,]+)/i);
    if (nameMatch) {
      details.name = nameMatch[1].trim();
    }
    
    // NFT creation typically has a fee of 0.001 ALGO
    if (details.assetId || details.name) {
      if (!details.fee) {
        details.fee = "0.001 ALGO";
      }
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
    } else if (!details.fee) {
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
  if ((details.amount || details.assetId) && !details.fee) {
    details.fee = "0.001 ALGO";
  }
  
  return Object.keys(details).length > 0 ? details : null;
};

const ChatMessage = ({ role, content, status, txid, imageUrl, isPendingImage, widgetParams, onSwapCompleted, onSwapFailed }: ChatMessageProps) => {
  const { network } = useNetwork();
  const transactionDetails = role === "assistant" ? parseTransactionDetails(content, widgetParams) : null;
  const isSwap = transactionDetails?.fromAmount && transactionDetails?.toAmount;
  const isBalanceCheck = transactionDetails?.balance !== undefined || transactionDetails?.assets !== undefined;
  const isNFTCreation = Boolean(transactionDetails?.nftCreation);
  const isNftTransfer = Boolean(transactionDetails?.nftTransfer);
  const isPriceCheck = transactionDetails?.priceEntries !== undefined;
  const displayName = transactionDetails
    ? transactionDetails.assetName ?? transactionDetails.name
    : undefined;
  
  // Parse price entries if present
  let priceEntries: Array<{ symbol: string; price: string; change: string }> = [];
  if (isPriceCheck && transactionDetails?.priceEntries) {
    try {
      priceEntries = JSON.parse(transactionDetails.priceEntries);
    } catch (e) {
      // Fallback if parsing fails
      priceEntries = [];
    }
  }
  // Show transaction details for swap success/error or regular sends, or balance checks, or NFT creation, or price checks
  const showDetailsSection = transactionDetails && (status === 'success' || status === 'error' || (status === 'pending' && /send|sending|transfer|swap|balance|nft|create|price|fetching|executing atomic/i.test(content)));
  const hasSwapWidget = widgetParams && role === "assistant" && status !== 'success' && status !== 'error';
  
  // Extract main message text - for balance checks, price checks, and NFT creation, show simplified message
  let mainContent = content;
  if (isPriceCheck && status === 'success') {
    // For price checks, show "Current Market Prices:" as the main message
    mainContent = 'Current Market Prices:';
  } else if (isBalanceCheck && status === 'success') {
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
  } else if (isNftTransfer && status === 'success') {
    const transferMatch = content.match(/^(.*?successfully!)/i);
    if (transferMatch) {
      mainContent = transferMatch[1].trim();
    } else {
      const prefix = content.match(/^[^:]+:/i);
      if (prefix?.[0]) {
        mainContent = prefix[0].replace(/:$/, '').trim();
      } else {
        mainContent = content;
      }
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
              className="absolute inset-0.5 sm:inset-1 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center overflow-hidden"
            >
              <img 
                src="/logo.png" 
                alt="Algo Intent Logo" 
                className="w-full h-full object-cover"
              />
            </div>
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
          <div className="text-primary text-base sm:text-lg font-medium mb-2">
            Algo Intent
          </div>
        )}
        
        {/* Main message content */}
        <p className={cn(
          "text-base sm:text-lg whitespace-pre-wrap break-words",
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
            {transactionDetails.atomicTransfers ? (
              <>
                {transactionDetails.atomicTransfers.map((transfer: any, index: number) => (
                  <div key={index} className={index < transactionDetails.atomicTransfers.length - 1 ? "mb-3 pb-3 border-b border-primary/10" : ""}>
                    <div className="flex justify-between mb-2">
                      <span className="text-base text-muted-foreground">Amount:</span>
                      <span className="text-base font-semibold text-foreground">{transfer.displayAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base text-muted-foreground">To:</span>
                      <span className="text-base font-semibold text-foreground">{transfer.to}</span>
                    </div>
                  </div>
                ))}
                {transactionDetails.fee && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-primary/10">
                    <span className="text-base text-muted-foreground">Total Fee:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            ) : isPriceCheck ? (
              <>
                {/* Price check details - show each price with improved formatting */}
                {priceEntries.length > 0 ? (
                  priceEntries.map((entry, index) => {
                    const changeColor = parseFloat(entry.change) >= 0 ? '🟢' : '🔴';
                    // Remove + sign from change, just show the number
                    const changeValue = entry.change.replace(/^\+/, '');
                    return (
                      <div key={index} className={index < priceEntries.length - 1 ? "mb-3" : ""}>
                        {/* Price line: ALGO:$0.1867 - only price is bold */}
                        <div className="mb-2">
                          <span className="text-base text-muted-foreground">{entry.symbol}:</span>
                          <span className="text-base font-semibold text-foreground">${entry.price}</span>
                        </div>
                        {/* Price change line: Price change: 🟢 4.54% */}
                        <div className="mb-2">
                          <span className="text-base text-muted-foreground">Price change: </span>
                          <span className="text-base font-semibold text-foreground">
                            {changeColor} {changeValue}%
                          </span>
                        </div>
                        {/* Last updated line - no border/divider */}
                        {transactionDetails.lastUpdated && index === priceEntries.length - 1 && (
                          <div>
                            <span className="text-base text-muted-foreground">Last updated: </span>
                            <span className="text-base font-semibold text-foreground">{transactionDetails.lastUpdated}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Fallback if parsing fails - show raw content
                  <div className="text-base text-muted-foreground">{content}</div>
                )}
                {/* Show last updated if no price entries were parsed */}
                {priceEntries.length === 0 && transactionDetails.lastUpdated && (
                  <div className="mt-2 pt-2 border-t border-primary/10">
                    <span className="text-base text-muted-foreground">Last updated: </span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.lastUpdated}</span>
                  </div>
                )}
              </>
            ) : isBalanceCheck ? (
              <>
                {/* Balance check details - no fees */}
                {transactionDetails.balance && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Balance:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.balance}</span>
                  </div>
                )}
                {transactionDetails.assets && (
                  <div className="flex justify-between">
                    <span className="text-base text-muted-foreground">Assets:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.assets}</span>
                  </div>
                )}
              </>
            ) : isNFTCreation ? (
              <>
                {/* NFT creation details */}
                {displayName && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Name:</span>
                    <span className="text-base font-semibold text-foreground">{displayName}</span>
                  </div>
                )}
                {transactionDetails.assetId && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Asset ID:</span>
                    <span className="text-base font-semibold text-foreground font-mono">{transactionDetails.assetId}</span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-base text-muted-foreground">Fee:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            ) : isSwap ? (
              <>
                {/* Swap transaction details */}
                {transactionDetails.fromAmount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">From:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.fromAmount}</span>
                  </div>
                )}
                {transactionDetails.toAmount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">To:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.toAmount}</span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-base text-muted-foreground">Fee:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.fee}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Regular ALGO send transaction details */}
                {transactionDetails.amount && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Amount:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.amount}</span>
                  </div>
                )}
                {transactionDetails.to && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">To:</span>
                    <span className="text-base font-mono text-foreground">
                      {transactionDetails.to.includes('...') 
                        ? transactionDetails.to
                        : transactionDetails.to.length > 15 
                        ? `${transactionDetails.to.substring(0, 6)}...${transactionDetails.to.substring(transactionDetails.to.length - 4)}`
                        : transactionDetails.to}
                    </span>
                  </div>
                )}
                {displayName && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Name:</span>
                    <span className="text-base font-semibold text-foreground">{displayName}</span>
                  </div>
                )}
                {transactionDetails.assetId && (
                  <div className="flex justify-between mb-2">
                    <span className="text-base text-muted-foreground">Asset ID:</span>
                    <span className="text-base font-semibold text-foreground font-mono">{transactionDetails.assetId}</span>
                  </div>
                )}
                {transactionDetails.fee && (
                  <div className="flex justify-between">
                    <span className="text-base text-muted-foreground">Fee:</span>
                    <span className="text-base font-semibold text-foreground">{transactionDetails.fee}</span>
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
            <div className={cn("flex items-center gap-2 mb-2 text-sm sm:text-base", {
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
                    <div className="text-sm sm:text-base text-muted-foreground">
                      <span className="text-muted-foreground">Transaction ID: </span>
                      <a 
                        href={`https://lora.algokit.io/${network}/transaction/${txid}`} 
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
