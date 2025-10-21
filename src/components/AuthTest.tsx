import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthModal } from './AuthModal';

/**
 * A test component to demonstrate the authentication flow
 */
export const AuthTest: React.FC = () => {
  const { isAuthenticated, currentUser, logout, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <>
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal} 
      />
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
          <CardDescription>
            Test the authentication flow for Love Rank Pulse
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="p-4 bg-card-elevated rounded-lg border border-border">
                <h3 className="font-medium">Authenticated User</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Username:</span> {currentUser?.username}</p>
                  <p><span className="text-muted-foreground">Email:</span> {currentUser?.email}</p>
                  <p><span className="text-muted-foreground">Country:</span> {currentUser?.countryCode}</p>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  variant="destructive" 
                  onClick={() => logout()}
                >
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
                <p className="text-muted-foreground">You are not authenticated</p>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={() => setShowAuthModal(true)}
                >
                  Login / Register
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="text-xs text-muted-foreground">
          <p>This component demonstrates the authentication flow</p>
        </CardFooter>
      </Card>
    </>
  );
};