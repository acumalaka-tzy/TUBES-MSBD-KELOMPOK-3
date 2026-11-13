import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/context/cart-context";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { TableBanner } from "@/components/table-banner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Warkop Agam - Restaurant Ordering & Management System",
  description: "Aplikasi Web Pemesanan dan Manajemen Operasional Warkop Agam",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>
          <TableBanner />
          <Navbar />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
