-- ============================================================================
-- BASIS DATA RELASIONAL: WARKOP AGAM (VERSI 1.4 — ADAPTASI MYSQL 8.0+)
-- Restaurant Ordering & Management System
-- ============================================================================
-- Referensi Dokumen : PRD Warkop Agam v1.4 & Sistematika Tugas Besar MSBD USU
-- Target DBMS       : MySQL 8.0+ / MariaDB 10.6+ (Kompatibel dengan Prisma ORM)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS warkop_agam_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE warkop_agam_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- BAGIAN 1: PEMBERSIHAN OBJEK LAMA (IDEMPOTENT RESET)
-- ============================================================================
DROP VIEW IF EXISTS vw_daily_sales_summary;
DROP VIEW IF EXISTS vw_menu_availability;
DROP VIEW IF EXISTS vw_active_kitchen_queue;

DROP PROCEDURE IF EXISTS sp_adjust_product_stock;
DROP PROCEDURE IF EXISTS sp_release_expired_orders;
DROP PROCEDURE IF EXISTS sp_commit_reserved_stock;
DROP PROCEDURE IF EXISTS sp_reserve_product_stock;

DROP FUNCTION IF EXISTS fn_get_product_available_stock;
DROP FUNCTION IF EXISTS fn_check_table_qr_valid;
DROP FUNCTION IF EXISTS fn_calculate_order_total;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS restaurant_settings;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_item_options;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS table_qr_codes;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS product_stocks;
DROP TABLE IF EXISTS product_option_items;
DROP TABLE IF EXISTS product_option_groups;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- BAGIAN 2: DATA DEFINITION LANGUAGE (DDL) — 17 TABEL BASIS DATA (3NF)
-- ============================================================================

-- 1. Tabel users
CREATE TABLE users (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE,
    phone           VARCHAR(20) NOT NULL,
    password_hash   VARCHAR(255),
    role            VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_role CHECK (role IN ('CUSTOMER', 'CASHIER', 'ADMIN'))
) ENGINE=InnoDB;

-- 2. Tabel categories
CREATE TABLE categories (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(120) UNIQUE NOT NULL,
    description     TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at      TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Tabel products
CREATE TABLE products (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id     VARCHAR(36) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    base_price      DECIMAL(12, 2) NOT NULL,
    image_url       VARCHAR(255),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    deleted_at      TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_products_base_price CHECK (base_price >= 0)
) ENGINE=InnoDB;

-- 4. Tabel product_option_groups
CREATE TABLE product_option_groups (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id      VARCHAR(36) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    min_select      INT NOT NULL DEFAULT 0,
    max_select      INT NOT NULL DEFAULT 1,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_option_groups_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_option_groups_min CHECK (min_select >= 0),
    CONSTRAINT chk_option_groups_max CHECK (max_select >= 1 AND max_select >= min_select)
) ENGINE=InnoDB;

-- 5. Tabel product_option_items
CREATE TABLE product_option_items (
    id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    option_group_id  VARCHAR(36) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_available     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_option_items_group FOREIGN KEY (option_group_id) REFERENCES product_option_groups(id) ON DELETE CASCADE,
    CONSTRAINT chk_option_items_price CHECK (price_adjustment >= 0)
) ENGINE=InnoDB;

-- 6. Tabel product_stocks
CREATE TABLE product_stocks (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id      VARCHAR(36) UNIQUE NOT NULL,
    available_qty   INT NOT NULL DEFAULT 0,
    reserved_qty    INT NOT NULL DEFAULT 0,
    min_threshold   INT NOT NULL DEFAULT 5,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_stocks_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_stocks_available_qty CHECK (available_qty >= 0),
    CONSTRAINT chk_stocks_reserved_qty CHECK (reserved_qty >= 0),
    CONSTRAINT chk_stocks_min_threshold CHECK (min_threshold >= 0)
) ENGINE=InnoDB;

-- 7. Tabel tables
CREATE TABLE tables (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    table_number    VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(50) NOT NULL,
    capacity        INT NOT NULL DEFAULT 4,
    status          VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_tables_capacity CHECK (capacity > 0),
    CONSTRAINT chk_tables_status CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'INACTIVE'))
) ENGINE=InnoDB;

-- 8. Tabel table_qr_codes
CREATE TABLE table_qr_codes (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    table_id        VARCHAR(36) NOT NULL,
    token           VARCHAR(128) UNIQUE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    generated_by    VARCHAR(36),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at      TIMESTAMP NULL,
    CONSTRAINT fk_table_qr_table FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    CONSTRAINT fk_table_qr_generated_by FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Tabel orders
CREATE TABLE orders (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_number    VARCHAR(30) UNIQUE NOT NULL,
    user_id         VARCHAR(36),
    table_id        VARCHAR(36),
    customer_name   VARCHAR(100) NOT NULL,
    customer_phone  VARCHAR(20) NOT NULL,
    tracking_token  VARCHAR(128) UNIQUE,
    source          VARCHAR(15) NOT NULL,
    service_type    VARCHAR(15) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    subtotal        DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount      DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    notes           TEXT,
    expires_at      TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
    CONSTRAINT chk_orders_source CHECK (source IN ('WEB', 'POS')),
    CONSTRAINT chk_orders_service_type CHECK (service_type IN ('DINE_IN', 'TAKEAWAY')),
    CONSTRAINT chk_orders_status CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_orders_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_orders_total CHECK (total_amount >= 0),
    CONSTRAINT chk_orders_dine_in_table CHECK (
        (service_type = 'DINE_IN' AND table_id IS NOT NULL) OR (service_type = 'TAKEAWAY')
    )
) ENGINE=InnoDB;

-- 10. Tabel stock_movements
CREATE TABLE stock_movements (
    id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id       VARCHAR(36) NOT NULL,
    order_id         VARCHAR(36),
    actor_id         VARCHAR(36),
    movement_type    VARCHAR(30) NOT NULL,
    qty_change       INT NOT NULL,
    available_before INT NOT NULL,
    available_after  INT NOT NULL,
    reserved_before  INT NOT NULL DEFAULT 0,
    reserved_after   INT NOT NULL DEFAULT 0,
    reason           VARCHAR(255),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_stock_movements_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_stock_movements_type CHECK (
        movement_type IN (
            'INITIAL_STOCK', 'RESTOCK', 'DAMAGED_EXPIRED',
            'OPNAME_CORRECTION', 'RESERVE', 'RELEASE_RESERVE',
            'SALE_DEDUCTION', 'REFUND_RESTORE'
        )
    )
) ENGINE=InnoDB;

-- 11. Tabel order_items
CREATE TABLE order_items (
    id                    VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id              VARCHAR(36) NOT NULL,
    product_id            VARCHAR(36) NOT NULL,
    product_name_snapshot VARCHAR(120) NOT NULL,
    unit_price_snapshot   DECIMAL(12, 2) NOT NULL,
    quantity              INT NOT NULL,
    subtotal              DECIMAL(12, 2) NOT NULL,
    item_notes            VARCHAR(255),
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price_snapshot >= 0),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_subtotal CHECK (subtotal >= 0)
) ENGINE=InnoDB;

-- 12. Tabel order_item_options
CREATE TABLE order_item_options (
    id                          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_item_id               VARCHAR(36) NOT NULL,
    option_item_id              VARCHAR(36),
    option_group_name_snapshot  VARCHAR(100) NOT NULL,
    option_name_snapshot        VARCHAR(100) NOT NULL,
    price_adjustment_snapshot   DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_order_item_options_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_item_options_ref FOREIGN KEY (option_item_id) REFERENCES product_option_items(id) ON DELETE SET NULL,
    CONSTRAINT chk_order_item_options_price CHECK (price_adjustment_snapshot >= 0)
) ENGINE=InnoDB;

-- 13. Tabel payments
CREATE TABLE payments (
    id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id        VARCHAR(36) UNIQUE NOT NULL,
    cashier_id      VARCHAR(36),
    method          VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    amount_due      DECIMAL(12, 2) NOT NULL,
    amount_paid     DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    change_amount   DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_at         TIMESTAMP NULL,
    refunded_at     TIMESTAMP NULL,
    refund_reason   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_payments_method CHECK (method IN ('CASH', 'QRIS', 'VIRTUAL_ACCOUNT')),
    CONSTRAINT chk_payments_status CHECK (status IN ('UNPAID', 'PAID', 'FAILED', 'REFUNDED')),
    CONSTRAINT chk_payments_amount_due CHECK (amount_due >= 0),
    CONSTRAINT chk_payments_amount_paid CHECK (amount_paid >= 0),
    CONSTRAINT chk_payments_change_amount CHECK (change_amount >= 0)
) ENGINE=InnoDB;

-- 14. Tabel payment_transactions
CREATE TABLE payment_transactions (
    id                     VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    payment_id             VARCHAR(36) NOT NULL,
    gateway_provider       VARCHAR(50) NOT NULL DEFAULT 'MIDTRANS',
    gateway_order_id       VARCHAR(100) NOT NULL,
    gateway_transaction_id VARCHAR(100) UNIQUE,
    payment_type           VARCHAR(50),
    transaction_status     VARCHAR(50) NOT NULL,
    gross_amount           DECIMAL(12, 2) NOT NULL,
    signature_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    raw_payload            JSON,
    received_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_tx_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    CONSTRAINT chk_payment_tx_amount CHECK (gross_amount >= 0)
) ENGINE=InnoDB;

-- 15. Tabel receipts
CREATE TABLE receipts (
    id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id         VARCHAR(36) NOT NULL,
    payment_id       VARCHAR(36) NOT NULL,
    printed_by       VARCHAR(36),
    receipt_number   VARCHAR(40) UNIQUE NOT NULL,
    paper_size       VARCHAR(10) NOT NULL DEFAULT '58MM',
    print_count      INT NOT NULL DEFAULT 1,
    receipt_snapshot JSON,
    printed_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_receipts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    CONSTRAINT fk_receipts_printed_by FOREIGN KEY (printed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_receipts_paper_size CHECK (paper_size IN ('58MM', '80MM')),
    CONSTRAINT chk_receipts_print_count CHECK (print_count >= 1)
) ENGINE=InnoDB;

-- 16. Tabel restaurant_settings
CREATE TABLE restaurant_settings (
    id                      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    restaurant_name         VARCHAR(120) NOT NULL DEFAULT 'Warkop Agam',
    address                 TEXT,
    phone_whatsapp          VARCHAR(20),
    opening_hours           VARCHAR(100),
    is_web_ordering_open    BOOLEAN NOT NULL DEFAULT TRUE,
    tax_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    tax_percentage          DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    digital_expiry_minutes  INT NOT NULL DEFAULT 15,
    cash_expiry_minutes     INT NOT NULL DEFAULT 30,
    receipt_footer_note     TEXT,
    updated_by              VARCHAR(36),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_settings_tax CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
    CONSTRAINT chk_settings_digital_exp CHECK (digital_expiry_minutes > 0),
    CONSTRAINT chk_settings_cash_exp CHECK (cash_expiry_minutes > 0)
) ENGINE=InnoDB;

-- 17. Tabel audit_logs
CREATE TABLE audit_logs (
    id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    actor_id    VARCHAR(36),
    actor_role  VARCHAR(20),
    entity_name VARCHAR(60) NOT NULL,
    entity_id   VARCHAR(36) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    old_data    JSON,
    new_data    JSON,
    reason      TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- BAGIAN 3: INDEKS PERFORMA
-- ============================================================================
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_products_category_active ON products (category_id, is_available, deleted_at);
CREATE INDEX idx_orders_table_status ON orders (table_id, status);
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_pending_expires ON orders (status, expires_at);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_item_options_item_id ON order_item_options (order_item_id);
CREATE INDEX idx_stock_movements_product_created ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_table_qr_active_token ON table_qr_codes (token, is_active);
CREATE INDEX idx_audit_logs_entity_created ON audit_logs (entity_name, entity_id, created_at DESC);

-- ============================================================================
-- BAGIAN 4: DATABASE VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW vw_daily_sales_summary AS
SELECT
    DATE(o.created_at) AS sales_date,
    COUNT(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.id END) AS successful_orders,
    COUNT(CASE WHEN o.status = 'CANCELLED' THEN o.id END) AS cancelled_orders,
    CAST(COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.subtotal ELSE 0 END), 0) AS DECIMAL(12, 2)) AS gross_sales,
    CAST(COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.tax_amount ELSE 0 END), 0) AS DECIMAL(12, 2)) AS total_tax,
    CAST(COALESCE(SUM(CASE WHEN p.status = 'REFUNDED' THEN o.total_amount ELSE 0 END), 0) AS DECIMAL(12, 2)) AS total_refund,
    CAST(COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.total_amount ELSE 0 END), 0) AS DECIMAL(12, 2)) AS net_sales,
    CAST(COALESCE(AVG(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.total_amount END), 0) AS DECIMAL(12, 2)) AS average_order_value
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
GROUP BY DATE(o.created_at)
ORDER BY sales_date DESC;

CREATE OR REPLACE VIEW vw_menu_availability AS
SELECT
    pr.id AS product_id,
    pr.name AS product_name,
    pr.description,
    pr.base_price,
    pr.image_url,
    pr.sort_order,
    c.id AS category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    COALESCE(ps.available_qty, 0) AS available_qty,
    COALESCE(ps.reserved_qty, 0) AS reserved_qty,
    COALESCE(ps.min_threshold, 5) AS min_threshold,
    pr.is_available,
    CASE
        WHEN pr.deleted_at IS NOT NULL OR pr.is_available = FALSE OR COALESCE(ps.available_qty, 0) <= 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(ps.available_qty, 0) <= COALESCE(ps.min_threshold, 5) THEN 'LOW_STOCK'
        ELSE 'AVAILABLE'
    END AS availability_status
FROM products pr
INNER JOIN categories c ON c.id = pr.category_id
LEFT JOIN product_stocks ps ON ps.product_id = pr.id
WHERE pr.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.is_active = TRUE;

CREATE OR REPLACE VIEW vw_active_kitchen_queue AS
SELECT
    o.id AS order_id,
    o.order_number,
    o.source,
    o.service_type,
    o.status AS order_status,
    o.customer_name,
    o.customer_phone,
    t.table_number,
    t.name AS table_name,
    o.total_amount,
    o.notes AS order_notes,
    p.method AS payment_method,
    p.status AS payment_status,
    o.expires_at,
    o.created_at
FROM orders o
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
ORDER BY o.created_at ASC;

-- ============================================================================
-- BAGIAN 5: TRIGGERS BASIS DATA
-- ============================================================================
DELIMITER //

CREATE TRIGGER trg_audit_product_price
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    DECLARE v_action VARCHAR(50);
    DECLARE v_actor_id VARCHAR(36);
    DECLARE v_actor_role VARCHAR(20);

    SET v_actor_id = NULLIF(@app_current_user_id, '');
    SET v_actor_role = COALESCE(NULLIF(@app_current_user_role, ''), 'SYSTEM');

    IF (OLD.base_price <> NEW.base_price)
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN

        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            SET v_action = 'SOFT_DELETE_PRODUCT';
        ELSEIF OLD.base_price <> NEW.base_price THEN
            SET v_action = 'UPDATE_PRODUCT_PRICE';
        ELSE
            SET v_action = 'RESTORE_PRODUCT';
        END IF;

        INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data)
        VALUES (
            UUID(), v_actor_id, v_actor_role, 'products', NEW.id, v_action,
            JSON_OBJECT('name', OLD.name, 'base_price', OLD.base_price, 'is_available', OLD.is_available, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('name', NEW.name, 'base_price', NEW.base_price, 'is_available', NEW.is_available, 'deleted_at', NEW.deleted_at)
        );
    END IF;
END//

CREATE TRIGGER trg_sync_product_availability
AFTER UPDATE ON product_stocks
FOR EACH ROW
BEGIN
    IF NEW.available_qty = 0 AND OLD.available_qty > 0 THEN
        UPDATE products SET is_available = FALSE WHERE id = NEW.product_id AND is_available = TRUE;
    ELSEIF NEW.available_qty > 0 AND OLD.available_qty = 0 THEN
        UPDATE products SET is_available = TRUE WHERE id = NEW.product_id AND deleted_at IS NULL AND is_available = FALSE;
    END IF;
END//

CREATE TRIGGER trg_audit_payment_status
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    DECLARE v_actor_id VARCHAR(36);
    DECLARE v_actor_role VARCHAR(20);

    IF OLD.status <> NEW.status THEN
        SET v_actor_id = COALESCE(NEW.cashier_id, NULLIF(@app_current_user_id, ''));
        SET v_actor_role = COALESCE(NULLIF(@app_current_user_role, ''), 'SYSTEM');

        INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data, reason)
        VALUES (
            UUID(), v_actor_id, v_actor_role, 'payments', NEW.id, 'UPDATE_PAYMENT_STATUS',
            JSON_OBJECT('order_id', OLD.order_id, 'status', OLD.status, 'amount_paid', OLD.amount_paid),
            JSON_OBJECT('order_id', NEW.order_id, 'status', NEW.status, 'amount_paid', NEW.amount_paid, 'paid_at', NEW.paid_at),
            NEW.refund_reason
        );
    END IF;
END//

CREATE TRIGGER trg_prevent_hard_delete_product
BEFORE DELETE ON products
FOR EACH ROW
BEGIN
    DECLARE v_tx_count INT DEFAULT 0;
    DECLARE v_err_msg VARCHAR(255);

    SELECT COUNT(*) INTO v_tx_count FROM order_items WHERE product_id = OLD.id;
    IF v_tx_count > 0 THEN
        SET v_err_msg = CONCAT('Produk "', OLD.name, '" tidak boleh dihapus permanen karena memiliki ', v_tx_count, ' riwayat transaksi. Gunakan Soft Delete.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;
END//

-- ============================================================================
-- BAGIAN 6: STORED FUNCTIONS & STORED PROCEDURES
-- ============================================================================
CREATE FUNCTION fn_check_table_qr_valid(
    p_table_id VARCHAR(36),
    p_token    VARCHAR(128)
)
RETURNS BOOLEAN
READS SQL DATA
BEGIN
    DECLARE v_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_count
    FROM table_qr_codes qr
    INNER JOIN tables t ON t.id = qr.table_id
    WHERE qr.table_id = p_table_id
      AND qr.token = p_token
      AND qr.is_active = TRUE
      AND qr.revoked_at IS NULL
      AND t.is_active = TRUE;

    RETURN (v_count > 0);
END//

CREATE FUNCTION fn_get_product_available_stock(p_product_id VARCHAR(36))
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_qty INT DEFAULT 0;

    SELECT ps.available_qty INTO v_qty
    FROM product_stocks ps
    INNER JOIN products pr ON pr.id = ps.product_id
    WHERE ps.product_id = p_product_id
      AND pr.deleted_at IS NULL
      AND pr.is_available = TRUE
    LIMIT 1;

    RETURN COALESCE(v_qty, 0);
END//

CREATE FUNCTION fn_calculate_order_total(p_order_id VARCHAR(36))
RETURNS DECIMAL(12, 2)
READS SQL DATA
BEGIN
    DECLARE v_subtotal     DECIMAL(12, 2) DEFAULT 0.00;
    DECLARE v_tax_enabled  BOOLEAN DEFAULT FALSE;
    DECLARE v_tax_pct      DECIMAL(5, 2) DEFAULT 0.00;
    DECLARE v_tax_amount   DECIMAL(12, 2) DEFAULT 0.00;

    SELECT COALESCE(SUM(subtotal), 0.00) INTO v_subtotal
    FROM order_items
    WHERE order_id = p_order_id;

    SELECT tax_enabled, tax_percentage
    INTO v_tax_enabled, v_tax_pct
    FROM restaurant_settings
    LIMIT 1;

    IF COALESCE(v_tax_enabled, FALSE) THEN
        SET v_tax_amount = ROUND(v_subtotal * (COALESCE(v_tax_pct, 0) / 100.0), 2);
    ELSE
        SET v_tax_amount = 0.00;
    END IF;

    RETURN (v_subtotal + v_tax_amount);
END//

CREATE PROCEDURE sp_reserve_product_stock(
    IN p_product_id VARCHAR(36),
    IN p_qty        INT,
    IN p_order_id   VARCHAR(36)
)
BEGIN
    DECLARE v_avail_before    INT;
    DECLARE v_reserved_before INT;
    DECLARE v_avail_after     INT;
    DECLARE v_reserved_after  INT;
    DECLARE v_is_deleted      TIMESTAMP;
    DECLARE v_product_exists  INT DEFAULT 0;
    DECLARE v_err_msg         VARCHAR(255);

    IF p_qty <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Jumlah porsi reservasi harus > 0';
    END IF;

    SELECT COUNT(*), MAX(deleted_at)
    INTO v_product_exists, v_is_deleted
    FROM products
    WHERE id = p_product_id;

    IF v_product_exists = 0 OR v_is_deleted IS NOT NULL THEN
        SET v_err_msg = CONCAT('Produk ', p_product_id, ' tidak ditemukan atau nonaktif');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    SELECT available_qty, reserved_qty
    INTO v_avail_before, v_reserved_before
    FROM product_stocks
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF v_avail_before IS NULL THEN
        SET v_err_msg = CONCAT('Data stok produk ', p_product_id, ' belum dikonfigurasi');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    IF v_avail_before < p_qty THEN
        SET v_err_msg = CONCAT('Stok tidak mencukupi untuk produk ', p_product_id, ' (tersedia: ', v_avail_before, ', diminta: ', p_qty, ')');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    SET v_avail_after = v_avail_before - p_qty;
    SET v_reserved_after = v_reserved_before + p_qty;

    UPDATE product_stocks
    SET available_qty = v_avail_after,
        reserved_qty  = v_reserved_after
    WHERE product_id = p_product_id;

    INSERT INTO stock_movements (
        id, product_id, order_id, movement_type, qty_change,
        available_before, available_after, reserved_before, reserved_after, reason
    ) VALUES (
        UUID(), p_product_id, p_order_id, 'RESERVE', -p_qty,
        v_avail_before, v_avail_after, v_reserved_before, v_reserved_after,
        'Reservasi stok otomatis saat checkout pesanan'
    );
END//

CREATE PROCEDURE sp_commit_reserved_stock(
    IN p_order_id VARCHAR(36),
    IN p_actor_id VARCHAR(36)
)
BEGIN
    DECLARE v_done            INT DEFAULT FALSE;
    DECLARE v_product_id      VARCHAR(36);
    DECLARE v_total_qty       INT;
    DECLARE v_avail_before    INT;
    DECLARE v_reserved_before INT;
    DECLARE v_reserved_after  INT;

    DECLARE cur_items CURSOR FOR
        SELECT product_id, SUM(quantity) AS total_qty
        FROM order_items
        WHERE order_id = p_order_id
        GROUP BY product_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur_items;
    read_loop: LOOP
        FETCH cur_items INTO v_product_id, v_total_qty;
        IF v_done THEN
            LEAVE read_loop;
        END IF;

        SELECT available_qty, reserved_qty
        INTO v_avail_before, v_reserved_before
        FROM product_stocks
        WHERE product_id = v_product_id
        FOR UPDATE;

        SET v_reserved_after = GREATEST(v_reserved_before - v_total_qty, 0);

        UPDATE product_stocks
        SET reserved_qty = v_reserved_after
        WHERE product_id = v_product_id;

        INSERT INTO stock_movements (
            id, product_id, order_id, actor_id, movement_type, qty_change,
            available_before, available_after, reserved_before, reserved_after, reason
        ) VALUES (
            UUID(), v_product_id, p_order_id, p_actor_id, 'SALE_DEDUCTION', 0,
            v_avail_before, v_avail_before, v_reserved_before, v_reserved_after,
            'Konfirmasi penjualan final setelah pembayaran lunas (PAID)'
        );
    END LOOP;
    CLOSE cur_items;
END//

CREATE PROCEDURE sp_release_expired_orders()
BEGIN
    DECLARE v_done_order      INT DEFAULT FALSE;
    DECLARE v_order_id        VARCHAR(36);
    DECLARE v_avail_before    INT;
    DECLARE v_reserved_before INT;
    DECLARE v_avail_after     INT;
    DECLARE v_reserved_after  INT;
    DECLARE v_release_qty     INT;

    DECLARE cur_orders CURSOR FOR
        SELECT o.id
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'PENDING'
          AND o.expires_at IS NOT NULL
          AND o.expires_at < CURRENT_TIMESTAMP
          AND COALESCE(p.status, 'UNPAID') = 'UNPAID'
        FOR UPDATE SKIP LOCKED;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_order = TRUE;

    OPEN cur_orders;
    order_loop: LOOP
        FETCH cur_orders INTO v_order_id;
        IF v_done_order THEN
            LEAVE order_loop;
        END IF;

        BEGIN
            DECLARE v_done_item INT DEFAULT FALSE;
            DECLARE v_prod_id   VARCHAR(36);
            DECLARE v_qty       INT;

            DECLARE cur_order_items CURSOR FOR
                SELECT product_id, SUM(quantity)
                FROM order_items
                WHERE order_id = v_order_id
                GROUP BY product_id;

            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_item = TRUE;

            OPEN cur_order_items;
            item_loop: LOOP
                FETCH cur_order_items INTO v_prod_id, v_qty;
                IF v_done_item THEN
                    LEAVE item_loop;
                END IF;

                SELECT available_qty, reserved_qty
                INTO v_avail_before, v_reserved_before
                FROM product_stocks
                WHERE product_id = v_prod_id
                FOR UPDATE;

                SET v_release_qty    = LEAST(v_qty, v_reserved_before);
                SET v_avail_after    = v_avail_before + v_release_qty;
                SET v_reserved_after = v_reserved_before - v_release_qty;

                UPDATE product_stocks
                SET available_qty = v_avail_after,
                    reserved_qty  = v_reserved_after
                WHERE product_id = v_prod_id;

                INSERT INTO stock_movements (
                    id, product_id, order_id, movement_type, qty_change,
                    available_before, available_after, reserved_before, reserved_after, reason
                ) VALUES (
                    UUID(), v_prod_id, v_order_id, 'RELEASE_RESERVE', v_release_qty,
                    v_avail_before, v_avail_after, v_reserved_before, v_reserved_after,
                    'Auto-cancel pesanan kedaluwarsa melewati batas waktu pembayaran'
                );
            END LOOP;
            CLOSE cur_order_items;
        END;

        UPDATE orders
        SET status = 'CANCELLED',
            notes  = CONCAT(COALESCE(CONCAT(notes, ' | '), ''), '[SYSTEM] Dibatalkan otomatis karena melewati batas waktu pembayaran.')
        WHERE id = v_order_id;

        UPDATE payments
        SET status = 'FAILED'
        WHERE order_id = v_order_id AND status = 'UNPAID';
    END LOOP;
    CLOSE cur_orders;
END//

CREATE PROCEDURE sp_adjust_product_stock(
    IN p_product_id    VARCHAR(36),
    IN p_qty_delta     INT,
    IN p_movement_type VARCHAR(30),
    IN p_actor_id      VARCHAR(36),
    IN p_reason        VARCHAR(255)
)
BEGIN
    DECLARE v_avail_before    INT;
    DECLARE v_reserved_before INT;
    DECLARE v_avail_after     INT;
    DECLARE v_err_msg         VARCHAR(255);

    IF p_movement_type NOT IN ('RESTOCK', 'DAMAGED_EXPIRED', 'OPNAME_CORRECTION', 'REFUND_RESTORE') THEN
        SET v_err_msg = CONCAT('Jenis mutasi stok tidak valid untuk penyesuaian manual: ', p_movement_type);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    SELECT available_qty, reserved_qty
    INTO v_avail_before, v_reserved_before
    FROM product_stocks
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF v_avail_before IS NULL THEN
        SET v_err_msg = CONCAT('Record stok untuk produk ', p_product_id, ' tidak ditemukan');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    SET v_avail_after = v_avail_before + p_qty_delta;
    IF v_avail_after < 0 THEN
        SET v_err_msg = CONCAT('Penyesuaian stok ditolak karena hasil akhir menjadi negatif (', v_avail_before, ' + ', p_qty_delta, ' = ', v_avail_after, ')');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    UPDATE product_stocks
    SET available_qty = v_avail_after
    WHERE product_id = p_product_id;

    INSERT INTO stock_movements (
        id, product_id, actor_id, movement_type, qty_change,
        available_before, available_after, reserved_before, reserved_after, reason
    ) VALUES (
        UUID(), p_product_id, p_actor_id, p_movement_type, p_qty_delta,
        v_avail_before, v_avail_after, v_reserved_before, v_reserved_before, p_reason
    );

    INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data, reason)
    VALUES (
        UUID(), p_actor_id, 'ADMIN', 'product_stocks', p_product_id, 'MANUAL_STOCK_ADJUSTMENT',
        JSON_OBJECT('available_qty', v_avail_before),
        JSON_OBJECT('available_qty', v_avail_after, 'movement_type', p_movement_type),
        p_reason
    );
END//

DELIMITER ;

-- ============================================================================
-- BAGIAN 7: DATA CONTROL LANGUAGE (DCL)
-- ============================================================================
CREATE ROLE IF NOT EXISTS 'warkop_admin_db', 'warkop_cashier_user', 'warkop_customer_user';

GRANT ALL PRIVILEGES ON warkop_agam_db.* TO 'warkop_admin_db';

GRANT SELECT ON warkop_agam_db.categories TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.products TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.product_option_groups TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.product_option_items TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.product_stocks TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.restaurant_settings TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.vw_menu_availability TO 'warkop_cashier_user';
GRANT SELECT ON warkop_agam_db.vw_active_kitchen_queue TO 'warkop_cashier_user';
GRANT SELECT, UPDATE ON warkop_agam_db.tables TO 'warkop_cashier_user';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.orders TO 'warkop_cashier_user';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.order_items TO 'warkop_cashier_user';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.order_item_options TO 'warkop_cashier_user';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.payments TO 'warkop_cashier_user';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.receipts TO 'warkop_cashier_user';
GRANT SELECT, INSERT ON warkop_agam_db.stock_movements TO 'warkop_cashier_user';
GRANT SELECT, INSERT ON warkop_agam_db.audit_logs TO 'warkop_cashier_user';
GRANT EXECUTE ON PROCEDURE warkop_agam_db.sp_reserve_product_stock TO 'warkop_cashier_user';
GRANT EXECUTE ON PROCEDURE warkop_agam_db.sp_commit_reserved_stock TO 'warkop_cashier_user';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_calculate_order_total TO 'warkop_cashier_user';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_get_product_available_stock TO 'warkop_cashier_user';

GRANT SELECT ON warkop_agam_db.categories TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.products TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.product_option_groups TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.product_option_items TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.product_stocks TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.tables TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.table_qr_codes TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.restaurant_settings TO 'warkop_customer_user';
GRANT SELECT ON warkop_agam_db.vw_menu_availability TO 'warkop_customer_user';
GRANT SELECT, INSERT ON warkop_agam_db.orders TO 'warkop_customer_user';
GRANT SELECT, INSERT ON warkop_agam_db.order_items TO 'warkop_customer_user';
GRANT SELECT, INSERT ON warkop_agam_db.order_item_options TO 'warkop_customer_user';
GRANT SELECT, INSERT ON warkop_agam_db.payments TO 'warkop_customer_user';
GRANT SELECT, INSERT ON warkop_agam_db.payment_transactions TO 'warkop_customer_user';
GRANT SELECT, UPDATE ON warkop_agam_db.users TO 'warkop_customer_user';
GRANT EXECUTE ON PROCEDURE warkop_agam_db.sp_reserve_product_stock TO 'warkop_customer_user';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_calculate_order_total TO 'warkop_customer_user';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_check_table_qr_valid TO 'warkop_customer_user';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_get_product_available_stock TO 'warkop_customer_user';

FLUSH PRIVILEGES;

-- ============================================================================
-- BAGIAN 8: DATA MANIPULATION LANGUAGE (DML) — SEED DATA WARKOP AGAM
-- ============================================================================
INSERT INTO users (id, name, email, phone, password_hash, role, is_active) VALUES
('usr-admin-001', 'Bang Agam (Owner)', 'admin@warkopagam.id', '081260001001', '$2b$12$examplehashedpasswordadmin0000000000000000000001', 'ADMIN', TRUE),
('usr-cashier-001', 'Rizky Pratama', 'rizky.kasir@warkopagam.id', '081260001002', '$2b$12$examplehashedpasswordcashier00000000000000000002', 'CASHIER', TRUE),
('usr-cashier-002', 'Siti Rahma', 'siti.kasir@warkopagam.id', '081260001003', '$2b$12$examplehashedpasswordcashier00000000000000000003', 'CASHIER', TRUE),
('usr-cust-001', 'Andi Saputra', 'andi.customer@gmail.com', '085270002001', '$2b$12$examplehashedpasswordcust00000000000000000000004', 'CUSTOMER', TRUE),
('usr-cust-002', 'Dina Marlina', 'dina.customer@gmail.com', '085270002002', '$2b$12$examplehashedpasswordcust00000000000000000000005', 'CUSTOMER', TRUE);

INSERT INTO restaurant_settings (
    id, restaurant_name, address, phone_whatsapp, opening_hours,
    is_web_ordering_open, tax_enabled, tax_percentage,
    digital_expiry_minutes, cash_expiry_minutes, receipt_footer_note, updated_by
) VALUES (
    'set-main-001', 'Warkop Agam',
    'Jl. H. Misbah No. 14, Medan Maimun, Kota Medan, Sumatera Utara',
    '6281260001001', 'Senin - Minggu, 07.00 - 02.00 WIB',
    TRUE, TRUE, 10.00, 15, 30,
    'Terima kasih telah bersantai di Warkop Agam! WiFi: WarkopAgam_Guest',
    'usr-admin-001'
);

INSERT INTO categories (id, name, slug, description, sort_order, is_active) VALUES
('cat-kopi-01', 'Kopi & Minuman Hangat', 'kopi-minuman-hangat', 'Racikan kopi saring khas Aceh-Medan dan teh tarik legendaris.', 1, TRUE),
('cat-dingin-02', 'Minuman Dingin & Segar', 'minuman-dingin-segar', 'Minuman dingin penyegar dahaga khas warkop.', 2, TRUE),
('cat-mie-03', 'Mie & Makanan Berat', 'mie-makanan-berat', 'Indomie Bangladesh, nasi goreng, dan hidangan mengenyangkan.', 3, TRUE),
('cat-camilan-04', 'Roti Bakar & Camilan', 'roti-bakar-camilan', 'Teman ngopi santai mulai dari roti bakar hingga martabak mie.', 4, TRUE);

INSERT INTO products (id, category_id, name, description, base_price, image_url, is_available, sort_order) VALUES
('prd-sanger-01', 'cat-kopi-01', 'Kopi Sanger Espresso', 'Perpaduan kopi robusta saring kental dengan susu kental manis pas takaran.', 14000.00, '/images/menu/kopi-sanger.webp', TRUE, 1),
('prd-tehtarik-02', 'cat-kopi-01', 'Teh Tarik Aceh', 'Teh hitam pilihan ditarik berbusa lembut dengan susu creamy.', 13000.00, '/images/menu/teh-tarik.webp', TRUE, 2),
('prd-kopihitam-03', 'cat-kopi-01', 'Kopi Hitam Ulee Kareng', 'Kopi hitam khas Aceh dengan aroma kuat dan rasa autentik.', 10000.00, '/images/menu/kopi-hitam.webp', TRUE, 3),
('prd-milo-04', 'cat-dingin-02', 'Es Milo Kepal Warkop', 'Es Milo kental dingin dengan taburan bubuk Milo melimpah.', 16000.00, '/images/menu/es-milo.webp', TRUE, 1),
('prd-badak-05', 'cat-dingin-02', 'Es Soda Susu Badak', 'Minuman legendaris Sumatera Utara: limun Sarsaparilla Badak dengan susu.', 15000.00, '/images/menu/soda-badak.webp', TRUE, 2),
('prd-bangladesh-06', 'cat-mie-03', 'Indomie Bangladesh Spesial', 'Mie nyemek racikan bumbu rempah rahasia Warkop Agam dengan telur setengah matang.', 18000.00, '/images/menu/indomie-bangladesh.webp', TRUE, 1),
('prd-nasgor-07', 'cat-mie-03', 'Nasi Goreng Kampung Agam', 'Nasi goreng bumbu terasi ringan, suwiran ayam, telur mata sapi, dan kerupuk.', 22000.00, '/images/menu/nasi-goreng.webp', TRUE, 2),
('prd-rotibakar-08', 'cat-camilan-04', 'Roti Bakar Cokelat Keju', 'Roti panggang garing di luar lembut di dalam dengan isian cokelat lumer dan keju parut.', 15000.00, '/images/menu/roti-bakar.webp', TRUE, 1);

INSERT INTO product_option_groups (id, product_id, name, is_required, min_select, max_select, sort_order) VALUES
('og-sanger-suhu', 'prd-sanger-01', 'Suhu Penyajian', TRUE, 1, 1, 1),
('og-sanger-gula', 'prd-sanger-01', 'Tingkat Manis', TRUE, 1, 1, 2),
('og-tehtarik-suhu', 'prd-tehtarik-02', 'Suhu Penyajian', TRUE, 1, 1, 1),
('og-bangladesh-pedas', 'prd-bangladesh-06', 'Level Pedas', TRUE, 1, 1, 1),
('og-bangladesh-topping', 'prd-bangladesh-06', 'Tambahan Topping', FALSE, 0, 3, 2);

INSERT INTO product_option_items (id, option_group_id, name, price_adjustment, is_available, sort_order) VALUES
('oi-sanger-panas', 'og-sanger-suhu', 'Panas', 0.00, TRUE, 1),
('oi-sanger-dingin', 'og-sanger-suhu', 'Dingin (Es)', 2000.00, TRUE, 2),
('oi-sanger-normal', 'og-sanger-gula', 'Manis Normal', 0.00, TRUE, 1),
('oi-sanger-less', 'og-sanger-gula', 'Less Sugar', 0.00, TRUE, 2),
('oi-tehtarik-panas', 'og-tehtarik-suhu', 'Panas', 0.00, TRUE, 1),
('oi-tehtarik-dingin', 'og-tehtarik-suhu', 'Dingin (Es)', 2000.00, TRUE, 2),
('oi-pedas-sedang', 'og-bangladesh-pedas', 'Pedas Sedang (Standar)', 0.00, TRUE, 1),
('oi-pedas-ekstra', 'og-bangladesh-pedas', 'Pedas Ekstra', 0.00, TRUE, 2),
('oi-pedas-tidak', 'og-bangladesh-pedas', 'Tidak Pedas', 0.00, TRUE, 3),
('oi-top-telur', 'og-bangladesh-topping', 'Tambah Telur Setengah Matang', 4000.00, TRUE, 1),
('oi-top-sosis', 'og-bangladesh-topping', 'Tambah Sosis Ayam', 5000.00, TRUE, 2),
('oi-top-keju', 'og-bangladesh-topping', 'Tambah Keju Parut', 4000.00, TRUE, 3);

INSERT INTO product_stocks (id, product_id, available_qty, reserved_qty, min_threshold) VALUES
('stk-01', 'prd-sanger-01', 50, 0, 10),
('stk-02', 'prd-tehtarik-02', 45, 0, 10),
('stk-03', 'prd-kopihitam-03', 60, 0, 10),
('stk-04', 'prd-milo-04', 30, 0, 5),
('stk-05', 'prd-badak-05', 24, 0, 6),
('stk-06', 'prd-bangladesh-06', 40, 0, 8),
('stk-07', 'prd-nasgor-07', 25, 0, 5),
('stk-08', 'prd-rotibakar-08', 35, 0, 5);

INSERT INTO stock_movements (
    id, product_id, actor_id, movement_type, qty_change,
    available_before, available_after, reserved_before, reserved_after, reason
)
SELECT
    UUID(), product_id, 'usr-admin-001', 'INITIAL_STOCK', available_qty,
    0, available_qty, 0, 0, 'Inisialisasi stok porsi harian Warkop Agam'
FROM product_stocks;

INSERT INTO tables (id, table_number, name, capacity, status, is_active) VALUES
('tbl-01', '01', 'Meja 01 (Indoor)', 4, 'AVAILABLE', TRUE),
('tbl-02', '02', 'Meja 02 (Indoor)', 4, 'AVAILABLE', TRUE),
('tbl-03', '03', 'Meja 03 (Indoor)', 2, 'AVAILABLE', TRUE),
('tbl-04', '04', 'Meja 04 (Teras)', 4, 'AVAILABLE', TRUE),
('tbl-05', '05', 'Meja 05 (Teras)', 6, 'AVAILABLE', TRUE),
('tbl-06', '06', 'Meja 06 (VIP)', 8, 'AVAILABLE', TRUE);

INSERT INTO table_qr_codes (id, table_id, token, is_active, generated_by) VALUES
('qr-01', 'tbl-01', 'qr_tok_agam_m01_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c', TRUE, 'usr-admin-001'),
('qr-02', 'tbl-02', 'qr_tok_agam_m02_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', TRUE, 'usr-admin-001'),
('qr-03', 'tbl-03', 'qr_tok_agam_m03_7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f', TRUE, 'usr-admin-001'),
('qr-04', 'tbl-04', 'qr_tok_agam_m04_4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', TRUE, 'usr-admin-001'),
('qr-05', 'tbl-05', 'qr_tok_agam_m05_2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', TRUE, 'usr-admin-001'),
('qr-06', 'tbl-06', 'qr_tok_agam_m06_8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d', TRUE, 'usr-admin-001');

