import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const QuickActions = ({ onSelectPrompt }: QuickActionsProps) => {
  const prompts = [
    "Send 10 ALGO to an address",
    "Check my account balance", 
    "Create an ASA token",
    "Deploy a smart contract",
  ];

  return (
    <div className="flex flex-wrap gap-3 justify-center mb-8">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="secondary"
          className="bg-card hover:bg-muted border border-border shadow-sm transition-all hover:shadow-md hover:scale-105"
          onClick={() => onSelectPrompt(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;
