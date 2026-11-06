-- CreateTable
CREATE TABLE `role_access` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` VARCHAR(10) NOT NULL,
    `module` VARCHAR(30) NOT NULL,
    `level` VARCHAR(5) NOT NULL,

    UNIQUE INDEX `role_access_role_module_key`(`role`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

