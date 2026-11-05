-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'staff',
    `passwordHash` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `next` INTEGER NOT NULL,

    UNIQUE INDEX `counters_workspace_kind_key`(`workspace`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT '',
    `entity` VARCHAR(30) NOT NULL DEFAULT '',
    `recordCode` VARCHAR(40) NOT NULL DEFAULT '',
    `client` VARCHAR(191) NOT NULL DEFAULT '',
    `text` TEXT NOT NULL,

    INDEX `activity_log_workspace_at_idx`(`workspace`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `file` VARCHAR(191) NOT NULL,
    `target` VARCHAR(20) NOT NULL,
    `added` INTEGER NOT NULL,
    `duplicates` INTEGER NOT NULL,
    `invalid` INTEGER NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `role` VARCHAR(20) NOT NULL DEFAULT '',

    INDEX `import_records_workspace_at_idx`(`workspace`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NOT NULL DEFAULT '',
    `stage` VARCHAR(20) NOT NULL DEFAULT 'Prospect',
    `nextAction` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_workspace_nameKey_key`(`workspace`, `nameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `contact` VARCHAR(191) NOT NULL DEFAULT '',
    `date` DATE NOT NULL,
    `outcome` VARCHAR(30) NOT NULL,
    `pipelineStage` VARCHAR(40) NOT NULL DEFAULT '',
    `nextAction` VARCHAR(191) NOT NULL DEFAULT '',
    `salesperson` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `visits_workspace_date_idx`(`workspace`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `demand_letters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `letterDate` DATE NULL,
    `countries` VARCHAR(191) NOT NULL DEFAULT '',
    `trades` VARCHAR(191) NOT NULL DEFAULT '',
    `quantities` VARCHAR(191) NOT NULL DEFAULT '',
    `nationality` VARCHAR(191) NOT NULL DEFAULT '',
    `salaryBenefits` VARCHAR(191) NOT NULL DEFAULT '',
    `signed` VARCHAR(3) NOT NULL DEFAULT 'No',
    `agencyAllocation` VARCHAR(191) NOT NULL DEFAULT '',
    `status` VARCHAR(30) NOT NULL DEFAULT 'Received',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `demand_letters_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `country` VARCHAR(60) NOT NULL,
    `trade` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'New Order',
    `agency` VARCHAR(191) NOT NULL DEFAULT '',
    `importKey` VARCHAR(191) NULL,
    `sourceFile` VARCHAR(191) NULL,
    `sourceRow` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `orders_workspace_importKey_idx`(`workspace`, `importKey`),
    UNIQUE INDEX `orders_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agency_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `agency` VARCHAR(191) NOT NULL,
    `country` VARCHAR(60) NOT NULL,
    `orderId` INTEGER NOT NULL,
    `allocated` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'Sourcing',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agency_allocations_workspace_idx`(`workspace`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passport` VARCHAR(191) NOT NULL DEFAULT '',
    `dupKey` VARCHAR(191) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `country` VARCHAR(60) NOT NULL,
    `agency` VARCHAR(191) NOT NULL DEFAULT '',
    `trade` VARCHAR(191) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'CV Submitted',
    `visaNumber` VARCHAR(191) NOT NULL DEFAULT '',
    `qvcDate` DATE NULL,
    `flightDate` DATE NULL,
    `sourceFile` VARCHAR(191) NULL,
    `sourceRow` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `candidates_workspace_status_idx`(`workspace`, `status`),
    INDEX `candidates_workspace_clientId_idx`(`workspace`, `clientId`),
    UNIQUE INDEX `candidates_workspace_code_key`(`workspace`, `code`),
    UNIQUE INDEX `candidates_workspace_dupKey_key`(`workspace`, `dupKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_stages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `candidateId` INTEGER NOT NULL,
    `stage` VARCHAR(40) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `byRole` VARCHAR(20) NOT NULL DEFAULT '',

    INDEX `candidate_stages_candidateId_idx`(`candidateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `method` VARCHAR(30) NOT NULL,
    `country` VARCHAR(60) NOT NULL,
    `date` DATE NULL,
    `candidates` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `interviews_workspace_date_idx`(`workspace`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `travel_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `candidateId` INTEGER NOT NULL,
    `ticketBy` VARCHAR(10) NOT NULL DEFAULT '',
    `flight` VARCHAR(191) NOT NULL DEFAULT '',
    `driverName` VARCHAR(191) NOT NULL DEFAULT '',
    `driverPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `step` VARCHAR(30) NOT NULL DEFAULT 'Pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `travel_records_candidateId_key`(`candidateId`),
    INDEX `travel_records_workspace_idx`(`workspace`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warranty_cases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `division` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NULL,
    `clientLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `candidateId` INTEGER NULL,
    `issue` VARCHAR(191) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Pending',
    `warrantyStart` DATE NULL,
    `warrantyExpiry` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `warranty_cases_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domestic_cases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `customer` VARCHAR(191) NOT NULL DEFAULT '',
    `origin` VARCHAR(60) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'Customer Enquiry',
    `nextAction` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `domestic_cases_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credential_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `portal` VARCHAR(30) NOT NULL,
    `record` VARCHAR(191) NOT NULL,
    `access` VARCHAR(191) NOT NULL DEFAULT 'Authorized only',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `finance_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `date` DATE NOT NULL,
    `division` VARCHAR(10) NOT NULL,
    `direction` VARCHAR(10) NOT NULL,
    `account` VARCHAR(20) NOT NULL,
    `party` VARCHAR(191) NOT NULL,
    `client` VARCHAR(191) NOT NULL DEFAULT '',
    `country` VARCHAR(60) NOT NULL DEFAULT '',
    `orderRef` VARCHAR(191) NOT NULL DEFAULT '',
    `category` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `ref` VARCHAR(191) NOT NULL DEFAULT '',
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `importKey` VARCHAR(191) NULL,
    `sourceFile` VARCHAR(191) NULL,
    `sourceRow` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `finance_entries_workspace_date_idx`(`workspace`, `date`),
    INDEX `finance_entries_workspace_importKey_idx`(`workspace`, `importKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cv_intake_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `type` VARCHAR(10) NOT NULL DEFAULT '',
    `source` VARCHAR(30) NOT NULL DEFAULT 'Direct upload',
    `client` VARCHAR(191) NOT NULL DEFAULT '',
    `agency` VARCHAR(191) NOT NULL DEFAULT '',
    `country` VARCHAR(60) NOT NULL DEFAULT '',
    `status` VARCHAR(30) NOT NULL DEFAULT 'Needs review',
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `extractedEmail` VARCHAR(191) NOT NULL DEFAULT '',
    `extractedPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `preview` TEXT NOT NULL DEFAULT '',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cv_intake_items_workspace_filename_size_idx`(`workspace`, `filename`, `size`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visits` ADD CONSTRAINT `visits_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `demand_letters` ADD CONSTRAINT `demand_letters_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `demand_letters` ADD CONSTRAINT `demand_letters_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agency_allocations` ADD CONSTRAINT `agency_allocations_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidates` ADD CONSTRAINT `candidates_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidates` ADD CONSTRAINT `candidates_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate_stages` ADD CONSTRAINT `candidate_stages_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interviews` ADD CONSTRAINT `interviews_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `travel_records` ADD CONSTRAINT `travel_records_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warranty_cases` ADD CONSTRAINT `warranty_cases_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warranty_cases` ADD CONSTRAINT `warranty_cases_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credential_records` ADD CONSTRAINT `credential_records_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

