"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Navigation,
  Phone,
  PlugZap,
  QrCode,
  UtensilsCrossed,
  Wifi,
  MessageCircle,
} from "lucide-react";
import { OpenStatus } from "@/components/open-status";
import type { RestaurantInfo } from "@/lib/menu-data";
import {
  buildOutletLinks,
  OUTLET_FACILITY_ITEMS,
  OUTLET_PROFILE,
} from "@/lib/restaurant-profile";

const FACILITY_ICONS = {
  wifi: Wifi,
  qr: QrCode,
  power: PlugZap,
  service: UtensilsCrossed,
} as const;

interface OutletLocationGridProps {
  restaurant: RestaurantInfo;
  /** Shows a compact outlet photo preview and link to /info when embedded on the homepage. */
  showStorefrontPreview?: boolean;
}

/** Shared outlet contact card and Google Maps embed used by both Homepage (#info) and /info. */
export function OutletLocationGrid({
  restaurant,
  showStorefrontPreview = false,
}: OutletLocationGridProps) {
  const [copiedField, setCopiedField] = useState<"address" | "whatsapp" | null>(null);

  async function handleCopy(field: "address" | "whatsapp", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2500);
    } catch {
      // Clipboard diblokir browser
    }
  }

  const { mapsUrl, mapsEmbedUrl, waUrl, formattedWa } = buildOutletLinks(restaurant);

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
      {/* Kartu Informasi Outlet */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-xs sm:p-6 lg:col-span-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-md bg-secondary-bg px-2.5 py-1 text-[11px] font-bold text-foreground">
              {OUTLET_PROFILE.outletBadge}
            </span>
            <OpenStatus
              openingHours={restaurant.openingHours}
              forceClosed={!restaurant.isWebOrderingOpen}
            />
          </div>

          {showStorefrontPreview && (
            <Link
              href="/info"
              className="group mt-4 flex items-center gap-3.5 rounded-lg border border-border bg-secondary-bg/60 p-2.5 transition-colors hover:border-primary/50"
            >
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-secondary-bg">
                <Image
                  src={OUTLET_PROFILE.storefrontImage}
                  alt={OUTLET_PROFILE.storefrontAlt}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground group-hover:text-primary">
                  {OUTLET_PROFILE.brandTitle}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {OUTLET_PROFILE.menuAddressNote}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                  <span>Tentang outlet ini</span>
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              </div>
            </Link>
          )}

          <h3 className="mt-3.5 text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
            {restaurant.name}
          </h3>

          <div className="mt-1.5 flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-muted-foreground">
              {restaurant.address}
            </p>
            <button
              type="button"
              onClick={() => handleCopy("address", restaurant.address)}
              aria-label="Salin alamat"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary-bg px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
            >
              {copiedField === "address" ? (
                <>
                  <Check className="h-3 w-3 text-success" aria-hidden />
                  <span className="text-success">Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
            <div className="flex items-center gap-2.5 text-foreground">
              <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="font-semibold">{restaurant.openingHours}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 font-semibold text-foreground transition-colors hover:text-primary"
              >
                <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>WhatsApp: {formattedWa}</span>
              </a>
              <div className="flex items-center gap-1.5">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-secondary-bg px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <MessageCircle className="h-3 w-3" aria-hidden />
                  <span>Chat</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy("whatsapp", formattedWa)}
                  aria-label="Salin nomor WhatsApp"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary-bg px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary cursor-pointer"
                >
                  {copiedField === "whatsapp" ? (
                    <>
                      <Check className="h-3 w-3 text-success" aria-hidden />
                      <span className="text-success">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Fasilitas Outlet
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {OUTLET_FACILITY_ITEMS.map((item) => {
                const Icon = FACILITY_ICONS[item.key];
                return (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary-bg px-2.5 py-1.5 text-[11px] font-medium text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <span>{item.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            <span>Petunjuk Arah Menuju Lokasi</span>
          </a>
          {showStorefrontPreview && (
            <Link
              href="/info"
              className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <span>Info Lengkap</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {/* Embed Google Maps Asli Sesuai Alamat (Klik langsung membuka Google Maps) */}
      <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-border bg-white shadow-xs sm:min-h-[340px] lg:col-span-7">
        <iframe
          title={`Lokasi ${restaurant.name} di Google Maps`}
          src={mapsEmbedUrl}
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none h-full min-h-[260px] w-full border-0 sm:min-h-[340px]"
        />
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Tekan untuk membuka lokasi di Google Maps"
          aria-label={`Buka lokasi ${restaurant.name} di Google Maps (${restaurant.address})`}
          className="absolute inset-0 z-10 block bg-transparent transition-colors hover:bg-black/[0.03]"
        />
      </div>
    </div>
  );
}
