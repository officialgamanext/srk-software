import { Suspense } from "react";
import StoreRequestsView from "@/components/StoreRequestsView";

export const metadata = {
  title: "Store Requisitions & Replenishment Requests | SRK Retail Software",
  description: "Inter-store and warehouse stock request workflows with dispatch tracking",
};

export default function StoreRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
          Loading Store Requests...
        </div>
      }
    >
      <StoreRequestsView />
    </Suspense>
  );
}
