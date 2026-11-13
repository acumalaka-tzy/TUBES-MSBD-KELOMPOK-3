# Panduan Memasukkan Foto Makanan & Minuman Asli

Sistem katalog Warkop Agam sudah dilengkapi **deteksi foto otomatis** di sisi server (`src/lib/catalog.ts`).

Saat ini folder `public/menu/` berisi **ilustrasi contoh (`.svg`)** agar seluruh kartu menu tampil rapi.

## Cara Mengganti dengan Foto Makanan Asli (Tanpa Ubah Kode!)

Cukup salin file foto makanan asli Anda (format **`.webp`**, **`.jpg`**, **`.jpeg`**, atau **`.png`**, disarankan rasio 4:3) ke salah satu folder berikut:
- `public/images/menu/` *(sesuai path di `prisma/seed.ts`)*, **ATAU**
- `public/menu/`

Gunakan salah satu nama file di bawah ini (sistem akan otomatis memprioritaskan foto asli dibanding `.svg` contoh):

| Menu | Nama File di `public/images/menu/` | Atau Nama File di `public/menu/` |
| --- | --- | --- |
| Kopi Sanger Espresso | `kopi-sanger.jpg` / `.webp` / `.png` | `prd-sanger-01.jpg` / `.webp` / `.png` |
| Teh Tarik Aceh | `teh-tarik.jpg` / `.webp` / `.png` | `prd-tehtarik-02.jpg` / `.webp` / `.png` |
| Kopi Hitam Ulee Kareng | `kopi-hitam.jpg` / `.webp` / `.png` | `prd-kopihitam-03.jpg` / `.webp` / `.png` |
| Kopi Susu Gula Aren | `kopi-aren.jpg` / `.webp` / `.png` | `prd-kopijoss-09.jpg` / `.webp` / `.png` |
| Es Milo Kepal Warkop | `es-milo.jpg` / `.webp` / `.png` | `prd-milo-04.jpg` / `.webp` / `.png` |
| Es Soda Susu Badak | `soda-badak.jpg` / `.webp` / `.png` | `prd-badak-05.jpg` / `.webp` / `.png` |
| Es Jeruk Peras Murni | `es-jeruk.jpg` / `.webp` / `.png` | `prd-jeruk-10.jpg` / `.webp` / `.png` |
| Indomie Bangladesh Spesial | `indomie-bangladesh.jpg` / `.webp` / `.png` | `prd-bangladesh-06.jpg` / `.webp` / `.png` |
| Nasi Goreng Kampung Agam | `nasi-goreng.jpg` / `.webp` / `.png` | `prd-nasgor-07.jpg` / `.webp` / `.png` |
| Mie Aceh Daging Tumis | `mie-aceh.jpg` / `.webp` / `.png` | `prd-mieaceh-11.jpg` / `.webp` / `.png` |
| Roti Bakar Cokelat Keju | `roti-bakar.jpg` / `.webp` / `.png` | `prd-rotibakar-08.jpg` / `.webp` / `.png` |
| Martabak Mie Telur Bebek | `martabak-mie.jpg` / `.webp` / `.png` | `prd-martabak-12.jpg` / `.webp` / `.png` |
| Pisang Goreng Srikaya | `pisang-srikaya.jpg` / `.webp` / `.png` | `prd-pisang-13.jpg` / `.webp` / `.png` |

Setelah file foto disalin, cukup **refresh browser** — foto asli langsung tampil di Homepage, Katalog Menu, dan Modal Detail Produk.
