import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { GoogleAuthService, GoogleUser } from '../services/googleAuthService';
import { Loader2, LogOut, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ellipseAddress } from '../utils/ellipseAddress';
import { useSocialWallet } from '../providers/EnhancedWalletProvider';

interface GoogleLoginButtonProps {
  onAuthSuccess?: (user: GoogleUser, wallet: { address: string }) => void;
  onAuthError?: (error: string) => void;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ 
  onAuthSuccess, 
  onAuthError 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [wallet, setWallet] = useState<{ address: string } | null>(null);
  const [googleAuthService] = useState(() => GoogleAuthService.getInstance());
  const { refreshGoogleWalletState } = useSocialWallet();

  useEffect(() => {
    // Check if user is already authenticated
    const currentUser = googleAuthService.getCurrentUser();
    const currentWallet = googleAuthService.getCurrentWallet();
    
    if (currentUser && currentWallet) {
      setUser(currentUser);
      setWallet(currentWallet);
      setIsAuthenticated(true);
    }
  }, [googleAuthService]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    try {
      console.log('Starting Google sign-in...');
      
      // Ensure Google Identity Services is loaded
      await googleAuthService.initializeGoogleAuth();
      
      // Use the service method which handles the OAuth flow
      const result = await googleAuthService.signInWithGoogle();
      
      if (result.success && result.user && result.wallet) {
        setUser(result.user);
        setWallet(result.wallet);
        setIsAuthenticated(true);
        // Refresh the wallet state in the provider
        refreshGoogleWalletState();
        onAuthSuccess?.(result.user, result.wallet);
      } else {
        const errorMessage = result.error || 'Authentication failed';
        onAuthError?.(errorMessage);
        console.error('Google authentication failed:', errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      onAuthError?.(errorMessage);
      console.error('Google sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleAuthService.signOut();
      setUser(null);
      setWallet(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (isAuthenticated && user && wallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {ellipseAddress(wallet.address)}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="px-3 py-2 border-b">
            <p className="text-xs text-muted-foreground">Algorand Address:</p>
            <p className="text-sm font-mono">{wallet.address}</p>
          </div>
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button 
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      {isLoading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
};

export default GoogleLoginButton;
