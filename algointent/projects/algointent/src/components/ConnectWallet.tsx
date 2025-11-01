import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GoogleAuthService } from '../services/googleAuthService'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useSocialWallet } from '../providers/EnhancedWalletProvider'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()
  const { refreshGoogleWalletState } = useSocialWallet()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [googleAuthService] = useState(() => GoogleAuthService.getInstance())

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await googleAuthService.initializeGoogleAuth()
      const result = await googleAuthService.signInWithGoogle()
      if (result.success) {
        refreshGoogleWalletState()
        closeModal()
      } else {
        console.error('Google authentication failed:', result.error)
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
    } finally {
      setIsGoogleLoading(false)
    }
  }


  return (
    <Dialog open={openModal} onOpenChange={closeModal}>
      <DialogContent className="sm:max-w-sm max-w-[90vw] [&>button]:hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-center text-base font-bold">
            Select Wallet Provider
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {/* Google Login Option */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Sign in with Google to create a new Algorand wallet
            </p>
            <div className="flex justify-center">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                variant="outline"
                className="border-primary/50 bg-primary/5 hover:bg-primary/10 text-foreground h-10 px-4 text-sm"
              >
                <div className="flex items-center gap-2">
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  <span className="text-sm font-medium">
                    {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
                  </span>
                </div>
              </Button>
            </div>
          </div>

          {/* Separator */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground px-2">or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Traditional Wallet Options */}
          <div className="text-center mb-1">
            <p className="text-xs text-muted-foreground font-medium">
              Connect an existing wallet
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            {!activeAddress &&
              wallets?.filter(wallet => !isKmd(wallet)).map((wallet) => (
                <button
                  key={`provider-${wallet.id}`}
                  data-test-id={`${wallet.id}-connect`}
                  onClick={() => {
                    wallet.connect()
                    closeModal()
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3",
                    "bg-card hover:bg-muted/50 border border-border rounded-xl",
                    "transition-all duration-200 cursor-pointer",
                    "hover:border-primary/50 hover:shadow-sm"
                  )}
                >
                  {wallet.metadata.icon && (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={wallet.metadata.icon}
                        alt={`${wallet.metadata.name} logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <span className="text-xs font-medium text-foreground">
                    {wallet.metadata.name}
                  </span>
                </button>
              ))}
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <Button
            onClick={closeModal}
            variant="outline"
            className="w-full bg-muted/50 hover:bg-muted border border-border text-foreground h-9 text-sm"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ConnectWallet
