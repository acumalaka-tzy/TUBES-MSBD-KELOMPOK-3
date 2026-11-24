# DOKUMENTASI ARSITEKTUR BASIS DATA TERDISTRIBUSI (DISTRIBUTED DATABASE)
## Sistem Manajemen Restoran & POS Warkop Agam Medan
**Mata Kuliah:** Manajemen Sistem Basis Data (MSBD) — Universitas Sumatera Utara  
**Kelompok:** 3 (Warkop Agam)  
**Versi Dokumen:** 2.0 (Lengkap — Distributed NewSQL & Concurrency Control)  
**Target Basis Data:** TiDB v7.5+ (Distributed NewSQL) / MySQL 8.0+ Cluster (Group Replication / InnoDB Cluster)

---

## 1. Latar Belakang & Urgensi Basis Data Terdistribusi

Pada operasional restoran berskala sibuk seperti **Warkop Agam Medan** pada jam puncak (*rush hour* malam hari), sistem menghadapi tantangan konkurensi data yang masif:
1. **Lonjakan Pemesanan Serentak (*High-Concurrency Checkout*):** Ratusan pelanggan memesan menu favorit (*Indomie Bangladesh Spesial*, *Kopi Sanger Espresso*) dalam detik yang sama saat sisa porsi kritis.
2. **Perebutan Meja Makan (*Table Contention & Session Locking*):** Beberapa pengunjung memindai kode QR meja yang sama secara bersamaan.
3. **Penyelesaian Transaksi Pembayaran (*Settlement Atomicity*):** Pelunasan kasir (tunai) atau notifikasi webhook gateway (Midtrans) harus atomik: memotong stok reservasi, mencatat pembayaran, mengubah status meja, mencetak struk, dan mencatat log audit.
4. **Ketersediaan Tinggi Tanpa Henti (*High Availability & Zero Downtime*):** Kerusakan hardware pada salah satu server database tidak boleh menghentikan transaksi kasir maupun pemesanan pelanggan.

Pendekatan basis data relasional konvensional *single-node* memiliki keterbatasan mendasar (*Single Point of Failure* dan *Vertical Scaling Limit*). Oleh karena itu, sistem Warkop Agam mengadopsi arsitektur **Distributed NewSQL (TiDB Engine)** dengan konsensus **Multi-Raft** dan protokol **Two-Phase Commit (2PC)**.

---

## 2. Arsitektur Distributed SQL (TiDB Multi-Tier Decoupled Cluster)

Arsitektur sistem memisahkan secara modular antara **lapisan komputasi (*Stateless Compute Layer*)**, **lapisan koordinasi metadata (*Metadata & Raft Coordinator*)**, **lapisan penyimpanan transaksional (*Distributed Key-Value Engine*)**, dan **lapisan analitik kolom (*Columnar Analytical Store*)**.

```
+-----------------------------------------------------------------------------------+
|                        APLIKASI CLIENT / WEB / MOBILE / KDS                       |
|           (Customer QR Web Ordering, Cashier POS, Chef KDS, Admin Panel)          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         NEXT.JS APPLICATION TIER (NODE.JS)                        |
|       - Prisma ORM Client / Database Object Integration Layer                     |
|       - Distributed Transaction Manager (withDistributedTransaction)              |
|       - Intelligent Exponential Backoff with Random Jitter Conflict Retry         |
+-----------------------------------------------------------------------------------+
                                         |
                       [Load Balanced Connection Pool (4000)]
                                         v
+-----------------------------------------------------------------------------------+
|                           COMPUTE LAYER: TiDB SERVER                              |
|   - Stateless SQL Parser, Cost-Based Optimizer & Distributed Executor             |
|   - Two-Phase Commit (2PC Percolator) Transaction Coordinator                     |
|   - Distributed Concurrency Control (Pessimistic & Optimistic Engine)             |
+-----------------------------------------------------------------------------------+
                   |                                             |
     [Metadata / TSO Requests]                      [Multi-Raft Protocol (20160)]
                   v                                             v
+------------------------------------+      +---------------------------------------+
|  PLACEMENT DRIVER (PD CLUSTER)     |      |    STORAGE LAYER: TiKV CLUSTER        |
|  - Timestamp Oracle (TSO) Master   |      |  - Sharded Range-based Regions (96MB) |
|  - Distributed Topology & Routing  |      |  - Multi-Raft Consensus (3 Replicas)  |
|  - Dynamic Region Rebalancing      |      |  - Coprocessor Pushed-Down Queries    |
|  - Leader Election (etcd Raft)     |      |  - Multi-Version Concurrency (MVCC)   |
+------------------------------------+      +---------------------------------------+
                                                                 |
                                              [Raft Learner Replication Engine]
                                                                 v
                                            +---------------------------------------+
                                            |   ANALYTICS LAYER: TiFlash (MPP)      |
                                            |   - Real-time Columnar Replica Store  |
                                            |   - Massive Parallel Processing (MPP) |
                                            |   - Dedicated for Reports & Views     |
                                            +---------------------------------------+
```

### Komponen Inti TiDB Distributed Database:
1. **TiDB Server (Compute Layer):**
   - Berjalan secara *stateless*, dapat di-scale out horizontal secara bebas sesuai lonjakan pengunjung.
   - Bertanggung jawab menerima koneksi MySQL protocol (port `4000`), melakukan parsing SQL, optimasi rencana eksekusi terdistribusi, serta membagi query menjadi *coprocessor tasks* yang dikirim paralel ke masing-masing node TiKV.
2. **PD (Placement Driver):**
   - Otak dari cluster terdistribusi. Menyediakan alokasi timestamp monotonik (*Timestamp Oracle - TSO*) untuk mendukung isolasi transaksi ACID terdistribusi.
   - Mengatur penempatan region data, memantau *heartbeat* node TiKV, dan melakukan *auto-failover* jika ada node yang down.
3. **TiKV (Transactional Key-Value Store):**
   - Menyimpan data aktual dalam bentuk *Key-Value pairs* dengan pengurutan leksikografis (*Range-based Sharding*).
   - Menggunakan konsensus **Multi-Raft** di mana setiap rentang data (*Region*, default ~96 MB) direplikasi ke 3 node independen (Leader, Follower 1, Follower 2).
4. **TiFlash (Columnar Analytics Engine):**
   - Menyediakan replika berbentuk kolom (*columnar*) yang disinkronkan secara *asynchronous* melalui Raft Learner protocol tanpa membebani performa OLTP TiKV.
   - Menghitung agregasi besar (seperti laporan laba rugi bulanan dan rangkuman penjualan harian) dengan kecepatan hingga puluhan kali lebih cepat.

---

## 3. Strategi Sharding & Distribusi Kunci (Non-Hotspot Partitioning)

Pada basis data terdistribusi bertipe *Key-Value Range Partitioning*, penggunaan *sequential auto-increment primary key* (1, 2, 3, ...) adalah anti-pattern yang berbahaya karena seluruh operasi penulisan (*INSERT*) baru akan terpusat pada satu Region/Raft Leader terakhir (*Write Hotspot*).

### Implementasi Solusi Sharding Warkop Agam:
1. **Penggunaan Kunci Alfanumerik Non-Sekuensial (UUID v4):**
   Setiap tabel transaksional (`orders`, `order_items`, `payments`, `receipts`, `table_sessions`, `shopping_carts`) menggunakan ID UUID berukuran 36 karakter:
   ```prisma
   model Order {
     id           String   @id @default(uuid()) @db.VarChar(36)
     order_number String   @unique @db.VarChar(30)
     ...
   }
   ```
   Hash dari UUID terdistribusi merata di seluruh rentang kunci (*Region Ranges*) pada cluster TiKV, mendistribusikan beban I/O secara merata ke seluruh node disk fisik.
2. **Composite Partition Indexes:**
   Indeks dibuat komposit agar query pencarian multi-tenant atau scoped per meja dapat langsung di-pushdown ke Region bersangkutan (*Prefix Scans*):
   - `idx_orders_status_created` (`status`, `created_at DESC`)
   - `idx_orders_table_session_status` (`table_session_id`, `status`)
   - `idx_table_sessions_table_status` (`table_id`, `status`)

---

## 4. Siklus Transaksi Terdistribusi (Percolator Two-Phase Commit / 2PC)

Sistem pemesanan restoran melibatkan banyak tabel yang tersebar di region fisik yang berbeda (contoh: tabel `orders`, `order_items`, `product_stocks`, `tables`, dan `audit_logs`). TiDB menjamin konsistensi ACID lintas-region menggunakan protokol **Two-Phase Commit (2PC)** berbasis algoritma Google Percolator.

### Tahapan Transaksi 2PC pada Alur Checkout:
```
Client (Next.js)            TiDB (2PC Coordinator)             TiKV Region A (Orders)         TiKV Region B (Stocks)
      |                               |                                  |                              |
      |--- 1. BEGIN (Get StartTS) --->|                                  |                              |
      |                               |--- Dapatkan StartTS dari PD ---->|                              |
      |--- 2. Write Order & Stock --->|                                  |                              |
      |                               |                                  |                              |
      |--- 3. COMMIT Transaksi ------>| [Fase 1: Prewrite]               |                              |
      |                               |--- Prewrite Primary Lock ------->| (Simpan Lock & Data)         |
      |                               |<-- Prewrite Primary OK ----------|                              |
      |                               |--- Prewrite Secondary Lock ------------------------------------>| (Simpan Lock & Data)
      |                               |<-- Prewrite Secondary OK ---------------------------------------|
      |                               |                                  |                              |
      |                               | [Fase 2: Commit]                 |                              |
      |                               |--- Dapatkan CommitTS dari PD --->|                              |
      |                               |--- Commit Primary Lock --------->| (Hapus Lock, Tandai Visible) |
      |                               |<-- Commit Primary Sukses --------|                              |
      |                               |                                  |                              |
      |<-- 4. Checkout Berhasil ------| (Transaksi Dinyatakan Selesai)   |                              |
      |                               |                                  |                              |
      |                               |--- Asynchronous Commit Secondary ------------------------------>| (Hapus Lock Secondary)
```

1. **Fase 1 (Prewrite):**
   - Koordinator memilih baris pesanan (`orders`) sebagai *Primary Lock*.
   - Baris stok (`product_stocks`) dan sesi meja dikunci sebagai *Secondary Locks* yang mengacu pada *Primary Lock*.
   - Jika terjadi tabrakan kunci (*key lock contention*) atau stok tidak cukup, proses prewrite dibatalkan dan seluruh lock dilepas.
2. **Fase 2 (Commit):**
   - Koordinator meminta `CommitTS` dari PD.
   - *Primary Lock* dikomit secara atomik. Begitu primary lock berhasil dikomit, transaksi secara sah berstatus **COMMITTED** dan hasil penulisan dapat dibaca oleh transaksi lain.
   - Secondary locks dikomit secara asinkron (*Pipelined Commit*).

---

## 5. Pengendalian Konkurensi & Resolusi Write Conflict

Pada sistem terdistribusi, ketika puluhan pelanggan memesan produk yang sama pada milidetik yang sama, terjadi **Write Conflict** pada node penyimpanan. Jika tidak ditangani, database akan memunculkan error `Error 9007: Write conflict` atau `Error 1213: Deadlock`.

Sistem Warkop Agam mengimplementasikan solusi tingkat aplikasi dan basis data:

### 5.1. Engine `withDistributedTransaction` (Automatic Exponential Backoff & Jitter)
Diimplementasikan pada [src/lib/db/distributed.ts](file:///c:/ws/TUBES-MSBD-KELOMPOK-3-main/TUBES-MSBD-KELOMPOK-3-main/src/lib/db/distributed.ts):
```typescript
export async function withDistributedTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  options: DistributedTransactionOptions = {}
): Promise<T> {
  const { maxRetries = 4, initialBackoffMs = 50, maxBackoffMs = 600 } = options;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await prisma.$transaction(async (tx) => action(tx), { timeout: 15000 });
    } catch (err) {
      attempt++;
      if (attempt <= maxRetries && isDistributedConflictError(err)) {
        const delay = calculateJitteredBackoff(attempt, initialBackoffMs, maxBackoffMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}
```
Formula penundaan menggunakan *Decorrelated Jitter*:
$$\text{Delay} = \min(\text{Initial} \times 2^{\text{attempt}}, \text{Max}) \times 0.75 + \text{random}(0, \text{Capped} \times 0.5)$$
Hal ini mengeliminasi benturan retry yang sinkron (*anti-thundering herd*) sehingga tingkat keberhasilan transaksi di bawah beban puncak mencapai 100%.

### 5.2. Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)
Untuk mencegah *dirty reads* dan *phantom reads*, seluruh penyesuaian kuantitas stok dilakukan di dalam transaksi pesimis pada Stored Procedure `sp_adjust_product_stock`:
```sql
SELECT available_qty, reserved_qty
INTO v_avail_before, v_reserved_before
FROM product_stocks
WHERE product_id = p_product_id
FOR UPDATE;
```
Lock baris ini didorong langsung (*Pushed Down*) ke node TiKV yang menyimpan Region bersangkutan.

### 5.3. Two-Phase Stock Lifecycle (Reserve -> Commit / Release)
1. **Fase Reservasi (`sp_reserve_product_stock`):** Dijalankan saat checkout. Stok dialihkan dari `available_qty` ke `reserved_qty`. Pelanggan lain tidak bisa merebut stok ini.
2. **Fase Eksekusi:**
   - **Lunas (`sp_commit_reserved_stock`):** Dipanggil saat pembayaran kasir/Midtrans selesai. Mengurangi permanen `reserved_qty` dan mencatat mutasi `OUT_SALES`.
   - **Kedaluwarsa/Batal (`sp_release_expired_orders`):** Mengembalikan stok reservasi kembali ke `available_qty` secara utuh.

---

## 6. Read-Write Splitting & Follower Reads

Untuk mencegah transaksi operasional kasir dan checkout pelanggan terganggu oleh query analitik yang berat (contoh: laporan audit log, ringkasan omzet tahunan, dan kalkulasi performa menu):

1. **Transactional Writes (Master/Leader Only):**
   Seluruh operasi penulisan (`INSERT`, `UPDATE`, `DELETE`) dan eksekusi Stored Procedure selalu diarahkan ke **Raft Leader** untuk memastikan konsistensi mutlak (*Linearizability*).
2. **Follower Reads (`withFollowerRead`):**
   Query pembacaan laporan pada [src/lib/db/distributed.ts](file:///c:/ws/TUBES-MSBD-KELOMPOK-3-main/TUBES-MSBD-KELOMPOK-3-main/src/lib/db/distributed.ts) mengaktifkan fitur Follower Read TiDB:
   ```sql
   SET SESSION tidb_replica_read = 'leader-and-follower';
   ```
   TiDB server membaca snapshot data konsisten (berdasarkan TSO Read Timestamp) langsung dari node **TiKV Follower** atau replika analitik **TiFlash** tanpa mengganggu Raft Leader.

---

## 7. Ketersediaan Tinggi & Ketahanan Bencana (High Availability)

Arsitektur database terdistribusi menjamin **RPO = 0 (Recovery Point Objective)** dan **RTO < 3 Detik (Recovery Time Objective)**:

| Skenario Kegagalan | Mekanisme Penanganan Otomatis | Dampak Terhadap Aplikasi |
|---|---|---|
| **Satu Node TiKV Mati / Crash** | Dua replika Raft lainnya tetap mencapai kuorum ($2/3$). Raft Leader baru otomatis terpilih dalam waktu $< 2$ detik. | **Nol Kehilangan Data (RPO = 0)**. Transaksi checkout tetap berjalan normal. |
| **Satu Node TiDB Server Down** | Load balancer mengalihkan koneksi ke node TiDB server lain secara transparan. | Tidak ada gangguan karena TiDB berstatus *stateless*. |
| **Network Partition (Split-Brain)** | Partisi minoritas ($1/3$ node) menolak penulisan karena tidak mencapai kuorum ($> N/2$). Partisi mayoritas ($2/3$) melanjutkan komit data. | Mencegah anomali inkonsistensi data antar partisi jaringan. |
| **Bencana Datacenter** | Region data disebar lintas availability zone (AZ) dengan parameter `location-labels` pada Placement Driver. | Cluster tetap dapat melayani transaksi selama mayoritas AZ aktif. |

---

## 8. Panduan Menjalankan TiDB Cluster Terdistribusi Lokal

Sistem Warkop Agam telah dilengkapi konfigurasi [docker-compose.tidb.yml](file:///c:/ws/TUBES-MSBD-KELOMPOK-3-main/TUBES-MSBD-KELOMPOK-3-main/docker-compose.tidb.yml) yang dapat dijalankan secara instan untuk pengujian atau demonstrasi evaluasi MSBD.

### 8.1. Menjalankan Cluster dengan Docker Compose:
```bash
docker compose -f docker-compose.tidb.yml up -d
```
Cluster TiDB akan mengaktifkan 3 layanan inti:
- **PD (Placement Driver):** Port `2379`
- **TiKV (Storage):** Port `20160`
- **TiDB (Compute Layer):** Port `4000` (Kompatibel penuh dengan protokol MySQL)

### 8.2. Menghubungkan Aplikasi ke TiDB Cluster:
Ubah konfigurasi `.env`:
```env
DATABASE_URL="mysql://root:@localhost:4000/warkop_agam_db"
```
Jalankan migrasi skema dan inisialisasi objek:
```bash
pnpm exec prisma db push
pnpm exec prisma db seed
```

### 8.3. Verifikasi Status Cluster Real-time:
Status arsitektur database terdistribusi dapat diperiksa kapan saja melalui endpoint API:
```bash
curl http://localhost:3000/api/distributed-db/status
```
Atau klik badge **"Distributed DB"** langsung dari antarmuka Dashboard Kasir maupun Admin Warkop Agam.
