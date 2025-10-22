/// <reference types="cypress" />

describe('Real-time Leaderboard Updates', () => {
  beforeEach(() => {
    // Mock initial leaderboard data
    cy.intercept('GET', '**/api/leaderboard/session*', {
      fixture: 'leaderboard-session.json'
    }).as('initialLeaderboard');

    cy.visit('/');
    cy.wait('@initialLeaderboard');
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection on page load', () => {
      // Verify connection status indicator
      cy.get('[data-testid="connection-status"]').should('be.visible');
      cy.get('[data-testid="connection-status"]').should('have.class', 'connected');
    });

    it('should display connected status with green indicator', () => {
      cy.get('[data-testid="connection-indicator"]').should('have.class', 'bg-success');
      cy.contains('Connected').should('be.visible');
    });

    it('should show reconnecting status when connection is lost', () => {
      // Simulate connection loss
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'));
      });

      // Verify reconnecting status
      cy.get('[data-testid="connection-status"]').should('have.class', 'reconnecting');
      cy.get('[data-testid="connection-indicator"]').should('have.class', 'bg-warning');
      cy.contains('Reconnecting').should('be.visible');
    });

    it('should show disconnected status with error indicator', () => {
      // Simulate disconnection
      cy.window().then((win) => {
        const event = new CustomEvent('websocket-error', {
          detail: { error: 'Connection failed' }
        });
        win.dispatchEvent(event);
      });

      // Verify disconnected status
      cy.get('[data-testid="connection-status"]').should('have.class', 'disconnected');
      cy.get('[data-testid="connection-indicator"]').should('have.class', 'bg-destructive');
      cy.contains('Disconnected').should('be.visible');
    });

    it('should auto-reconnect after connection loss', () => {
      // Simulate connection loss
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'));
      });

      // Wait for reconnecting state
      cy.get('[data-testid="connection-status"]').should('have.class', 'reconnecting');

      // Simulate reconnection
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'));
      });

      // Verify reconnected status
      cy.get('[data-testid="connection-status"]').should('have.class', 'connected');
    });
  });

  describe('Live Updates', () => {
    it('should display live indicator when updates are enabled', () => {
      cy.get('[data-testid="live-indicator"]').should('be.visible');
      cy.get('[data-testid="live-indicator"]').should('contain', 'Live');
    });

    it('should receive and display new player data', () => {
      // Simulate WebSocket message with new player
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'player-added',
            data: {
              player_id: 'new-player',
              player_name: 'NewPlayer',
              country_code: 'FR',
              kills: 50,
              deaths: 10,
              kd_ratio: 5.0,
              is_win: true,
              rank: 1
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify new player appears in leaderboard
      cy.contains('NewPlayer').should('be.visible');
      cy.contains('5.0').should('be.visible');
    });

    it('should update existing player stats in real-time', () => {
      // Simulate WebSocket message with updated stats
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'player-updated',
            data: {
              player_id: 'player-1',
              player_name: 'ProGamer123',
              country_code: 'US',
              kills: 55, // Updated from 45
              deaths: 12,
              kd_ratio: 4.58, // Updated from 3.75
              is_win: true,
              rank: 1
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify updated stats
      cy.get('[data-testid="leaderboard-row"]').first().within(() => {
        cy.contains('55').should('be.visible');
        cy.contains('4.58').should('be.visible');
      });
    });

    it('should animate rank changes', () => {
      // Simulate player moving up in rank
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'rank-changed',
            data: {
              player_id: 'player-3',
              old_rank: 3,
              new_rank: 1
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify rank change animation
      cy.get('[data-testid="rank-change-animation"]').should('be.visible');
      cy.get('[data-testid="rank-up-indicator"]').should('be.visible');
    });

    it('should remove players who leave the session', () => {
      // Verify player exists initially
      cy.contains('TacticalNinja').should('be.visible');

      // Simulate player removal
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'player-removed',
            data: {
              player_id: 'player-3'
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify player is removed
      cy.contains('TacticalNinja').should('not.exist');
    });

    it('should batch multiple updates efficiently', () => {
      // Simulate multiple rapid updates
      cy.window().then((win) => {
        for (let i = 0; i < 5; i++) {
          const event = new CustomEvent('leaderboard-update', {
            detail: {
              type: 'player-updated',
              data: {
                player_id: 'player-1',
                kills: 45 + i,
                kd_ratio: 3.75 + (i * 0.1)
              }
            }
          });
          win.dispatchEvent(event);
        }
      });

      // Verify only final state is displayed (batching worked)
      cy.get('[data-testid="leaderboard-row"]').first().within(() => {
        cy.contains('49').should('be.visible'); // 45 + 4
      });
    });
  });

  describe('Update Notifications', () => {
    it('should show notification for new top player', () => {
      // Simulate new #1 player
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'new-leader',
            data: {
              player_name: 'NewChampion',
              old_leader: 'ProGamer123'
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify notification
      cy.get('[data-testid="update-notification"]').should('be.visible');
      cy.contains('NewChampion is now #1').should('be.visible');
    });

    it('should show notification for personal rank change', () => {
      // Set current user
      cy.window().then((win) => {
        win.localStorage.setItem('current-player-id', 'player-2');
      });

      // Simulate rank change for current user
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'your-rank-changed',
            data: {
              player_id: 'player-2',
              old_rank: 2,
              new_rank: 1
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify personal notification
      cy.get('[data-testid="personal-notification"]').should('be.visible');
      cy.contains('You moved to rank #1').should('be.visible');
    });

    it('should auto-dismiss notifications after timeout', () => {
      // Trigger notification
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'new-leader',
            data: {
              player_name: 'NewChampion'
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Verify notification is visible
      cy.get('[data-testid="update-notification"]').should('be.visible');

      // Wait for auto-dismiss (5 seconds)
      cy.wait(5000);

      // Verify notification is dismissed
      cy.get('[data-testid="update-notification"]').should('not.exist');
    });

    it('should allow manual dismissal of notifications', () => {
      // Trigger notification
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'new-leader',
            data: {
              player_name: 'NewChampion'
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Click dismiss button
      cy.get('[data-testid="dismiss-notification"]').click();

      // Verify notification is dismissed
      cy.get('[data-testid="update-notification"]').should('not.exist');
    });
  });

  describe('Update Frequency Control', () => {
    it('should throttle high-frequency updates', () => {
      let updateCount = 0;

      // Monitor DOM changes
      cy.window().then((win) => {
        const observer = new MutationObserver(() => {
          updateCount++;
        });

        const leaderboard = win.document.querySelector('[data-testid="leaderboard-table"]');
        if (leaderboard) {
          observer.observe(leaderboard, { childList: true, subtree: true });
        }
      });

      // Send 100 rapid updates
      cy.window().then((win) => {
        for (let i = 0; i < 100; i++) {
          const event = new CustomEvent('leaderboard-update', {
            detail: {
              type: 'player-updated',
              data: { player_id: 'player-1', kills: 45 + i }
            }
          });
          win.dispatchEvent(event);
        }
      });

      // Verify updates were throttled (should be much less than 100)
      cy.wrap(null).then(() => {
        expect(updateCount).to.be.lessThan(50);
      });
    });
  });

  describe('Offline Handling', () => {
    it('should queue updates while offline', () => {
      // Go offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'));
      });

      // Send updates while offline
      cy.window().then((win) => {
        const event = new CustomEvent('leaderboard-update', {
          detail: {
            type: 'player-updated',
            data: {
              player_id: 'player-1',
              kills: 100
            }
          }
        });
        win.dispatchEvent(event);
      });

      // Go back online
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'));
      });

      // Verify queued updates are applied
      cy.contains('100').should('be.visible');
    });

    it('should show offline banner when disconnected', () => {
      // Go offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'));
      });

      // Verify offline banner
      cy.get('[data-testid="offline-banner"]').should('be.visible');
      cy.contains('You are offline').should('be.visible');
    });

    it('should hide offline banner when reconnected', () => {
      // Go offline
      cy.window().then((win) => {
        win.dispatchEvent(new Event('offline'));
      });

      // Verify banner is visible
      cy.get('[data-testid="offline-banner"]').should('be.visible');

      // Go back online
      cy.window().then((win) => {
        win.dispatchEvent(new Event('online'));
      });

      // Verify banner is hidden
      cy.get('[data-testid="offline-banner"]').should('not.exist');
    });
  });

  describe('Performance', () => {
    it('should handle large number of simultaneous updates', () => {
      // Send 50 updates simultaneously
      cy.window().then((win) => {
        for (let i = 0; i < 50; i++) {
          const event = new CustomEvent('leaderboard-update', {
            detail: {
              type: 'player-updated',
              data: {
                player_id: `player-${i}`,
                kills: i * 10
              }
            }
          });
          win.dispatchEvent(event);
        }
      });

      // Verify UI remains responsive
      cy.get('[data-testid="leaderboard-table"]').should('be.visible');
      cy.get('[data-testid="leaderboard-row"]').should('have.length.greaterThan', 0);
    });

    it('should not cause memory leaks with continuous updates', () => {
      // Measure initial memory (if available)
      let initialMemory: number;
      cy.window().then((win) => {
        if ((performance as any).memory) {
          initialMemory = (performance as any).memory.usedJSHeapSize;
        }
      });

      // Send 1000 updates
      cy.window().then((win) => {
        for (let i = 0; i < 1000; i++) {
          const event = new CustomEvent('leaderboard-update', {
            detail: {
              type: 'player-updated',
              data: { player_id: 'player-1', kills: i }
            }
          });
          win.dispatchEvent(event);
        }
      });

      // Check memory hasn't grown significantly
      cy.window().then((win) => {
        if ((performance as any).memory) {
          const finalMemory = (performance as any).memory.usedJSHeapSize;
          const growth = finalMemory - initialMemory;
          // Allow some growth but not excessive
          expect(growth).to.be.lessThan(10 * 1024 * 1024); // < 10MB
        }
      });
    });
  });
});
