import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '../../components/Header';
import { renderWithProviders, createMockAuthContext, createMockUnauthContext, createMockLoadingContext } from '../utils/testRender';
import { generatePlayer } from '../utils/testDataGenerators';
import '../types/jest-dom';

// Mock useToast hook
jest.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock useIsMobile hook
jest.mock('../../hooks/use-mobile', () => ({
  useIsMobile: () => false // Default to desktop view
}));

describe('Header Component', () => {
  const mockProps = {
    activeTab: 'global' as const,
    onTabChange: jest.fn(),
    onMyStatsClick: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unauthenticated state', () => {
    test('should render login button when not authenticated', () => {
      renderWithProviders(<Header {...mockProps} />, {}, createMockUnauthContext());
      
      expect(screen.getByText('Love Rank Pulse')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });
    
    test('should open auth modal when login button is clicked', async () => {
      renderWithProviders(<Header {...mockProps} />, {}, createMockUnauthContext());
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      fireEvent.click(loginButton);
      
      // The AuthModal should be present in the DOM
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
    
    test('should handle tab changes', () => {
      const onTabChange = jest.fn();
      renderWithProviders(
        <Header {...mockProps} onTabChange={onTabChange} />,
        {},
        createMockUnauthContext()
      );
      
      const sessionTab = screen.getByRole('button', { name: /view session leaderboard/i });
      fireEvent.click(sessionTab);
      
      expect(onTabChange).toHaveBeenCalledWith('session');
    });
  });
  
  describe('Authenticated state', () => {
    const mockUser = generatePlayer();
    
    test('should render logout button when authenticated', () => {
      renderWithProviders(
        <Header {...mockProps} />,
        {},
        createMockAuthContext(mockUser)
      );
      
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
    
    test('should call logout when logout button is clicked', async () => {
      const mockLogout = jest.fn();
      const authContext = {
        ...createMockAuthContext(mockUser),
        logout: mockLogout
      };
      
      renderWithProviders(<Header {...mockProps} />, {}, authContext);
      
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalled();
    });
    
    test('should handle My Stats button click', () => {
      const onMyStatsClick = jest.fn();
      renderWithProviders(
        <Header {...mockProps} onMyStatsClick={onMyStatsClick} />,
        {},
        createMockAuthContext(mockUser)
      );
      
      const myStatsButton = screen.getByRole('button', { name: /view my statistics/i });
      fireEvent.click(myStatsButton);
      
      expect(onMyStatsClick).toHaveBeenCalled();
    });
  });
  
  describe('Loading state', () => {
    test('should handle loading state', () => {
      renderWithProviders(<Header {...mockProps} />, {}, createMockLoadingContext());
      
      // Should still render the header during loading
      expect(screen.getByText('Love Rank Pulse')).toBeInTheDocument();
    });
  });
  
  describe('Tab navigation', () => {
    test('should highlight active tab', () => {
      renderWithProviders(
        <Header {...mockProps} activeTab="session" />,
        {},
        createMockAuthContext()
      );
      
      const sessionTab = screen.getByRole('button', { name: /view session leaderboard/i });
      expect(sessionTab).toHaveClass('bg-primary');
    });
    
    test('should handle all tab changes', () => {
      const onTabChange = jest.fn();
      renderWithProviders(
        <Header {...mockProps} onTabChange={onTabChange} />,
        {},
        createMockAuthContext()
      );
      
      // Test session tab
      fireEvent.click(screen.getByRole('button', { name: /view session leaderboard/i }));
      expect(onTabChange).toHaveBeenCalledWith('session');
      
      // Test country tab
      fireEvent.click(screen.getByRole('button', { name: /view country leaderboard/i }));
      expect(onTabChange).toHaveBeenCalledWith('country');
      
      // Test global tab
      fireEvent.click(screen.getByRole('button', { name: /view global leaderboard/i }));
      expect(onTabChange).toHaveBeenCalledWith('global');
    });
  });
  
  describe('Responsive design', () => {
    test('should be accessible', () => {
      renderWithProviders(<Header {...mockProps} />, {}, createMockAuthContext());
      
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });
  });
  
  // Performance tests
  describe('Performance', () => {
    test('should render in under 50ms', async () => {
      const start = performance.now();
      
      renderWithProviders(<Header {...mockProps} />, {}, createMockAuthContext());
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50);
    });
    
    test('should handle multiple rapid clicks without performance issues', async () => {
      renderWithProviders(<Header {...mockProps} />, {}, createMockAuthContext());
      
      const myStatsButton = screen.getByRole('button', { name: /view my statistics/i });
      
      const start = performance.now();
      
      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(myStatsButton);
      }
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100);
    });
    
    test('should handle tab switching performance', () => {
      const onTabChange = jest.fn();
      renderWithProviders(
        <Header {...mockProps} onTabChange={onTabChange} />,
        {},
        createMockAuthContext()
      );
      
      const start = performance.now();
      
      // Rapidly switch between tabs
      const tabs = ['session', 'country', 'global'] as const;
      tabs.forEach(tab => {
        const button = screen.getByRole('button', { name: new RegExp(`view ${tab} leaderboard`, 'i') });
        fireEvent.click(button);
      });
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50);
      expect(onTabChange).toHaveBeenCalledTimes(3);
    });
  });
});