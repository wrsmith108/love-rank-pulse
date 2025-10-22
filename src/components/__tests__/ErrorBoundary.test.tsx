/**
 * ErrorBoundary Component Test Suite
 * Tests error catching, fallback UI, and error recovery
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No Error</div>;
};

// Suppress console.error during tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-ERROR-BOUND-001: Catch component errors
  test('TC-ERROR-BOUND-001: should catch errors from child components', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  // TC-ERROR-BOUND-002: Display fallback UI
  test('TC-ERROR-BOUND-002: should display default fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/we encountered an unexpected error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  // TC-ERROR-BOUND-003: Log errors to console/Sentry
  test('TC-ERROR-BOUND-003: should log errors to console', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // TC-ERROR-BOUND-004: Reset error boundary
  test('TC-ERROR-BOUND-004: should reset error state when try again is clicked', async () => {
    const user = userEvent.setup();

    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      return (
        <ErrorBoundary onReset={() => setShouldThrow(false)}>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    await user.click(tryAgainButton);

    // After reset, the error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  // TC-ERROR-BOUND-005: Retry mechanism
  test('TC-ERROR-BOUND-005: should call onReset callback', async () => {
    const user = userEvent.setup();
    const mockOnReset = jest.fn();

    render(
      <ErrorBoundary onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    await user.click(tryAgainButton);

    expect(mockOnReset).toHaveBeenCalled();
  });

  // TC-ERROR-BOUND-006: Error reporting to backend
  test('TC-ERROR-BOUND-006: should render custom fallback if provided', () => {
    const customFallback = <div>Custom Error Message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  test('TC-ERROR-BOUND-007: should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No Error')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  test('TC-ERROR-BOUND-008: should display error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Test error/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  test('TC-ERROR-BOUND-009: should show stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/stack trace/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  test('TC-ERROR-BOUND-010: should display alert icon', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const alertIcon = container.querySelector('.lucide-alert-triangle');
    expect(alertIcon).toBeInTheDocument();
  });
});
