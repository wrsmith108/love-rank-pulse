/*
  Warnings:

  - Added the required column `password_hash` to the `players` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "players" ADD COLUMN     "password_hash" VARCHAR(255) NOT NULL;
