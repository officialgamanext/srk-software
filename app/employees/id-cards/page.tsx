import { Suspense } from "react";
import EmployeeIdCardsView from "@/components/EmployeeIdCardsView";

export const metadata = {
  title: "Employee ID Cards | SRK Retail Software",
  description: "Printable smart employee identification badges with 8-digit unique ID and scannable QR code",
};

export default function EmployeeIdCardsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Generating Employee ID Cards...
      </div>
    }>
      <EmployeeIdCardsView />
    </Suspense>
  );
}
