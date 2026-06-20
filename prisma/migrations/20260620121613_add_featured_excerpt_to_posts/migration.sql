-- AlterTable
ALTER TABLE `posts` ADD COLUMN `excerpt` VARCHAR(500) NULL,
    ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false;
