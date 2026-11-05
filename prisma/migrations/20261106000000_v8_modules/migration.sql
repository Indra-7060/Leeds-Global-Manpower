-- AlterTable
ALTER TABLE `domestic_cases` ADD COLUMN `address` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `arrivalDate` DATE NULL,
    ADD COLUMN `category` VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN `handoverDate` DATE NULL,
    ADD COLUMN `handoverNote` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `mobile` VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN `qidCipher` TEXT NULL,
    ADD COLUMN `qidLast` VARCHAR(6) NOT NULL DEFAULT '',
    ADD COLUMN `sponsorType` VARCHAR(30) NOT NULL DEFAULT 'Qatari Citizen';

-- CreateTable
CREATE TABLE `domestic_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `caseId` INTEGER NOT NULL,
    `agreedFee` DECIMAL(14, 2) NOT NULL,
    `govFees` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `domestic_accounts_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receivable_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `direction` VARCHAR(10) NOT NULL DEFAULT 'Incoming',
    `date` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'QAR',
    `account` VARCHAR(20) NOT NULL DEFAULT '',
    `category` VARCHAR(30) NOT NULL DEFAULT '',
    `receiptNo` VARCHAR(40) NOT NULL DEFAULT '',
    `reference` VARCHAR(191) NOT NULL DEFAULT '',
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `domesticCaseId` INTEGER NULL,
    `placementFeeId` INTEGER NULL,
    `serviceInvoiceId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `receivable_payments_workspace_date_idx`(`workspace`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund_claims` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `caseId` INTEGER NOT NULL,
    `monthsServed` INTEGER NOT NULL,
    `reason` VARCHAR(60) NOT NULL,
    `evidence` TEXT NOT NULL,
    `feePaid` DECIMAL(14, 2) NOT NULL,
    `govFees` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `estimate` DECIMAL(14, 2) NULL,
    `ruleVersion` VARCHAR(80) NOT NULL DEFAULT '',
    `status` VARCHAR(30) NOT NULL DEFAULT 'Pending review',
    `requestedById` INTEGER NULL,
    `decidedById` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `decisionNote` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refund_claims_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `corporate_vacancies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(60) NOT NULL DEFAULT '',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `source` VARCHAR(20) NOT NULL DEFAULT 'Local Qatar',
    `status` VARCHAR(20) NOT NULL DEFAULT 'Open',
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `corporate_vacancies_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `corporate_placements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `vacancyId` INTEGER NOT NULL,
    `candidateName` VARCHAR(191) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'Local Qatar',
    `country` VARCHAR(60) NOT NULL DEFAULT '',
    `stage` VARCHAR(20) NOT NULL DEFAULT 'Shortlisted',
    `offerDate` DATE NULL,
    `joiningDate` DATE NULL,
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `corporate_placements_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `placement_fees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `placementId` INTEGER NOT NULL,
    `basicSalary` DECIMAL(14, 2) NOT NULL,
    `basis` VARCHAR(10) NOT NULL,
    `feeAmount` DECIMAL(14, 2) NOT NULL,
    `dueMonths` INTEGER NOT NULL DEFAULT 1,
    `invoiceNo` VARCHAR(40) NOT NULL DEFAULT '',
    `invoiceDate` DATE NULL,
    `creditNote` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `creditReason` VARCHAR(191) NOT NULL DEFAULT '',
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `placement_fees_placementId_key`(`placementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_fee_terms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `basis` VARCHAR(10) NOT NULL DEFAULT 'worker',
    `amount` DECIMAL(14, 2) NOT NULL,
    `trigger` VARCHAR(30) NOT NULL DEFAULT 'Verified arrival',
    `taxable` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_fee_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `termId` INTEGER NOT NULL,
    `invoiceNo` VARCHAR(40) NOT NULL DEFAULT '',
    `date` DATE NOT NULL,
    `workers` INTEGER NOT NULL DEFAULT 0,
    `amount` DECIMAL(14, 2) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_fee_invoices_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `finance_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `financeEntryId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `candidateId` INTEGER NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `status` VARCHAR(20) NOT NULL DEFAULT 'Proposed',
    `proposedById` INTEGER NULL,
    `decidedById` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `division` VARCHAR(10) NOT NULL,
    `clientId` INTEGER NULL,
    `domesticCaseId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `agreementType` VARCHAR(40) NOT NULL DEFAULT '',
    `signedDate` DATE NULL,
    `effectiveDate` DATE NULL,
    `expiryDate` DATE NULL,
    `orderId` INTEGER NULL,
    `billingTerms` TEXT NOT NULL DEFAULT '',
    `warrantyTerms` TEXT NOT NULL DEFAULT '',
    `notes` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contracts_workspace_expiryDate_idx`(`workspace`, `expiryDate`),
    UNIQUE INDEX `contracts_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `contractId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(100) NOT NULL DEFAULT '',
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `storageKey` VARCHAR(120) NOT NULL,
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `uploadedById` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contract_versions_contractId_version_key`(`contractId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` TEXT NOT NULL DEFAULT '',
    `kind` VARCHAR(30) NOT NULL DEFAULT 'Manual',
    `assigneeId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `dueDate` DATE NULL,
    `priority` VARCHAR(10) NOT NULL DEFAULT 'Normal',
    `status` VARCHAR(10) NOT NULL DEFAULT 'Open',
    `linkedEntity` VARCHAR(30) NOT NULL DEFAULT '',
    `linkedCode` VARCHAR(40) NOT NULL DEFAULT '',
    `doneAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tasks_workspace_status_dueDate_idx`(`workspace`, `status`, `dueDate`),
    UNIQUE INDEX `tasks_workspace_code_key`(`workspace`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace` VARCHAR(10) NOT NULL,
    `interviewId` INTEGER NOT NULL,
    `candidateId` INTEGER NOT NULL,
    `attended` VARCHAR(5) NOT NULL DEFAULT '',
    `decision` VARCHAR(10) NOT NULL DEFAULT 'Pending',
    `note` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `interview_entries_interviewId_candidateId_key`(`interviewId`, `candidateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `domestic_accounts` ADD CONSTRAINT `domestic_accounts_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `domestic_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_domesticCaseId_fkey` FOREIGN KEY (`domesticCaseId`) REFERENCES `domestic_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_placementFeeId_fkey` FOREIGN KEY (`placementFeeId`) REFERENCES `placement_fees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_serviceInvoiceId_fkey` FOREIGN KEY (`serviceInvoiceId`) REFERENCES `service_fee_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_claims` ADD CONSTRAINT `refund_claims_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `domestic_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `corporate_vacancies` ADD CONSTRAINT `corporate_vacancies_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `corporate_placements` ADD CONSTRAINT `corporate_placements_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `corporate_vacancies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `placement_fees` ADD CONSTRAINT `placement_fees_placementId_fkey` FOREIGN KEY (`placementId`) REFERENCES `corporate_placements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_fee_terms` ADD CONSTRAINT `service_fee_terms_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_fee_terms` ADD CONSTRAINT `service_fee_terms_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_fee_invoices` ADD CONSTRAINT `service_fee_invoices_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `service_fee_terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_allocations` ADD CONSTRAINT `finance_allocations_financeEntryId_fkey` FOREIGN KEY (`financeEntryId`) REFERENCES `finance_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_allocations` ADD CONSTRAINT `finance_allocations_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_allocations` ADD CONSTRAINT `finance_allocations_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_domesticCaseId_fkey` FOREIGN KEY (`domesticCaseId`) REFERENCES `domestic_cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_versions` ADD CONSTRAINT `contract_versions_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_entries` ADD CONSTRAINT `interview_entries_interviewId_fkey` FOREIGN KEY (`interviewId`) REFERENCES `interviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_entries` ADD CONSTRAINT `interview_entries_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

