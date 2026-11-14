"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/menu-data";

/**
 * Foto produk dengan rasio responsif agar foto potret/botol/persegi tidak terpotong ekstrem
 * di kontainer persegi (mobile) maupun lanskap (tablet/desktop/modal detail).
 * Urutan pemakaian:
 * 1. `imageUrl` dari database (Products.image_url) → foto asli
 * 2. `/menu/<id>.svg` → foto contoh (folder public/menu)
 * 3. emoji → jika keduanya tidak ada
 */
export function ProductImage({
  product,
  className,
  emojiClassName,
  sizes,
  priority = false,
  fit = "smart",
}: {
  product: Pick<Product, "id" | "name" | "emoji" | "imageUrl">;
  className?: string;
  emojiClassName?: string;
  sizes?: string;
  priority?: boolean;
  fit?: "cover" | "contain" | "smart";
}) {
  const sources = [product.imageUrl, `/menu/${product.id}.svg`].filter(
    (s, i, arr): s is string => !!s && arr.indexOf(s) === i,
  );
  const [failedCount, setFailedCount] = useState(0);
  const src = sources[failedCount];

  const containerRef = useRef<HTMLDivElement>(null);
  const imgSizeRef = useRef<{ w: number; h: number; src: string } | null>(null);
  const [fitState, setFitState] = useState<{ src: string; contain: boolean } | null>(null);

  const evaluateFit = useCallback(() => {
    if (fit !== "smart" || !src) return;
    const container = containerRef.current;
    const dims = imgSizeRef.current;
    if (!container || !dims || dims.src !== src || !dims.w || !dims.h) return;

    const { clientWidth, clientHeight } = container;
    if (clientWidth < 88 || clientHeight < 88) return;

    const natRatio = dims.w / dims.h;
    const boxRatio = clientWidth / clientHeight;
    const ratioDiff = Math.max(natRatio / boxRatio, boxRatio / natRatio);

    // Threshold 1.44 menjaga foto normal (4:3, 3:2, 16:9) tetap full-bleed object-cover,
    // sekaligus mencegah pemotongan ekstrem pada foto minuman tinggi (9:16), botol 1:1 di modal 16:10,
    // maupun foto sangat lebar di kotak persegi mobile.
    setFitState({ src, contain: ratioDiff > 1.44 });
  }, [fit, src]);

  useEffect(() => {
    if (fit !== "smart") return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => evaluateFit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, evaluateFit]);

  const useContain = fit === "contain" || (fit === "smart" && !!src && fitState?.src === src && fitState.contain);
  const isUnoptimized =
    !!src && (src.endsWith(".svg") || /^https?:\/\//i.test(src) || src.startsWith("data:"));
  const resolvedSizes =
    sizes ??
    "(min-width: 1024px) 280px, (min-width: 768px) 33vw, (min-width: 360px) 50vw, 100vw";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        useContain ? "bg-white" : "bg-gradient-to-br from-[#FDE4E0] to-[#F6F4F2]",
        className,
      )}
    >
      {src ? (
        <>
          {useContain && (
            <Image
              key={`${src}-backdrop`}
              src={src}
              alt=""
              aria-hidden
              fill
              sizes="64px"
              unoptimized={isUnoptimized}
              className="pointer-events-none scale-125 object-cover opacity-55 blur-xl"
            />
          )}
          <Image
            key={src}
            src={src}
            alt={product.name}
            fill
            loading={priority ? "eager" : undefined}
            sizes={resolvedSizes}
            unoptimized={isUnoptimized}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                imgSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight, src };
                evaluateFit();
              }
            }}
            onError={() => setFailedCount((n) => n + 1)}
            className={cn(
              "relative z-10 object-center",
              useContain ? "object-contain" : "object-cover",
            )}
          />
        </>
      ) : (
        <span aria-hidden className={cn("text-6xl", emojiClassName)}>
          {product.emoji}
        </span>
      )}
    </div>
  );
}
