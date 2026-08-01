-- Database Schema for Gorur Gari
-- Deployment-safe schema for a fresh install or repeat run on hosting.
-- This file does not drop existing tables.

-- 1. Admin
CREATE TABLE IF NOT EXISTS `Admin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(191) NOT NULL
);

-- 2. HeroSection
CREATE TABLE IF NOT EXISTS `HeroSection` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(191) NOT NULL,
  `subtitle` VARCHAR(191) NOT NULL,
  `discountText` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `imageUrl` TEXT
);

-- 3. Banner
CREATE TABLE IF NOT EXISTS `Banner` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `imageUrl` TEXT NOT NULL,
  `title` VARCHAR(191),
  `subtitle` VARCHAR(191),
  `discountText` VARCHAR(191),
  `description` TEXT,
  `isActive` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
);

-- 4. Category
CREATE TABLE IF NOT EXISTS `Category` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  `imageUrl` TEXT,
  `displayOrder` INT DEFAULT 0,
  `featuredProductId` INT,
  `featuredProductList` JSON,
  `showOnHome` TINYINT(1) DEFAULT 1
);

-- 5. SubCategory
CREATE TABLE IF NOT EXISTS `SubCategory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `categoryId` INT NOT NULL,
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE
);

-- 6. SizeChart (New Table)
CREATE TABLE IF NOT EXISTS `SizeChart` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `content` JSON,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Product
CREATE TABLE IF NOT EXISTS `Product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `price` VARCHAR(191) NOT NULL,
  `originalPrice` VARCHAR(191),
  `imageUrl` TEXT NOT NULL,
  `categoryId` INT NOT NULL,
  `subCategoryId` INT,
  `description` TEXT,
  `fullDescription` TEXT,
  `images` JSON,
  `stock` INT DEFAULT 0,
  `sizeStock` JSON,
  `sizes` JSON,
  `colors` JSON,
  -- Which made-to-measure groups this product needs, e.g. ["kameez"] for a top only.
  -- NULL means every group. Group ids live in server/utils/measurements.js.
  `measurementGroups` JSON,
  `sizeChartId` INT DEFAULT NULL,
  `isNewArrival` TINYINT(1) DEFAULT 1,
  `isFreeShipping` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`),
  FOREIGN KEY (`subCategoryId`) REFERENCES `SubCategory`(`id`),
  FOREIGN KEY (`sizeChartId`) REFERENCES `SizeChart`(`id`) ON DELETE SET NULL
);

-- 8. Customer
CREATE TABLE IF NOT EXISTS `Customer` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191),
  `location` VARCHAR(191),
  `address` TEXT,
  `city` VARCHAR(191),
  `zip` VARCHAR(191)
);

-- 9. Order
CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customerId` INT NULL,
  `guestName` VARCHAR(191),
  `guestPhone` VARCHAR(191),
  `totalAmount` DOUBLE NOT NULL,
  `discountAmount` DOUBLE DEFAULT 0,
  `voucherCode` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(191) DEFAULT 'Pending',
  `cancellationReason` TEXT,
  `paymentMethod` VARCHAR(191) DEFAULT 'MFS',
  -- Customer-facing reference: DDMMYY + a sequence that restarts daily (e.g. 07052601).
  -- `id` remains the internal key that OrderItem and the /orders/:id routes use.
  `orderNumber` VARCHAR(20) DEFAULT NULL,
  `slipToken` VARCHAR(64) DEFAULT NULL,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  `specialNote` TEXT,
  `shippingAddress` TEXT,
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
);

-- 14b. OrderSequence — one row per day, used to hand out order-number sequences.
-- Bumped with an atomic INSERT ... ON DUPLICATE KEY UPDATE, so two orders placed at the
-- same instant can never be handed the same number. See server/utils/orderNumber.js.
CREATE TABLE IF NOT EXISTS `OrderSequence` (
  `dayKey` CHAR(6) NOT NULL PRIMARY KEY,
  `lastSequence` INT NOT NULL DEFAULT 0
);

-- 15. Voucher
CREATE TABLE IF NOT EXISTS `Voucher` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `discountType` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  `discountValue` DOUBLE NOT NULL,
  `minOrderAmount` DOUBLE DEFAULT 0,
  `maxClaimsAllowed` INT DEFAULT NULL,
  `totalClaimed` INT DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  `expiresAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. OrderItem
CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orderId` INT NOT NULL,
  `productId` INT NOT NULL,
  `quantity` INT NOT NULL,
  `price` DOUBLE NOT NULL,
  `selectedSize` VARCHAR(191),
  `selectedColor` VARCHAR(191),
  -- Made-to-measure values the buyer submitted, e.g. {"kameezChest":"38","pajamaLength":"38"}.
  -- Keys are defined in server/utils/measurements.js.
  `measurements` JSON,
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
);

-- 11. Review
CREATE TABLE IF NOT EXISTS `Review` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rating` INT NOT NULL,
  `comment` TEXT,
  `productId` INT NOT NULL,
  `customerId` INT NOT NULL,
  `isVerified` TINYINT(1) DEFAULT 0,
  `sortOrder` INT DEFAULT 0,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`),
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
);

-- 12. PopupSettings
CREATE TABLE IF NOT EXISTS `PopupSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `isEnabled` TINYINT(1) DEFAULT 1,
  `imageUrl` TEXT,
  `message` TEXT
);

-- 13. PopupAd
CREATE TABLE IF NOT EXISTS `PopupAd` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `imageUrl` TEXT NOT NULL,
  `categoryId` INT,
  `subCategoryId` INT,
  `isActive` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`),
  FOREIGN KEY (`subCategoryId`) REFERENCES `SubCategory`(`id`)
);

-- 14. SiteSettings
CREATE TABLE IF NOT EXISTS `SiteSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `logoUrl` TEXT,
  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `companyName` VARCHAR(191),
  `address` TEXT,
  `email` VARCHAR(191),
  `phone` VARCHAR(191),
  `facebook` VARCHAR(191),
  `instagram` VARCHAR(191),
  `twitter` VARCHAR(191),
  `termsContent` LONGTEXT,
  `privacyContent` LONGTEXT,
  `cancellationContent` LONGTEXT,
  `faqsContent` LONGTEXT,
  `deliveryChargeInside` INT DEFAULT 60,
  `deliveryChargeOutside` INT DEFAULT 120,
  `mfsNumbers` TEXT,
  `mfsInstructions` TEXT
);

-- Performance Indexes (IF NOT EXISTS guards prevent duplicate errors on re-run)
-- Customer: fast lookup by email (login, duplicate check)
CREATE INDEX IF NOT EXISTS `idx_customer_email` ON `Customer` (`email`);

-- Product: homepage new-arrivals query, category browse
CREATE INDEX IF NOT EXISTS `idx_product_category` ON `Product` (`categoryId`);
CREATE INDEX IF NOT EXISTS `idx_product_subcategory` ON `Product` (`subCategoryId`);
CREATE INDEX IF NOT EXISTS `idx_product_new_arrival` ON `Product` (`isNewArrival`, `createdAt`);
CREATE INDEX IF NOT EXISTS `idx_product_free_shipping` ON `Product` (`isFreeShipping`);

-- Order: customer history, status filter, admin list
CREATE INDEX IF NOT EXISTS `idx_order_customer` ON `Order` (`customerId`);
CREATE INDEX IF NOT EXISTS `idx_order_status` ON `Order` (`status`);
CREATE INDEX IF NOT EXISTS `idx_order_created` ON `Order` (`createdAt`);

-- OrderItem: batch-fetch items for many orders at once
CREATE INDEX IF NOT EXISTS `idx_orderitem_order` ON `OrderItem` (`orderId`);
CREATE INDEX IF NOT EXISTS `idx_orderitem_product` ON `OrderItem` (`productId`);

-- Review: product review listing
CREATE INDEX IF NOT EXISTS `idx_review_product` ON `Review` (`productId`);

-- Voucher: fast validate-by-code lookup
CREATE INDEX IF NOT EXISTS `idx_voucher_code` ON `Voucher` (`code`);

-- SubCategory: category join
CREATE INDEX IF NOT EXISTS `idx_subcategory_category` ON `SubCategory` (`categoryId`);


-- Add Foreign Key for Category -> Product (Resolved Circular Dependency)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Category'
    AND CONSTRAINT_NAME = 'fk_category_featured_product'
);

SET @fk_sql = IF(
  @fk_exists = 0,
  'ALTER TABLE `Category` ADD CONSTRAINT `fk_category_featured_product` FOREIGN KEY (`featuredProductId`) REFERENCES `Product`(`id`) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt FROM @fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
