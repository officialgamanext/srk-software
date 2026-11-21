import { Suspense } from "react";
import DiscountManagerView from "@/components/DiscountManagerView";

export const metadata = {
  title: "Product Discounts | SRK Retail Software",
  description: "Manage product-level and category promotional discounts",
};

export default function ProductDiscountsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Product Discounts...
      </div>
    }>
      <DiscountManagerView defaultTab="product" />
    </Suspense>
  );
}
