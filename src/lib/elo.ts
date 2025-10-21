// ELO Rating Calculation System
// Implements standard ELO algorithm for competitive rankings

export interface ELOResult {
  winnerNewElo: number;
  loserNewElo: number;
  ratingChange: number;
}

export class ELOCalculator {
  /**
   * Default K-factor for rating changes
   * Higher K-factor = more volatile ratings
   * Lower K-factor = more stable ratings
   */
  private static readonly DEFAULT_K_FACTOR = 32;

  /**
   * K-factor for new players (< 30 games)
   * Higher to allow faster rating adjustment
   */
  private static readonly NEW_PLAYER_K_FACTOR = 40;

  /**
   * K-factor for established players (30+ games)
   */
  private static readonly ESTABLISHED_K_FACTOR = 24;

  /**
   * Calculate expected score for a player
   * @param playerRating - Player's current ELO rating
   * @param opponentRating - Opponent's current ELO rating
   * @returns Expected score between 0 and 1
   */
  private static calculateExpectedScore(
    playerRating: number,
    opponentRating: number
  ): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  /**
   * Determine K-factor based on number of matches played
   * @param matchesPlayed - Total matches played by the player
   * @returns Appropriate K-factor
   */
  private static getKFactor(matchesPlayed: number): number {
    if (matchesPlayed < 30) {
      return this.NEW_PLAYER_K_FACTOR;
    }
    return this.ESTABLISHED_K_FACTOR;
  }

  /**
   * Calculate new ELO ratings after a match
   * @param winnerRating - Winner's current ELO rating
   * @param loserRating - Loser's current ELO rating
   * @param winnerMatches - Number of matches winner has played
   * @param loserMatches - Number of matches loser has played
   * @param isDraw - Whether the match was a draw
   * @returns New ELO ratings for both players
   */
  static calculateNewRatings(
    winnerRating: number,
    loserRating: number,
    winnerMatches: number,
    loserMatches: number,
    isDraw: boolean = false
  ): ELOResult {
    // Get K-factors for both players
    const winnerKFactor = this.getKFactor(winnerMatches);
    const loserKFactor = this.getKFactor(loserMatches);

    // Calculate expected scores
    const winnerExpected = this.calculateExpectedScore(winnerRating, loserRating);
    const loserExpected = this.calculateExpectedScore(loserRating, winnerRating);

    // Actual scores (1 for win, 0 for loss, 0.5 for draw)
    const winnerActual = isDraw ? 0.5 : 1;
    const loserActual = isDraw ? 0.5 : 0;

    // Calculate rating changes
    const winnerChange = Math.round(winnerKFactor * (winnerActual - winnerExpected));
    const loserChange = Math.round(loserKFactor * (loserActual - loserExpected));

    // Calculate new ratings
    const winnerNewElo = winnerRating + winnerChange;
    const loserNewElo = loserRating + loserChange;

    return {
      winnerNewElo,
      loserNewElo,
      ratingChange: Math.abs(winnerChange), // Always positive
    };
  }

  /**
   * Calculate rating change for a specific match outcome
   * Useful for displaying potential rating changes before match
   */
  static predictRatingChange(
    playerRating: number,
    opponentRating: number,
    playerMatches: number,
    willWin: boolean
  ): number {
    const kFactor = this.getKFactor(playerMatches);
    const expected = this.calculateExpectedScore(playerRating, opponentRating);
    const actual = willWin ? 1 : 0;

    return Math.round(kFactor * (actual - expected));
  }

  /**
   * Calculate win probability based on ELO difference
   * @param playerRating - Player's ELO rating
   * @param opponentRating - Opponent's ELO rating
   * @returns Win probability as percentage (0-100)
   */
  static calculateWinProbability(
    playerRating: number,
    opponentRating: number
  ): number {
    const expected = this.calculateExpectedScore(playerRating, opponentRating);
    return Math.round(expected * 100);
  }
}
