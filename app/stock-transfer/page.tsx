import { Suspense } from "react";
import StockTransferView from "@/components/StockTransferView";

export const metadata = {
  title: "Stock Transfers & Delivery Challans | SRK Retail Software",
  description: "Inter-location stock transfers, dispatch notes, vehicle waybills, and transit tracking",
};

export default function StockTransferPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
          Loading Stock Transfers...
        </div>
      }
    >
      <StockTransferView />
    </Suspense>
  );
}
