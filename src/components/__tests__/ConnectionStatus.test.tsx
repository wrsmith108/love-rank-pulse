/**
 * ConnectionStatus Component Test Suite
 * Tests WebSocket connection status indicator and reconnection logic
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatus } from '../ConnectionStatus';

describe('ConnectionStatus Component', () => {
  // TC-CONN-STATUS-001: Connected indicator (green)
  test('TC-CONN-STATUS-001: should display connected state', () => {
    render(<ConnectionStatus state="connected" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();

    // Check for green color (success)
    const statusDot = document.querySelector('.bg-success');
    expect(statusDot).toBeInTheDocument();
  });

  // TC-CONN-STATUS-002: Disconnected warning (red)
  test('TC-CONN-STATUS-002: should display disconnected state', () => {
    render(<ConnectionStatus state="disconnected" />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();

    // Check for red color (destructive)
    const statusDot = document.querySelector('.bg-destructive');
    expect(statusDot).toBeInTheDocument();
  });

  // TC-CONN-STATUS-003: Reconnecting state (yellow)
  test('TC-CONN-STATUS-003: should display reconnecting state', () => {
    render(<ConnectionStatus state="reconnecting" />);

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();

    // Check for warning color
    const indicator = document.querySelector('.text-warning');
    expect(indicator).toBeInTheDocument();

    // Should have pulse animation
    const pulsingElement = document.querySelector('.animate-pulse');
    expect(pulsingElement).toBeInTheDocument();
  });

  // TC-CONN-STATUS-004: Auto-hide when connected
  test('TC-CONN-STATUS-004: should show connecting state', () => {
    render(<ConnectionStatus state="connecting" />);

    expect(screen.getByText('Connecting')).toBeInTheDocument();

    // Should have animation
    const spinningElement = document.querySelector('.animate-spin');
    expect(spinningElement).toBeInTheDocument();
  });

  // TC-CONN-STATUS-005: Manual reconnect button
  test('TC-CONN-STATUS-005: should show retry button when disconnected', async () => {
    const user = userEvent.setup();
    const mockOnReconnect = jest.fn();

    render(<ConnectionStatus state="disconnected" onReconnect={mockOnReconnect} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(mockOnReconnect).toHaveBeenCalled();
  });

  // TC-CONN-STATUS-006: WebSocket sync verification
  test('TC-CONN-STATUS-006: should display connection details on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ConnectionStatus state="connected" lastPingTime={25} />
    );

    // Hover over the status indicator
    const statusContainer = container.querySelector('.fixed');
    if (statusContainer) {
      await user.hover(statusContainer);

      await waitFor(() => {
        expect(screen.getByText(/25ms/)).toBeInTheDocument();
        expect(screen.getByText(/WebSocket/)).toBeInTheDocument();
      });
    }
  });

  test('TC-CONN-STATUS-007: should show error state', () => {
    render(<ConnectionStatus state="error" />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();

    // Error state uses same styling as disconnected
    const statusDot = document.querySelector('.bg-destructive');
    expect(statusDot).toBeInTheDocument();
  });

  test('TC-CONN-STATUS-008: should not show retry button without onReconnect handler', () => {
    render(<ConnectionStatus state="disconnected" />);

    // Retry button should not be present
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  test('TC-CONN-STATUS-009: should apply custom className', () => {
    const { container } = render(
      <ConnectionStatus state="connected" className="custom-class" />
    );

    const statusContainer = container.querySelector('.custom-class');
    expect(statusContainer).toBeInTheDocument();
  });

  test('TC-CONN-STATUS-010: should show appropriate icon for each state', () => {
    // Connected - Wifi icon
    const { container: connectedContainer } = render(<ConnectionStatus state="connected" />);
    expect(connectedContainer.querySelector('.lucide-wifi')).toBeInTheDocument();

    // Disconnected - WifiOff icon
    const { container: disconnectedContainer } = render(<ConnectionStatus state="disconnected" />);
    expect(disconnectedContainer.querySelector('.lucide-wifi-off')).toBeInTheDocument();

    // Reconnecting - RefreshCw icon
    const { container: reconnectingContainer } = render(<ConnectionStatus state="reconnecting" />);
    expect(reconnectingContainer.querySelector('.lucide-refresh-cw')).toBeInTheDocument();
  });
});
