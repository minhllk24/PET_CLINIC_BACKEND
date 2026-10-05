-- CreateTable
CREATE TABLE `flash_sales` (
    `flash_sale_id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NOT NULL,
    `status` ENUM('active', 'inactive', 'ended') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`flash_sale_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flash_sale_items` (
    `flash_sale_item_id` BIGINT NOT NULL AUTO_INCREMENT,
    `flash_sale_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `discount_percentage` TINYINT NULL,
    `discount_price` DECIMAL(12, 2) NOT NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `sold_quantity` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_flash_sale_product`(`flash_sale_id`, `product_id`),
    PRIMARY KEY (`flash_sale_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `flash_sale_items` ADD CONSTRAINT `flash_sale_items_flash_sale_id_fkey` FOREIGN KEY (`flash_sale_id`) REFERENCES `flash_sales`(`flash_sale_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flash_sale_items` ADD CONSTRAINT `flash_sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;
