import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  status?: 'pending' | 'success' | 'error';
  txid?: string;
  imageUrl?: string;
  isPendingImage?: boolean;
}

const ChatMessage = ({ role, content, status, txid, imageUrl, isPendingImage }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {role === "assistant" && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="relative w-8 h-8">
            <div 
              className="absolute inset-0 rounded-full opacity-90 animate-pulse-glow"
              style={{
                background: 'var(--gradient-orb)',
              }}
            />
            <div 
              className="absolute inset-1 rounded-full bg-white/30 backdrop-blur-sm"
            />
          </div>
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        
        {/* Display image if present */}
        {imageUrl && (
          <div className="mt-2 rounded-lg overflow-hidden">
            <img 
              src={imageUrl} 
              alt="Uploaded content"
              className="max-w-full max-h-48 rounded-lg object-cover"
            />
          </div>
        )}
        
        {status && (
          <div className={cn("mt-2 text-xs opacity-80", {
            "text-yellow-600": status === 'pending',
            "text-green-600": status === 'success',
            "text-red-600": status === 'error'
          })}>
            {status === 'pending' && '⏳ Processing...'}
            {status === 'success' && '✅ Success'}
            {status === 'error' && '❌ Failed'}
          </div>
        )}
        
        {txid && (
          <div className="mt-1 text-xs opacity-70">
            TxID: <a 
              href={`https://testnet.explorer.perawallet.app/tx/${txid}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 underline"
            >
              {txid.substring(0, 8)}...
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
