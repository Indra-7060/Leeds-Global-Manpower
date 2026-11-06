-- CreateTable
CREATE TABLE `stored_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(190) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stored_files_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

