import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const QuickActions = ({ onSelectPrompt }: QuickActionsProps) => {
  const prompts = [
    "Send 10 ALGO to an address",
    "Check my account balance", 
    "Create an ASA token",
    "Swap tokens",
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-3xl justify-center mb-12">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          className="h-auto py-3 px-4 text-sm font-normal hover:bg-muted hover:border-primary/50 transition-all bg-white rounded-md shadow-sm"
          onClick={() => onSelectPrompt(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;
