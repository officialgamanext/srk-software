"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  orderBy,
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import type { EmployeeItem } from "@/components/EmployeesView";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { 
  QrCode, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Users, 
  Volume2, 
  Clock, 
  Sparkles, 
  UserCheck, 
  Calendar,
  X,
  Keyboard
} from "lucide-react";

export default function EmployeeScanAttendanceView() {
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string>("");
  const [lastScannedEmployee, setLastScannedEmployee] = useState<EmployeeItem | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>("");
  const [scannedTodayList, setScannedTodayList] = useState<any[]>([]);
  const [manualIdInput, setManualIdInput] = useState<string>("");
  const [manualProcessing, setManualProcessing] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>("");

  const todayDate = new Date().toISOString().split("T")[0];

  // Play audio beep using Web Audio API on successful scan
  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // Audio not supported or blocked
    }
  };

  // Load today's scanned attendance list
  const loadTodayScans = useCallback(async () => {
    try {
      const coll = collection(db, "employee_attendance");
      const q = query(
        coll, 
        where("date", "==", todayDate), 
        where("status", "==", "present")
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => new Date(b.markedAt || 0).getTime() - new Date(a.markedAt || 0).getTime());
      setScannedTodayList(list);
    } catch (err) {
      console.warn("Could not load today's scans:", err);
    }
  }, [todayDate]);

  useEffect(() => {
    loadTodayScans();
  }, [loadTodayScans]);

  // Mark attendance in Firestore
  const processAttendanceForEmployeeId = useCallback(async (employeeId: string) => {
    const cleanId = employeeId.trim().replace(/[^0-9]/g, "");
    if (!cleanId) return;

    // Throttle duplicate scans within 4 seconds
    const now = Date.now();
    if (lastScannedCodeRef.current === cleanId && now - lastScannedTimeRef.current < 4000) {
      return;
    }
    lastScannedCodeRef.current = cleanId;
    lastScannedTimeRef.current = now;

    try {
      // Find employee by 8-digit employeeId
      const empColl = collection(db, "employees");
      const empQ = query(empColl, where("employeeId", "==", cleanId));
      const empSnap = await getDocs(empQ);

      if (empSnap.empty) {
        setToast({ 
          type: "error", 
          message: `Employee ID "${cleanId}" not registered in the system.` 
        });
        return;
      }

      const empDoc = empSnap.docs[0];
      const empData = empDoc.data();
      const empItem: EmployeeItem = {
        id: empDoc.id,
        employeeId: empData.employeeId,
        name: empData.name || "Employee",
        mobile: empData.mobile || "",
        city: empData.city || "",
        address: empData.address || "",
        role: empData.role || "Staff",
        wageType: empData.wageType || "monthly",
        salary: empData.salary || 0,
        aadharNumber: empData.aadharNumber || "",
        panNumber: empData.panNumber || "",
        profilePicUrl: empData.profilePicUrl || "",
        emergencyContacts: empData.emergencyContacts || [
          { relation: "Contact", name: "", mobile: "" },
          { relation: "Contact", name: "", mobile: "" },
        ],
        store: empData.store || "Main Branch",
        joiningDate: empData.joiningDate || "",
        status: empData.status || "active",
        createdAt: empData.createdAt || "",
      };

      // Record attendance for today
      const docId = `${todayDate}_${cleanId}`;
      const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      await setDoc(doc(db, "employee_attendance", docId), {
        id: docId,
        date: todayDate,
        employeeId: cleanId,
        employeeDocId: empDoc.id,
        employeeName: empItem.name,
        employeeRole: empItem.role,
        profilePicUrl: empItem.profilePicUrl || "",
        store: empItem.store,
        status: "present",
        markedAt: new Date().toISOString(),
        markedBy: "qr_scanner",
      });

      playSuccessBeep();
      setLastScannedEmployee(empItem);
      setLastScanTime(timeStr);
      setToast({ 
        type: "success", 
        message: `Attendance MARKED PRESENT for ${empItem.name} at ${timeStr}!` 
      });

      loadTodayScans();
    } catch (err: unknown) {
      console.error("Attendance scan recording error:", err);
      const msg = err instanceof Error ? err.message : "Failed to record scan attendance.";
      setToast({ type: "error", message: msg });
    }
  }, [todayDate, loadTodayScans]);

  // Start QR Camera Scanner
  const startScanner = async () => {
    setScannerError("");
    try {
      const scanner = new Html5Qrcode("qr-reader-container", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          processAttendanceForEmployeeId(decodedText);
        },
        () => {
          // Frame decode error (normal for empty frames)
        }
      );

      setScannerActive(true);
    } catch (err: unknown) {
      console.error("Camera scanner error:", err);
      const msg = err instanceof Error ? err.message : "Could not start camera scanner";
      setScannerError(msg + ". Ensure camera permissions are granted or use manual ID entry below.");
      setScannerActive(false);
    }
  };

  // Stop Scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current && scannerActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Scanner stop issue:", e);
      }
      setScannerActive(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle Manual ID Input
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;
    setManualProcessing(true);
    await processAttendanceForEmployeeId(manualIdInput.trim());
    setManualIdInput("");
    setManualProcessing(false);
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
                  <QrCode className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                  Scan QR Attendance
                </h1>
                <span className="rounded bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
                  OPTICAL SCANNER
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Hold employee ID badge QR code in front of camera to mark attendance for today ({todayDate}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/employees/attendance"
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs"
            >
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Attendance Sheet</span>
            </Link>

            <Link
              href="/employees/id-cards"
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs"
            >
              <span>Employee Badges</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Scanner Workspace */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
          {/* Left Column: Camera Viewfinder (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border-2 border-zinc-200 bg-white p-5 shadow-sm text-center">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Optical QR Code Scanner
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${scannerActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                  <span className="text-[11px] font-mono text-zinc-500">
                    {scannerActive ? "CAMERA LIVE" : "CAMERA PAUSED"}
                  </span>
                </div>
              </div>

              {/* QR Reader Box */}
              <div className="relative mx-auto w-full max-w-md aspect-square rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-950 flex flex-col items-center justify-center overflow-hidden shadow-inner">
                <div id="qr-reader-container" className="h-full w-full" />

                {!scannerActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white p-6 z-10">
                    <QrCode className="h-14 w-14 text-emerald-500 mb-3 animate-pulse" />
                    <h3 className="text-sm font-bold">Camera Scanner Ready</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">
                      Click below to activate device webcam or phone camera to scan employee badges.
                    </p>
                    <button
                      onClick={startScanner}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Start Camera Scanner</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scanner Controls */}
              <div className="mt-4 flex items-center justify-center gap-3">
                {scannerActive ? (
                  <button
                    onClick={stopScanner}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer shadow-xs"
                  >
                    <span>Pause Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={startScanner}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Turn On Camera</span>
                  </button>
                )}
              </div>

              {scannerError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 text-left">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>

            {/* Manual 8-Digit ID Input Fallback */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-700">
                <Keyboard className="h-3.5 w-3.5 text-zinc-400" />
                <span>Manual 8-Digit Employee ID Entry (Scanner Backup)</span>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Enter 8-digit numeric ID, e.g. 84920153"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value.replace(/[^0-9]/g, ""))}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={manualProcessing || manualIdInput.length !== 8}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {manualProcessing ? "Marking..." : "Mark Present"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Scan Success Notification & Today's Scans (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Last Scanned Employee Spotlight Banner */}
            {lastScannedEmployee ? (
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-5 shadow-md animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      ATTENDANCE RECORDED!
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-800">
                    {lastScanTime}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {lastScannedEmployee.profilePicUrl ? (
                    <img
                      src={lastScannedEmployee.profilePicUrl}
                      alt={lastScannedEmployee.name}
                      className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-xl shrink-0">
                      {lastScannedEmployee.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {lastScannedEmployee.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-800 bg-white px-1.5 py-0.2 rounded border border-emerald-300">
                        ID: {lastScannedEmployee.employeeId}
                      </span>
                      <span className="text-xs text-zinc-600 font-medium">
                        {lastScannedEmployee.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      {lastScannedEmployee.store}
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-emerald-100/70 p-2 text-center text-xs font-bold text-emerald-900">
                  STATUS: PRESENT FOR TODAY ({todayDate})
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-400">
                <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <h4 className="text-xs font-semibold text-zinc-700">Waiting for QR scan...</h4>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Point employee badge QR code at the camera.
                </p>
              </div>
            )}

            {/* Today's Scanned Log Feed */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Scanned Today ({scannedTodayList.length})</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-400">{todayDate}</span>
              </div>

              {scannedTodayList.length === 0 ? (
                <p className="text-xs text-zinc-400 italic text-center py-4">
                  No staff members scanned today yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {scannedTodayList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/80 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {item.profilePicUrl ? (
                          <img src={item.profilePicUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                            {item.employeeName?.charAt(0) || "E"}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-zinc-900 block truncate max-w-[140px]">
                            {item.employeeName}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            ID: {item.employeeId}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                          PRESENT
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                          {item.markedAt ? new Date(item.markedAt).toLocaleTimeString() : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
