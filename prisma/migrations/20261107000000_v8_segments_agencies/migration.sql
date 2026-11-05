-- AlterTable
ALTER TABLE `clients` ADD COLUMN `segment` VARCHAR(12) NOT NULL DEFAULT 'Blue-Collar';

-- AlterTable
ALTER TABLE `contracts` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `agencies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `country` VARCHAR(60) NOT NULL DEFAULT '',
    `contact` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(40) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agencies_workspace_nameKey_key`(`workspace`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `list_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `value` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `list_items_workspace_kind_value_key`(`workspace`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

