"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import type { EmployeeItem } from "@/components/EmployeesView";
import QRCode from "qrcode";
import { 
  CreditCard, 
  Download, 
  Printer, 
  Search, 
  ArrowLeft, 
  RefreshCw, 
  Phone, 
  Building2, 
  MapPin, 
  QrCode, 
  Users, 
  CheckCircle2,
  Sparkles
} from "lucide-react";

export default function EmployeeIdCardsView() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Fetch all employees and generate their QR codes
  const loadEmployeesAndQRs = async () => {
    setLoading(true);
    try {
      const coll = collection(db, "employees");
      const snap = await getDocs(query(coll, orderBy("createdAt", "desc")));
      const list: EmployeeItem[] = [];
      const newQrMap: Record<string, string> = {};

      for (const d of snap.docs) {
        const data = d.data();
        const emp: EmployeeItem = {
          id: d.id,
          employeeId: data.employeeId || "00000000",
          name: data.name || "Employee",
          mobile: data.mobile || "—",
          city: data.city || "—",
          address: data.address || "",
          role: data.role || "Staff",
          wageType: data.wageType || "monthly",
          salary: data.salary || 0,
          aadharNumber: data.aadharNumber || "",
          panNumber: data.panNumber || "",
          profilePicUrl: data.profilePicUrl || "",
          emergencyContacts: data.emergencyContacts || [
            { relation: "Contact", name: "", mobile: "" },
            { relation: "Contact", name: "", mobile: "" },
          ],
          store: data.store || "Main Branch",
          joiningDate: data.joiningDate || "",
          status: data.status || "active",
          createdAt: data.createdAt || "",
        };
        list.push(emp);

        // Generate QR code for this employee's 8-digit ID
        try {
          const qrData = await QRCode.toDataURL(emp.employeeId, {
            width: 200,
            margin: 1,
            color: { dark: "#09090b", light: "#ffffff" },
          });
          newQrMap[emp.employeeId] = qrData;
        } catch (e) {
          console.warn("QR gen error for:", emp.employeeId, e);
        }
      }

      setEmployees(list);
      setQrMap(newQrMap);
    } catch (err) {
      console.error("Error loading ID cards:", err);
      setToast({ type: "error", message: "Failed to load employee ID cards." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeesAndQRs();
  }, []);

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeId.includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.store.toLowerCase().includes(q) ||
      emp.mobile.includes(q)
    );
  });

  // Download individual ID card using an offscreen Canvas
  const handleDownloadSingleCard = async (emp: EmployeeItem) => {
    setDownloadingId(emp.employeeId);
    try {
      const cardEl = document.getElementById(`id-card-${emp.employeeId}`);
      if (!cardEl) {
        throw new Error("Card element not found");
      }

      // Create high-res canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2d canvas context");

      const width = 360;
      const height = 540;
      canvas.width = width * 2; // 2x for retina quality
      canvas.height = height * 2;
      ctx.scale(2, 2);

      // Card Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Card Border & Rounded Corners simulation
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Top Header Gradient Banner
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#059669");
      grad.addColorStop(1, "#10b981");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 85);

      // Company Branding Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SRK RETAIL SOFTWARE", width / 2, 32);

      ctx.fillStyle = "#d1fae5";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("EMPLOYEE IDENTIFICATION CARD", width / 2, 48);

      ctx.fillStyle = "#ffffff";
      ctx.font = "8px monospace";
      ctx.fillText(`STORE: ${emp.store.toUpperCase()}`, width / 2, 64);

      // Profile Photo Circle
      const photoY = 125;
      const photoRadius = 38;

      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, photoY, photoRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (emp.profilePicUrl) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = emp.profilePicUrl!;
          });
          ctx.drawImage(img, width / 2 - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
        } catch {
          // Fallback initial
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(width / 2 - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(emp.name.charAt(0).toUpperCase(), width / 2, photoY + 8);
        }
      } else {
        ctx.fillStyle = "#d1fae5";
        ctx.fillRect(width / 2 - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
        ctx.fillStyle = "#065f46";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(emp.name.charAt(0).toUpperCase(), width / 2, photoY + 8);
      }
      ctx.restore();

      // Outer ring for profile photo
      ctx.beginPath();
      ctx.arc(width / 2, photoY, photoRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Employee Name
      ctx.textAlign = "center";
      ctx.fillStyle = "#09090b";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(emp.name.toUpperCase(), width / 2, 185);

      // Role Pill
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(width / 2 - 60, 196, 120, 20);
      ctx.strokeStyle = "#a7f3d0";
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - 60, 196, 120, 20);

      ctx.fillStyle = "#047857";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(emp.role.toUpperCase(), width / 2, 210);

      // Employee Details Block
      ctx.textAlign = "left";
      ctx.fillStyle = "#71717a";
      ctx.font = "10px sans-serif";

      // 8-Digit ID
      ctx.fillText("EMP ID:", 40, 245);
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#09090b";
      ctx.fillText(emp.employeeId, 120, 245);

      // Mobile
      ctx.fillStyle = "#71717a";
      ctx.font = "10px sans-serif";
      ctx.fillText("MOBILE:", 40, 265);
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#09090b";
      ctx.fillText(emp.mobile, 120, 265);

      // Emergency Contact
      if (emp.emergencyContacts?.[0]?.mobile) {
        ctx.fillStyle = "#71717a";
        ctx.font = "10px sans-serif";
        ctx.fillText("EMERGENCY:", 40, 285);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#dc2626";
        ctx.fillText(`${emp.emergencyContacts[0].mobile} (${emp.emergencyContacts[0].relation})`, 120, 285);
      }

      // QR Code
      const qrDataUrl = qrMap[emp.employeeId];
      if (qrDataUrl) {
        const qrImg = new Image();
        await new Promise((resolve) => {
          qrImg.onload = resolve;
          qrImg.src = qrDataUrl;
        });
        const qrSize = 130;
        ctx.drawImage(qrImg, width / 2 - qrSize / 2, 310, qrSize, qrSize);

        ctx.textAlign = "center";
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#09090b";
        ctx.fillText(emp.employeeId, width / 2, 455);

        ctx.font = "8px sans-serif";
        ctx.fillStyle = "#71717a";
        ctx.fillText("SCAN FOR ATTENDANCE & ACCESS", width / 2, 470);
      }

      // Card Bottom Strip
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(0, height - 35, width, 35);
      ctx.fillStyle = "#71717a";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AUTHORIZED RETAIL PERSONNEL • PROPERTY OF SRK RETAIL", width / 2, height - 15);

      // Download Trigger
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `ID_CARD_${emp.employeeId}_${emp.name.replace(/\s+/g, "_")}.png`;
      a.click();

      setToast({ type: "success", message: `Downloaded ID card for ${emp.name}!` });
    } catch (err) {
      console.error("Card download failed:", err);
      setToast({ type: "error", message: "Failed to download ID card image." });
    } finally {
      setDownloadingId(null);
    }
  };

  // Print all ID cards / browser print
  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-900 select-none">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4 print:hidden">
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
                  <CreditCard className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                  Employee ID Cards
                </h1>
                <span className="rounded bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
                  QR BADGES
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Print-ready smart employee ID badges with 8-digit unique ID and scannable attendance QR codes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintAll}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-zinc-600" />
              <span>Print All Cards</span>
            </button>

            <button
              onClick={loadEmployeesAndQRs}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Reload Cards</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-3 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, 8-digit ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/50 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <span className="text-xs text-zinc-500 font-mono">
            Showing <strong className="text-zinc-800">{filteredEmployees.length}</strong> of {employees.length} cards
          </span>
        </div>
      </div>

      {/* ID Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs text-zinc-500 font-mono">Generating ID cards and QR codes...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center">
            <CreditCard className="h-8 w-8 text-zinc-400 mb-2" />
            <h3 className="text-xs font-semibold text-zinc-800">No ID cards found</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              No employees match your search query or no employees have been registered yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center print:grid-cols-3 print:gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                id={`id-card-${emp.employeeId}`}
                className="w-[280px] rounded-2xl border-2 border-zinc-200 bg-white shadow-lg overflow-hidden flex flex-col justify-between print:shadow-none print:border-zinc-400"
              >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 text-center text-white relative">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold tracking-wider uppercase">
                    <Sparkles className="h-3 w-3" />
                    <span>SRK RETAIL</span>
                  </div>
                  <span className="text-[9px] tracking-widest uppercase text-emerald-100 font-semibold block">
                    EMPLOYEE IDENTITY CARD
                  </span>
                  <span className="text-[8px] text-emerald-200 font-mono block mt-0.5">
                    {emp.store.toUpperCase()}
                  </span>
                </div>

                {/* Profile Photo */}
                <div className="px-4 pt-4 pb-2 text-center">
                  <div className="mx-auto relative h-20 w-20 rounded-full border-3 border-emerald-500 overflow-hidden shadow-xs bg-zinc-100">
                    {emp.profilePicUrl ? (
                      <img
                        src={emp.profilePicUrl}
                        alt={emp.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-xl">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-zinc-900 uppercase tracking-tight">
                    {emp.name}
                  </h3>

                  <span className="inline-block mt-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-semibold text-emerald-700 uppercase tracking-wider">
                    {emp.role}
                  </span>

                  {/* Details Block */}
                  <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-left space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 text-[10px]">EMPLOYEE ID:</span>
                      <span className="font-mono font-bold text-zinc-900 bg-white px-1.5 py-0.2 rounded border border-zinc-200">
                        {emp.employeeId}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 text-[10px]">MOBILE:</span>
                      <span className="font-mono text-zinc-800 text-[10px]">{emp.mobile}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 text-[10px]">STORE:</span>
                      <span className="text-zinc-700 text-[10px] truncate max-w-[120px]">{emp.store}</span>
                    </div>

                    {emp.emergencyContacts?.[0]?.mobile && (
                      <div className="flex items-center justify-between text-rose-600 text-[9px]">
                        <span>EMERGENCY:</span>
                        <span className="font-mono">{emp.emergencyContacts[0].mobile}</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code Container */}
                  <div className="mt-3 flex flex-col items-center justify-center p-2 rounded-lg border border-zinc-200 bg-white">
                    {qrMap[emp.employeeId] ? (
                      <img
                        src={qrMap[emp.employeeId]}
                        alt={`QR ${emp.employeeId}`}
                        className="h-28 w-28"
                      />
                    ) : (
                      <div className="h-28 w-28 flex items-center justify-center text-zinc-400">
                        <QrCode className="h-6 w-6 animate-pulse" />
                      </div>
                    )}
                    <span className="font-mono text-xs font-bold text-zinc-900 tracking-wider">
                      {emp.employeeId}
                    </span>
                    <span className="text-[8px] text-zinc-400 uppercase tracking-wider">
                      Optical Attendance Scan
                    </span>
                  </div>
                </div>

                {/* Footer Bar / Download Button */}
                <div className="border-t border-zinc-200 bg-zinc-50 p-2 text-center">
                  <button
                    onClick={() => handleDownloadSingleCard(emp)}
                    disabled={downloadingId === emp.employeeId}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs print:hidden cursor-pointer"
                  >
                    {downloadingId === emp.employeeId ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Download ID Card</span>
                  </button>
                  <span className="hidden print:block text-[8px] text-zinc-400 font-bold">
                    AUTHORIZED RETAIL PERSONNEL • SRK RETAIL
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
