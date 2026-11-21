import { Suspense } from "react";
import DiscountManagerView from "@/components/DiscountManagerView";

export const metadata = {
  title: "Order Discounts | SRK Retail Software",
  description: "Manage bill-level and cart order promotional discounts",
};

export default function OrderDiscountsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Order Discounts...
      </div>
    }>
      <DiscountManagerView defaultTab="order" />
    </Suspense>
  );
}
