import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /**
   * - `dark-pill`: Latar espresso gelap agar huruf putih "Agam" selalu tajam di latar terang/krem.
   * - `transparent`: Tanpa kotak latar (khusus area gelap seperti Sidebar Admin/Kasir `#0E2A2E`).
   */
  variant?: "dark-pill" | "transparent";
  size?: "sm" | "md" | "lg" | "sidebar";
  priority?: boolean;
  className?: string;
}

const IMAGE_HEIGHT_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-7 sm:h-8",
  md: "h-8 md:h-8 lg:h-10",
  lg: "h-12 sm:h-14",
  sidebar: "h-11 sm:h-12",
};

const PILL_PADDING_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1",
  md: "rounded-xl px-2 py-1 sm:px-2.5 sm:py-1",
  lg: "rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2",
  sidebar: "rounded-xl px-2 py-1",
};

export function BrandLogo({
  variant = "dark-pill",
  size = "md",
  priority = false,
  className,
}: BrandLogoProps) {
  const img = (
    <Image
      src="/images/logo-warkop-agam.png"
      alt="Logo Warkop Agam Medan — Jl. Berdikari No 21 B Medan"
      width={809}
      height={349}
      priority={priority}
      style={{ width: "auto" }}
      className={cn(
        "block max-w-full object-contain select-none",
        IMAGE_HEIGHT_CLASSES[size],
      )}
    />
  );

  if (variant === "transparent") {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {img}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-[#3B2B23]/80 bg-[#1A120E] shadow-2xs [print-color-adjust:exact]",
        PILL_PADDING_CLASSES[size],
        className,
      )}
    >
      {img}
    </span>
  );
}
