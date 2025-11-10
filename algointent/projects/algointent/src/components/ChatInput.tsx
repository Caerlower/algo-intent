import { Button } from "@/components/ui/button";
import { Send, Plus, Image, Paperclip } from "lucide-react";
import { useState, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  onFileSelect?: (file: File) => void;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const ChatInput = ({ onSendMessage, disabled, onFileSelect, placeholder, value: externalValue, onValueChange }: ChatInputProps) => {
  const [internalInput, setInternalInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use external value if provided, otherwise use internal state
  const input = externalValue !== undefined ? externalValue : internalInput;
  const setInput = onValueChange || setInternalInput;

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      // Clear input - if using external value, onValueChange will handle it
      // Otherwise, clear internal state
      if (externalValue !== undefined && onValueChange) {
        onValueChange("");
      } else {
        setInternalInput("");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset the input value so the same file can be selected again
    // This also allows the onChange event to fire again for subsequent uploads
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-lg p-4">
        {/* Input and send button row */}
        <div className="flex items-center gap-2">
          {/* Plus button with dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-full bg-muted hover:bg-muted/80 shrink-0"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem 
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer"
              >
                <Image className="mr-2 h-4 w-4" />
                <span>Add photos & files</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer"
              >
                <Paperclip className="mr-2 h-4 w-4" />
                <span>Attach file</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder || "Type your message here... (e.g., 'send 2 ALGO to K54ZTTHNDB...')"}
            className="flex-1 border-0 focus-visible:ring-0 text-base sm:text-lg bg-transparent outline-none placeholder:text-muted-foreground"
            disabled={disabled}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            size="icon"
            className="rounded-full bg-primary hover:bg-primary/90 h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Algo Intent AI text */}
        <p className="text-xs text-muted-foreground mt-3">Algo Intent AI</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default ChatInput;
