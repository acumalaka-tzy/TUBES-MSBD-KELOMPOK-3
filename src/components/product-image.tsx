"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/menu-data";

/**
 * Foto produk dengan rasio tetap. Urutan pemakaian:
 * 1. `imageUrl` dari database (Products.image_url) → foto asli
 * 2. `/menu/<id>.svg` → foto contoh (folder public/menu)
 * 3. emoji → jika keduanya tidak ada
 */
export function ProductImage({
  product,
  className,
  emojiClassName,
  sizes,
}: {
  product: Pick<Product, "id" | "name" | "emoji" | "imageUrl">;
  className?: string;
  emojiClassName?: string;
  sizes?: string;
}) {
  const sources = [product.imageUrl, `/menu/${product.id}.svg`].filter(
    (s, i, arr): s is string => !!s && arr.indexOf(s) === i,
  );
  const [failedCount, setFailedCount] = useState(0);
  const src = sources[failedCount];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#FDE4E0] to-[#F6F4F2]",
        className,
      )}
    >
      {src ? (
        <Image
          key={src}
          src={src}
          alt={product.name}
          fill
          sizes={sizes ?? "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"}
          unoptimized={src.endsWith(".svg")}
          onError={() => setFailedCount((n) => n + 1)}
          className="object-cover"
        />
      ) : (
        <span aria-hidden className={cn("text-6xl", emojiClassName)}>
          {product.emoji}
        </span>
      )}
    </div>
  );
}
