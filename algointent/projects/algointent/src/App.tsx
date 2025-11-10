import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import Documentation from "./pages/Documentation";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import { SocialWalletProvider } from './providers/EnhancedWalletProvider'

const queryClient = new QueryClient();

let supportedWallets: SupportedWallet[]
  supportedWallets = [
    { id: WalletId.DEFLY },
    { id: WalletId.PERA },
    { id: WalletId.EXODUS },
    // If you are interested in WalletConnect v2 provider
    // refer to https://github.com/TxnLab/use-wallet for detailed integration instructions
  ]

function Layout() {
  const location = useLocation();
  const isAppRoute = location.pathname === "/app";

  return (
    <>
      {!isAppRoute && <Navbar />}
      
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/about" element={<About />} />
        <Route path="/app" element={<Index />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {!isAppRoute && <Footer />}
    </>
  );
}

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()

  const walletManager = new WalletManager({
    wallets: supportedWallets,
    defaultNetwork: algodConfig.network,
    networks: {
      [algodConfig.network]: {
        algod: {
          baseServer: algodConfig.server,
          port: algodConfig.port,
          token: String(algodConfig.token),
        },
      },
    },
    options: {
      resetNetwork: true,
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <WalletProvider manager={walletManager}>
            <SocialWalletProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Layout />
              </BrowserRouter>
            </SocialWalletProvider>
          </WalletProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
