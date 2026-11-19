"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScrollLock } from "@/lib/scroll-lock";

export type AdminTabKey =
  | "overview"
  | "catalog"
  | "stock"
  | "tables"
  | "staff"
  | "transactions"
  | "reports"
  | "settings"
  | "audit";

export function formatDateTimeId(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface ModalFrameProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalFrame({
  title,
  subtitle,
  onClose,
  maxWidthClass = "max-w-lg",
  children,
}: ModalFrameProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useScrollLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dialogRef.current) {
        dialogRef.current.scrollTo({ top: 0, behavior: "smooth" });
        dialogRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-white/25 p-4 backdrop-blur-md transition-all duration-300"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className={`animate-fade-scale-in w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto overscroll-contain scroll-smooth rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-xs">
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary-bg hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
