import { MessageSquare, Zap, Shield, Wallet, Users, Globe, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Processing",
    description: "Our advanced AI understands your intent from plain English commands. No need to learn complex blockchain terminology or syntax.",
    benefits: [
      "Supports conversational language",
      "Context-aware understanding",
      "Multi-language support coming soon",
    ],
  },
  {
    icon: Zap,
    title: "Lightning Fast Execution",
    description: "Optimized for speed without compromising security. Execute transactions in seconds, not minutes.",
    benefits: [
      "Sub-second intent parsing",
      "Instant transaction validation",
      "Real-time status updates",
    ],
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Your security is our top priority. Every transaction is verified and encrypted with industry-leading standards.",
    benefits: [
      "End-to-end encryption",
      "Multi-signature support",
      "Transaction preview before execution",
    ],
  },
  {
    icon: Wallet,
    title: "Multi-Wallet Support",
    description: "Connect any Algorand-compatible wallet seamlessly. Switch between wallets with ease.",
    benefits: [
      "Pera Wallet integration",
      "Defly Wallet compatible",
      "Social login support (Google)",
    ],
  },
  {
    icon: Users,
    title: "Batch Operations",
    description: "Send tokens to multiple recipients or execute multiple actions in a single command.",
    benefits: [
      "Multi-send transactions",
      "Bulk token operations",
      "Optimized fee handling",
    ],
  },
  {
    icon: Globe,
    title: "Cross-Platform",
    description: "Access Algo Intent from any device - desktop, mobile, or tablet. Your experience stays consistent.",
    benefits: [
      "Responsive web interface",
      "Mobile-optimized design",
      "Progressive Web App support",
    ],
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "We support multiple wallet options with different security models. Social login uses Hashi's semi-custodial architecture (non-custodial), while WalletConnect is custodial. Traditional wallets remain fully non-custodial.",
    benefits: [
      "Social login: Semi-custodial (Hashi non-custodial architecture)",
      "Traditional wallets: Fully non-custodial",
      "Complete transparency",
    ],
  },
];

export default function Features() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Header */}
      <section className="px-4 mb-20">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Powerful Features for
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Modern Blockchain
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Everything you need to manage your Algorand assets with the power of natural language
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-card rounded-2xl p-8 border border-border hover:border-primary/50 transition-all hover:shadow-xl"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 ml-[4.5rem]">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 mt-20">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-12 text-center border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Experience the Future of Blockchain
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start using Algo Intent today and see how easy blockchain can be
            </p>
            <Link to="/app">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

