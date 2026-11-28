-- ============================================================================
-- WARKOP AGAM MEDAN - DATABASE VIEWS, TRIGGERS, FUNCTIONS & PROCEDURES
-- Dapat dijalankan ulang secara aman (idempoten) tanpa mengubah alur aplikasi.
-- ============================================================================

USE warkop_agam_db;

-- ============================================================================
-- 1. DATABASE VIEWS (7 Views)
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

CREATE OR REPLACE VIEW vw_table_occupancy_status AS
SELECT
    t.id AS table_id,
    t.table_number,
    t.name AS table_name,
    t.capacity,
    t.is_active,
    t.status AS stored_status,
    CASE
        WHEN t.is_active = FALSE THEN 'INACTIVE'
        WHEN t.status = 'OCCUPIED' OR COALESCE(ao.active_order_count, 0) > 0 THEN 'OCCUPIED'
        ELSE 'AVAILABLE'
    END AS effective_status,
    COALESCE(ao.active_order_count, 0) AS active_order_count,
    CAST(COALESCE(ao.active_order_total, 0) AS DECIMAL(12, 2)) AS active_order_total,
    qr.token AS active_qr_token,
    t.updated_at
FROM tables t
LEFT JOIN (
    SELECT
        table_id,
        COUNT(*) AS active_order_count,
        SUM(total_amount) AS active_order_total
    FROM orders
    WHERE service_type = 'DINE_IN'
      AND table_id IS NOT NULL
      AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
    GROUP BY table_id
) ao ON ao.table_id = t.id
LEFT JOIN table_qr_codes qr ON qr.table_id = t.id AND qr.is_active = TRUE;

CREATE OR REPLACE VIEW vw_top_selling_products AS
SELECT
    pr.id AS product_id,
    pr.name AS product_name,
    c.name AS category_name,
    pr.base_price,
    COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN oi.quantity ELSE 0 END), 0) AS total_qty_sold,
    COUNT(DISTINCT CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN o.id END) AS paid_order_count,
    CAST(COALESCE(SUM(CASE WHEN o.status <> 'CANCELLED' AND p.status = 'PAID' THEN oi.subtotal ELSE 0 END), 0) AS DECIMAL(12, 2)) AS total_revenue
FROM products pr
INNER JOIN categories c ON c.id = pr.category_id
LEFT JOIN order_items oi ON oi.product_id = pr.id
LEFT JOIN orders o ON o.id = oi.order_id
LEFT JOIN payments p ON p.order_id = o.id
WHERE pr.deleted_at IS NULL
GROUP BY pr.id, pr.name, c.name, pr.base_price
ORDER BY total_qty_sold DESC, total_revenue DESC;

CREATE OR REPLACE VIEW vw_payment_method_summary AS
SELECT
    p.method AS payment_method,
    p.status AS payment_status,
    COUNT(*) AS transaction_count,
    CAST(COALESCE(SUM(p.amount_due), 0) AS DECIMAL(12, 2)) AS total_amount_due,
    CAST(COALESCE(SUM(p.amount_paid), 0) AS DECIMAL(12, 2)) AS total_amount_paid
FROM payments p
GROUP BY p.method, p.status
ORDER BY p.method ASC, p.status ASC;

CREATE OR REPLACE VIEW vw_staff_activity_summary AS
SELECT
    u.id AS user_id,
    u.name,
    u.email,
    u.phone,
    u.role,
    u.is_active,
    COALESCE(al.audit_count, 0) AS audit_log_count,
    COALESCE(pm.handled_payments_count, 0) AS handled_payments_count,
    CAST(COALESCE(pm.handled_payments_total, 0) AS DECIMAL(12, 2)) AS handled_payments_total
FROM users u
LEFT JOIN (
    SELECT actor_id, COUNT(*) AS audit_count
    FROM audit_logs
    WHERE actor_id IS NOT NULL
    GROUP BY actor_id
) al ON al.actor_id = u.id
LEFT JOIN (
    SELECT cashier_id, COUNT(*) AS handled_payments_count, SUM(amount_paid) AS handled_payments_total
    FROM payments
    WHERE cashier_id IS NOT NULL AND status = 'PAID'
    GROUP BY cashier_id
) pm ON pm.cashier_id = u.id
WHERE u.role IN ('ADMIN', 'CASHIER');

-- ============================================================================
-- 2. TRIGGERS BASIS DATA (10 Triggers — Aman terhadap Prisma Transaction)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_audit_product_price;
DROP TRIGGER IF EXISTS trg_sync_product_availability;
DROP TRIGGER IF EXISTS trg_audit_payment_status;
DROP TRIGGER IF EXISTS trg_prevent_hard_delete_product;
DROP TRIGGER IF EXISTS trg_audit_order_status_change;
DROP TRIGGER IF EXISTS trg_validate_stock_non_negative;
DROP TRIGGER IF EXISTS trg_audit_table_qr_revocation;
DROP TRIGGER IF EXISTS trg_limit_single_admin_insert;
DROP TRIGGER IF EXISTS trg_limit_single_admin_update;
DROP TRIGGER IF EXISTS trg_prevent_hard_delete_user;

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
            UUID(), v_actor_id, v_actor_role, 'payments', NEW.id, 'DB_TRIGGER_PAYMENT_STATUS',
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

CREATE TRIGGER trg_audit_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    DECLARE v_actor_id VARCHAR(36);
    DECLARE v_actor_role VARCHAR(20);

    IF OLD.status <> NEW.status THEN
        SET v_actor_id = NULLIF(@app_current_user_id, '');
        SET v_actor_role = COALESCE(NULLIF(@app_current_user_role, ''), 'SYSTEM');

        INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data, reason)
        VALUES (
            UUID(),
            v_actor_id,
            v_actor_role,
            'orders',
            NEW.id,
            'DB_TRIGGER_ORDER_STATUS',
            JSON_OBJECT('order_number', OLD.order_number, 'status', OLD.status),
            JSON_OBJECT('order_number', NEW.order_number, 'status', NEW.status),
            CONCAT('Perubahan status pesanan ', NEW.order_number, ': ', OLD.status, ' -> ', NEW.status)
        );
    END IF;
END//

CREATE TRIGGER trg_validate_stock_non_negative
BEFORE UPDATE ON product_stocks
FOR EACH ROW
BEGIN
    DECLARE v_err_msg VARCHAR(255);

    IF NEW.available_qty < 0 OR NEW.reserved_qty < 0 THEN
        SET v_err_msg = CONCAT('Stok produk ', NEW.product_id, ' tidak boleh negatif (available=', NEW.available_qty, ', reserved=', NEW.reserved_qty, ')');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;
END//

CREATE TRIGGER trg_audit_table_qr_revocation
AFTER UPDATE ON table_qr_codes
FOR EACH ROW
BEGIN
    DECLARE v_actor_id VARCHAR(36);
    DECLARE v_actor_role VARCHAR(20);

    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        SET v_actor_id = COALESCE(NULLIF(@app_current_user_id, ''), NEW.generated_by);
        SET v_actor_role = COALESCE(NULLIF(@app_current_user_role, ''), 'SYSTEM');

        INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, old_data, new_data, reason)
        VALUES (
            UUID(),
            v_actor_id,
            v_actor_role,
            'table_qr_codes',
            NEW.id,
            'DB_TRIGGER_REVOKE_QR',
            JSON_OBJECT('table_id', OLD.table_id, 'token', LEFT(OLD.token, 16), 'is_active', OLD.is_active),
            JSON_OBJECT('table_id', NEW.table_id, 'token', LEFT(NEW.token, 16), 'is_active', NEW.is_active, 'revoked_at', NEW.revoked_at),
            'Token QR meja dinonaktifkan'
        );
    END IF;
END//

-- 8. Trigger Pembatasan Single Admin (INSERT)
CREATE TRIGGER trg_limit_single_admin_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    DECLARE v_active_admin_count INT DEFAULT 0;

    IF NEW.role = 'ADMIN' AND NEW.is_active = TRUE AND NEW.deleted_at IS NULL THEN
        SELECT COUNT(*) INTO v_active_admin_count
        FROM users
        WHERE role = 'ADMIN' AND is_active = TRUE AND deleted_at IS NULL;

        IF v_active_admin_count >= 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pelanggaran Aturan: Sistem hanya diperbolehkan memiliki satu akun ADMIN yang aktif.';
        END IF;
    END IF;
END//

-- 9. Trigger Pembatasan Single Admin (UPDATE)
CREATE TRIGGER trg_limit_single_admin_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    DECLARE v_other_admin_count INT DEFAULT 0;

    IF NEW.role = 'ADMIN' AND NEW.is_active = TRUE AND NEW.deleted_at IS NULL THEN
        SELECT COUNT(*) INTO v_other_admin_count
        FROM users
        WHERE role = 'ADMIN'
          AND is_active = TRUE
          AND deleted_at IS NULL
          AND id <> OLD.id;

        IF v_other_admin_count >= 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pelanggaran Aturan: Sistem hanya diperbolehkan memiliki satu akun ADMIN yang aktif.';
        END IF;
    END IF;
END//

-- 10. Trigger Mencegah Hard Delete Akun Pengguna (Enforce Soft Delete)
CREATE TRIGGER trg_prevent_hard_delete_user
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Penghapusan akun permanen (Hard Delete) dilarang. Gunakan mekanisme Soft Delete (set deleted_at dan is_active=false).';
END//

DELIMITER ;

-- ============================================================================
-- 3. STORED FUNCTIONS (6 Functions — DETERMINISTIC agar kompatibel binlog)
-- ============================================================================

DROP FUNCTION IF EXISTS fn_check_table_qr_valid;
DROP FUNCTION IF EXISTS fn_get_product_available_stock;
DROP FUNCTION IF EXISTS fn_calculate_order_total;
DROP FUNCTION IF EXISTS fn_get_effective_table_status;
DROP FUNCTION IF EXISTS fn_format_rupiah;
DROP FUNCTION IF EXISTS fn_get_daily_net_revenue;

DELIMITER //

CREATE FUNCTION fn_check_table_qr_valid(
    p_table_id VARCHAR(36),
    p_token    VARCHAR(128)
)
RETURNS BOOLEAN
DETERMINISTIC
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
DETERMINISTIC
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
DETERMINISTIC
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

CREATE FUNCTION fn_get_effective_table_status(p_table_id VARCHAR(36))
RETURNS VARCHAR(20)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_is_active     BOOLEAN DEFAULT TRUE;
    DECLARE v_stored_status VARCHAR(20) DEFAULT 'AVAILABLE';
    DECLARE v_active_orders INT DEFAULT 0;

    SELECT is_active, status
    INTO v_is_active, v_stored_status
    FROM tables
    WHERE id = p_table_id
    LIMIT 1;

    IF v_is_active IS NULL THEN
        RETURN 'UNKNOWN';
    END IF;

    IF v_is_active = FALSE THEN
        RETURN 'INACTIVE';
    END IF;

    SELECT COUNT(*) INTO v_active_orders
    FROM orders
    WHERE table_id = p_table_id
      AND service_type = 'DINE_IN'
      AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY');

    IF v_stored_status = 'OCCUPIED' OR v_active_orders > 0 THEN
        RETURN 'OCCUPIED';
    END IF;

    RETURN 'AVAILABLE';
END//

CREATE FUNCTION fn_format_rupiah(p_amount DECIMAL(12, 2))
RETURNS VARCHAR(40)
DETERMINISTIC
NO SQL
BEGIN
    RETURN CONCAT('Rp ', REPLACE(FORMAT(ROUND(COALESCE(p_amount, 0), 0), 0), ',', '.'));
END//

CREATE FUNCTION fn_get_daily_net_revenue(p_target_date DATE)
RETURNS DECIMAL(12, 2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(12, 2) DEFAULT 0.00;

    SELECT COALESCE(SUM(o.total_amount), 0.00)
    INTO v_total
    FROM orders o
    INNER JOIN payments p ON p.order_id = o.id
    WHERE DATE(o.created_at) = p_target_date
      AND o.status <> 'CANCELLED'
      AND p.status = 'PAID';

    RETURN COALESCE(v_total, 0.00);
END//

DELIMITER ;

-- ============================================================================
-- 4. STORED PROCEDURES (7 Procedures)
-- ============================================================================

DROP PROCEDURE IF EXISTS sp_reserve_product_stock;
DROP PROCEDURE IF EXISTS sp_commit_reserved_stock;
DROP PROCEDURE IF EXISTS sp_release_expired_orders;
DROP PROCEDURE IF EXISTS sp_adjust_product_stock;
DROP PROCEDURE IF EXISTS sp_complete_and_clear_table;
DROP PROCEDURE IF EXISTS sp_sales_report_by_range;
DROP PROCEDURE IF EXISTS sp_rotate_table_qr_token;

DELIMITER //

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
    DECLARE v_is_deleted      DATETIME;
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
    DECLARE v_table_id        VARCHAR(36);
    DECLARE v_active_cnt      INT DEFAULT 0;
    DECLARE v_avail_before    INT;
    DECLARE v_reserved_before INT;
    DECLARE v_avail_after     INT;
    DECLARE v_reserved_after  INT;
    DECLARE v_release_qty     INT;

    DECLARE cur_orders CURSOR FOR
        SELECT o.id, o.table_id
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'PENDING'
          AND o.expires_at IS NOT NULL
          AND o.expires_at < UTC_TIMESTAMP()
          AND COALESCE(p.status, 'UNPAID') = 'UNPAID'
        FOR UPDATE SKIP LOCKED;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done_order = TRUE;

    OPEN cur_orders;
    order_loop: LOOP
        FETCH cur_orders INTO v_order_id, v_table_id;
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

        IF v_table_id IS NOT NULL THEN
            SELECT COUNT(*)
            INTO v_active_cnt
            FROM orders
            WHERE table_id = v_table_id
              AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY');

            IF v_active_cnt = 0 THEN
                UPDATE tables
                SET status = 'AVAILABLE'
                WHERE id = v_table_id;

                UPDATE table_sessions
                SET status = 'CLOSED',
                    closed_at = UTC_TIMESTAMP()
                WHERE table_id = v_table_id AND status = 'ACTIVE';
            END IF;
        END IF;
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

CREATE PROCEDURE sp_complete_and_clear_table(
    IN p_table_number VARCHAR(20),
    IN p_actor_id     VARCHAR(36)
)
BEGIN
    DECLARE v_table_id     VARCHAR(36);
    DECLARE v_unpaid_count INT DEFAULT 0;
    DECLARE v_err_msg      VARCHAR(255);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT id INTO v_table_id
    FROM tables
    WHERE table_number = p_table_number
    LIMIT 1;

    IF v_table_id IS NULL THEN
        SET v_err_msg = CONCAT('Meja ', p_table_number, ' tidak ditemukan.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_unpaid_count
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.table_id = v_table_id
      AND o.service_type = 'DINE_IN'
      AND o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
      AND COALESCE(p.status, 'UNPAID') <> 'PAID'
    FOR UPDATE;

    IF v_unpaid_count > 0 THEN
        SET v_err_msg = CONCAT('Meja ', p_table_number, ' masih memiliki ', v_unpaid_count, ' pesanan belum lunas.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    UPDATE orders
    SET status = 'COMPLETED'
    WHERE table_id = v_table_id
      AND service_type = 'DINE_IN'
      AND status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY');

    UPDATE tables
    SET status = 'AVAILABLE'
    WHERE id = v_table_id;

    INSERT INTO audit_logs (id, actor_id, actor_role, entity_name, entity_id, action, new_data, reason)
    VALUES (
        UUID(),
        NULLIF(p_actor_id, ''),
        'STAFF',
        'tables',
        v_table_id,
        'SP_CLEAR_TABLE',
        JSON_OBJECT('table_number', p_table_number, 'status', 'AVAILABLE'),
        CONCAT('Pengosongan meja ', p_table_number, ' via sp_complete_and_clear_table')
    );

    COMMIT;
END//

CREATE PROCEDURE sp_sales_report_by_range(
    IN p_start_date DATE,
    IN p_end_date   DATE
)
BEGIN
    SELECT
        sales_date,
        successful_orders,
        cancelled_orders,
        gross_sales,
        total_tax,
        total_refund,
        net_sales,
        average_order_value
    FROM vw_daily_sales_summary
    WHERE sales_date BETWEEN p_start_date AND p_end_date
    ORDER BY sales_date ASC;
END//

CREATE PROCEDURE sp_rotate_table_qr_token(
    IN p_table_id  VARCHAR(36),
    IN p_new_token VARCHAR(128),
    IN p_actor_id  VARCHAR(36)
)
BEGIN
    DECLARE v_table_exists INT DEFAULT 0;
    DECLARE v_err_msg      VARCHAR(255);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT COUNT(*) INTO v_table_exists FROM tables WHERE id = p_table_id;
    IF v_table_exists = 0 THEN
        SET v_err_msg = CONCAT('Meja ', p_table_id, ' tidak ditemukan.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
    END IF;

    IF p_new_token IS NULL OR LENGTH(TRIM(p_new_token)) < 8 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Token QR baru minimal 8 karakter.';
    END IF;

    START TRANSACTION;

    UPDATE table_qr_codes
    SET is_active = FALSE,
        revoked_at = CURRENT_TIMESTAMP
    WHERE table_id = p_table_id
      AND is_active = TRUE;

    INSERT INTO table_qr_codes (id, table_id, token, is_active, generated_by)
    VALUES (UUID(), p_table_id, p_new_token, TRUE, NULLIF(p_actor_id, ''));

    COMMIT;
END//

DELIMITER ;

-- ============================================================================
-- 5. DATA CONTROL LANGUAGE (DCL) — HAK AKSES DAN MANAJEMEN ROLE PADA DATABASE
-- ============================================================================
-- Enforcement keamanan multi-tier pada level MySQL / TiDB DBMS.
-- Setiap role aplikasi dipetakan ke role database dengan privilege spesifik.
-- ============================================================================

-- Buat Roles Database
CREATE ROLE IF NOT EXISTS 'warkop_admin_role';
CREATE ROLE IF NOT EXISTS 'warkop_cashier_role';
CREATE ROLE IF NOT EXISTS 'warkop_customer_role';

-- A. HAK AKSES ROLE ADMIN:
-- Memiliki akses penuh atas seluruh tabel master, transaksional, view, dan eksekusi SP/Function
GRANT ALL PRIVILEGES ON warkop_agam_db.* TO 'warkop_admin_role';

-- B. HAK AKSES ROLE CASHIER (KASIR):
-- Hanya diperbolehkan membaca katalog, mengelola pembayaran, membaca pesanan dan meja, serta eksekusi settlement
GRANT SELECT ON warkop_agam_db.products TO 'warkop_cashier_role';
GRANT SELECT ON warkop_agam_db.categories TO 'warkop_cashier_role';
GRANT SELECT ON warkop_agam_db.product_stocks TO 'warkop_cashier_role';
GRANT SELECT, UPDATE ON warkop_agam_db.tables TO 'warkop_cashier_role';
GRANT SELECT, UPDATE (status) ON warkop_agam_db.orders TO 'warkop_cashier_role';
GRANT SELECT, INSERT, UPDATE ON warkop_agam_db.payments TO 'warkop_cashier_role';
GRANT SELECT, INSERT ON warkop_agam_db.receipts TO 'warkop_cashier_role';
GRANT SELECT ON warkop_agam_db.vw_table_occupancy_status TO 'warkop_cashier_role';
GRANT SELECT ON warkop_agam_db.vw_payment_method_summary TO 'warkop_cashier_role';
GRANT EXECUTE ON PROCEDURE warkop_agam_db.sp_complete_and_clear_table TO 'warkop_cashier_role';

-- C. HAK AKSES ROLE CUSTOMER (PELANGGAN):
-- Hanya diperbolehkan membaca menu yang aktif, cek validitas token QR, dan membuat pesanan
GRANT SELECT ON warkop_agam_db.vw_menu_availability TO 'warkop_customer_role';
GRANT SELECT ON warkop_agam_db.categories TO 'warkop_customer_role';
GRANT SELECT ON warkop_agam_db.products TO 'warkop_customer_role';
GRANT SELECT ON warkop_agam_db.product_option_groups TO 'warkop_customer_role';
GRANT SELECT ON warkop_agam_db.product_option_items TO 'warkop_customer_role';
GRANT SELECT, INSERT ON warkop_agam_db.orders TO 'warkop_customer_role';
GRANT SELECT, INSERT ON warkop_agam_db.order_items TO 'warkop_customer_role';
GRANT SELECT, INSERT ON warkop_agam_db.order_item_options TO 'warkop_customer_role';
GRANT SELECT ON warkop_agam_db.payments TO 'warkop_customer_role';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_check_table_qr_valid TO 'warkop_customer_role';
GRANT EXECUTE ON FUNCTION warkop_agam_db.fn_calculate_order_total TO 'warkop_customer_role';
GRANT EXECUTE ON PROCEDURE warkop_agam_db.sp_reserve_product_stock TO 'warkop_customer_role';
