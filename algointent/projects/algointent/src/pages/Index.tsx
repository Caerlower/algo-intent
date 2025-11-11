import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { useEnhancedWallet } from '../providers/EnhancedWalletProvider';
import { useNetwork } from '../providers/NetworkProvider';
import { aiIntentService, ParsedIntent } from '../services/aiIntentService';
import { TransactionService, NFTMetadata } from '../services/transactionService';
import { TradingService, tinymanSigner } from '../services/tradingService';
import { ipfsService } from '../services/ipfsService';
import { getAlgodConfigForNetwork } from '../utils/network/getAlgoClientConfigs';
import algosdk from 'algosdk';
import { Link, useLocation } from 'react-router-dom';

import OrbVisual from "@/components/OrbVisual";
import QuickActions from "@/components/QuickActions";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WalletConnectButton from "@/components/WalletConnectButton";
import SwapWidget from "@/components/SwapWidget";
import { NetworkToggle } from "@/components/NetworkToggle";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X, AlertTriangle } from "lucide-react";
import { MainnetWarning } from "@/components/MainnetWarning";

interface Message {
  id: string; // Unique ID for message updates
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
}

interface PendingImage {
  file: File;
  preview: string;
  timestamp: Date;
}

let messageCounter = 0;

const generateMessageId = () => {
  return `msg-${Date.now()}-${++messageCounter}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  } else {
    // Evening and night hours - always use "Good evening" for a welcoming feel
    return "Good evening";
  }
};

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ algo: number; assets: any[] }>({ algo: 0, assets: [] });
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting());
  const [inputValue, setInputValue] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  
  const { activeAddress, transactionSigner, signTransactions, isGoogleConnected, googleUser, googleWallet } = useEnhancedWallet();
  const { theme, setTheme } = useTheme();
  const { network, isMainnet, setNetwork } = useNetwork();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/features", label: "Features" },
    { to: "/documentation", label: "Docs" },
    { to: "/about", label: "About" },
  ];

  // Update greeting periodically to handle timezone changes
  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getGreeting());
    };
    
    // Update immediately
    updateGreeting();
    
    // Update every minute to catch hour changes
    const interval = setInterval(updateGreeting, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Get algod config based on selected network
  const algodConfig = useMemo(() => {
    return getAlgodConfigForNetwork(network);
  }, [network]);
  
  const transactionService = useMemo(() => {
    return new TransactionService(algodConfig);
  }, [algodConfig]);
  
  // Create trading service instance with network config
  const tradingServiceInstance = useMemo(() => {
    return new TradingService(algodConfig);
  }, [algodConfig]);

  // Load pending image from session storage on mount
  useEffect(() => {
    const savedPendingImage = sessionStorage.getItem('pendingImage');
    if (savedPendingImage) {
      try {
        const parsed = JSON.parse(savedPendingImage);
        addBotMessage('📸 You have a previously uploaded image ready for NFT creation. Upload a new image or type "create NFT" to use the existing one.');
      } catch (error) {
        console.error('Failed to parse pending image from session storage:', error);
      }
    }
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    // Always scroll to bottom when messages change
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Persist chat in sessionStorage so history is not lost during interactions
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('ai_chat_messages');
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Ensure all messages have IDs (for backward compatibility)
          const messagesWithIds = parsed.map(msg => ({
            ...msg,
            id: msg.id || generateMessageId()
          }));
          setMessages(messagesWithIds);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('ai_chat_messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Fetch balance on wallet connect and after transactions
  useEffect(() => {
    const fetchBalance = async () => {
      if (activeAddress) {
        try {
          const info = await transactionService.getAccountBalance(activeAddress);
          setAccountInfo(info);
        } catch (error) {
          // Silently fail - balance will be fetched on next transaction
        }
      }
    };
    fetchBalance();
  }, [activeAddress]);

  const addMessage = (type: 'user' | 'assistant', content: string, status?: 'pending' | 'success' | 'error', txid?: string, imageUrl?: string, isPendingImage?: boolean, widgetParams?: { fromAsset?: string; toAsset?: string; amount?: number }) => {
    const newMessage: Message = {
      id: generateMessageId(),
      role: type,
      content,
      status,
      txid,
      imageUrl,
      isPendingImage,
      widgetParams
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const addBotMessage = (content: string, status?: 'pending' | 'success' | 'error', txid?: string) => {
    return addMessage('assistant', content, status, txid);
  };

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, ...updates } : msg));
  };

  const addUserMessage = (content: string, imageUrl?: string) => {
    addMessage('user', content, undefined, undefined, imageUrl);
  };

  const generateUnitName = (name: string): string => {
    const initials = name.split(' ').map(word => word[0]).join('').toUpperCase();
    return initials.substring(0, 8) || 'NFT';
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setFilePreview(preview);
      
      // Store as pending image
      const pendingImageData: PendingImage = {
        file,
        preview,
        timestamp: new Date()
      };
      setPendingImage(pendingImageData);
      
      // Save to session storage
      sessionStorage.setItem('pendingImage', JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
        timestamp: new Date().toISOString()
      }));
      
      // Add message showing the uploaded image
      addUserMessage(`📸 Uploaded: ${file.name}`, preview);
      addBotMessage(`✅ Image uploaded successfully! You can now create an NFT with this image by typing "create NFT" or "create NFT named [name]".`);
    };
    reader.readAsDataURL(file);
  };

  const clearPendingImage = () => {
    setPendingImage(null);
    sessionStorage.removeItem('pendingImage');
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    if (!activeAddress) {
      addBotMessage('⚠️ Please connect your wallet first to use Algo Intent.');
      return;
    }

    const userInput = content.trim();
    
    // Clear input after sending
    setInputValue("");
    
    // Note: Image is already shown when uploaded via handleFileSelect
    // Don't add it again here to avoid duplicates
    
    addUserMessage(userInput);
    setIsProcessing(true);

    try {
      // Parse intent using AI
      const parsedIntent = await aiIntentService.parseIntent(userInput);
      
      if (!parsedIntent) {
        addBotMessage('❌ Sorry, I couldn\'t understand your request. Please try rephrasing it.');
        return;
      }

      // Handle different intents
      await handleIntent(parsedIntent, selectedFile || pendingImage?.file || null);
      
    } catch (error) {
      addBotMessage(`❌ Error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

  const handleSelectPrompt = (prompt: string) => {
    setInputValue(prompt);
    // Focus the input field after setting the value
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
        // Move cursor to end of text
        inputElement.setSelectionRange(prompt.length, prompt.length);
      }
    }, 0);
  };

  // Utility to sanitize AI output
  const sanitizeBotText = (text: string) => {
    if (!text) return '';
    // Remove markdown bold/italic (**text**, *text*, __text__, _text_)
    let sanitized = text.replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1');
    // Remove citation brackets like [1], [2], [3], [4]
    sanitized = sanitized.replace(/\[\d+\]/g, '');
    // Remove repeated whitespace
    sanitized = sanitized.replace(/\s{2,}/g, ' ');
    // Trim
    return sanitized.trim();
  };

  // Utility to format error messages in a user-friendly way
  const formatErrorMessage = (error: any, action: string): string => {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    
    // Handle common error patterns and make them user-friendly
    if (errorMessage.includes('rejected') || errorMessage.includes('user has rejected')) {
      return `Transaction cancelled. The transaction was not approved in your wallet.`;
    }
    if (errorMessage.includes('Confirmation Failed') || errorMessage.includes('4100')) {
      return `Transaction cancelled. Please try again when you're ready.`;
    }
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      return `Insufficient balance. Please check your wallet balance and try again.`;
    }
    if (errorMessage.includes('Invalid') && errorMessage.includes('address')) {
      return `Invalid address format. Please check the recipient address and try again.`;
    }
    if (errorMessage.includes('must optin') || errorMessage.includes('opt-in')) {
      return `Recipient must opt-in to receive this asset first.`;
    }
    if (errorMessage.includes('already in ledger')) {
      return `Transaction already completed successfully.`;
    }
    
    // For other errors, provide a clean message
    return `${action} failed. Please try again or check your wallet connection.`;
  };

  const handleIntent = async (intent: ParsedIntent | any, file: File | null) => {
    // Check if this is a multi-intent response
    if (intent.intents && Array.isArray(intent.intents)) {
      // Handle multiple intents - try atomic execution first
      const multiIntent = intent as { intents: ParsedIntent[]; explanation?: string };
      
      if (multiIntent.explanation) {
        addBotMessage(sanitizeBotText(multiIntent.explanation));
      }
      
      // Check if all intents can be executed atomically
      const atomicCompatibleIntents = ['send_algo', 'send_asset', 'opt_in', 'opt_out', 'send_nft'];
      const canExecuteAtomically = multiIntent.intents.every(
        singleIntent => atomicCompatibleIntents.includes(singleIntent.intent)
      );
      
      if (canExecuteAtomically && multiIntent.intents.length > 1) {
        // Execute atomically
        await handleAtomicIntents(multiIntent.intents);
      } else {
        // Execute sequentially (for non-atomic compatible intents or single intent)
        for (const singleIntent of multiIntent.intents) {
          await handleSingleIntent(singleIntent, file);
          // Small delay between actions to ensure proper sequencing
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return;
    }
    
    // Handle single intent
    await handleSingleIntent(intent as ParsedIntent, file);
  };

  const handleAtomicIntents = async (intents: ParsedIntent[]) => {
    if (!activeAddress || !transactionSigner) {
      addBotMessage('❌ Wallet not connected. Please connect your wallet first.');
      return;
    }

    // Build atomic transaction list
    const atomicTransactions: Array<{
      type: 'send_algo' | 'send_asset' | 'opt_in' | 'opt_out' | 'send_nft';
      params: {
        recipient?: string;
        amount?: number;
        assetId?: number;
        assetName?: string;
      };
    }> = [];

    // Build description for the message
    const descriptions: string[] = [];

    for (const intent of intents) {
      const { intent: action, parameters } = intent;

      switch (action) {
        case 'send_algo':
          if (parameters.amount !== undefined && parameters.amount !== null && !isNaN(parameters.amount) && parameters.recipient) {
            const amount = Number(parameters.amount);
            if (!isNaN(amount) && amount > 0) {
              atomicTransactions.push({
                type: 'send_algo',
                params: {
                  recipient: parameters.recipient,
                  amount: amount
                }
              });
              const recipientDisplay = `${parameters.recipient.substring(0, 6)}...${parameters.recipient.substring(parameters.recipient.length - 4)}`;
              descriptions.push(`send ${amount} ALGO to ${recipientDisplay}`);
            }
          }
          break;

        case 'send_asset':
          if (parameters.amount !== undefined && parameters.amount !== null && !isNaN(parameters.amount) && parameters.recipient && parameters.asset_id) {
            const amount = Number(parameters.amount);
            const assetId = typeof parameters.asset_id === 'number' ? parameters.asset_id : parseInt(parameters.asset_id);
            if (!isNaN(amount) && amount > 0 && !isNaN(assetId)) {
              // Map asset names to IDs if needed
              let finalAssetId = assetId;
              let assetName = parameters.asset_name || `Asset ${assetId}`;
              
              // Check if it's a known asset by name - use network-aware asset IDs
              if (parameters.asset_name) {
                const assetNameUpper = parameters.asset_name.toUpperCase();
                // Network-aware asset ID mapping
                if (assetNameUpper === 'USDC') {
                  finalAssetId = network === 'mainnet' ? 31566704 : 10458941; // USDC mainnet: 31566704, testnet: 10458941
                  assetName = 'USDC';
                } else if (assetNameUpper === 'USDT') {
                  // USDT asset IDs (update with actual mainnet ID when known)
                  finalAssetId = network === 'mainnet' ? 312769 : 10458942; // USDT mainnet: 312769, testnet: 10458942 (if exists)
                  assetName = 'USDT';
                }
              }
              
              atomicTransactions.push({
                type: 'send_asset',
                params: {
                  recipient: parameters.recipient,
                  amount: amount,
                  assetId: finalAssetId,
                  assetName: assetName
                }
              });
              const recipientDisplay = `${parameters.recipient.substring(0, 6)}...${parameters.recipient.substring(parameters.recipient.length - 4)}`;
              descriptions.push(`send ${amount} ${assetName} to ${recipientDisplay}`);
            }
          }
          break;

        case 'opt_in':
          if (parameters.asset_id) {
            const assetId = typeof parameters.asset_id === 'number' ? parameters.asset_id : parseInt(parameters.asset_id);
            atomicTransactions.push({
              type: 'opt_in',
              params: {
                assetId: assetId
              }
            });
            descriptions.push(`opt in to asset ${assetId}`);
          }
          break;

        case 'opt_out':
          if (parameters.asset_id) {
            const assetId = typeof parameters.asset_id === 'number' ? parameters.asset_id : parseInt(parameters.asset_id);
            atomicTransactions.push({
              type: 'opt_out',
              params: {
                assetId: assetId
              }
            });
            descriptions.push(`opt out of asset ${assetId}`);
          }
          break;

        case 'send_nft':
          if (parameters.asset_id && parameters.recipient) {
            const assetId = typeof parameters.asset_id === 'number' ? parameters.asset_id : parseInt(parameters.asset_id);
            atomicTransactions.push({
              type: 'send_nft',
              params: {
                recipient: parameters.recipient,
                assetId: assetId
              }
            });
            const recipientDisplay = `${parameters.recipient.substring(0, 6)}...${parameters.recipient.substring(parameters.recipient.length - 4)}`;
            descriptions.push(`send NFT ${assetId} to ${recipientDisplay}`);
          }
          break;
      }
    }

    if (atomicTransactions.length === 0) {
      addBotMessage('❌ No valid atomic transactions to execute.');
      return;
    }

    // Create initial message
    const messageId = addBotMessage(
      `Executing atomic transaction: ${descriptions.join(', ')}`,
      'pending'
    );

    try {
      // Execute atomic transactions
      const result = await transactionService.executeAtomicTransactions(
        activeAddress,
        atomicTransactions,
        transactionSigner
      );

      await updateBalance();

      if (result.status === 'success') {
        updateMessage(messageId, {
          content: result.message,
          status: 'success',
          txid: result.txid
        });
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'Atomic transaction');
        updateMessage(messageId, {
          content: friendlyError,
          status: 'error'
        });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'Atomic transaction');
      updateMessage(messageId, {
        content: friendlyError,
        status: 'error'
      });
    }
  };

  const handleSingleIntent = async (intent: ParsedIntent, file: File | null) => {
    const { intent: action, parameters, context, explanation } = intent;

    // Always show explanation if present (for all actions including price checks)
    if (explanation) {
      addBotMessage(sanitizeBotText(explanation));
      // If the intent is not actionable, return early
      if ([
        'explain_algorand', 'explain_defi', 'explain_nft', 'explain_trading',
        'not_supported', 'general_help', 'unknown', undefined, null
      ].includes(action)) {
        return;
      }
    }

    // Handle price checks - show explanation first, then fetch prices
    if (action === 'check_prices' || action === 'market_info') {
      await handleCheckPrices(parameters);
      return;
    }

    // Handle trading operations
    if (action === 'trade_algo' || action === 'swap_tokens') {
      await handleSwapTokens(parameters);
      return;
    }

    if (action === 'set_limit_order') {
      await handleSetLimitOrder(parameters);
      return;
    }

    if (action === 'set_stop_loss') {
      await handleSetStopLoss(parameters);
      return;
    }

    // Handle existing wallet operations
    switch (action) {
      case 'send_algo':
        await handleSendAlgo(parameters);
        break;
      case 'create_nft':
        await handleCreateNFT(parameters, file);
        break;
      case 'create_nft_with_image':
        await handleCreateNFTWithImage(parameters, file);
        break;
      case 'send_nft':
        await handleSendNFT(parameters);
        break;
      case 'opt_in':
        await handleOptIn(parameters);
        break;
      case 'opt_out':
        await handleOptOut(parameters);
        break;
      case 'balance':
        await handleCheckBalance();
        break;
      default:
        if (explanation) {
          addBotMessage(explanation);
        } else {
          addBotMessage(`❌ I understand you want to ${action}, but this feature is not yet implemented.`);
        }
    }
  };

  // Add all the existing handler functions here (abbreviated for brevity)
  const handleSendAlgo = async (parameters: any) => {
    if (!activeAddress || !algosdk.isValidAddress(activeAddress)) {
      addBotMessage('❌ Your wallet address is not valid. Please reconnect your wallet.');
      return;
    }
    if (!parameters.amount || !parameters.recipient) {
      addBotMessage('❌ Missing amount or recipient address for ALGO transfer.');
      return;
    }
    
    // Format recipient address for display
    const recipientDisplay = `${parameters.recipient.substring(0, 6)}...${parameters.recipient.substring(parameters.recipient.length - 4)}`;
    
    // Create initial message with pending status - format it so transaction details can be parsed
    const messageId = addBotMessage(`Sending ${parameters.amount} ALGO to ${recipientDisplay}`, 'pending');
    
    try {
      const result = await transactionService.sendAlgo(
        activeAddress,
        parameters.recipient,
        parameters.amount,
        transactionSigner!
      );
      await updateBalance();
      if (result.status === 'success') {
        // Update same message with success status - format for transaction details parsing
        updateMessage(messageId, {
          content: `Transaction successful! ${parameters.amount} ALGO sent to ${recipientDisplay}`,
          status: 'success',
          txid: result.txid
        });
      } else {
        // Update same message with user-friendly error status
        const friendlyError = formatErrorMessage(result.error || result.message, 'Transaction');
        updateMessage(messageId, {
          content: friendlyError,
          status: 'error'
        });
      }
    } catch (error) {
      // Update same message with user-friendly error status
      const friendlyError = formatErrorMessage(error, 'Transaction');
      updateMessage(messageId, {
        content: friendlyError,
        status: 'error'
      });
    }
  };

  const handleCreateNFT = async (parameters: any, file: File | null) => {
    if (!parameters.name) {
      addBotMessage('❌ NFT name is required.');
      return;
    }
    const supply = parameters.supply && parameters.supply > 0 ? parameters.supply : 1;
    const supplyText = supply > 1 ? `${supply} NFTs` : 'NFT';
    const messageId = addBotMessage(`Creating ${supplyText} "${parameters.name}"...`, 'pending');
    try {
      let ipfsUrl = '';
      if (file) {
        const uploadResult = await ipfsService.uploadToIPFS(file);
        if (uploadResult.success) {
          ipfsUrl = uploadResult.ipfsUrl!;
          // Update message with IPFS info
          updateMessage(messageId, { content: `Creating ${supplyText} "${parameters.name}"...\n📤 File uploaded to IPFS: ${uploadResult.ipfsHash}` });
        } else {
          // Update message with upload failure
          updateMessage(messageId, { content: `Creating ${supplyText} "${parameters.name}"...\n⚠️ File upload failed: ${uploadResult.error}. Creating NFT without media.` });
        }
      }
      const metadata: NFTMetadata = {
        name: parameters.name,
        unitName: generateUnitName(parameters.name),
        totalSupply: supply,
        description: parameters.description || '',
        url: ipfsUrl
      };
      const result = await transactionService.createNFT(
        activeAddress!,
        metadata,
        transactionSigner!
      );
      await updateBalance();
      if (result.status === 'success') {
        updateMessage(messageId, { content: result.message, status: 'success', txid: result.txid });
        clearPendingImage();
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'NFT creation');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'NFT creation');
      updateMessage(messageId, { content: friendlyError, status: 'error' });
    }
  };

  const handleCreateNFTWithImage = async (parameters: any, file: File | null) => {
    if (!file) {
      addBotMessage('❌ No image found. Please upload an image first.');
      return;
    }

    const nftName = parameters.name || `NFT_${Date.now()}`;
    const supply = parameters.supply && parameters.supply > 0 ? parameters.supply : 1;
    const supplyText = supply > 1 ? `${supply} NFTs` : 'NFT';
    const messageId = addBotMessage(`Creating ${supplyText} "${nftName}" with uploaded image...`, 'pending');
    
    try {
      const uploadResult = await ipfsService.uploadToIPFS(file);
      if (!uploadResult.success) {
        const friendlyError = formatErrorMessage(uploadResult.error, 'Image upload');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
        return;
      }

      // Update message with IPFS info
      updateMessage(messageId, { content: `Creating ${supplyText} "${nftName}" with uploaded image...\n📤 Image uploaded to IPFS: ${uploadResult.ipfsHash}` });

      const metadata: NFTMetadata = {
        name: nftName,
        unitName: generateUnitName(nftName),
        totalSupply: supply,
        description: parameters.description || `NFT created with uploaded image`,
        url: uploadResult.ipfsUrl!
      };

      const result = await transactionService.createNFT(
        activeAddress!,
        metadata,
        transactionSigner!
      );

      await updateBalance();
      
      if (result.status === 'success') {
        updateMessage(messageId, { content: result.message, status: 'success', txid: result.txid });
        clearPendingImage();
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'NFT creation');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'NFT creation');
      updateMessage(messageId, { content: friendlyError, status: 'error' });
    }
  };

  const handleSendNFT = async (parameters: any) => {
    if (!parameters.asset_id || !parameters.recipient) {
      addBotMessage('❌ Missing asset ID or recipient address for NFT transfer.');
      return;
    }

    const messageId = addBotMessage(`Sending NFT ${parameters.asset_id} to ${parameters.recipient.substring(0, 6)}...${parameters.recipient.substring(parameters.recipient.length - 4)}`, 'pending');

    try {
      const result = await transactionService.sendNFT(
        activeAddress!,
        parameters.asset_id,
        parameters.recipient,
        transactionSigner!
      );

      await updateBalance();
      if (result.status === 'success') {
        updateMessage(messageId, { content: result.message, status: 'success', txid: result.txid });
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'NFT transfer');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'NFT transfer');
      updateMessage(messageId, { content: friendlyError, status: 'error' });
    }
  };

  const handleOptIn = async (parameters: any) => {
    if (!parameters.asset_id) {
      addBotMessage('❌ Missing asset ID for opt-in.');
      return;
    }

    const messageId = addBotMessage(`Opting in to asset ${parameters.asset_id}...`, 'pending');

    try {
      const result = await transactionService.optInToAsset(
        activeAddress!,
        parameters.asset_id,
        transactionSigner!
      );

      await updateBalance();
      if (result.status === 'success') {
        updateMessage(messageId, { content: result.message, status: 'success', txid: result.txid });
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'Opt-in');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'Opt-in');
      updateMessage(messageId, { content: friendlyError, status: 'error' });
    }
  };

  const handleOptOut = async (parameters: any) => {
    if (!parameters.asset_id) {
      addBotMessage('❌ Missing asset ID for opt-out.');
      return;
    }

    const messageId = addBotMessage(`Opting out of asset ${parameters.asset_id}...`, 'pending');

    try {
      const result = await transactionService.optOutOfAsset(
        activeAddress!,
        parameters.asset_id,
        transactionSigner!
      );

      await updateBalance();
      if (result.status === 'success') {
        updateMessage(messageId, { content: result.message, status: 'success', txid: result.txid });
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'Opt-out');
        updateMessage(messageId, { content: friendlyError, status: 'error' });
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'Opt-out');
      updateMessage(messageId, { content: friendlyError, status: 'error' });
    }
  };

  const handleCheckBalance = async () => {
    // Format address as "NLZWGP...GZTI"
    const addressDisplay = activeAddress ? `${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}` : 'your address';
    
    // Create initial message with pending status
    const messageId = addBotMessage(`Checking balance for ${addressDisplay}`, 'pending');
    try {
      const balance = await transactionService.getAccountBalance(activeAddress!);
      setAccountInfo(balance);
      // Update same message with success status - keep checking message text, balance info goes to details section
      // Format so parser can extract balance info for details section
      updateMessage(messageId, {
        content: `Checking balance for ${addressDisplay}. Balance: ${balance.algo.toFixed(6)} ALGO Assets: ${balance.assets.length}`,
        status: 'success'
      });
    } catch (error) {
      // Update same message with error status
      const friendlyError = formatErrorMessage(error, 'Balance check');
      updateMessage(messageId, {
        content: friendlyError,
        status: 'error'
      });
    }
  };

  const updateBalance = async () => {
    if (activeAddress) {
      try {
        const info = await transactionService.getAccountBalance(activeAddress);
        setAccountInfo(info);
      } catch (error) {
        // Silently fail - balance will be fetched on next transaction
      }
    }
  };

  const addWidgetMessage = (params: { fromAsset?: string; toAsset?: string; amount?: number }) => {
    const newMessage: Message = {
      id: generateMessageId(),
      role: "assistant",
      content: '',
      widgetParams: params,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };

  const handleSwapTokens = async (parameters: any) => {
    if (!parameters.from_asset || !parameters.to_asset || !parameters.amount) {
      addBotMessage('❌ Missing required parameters for swap. Please specify from_asset, to_asset, and amount.');
      return;
    }

    if (!activeAddress) {
      addBotMessage('❌ Please connect your wallet first to perform swaps.');
      return;
    }

    // Create a message with both content and widget
    const messageId = addMessage('assistant', `Opening swap widget for ${parameters.amount} ${parameters.from_asset} → ${parameters.to_asset}...`, undefined, undefined, undefined, undefined, {
      fromAsset: parameters.from_asset,
      toAsset: parameters.to_asset,
      amount: parameters.amount,
    });
  };

  const handleSetLimitOrder = async (parameters: any) => {
    if (!parameters.from_asset || !parameters.to_asset || !parameters.amount || !parameters.trigger_price) {
      addBotMessage('❌ Missing required parameters for limit order. Please specify from_asset, to_asset, amount, and trigger_price.');
      return;
    }

    const orderType = parameters.trade_type === 'buy' ? 'buy' : 'sell';
    addBotMessage(`🔄 Setting limit order: ${orderType.toUpperCase()} ${parameters.amount} ${parameters.from_asset} at $${parameters.trigger_price}...`, 'pending');
    
    try {
      const result = await tradingServiceInstance.setLimitOrder(
        parameters.from_asset,
        parameters.to_asset,
        parameters.amount,
        parameters.trigger_price,
        orderType,
        transactionSigner!,
        activeAddress!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'Limit order');
        addBotMessage(friendlyError, 'error');
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'Limit order');
      addBotMessage(friendlyError, 'error');
    }
  };

  const handleSetStopLoss = async (parameters: any) => {
    if (!parameters.asset || !parameters.amount || !parameters.trigger_price) {
      addBotMessage('❌ Missing required parameters for stop-loss. Please specify asset, amount, and trigger_price.');
      return;
    }

    addBotMessage(`🔄 Setting stop-loss: Sell ${parameters.amount} ${parameters.asset} when price drops to $${parameters.trigger_price}...`, 'pending');
    
    try {
      const result = await tradingServiceInstance.setStopLoss(
        parameters.asset,
        parameters.amount,
        parameters.trigger_price,
        transactionSigner!,
        activeAddress!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
      } else {
        const friendlyError = formatErrorMessage(result.error || result.message, 'Stop-loss');
        addBotMessage(friendlyError, 'error');
      }
    } catch (error) {
      const friendlyError = formatErrorMessage(error, 'Stop-loss');
      addBotMessage(friendlyError, 'error');
    }
  };

  const handleCheckPrices = async (parameters: any) => {
    const assets = parameters.asset ? [parameters.asset] : ['algorand', 'bitcoin', 'ethereum'];
    const assetNames = assets.map(a => a === 'algorand' ? 'ALGO' : a.toUpperCase()).join(', ');
    
    // Create a single message that will be updated - format for transaction details parsing
    const messageId = addBotMessage(`Fetching current prices for ${assetNames}...`, 'pending');
    
    try {
      const prices = await tradingServiceInstance.getPrices(assets);
      
      if (prices.length > 0) {
        // Format message to include price information that can be parsed for transaction details
        // Format: "Current Market Prices: ALGO: $0.1852 +2.94% Last updated: 10:33:55 PM"
        let priceMessage = `Current Market Prices: `;
        prices.forEach((price, index) => {
          const changeColor = price.change24h >= 0 ? '🟢' : '🔴';
          const changeSign = price.change24h >= 0 ? '+' : '';
          priceMessage += `${price.symbol}: $${price.price.toFixed(4)} ${changeColor}${changeSign}${price.change24h.toFixed(2)}%`;
          if (index < prices.length - 1) priceMessage += ', ';
        });
        priceMessage += ` Last updated: ${new Date().toLocaleTimeString()}`;
        
        // Update the same message with success status
        updateMessage(messageId, {
          content: priceMessage,
          status: 'success'
        });
      } else {
        // Update the same message with error status
        updateMessage(messageId, {
          content: 'Unable to fetch current prices. Please try again later.',
          status: 'error'
        });
      }
    } catch (error) {
      // Update the same message with error status
      const friendlyError = formatErrorMessage(error, 'Price fetch');
      updateMessage(messageId, {
        content: friendlyError,
        status: 'error'
      });
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header (sticky) */}
      <header className="sticky top-0 z-[300] w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-semibold text-lg">Algo Intent</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location.pathname === link.to
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <NetworkToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <WalletConnectButton />
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full md:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-border animate-in slide-in-from-top-4 duration-200">
              <div className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      location.pathname === link.to
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setTheme(theme === "dark" ? "light" : "dark");
                    setIsMenuOpen(false);
                  }}
                  className="rounded-full w-full justify-start"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-5 w-5 mr-2" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5 mr-2" />
                      Dark Mode
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mainnet Warning Banner */}
      <MainnetWarning />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Content (pad bottom so floating bars don't cover content) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-[340px] sm:pb-[360px]">
          {showWelcome ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] max-w-4xl mx-auto w-full py-8 sm:py-12 px-4">
              <OrbVisual />
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-2">
                {greeting}
              </h1>
              <p className="text-lg sm:text-xl text-center mb-6 sm:mb-8 text-foreground/80">
                Can I help you with anything?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground text-center mb-6 max-w-md">
                Describe your Algorand transaction intent in plain English
              </p>
              <QuickActions onSelectPrompt={handleSelectPrompt} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full py-4 sm:py-6">
              {/* Messages */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id || `msg-${index}`}
                    role={message.role}
                    content={message.content}
                    status={message.status}
                    txid={message.txid}
                    imageUrl={message.imageUrl}
                    isPendingImage={message.isPendingImage}
                    widgetParams={message.widgetParams}
                    onSwapCompleted={(data: any) => {
                      // Update the same message with success status and format like transaction details
                      if (message.id && message.widgetParams) {
                        const fromAmount = message.widgetParams.amount || 0;
                        const fromAsset = message.widgetParams.fromAsset || 'ALGO';
                        const toAsset = message.widgetParams.toAsset || 'USDC';
                        // Get toAmount from swap result, quote, or calculate from result data
                        const toAmount = data.toAmount || data.quote?.toAmount || (data.result?.toAmount ? parseFloat(data.result.toAmount) : null);
                        // Format fee properly - could be number, string, or object
                        let feeStr = '0.001 ALGO';
                        if (data.fee) {
                          feeStr = typeof data.fee === 'string' ? data.fee : `${data.fee} ALGO`;
                        } else if (data.quote?.fee) {
                          feeStr = typeof data.quote.fee === 'string' ? data.quote.fee : `${data.quote.fee} ALGO`;
                        }
                        
                        // Format message like: "Transaction successful! SWAPPED 1 ALGO to USDC"
                        // Fee will be shown in transaction details section, not in main message
                        const messageContent = `Transaction successful! SWAPPED ${fromAmount} ${fromAsset} to ${toAsset}`;
                        
                        updateMessage(message.id, {
                          content: messageContent,
                          status: 'success',
                          txid: data.txid,
                          widgetParams: {
                            // Keep fee for transaction details display, but hide widget
                            fee: feeStr
                          }
                        });
                      }
                      updateBalance();
                    }}
                    onSwapFailed={(data: any) => {
                      // Update the same message with error status
                      if (message.id) {
                        const friendlyError = formatErrorMessage(data.error || 'Unknown error', 'Swap');
                        updateMessage(message.id, {
                          content: friendlyError,
                          status: 'error',
                          widgetParams: undefined // Hide widget after error
                        });
                      }
                    }}
                  />
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending Image Indicator */}
              {pendingImage && (
                <div className="mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img 
                        src={pendingImage.preview} 
                        alt="Pending image"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-green-800 text-sm">
                        📸 Image Ready for NFT Creation
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Type "create NFT" or "create NFT named [name]" to use this image
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearPendingImage}
                      className="text-green-600 hover:text-green-800"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}

              {/* spacer where suggestions used to be */}
              <div className="mb-0" />
            </div>
          )}
        </div>
                {/* Floating Suggestions (fixed) - Only show when chatting, no box container */}
                {!showWelcome && (
                  <div className="fixed left-1/2 bottom-40 sm:bottom-48 md:bottom-56 z-[20] w-full max-w-4xl -translate-x-1/2 px-4 sm:px-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        "Send 10 ALGO to an address",
                        "Check my account balance", 
                        "Create an NFT",
                        "Swap 10 ALGO to USDC",
                      ].map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          className="h-auto py-3 px-2 sm:px-3 text-xs sm:text-sm font-normal hover:bg-muted hover:border-primary/50 transition-all bg-card rounded-md shadow-sm whitespace-normal break-words"
                          onClick={() => handleSelectPrompt(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

        {/* Floating Chat Input (fixed) */}
        <div className="fixed left-1/2 bottom-4 sm:bottom-6 md:bottom-12 z-[10] w-full max-w-4xl -translate-x-1/2 px-4 sm:px-6 pb-2 sm:pb-4">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isProcessing}
            onFileSelect={handleFileSelect}
            placeholder={pendingImage ? "Type 'create NFT' or your message..." : "Type your message here... (e.g., 'send 2 ALGO to K54ZTTHNDB...')"}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1.5 sm:mt-2">
            Algo Intent can make mistakes. Please verify transaction details.
          </p>
          {!activeAddress && (
            <div className="text-center mt-1.5 sm:mt-2">
              <p className="text-[10px] sm:text-xs text-red-500">
                ⚠️ Please connect your wallet to use Algo-Intent
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
