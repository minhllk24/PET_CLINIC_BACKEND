-- AlterTable
ALTER TABLE `products` ADD COLUMN `original_price` DECIMAL(12, 2) NULL,
    ADD COLUMN `sold_quantity` INTEGER NOT NULL DEFAULT 0;
