-- AlterTable
ALTER TABLE `branches` ADD COLUMN `latitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `longitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `operating_hours` VARCHAR(255) NULL;
