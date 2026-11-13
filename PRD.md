# WARKOP AGAM

## PRODUCT REQUIREMENTS DOCUMENT (PRD) & SPESIFIKASI PERANCANGAN BASIS DATA

**Restaurant Ordering & Management System**

| Dokumen | Informasi |
| --- | --- |
| **Versi** | **1.3** — Penyelarasan lengkap dengan Sistematika Pelaporan Tugas Besar Manajemen Sistem Basis Data (MSBD) |
| **Status** | Ready for Database Implementation, Application Development & Reporting |
| **Platform** | Responsive Web Application (Optimal di Desktop, Tablet, dan Mobile untuk Customer, Cashier, & Admin) |
| **Model Bisnis** | Single Restaurant (Warkop Agam) |
| **Role Pengguna** | Customer, Cashier, Admin |
| **Frontend & Backend** | Next.js Fullstack (App Router + TypeScript) |
| **Database & ORM** | MySQL + Prisma ORM |
| **Identitas Visual** | Modern minimalist; coral/salmon (`#F16F62`), putih (`#FFFFFF`), abu-abu netral (`#F6F4F2`) |

Dokumen ini menjadi acuan utama untuk perancangan sistem, desain basis data (ERD, Normalisasi, DDL/DML, Trigger, Stored Procedure, Transaksi), implementasi kode aplikasi, serta penyusunan Laporan Tugas Besar MSBD.

---

# Riwayat dan Status Dokumen

| Versi | Perubahan |
| --- | --- |
| **1.0** | PRD awal berdasarkan kebutuhan pemesanan Dine In dan Takeaway dengan tiga role. |
| **1.1** | Nama produk dikoreksi menjadi Warkop Agam; backend ditetapkan menggunakan Next.js Fullstack; detail kebutuhan kasir, QR meja, pembayaran, stok, UI/UX, dan aturan bisnis dirapikan. |
| **1.2** | Penyesuaian UI Customer agar optimal di Desktop maupun Mobile; penambahan entitas Varian Produk di database; penetapan alur stock reservation dan order expiry; mitigasi fake order pada QR meja; spesifikasi thermal printer dan audio alert kasir; serta kuantifikasi NFR dan Success Metrics. |
| **1.3** | **Penyesuaian & penambahan spesifikasi teknis berbasis Sistematika Tugas Besar MSBD**: penambahan Rumusan & Manfaat Sistem, Analisis Kelayakan & Risiko, Model Analisis (Konteks, DFD, ERD, Normalisasi), Spesifikasi Detail Tabel & Constraint (`No`, `Nama Field`, `Jenis Field`, `Ukuran`, `Keterangan`), Daftar Trigger/Function/Stored Procedure, Manajemen Privilege & Transaksi Database (DCL/TCL), serta Rencana Pengujian & Evaluasi Sistem. |

---

# 1. Pendahuluan & Latar Belakang Sistem (Selaras Bab I Sistematika)

## 1.1 Deskripsi Produk

Warkop Agam adalah aplikasi web terintegrasi untuk pemesanan makanan/minuman dan pengelolaan operasional satu restoran berbasis sistem basis data relasional. Aplikasi menghubungkan pelanggan, kasir, dan admin secara *real-time* melalui satu sistem terpadu yang nyaman diakses baik melalui komputer/laptop (Desktop) maupun smartphone (Mobile). Pelanggan dapat memesan untuk *Dine In* melalui pemindaian QR Code meja atau memilih *Takeaway* melalui browser. Kasir mengelola antrean pesanan, pembuatan pesanan manual (POS), transaksi, pembayaran, dan pencetakan struk. Admin mengelola menu, kategori, varian, stok produk harian, meja, akun kasir, laporan keuangan, dan pengaturan restoran.

## 1.2 Latar Belakang & Permasalahan Sistem Berjalan

Pencatatan pesanan dan transaksi secara manual atau terpisah menimbulkan berbagai permasalahan operasional pada sistem berjalan di restoran:

1. Terjadinya antrean panjang di kasir pada jam sibuk karena seluruh pemesanan bergantung pada pencatatan manual kasir.
2. Risiko kesalahan komunikasi dan input pesanan dari kasir ke bagian dapur.
3. Keterlambatan informasi status ketersediaan menu (menu yang sudah habis tetap dipesan pelanggan sehingga terjadi *overselling*).
4. Kesulitan dalam merekapitulasi mutasi stok harian, menghitung omzet secara akurat, dan melacak riwayat perubahan data/transaksi di akhir hari.

## 1.3 Rumusan Masalah

1. Bagaimana merancang arsitektur basis data relasional yang terstruktur dan ternormalisasi untuk mengelola data menu, varian, stok porsi, meja, pesanan, serta pembayaran pada Warkop Agam?
2. Bagaimana mengimplementasikan mekanisme penguncian stok (*stock reservation*) dan transaksi basis data (ACID) agar tidak terjadi *race condition* maupun stok bernilai negatif saat pemesanan berlangsung bersamaan?
3. Bagaimana menyediakan antarmuka web responsif bagi Pelanggan, Kasir, dan Admin yang terintegrasi secara *real-time* dengan basis data?

## 1.4 Product Vision & Tujuan Produk

**Visi Produk:** Menyediakan sistem pemesanan mandiri (*self-ordering*) dan manajemen operasional restoran berbasis basis data yang cepat, akurat, konsisten, dan mudah digunakan di perangkat Desktop maupun Mobile.

**Tujuan Khusus:**

- Mempermudah pelanggan melihat ketersediaan menu secara *real-time* dan memesan mandiri tanpa mengantre.
- Menyediakan pemesanan *Dine In* yang aman melalui token QR Code meja dan pemesanan *Takeaway* yang praktis.
- Menyatukan pesanan website dan pesanan manual kasir (POS) dalam satu antrean operasional.
- Memusatkan pengelolaan stok porsi harian dengan mekanisme reservasi otomatis untuk mencegah *overselling*.
- Menyediakan laporan penjualan harian dan jejak audit (*audit log*) untuk menjamin integritas dan keterlacakan data transaksi.

## 1.5 Manfaat Sistem

- **Manfaat Praktis (Mitra/Restoran):** Meningkatkan efisiensi layanan, mempercepat waktu transaksi kasir, menekan angka kesalahan pencatatan pesanan, dan memberikan visibilitas laporan keuangan serta mutasi stok secara instan.
- **Manfaat Akademis/Teknis:** Menerapkan konsep perancangan basis data relasional (ERD, Normalisasi hingga 3NF), implementasi DDL/DML, *Trigger*, *Stored Procedure/Function*, serta manajemen transaksi database (TCL) dan hak akses (DCL) pada studi kasus nyata.

---

# 2. Ruang Lingkup & Batasan Masalah (Selaras Bab I.3 & Bab II Sistematika)

## 2.1 Termasuk dalam Ruang Lingkup (In-Scope)

- Website pelanggan adaptif untuk Desktop maupun Mobile (mendukung *Guest Checkout* maupun Akun Terdaftar).
- Dashboard kasir (POS) untuk manajemen pesanan masuk, input pesanan manual, pembayaran, dan cetak struk termal.
- Dashboard admin untuk pengelolaan master data, stok, meja, staf, laporan restoran, dan audit log.
- Layanan *Dine In* (berbasis QR Code meja tervalidasi) dan *Takeaway*.
- Pembayaran tunai, QRIS, dan transfer bank/Virtual Account melalui payment gateway.
- Pengelolaan stok produk jadi berdasarkan jumlah porsi harian beserta mekanisme penguncian stok sementara (*stock reservation*).
- Implementasi fitur basis data: Relasi antar tabel, *Constraints*, *Views*, *Triggers*, *Stored Functions/Procedures*, dan *Database Transactions*.

## 2.2 Di Luar Ruang Lingkup / Batasan Masalah (Out-of-Scope)

- Marketplace multi-restoran dan sistem multi-cabang (*multi-outlet*).
- Pengelolaan kurir pengantaran internal (*delivery*) atau integrasi langsung API layanan ojek online.
- Manajemen resep berbasis bahan baku mentah (*raw material inventory / Bill of Materials*) dan pembelian supplier.
- Payroll, penggajian, absensi karyawan, dan akuntansi standar PSAK lengkap.
- Program loyalitas (*membership tier*) atau mesin voucher kompleks.

---

# 3. Analisis Kelayakan, Risiko & Metodologi (Selaras Bab II Sistematika)

## 3.1 Analisis Kelayakan Sistem

- **Kelayakan Teknis:** Dibangun menggunakan *stack* modern yang matang dan open-source (Next.js, TypeScript, MySQL, Prisma ORM) yang mendukung pemrosesan transaksi ACID dan akses responsif lintas perangkat tanpa memerlukan instalasi aplikasi khusus di sisi pelanggan.
- **Kelayakan Operasional:** Antarmuka dirancang minimalis dan intuitif (POS-style untuk kasir dan katalog familiar untuk pelanggan) sehingga staf kasir dapat mengoperasikannya dengan pelatihan singkat (< 30 menit).
- **Kelayakan Ekonomi:** Penggunaan perangkat keras yang sudah ada (PC/Laptop/Tablet kasir dan smartphone pelanggan) menekan biaya investasi infrastruktur awal.

## 3.2 Analisis Risiko & Strategi Mitigasi

| Risiko | Dampak | Strategi Mitigasi |
| --- | --- | --- |
| **Overselling / Race Condition Stok** | Dua pelanggan memesan porsi terakhir di detik yang sama sehingga stok menjadi minus. | Menggunakan `prisma.$transaction` dengan *row-level locking* dan reservasi stok sementara (`reserved_qty`). |
| **Fake Order pada QR Meja** | Pengguna iseng memesan dari luar restoran dengan memanipulasi URL meja. | Menggunakan token kriptografis unik pada QR Code yang divalidasi server; pesanan tunai baru diproses dapur setelah konfirmasi kasir. |
| **Pesanan Tidak Dibayar (Gantung)** | Stok terkunci terus-menerus oleh checkout yang ditinggalkan pelanggan. | Menerapkan mekanisme *auto-cancel / expiry* (15 menit untuk Digital, 30 menit untuk Tunai) yang otomatis melepaskan kembali stok reservasi. |
| **Kehilangan Data Historis** | Laporan penjualan rusak jika admin menghapus menu lama. | Menerapkan *Soft Delete* (`deleted_at` / `is_active = false`) pada produk/kategori dan menyimpan *snapshot* harga pada `OrderItems`. |

## 3.3 Metodologi Pengembangan Sistem

Pengembangan sistem menggunakan pendekatan **Iterative & Incremental SDLC (Prototyping & Agile-lite)** yang dipadukan dengan siklus **Database Life Cycle (DBLC)**:

1. *Requirement Gathering & Analysis* (Identifikasi kebutuhan Warkop Agam).
2. *Conceptual & Logical Database Design* (Pembuatan DFD, ERD, dan Normalisasi tabel).
3. *Physical Database Design* (Implementasi skema MySQL, Index, View, Trigger, dan Stored Function).
4. *Application Prototyping & Integration* (Pengembangan UI/UX dan API Next.js).
5. *Testing & Evaluation* (Pengujian *Black-box*, integritas transaksi ACID, dan uji coba pengguna).

---

# 4. Pengguna dan Hak Akses (Selaras Bab III.2 & III.7 Sistematika)

## 4.1 Role Pengguna Aplikasi

| Role | Tujuan | Akses Utama |
| --- | --- | --- |
| **Customer** | Melihat menu, memesan makanan, membayar, dan memantau pesanan melalui Desktop atau Mobile. | Homepage, katalog menu, detail produk, cart, checkout, pembayaran, pelacakan pesanan (via sesi/tautan unik), profil dan riwayat (untuk akun). |
| **Cashier** | Menangani siklus pesanan dan transaksi harian. | Antrean pesanan masuk (dengan notifikasi suara), buat pesanan manual (POS), detail dan update status pesanan, konfirmasi pembayaran tunai, cetak struk, riwayat transaksi, informasi meja, dan status ketersediaan menu. |
| **Admin** | Mengelola sistem, master data, dan operasional restoran. | Dashboard analitik, CRUD menu/kategori/varian, stok porsi, meja/QR, akun kasir, seluruh pesanan dan transaksi, pembatalan/refund, ekspor laporan, pengaturan restoran, dan audit log. |

## 4.2 Manajemen User, Privilege, dan Keamanan Database (DCL)

- **Server-Side RBAC:** Semua hak akses wajib divalidasi di sisi server (*Server-side RBAC/Middleware*) pada setiap Route Handler dan Server Action.
- **Database Role & Privilege (MySQL):**
  - `warkop_admin_db`: Memiliki hak akses penuh (`ALL PRIVILEGES`) untuk DDL (migrasi skema) dan administrasi basis data.
  - `warkop_app_user`: Akun yang digunakan oleh aplikasi Next.js di lingkungan produksi; hanya diberikan hak akses DML (`SELECT, INSERT, UPDATE, DELETE`) pada tabel operasional, tanpa hak akses `DROP` atau `ALTER TABLE` untuk mencegah kerusakan skema jika terjadi celah keamanan.

---

# 5. Functional Requirements — Customer (Desktop & Mobile)

## 5.1 Akun dan Autentikasi

- Pelanggan dapat mendaftar menggunakan nama, email, nomor telepon/WhatsApp, dan password.
- Pelanggan dapat login, logout, serta mengubah informasi profil dan password.
- *Guest checkout* diperbolehkan dan menjadi prioritas kemudahan; pelanggan cukup mengisi Nama dan Nomor Telepon/WhatsApp aktif saat checkout.
- Riwayat pesanan permanen tersedia untuk pelanggan yang memiliki akun. Akses pelacakan pesanan *guest* menggunakan kode/tautan unik aman (*signed token URL*) dan penyimpanan sesi browser.

## 5.2 Homepage

- Navbar responsif berisi logo, Home, Menu, Lacak Pesanan, Info Restoran, tombol Cart dengan indikator jumlah item, dan akses akun.
- Konteks meja aktif: jika pelanggan masuk melalui pemindaian QR meja, tampilkan banner informasi jelas di bagian atas layar (contoh: *"Anda memesan untuk: Meja 04"*).
- Hero section proporsional (2 kolom berdampingan di Desktop, bertumpuk di Mobile) berisi headline, deskripsi singkat, foto makanan, dan tombol CTA menuju katalog menu.
- Kategori unggulan, bagian Menu Populer (*Best Seller*), informasi promo aktif, serta informasi restoran (jam operasional beserta status Buka/Tutup otomatis, alamat, dan kontak WhatsApp).

## 5.3 Menu dan Detail Produk

- Grid 3–4 kolom produk di Desktop (dilengkapi sidebar kategori/keranjang) dan grid 2 kolom di Mobile.
- Kartu produk menampilkan foto dengan rasio konsisten, nama, deskripsi singkat, harga dasar, kategori, dan status ketersediaan (*Tersedia* / *Sisa Sedikit* / *Habis*).
- Pencarian instan (*debounced search*), filter kategori, dan pengurutan berdasarkan harga atau popularitas.
- Detail produk (Modal Dialog di Desktop dan Bottom Sheet Drawer di Mobile) memuat foto besar, deskripsi lengkap, harga dasar, pilihan varian/topping (contoh: Panas/Dingin, Level Pedas, Tambah Telur) beserta penyesuaian harganya, jumlah porsi, dan catatan khusus per item.
- Produk dengan stok 0 atau nonaktif ditandai *Habis* dan tidak dapat ditambahkan ke keranjang.

## 5.4 Cart dan Pemesanan

- Pada Desktop, akses Cart melalui *Slide-over Drawer* di sisi kanan layar. Pada Mobile, akses cepat tersedia melalui *Sticky Bottom Bar*.
- Pelanggan dapat menambah, mengubah jumlah, mengubah catatan item, dan menghapus item di keranjang dengan validasi sisa stok porsi tersedia.
- Menampilkan subtotal, biaya tambahan/pajak (jika diaktifkan), dan total tagihan.
- Pilihan tipe layanan *Dine In* (mengunci identitas meja dari token QR valid) atau *Takeaway* (wajib mengisi nama dan nomor WhatsApp aktif).
- Pesanan harus memiliki minimal satu item dan dapat menyertakan catatan umum pesanan.

## 5.5 Checkout dan Pembayaran

- Tata letak 2 kolom di Desktop (Form Pelanggan/Layanan/Pembayaran di kiri, Ringkasan Tagihan Sticky di kanan) dan 1 kolom berurutan di Mobile.
- Metode pembayaran: **Tunai (Bayar di Kasir)**, **QRIS**, dan **Virtual Account / Transfer Bank**.
- Pembayaran digital diproses otomatis melalui payment gateway resmi dengan batas waktu bayar **15 menit** (dilengkapi *countdown timer*). Status berubah menjadi `Paid` secara otomatis setelah menerima *webhook* sah.
- Pembayaran tunai dicatat dengan status awal `Unpaid` (`Pending`) dan menampilkan Nomor Pesanan / Kode Booking untuk dibayar serta dikonfirmasi oleh kasir.

## 5.6 Status Pesanan dan Riwayat

- Pelanggan dapat melihat nomor pesanan, waktu pesan, tipe layanan/meja, rincian item, total, status pembayaran (`Unpaid`, `Paid`, `Failed`, `Refunded`), dan *stepper* visual status pesanan secara *real-time* (`Pending`, `Confirmed`, `Preparing`, `Ready`, `Completed`, `Cancelled`).
- Pelanggan yang login dapat melihat riwayat pesanan dan melakukan pemesanan ulang (*reorder*).

---

# 6. Functional Requirements — Cashier Dashboard

Dashboard kasir mengutamakan kecepatan kerja (*POS-style*) menggunakan panel samping (*drawer*) atau *split-view*.

## 6.1 Ringkasan Operasional & Notifikasi

- Menampilkan jumlah pesanan hari ini, pesanan baru yang perlu ditangani (`Pending`/`Confirmed`), pesanan menunggu pembayaran tunai, dan ringkasan omzet hari ini.
- **Notifikasi Suara (Audio Alert) dan Visual:** Membunyikan nada peringatan otomatis ketika ada pesanan baru masuk dari website.

## 6.2 Pengelolaan Pesanan

- Menampilkan pesanan website dan pesanan manual kasir (POS) dalam satu daftar terpadu dengan tab filter (*Perlu Tindakan*, *Disiapkan*, *Siap Saji*, *Selesai/Batal*).
- Menampilkan nomor pesanan, sumber pesanan (`WEB`/`POS`), waktu masuk, pelanggan, tipe layanan, meja, item, varian, catatan, total, dan status pembayaran.
- Konfirmasi pesanan hanya dengan 1–2 klik dan pembaruan status (`Confirmed` -> `Preparing` -> `Ready` -> `Completed` / `Cancelled`).
- Pencarian cepat berdasarkan nomor pesanan, nama pelanggan, atau nomor meja.

## 6.3 Pesanan Manual (POS Kasir)

- Layar POS *split-screen* (daftar menu di kiri, keranjang di kanan) untuk membuat pesanan atas nama pelanggan (`Dine In` dengan pemilihan meja, atau `Takeaway`).
- Sistem menghitung total otomatis dan langsung mengarahkan ke pencatatan pembayaran.

## 6.4 Pembayaran dan Struk

- Pencatatan pembayaran tunai dilengkapi tombol nominal cepat (*Uang Pas*, *Rp20.000*, *Rp50.000*, *Rp100.000*) dan kalkulasi kembalian otomatis.
- Kasir tidak diperbolehkan menandai pembayaran digital sebagai lunas tanpa verifikasi *webhook* sah dari sistem.
- Cetak struk termal mendukung ukuran **58mm** dan **80mm** via CSS print atau unduh PDF, memuat identitas Warkop Agam, nomor transaksi, waktu, nama kasir, layanan/meja, item beserta varian, subtotal, pajak, total, metode bayar, nominal bayar, kembalian, dan teks penutup.

## 6.5 Riwayat dan Meja

- Melihat riwayat transaksi berdasarkan tanggal, metode pembayaran, dan status.
- Melihat status meja (*Kosong* / *Terisi*), pesanan aktif terkait, dan mengosongkan meja setelah pelanggan selesai.
- Melihat sisa stok porsi produk secara *real-time* (tanpa hak mengubah harga atau kuota stok utama).

---

# 7. Functional Requirements — Admin Dashboard

## 7.1 Dashboard Overview

- Menampilkan Total Penjualan Bersih (*Net Sales*), jumlah pesanan sukses, rata-rata nilai transaksi (*AOV*), dan tingkat pembatalan berdasarkan filter periode (*Hari Ini*, *7 Hari*, *Bulan Ini*, *Kustom*).
- Menampilkan 5 produk terlaris dan proporsi metode pembayaran (*Tunai* vs *Digital*).

## 7.2 Menu, Kategori, dan Varian

- CRUD produk, kategori, dan grup varian/opsi produk (*Suhu Minuman*, *Level Pedas*, *Topping*) beserta penyesuaian harganya.
- Produk atau kategori yang sudah memiliki riwayat transaksi wajib dinonaktifkan atau diarsipkan (*soft delete*), bukan dihapus permanen (*hard delete*).

## 7.3 Stok Produk Jadi

- Mengatur stok awal/porsi harian dan melakukan penyesuaian stok manual (*Stock Adjustment*) dengan wajib memilih alasan (*stok baru*, *rusak/basi*, *koreksi opname*).
- Menampilkan stok tersedia (`available_qty`), stok terikat pesanan aktif (`reserved_qty`), batas minimum (`min_threshold`), dan riwayat mutasi (`StockMovements`).

## 7.4 Meja dan QR Code

- CRUD meja dan manajemen QR Code dengan token kriptografis unik.
- Fitur *regenerate* token QR meja (otomatis menonaktifkan QR lama) serta unduh/cetak QR siap tempel.

## 7.5 Pengguna, Operasional, Pembatalan & Refund

- CRUD akun kasir (buat, edit, reset password, aktif/nonaktifkan).
- Mengelola pembatalan pesanan berstatus `Paid` dan memproses *refund* dengan wajib mencatat alasan di *audit log* serta opsi pengembalian stok porsi.

## 7.6 Laporan dan Audit Log

- Ekspor laporan penjualan, performa produk, metode pembayaran, dan mutasi stok ke format **CSV** dan **PDF**.
- *Audit log* otomatis mencatat waktu, pelaku, role, aksi, serta data sebelum dan sesudah (`old_data`, `new_data`) pada aktivitas sensitif.

## 7.7 Pengaturan Restoran

- Profil restoran, sakelar utama (*Master Toggle*) buka/tutup pemesanan web saat dapur penuh, pengaturan pajak/PB1, dan catatan kaki struk.

---

# 8. User Flows & Business Rules

## 8.1 Alur Utama (User Flows)

1. **Dine In via QR Code:** Pelanggan memindai QR meja -> Server memvalidasi token & mengunci nomor meja -> Pelanggan memilih menu & varian -> Checkout & reservasi stok -> Pesanan muncul di kasir dengan audio alert -> Pembayaran dikonfirmasi (Webhook Digital / Kasir Tunai) -> Pesanan diproses (`Confirmed` -> `Preparing` -> `Ready` -> `Completed`).
2. **Takeaway (Desktop/Mobile):** Pelanggan membuka web -> Pilih *Takeaway* -> Pilih menu & varian -> Isi nama & nomor WhatsApp -> Checkout & bayar -> Kasir memproses hingga `Ready` -> Pelanggan mengambil pesanan.
3. **Pesanan Manual POS:** Kasir buka POS -> Pilih layanan & meja -> Tambah item -> Terima pembayaran -> Sistem menyimpan status `Paid & Confirmed` dan mencetak struk termal.

## 8.2 Aturan Bisnis (Business Rules)

| Area | Aturan |
| --- | --- |
| **Akun dan Akses** | Seluruh otorisasi diperiksa di server; akun kasir nonaktif langsung kehilangan sesi aktif. |
| **Snapshot Pesanan** | Nama produk, nama varian, harga satuan, dan pajak wajib disimpan sebagai *snapshot* statis pada `OrderItems` dan `OrderItemOptions` agar perubahan harga di masa depan tidak mengubah transaksi lama. |
| **Dine In & Tambah Pesanan** | Pelanggan di meja yang sama dapat mengirim pesanan tambahan selama sesi makan; setiap checkout baru membuat Nomor Order Baru pada meja tersebut. |
| **Pembayaran & Anti-Spam** | Status `Paid` metode digital hanya ditetapkan via *webhook* terverifikasi. Pesanan web metode Tunai berstatus awal `Pending (Unpaid)` dan baru diteruskan ke dapur setelah konfirmasi kasir. |
| **Reservasi Stok & Expiry** | Stok tidak boleh negatif. Checkout melakukan *Soft Lock* stok. Jika tidak dibayar melewati batas waktu (**15 menit** Digital, **30 menit** Tunai), pesanan otomatis `Cancelled` dan stok dikembalikan. |
| **Soft Delete** | Produk/kategori yang pernah ditransaksikan tidak boleh dihapus permanen (`DELETE`), melainkan menggunakan kolom `deleted_at` / `is_active`. |

---

# 9. Model Analisis & Desain Basis Data (Selaras Bab III.3 – III.9 Sistematika)

Bagian ini menjadi acuan teknis penyusunan **Bab III Analisa dan Perancangan** pada Laporan Tugas Besar MSBD.

## 9.1 Model Analisis (Diagram Konteks & DFD)

- **Diagram Konteks (Level 0):** Menggambarkan sistem informasi basis data **Warkop Agam** yang berinteraksi dengan 4 entitas eksternal: **Customer** (mengirim data pesanan & pembayaran, menerima info menu, struk/invoice digital, dan status pesanan), **Cashier** (menginput pesanan POS, konfirmasi pembayaran & status, menerima antrean pesanan & struk), **Admin** (mengelola master data menu, stok, meja, staf, menerima laporan & audit log), dan **Payment Gateway** (mengirim status callback/webhook pembayaran).
- **DFD Level 1:** Memecah sistem menjadi 5 proses utama yang terhubung dengan *Data Store*:
  - `1.0 Manajemen Autentikasi & Master Data` (Data Store: `Users`, `Categories`, `Products`, `ProductOptions`, `Tables`)
  - `2.0 Manajemen Stok & Reservasi` (Data Store: `ProductStocks`, `StockMovements`)
  - `3.0 Pemrosesan Pesanan Web & POS` (Data Store: `Orders`, `OrderItems`, `OrderItemOptions`)
  - `4.0 Pemrosesan Pembayaran & Struk` (Data Store: `Payments`, `PaymentTransactions`, `Receipts`)
  - `5.0 Pelaporan & Audit Sistem` (Data Store: `AuditLogs`, `RestaurantSettings`)

## 9.2 Desain Basis Data (ERD & Normalisasi)

- **Normalisasi:** Seluruh struktur tabel dirancang memenuhi **Bentuk Normal Ketiga (3NF)**:
  - *1NF:* Setiap atribut bernilai atomik (opsi varian dipisah ke tabel `OrderItemOptions`, tidak digabung dalam satu string koma).
  - *2NF:* Tidak ada ketergantungan parsial pada *composite key*; setiap tabel memiliki *Primary Key* tunggal (`UUID` / `SERIAL`).
  - *3NF:* Tidak ada ketergantungan transitif; informasi stok dipisah dari tabel `Products` ke `ProductStocks`, dan token QR dipisah ke `TableQrCodes`. Khusus atribut harga pada `OrderItems` diterapkan *controlled denormalization (snapshot)* sesuai kebutuhan integritas histori akuntansi.
- **Kardinalitas Relasi Utama:**
  - `Users` (1) — (N) `Orders` *(opsional/nullable untuk Guest)*
  - `Tables` (1) — (N) `Orders` *(opsional/nullable untuk Takeaway)*
  - `Tables` (1) — (1..N) `TableQrCodes` *(hanya 1 token aktif per meja)*
  - `Categories` (1) — (N) `Products`
  - `Products` (1) — (1) `ProductStocks`
  - `Products` (1) — (N) `ProductOptionGroups` (1) — (N) `ProductOptionItems`
  - `Orders` (1) — (N) `OrderItems` (1) — (N) `OrderItemOptions`
  - `Orders` (1) — (1) `Payments` (1) — (N) `PaymentTransactions`

## 9.3 Daftar Tabel, Constraint, dan Spesifikasi Kolom (Format Bab III.5 Sistematika)

Berikut adalah daftar seluruh entitas tabel beserta spesifikasi lengkap entitas utama untuk implementasi SQL DDL:

### A. Ringkasan 17 Tabel Basis Data

1. `Users` (Pengguna: Customer, Cashier, Admin)
2. `Categories` (Kategori menu)
3. `Products` (Master produk menu)
4. `ProductOptionGroups` (Grup varian produk)
5. `ProductOptionItems` (Pilihan item varian & harga tambahan)
6. `ProductStocks` (Stok porsi harian & stok tereservasi)
7. `StockMovements` (Log mutasi perubahan stok)
8. `Tables` (Data meja restoran)
9. `TableQrCodes` (Token QR Code kriptografis meja)
10. `Orders` (Header transaksi pesanan)
11. `OrderItems` (Detail item pesanan beserta snapshot harga)
12. `OrderItemOptions` (Detail varian yang dipilih per item pesanan)
13. `Payments` (Data pembayaran pesanan)
14. `PaymentTransactions` (Log transaksi & webhook payment gateway)
15. `Receipts` (Metadata pencetakan struk kasir)
16. `RestaurantSettings` (Konfigurasi operasional restoran)
17. `AuditLogs` (Jejak audit perubahan data sensitif)

### B. Spesifikasi Struktur Tabel Utama (Format Laporan MSBD)

**1. Tabel `Users`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY`, Identitas unik pengguna |
| 2 | `name` | VARCHAR | 100 | `NOT NULL`, Nama lengkap pengguna |
| 3 | `email` | VARCHAR | 150 | `UNIQUE`, Email login pengguna (nullable untuk guest) |
| 4 | `phone` | VARCHAR | 20 | `NOT NULL`, Nomor telepon / WhatsApp aktif |
| 5 | `password_hash` | VARCHAR | 255 | Hash password (bcrypt/Argon2) |
| 6 | `role` | ENUM / VARCHAR | 20 | `NOT NULL`, Nilai: `'CUSTOMER'`, `'CASHIER'`, `'ADMIN'` |
| 7 | `is_active` | BOOLEAN | - | `DEFAULT TRUE`, Status aktif akun |
| 8 | `created_at` | TIMESTAMP | - | `DEFAULT CURRENT_TIMESTAMP` |
| 9 | `updated_at` | TIMESTAMP | - | Waktu pembaruan terakhir |

**2. Tabel `Products`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY`, Identitas unik produk |
| 2 | `category_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Categories(id)`, `NOT NULL` |
| 3 | `name` | VARCHAR | 120 | `NOT NULL`, Nama menu makanan/minuman |
| 4 | `description` | TEXT | - | Deskripsi singkat menu |
| 5 | `base_price` | DECIMAL | (12,2) | `NOT NULL`, `CHECK (base_price >= 0)`, Harga dasar |
| 6 | `image_url` | VARCHAR | 255 | URL gambar produk |
| 7 | `is_available` | BOOLEAN | - | `DEFAULT TRUE`, Status aktif menu |
| 8 | `sort_order` | INT | - | `DEFAULT 0`, Urutan tampil menu |
| 9 | `deleted_at` | TIMESTAMP | - | `NULLABLE`, Penanda *soft delete* |

**3. Tabel `ProductStocks`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY`, Identitas record stok |
| 2 | `product_id` | VARCHAR / UUID | 36 | `UNIQUE`, `FOREIGN KEY` -> `Products(id)` |
| 3 | `available_qty` | INT | - | `NOT NULL`, `CHECK (available_qty >= 0)`, Stok siap jual |
| 4 | `reserved_qty` | INT | - | `NOT NULL`, `CHECK (reserved_qty >= 0)`, Stok dikunci pesanan aktif |
| 5 | `min_threshold` | INT | - | `DEFAULT 5`, Batas peringatan stok menipis |
| 6 | `updated_at` | TIMESTAMP | - | Waktu pembaruan stok terakhir |

**4. Tabel `Orders`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY`, Identitas unik pesanan |
| 2 | `order_number` | VARCHAR | 30 | `UNIQUE`, `NOT NULL`, Nomor struk/antrean (cth: `ORD-20261113-001`) |
| 3 | `user_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Users(id)`, `NULLABLE` (jika *Guest*) |
| 4 | `table_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Tables(id)`, `NULLABLE` (jika *Takeaway*) |
| 5 | `customer_name` | VARCHAR | 100 | `NOT NULL`, Nama pemesan |
| 6 | `customer_phone` | VARCHAR | 20 | `NOT NULL`, Nomor WhatsApp pemesan |
| 7 | `source` | VARCHAR | 15 | `NOT NULL`, Nilai: `'WEB'`, `'POS'` |
| 8 | `service_type` | VARCHAR | 15 | `NOT NULL`, Nilai: `'DINE_IN'`, `'TAKEAWAY'` |
| 9 | `status` | VARCHAR | 20 | `NOT NULL`, `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| 10 | `subtotal` | DECIMAL | (12,2) | `NOT NULL`, Total harga item sebelum pajak |
| 11 | `tax_amount` | DECIMAL | (12,2) | `DEFAULT 0`, Nominal pajak/biaya layanan |
| 12 | `total_amount` | DECIMAL | (12,2) | `NOT NULL`, Total tagihan akhir |
| 13 | `notes` | TEXT | - | Catatan umum pesanan |
| 14 | `expires_at` | TIMESTAMP | - | Batas waktu kedaluwarsa pembayaran |
| 15 | `created_at` | TIMESTAMP | - | `DEFAULT CURRENT_TIMESTAMP` |

**5. Tabel `OrderItems`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY` |
| 2 | `order_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Orders(id)` `ON DELETE CASCADE` |
| 3 | `product_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Products(id)` `ON DELETE RESTRICT` |
| 4 | `product_name_snapshot` | VARCHAR | 120 | `NOT NULL`, Snapshot nama menu saat transaksi |
| 5 | `unit_price_snapshot` | DECIMAL | (12,2) | `NOT NULL`, Snapshot harga dasar menu saat transaksi |
| 6 | `quantity` | INT | - | `NOT NULL`, `CHECK (quantity > 0)`, Jumlah porsi |
| 7 | `subtotal` | DECIMAL | (12,2) | `NOT NULL`, `(unit_price_snapshot + total_options) * quantity` |
| 8 | `item_notes` | VARCHAR | 255 | Catatan khusus item |

**6. Tabel `Payments`**

| No | Nama Field | Jenis Field | Ukuran | Constraint & Keterangan |
| --- | --- | --- | --- | --- |
| 1 | `id` | VARCHAR / UUID | 36 | `PRIMARY KEY` |
| 2 | `order_id` | VARCHAR / UUID | 36 | `UNIQUE`, `FOREIGN KEY` -> `Orders(id)` |
| 3 | `cashier_id` | VARCHAR / UUID | 36 | `FOREIGN KEY` -> `Users(id)`, `NULLABLE` |
| 4 | `method` | VARCHAR | 20 | `NOT NULL`, Nilai: `'CASH'`, `'QRIS'`, `'VIRTUAL_ACCOUNT'` |
| 5 | `status` | VARCHAR | 20 | `NOT NULL`, Nilai: `'UNPAID'`, `'PAID'`, `'FAILED'`, `'REFUNDED'` |
| 6 | `amount_due` | DECIMAL | (12,2) | `NOT NULL`, Total yang harus dibayar |
| 7 | `amount_paid` | DECIMAL | (12,2) | `DEFAULT 0`, Nominal uang diterima |
| 8 | `change_amount` | DECIMAL | (12,2) | `DEFAULT 0`, Uang kembalian tunai |
| 9 | `paid_at` | TIMESTAMP | - | Waktu pelunasan transaksi |

## 9.4 Rancangan View, Trigger, Fungsi & Stored Procedure (Format Bab III.5 & III.6 Sistematika)

Untuk memenuhi standar implementasi DBMS tingkat lanjut, sistem menerapkan objek database berikut pada MySQL:

1. **Database Views (`CREATE VIEW`):**
   - `vw_daily_sales_summary`: Mengagregasi total pesanan sukses, total penjualan kotor, pajak, refund, dan penjualan bersih (*Net Sales*) per tanggal untuk mempercepat kueri Dashboard Admin.
   - `vw_menu_availability`: Menggabungkan tabel `Products`, `Categories`, dan `ProductStocks` untuk menampilkan daftar menu aktif beserta status ketersediaan (`AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`) secara *real-time*.

2. **Triggers (`CREATE TRIGGER`):**
   - `trg_audit_product_price`: *After Update Trigger* pada tabel `Products` yang otomatis menyisipkan rekaman ke tabel `AuditLogs` apabila terjadi perubahan nilai pada kolom `base_price` atau `deleted_at`.
   - `trg_sync_product_availability`: *After Update Trigger* pada tabel `ProductStocks` yang otomatis mengubah `Products.is_available = FALSE` ketika `available_qty = 0`, dan mengembalikannya menjadi `TRUE` ketika stok diisi kembali (`available_qty > 0`).

3. **Stored Functions & Procedures (`CREATE FUNCTION / PROCEDURE`):**
   - `fn_reserve_product_stock(p_product_id, p_qty, p_order_id)`: Mengunci baris stok (`SELECT ... FOR UPDATE`), memvalidasi kecukupan `available_qty >= p_qty`, memindahkan jumlah dari `available_qty` ke `reserved_qty`, dan mencatat log ke `StockMovements`.
   - `sp_release_expired_orders()`: *Stored Procedure* terjadwal (*cron/worker*) untuk mencari pesanan berstatus `PENDING` yang telah melewati `expires_at`, mengubah statusnya menjadi `CANCELLED`, dan mengembalikan `reserved_qty` ke `available_qty`.

## 9.5 Manajemen Transaksi & Indeks Database (Format Bab III.7 & III.9 Sistematika)

- **Transaksi Atomik (TCL - `BEGIN` / `COMMIT` / `ROLLBACK`):**
  - Proses *Checkout* dan *Konfirmasi Pembayaran* dibungkus dalam satu blok transaksi database (`prisma.$transaction` dengan isolasi *Read Committed* + *Pessimistic Row Locking* pada `ProductStocks`). Jika satu item dalam keranjang kehabisan stok atau gagal disimpan, seluruh operasi pembuatan `Orders`, `OrderItems`, dan pemotongan stok akan di-`ROLLBACK` secara otomatis.
- **Database Indexes (`CREATE INDEX`):**
  - `idx_orders_status_created`: Indeks komposit pada `Orders(status, created_at DESC)` untuk mempercepat pemuatan antrean pesanan aktif pada Dashboard Kasir.
  - `idx_orders_number`: Indeks unik pada `Orders(order_number)` untuk pencarian cepat nomor struk.
  - `idx_products_category_active`: Indeks pada `Products(category_id, is_available, deleted_at)` untuk mempercepat filter katalog menu pelanggan.

---

# 10. UI/UX & Non-Functional Requirements (Selaras Bab III.8 & Bab IV Sistematika)

## 10.1 Arah Visual & Aturan Layout

- **Palet Warna:** Primary `#F16F62` (Coral/Salmon), Primary Hover `#DC5B4E`, Background `#FFFFFF`, Secondary Background `#F6F4F2`, Primary Text `#272727`, Secondary Text `#777777`, Border `#E7E5E3`, Success `#39845B`, Warning `#E5A54B`, Error `#D9534F`.
- **Tipografi:** *Plus Jakarta Sans* atau *Inter*.
- **Adaptive Layout:**
  - *Customer:* Desktop (`>= 1024px`) menggunakan grid 3–4 kolom, Modal Dialog varian, Slide-over Cart Drawer, dan Checkout 2 kolom. Mobile (`< 768px`) menggunakan grid 2 kolom, Bottom Sheet varian, dan Sticky Bottom Cart Bar.
  - *Cashier & Admin:* Desain fungsional berdensitas informasi optimal dengan ukuran tombol aksi minimal tinggi `44px`.

## 10.2 Non-Functional Requirements (Performance, Security, Reliability)

- **Performance:** Waktu muat halaman utama (LCP) `< 2,5 detik`; respons API pencarian/filter `< 500ms`; sinkronisasi pesanan baru ke layar kasir `<= 5 detik`.
- **Security:** Password di-hash menggunakan `bcrypt`/`Argon2`; cookie sesi `HTTP-only`, `Secure`, `SameSite`; validasi input dengan `Zod`; verifikasi *cryptographic signature* pada *webhook* pembayaran; serta penerapan *Rate Limiting* pada endpoint autentikasi dan pembuatan pesanan.
- **Reliability:** Idempotency pada pengiriman pesanan, transaksi database atomik untuk mencegah *overselling*, dan prosedur *automated backup* harian MySQL.

---

# 11. Technology Stack & Arsitektur Sistem (Selaras Bab IV.1 Sistematika)

| Lapisan | Teknologi | Keterangan |
| --- | --- | --- |
| **Fullstack Framework** | Next.js (App Router) + TypeScript | UI rendering, Route Handlers, Server Actions. |
| **Styling & UI** | Tailwind CSS + shadcn/ui + Lucide React | Sistem komponen aksesibel, responsif, dan ringan. |
| **Database & ORM** | MySQL + Prisma ORM | Database relasional ACID, migrasi skema, dan kueri transaksional. |
| **Authentication** | Auth.js (NextAuth) | Manajemen sesi dan RBAC berbasis role. |
| **Validation** | Zod + React Hook Form | Validasi skema payload di client dan server. |
| **Payments** | Midtrans (Snap / Core API) | Pemrosesan QRIS dinamis dan Virtual Account dengan webhook. |
| **Object Storage** | Supabase Storage / Cloudinary | Penyimpanan foto produk menu teroptimasi (WebP/AVIF). |
| **Realtime Sync** | TanStack Query / SWR (Polling 5s) / SSE | Sinkronisasi antrean kasir dan pelacakan status pesanan. |

---

# 12. Rencana Implementasi, Pengujian & Evaluasi (Selaras Bab IV.2 – IV.5 Sistematika)

## 12.1 Tahapan Pengembangan (MVP Roadmap)

- **Phase 1 — Core Database & MVP:** Implementasi skema MySQL (DDL, Constraints, Indexes, Triggers), autentikasi RBAC, katalog responsif & varian, cart, guest checkout, Dine In QR tervalidasi & Takeaway, reservasi stok transaksional, dashboard kasir dengan audio alert, POS kasir, pembayaran tunai & QRIS, serta admin CRUD menu, stok, dan meja.
- **Phase 2 — Operational & Reporting:** Cetak struk termal (58mm/80mm), *stored procedure* auto-cancel pesanan kedaluwarsa, riwayat transaksi, laporan penjualan & ekspor CSV/PDF, pengelolaan akun kasir, audit log, dan alur refund.
- **Phase 3 — Enhancement:** Ulasan pelanggan, manajemen promo/diskon, dan notifikasi WhatsApp otomatis.

## 12.2 Skenario Pengujian Sistem (Acceptance Criteria & Black-Box Testing)

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
| --- | --- | --- |
| **TC-01** | Pelanggan memindai QR meja valid dan memesan Dine In | Identitas meja terkunci otomatis dan tersimpan pada `Orders.table_id`. |
| **TC-02** | Manipulasi parameter meja di URL tanpa token QR sah | Server menolak permintaan dan mengembalikan pesan error akses tidak valid. |
| **TC-03** | Concurrency Test: 2 pengguna memesan 1 porsi terakhir secara bersamaan | Transaksi ACID mengunci baris stok; 1 pengguna berhasil checkout, 1 pengguna mendapat notifikasi stok habis (`available_qty` tetap `0`, tidak negatif). |
| **TC-04** | Pesanan digital tidak dibayar melewati 15 menit | Prosedur `sp_release_expired_orders` mengubah status menjadi `CANCELLED` dan mengembalikan `reserved_qty` ke `available_qty`. |
| **TC-05** | Admin mengubah harga produk setelah transaksi terjadi | Nilai `unit_price_snapshot` pada tabel `OrderItems` transaksi lama tidak berubah. |
| **TC-06** | Admin menghapus produk yang sudah pernah terjual | Trigger/service mengalihkan ke *soft delete* (`deleted_at` terisi) tanpa menghapus riwayat laporan penjualan. |
| **TC-07** | Webhook pembayaran sah diterima dari Midtrans | Status `Payments` berubah menjadi `PAID`, reservasi stok menjadi pengurangan final di `StockMovements`. |
| **TC-08** | Kasir mengakses halaman/API khusus Admin | Server menolak akses dengan status HTTP `403 Forbidden`. |

## 12.3 Success Metrics & Evaluasi Sistem

- **Kecepatan Input Kasir:** Rata-rata waktu pembuatan pesanan manual hingga cetak struk `< 45 detik`.
- **Kecepatan Pemesanan Pelanggan:** Pelanggan menyelesaikan pemesanan mandiri via Desktop maupun Mobile dalam `< 2 menit`.
- **Akurasi Stok & Transaksi:** `0` kasus stok bernilai negatif (*overselling*) dan `100%` kesesuaian antara status `Paid` dengan mutasi pembayaran sah.
- **Keandalan Sinkronisasi:** `> 99%` pesanan web muncul otomatis di layar kasir dalam waktu `<= 5 detik` tanpa refresh manual.

