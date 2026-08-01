import fs from 'fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { orderNumberPrefix, formatOrderNumber } from './utils/orderNumber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const dbName = process.env.DB_NAME;

if (!dbName) {
    throw new Error('DB_NAME is required in the environment configuration.');
}

const baseConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
};

const pool = mysql.createPool({
    ...baseConfig,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    typeCast(field, next) {
        if (field.type === 'JSON') {
            const value = field.string();
            return value ? JSON.parse(value) : null;
        }

        // MariaDB reports JSON columns as BLOB/LONGTEXT, so they arrive unparsed.
        if (field.type === 'BLOB' && ['sizes', 'colors', 'images', 'measurements', 'measurementGroups'].includes(field.name)) {
            try {
                const value = field.string();
                return value ? JSON.parse(value) : null;
            } catch {
                return field.string();
            }
        }

        return next();
    }
});

/* async function legacyTestConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Database Connected Successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Database Connection Failed:', error.message);
    }
}
*/


const columnMigrations = [
    { table: 'Banner', column: 'title', definition: 'VARCHAR(191) NULL' },
    { table: 'Banner', column: 'subtitle', definition: 'VARCHAR(191) NULL' },
    { table: 'Banner', column: 'discountText', definition: 'VARCHAR(191) NULL' },
    { table: 'Banner', column: 'description', definition: 'TEXT NULL' },
    { table: 'Banner', column: 'createdAt', definition: 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)' },
    { table: 'Category', column: 'displayOrder', definition: 'INT DEFAULT 0' },
    { table: 'Category', column: 'featuredProductId', definition: 'INT NULL' },
    { table: 'Category', column: 'featuredProductList', definition: 'JSON NULL' },
    { table: 'Category', column: 'showOnHome', definition: 'TINYINT(1) DEFAULT 1' },
    { table: 'Customer', column: 'phone', definition: 'VARCHAR(191) NULL' },
    { table: 'Customer', column: 'location', definition: 'VARCHAR(191) NULL' },
    { table: 'Customer', column: 'address', definition: 'TEXT NULL' },
    { table: 'Customer', column: 'city', definition: 'VARCHAR(191) NULL' },
    { table: 'Customer', column: 'zip', definition: 'VARCHAR(191) NULL' },
    { table: 'Order', column: 'guestName', definition: 'VARCHAR(191) NULL' },
    { table: 'Order', column: 'guestPhone', definition: 'VARCHAR(191) NULL' },
    { table: 'Order', column: 'discountAmount', definition: 'DOUBLE DEFAULT 0' },
    { table: 'Order', column: 'voucherCode', definition: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'Order', column: 'cancellationReason', definition: 'TEXT NULL' },
    { table: 'Order', column: 'specialNote', definition: 'TEXT NULL' },
    { table: 'Order', column: 'shippingAddress', definition: 'TEXT NULL' },
    { table: 'Order', column: 'paymentMethod', definition: "VARCHAR(191) DEFAULT 'MFS'" },
    // Unguessable per-order key so a guest can re-download their order slip without an account.
    { table: 'Order', column: 'slipToken', definition: 'VARCHAR(64) DEFAULT NULL' },
    // Customer-facing reference (DDMMYY + daily sequence); see server/utils/orderNumber.js.
    { table: 'Order', column: 'orderNumber', definition: 'VARCHAR(20) DEFAULT NULL' },
    // Made-to-measure values submitted per item; keys come from server/utils/measurements.js.
    { table: 'OrderItem', column: 'measurements', definition: 'JSON NULL' },
    { table: 'SiteSettings', column: 'mfsNumbers', definition: 'TEXT NULL' },
    { table: 'SiteSettings', column: 'mfsInstructions', definition: 'TEXT NULL' },
    { table: 'PopupAd', column: 'subCategoryId', definition: 'INT NULL' },
    { table: 'Review', column: 'sortOrder', definition: 'INT DEFAULT 0' },
    { table: 'SiteSettings', column: 'deliveryChargeInside', definition: 'INT DEFAULT 60' },
    { table: 'SiteSettings', column: 'deliveryChargeOutside', definition: 'INT DEFAULT 120' },
    { table: 'Product', column: 'originalPrice', definition: 'VARCHAR(191) NULL' },
    { table: 'Product', column: 'sizeStock', definition: 'JSON NULL' },
    { table: 'Product', column: 'sizeChartId', definition: 'INT DEFAULT NULL' },
    { table: 'Product', column: 'isFreeShipping', definition: 'TINYINT(1) DEFAULT 0' },
    // Which measurement groups a product needs; NULL means all of them, so products
    // created before this feature keep asking for everything until an admin narrows it.
    { table: 'Product', column: 'measurementGroups', definition: 'JSON NULL' },
    { table: 'Customer', column: 'emailVerified', definition: 'TINYINT(1) DEFAULT 0' },
    { table: 'Customer', column: 'emailOtp', definition: 'VARCHAR(6) NULL' },
    { table: 'Customer', column: 'emailOtpExpiry', definition: 'DATETIME NULL' },
    { table: 'Customer', column: 'resetOtp', definition: 'VARCHAR(6) NULL' },
    { table: 'Customer', column: 'resetOtpExpiry', definition: 'DATETIME NULL' },
    { table: 'Voucher', column: 'appliesTo', definition: "ENUM('all','category','subcategory') DEFAULT 'all'" },
    { table: 'Voucher', column: 'appliesToId', definition: 'INT NULL' },
];

const columnAlterations = [
    { table: 'Order', column: 'customerId', definition: 'INT NULL' }
];

const schemaPath = path.join(__dirname, 'schema.sql');

const getBootstrapStatements = () => {
    const rawSchema = fs.readFileSync(schemaPath, 'utf8');

    return rawSchema
        .split(/\r?\n/)
        .filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('--');
        })
        .join('\n')
        .split(/;\s*(?:\r?\n|$)/)
        .map(statement => statement.trim())
        .filter(Boolean)
        .filter(statement => !/^SET\s+FOREIGN_KEY_CHECKS/i.test(statement))
        .filter(statement => !/^DROP TABLE/i.test(statement))
        .filter(statement => !/^INSERT INTO\s+`?Admin`?/i.test(statement))
        .filter(statement => !/^ALTER TABLE\s+`?Category`?/i.test(statement))
        .map(statement => {
            if (/^CREATE TABLE\s+IF\s+NOT\s+EXISTS/i.test(statement)) {
                return statement;
            }

            if (/^CREATE TABLE/i.test(statement)) {
                return statement.replace(/^CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS');
            }

            return statement;
        });
};

const ensureDatabaseExists = async () => {
    const connection = await mysql.createConnection(baseConfig);

    try {
        const escapedDbName = dbName.replace(/`/g, '``');
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${escapedDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
        await connection.end();
    }
};

const ensureDefaultAdmin = async connection => {
    const [existing] = await connection.query('SELECT 1 FROM `Admin` WHERE `username` = ?', ['admin']);
    if (existing.length === 0) {
        const hash = await bcrypt.hash('adminpassword123', 10);
        await connection.query('INSERT INTO `Admin` (`username`, `password`) VALUES (?, ?)', ['admin', hash]);
    }
};

const ensureColumnExists = async (connection, table, column, definition) => {
    const [rows] = await connection.query(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [table, column]
    );

    if (rows.length === 0) {
        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
};

const ensureColumnMigrations = async connection => {
    for (const migration of columnMigrations) {
        await ensureColumnExists(connection, migration.table, migration.column, migration.definition);
    }
};

const ensureColumnDefinition = async (connection, table, column, definition, matcher) => {
    const [rows] = await connection.query(
        `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [table, column]
    );

    if (rows.length === 0) {
        return;
    }

    if (!matcher(rows[0])) {
        await connection.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
    }
};

const ensureColumnAlterations = async connection => {
    for (const alteration of columnAlterations) {
        if (alteration.table === 'Order' && alteration.column === 'customerId') {
            await ensureColumnDefinition(
                connection,
                alteration.table,
                alteration.column,
                alteration.definition,
                column => column.IS_NULLABLE === 'YES'
            );
        }
    }
};

const ensureCategoryFeaturedProductForeignKey = async connection => {
    const [rows] = await connection.query(
        `SELECT 1
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        ['Category', 'fk_category_featured_product']
    );

    if (rows.length === 0) {
        await connection.query(`
            ALTER TABLE \`Category\`
            ADD CONSTRAINT \`fk_category_featured_product\`
            FOREIGN KEY (\`featuredProductId\`) REFERENCES \`Product\`(\`id\`) ON DELETE SET NULL
        `);
    }
};

// Orders created before order numbers existed get one derived from their own date, so no
// order in the system is left without a reference. Sequences follow insertion order within
// each day. Runs once — afterwards there are no NULLs left to fill.
const ensureOrderNumbers = async connection => {
    const [rows] = await connection.query(
        'SELECT id, createdAt FROM `Order` WHERE orderNumber IS NULL ORDER BY createdAt ASC, id ASC'
    );

    if (rows.length > 0) {
        // Continue from the highest sequence already used on each day.
        const [used] = await connection.query(
            'SELECT LEFT(orderNumber, 6) AS prefix, MAX(CAST(SUBSTRING(orderNumber, 7) AS UNSIGNED)) AS maxSeq'
            + ' FROM `Order` WHERE orderNumber IS NOT NULL GROUP BY LEFT(orderNumber, 6)'
        );
        const nextByPrefix = new Map(used.map(r => [r.prefix, Number(r.maxSeq) || 0]));

        for (const row of rows) {
            const date = row.createdAt ? new Date(row.createdAt) : new Date();
            const prefix = orderNumberPrefix(date);
            const sequence = (nextByPrefix.get(prefix) || 0) + 1;
            nextByPrefix.set(prefix, sequence);
            await connection.query('UPDATE `Order` SET orderNumber = ? WHERE id = ?', [
                formatOrderNumber(date, sequence), row.id,
            ]);
        }
        console.log(`Assigned order numbers to ${rows.length} existing order(s)`);
    }

    // Bring the day counters up to whatever the Order table already uses, so the first
    // order after an upgrade cannot be handed a number that is taken.
    await connection.query(`
        INSERT INTO OrderSequence (dayKey, lastSequence)
        SELECT LEFT(orderNumber, 6), MAX(CAST(SUBSTRING(orderNumber, 7) AS UNSIGNED))
        FROM \`Order\` WHERE orderNumber IS NOT NULL
        GROUP BY LEFT(orderNumber, 6)
        ON DUPLICATE KEY UPDATE lastSequence = GREATEST(lastSequence, VALUES(lastSequence))
    `);
};

const ensureIndexes = async connection => {
    const indexes = [
        { table: 'Customer',     name: 'idx_customer_email',        col: '(`email`)' },
        { table: 'Product',      name: 'idx_product_category',      col: '(`categoryId`)' },
        { table: 'Product',      name: 'idx_product_subcategory',   col: '(`subCategoryId`)' },
        { table: 'Product',      name: 'idx_product_new_arrival',   col: '(`isNewArrival`, `createdAt`)' },
        { table: 'Product',      name: 'idx_product_free_shipping', col: '(`isFreeShipping`)' },
        { table: 'Order',        name: 'idx_order_customer',        col: '(`customerId`)' },
        { table: 'Order',        name: 'idx_order_status',          col: '(`status`)' },
        { table: 'Order',        name: 'idx_order_created',         col: '(`createdAt`)' },
        // The admin order list filters by status within a date range and sorts/filters by
        // value, which these two cover.
        { table: 'Order',        name: 'idx_order_status_created',  col: '(`status`, `createdAt`)' },
        { table: 'Order',        name: 'idx_order_total',           col: '(`totalAmount`)' },
        // UNIQUE is what makes concurrent orders safe: two requests racing for the same
        // daily sequence cannot both succeed, and the loser retries with the next number.
        { table: 'Order',        name: 'uq_order_number',           col: '(`orderNumber`)', unique: true },
        { table: 'OrderItem',    name: 'idx_orderitem_order',       col: '(`orderId`)' },
        { table: 'OrderItem',    name: 'idx_orderitem_product',     col: '(`productId`)' },
        { table: 'Review',       name: 'idx_review_product',        col: '(`productId`)' },
        { table: 'Voucher',      name: 'idx_voucher_code',          col: '(`code`)' },
        { table: 'SubCategory',  name: 'idx_subcategory_category',  col: '(`categoryId`)' },
    ];

    for (const { table, name, col, unique } of indexes) {
        const [rows] = await connection.query(
            `SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
            [table, name]
        );
        if (rows.length === 0) {
            await connection.query(
                `CREATE ${unique ? 'UNIQUE ' : ''}INDEX \`${name}\` ON \`${table}\` ${col}`
            );
        }
    }
};

const ensureSchema = async () => {
    const connection = await pool.getConnection();

    try {
        const statements = getBootstrapStatements();

        for (const statement of statements) {
            await connection.query(statement);
        }

        await ensureColumnMigrations(connection);
        await ensureColumnAlterations(connection);
        await ensureDefaultAdmin(connection);
        await ensureCategoryFeaturedProductForeignKey(connection);
        // Backfill before the indexes, so the UNIQUE index is built on data that is
        // already unique rather than failing on a table full of NULL duplicates.
        await ensureOrderNumbers(connection);
        await ensureIndexes(connection);
    } finally {
        connection.release();
    }
};

const testConnection = async () => {
    const connection = await pool.getConnection();

    try {
        await connection.ping();
        console.log('MySQL database connected successfully');
    } finally {
        connection.release();
    }
};

export const initializeDatabase = async () => {
    await ensureDatabaseExists();
    await ensureSchema();
    await testConnection();
};

export default pool;
