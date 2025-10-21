-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FORFEIT', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('RANKED', 'UNRANKED', 'TOURNAMENT', 'FRIENDLY', 'PRACTICE');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('WIN', 'LOSS', 'DRAW', 'FORFEIT', 'NO_CONTEST');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaderboardType" AS ENUM ('GLOBAL', 'SEASONAL', 'WEEKLY', 'MONTHLY', 'REGIONAL');

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "elo_rating" INTEGER NOT NULL DEFAULT 1200,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "avatar_url" VARCHAR(500),
    "bio" VARCHAR(500),
    "country_code" VARCHAR(2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "player1_id" TEXT NOT NULL,
    "player2_id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "match_type" "MatchType" NOT NULL DEFAULT 'RANKED',
    "tournament_id" TEXT,
    "round_number" INTEGER,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "best_of" INTEGER NOT NULL DEFAULT 1,
    "time_limit" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "winner_id" TEXT,
    "loser_id" TEXT,
    "result_type" "ResultType" NOT NULL DEFAULT 'WIN',
    "player1_score" INTEGER NOT NULL DEFAULT 0,
    "player2_score" INTEGER NOT NULL DEFAULT 0,
    "rating_change" INTEGER NOT NULL,
    "winner_new_elo" INTEGER,
    "loser_new_elo" INTEGER,
    "k_factor" INTEGER NOT NULL DEFAULT 32,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "previous_rank" INTEGER,
    "rank_change" INTEGER NOT NULL DEFAULT 0,
    "elo_rating" INTEGER NOT NULL,
    "previous_elo" INTEGER,
    "peak_elo" INTEGER NOT NULL DEFAULT 1200,
    "lowest_elo" INTEGER NOT NULL DEFAULT 1200,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "win_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "best_win_streak" INTEGER NOT NULL DEFAULT 0,
    "season_id" VARCHAR(50),
    "leaderboard_type" "LeaderboardType" NOT NULL DEFAULT 'GLOBAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_match_at" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");

-- CreateIndex
CREATE UNIQUE INDEX "players_email_key" ON "players"("email");

-- CreateIndex
CREATE INDEX "idx_player_elo" ON "players"("elo_rating" DESC);

-- CreateIndex
CREATE INDEX "idx_player_username" ON "players"("username");

-- CreateIndex
CREATE INDEX "idx_player_email" ON "players"("email");

-- CreateIndex
CREATE INDEX "idx_player_rank" ON "players"("rank");

-- CreateIndex
CREATE INDEX "idx_active_players_elo" ON "players"("is_active", "elo_rating" DESC);

-- CreateIndex
CREATE INDEX "idx_player_created" ON "players"("created_at");

-- CreateIndex
CREATE INDEX "idx_match_player1" ON "matches"("player1_id");

-- CreateIndex
CREATE INDEX "idx_match_player2" ON "matches"("player2_id");

-- CreateIndex
CREATE INDEX "idx_match_status" ON "matches"("status");

-- CreateIndex
CREATE INDEX "idx_match_scheduled" ON "matches"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_match_completed" ON "matches"("completed_at");

-- CreateIndex
CREATE INDEX "idx_match_created" ON "matches"("created_at");

-- CreateIndex
CREATE INDEX "idx_match_type_status" ON "matches"("match_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_id_key" ON "match_results"("match_id");

-- CreateIndex
CREATE INDEX "idx_result_match" ON "match_results"("match_id");

-- CreateIndex
CREATE INDEX "idx_result_winner" ON "match_results"("winner_id");

-- CreateIndex
CREATE INDEX "idx_result_loser" ON "match_results"("loser_id");

-- CreateIndex
CREATE INDEX "idx_result_created" ON "match_results"("created_at");

-- CreateIndex
CREATE INDEX "idx_result_verification" ON "match_results"("verification_status");

-- CreateIndex
CREATE INDEX "idx_leaderboard_rank" ON "leaderboard_entries"("rank");

-- CreateIndex
CREATE INDEX "idx_leaderboard_elo" ON "leaderboard_entries"("elo_rating" DESC);

-- CreateIndex
CREATE INDEX "idx_leaderboard_player" ON "leaderboard_entries"("player_id");

-- CreateIndex
CREATE INDEX "idx_season_leaderboard" ON "leaderboard_entries"("season_id", "leaderboard_type", "rank");

-- CreateIndex
CREATE INDEX "idx_active_leaderboard" ON "leaderboard_entries"("leaderboard_type", "is_active", "elo_rating" DESC);

-- CreateIndex
CREATE INDEX "idx_leaderboard_updated" ON "leaderboard_entries"("last_updated");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_player_id_season_id_leaderboard_type_key" ON "leaderboard_entries"("player_id", "season_id", "leaderboard_type");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_loser_id_fkey" FOREIGN KEY ("loser_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
