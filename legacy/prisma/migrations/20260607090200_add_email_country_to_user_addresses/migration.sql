-- AlterTable
ALTER TABLE `user_addresses` ADD COLUMN `country` VARCHAR(100) NULL,
    ADD COLUMN `recipient_email` VARCHAR(255) NULL;
