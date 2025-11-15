import { Controller, Post, Body, Get, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('google')
  async googleAuth(@Body() body: { token: string }) {
    try {
      if (!body.token) {
        throw new HttpException('Google token is required', HttpStatus.BAD_REQUEST);
      }

      // Verify Google token
      const user = await this.authService.verifyGoogleToken(body.token);
      
      // Get or create wallet for user
      const wallet = await this.authService.getUserWallet(user.googleId);
      
      // Generate JWT token
      const jwtToken = this.authService.generateJwtToken(user);
      
      return {
        success: true,
        user: {
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
          emailVerified: user.emailVerified,
        },
        wallet: {
          address: wallet.address,
          vaultKeyName: wallet.vaultKeyName,
          publicKey: wallet.publicKey,
        },
        jwtToken,
        message: 'Authentication successful',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          message: 'Authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return {
      success: true,
      user: {
        googleId: req.user.googleId,
        email: req.user.email,
        name: req.user.name,
        wallet: req.user.wallet,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  async getWallet(@Request() req) {
    try {
      const wallet = await this.authService.getUserWallet(req.user.googleId);
      return {
        success: true,
        wallet: {
          address: wallet.address,
          vaultKeyName: wallet.vaultKeyName,
          publicKey: wallet.publicKey,
        },
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
  @Post('refresh-wallet')
  async refreshWallet(@Request() req) {
    try {
      // This would recreate the wallet if needed
      const wallet = await this.authService.getUserWallet(req.user.googleId);
      return {
        success: true,
        wallet: {
          address: wallet.address,
          vaultKeyName: wallet.vaultKeyName,
          publicKey: wallet.publicKey,
        },
        message: 'Wallet refreshed successfully',
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
}
