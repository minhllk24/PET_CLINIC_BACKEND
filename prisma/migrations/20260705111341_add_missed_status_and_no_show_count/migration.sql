-- AlterTable
ALTER TABLE `appointments` MODIFY `status` ENUM('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'missed') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `no_show_count` INTEGER NOT NULL DEFAULT 0;
