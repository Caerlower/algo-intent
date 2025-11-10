import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const QuickActions = ({ onSelectPrompt }: QuickActionsProps) => {
  const prompts = [
    "Send 10 ALGO to an address",
    "Check my account balance", 
    "Create an NFT",
    "Swap 10 ALGO to USDC",
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mb-12 px-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            className="h-auto py-3 px-3 sm:px-4 text-xs sm:text-sm font-normal hover:bg-muted hover:border-primary/50 transition-all bg-card rounded-md shadow-sm whitespace-normal break-words"
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
