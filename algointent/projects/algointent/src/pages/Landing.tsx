import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Zap, Shield, Wallet, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Interface",
    description: "Describe transactions in plain English - no technical knowledge required",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Execute Algorand transactions in seconds with our optimized AI engine",
  },
  {
    icon: Shield,
    title: "Secure & Safe",
    description: "Every transaction is verified before execution with enterprise-grade security",
  },
  {
    icon: Wallet,
    title: "Multi-Wallet Support",
    description: "Connect and manage multiple Algorand wallets with ease",
  },
];

const useCases = [
  "Send ALGO to multiple addresses",
  "Check account balances instantly",
  "Create and manage ASA tokens",
  "Swap tokens with simple commands",
  "Track transaction history",
  "Manage NFT collections",
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background -z-10" />
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-8 shadow-lg">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Algorand Transactions
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                In Plain English
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Manage your Algorand wallet with natural language. No technical jargon,
              no complex interfaces - just tell us what you want to do.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://app.algointent.xyz" target="_self">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Link to="/features">
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-full">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          {/* Demo Preview */}
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <div className="bg-card rounded-3xl shadow-2xl border border-border p-8 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 text-left">
                  <p className="text-sm text-muted-foreground mb-1">You</p>
                  <p className="text-foreground">Send 10 ALGO to Alice's wallet</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-4 text-left border border-primary/20">
                  <p className="text-sm text-primary mb-1">Algo Intent</p>
                  <p className="text-foreground">I'll send 10 ALGO to Alice. Let me confirm the details...</p>
                  <div className="mt-3 p-3 bg-background rounded-lg text-sm">
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold">10 ALGO</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">To:</span>
                      <span className="font-mono text-xs">K54ZTT...7S4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee:</span>
                      <span className="font-semibold">0.001 ALGO</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Why Algo Intent?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to make blockchain accessible to everyone
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-card rounded-2xl p-6 border border-border hover:border-primary/50 transition-all hover:shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                What Can You Do?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                From simple transfers to token swaps, Algo Intent handles it all
              </p>
              <div className="space-y-4">
                {useCases.map((useCase, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <span className="text-lg">{useCase}</span>
                  </div>
                ))}
              </div>
              <a href="https://app.algointent.xyz" target="_self">
                <Button size="lg" className="mt-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">
                  Try It Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 border border-primary/20">
              <div className="space-y-4">
                <div className="bg-card rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-mono text-primary">"Check my wallet balance"</p>
                </div>
                <div className="bg-card rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-mono text-primary">"Create a new token called MyToken"</p>
                </div>
                <div className="bg-card rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-mono text-primary">"Send 5 ALGO to Bob"</p>
                </div>
                <div className="bg-card rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-mono text-primary">"Show my recent transactions"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary to-accent text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-10 text-white/90">
            Join thousands of users managing their Algorand assets with natural language
          </p>
          <a href="https://app.algointent.xyz" target="_self">
            <Button size="lg" variant="secondary" className="px-8 py-6 text-lg rounded-full">
              Launch Algo Intent
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}

