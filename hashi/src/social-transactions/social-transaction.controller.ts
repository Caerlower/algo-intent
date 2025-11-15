import { Controller, Post, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { VaultService } from '../vault/vault.service';
import { AlgorandEncoder } from '@algorandfoundation/algo-models';

@Controller('social-transactions')
export class SocialTransactionController {
  constructor(
    private authService: AuthService,
    private vaultService: VaultService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('sign')
  async signTransaction(@Request() req, @Body() body: { transactionData: string }) {
    try {
      if (!body.transactionData) {
        throw new HttpException('Transaction data is required', HttpStatus.BAD_REQUEST);
      }

      const user = req.user;
      const vaultKeyName = user.wallet.vaultKeyName;

      // Convert base64 transaction data to Buffer
      const transactionBuffer = Buffer.from(body.transactionData, 'base64');

      // Sign the transaction using Vault
      const signature = await this.vaultService.sign(vaultKeyName, transactionBuffer, 'sha2-512');

      return {
        success: true,
        signature: signature.toString(),
        vaultKeyName,
        message: 'Transaction signed successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitTransaction(@Request() req, @Body() body: { signedTransaction: string }) {
    try {
      if (!body.signedTransaction) {
        throw new HttpException('Signed transaction data is required', HttpStatus.BAD_REQUEST);
      }

      const user = req.user;
      
      // Convert base64 signed transaction to Uint8Array
      const signedTransaction = new Uint8Array(Buffer.from(body.signedTransaction, 'base64'));

      // Submit to Algorand network
      const txId = await this.submitToAlgorand(signedTransaction);

      return {
        success: true,
        txId,
        message: 'Transaction submitted successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async submitToAlgorand(signedTransaction: Uint8Array): Promise<string> {
    // This would integrate with the existing wallet service submission logic
    // For now, we'll return a mock transaction ID
    // In a real implementation, you'd use the WalletService.submitTransaction method
    
    const nodeHttpScheme = process.env.NODE_HTTP_SCHEME || 'https';
    const nodeHost = process.env.NODE_HOST || 'testnet-api.algonode.cloud';
    const nodePort = process.env.NODE_PORT || '443';
    const token = process.env.NODE_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    try {
      const response = await fetch(`${nodeHttpScheme}://${nodeHost}:${nodePort}/v2/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-binary',
          'X-Algo-API-Token': token,
        },
        body: signedTransaction,
      });

      if (!response.ok) {
        throw new Error(`Algorand API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.txId;
    } catch (error) {
      throw new Error(`Failed to submit transaction: ${error.message}`);
    }
  }
}
