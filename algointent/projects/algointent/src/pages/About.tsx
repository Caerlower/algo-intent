import { Target, Users, Rocket, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const values = [
  {
    icon: Target,
    title: "Accessibility First",
    description: "We believe blockchain technology should be accessible to everyone, regardless of technical expertise.",
  },
  {
    icon: Users,
    title: "User-Centric Design",
    description: "Every feature is designed with our users in mind, prioritizing simplicity and ease of use.",
  },
  {
    icon: Rocket,
    title: "Innovation",
    description: "We're constantly pushing the boundaries of what's possible with natural language and blockchain.",
  },
  {
    icon: Heart,
    title: "Community Driven",
    description: "Our community's feedback shapes our roadmap and drives continuous improvement.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Hero */}
      <section className="px-4 mb-20">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Making Blockchain
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Accessible to Everyone
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Algo Intent was born from a simple idea: blockchain should be as easy to use as sending a text message.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 mb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-12 border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Our Mission</h2>
            <p className="text-xl text-center max-w-4xl mx-auto leading-relaxed">
              We're on a mission to democratize blockchain technology by eliminating technical barriers.
              With Algo Intent, anyone can interact with the Algorand blockchain using natural language,
              making digital assets accessible to billions of people worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-4 mb-20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold mb-12 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="bg-card rounded-2xl p-8 border border-border hover:border-primary/50 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground text-lg">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="px-4 mb-20">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-card rounded-2xl p-12 border border-border">
            <h2 className="text-3xl font-bold mb-6">The Story Behind Algo Intent</h2>
            <div className="space-y-4 text-lg text-muted-foreground">
              <p>
                In 2024, our team noticed a fundamental problem: while blockchain technology had immense potential,
                it remained inaccessible to most people due to its complexity and technical nature.
              </p>
              <p>
                We asked ourselves: "What if interacting with blockchain was as simple as having a conversation?"
                This question led to the creation of Algo Intent.
              </p>
              <p>
                By combining cutting-edge AI with the Algorand blockchain, we've created a platform where
                anyone can manage digital assets and execute complex transactions
                using nothing but plain English.
              </p>
              <p>
                Today, Algo Intent serves thousands of users worldwide, from blockchain enthusiasts to
                complete beginners, all united by the desire to participate in the future of finance
                without the technical barriers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-primary to-accent rounded-3xl p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Join Us on This Journey
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Be part of the movement to make blockchain accessible to everyone
            </p>
            <Link to="/app">
              <Button size="lg" variant="secondary" className="rounded-full px-8">
                Get Started Today
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

