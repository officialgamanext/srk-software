import { Suspense, use } from "react";
import EmployeeDetailView from "@/components/EmployeeDetailView";

export const instant = false;

export const metadata = {
  title: "Employee Profile & Advances | SRK Retail Software",
  description: "Employee details, ImageKit documents, salary advances, and installment records",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function EmployeeDetailContent({ params }: PageProps) {
  const { id } = use(params);
  return <EmployeeDetailView employeeDocId={id} />;
}

export default function EmployeeDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Employee Profile...
      </div>
    }>
      <EmployeeDetailContent params={params} />
    </Suspense>
  );
}
