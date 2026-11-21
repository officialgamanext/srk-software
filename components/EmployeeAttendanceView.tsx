"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getCountFromServer,
  where,
  type DocumentSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import type { EmployeeItem } from "@/components/EmployeesView";
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  RefreshCw, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  QrCode, 
  Save, 
  Sparkles, 
  ArrowLeft,
  Building2,
  Check,
  X
} from "lucide-react";

type AttendanceStatus = "present" | "absent" | "half_day";

interface DailyAttendanceState {
  [employeeId: string]: AttendanceStatus;
}

const PAGE_SIZE = 24;

export default function EmployeeAttendanceView() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  // Attendance map for the selected date: employeeId -> status
  const [attendanceMap, setAttendanceMap] = useState<DailyAttendanceState>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Pagination cursors
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch Total Count using getCountFromServer
  const fetchTotalEmployeesCount = useCallback(async () => {
    try {
      const coll = collection(db, "employees");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback for attendance:", err);
      try {
        const snap = await getDocs(collection(db, "employees"));
        setTotalCount(snap.size);
      } catch (e) {
        console.error("Count failed:", e);
      }
    }
  }, []);

  // Fetch Employees Page (Limit 24)
  const fetchEmployeesPage = useCallback(async (pageToFetch: number) => {
    setLoading(true);
    try {
      const coll = collection(db, "employees");
      let q;

      const prevCursor = pageSnapshotsRef.current[pageToFetch - 1];
      if (pageToFetch === 1 || !prevCursor) {
        try {
          q = query(coll, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        } catch {
          q = query(coll, limit(PAGE_SIZE));
        }
      } else {
        try {
          q = query(coll, orderBy("createdAt", "desc"), startAfter(prevCursor), limit(PAGE_SIZE));
        } catch {
          q = query(coll, startAfter(prevCursor), limit(PAGE_SIZE));
        }
      }

      const snap = await getDocs(q);
      const items: EmployeeItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          employeeId: data.employeeId || "00000000",
          name: data.name || "Unnamed",
          mobile: data.mobile || "—",
          city: data.city || "—",
          address: data.address || "",
          role: data.role || "Sales",
          wageType: data.wageType || "monthly",
          salary: data.salary || 0,
          aadharNumber: data.aadharNumber || "",
          panNumber: data.panNumber || "",
          profilePicUrl: data.profilePicUrl || "",
          emergencyContacts: data.emergencyContacts || [
            { relation: "Father", name: "", mobile: "" },
            { relation: "Spouse", name: "", mobile: "" },
          ],
          store: data.store || "Main Branch",
          joiningDate: data.joiningDate || "",
          status: data.status || "active",
          createdAt: data.createdAt || "",
        });
      });

      setEmployees(items);

      if (snap.docs.length > 0) {
        pageSnapshotsRef.current[pageToFetch] = snap.docs[snap.docs.length - 1];
      }
    } catch (err) {
      console.error("Error loading employees for attendance:", err);
      setToast({ type: "error", message: "Failed to load employees." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Attendance records for the selected date
  const fetchDateAttendance = useCallback(async () => {
    try {
      const coll = collection(db, "employee_attendance");
      const q = query(coll, where("date", "==", selectedDate));
      const snap = await getDocs(q);

      const map: DailyAttendanceState = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.employeeId && data.status) {
          map[data.employeeId] = data.status as AttendanceStatus;
        }
      });

      setAttendanceMap(map);
    } catch (err) {
      console.error("Error loading attendance records for date:", err);
    }
  }, [selectedDate]);

  // Initial load & date changes
  useEffect(() => {
    fetchTotalEmployeesCount();
    fetchEmployeesPage(1);
  }, [fetchTotalEmployeesCount, fetchEmployeesPage]);

  useEffect(() => {
    fetchDateAttendance();
  }, [fetchDateAttendance]);

  // Handle Marking Individual Status (Instant Auto-save to Firestore)
  const handleMarkStatus = async (emp: EmployeeItem, status: AttendanceStatus) => {
    // Optimistic UI update
    setAttendanceMap((prev) => ({
      ...prev,
      [emp.employeeId]: status,
    }));

    try {
      const docId = `${selectedDate}_${emp.employeeId}`;
      const docRef = doc(db, "employee_attendance", docId);
      await setDoc(docRef, {
        id: docId,
        date: selectedDate,
        employeeId: emp.employeeId,
        employeeDocId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        profilePicUrl: emp.profilePicUrl || "",
        store: emp.store,
        status,
        markedAt: new Date().toISOString(),
        markedBy: "manual",
      });
    } catch (err) {
      console.error("Failed to save attendance:", err);
      setToast({ type: "error", message: `Failed to mark ${status} for ${emp.name}.` });
    }
  };

  // Mark all on current page as Present
  const handleMarkAllPresent = async () => {
    setSaving(true);
    try {
      const newMap = { ...attendanceMap };
      for (const emp of filteredEmployees) {
        newMap[emp.employeeId] = "present";
        const docId = `${selectedDate}_${emp.employeeId}`;
        const docRef = doc(db, "employee_attendance", docId);
        await setDoc(docRef, {
          id: docId,
          date: selectedDate,
          employeeId: emp.employeeId,
          employeeDocId: emp.id,
          employeeName: emp.name,
          employeeRole: emp.role,
          profilePicUrl: emp.profilePicUrl || "",
          store: emp.store,
          status: "present",
          markedAt: new Date().toISOString(),
          markedBy: "manual_bulk",
        });
      }
      setAttendanceMap(newMap);
      setToast({ type: "success", message: "Marked all employees as PRESENT for today." });
    } catch (err) {
      console.error("Bulk mark present error:", err);
      setToast({ type: "error", message: "Failed to mark all present." });
    } finally {
      setSaving(false);
    }
  };

  // Mark all on current page as Absent (Default state)
  const handleMarkAllAbsent = async () => {
    setSaving(true);
    try {
      const newMap = { ...attendanceMap };
      for (const emp of filteredEmployees) {
        newMap[emp.employeeId] = "absent";
        const docId = `${selectedDate}_${emp.employeeId}`;
        const docRef = doc(db, "employee_attendance", docId);
        await setDoc(docRef, {
          id: docId,
          date: selectedDate,
          employeeId: emp.employeeId,
          employeeDocId: emp.id,
          employeeName: emp.name,
          employeeRole: emp.role,
          profilePicUrl: emp.profilePicUrl || "",
          store: emp.store,
          status: "absent",
          markedAt: new Date().toISOString(),
          markedBy: "manual_bulk",
        });
      }
      setAttendanceMap(newMap);
      setToast({ type: "info", message: "Reset all employees to ABSENT." });
    } catch (err) {
      console.error("Bulk mark absent error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Filtered List
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (storeFilter !== "all" && emp.store !== storeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.employeeId.includes(q) ||
          emp.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, storeFilter, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;

    employees.forEach((emp) => {
      // BY DEFAULT ALL ARE ABSENT
      const st = attendanceMap[emp.employeeId] || "absent";
      if (st === "present") present++;
      else if (st === "half_day") halfDay++;
      else absent++;
    });

    const rate = employees.length > 0 ? Math.round(((present + halfDay * 0.5) / employees.length) * 100) : 0;

    return { present, halfDay, absent, rate };
  }, [employees, attendanceMap]);

  // Pagination navigation
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchEmployeesPage(newPage);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-900 select-none">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/employees"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Calendar className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                  Employee Daily Attendance
                </h1>
                <span className="rounded bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
                  DEFAULT: ABSENT
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Mark staff daily attendance across Present, Absent, and Half-Day states (24 per page with server total count).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/employees/scan"
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 shadow-xs cursor-pointer transition-colors"
            >
              <QrCode className="h-3.5 w-3.5 text-emerald-600" />
              <span>Launch QR Scanner</span>
            </Link>

            <button
              onClick={handleMarkAllPresent}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 shadow-xs cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Mark All Present</span>
            </button>

            <button
              onClick={handleMarkAllAbsent}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 shadow-xs cursor-pointer"
            >
              <X className="h-3.5 w-3.5 text-rose-500" />
              <span>Reset to Absent</span>
            </button>
          </div>
        </div>

        {/* 4 Attendance Stats Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Staff</span>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-zinc-900">{totalCount}</span>
              <span className="text-[10px] text-zinc-400">server count</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Present</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-700">{stats.present}</span>
              <span className="text-[10px] text-emerald-600/70">{stats.rate}% rate</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">Half Day</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-900">{stats.halfDay}</span>
              <span className="text-[10px] text-amber-600/70">4 hrs work</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-rose-700">Absent (Default)</span>
              <XCircle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-rose-700">{stats.absent}</span>
              <span className="text-[10px] text-rose-600/70">unmarked/absent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date & Filter Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span className="font-semibold text-zinc-700">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-bold text-zinc-900 focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search staff name or 8-digit ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-zinc-50/50 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Sheet Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs text-zinc-500 font-mono">Loading attendance register...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center">
            <Users className="h-8 w-8 text-zinc-400 mb-2" />
            <h3 className="text-xs font-semibold text-zinc-800">No staff records found</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Please register employees first to mark daily attendance.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">8-Digit ID</th>
                  <th className="px-4 py-3">Role & Store</th>
                  <th className="px-4 py-3">Wage Basis</th>
                  <th className="px-4 py-3 text-center">Attendance Status ({selectedDate})</th>
                  <th className="px-4 py-3 text-right">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-sans">
                {filteredEmployees.map((emp) => {
                  // By default all be absent
                  const currentStatus = attendanceMap[emp.employeeId] || "absent";
                  return (
                    <tr key={emp.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Avatar & Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {emp.profilePicUrl ? (
                            <img
                              src={emp.profilePicUrl}
                              alt={emp.name}
                              className="h-8 w-8 rounded-full object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0 text-xs">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <Link
                            href={`/employees/${emp.id}`}
                            className="font-semibold text-zinc-900 hover:text-emerald-700 transition-colors"
                          >
                            {emp.name}
                          </Link>
                        </div>
                      </td>

                      {/* 8-Digit ID */}
                      <td className="px-4 py-3">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono font-bold text-zinc-800 border border-zinc-200">
                          {emp.employeeId}
                        </span>
                      </td>

                      {/* Role & Store */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-800">{emp.role}</div>
                        <div className="text-[11px] text-zinc-400">{emp.store}</div>
                      </td>

                      {/* Wage Basis */}
                      <td className="px-4 py-3 font-mono">
                        <span className="capitalize">{emp.wageType}</span>
                      </td>

                      {/* 3 Toggle Buttons: Present, Half Day, Absent */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(emp, "present")}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === "present"
                                ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30 font-bold"
                                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-emerald-700"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Present</span>
                          </button>

                          {/* Half Day Button */}
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(emp, "half_day")}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === "half_day"
                                ? "bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/30 font-bold"
                                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-amber-700"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>Half Day</span>
                          </button>

                          {/* Absent Button (Default) */}
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(emp, "absent")}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                              currentStatus === "absent"
                                ? "bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30 font-bold"
                                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-rose-700"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>

                      {/* Current Status Pill */}
                      <td className="px-4 py-3 text-right">
                        {currentStatus === "present" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            PRESENT
                          </span>
                        )}
                        {currentStatus === "half_day" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            HALF DAY
                          </span>
                        )}
                        {currentStatus === "absent" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            ABSENT
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls (24 items per page) */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 gap-2">
              <div className="flex items-center gap-1.5">
                <span>Showing</span>
                <span className="font-mono font-semibold text-zinc-900">
                  {totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
                </span>
                <span>to</span>
                <span className="font-mono font-semibold text-zinc-900">
                  {Math.min(currentPage * PAGE_SIZE, totalCount)}
                </span>
                <span>of</span>
                <span className="font-mono font-semibold text-zinc-900">{totalCount}</span>
                <span>total employees (Limit 24 / page)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`h-7 w-7 rounded-md text-xs font-mono font-medium transition-colors cursor-pointer ${
                          currentPage === pageNum
                            ? "bg-emerald-600 text-white font-bold"
                            : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
