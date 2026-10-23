import { Suspense } from "react";
import InventoryStockView from "@/components/InventoryStockView";

export const metadata = {
  title: "Multi-Location Inventory Stock Matrix | SRK Retail Software",
  description: "Stock ledger matrix with columns for each warehouse and store, variant breakdowns, and live adjustments",
};

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
          Loading Inventory Matrix...
        </div>
      }
    >
      <InventoryStockView />
    </Suspense>
  );
}
