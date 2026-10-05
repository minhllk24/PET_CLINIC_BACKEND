-- AlterTable
ALTER TABLE `posts` ADD COLUMN `hashtags` VARCHAR(255) NULL,
    ADD COLUMN `likes_count` INTEGER NOT NULL DEFAULT 0;
