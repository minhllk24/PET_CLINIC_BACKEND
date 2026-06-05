-- AlterTable
ALTER TABLE `cart_items` ADD COLUMN `variant_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `variant_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `likes_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `parent_id` BIGINT NULL;

-- CreateTable
CREATE TABLE `product_variants` (
    `variant_id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `variant_name` VARCHAR(100) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `original_price` DECIMAL(12, 2) NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,

    INDEX `idx_product_variants_product_id`(`product_id`),
    PRIMARY KEY (`variant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_likes` (
    `user_id` BIGINT NOT NULL,
    `review_id` BIGINT NOT NULL,

    PRIMARY KEY (`user_id`, `review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_cart_items_variant_id` ON `cart_items`(`variant_id`);

-- CreateIndex
CREATE INDEX `idx_order_items_variant_id` ON `order_items`(`variant_id`);

-- CreateIndex
CREATE INDEX `idx_reviews_parent_id` ON `reviews`(`parent_id`);

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`variant_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `reviews`(`review_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_likes` ADD CONSTRAINT `review_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_likes` ADD CONSTRAINT `review_likes_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`review_id`) ON DELETE CASCADE ON UPDATE CASCADE;
