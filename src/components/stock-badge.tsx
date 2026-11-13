import { cn } from "@/lib/utils";
import { stockLabel, type StockStatus } from "@/lib/menu-data";

const styles: Record<StockStatus, string> = {
  AVAILABLE: "bg-success/10 text-success",
  LOW_STOCK: "bg-warning/15 text-[#9A6A12]",
  OUT_OF_STOCK: "bg-error/10 text-error",
};

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", styles[status], className)}>
      {stockLabel[status]}
    </span>
  );
}
