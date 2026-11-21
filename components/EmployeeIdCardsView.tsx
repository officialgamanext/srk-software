"use client";

import { useState, useEffect } from "react";
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

        // Generate high-res QR code of just the 8-digit employee ID
        try {
          const qrData = await QRCode.toDataURL(emp.employeeId, {
            width: 250,
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

  // Download single card helper returning dataUrl or downloading
  const renderCardCanvas = async (emp: EmployeeItem): Promise<HTMLCanvasElement> => {
    const width = 340;
    const height = 480;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d canvas context");

    // 2x scale for high-res crispness
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // 1. Base Card Background (White)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Background Design: Modern Curved Emerald Waves
    // Top Curved Gradient Accent
    const topGrad = ctx.createLinearGradient(0, 0, width, 100);
    topGrad.addColorStop(0, "#059669");
    topGrad.addColorStop(0.5, "#10b981");
    topGrad.addColorStop(1, "#34d399");

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, 70);
    ctx.bezierCurveTo(width * 0.7, 95, width * 0.3, 40, 0, 75);
    ctx.closePath();
    ctx.fill();

    // Soft secondary wave accent
    ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
    ctx.beginPath();
    ctx.moveTo(0, 75);
    ctx.bezierCurveTo(width * 0.35, 45, width * 0.65, 105, width, 75);
    ctx.lineTo(width, 90);
    ctx.bezierCurveTo(width * 0.65, 115, width * 0.35, 60, 0, 90);
    ctx.closePath();
    ctx.fill();

    // Bottom Curved Wave Accent
    const botGrad = ctx.createLinearGradient(0, height - 50, width, height);
    botGrad.addColorStop(0, "#10b981");
    botGrad.addColorStop(1, "#047857");

    ctx.fillStyle = botGrad;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, height - 25);
    ctx.bezierCurveTo(width * 0.6, height - 45, width * 0.35, height - 10, 0, height - 30);
    ctx.closePath();
    ctx.fill();

    // Card Outline Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // 3. Profile Picture (Centered)
    const photoCenterX = width / 2;
    const photoCenterY = 85;
    const photoRadius = 40;

    // Outer White Halo
    ctx.beginPath();
    ctx.arc(photoCenterX, photoCenterY, photoRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Outer Emerald Ring
    ctx.beginPath();
    ctx.arc(photoCenterX, photoCenterY, photoRadius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Clip circular photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2);
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
        ctx.drawImage(img, photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
      } catch {
        // Fallback initial
        ctx.fillStyle = "#ecfdf5";
        ctx.fillRect(photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
        ctx.fillStyle = "#065f46";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(emp.name.charAt(0).toUpperCase(), photoCenterX, photoCenterY + 9);
      }
    } else {
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
      ctx.fillStyle = "#065f46";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(emp.name.charAt(0).toUpperCase(), photoCenterX, photoCenterY + 9);
    }
    ctx.restore();

    // 4. Employee Name (Directly below profile pic, center aligned)
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(emp.name.toUpperCase(), width / 2, 155);

    // 5. Mobile Number (Directly below name, center aligned)
    ctx.textAlign = "center";
    ctx.fillStyle = "#475569";
    ctx.font = "bold 13px monospace";
    ctx.fillText(emp.mobile, width / 2, 180);

    // 6. QR Code (Directly below mobile number, center aligned)
    const qrDataUrl = qrMap[emp.employeeId];
    if (qrDataUrl) {
      const qrSize = 160;
      const qrX = (width - qrSize) / 2;
      const qrY = 205;

      // Clean white container with border for the QR code
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);

      const qrImg = new Image();
      await new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.src = qrDataUrl;
      });
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 7. 8-Digit Employee ID (Directly below QR code, center aligned)
      const idY = qrY + qrSize + 32;

      // Centered Pill Badge for Employee ID
      ctx.fillStyle = "#f0fdf4";
      ctx.fillRect(width / 2 - 75, idY - 20, 150, 28);
      ctx.strokeStyle = "#86efac";
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - 75, idY - 20, 150, 28);

      ctx.textAlign = "center";
      ctx.fillStyle = "#15803d";
      ctx.font = "bold 18px monospace";
      ctx.fillText(emp.employeeId, width / 2, idY);
    }

    return canvas;
  };

  // Download individual ID card
  const handleDownloadSingleCard = async (emp: EmployeeItem) => {
    setDownloadingId(emp.employeeId);
    try {
      const canvas = await renderCardCanvas(emp);
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

  // Download all ID cards sequentially
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  const handleDownloadAllCards = async () => {
    if (filteredEmployees.length === 0) {
      setToast({ type: "error", message: "No employee cards available to download." });
      return;
    }
    setDownloadingAll(true);
    setToast({ type: "info", message: `Preparing to download ${filteredEmployees.length} ID cards...` });

    try {
      for (let i = 0; i < filteredEmployees.length; i++) {
        const emp = filteredEmployees[i];
        const canvas = await renderCardCanvas(emp);
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `ID_CARD_${emp.employeeId}_${emp.name.replace(/\s+/g, "_")}.png`;
        a.click();

        // Brief delay between downloads so the browser handles them gracefully
        await new Promise((res) => setTimeout(res, 250));
      }
      setToast({ type: "success", message: `Successfully downloaded all ${filteredEmployees.length} ID cards!` });
    } catch (err) {
      console.error("Download all error:", err);
      setToast({ type: "error", message: "Failed during bulk download of ID cards." });
    } finally {
      setDownloadingAll(false);
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
                  MINIMAL & CLEAN
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Design: Background layout with centered profile photo, name, mobile number, QR code, and 8-digit employee ID.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllCards}
              disabled={downloadingAll || loading || filteredEmployees.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 shadow-xs cursor-pointer transition-colors"
            >
              <Download className={`h-3.5 w-3.5 text-emerald-700 ${downloadingAll ? "animate-bounce" : ""}`} />
              <span>{downloadingAll ? "Downloading All..." : "Download All Cards"}</span>
            </button>

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
              placeholder="Search by name, 8-digit ID, mobile..."
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
            <span className="text-xs text-zinc-500 font-mono">Generating clean ID cards and QR codes...</span>
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
                className="w-[280px] rounded-2xl border border-zinc-200 bg-white shadow-md overflow-hidden flex flex-col justify-between print:shadow-none print:border-zinc-300 transition-all hover:shadow-lg relative"
              >
                {/* Background Design: Top Curved Emerald Wave Accent */}
                <div className="relative h-20 w-full overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500">
                  <svg
                    viewBox="0 0 280 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute inset-0 w-full h-full preserve-3d"
                  >
                    <path
                      d="M0 60 C80 85 200 40 280 65 L280 0 L0 0 Z"
                      fill="url(#topWaveGrad)"
                    />
                    <defs>
                      <linearGradient id="topWaveGrad" x1="0" y1="0" x2="280" y2="80" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#059669" />
                        <stop offset="0.5" stopColor="#10b981" />
                        <stop offset="1" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Profile Photo (Centered, overlapping the wave) */}
                <div className="-mt-11 flex justify-center">
                  <div className="relative h-22 w-22 rounded-full border-4 border-white shadow-sm overflow-hidden bg-white ring-2 ring-emerald-500 shrink-0">
                    {emp.profilePicUrl ? (
                      <img
                        src={emp.profilePicUrl}
                        alt={emp.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-2xl">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Content - ALL CENTER ALIGNED */}
                <div className="px-5 pt-3 pb-4 text-center flex-1 flex flex-col items-center">
                  {/* Name (Directly below profile pic) */}
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-tight text-center">
                    {emp.name}
                  </h3>

                  {/* Mobile Number (Directly below name) */}
                  <div className="mt-1 font-mono font-semibold text-xs text-zinc-600 text-center tracking-wide">
                    {emp.mobile}
                  </div>

                  {/* QR Code (Directly below mobile number) */}
                  <div className="mt-4 flex flex-col items-center justify-center p-2 rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
                    {qrMap[emp.employeeId] ? (
                      <img
                        src={qrMap[emp.employeeId]}
                        alt={`QR ${emp.employeeId}`}
                        className="h-32 w-32 object-contain"
                      />
                    ) : (
                      <div className="h-32 w-32 flex items-center justify-center text-zinc-400">
                        <QrCode className="h-8 w-8 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* 8-Digit Employee ID (Directly below QR code) */}
                  <div className="mt-3.5 inline-block rounded-md bg-emerald-50 border border-emerald-200/80 px-3 py-1 font-mono text-sm font-bold text-emerald-800 tracking-wider text-center">
                    {emp.employeeId}
                  </div>
                </div>

                {/* Background Design: Bottom Wave Accent */}
                <div className="h-3 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

                {/* Download Button (Hidden in Print) */}
                <div className="p-2.5 bg-zinc-50 border-t border-zinc-100 print:hidden">
                  <button
                    onClick={() => handleDownloadSingleCard(emp)}
                    disabled={downloadingId === emp.employeeId}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
                  >
                    {downloadingId === emp.employeeId ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Download ID Card</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
