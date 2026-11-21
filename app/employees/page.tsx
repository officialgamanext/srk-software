import { Suspense } from "react";
import EmployeesView from "@/components/EmployeesView";

export const metadata = {
  title: "Employee Manager | SRK Retail Software",
  description: "Retail staff directory, ImageKit KYC documents, compensation, and emergency contacts",
};

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Employee Directory...
      </div>
    }>
      <EmployeesView />
    </Suspense>
  );
}
