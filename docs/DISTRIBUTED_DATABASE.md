# DOKUMENTASI ARSITEKTUR DATABASE TERDISTRIBUSI & CONCURRENCY
## Warkop Agam Restaurant Management System
**Penyusun:** Gabriel (Kelompok 3 MSBD USU)  
**Versi:** 1.0  
**Target Basis Data:** MySQL 8.0+ / TiDB (Distributed NewSQL)

---

## 1. Latar Belakang & Filosofi Arsitektur

Pada sistem pemesanan restoran dengan intensitas transaksi tinggi (seperti Warkop Agam pada jam-jam sibuk), sistem dihadapkan pada tantangan beban konkuren:
1. **Pemesanan Serentak (Race Condition pada Stok Produk):** Puluhan pelanggan memesan menu favorit (contoh: *Indomie Bangladesh Spesial* atau *Kopi Sanger*) dalam detik yang sama ketika stok tersisa sedikit.
2. **Perebutan Meja (Table Contention):** Beberapa pelanggan memindai QR code meja yang sama dalam waktu bersamaan.
3. **Pembayaran dan Settlement Kasir:** Transaksi pembayaran harus atomic (ACID) dan konsisten antara mutasi uang kasir, perubahan status order, pelepasan meja, dan pencatatan audit.

Berdasarkan kebutuhan ini, sistem dirancang dengan kesiapan arsitektur **Distributed NewSQL (TiDB)** dan **Pessimistic Concurrency Control (MySQL InnoDB)**.

---

## 2. Distributed SQL Architecture (TiDB / MySQL Cluster)

Sistem Warkop Agam menggunakan model pemisahan lapisan komputasi (*stateless compute*) dan lapisan penyimpanan (*distributed storage engine*).

```
+-----------------------------------------------------------------------+
|                 APLIKASI CLIENT / FRONTEND / KDS                      |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    NEXT.JS APPLICATION LAYER (NODE.JS)                |
|       Prisma ORM Client / Database Object Integration Layer           |
+-----------------------------------------------------------------------+
                                   |
                  [Load Balanced Connection Pool]
                                   v
+-----------------------------------------------------------------------+
|                      COMPUTE NODES (TiDB Server)                      |
|   - Stateless SQL Parser & Optimizer                                  |
|   - Distributed Execution Engine                                      |
|   - Two-Phase Commit (2PC) Coordinator                                |
+-----------------------------------------------------------------------+
                                   |
                      [Raft Consensus Protocol]
                                   v
+-----------------------------------------------------------------------+
|                  STORAGE NODES (TiKV / InnoDB Replicas)               |
|   - Sharded Range-based Key-Value Storage (Regions)                   |
|   - Multi-Raft Replication (Paxos/Raft Leader-Follower)               |
|   - Multi-Version Concurrency Control (MVCC)                          |
+-----------------------------------------------------------------------+
```

### Karakteristik Distributed Engine:
1. **Horizontal Scalability:** Lapisan komputasi (*Compute Nodes*) dapat ditambah sesuai lonjakan pengunjung warkop tanpa *downtime*.
2. **Strong Consistency (Linearizability):** Menggunakan konsensus **Raft** pada lapisan penyimpanan sehingga setiap penulisan (*write*) dijamin konsisten di seluruh replika sebelum dinyatakan sukses.
3. **High Availability (HA):** Jika salah satu node penyimpanan mati, Raft leader election secara otomatis mengalihkan tugas ke node replika aktif dalam hitungan milidetik.

---

## 3. Strategi Pengendalian Konkurensi Tinggi (Concurrency Control)

Untuk menjamin agar tidak terjadi *overselling* (stok minus) atau anomali *double booking* meja, sistem menerapkan 4 tingkat perlindungan:

### 3.1. Pessimistic Locking (`SELECT ... FOR UPDATE`)
Pada level penyimpanan basis data, seluruh operasi penyesuaian kuantitas produk dan reservasi meja menggunakan penguncian baris eksklusif (*row-level exclusive lock*).
Contoh implementasi pada Stored Procedure `sp_adjust_product_stock`:
```sql
SELECT available_qty, reserved_qty
INTO v_avail_before, v_reserved_before
FROM product_stocks
WHERE product_id = p_product_id
FOR UPDATE;
```
Ketika transaksi A sedang mengunci baris produk ini, transaksi B yang datang bersamaan akan masuk ke antrean tunggu sampai transaksi A melakukan `COMMIT` atau `ROLLBACK`.

### 3.2. Two-Phase Stock Lifecycle (Reserve -> Commit / Release)
Sistem memisahkan alur pengurangan stok menjadi dua fase:
1. **Fase Reservasi (`sp_reserve_product_stock`):** Dijalankan saat pelanggan menekan tombol *Checkout*. Stok dipindahkan dari `available_qty` ke `reserved_qty`.
2. **Fase Eksekusi / Finalisasi:**
   - **Lunas (`sp_commit_reserved_stock`):** Stok dalam `reserved_qty` dikurangi permanen, mencatat log mutasi `OUT_SALES`.
   - **Kadaluwarsa / Batal (`sp_release_expired_orders`):** Stok dalam `reserved_qty` dikembalikan utuh ke `available_qty`.

### 3.3. Database Constraint & Autonomous Triggers
Bukan hanya bergantung pada validasi aplikasi, database memiliki trigger protektif:
- `trg_validate_stock_non_negative`: Membatalkan transaksi seketika dengan `SIGNAL SQLSTATE '45000'` bila nilai stok porsi < 0.
- `trg_limit_single_admin_insert` & `trg_limit_single_admin_update`: Mencegah lebih dari satu akun ADMIN aktif di level database engine.
- `trg_prevent_hard_delete_user`: Memaksa penerapan Soft Delete pada tabel `users`.
- `trg_audit_order_status_change`: Merekam seluruh riwayat perubahan status pesanan ke tabel `audit_logs`.

### 3.4. Idempotency Token
Untuk mencegah pemesanan ganda akibat double tap atau gangguan jaringan seluler di sisi pelanggan:
Setiap *checkout payload* menyertakan `idempotencyKey` unik. Sistem memverifikasi cache idempotency sebelum transaksi dieksekusi ke basis data.

---

## 4. Hak Akses dan Role-Based Access Control (DCL)

Keamanan basis data terdistribusi dijamin dengan pembatasan hak akses berbasis peran (DCL):

| Role Database | Keterangan & Batasan Akses | Objek yang Diakses |
|---|---|---|
| `warkop_admin_role` | Administrator Pemilik | Hak penuh (`ALL PRIVILEGES`) pada seluruh skema basis data |
| `warkop_cashier_role` | Kasir Pembayaran & Meja | `SELECT/UPDATE` pada `orders`, `tables`, `payments`, `receipts`, eksekusi `sp_complete_and_clear_table` |
| `warkop_chef_role` | Koki & Kru Dapur (KDS) | `SELECT` pada `vw_active_kitchen_queue`, `UPDATE (status)` pada `orders`, ketersediaan menu |
| `warkop_customer_role` | Pelanggan Restoran | `SELECT` katalog aktif, `INSERT` pesanan, eksekusi `fn_check_table_qr_valid` & `sp_reserve_product_stock` |

---

## 5. Ringkasan Objek Database yang Diintegrasikan

1. **Views (7 Objek):**
   - `vw_daily_sales_summary`
   - `vw_menu_availability`
   - `vw_active_kitchen_queue`
   - `vw_table_occupancy_status`
   - `vw_top_selling_products`
   - `vw_payment_method_summary`
   - `vw_staff_activity_summary`
2. **Functions (6 Objek):**
   - `fn_check_table_qr_valid`
   - `fn_get_product_available_stock`
   - `fn_calculate_order_total`
   - `fn_get_effective_table_status`
   - `fn_format_rupiah`
   - `fn_get_daily_net_revenue`
3. **Stored Procedures (7 Objek):**
   - `sp_reserve_product_stock`
   - `sp_commit_reserved_stock`
   - `sp_release_expired_orders`
   - `sp_adjust_product_stock`
   - `sp_complete_and_clear_table`
   - `sp_sales_report_by_range`
   - `sp_rotate_table_qr_token`
4. **Triggers (10 Objek):**
   - `trg_audit_product_price`, `trg_sync_product_availability`, `trg_audit_payment_status`
   - `trg_prevent_hard_delete_product`, `trg_audit_order_status_change`, `trg_validate_stock_non_negative`
   - `trg_audit_table_qr_revocation`, `trg_limit_single_admin_insert`, `trg_limit_single_admin_update`
   - `trg_prevent_hard_delete_user`
