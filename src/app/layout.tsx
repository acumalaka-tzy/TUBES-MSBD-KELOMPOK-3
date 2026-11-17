import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/context/cart-context";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { TableBanner } from "@/components/table-banner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Warkop Agam - Ordering & POS System",
  description: "Pemesanan menu Warkop Agam langsung dari meja dan pengelolaan operasional outlet.",
  icons: {
    icon: "/images/icon-warkop-agam.png",
    shortcut: "/images/icon-warkop-agam.png",
    apple: "/images/icon-warkop-agam.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <style>{`input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; }`}</style>
      </head>
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
