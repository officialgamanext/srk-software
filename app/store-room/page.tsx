import { Suspense } from "react";
import StoreRoomView from "@/components/StoreRoomView";

export const metadata = {
  title: "Store Room & Shelf Locations | SRK Retail Software",
  description: "Internal store room inventory, rack locations, and floor display replenishment",
};

export default function StoreRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
          Loading Store Room Inventory...
        </div>
      }
    >
      <StoreRoomView />
    </Suspense>
  );
}
