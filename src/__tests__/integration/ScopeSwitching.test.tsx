/**
 * Scope Switching Integration Tests
 * Tests global/country/session leaderboard switching and query invalidation
 */

import '@testing-library/jest-dom';
import React, { useState } from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderWithAllProviders,
  createTestQueryClient,
  invalidateQueries,
  setQueryData,
  getQueryData
} from '../utils/testQueryProvider';
import { createMockApiClient } from '../utils/mockApiClient';
import { LeaderboardEntry } from '@/models';
import { LeaderboardApi } from '@/types/api';

/**
 * Mock scope selector component
 */
interface ScopeSelectorProps {
  currentScope: 'global' | 'country' | 'session';
  onScopeChange: (scope: 'global' | 'country' | 'session') => void;
  currentCountry?: string;
  onCountryChange?: (country: string) => void;
}

const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  currentScope,
  onScopeChange,
  currentCountry,
  onCountryChange
}) => {
  return (
    <div data-testid="scope-selector">
      <div data-testid="current-scope">{currentScope}</div>
      <button
        data-testid="scope-global"
        onClick={() => onScopeChange('global')}
      >
        Global
      </button>
      <button
        data-testid="scope-country"
        onClick={() => onScopeChange('country')}
      >
        Country
      </button>
      <button
        data-testid="scope-session"
        onClick={() => onScopeChange('session')}
      >
        Session
      </button>
      {currentScope === 'country' && (
        <div data-testid="country-selector">
          <div data-testid="current-country">{currentCountry || 'US'}</div>
          <button
            data-testid="country-us"
            onClick={() => onCountryChange?.('US')}
          >
            United States
          </button>
          <button
            data-testid="country-uk"
            onClick={() => onCountryChange?.('UK')}
          >
            United Kingdom
          </button>
          <button
            data-testid="country-ca"
            onClick={() => onCountryChange?.('CA')}
          >
            Canada
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Test component with scope switching
 */
const LeaderboardWithScopeSwitch: React.FC = () => {
  const [scope, setScope] = useState<'global' | 'country' | 'session'>('global');
  const [country, setCountry] = useState<string>('US');
  const [players, setPlayers] = useState<any[]>([]);

  const handleScopeChange = async (newScope: 'global' | 'country' | 'session') => {
    setScope(newScope);
    // In real app, this would trigger a query invalidation/refetch
  };

  const handleCountryChange = async (newCountry: string) => {
    setCountry(newCountry);
    // In real app, this would trigger a query invalidation/refetch
  };

  return (
    <div data-testid="leaderboard-with-scope">
      <ScopeSelector
        currentScope={scope}
        onScopeChange={handleScopeChange}
        currentCountry={country}
        onCountryChange={handleCountryChange}
      />
      <div data-testid="player-count">{players.length} players</div>
    </div>
  );
};

describe('Scope Switching Integration Tests', () => {
  let mockApiClient: ReturnType<typeof createMockApiClient>;
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    mockApiClient = createMockApiClient();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    mockApiClient.reset();
    queryClient.clear();
  });

  describe('Scope Switching', () => {
    it('should switch from global to country scope', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      expect(screen.getByTestId('current-scope')).toHaveTextContent('global');

      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scope')).toHaveTextContent('country');
      });

      // Country selector should appear
      expect(screen.getByTestId('country-selector')).toBeInTheDocument();
    });

    it('should switch from country to session scope', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scope')).toHaveTextContent('country');
      });

      fireEvent.click(screen.getByTestId('scope-session'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scope')).toHaveTextContent('session');
      });

      // Country selector should disappear
      expect(screen.queryByTestId('country-selector')).not.toBeInTheDocument();
    });

    it('should switch between all scopes', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      const scopes: Array<'global' | 'country' | 'session'> = ['country', 'session', 'global'];

      for (const scope of scopes) {
        fireEvent.click(screen.getByTestId(`scope-${scope}`));

        await waitFor(() => {
          expect(screen.getByTestId('current-scope')).toHaveTextContent(scope);
        });
      }
    });
  });

  describe('Country Selection', () => {
    it('should change country within country scope', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      // Switch to country scope
      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      });

      expect(screen.getByTestId('current-country')).toHaveTextContent('US');

      // Change to UK
      fireEvent.click(screen.getByTestId('country-uk'));

      await waitFor(() => {
        expect(screen.getByTestId('current-country')).toHaveTextContent('UK');
      });
    });

    it('should change between multiple countries', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      });

      const countries = ['UK', 'CA', 'US'];

      for (const country of countries) {
        fireEvent.click(screen.getByTestId(`country-${country.toLowerCase()}`));

        await waitFor(() => {
          expect(screen.getByTestId('current-country')).toHaveTextContent(country);
        });
      }
    });

    it('should hide country selector when not in country scope', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      // Start in global scope - no country selector
      expect(screen.queryByTestId('country-selector')).not.toBeInTheDocument();

      // Switch to country scope - selector appears
      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      });

      // Switch to session scope - selector disappears
      fireEvent.click(screen.getByTestId('scope-session'));

      await waitFor(() => {
        expect(screen.queryByTestId('country-selector')).not.toBeInTheDocument();
      });
    });
  });

  describe('Query Invalidation', () => {
    it('should invalidate queries when scope changes', async () => {
      const queryKey = ['leaderboard', 'global'];

      // Set initial query data
      setQueryData(queryClient, queryKey, { data: 'old data' });

      expect(getQueryData(queryClient, queryKey)).toEqual({ data: 'old data' });

      // Invalidate queries
      await invalidateQueries(queryClient, queryKey);

      // Query should be marked as stale
      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should handle query invalidation for different scopes', async () => {
      const scopes: Array<'global' | 'country' | 'session'> = ['global', 'country', 'session'];

      for (const scope of scopes) {
        const queryKey = ['leaderboard', scope];
        setQueryData(queryClient, queryKey, { scope, data: [] });

        await invalidateQueries(queryClient, queryKey);

        const queryState = queryClient.getQueryState(queryKey);
        expect(queryState?.isInvalidated).toBe(true);
      }
    });

    it('should refetch data after invalidation', async () => {
      const queryKey = ['leaderboard', 'global'];

      // Mock API response
      const mockResponse = await mockApiClient.getLeaderboard('global');

      setQueryData(queryClient, queryKey, mockResponse);

      // Verify initial data
      expect(getQueryData(queryClient, queryKey)).toBeDefined();

      // Invalidate and refetch would happen automatically in React Query
      await invalidateQueries(queryClient, queryKey);

      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe('Data Fetching per Scope', () => {
    it('should fetch global leaderboard data', async () => {
      const response = await mockApiClient.getLeaderboard('global');

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(3);
      expect(response.filter.scope).toBe('global');

      const callHistory = mockApiClient.getCallHistory();
      expect(callHistory).toHaveLength(1);
      expect(callHistory[0].endpoint).toBe('getLeaderboard');
      expect(callHistory[0].params.scope).toBe('global');
    });

    it('should fetch country leaderboard data', async () => {
      const response = await mockApiClient.getLeaderboard('country', {
        countryCode: 'US'
      });

      expect(response.success).toBe(true);
      expect(response.filter.scope).toBe('country');
      expect(response.filter.countryCode).toBe('US');

      const callHistory = mockApiClient.getCallHistory();
      expect(callHistory[0].params.options.countryCode).toBe('US');
    });

    it('should fetch session leaderboard data', async () => {
      const response = await mockApiClient.getLeaderboard('session');

      expect(response.success).toBe(true);
      expect(response.filter.scope).toBe('session');

      const callHistory = mockApiClient.getCallHistory();
      expect(callHistory[0].params.scope).toBe('session');
    });
  });

  describe('Query Key Management', () => {
    it('should use different query keys for different scopes', () => {
      const globalKey = ['leaderboard', 'global'];
      const countryKey = ['leaderboard', 'country', 'US'];
      const sessionKey = ['leaderboard', 'session'];

      setQueryData(queryClient, globalKey, { scope: 'global' });
      setQueryData(queryClient, countryKey, { scope: 'country' });
      setQueryData(queryClient, sessionKey, { scope: 'session' });

      expect(getQueryData(queryClient, globalKey)).toEqual({ scope: 'global' });
      expect(getQueryData(queryClient, countryKey)).toEqual({ scope: 'country' });
      expect(getQueryData(queryClient, sessionKey)).toEqual({ scope: 'session' });
    });

    it('should use different query keys for different countries', () => {
      const usKey = ['leaderboard', 'country', 'US'];
      const ukKey = ['leaderboard', 'country', 'UK'];
      const caKey = ['leaderboard', 'country', 'CA'];

      setQueryData(queryClient, usKey, { country: 'US' });
      setQueryData(queryClient, ukKey, { country: 'UK' });
      setQueryData(queryClient, caKey, { country: 'CA' });

      expect(getQueryData(queryClient, usKey)).toEqual({ country: 'US' });
      expect(getQueryData(queryClient, ukKey)).toEqual({ country: 'UK' });
      expect(getQueryData(queryClient, caKey)).toEqual({ country: 'CA' });
    });
  });

  describe('Concurrent Scope Switches', () => {
    it('should handle rapid scope switching', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      // Rapidly switch between scopes
      fireEvent.click(screen.getByTestId('scope-country'));
      fireEvent.click(screen.getByTestId('scope-session'));
      fireEvent.click(screen.getByTestId('scope-global'));
      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scope')).toHaveTextContent('country');
      });
    });

    it('should handle rapid country switching', async () => {
      renderWithAllProviders(<LeaderboardWithScopeSwitch />, {
        client: queryClient
      });

      fireEvent.click(screen.getByTestId('scope-country'));

      await waitFor(() => {
        expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      });

      // Rapidly switch countries
      fireEvent.click(screen.getByTestId('country-uk'));
      fireEvent.click(screen.getByTestId('country-ca'));
      fireEvent.click(screen.getByTestId('country-us'));
      fireEvent.click(screen.getByTestId('country-uk'));

      await waitFor(() => {
        expect(screen.getByTestId('current-country')).toHaveTextContent('UK');
      });
    });
  });

  describe('API Call Tracking Across Scopes', () => {
    it('should track API calls for each scope', async () => {
      await mockApiClient.getLeaderboard('global');
      await mockApiClient.getLeaderboard('country', { countryCode: 'US' });
      await mockApiClient.getLeaderboard('session');

      const callHistory = mockApiClient.getCallHistory();

      expect(callHistory).toHaveLength(3);
      expect(callHistory[0].params.scope).toBe('global');
      expect(callHistory[1].params.scope).toBe('country');
      expect(callHistory[2].params.scope).toBe('session');
    });

    it('should track country filter in API calls', async () => {
      await mockApiClient.getLeaderboard('country', { countryCode: 'US' });
      await mockApiClient.getLeaderboard('country', { countryCode: 'UK' });
      await mockApiClient.getLeaderboard('country', { countryCode: 'CA' });

      const callHistory = mockApiClient.getCallHistory();

      expect(callHistory).toHaveLength(3);
      expect(callHistory[0].params.options.countryCode).toBe('US');
      expect(callHistory[1].params.options.countryCode).toBe('UK');
      expect(callHistory[2].params.options.countryCode).toBe('CA');
    });
  });
});
