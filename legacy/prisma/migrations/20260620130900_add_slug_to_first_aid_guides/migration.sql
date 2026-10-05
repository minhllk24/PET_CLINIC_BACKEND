-- AlterTable
ALTER TABLE `first_aid_guides` ADD COLUMN `slug` VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `first_aid_guides_slug_key` ON `first_aid_guides` (`slug`);
