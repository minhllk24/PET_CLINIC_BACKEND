-- AlterTable
ALTER TABLE `pets` ADD COLUMN `age` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `time_slots` ADD COLUMN `slot_type` ENUM('exam', 'grooming') NOT NULL DEFAULT 'exam';

-- CreateTable
CREATE TABLE `service_price_matrix` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` BIGINT NOT NULL,
    `weight_min` DECIMAL(5, 2) NULL,
    `weight_max` DECIMAL(5, 2) NULL,
    `price` DECIMAL(12, 2) NULL,
    `is_contact` BOOLEAN NOT NULL DEFAULT false,

    INDEX `idx_service_price_matrix_service_id`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_likes` (
    `user_id` BIGINT NOT NULL,
    `post_id` BIGINT NOT NULL,

    PRIMARY KEY (`user_id`, `post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_time_slots_type_branch_date` ON `time_slots`(`slot_type`, `branch_id`, `slot_date`);

-- AddForeignKey
ALTER TABLE `service_price_matrix` ADD CONSTRAINT `service_price_matrix_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`service_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_likes` ADD CONSTRAINT `post_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_likes` ADD CONSTRAINT `post_likes_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE ON UPDATE CASCADE;
