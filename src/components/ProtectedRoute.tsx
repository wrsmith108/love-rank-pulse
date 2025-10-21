import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * A component that protects routes requiring authentication
 * If the user is not authenticated, they will be redirected to the specified path
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/' 
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If not authenticated, redirect to the specified path
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  
  // If authenticated, render the children
  return <>{children}</>;
};

/**
 * A component that conditionally renders content based on authentication state
 */
interface ProtectedContentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedContent: React.FC<ProtectedContentProps> = ({ 
  children, 
  fallback 
}) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }
  
  return <>{children}</>;
};