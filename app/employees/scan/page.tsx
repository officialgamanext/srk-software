import { Suspense } from "react";
import EmployeeScanAttendanceView from "@/components/EmployeeScanAttendanceView";

export const metadata = {
  title: "Scan Attendance QR | SRK Retail Software",
  description: "Optical QR code camera scanner for automated employee attendance",
};

export default function EmployeeScanPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Initializing Optical Scanner...
      </div>
    }>
      <EmployeeScanAttendanceView />
    </Suspense>
  );
}
