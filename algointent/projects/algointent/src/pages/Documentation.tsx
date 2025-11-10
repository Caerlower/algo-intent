import { Book, Wallet, Send, DollarSign, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const examples = [
  {
    category: "Basic Transactions",
    icon: Send,
    commands: [
      {
        command: "Send 10 ALGO to [address]",
        description: "Transfer ALGO tokens to any Algorand address",
      },
      {
        command: "Check my balance",
        description: "View your current ALGO and ASA token balances",
      },
      {
        command: "Show my recent transactions",
        description: "Display your transaction history",
      },
    ],
  },
  {
    category: "Token Management",
    icon: DollarSign,
    commands: [
      {
        command: "Create a token called [name] with supply [amount]",
        description: "Create a new Algorand Standard Asset (ASA)",
      },
      {
        command: "Send 100 [token name] to [address]",
        description: "Transfer custom tokens to another wallet",
      },
      {
        command: "Opt in to asset [ID]",
        description: "Enable receiving specific ASA tokens",
      },
    ],
  },
];

export default function Documentation() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Header */}
      <section className="px-4 mb-16">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Book className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Documentation</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Learn how to use Algo Intent effectively with these guides and examples
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-4">
        <div className="container mx-auto max-w-6xl">
          <Tabs defaultValue="getting-started" className="space-y-8">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="getting-started" className="space-y-8">
              <div className="bg-card rounded-2xl p-8 border border-border">
                <h2 className="text-3xl font-bold mb-6">Getting Started</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                      Connect Your Wallet
                    </h3>
                    <p className="text-muted-foreground ml-8">
                      Click the "Connect Wallet" button in the top right corner. Select your preferred Algorand wallet (Pera or Defly) or use social login (Google) to connect. We support both traditional wallets and social login for seamless access.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                      Describe Your Intent
                    </h3>
                    <p className="text-muted-foreground ml-8">
                      Type what you want to do in plain English. For example: "Send 10 ALGO to my friend" or "Check my balance". Our AI will understand your intent and prepare the transaction.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                      Review & Confirm
                    </h3>
                    <p className="text-muted-foreground ml-8">
                      Algo Intent will show you the transaction details for review. Verify the information is correct, then confirm to execute the transaction on the Algorand blockchain.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
                      Track Progress
                    </h3>
                    <p className="text-muted-foreground ml-8">
                      Monitor your transaction status in real-time. Once confirmed on the blockchain, you'll receive a notification with the transaction ID.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-8">
              {examples.map((section, index) => {
                const Icon = section.icon;
                return (
                  <div key={index} className="bg-card rounded-2xl p-8 border border-border">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold">{section.category}</h2>
                    </div>
                    
                    <div className="space-y-4">
                      {section.commands.map((cmd, i) => (
                        <div key={i} className="bg-muted/50 rounded-xl p-4">
                          <code className="text-primary font-mono text-sm block mb-2">
                            "{cmd.command}"
                          </code>
                          <p className="text-sm text-muted-foreground">{cmd.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-8">
              <div className="bg-card rounded-2xl p-8 border border-border">
                <h2 className="text-3xl font-bold mb-6">Advanced Features</h2>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-3">Batch Transactions</h3>
                    <p className="text-muted-foreground mb-4">
                      Send tokens to multiple recipients in a single command:
                    </p>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <code className="text-primary font-mono text-sm">
                        "Send 5 ALGO to Alice, 10 ALGO to Bob, and 3 ALGO to Charlie"
                      </code>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-3">Complex Queries</h3>
                    <p className="text-muted-foreground mb-4">
                      Ask complex questions about your account:
                    </p>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <code className="text-primary font-mono text-sm">
                        "Show me all transactions over 100 ALGO from the last month"
                      </code>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-3">Security Best Practices</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Always verify transaction details before confirming</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Never share your private keys or seed phrase</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Use hardware wallets for large amounts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Enable two-factor authentication when available</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

