import { Suspense } from "react";
import CustomersView from "@/components/CustomersView";

export const metadata = {
  title: "Customers & Loyalty CRM | SRK Retail Software",
  description: "Customer accounts, loyalty cards, khata credit balances, and billing profiles",
};

export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Customers Directory...
      </div>
    }>
      <CustomersView />
    </Suspense>
  );
}
