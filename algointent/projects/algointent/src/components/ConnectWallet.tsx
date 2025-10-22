import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  return (
    <Dialog open={openModal} onOpenChange={closeModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            Select Wallet Provider
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {!activeAddress &&
            wallets?.map((wallet) => (
              <Button
                key={`provider-${wallet.id}`}
                data-test-id={`${wallet.id}-connect`}
                variant="outline"
                className={cn(
                  "flex flex-col items-center justify-center gap-3 h-24 p-4",
                  "hover:bg-primary/5 hover:border-primary/20 transition-all duration-200"
                )}
                onClick={() => {
                  wallet.connect()
                  closeModal()
                }}
              >
                {!isKmd(wallet) && (
                  <img
                    alt={`wallet_icon_${wallet.id}`}
                    src={wallet.metadata.icon}
                    className="w-8 h-8 object-contain"
                  />
                )}
                <span className="text-sm font-medium">
                  {isKmd(wallet) ? 'LocalNet' : wallet.metadata.name}
                </span>
              </Button>
            ))}
        </div>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={closeModal}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ConnectWallet
