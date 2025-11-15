import { Module } from '@nestjs/common';
import { SocialTransactionController } from './social-transaction.controller';
import { AuthModule } from '../auth/auth.module';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [AuthModule, VaultModule],
  controllers: [SocialTransactionController],
})
export class SocialTransactionModule {}
