import { Suspense } from "react";
import EmployeeAttendanceView from "@/components/EmployeeAttendanceView";

export const metadata = {
  title: "Employee Attendance | SRK Retail Software",
  description: "Daily staff attendance sheet with Present, Absent, and Half-Day states (24 per page limit)",
};

export default function EmployeeAttendancePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white text-xs text-zinc-500 font-mono">
        Loading Attendance Register...
      </div>
    }>
      <EmployeeAttendanceView />
    </Suspense>
  );
}
