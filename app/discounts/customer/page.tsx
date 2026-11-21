import { Suspense } from "react";
import DiscountManagerView from "@/components/DiscountManagerView";

export const metadata = {
  title: "Customer Discounts | SRK Retail Software",
  description: "Manage customer tier and VIP promotional discounts",
};

export default function CustomerDiscountsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Customer Discounts...
      </div>
    }>
      <DiscountManagerView defaultTab="customer" />
    </Suspense>
  );
}
