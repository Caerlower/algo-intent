import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { VaultService } from '../vault/vault.service';
import { EncoderFactory } from '../chain/encoder.factory';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private vaultService: VaultService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async verifyGoogleToken(token: string) {
    try {
      this.logger.debug('Verifying Google token...');
      
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new Error('Invalid Google token payload');
      }

      const userInfo = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
      };

      this.logger.debug(`Google user verified: ${userInfo.email}`);
      return userInfo;
    } catch (error) {
      this.logger.error('Google token verification failed:', error);
      throw new Error('Invalid Google token');
    }
  }

  async createWalletForUser(googleId: string) {
    try {
      this.logger.debug(`Creating wallet for Google user: ${googleId}`);
      
      const keyName = `google_${googleId}`;
      
      // Generate Ed25519 key in Vault
      const publicKey = await this.vaultService.keyGen(keyName, 'ed25519');
      
      // Convert to Algorand address
      const encoder = EncoderFactory.getEncoder('algorand');
      const address = encoder.encodeAddress(publicKey);
      
      this.logger.debug(`Wallet created for ${googleId}: ${address}`);
      
      return {
        address,
        vaultKeyName: keyName,
        publicKey: publicKey.toString('base64'),
      };
    } catch (error) {
      this.logger.error(`Failed to create wallet for ${googleId}:`, error);
      throw new Error('Failed to create wallet');
    }
  }

  async getUserWallet(googleId: string) {
    try {
      this.logger.debug(`Getting wallet for Google user: ${googleId}`);
      
      const keyName = `google_${googleId}`;
      
      // Try to get existing key from Vault
      // Note: Vault's keyGen will create if it doesn't exist
      const publicKey = await this.vaultService.keyGen(keyName, 'ed25519');
      const encoder = EncoderFactory.getEncoder('algorand');
      const address = encoder.encodeAddress(publicKey);
      
      this.logger.debug(`Wallet retrieved for ${googleId}: ${address}`);
      
      return {
        address,
        vaultKeyName: keyName,
        publicKey: publicKey.toString('base64'),
        exists: true,
      };
    } catch (error) {
      this.logger.error(`Failed to get wallet for ${googleId}:`, error);
      throw new Error('Failed to retrieve wallet');
    }
  }

  generateJwtToken(user: any) {
    try {
      const payload = {
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        sub: user.googleId, // Standard JWT subject
      };
      
      const token = this.jwtService.sign(payload);
      this.logger.debug(`JWT token generated for user: ${user.email}`);
      
      return token;
    } catch (error) {
      this.logger.error('Failed to generate JWT token:', error);
      throw new Error('Failed to generate authentication token');
    }
  }

  async validateUser(payload: any) {
    try {
      this.logger.debug(`Validating user with payload:`, payload);
      
      // Get user's wallet info
      const wallet = await this.getUserWallet(payload.googleId);
      
      return {
        googleId: payload.googleId,
        email: payload.email,
        name: payload.name,
        wallet: wallet,
      };
    } catch (error) {
      this.logger.error('User validation failed:', error);
      throw new Error('User validation failed');
    }
  }
}
