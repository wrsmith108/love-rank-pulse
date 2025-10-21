import React from 'react';
import { Header } from '@/components/Header';
import { AuthTest } from '@/components/AuthTest';
import { ProtectedContent } from '@/components/ProtectedRoute';

/**
 * A test page to demonstrate the authentication flow
 */
const AuthTestPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<"session" | "country" | "global">("session");
  const [showMyStats, setShowMyStats] = React.useState(false);
  
  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMyStatsClick={() => setShowMyStats(true)}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Authentication Test</h1>
          
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold mb-4">Public Content</h2>
              <div className="p-6 bg-card rounded-lg border border-border">
                <p>This content is visible to all users, whether they are authenticated or not.</p>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4">Protected Content</h2>
              <ProtectedContent
                fallback={
                  <div className="p-6 bg-card rounded-lg border border-border">
                    <p className="text-muted-foreground">You need to be logged in to view this content.</p>
                    <p className="text-muted-foreground mt-2">Use the login button in the header to authenticate.</p>
                  </div>
                }
              >
                <div className="p-6 bg-card rounded-lg border border-border">
                  <p className="text-success font-medium">You are authenticated!</p>
                  <p className="mt-2">This content is only visible to authenticated users.</p>
                </div>
              </ProtectedContent>
            </div>
          </div>
          
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
            <AuthTest />
          </div>
        </div>
      </main>
      
      <footer className="mt-12 py-6 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Love Rank Pulse - Authentication Test Page
        </div>
      </footer>
    </div>
  );
};

export default AuthTestPage;