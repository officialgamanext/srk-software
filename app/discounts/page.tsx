import { Suspense } from "react";
import DiscountManagerView from "@/components/DiscountManagerView";

export const metadata = {
  title: "Discount Manager | SRK Retail Software",
  description: "Manage Order Discounts, Product Discounts, and Customer Discounts with rule-based POS pricing",
};

export default function DiscountsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Discount Manager...
      </div>
    }>
      <DiscountManagerView defaultTab="all" />
    </Suspense>
  );
}
