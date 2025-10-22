/**
 * RealPlayerService Tests
 * Tests for real player service with Prisma integration
 */

import { RealPlayerService } from '../../services/RealPlayerService';
import { createMockPrismaClient, mockPrismaPlayer } from '../utils/mockPrisma';
import { createPlayersFactory } from '../utils/testDataFactories';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: createMockPrismaClient()
}));

describe('RealPlayerService', () => {
  let mockPrisma: any;
  let playerService: RealPlayerService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = require('../../lib/prisma').default;
    playerService = new RealPlayerService();
  });

  describe('getPlayerById', () => {
    it('should return player when found', async () => {
      const player = mockPrismaPlayer({ id: 'player-123' });
      mockPrisma.player.findUnique.mockResolvedValue(player);

      const result = await playerService.getPlayerById('player-123');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('player-123');
      expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { id: 'player-123' }
      });
    });

    it('should return null when player not found', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await playerService.getPlayerById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.player.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await playerService.getPlayerById('player-123');

      expect(result).toBeNull();
    });
  });

  describe('getPlayersByIds', () => {
    it('should return multiple players', async () => {
      const players = createPlayersFactory(3);
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.getPlayersByIds(['p1', 'p2', 'p3']);

      expect(result).toHaveLength(3);
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2', 'p3'] } }
      });
    });

    it('should return empty array when no IDs provided', async () => {
      mockPrisma.player.findMany.mockResolvedValue([]);

      const result = await playerService.getPlayersByIds([]);

      expect(result).toEqual([]);
    });
  });

  describe('getAllPlayers', () => {
    it('should return all players', async () => {
      const players = createPlayersFactory(10);
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.getAllPlayers();

      expect(result).toHaveLength(10);
      expect(mockPrisma.player.findMany).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      const players = createPlayersFactory(5);
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.getAllPlayers(5, 10);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5
        })
      );
    });
  });

  describe('searchPlayers', () => {
    it('should search by username', async () => {
      const players = [mockPrismaPlayer({ username: 'TestUser123' })];
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.searchPlayers('Test');

      expect(result).toHaveLength(1);
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: 'Test', mode: 'insensitive' } },
              { email: { contains: 'Test', mode: 'insensitive' } }
            ]
          }
        })
      );
    });

    it('should search by email', async () => {
      const players = [mockPrismaPlayer({ email: 'test@example.com' })];
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.searchPlayers('test@');

      expect(result).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      mockPrisma.player.findMany.mockResolvedValue([]);

      const result = await playerService.searchPlayers('nonexistent');

      expect(result).toEqual([]);
    });

    it('should limit search results', async () => {
      const players = createPlayersFactory(50);
      mockPrisma.player.findMany.mockResolvedValue(players.slice(0, 20));

      const result = await playerService.searchPlayers('test', 20);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20
        })
      );
    });
  });

  describe('getPlayersByCountry', () => {
    it('should filter players by country code', async () => {
      const players = createPlayersFactory(5, { country_code: 'US' });
      mockPrisma.player.findMany.mockResolvedValue(players);

      const result = await playerService.getPlayersByCountry('US');

      expect(result).toHaveLength(5);
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
        where: { country_code: 'US' }
      });
    });

    it('should return empty array when no players from country', async () => {
      mockPrisma.player.findMany.mockResolvedValue([]);

      const result = await playerService.getPlayersByCountry('ZZ');

      expect(result).toEqual([]);
    });
  });

  describe('getTopPlayers', () => {
    it('should return top players by ELO rating', async () => {
      const players = createPlayersFactory(10);
      mockPrisma.player.findMany.mockResolvedValue(
        players.sort((a, b) => b.elo_rating - a.elo_rating).slice(0, 10)
      );

      const result = await playerService.getTopPlayers(10);

      expect(result).toHaveLength(10);
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { elo_rating: 'desc' },
          take: 10
        })
      );
    });

    it('should support different limits', async () => {
      const players = createPlayersFactory(50);
      mockPrisma.player.findMany.mockResolvedValue(players.slice(0, 50));

      await playerService.getTopPlayers(50);

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50
        })
      );
    });
  });

  describe('updatePlayerElo', () => {
    it('should update player ELO rating', async () => {
      const player = mockPrismaPlayer({ id: 'player-123', elo_rating: 1200 });
      const updatedPlayer = { ...player, elo_rating: 1224 };

      mockPrisma.player.update.mockResolvedValue(updatedPlayer);

      const result = await playerService.updatePlayerElo('player-123', 1224);

      expect(result?.elo_rating).toBe(1224);
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: { elo_rating: 1224 }
      });
    });

    it('should handle update errors', async () => {
      mockPrisma.player.update.mockRejectedValue(new Error('Update failed'));

      const result = await playerService.updatePlayerElo('player-123', 1224);

      expect(result).toBeNull();
    });
  });

  describe('updateMatchStats', () => {
    it('should increment match statistics', async () => {
      const player = mockPrismaPlayer({
        id: 'player-123',
        matches_played: 10,
        wins: 6,
        losses: 4
      });

      mockPrisma.player.update.mockResolvedValue({
        ...player,
        matches_played: 11,
        wins: 7
      });

      const result = await playerService.updateMatchStats('player-123', 'win');

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: {
          matches_played: { increment: 1 },
          wins: { increment: 1 }
        }
      });
    });

    it('should handle loss updates', async () => {
      const player = mockPrismaPlayer({ id: 'player-123' });

      mockPrisma.player.update.mockResolvedValue({
        ...player,
        matches_played: player.matches_played + 1,
        losses: player.losses + 1
      });

      await playerService.updateMatchStats('player-123', 'loss');

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: {
          matches_played: { increment: 1 },
          losses: { increment: 1 }
        }
      });
    });

    it('should handle draw updates', async () => {
      const player = mockPrismaPlayer({ id: 'player-123' });

      mockPrisma.player.update.mockResolvedValue({
        ...player,
        matches_played: player.matches_played + 1,
        draws: player.draws + 1
      });

      await playerService.updateMatchStats('player-123', 'draw');

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 'player-123' },
        data: {
          matches_played: { increment: 1 },
          draws: { increment: 1 }
        }
      });
    });
  });

  describe('getPlayerStats', () => {
    it('should return player statistics', async () => {
      const player = mockPrismaPlayer({
        id: 'player-123',
        matches_played: 100,
        wins: 60,
        losses: 35,
        draws: 5,
        elo_rating: 1450
      });

      mockPrisma.player.findUnique.mockResolvedValue({
        ...player,
        leaderboard_entries: [{
          id: 'entry-1',
          player_id: 'player-123',
          leaderboard_type: 'GLOBAL',
          rank: 10
        }]
      });

      const result = await playerService.getPlayerStats('player-123');

      expect(result?.matchesPlayed).toBe(100);
      expect(result?.wins).toBe(60);
      expect(result?.losses).toBe(35);
      expect(result?.draws).toBe(5);
      expect(result?.winRate).toBeCloseTo(0.6, 2);
      expect(result?.eloRating).toBe(1450);
    });

    it('should calculate win rate correctly', async () => {
      const player = mockPrismaPlayer({
        matches_played: 50,
        wins: 30,
        losses: 20,
        draws: 0
      });

      mockPrisma.player.findUnique.mockResolvedValue({
        ...player,
        leaderboard_entries: [{
          id: 'entry-1',
          player_id: 'player-123',
          leaderboard_type: 'GLOBAL',
          rank: 5
        }]
      });

      const result = await playerService.getPlayerStats('player-123');

      expect(result?.winRate).toBeCloseTo(0.6, 2);
    });

    it('should handle zero matches', async () => {
      const player = mockPrismaPlayer({
        matches_played: 0,
        wins: 0,
        losses: 0,
        draws: 0
      });

      mockPrisma.player.findUnique.mockResolvedValue(player);

      const result = await playerService.getPlayerStats('player-123');

      expect(result?.win_rate).toBe(0);
    });

    it('should return null for nonexistent player', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      const result = await playerService.getPlayerStats('nonexistent');

      expect(result).toBeNull();
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should retrieve player by ID in under 50ms', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPrismaPlayer());

      const start = performance.now();
      await playerService.getPlayerById('player-123');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should search players in under 100ms', async () => {
      const players = createPlayersFactory(100);
      mockPrisma.player.findMany.mockResolvedValue(players);

      const start = performance.now();
      await playerService.searchPlayers('test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should get top players in under 100ms', async () => {
      const players = createPlayersFactory(100);
      mockPrisma.player.findMany.mockResolvedValue(players);

      const start = performance.now();
      await playerService.getTopPlayers(50);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
