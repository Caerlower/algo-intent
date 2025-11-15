import { HttpModule } from "@nestjs/axios"
import { Module } from "@nestjs/common"
import { PhoneWalletController } from "./phone-wallet.controller"
import { PhoneWalletService } from "./phone-wallet.service"
import { VaultModule } from "../vault/vault.module"
import { WalletModule } from "../wallet/wallet.module"
import { ChainModule } from "../chain/chain.module"
import { ConfigModule } from "@nestjs/config"

@Module({
	imports: [HttpModule, VaultModule, WalletModule, ChainModule, ConfigModule.forRoot()],
	controllers: [PhoneWalletController],
	providers: [PhoneWalletService],
	exports: [PhoneWalletService],
})
export class PhoneWalletModule {}

