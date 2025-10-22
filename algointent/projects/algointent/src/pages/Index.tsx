import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useWallet } from '@txnlab/use-wallet-react';
import { useSnackbar } from 'notistack';
import { aiIntentService, ParsedIntent } from '../services/aiIntentService';
import { TransactionService, NFTMetadata } from '../services/transactionService';
import { tradingService, tinymanSigner } from '../services/tradingService';
import { ipfsService } from '../services/ipfsService';
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import algosdk from 'algosdk';

import OrbVisual from "@/components/OrbVisual";
import QuickActions from "@/components/QuickActions";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WalletConnectButton from "@/components/WalletConnectButton";
import SwapWidget from "@/components/SwapWidget";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun } from "lucide-react";

interface Message {
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
  };
}

interface PendingImage {
  file: File;
  preview: string;
  timestamp: Date;
}

let messageCounter = 0;

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ algo: number; assets: any[] }>({ algo: 0, assets: [] });
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { activeAddress, transactionSigner, signTransactions } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const { theme, setTheme } = useTheme();
  
  const algodConfig = getAlgodConfigFromViteEnvironment();
  const transactionService = new TransactionService(algodConfig);

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
        if (Array.isArray(parsed)) setMessages(parsed);
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
          enqueueSnackbar('Failed to fetch balance', { variant: 'error' });
        }
      }
    };
    fetchBalance();
  }, [activeAddress]);

  const addMessage = (type: 'user' | 'assistant', content: string, status?: 'pending' | 'success' | 'error', txid?: string, imageUrl?: string, isPendingImage?: boolean) => {
    const newMessage: Message = {
      role: type,
      content,
      status,
      txid,
      imageUrl,
      isPendingImage
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addBotMessage = (content: string, status?: 'pending' | 'success' | 'error', txid?: string) => {
    addMessage('assistant', content, status, txid);
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
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' });
      return;
    }

    const userInput = content.trim();
    
    // If there's a selected file, add it as a message first
    if (selectedFile && filePreview) {
      addUserMessage(`📸 Uploaded: ${selectedFile.name}`, filePreview);
    }
    
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
    handleSendMessage(prompt);
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

  const handleIntent = async (intent: ParsedIntent, file: File | null) => {
    const { intent: action, parameters, context, explanation } = intent;

    // Always show explanation if present
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

    if (action === 'check_prices' || action === 'market_info') {
      await handleCheckPrices(parameters);
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
      enqueueSnackbar('Invalid sender address', { variant: 'error' });
      return;
    }
    if (!parameters.amount || !parameters.recipient) {
      addBotMessage('❌ Missing amount or recipient address for ALGO transfer.');
      enqueueSnackbar('Missing amount or recipient address', { variant: 'error' });
      return;
    }
    addBotMessage(`🔄 Sending ${parameters.amount} ALGO to ${parameters.recipient}...`, 'pending');
    enqueueSnackbar('Sending ALGO...', { variant: 'info' });
    try {
      const result = await transactionService.sendAlgo(
        activeAddress,
        parameters.recipient,
        parameters.amount,
        transactionSigner!
      );
      await updateBalance();
      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('Transaction successful!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('Transaction failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to send ALGO: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('Transaction failed', { variant: 'error' });
    }
  };

  const handleCreateNFT = async (parameters: any, file: File | null) => {
    if (!parameters.name) {
      addBotMessage('❌ NFT name is required.');
      enqueueSnackbar('NFT name is required', { variant: 'error' });
      return;
    }
    addBotMessage(`🔄 Creating NFT "${parameters.name}"...`, 'pending');
    enqueueSnackbar('Creating NFT...', { variant: 'info' });
    try {
      let ipfsUrl = '';
      if (file) {
        const uploadResult = await ipfsService.uploadToIPFS(file);
        if (uploadResult.success) {
          ipfsUrl = uploadResult.ipfsUrl!;
          addBotMessage(`📤 File uploaded to IPFS: ${uploadResult.ipfsHash}`);
          enqueueSnackbar('File uploaded to IPFS', { variant: 'success' });
        } else {
          addBotMessage(`⚠️ File upload failed: ${uploadResult.error}. Creating NFT without media.`);
          enqueueSnackbar('File upload failed', { variant: 'warning' });
        }
      }
      const metadata: NFTMetadata = {
        name: parameters.name,
        unitName: generateUnitName(parameters.name),
        totalSupply: parameters.supply || 1,
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
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('NFT created successfully!', { variant: 'success' });
        clearPendingImage();
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('NFT creation failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to create NFT: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('NFT creation failed', { variant: 'error' });
    }
  };

  const handleCreateNFTWithImage = async (parameters: any, file: File | null) => {
    if (!file) {
      addBotMessage('❌ No image found. Please upload an image first.');
      enqueueSnackbar('No image found', { variant: 'error' });
      return;
    }

    const nftName = parameters.name || `NFT_${Date.now()}`;
    addBotMessage(`🔄 Creating NFT "${nftName}" with uploaded image...`, 'pending');
    enqueueSnackbar('Creating NFT with image...', { variant: 'info' });
    
    try {
      const uploadResult = await ipfsService.uploadToIPFS(file);
      if (!uploadResult.success) {
        addBotMessage(`❌ Image upload failed: ${uploadResult.error}`);
        enqueueSnackbar('Image upload failed', { variant: 'error' });
        return;
      }

      addBotMessage(`📤 Image uploaded to IPFS: ${uploadResult.ipfsHash}`);
      enqueueSnackbar('Image uploaded to IPFS', { variant: 'success' });

      const metadata: NFTMetadata = {
        name: nftName,
        unitName: generateUnitName(nftName),
        totalSupply: parameters.supply || 1,
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
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('NFT created successfully!', { variant: 'success' });
        clearPendingImage();
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('NFT creation failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to create NFT: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('NFT creation failed', { variant: 'error' });
    }
  };

  const handleSendNFT = async (parameters: any) => {
    if (!parameters.asset_id || !parameters.recipient) {
      addBotMessage('❌ Missing asset ID or recipient address for NFT transfer.');
      return;
    }

    addBotMessage(`🔄 Sending NFT ${parameters.asset_id} to ${parameters.recipient}...`, 'pending');

    try {
      const result = await transactionService.sendNFT(
        activeAddress!,
        parameters.asset_id,
        parameters.recipient,
        transactionSigner!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('NFT transferred successfully!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('NFT transfer failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to send NFT: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleOptIn = async (parameters: any) => {
    if (!parameters.asset_id) {
      addBotMessage('❌ Missing asset ID for opt-in.');
      return;
    }

    addBotMessage(`🔄 Opting in to asset ${parameters.asset_id}...`, 'pending');

    try {
      const result = await transactionService.optInToAsset(
        activeAddress!,
        parameters.asset_id,
        transactionSigner!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('Opt-in successful!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('Opt-in failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to opt-in: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleOptOut = async (parameters: any) => {
    if (!parameters.asset_id) {
      addBotMessage('❌ Missing asset ID for opt-out.');
      return;
    }

    addBotMessage(`🔄 Opting out of asset ${parameters.asset_id}...`, 'pending');

    try {
      const result = await transactionService.optOutOfAsset(
        activeAddress!,
        parameters.asset_id,
        transactionSigner!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('Opt-out successful!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('Opt-out failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to opt-out: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleCheckBalance = async () => {
    addBotMessage(`🔄 Checking balance for ${activeAddress}...`, 'pending');
    enqueueSnackbar('Checking balance...', { variant: 'info' });
    try {
      const balance = await transactionService.getAccountBalance(activeAddress!);
      setAccountInfo(balance);
      addBotMessage(`💰 Balance: ${balance.algo.toFixed(6)} ALGO\nAssets: ${balance.assets.length}`, 'success');
      enqueueSnackbar('Balance updated', { variant: 'success' });
    } catch (error) {
      addBotMessage(`❌ Failed to check balance: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('Failed to check balance', { variant: 'error' });
    }
  };

  const updateBalance = async () => {
    if (activeAddress) {
      try {
        const info = await transactionService.getAccountBalance(activeAddress);
        setAccountInfo(info);
      } catch (error) {
        enqueueSnackbar('Failed to fetch balance', { variant: 'error' });
      }
    }
  };

  const addWidgetMessage = (params: { fromAsset?: string; toAsset?: string; amount?: number }) => {
    const newMessage: Message = {
      role: "assistant",
      content: '',
      widgetParams: params,
    };
    setMessages((prev) => [...prev, newMessage]);
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

    addBotMessage(`🔄 Opening swap widget for ${parameters.amount} ${parameters.from_asset} → ${parameters.to_asset}...`);
    addWidgetMessage({
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
      const result = await tradingService.setLimitOrder(
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
        enqueueSnackbar('Limit order set successfully!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('Limit order failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Limit order failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('Limit order failed', { variant: 'error' });
    }
  };

  const handleSetStopLoss = async (parameters: any) => {
    if (!parameters.asset || !parameters.amount || !parameters.trigger_price) {
      addBotMessage('❌ Missing required parameters for stop-loss. Please specify asset, amount, and trigger_price.');
      return;
    }

    addBotMessage(`🔄 Setting stop-loss: Sell ${parameters.amount} ${parameters.asset} when price drops to $${parameters.trigger_price}...`, 'pending');
    
    try {
      const result = await tradingService.setStopLoss(
        parameters.asset,
        parameters.amount,
        parameters.trigger_price,
        transactionSigner!,
        activeAddress!
      );

      if (result.status === 'success') {
        addBotMessage(result.message, 'success', result.txid);
        enqueueSnackbar('Stop-loss set successfully!', { variant: 'success' });
      } else {
        addBotMessage(result.message, 'error');
        enqueueSnackbar('Stop-loss failed', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Stop-loss failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('Stop-loss failed', { variant: 'error' });
    }
  };

  const handleCheckPrices = async (parameters: any) => {
    const assets = parameters.asset ? [parameters.asset] : ['algorand', 'bitcoin', 'ethereum'];
    
    addBotMessage(`🔄 Fetching current prices for ${assets.join(', ')}...`, 'pending');
    
    try {
      const prices = await tradingService.getPrices(assets);
      
      if (prices.length > 0) {
        let priceMessage = '📊 Current Market Prices:\n\n';
        prices.forEach(price => {
          const changeColor = price.change24h >= 0 ? '🟢' : '🔴';
          priceMessage += `${price.symbol}: $${price.price.toFixed(4)} ${changeColor}${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%\n`;
        });
        priceMessage += `\nLast updated: ${new Date().toLocaleTimeString()}`;
        
        addBotMessage(priceMessage, 'success');
        enqueueSnackbar('Prices fetched successfully!', { variant: 'success' });
      } else {
        addBotMessage('❌ Unable to fetch current prices. Please try again later.');
        enqueueSnackbar('Failed to fetch prices', { variant: 'error' });
      }
    } catch (error) {
      addBotMessage(`❌ Failed to fetch prices: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      enqueueSnackbar('Failed to fetch prices', { variant: 'error' });
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header (sticky) */}
      <header className="sticky top-0 z-[300] w-full px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-lg">Algo Intent</span>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnectButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Content (pad bottom so floating bars don't cover content) */}
        <div className="flex-1 overflow-y-auto px-6 pb-[340px]">
          {showWelcome ? (
            <div className="flex flex-col items-center justify-center min-h-full max-w-4xl mx-auto w-full py-12">
              <OrbVisual />
              <h1 className="text-4xl font-bold text-center mb-2">
                Good evening
              </h1>
              <p className="text-xl text-center mb-8 text-foreground/80">
                Can I help you with anything?
              </p>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                Describe your Algorand transaction intent in plain English
              </p>
              <QuickActions onSelectPrompt={handleSelectPrompt} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full py-6">
              {/* Messages */}
              <div className="space-y-4 mb-6">
                {messages.map((message, index) => (
                  message.widgetParams ? (
                    <div key={index} className="flex justify-start">
                      <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
                        <SwapWidget
                          fromAsset={message.widgetParams?.fromAsset}
                          toAsset={message.widgetParams?.toAsset}
                          amount={message.widgetParams?.amount}
                          onSwapCompleted={(data: any) => {
                            addBotMessage(`✅ Swap completed successfully! Transaction ID: ${data.txid || 'N/A'}`, 'success', data.txid);
                            enqueueSnackbar('Swap completed successfully!', { variant: 'success' });
                            updateBalance();
                          }}
                          onSwapFailed={(data: any) => {
                            addBotMessage(`❌ Swap failed: ${data.error || 'Unknown error'}`, 'error');
                            enqueueSnackbar('Swap failed', { variant: 'error' });
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <ChatMessage
                      key={index}
                      role={message.role}
                      content={message.content}
                      status={message.status}
                      txid={message.txid}
                      imageUrl={message.imageUrl}
                      isPendingImage={message.isPendingImage}
                    />
                  )
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
        {/* Floating Suggestions (fixed) - Only show when chatting */}
        {!showWelcome && (
          <div className="fixed left-1/2 bottom-40 sm:bottom-44 md:bottom-52 z-[20] w-full max-w-4xl -translate-x-1/2 px-6">
          <div className="bg-card/95 border border-border rounded-2xl px-5 py-3.5 shadow-xl">
            <div className="text-xs text-muted-foreground text-center mb-2 tracking-wide">Quick Actions</div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {[
                "Send 10 ALGO to an address",
                "Check my account balance", 
                "Create an ASA token",
                "Deploy a smart contract",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  size="sm"
                  className="bg-card hover:bg-muted border border-border shadow-sm transition-all hover:shadow-md text-xs px-3 py-1.5 rounded-full"
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Floating Chat Input (fixed) */}
        <div className="fixed left-1/2 bottom-6 sm:bottom-8 md:bottom-12 z-[10] w-full max-w-4xl -translate-x-1/2 px-6 pb-4">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isProcessing}
            onFileSelect={handleFileSelect}
            placeholder={pendingImage ? "Type 'create NFT' or your message..." : "Type your message here... (e.g., 'send 2 ALGO to K54ZTTHNDB...')"}
          />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Algo Intent can make mistakes. Please verify transaction details.
          </p>
          {!activeAddress && (
            <div className="text-center mt-2">
              <p className="text-xs text-red-500">
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
