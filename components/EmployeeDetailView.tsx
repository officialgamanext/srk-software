"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  orderBy,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import { formatINR } from "@/lib/employeeUtils";
import type { EmployeeItem, EmergencyContact } from "@/components/EmployeesView";
import QRCode from "qrcode";
import { 
  User, 
  Users, 
  Phone, 
  MapPin, 
  Building2, 
  CreditCard, 
  Calendar, 
  ArrowLeft, 
  QrCode, 
  Wallet, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  ChevronRight, 
  Eye, 
  X, 
  Download, 
  FileText, 
  History, 
  Check, 
  Clock, 
  Layers,
  Sparkles
} from "lucide-react";

export interface AdvanceInstallment {
  id: string;
  installmentNo: number;
  amount: number;
  paidDate: string;
  paymentMethod: "salary_deduction" | "cash" | "upi" | "bank_transfer";
  remarks?: string;
  recordedAt: string;
}

export interface EmployeeAdvance {
  id: string;
  employeeDocId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  date: string;
  totalInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  status: "active" | "repaid";
  installments: AdvanceInstallment[];
  createdAt: string;
  updatedAt?: string;
}

interface EmployeeDetailViewProps {
  employeeDocId: string;
}

export default function EmployeeDetailView({ employeeDocId }: EmployeeDetailViewProps) {
  const [employee, setEmployee] = useState<EmployeeItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"profile" | "advances" | "attendance">("profile");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Image Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Advances State
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState<boolean>(false);
  const [isAddAdvanceModalOpen, setIsAddAdvanceModalOpen] = useState<boolean>(false);
  const [savingAdvance, setSavingAdvance] = useState<boolean>(false);
  const [advanceForm, setAdvanceForm] = useState({
    amount: 5000,
    reason: "",
    date: new Date().toISOString().split("T")[0],
    totalInstallments: 3,
  });

  // Installment Payment Modal State
  const [selectedAdvanceForPayment, setSelectedAdvanceForPayment] = useState<EmployeeAdvance | null>(null);
  const [savingInstallment, setSavingInstallment] = useState<boolean>(false);
  const [installmentForm, setInstallmentForm] = useState({
    amount: 1000,
    paidDate: new Date().toISOString().split("T")[0],
    paymentMethod: "salary_deduction" as "salary_deduction" | "cash" | "upi" | "bank_transfer",
    remarks: "Monthly deduction",
  });

  // Attendance History state
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);

  // Fetch Employee Doc
  const loadEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "employees", employeeDocId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        const emp: EmployeeItem = {
          id: snap.id,
          employeeId: d.employeeId || "00000000",
          name: d.name || "Unnamed",
          mobile: d.mobile || "—",
          city: d.city || "—",
          address: d.address || "",
          role: d.role || "Sales Executive",
          wageType: d.wageType || "monthly",
          salary: Number(d.salary) || 0,
          aadharNumber: d.aadharNumber || "",
          aadharFrontUrl: d.aadharFrontUrl || "",
          aadharBackUrl: d.aadharBackUrl || "",
          panNumber: d.panNumber || "",
          panImageUrl: d.panImageUrl || "",
          profilePicUrl: d.profilePicUrl || "",
          emergencyContacts: d.emergencyContacts || [
            { relation: "Father", name: "", mobile: "" },
            { relation: "Spouse", name: "", mobile: "" },
          ],
          store: d.store || "Main Branch",
          joiningDate: d.joiningDate || "",
          status: d.status || "active",
          createdAt: d.createdAt || "",
          updatedAt: d.updatedAt || "",
        };
        setEmployee(emp);

        // Generate QR Code containing the 8-digit Employee ID
        try {
          const url = await QRCode.toDataURL(emp.employeeId, {
            width: 250,
            margin: 1.5,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          setQrCodeDataUrl(url);
        } catch (qrErr) {
          console.warn("QR code generation error:", qrErr);
        }
      } else {
        setEmployee(null);
      }
    } catch (err) {
      console.error("Error loading employee details:", err);
      setToast({ type: "error", message: "Failed to load employee details." });
    } finally {
      setLoading(false);
    }
  }, [employeeDocId]);

  // Fetch Advances for this employee
  const loadAdvances = useCallback(async () => {
    if (!employee) return;
    setLoadingAdvances(true);
    try {
      const coll = collection(db, "employee_advances");
      const q = query(coll, where("employeeDocId", "==", employee.id));
      const snap = await getDocs(q);
      const list: EmployeeAdvance[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          employeeDocId: data.employeeDocId,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          amount: Number(data.amount) || 0,
          reason: data.reason || "",
          date: data.date || "",
          totalInstallments: Number(data.totalInstallments) || 1,
          paidAmount: Number(data.paidAmount) || 0,
          remainingAmount: Number(data.remainingAmount) || 0,
          status: data.status || "active",
          installments: data.installments || [],
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
        });
      });
      // Sort client-side by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAdvances(list);
    } catch (err) {
      console.error("Error loading advances:", err);
      setToast({ type: "error", message: "Failed to load advances." });
    } finally {
      setLoadingAdvances(false);
    }
  }, [employee]);

  // Fetch Attendance History
  const loadAttendance = useCallback(async () => {
    if (!employee) return;
    setLoadingAttendance(true);
    try {
      const coll = collection(db, "employee_attendance");
      const q = query(coll, where("employeeId", "==", employee.employeeId));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendanceRecords(list);
    } catch (err) {
      console.error("Error loading attendance history:", err);
    } finally {
      setLoadingAttendance(false);
    }
  }, [employee]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  useEffect(() => {
    if (activeTab === "advances" && employee) {
      loadAdvances();
    } else if (activeTab === "attendance" && employee) {
      loadAttendance();
    }
  }, [activeTab, employee, loadAdvances, loadAttendance]);

  // Save New Advance
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (advanceForm.amount <= 0) {
      setToast({ type: "error", message: "Advance amount must be greater than 0." });
      return;
    }
    if (!advanceForm.reason.trim()) {
      setToast({ type: "error", message: "Please specify a reason for the advance." });
      return;
    }

    setSavingAdvance(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: Omit<EmployeeAdvance, "id"> = {
        employeeDocId: employee.id,
        employeeId: employee.employeeId,
        employeeName: employee.name,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason.trim(),
        date: advanceForm.date,
        totalInstallments: Number(advanceForm.totalInstallments) || 1,
        paidAmount: 0,
        remainingAmount: Number(advanceForm.amount),
        status: "active",
        installments: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await addDoc(collection(db, "employee_advances"), payload);
      setToast({ type: "success", message: `Advance of ${formatINR(payload.amount)} recorded successfully!` });
      setIsAddAdvanceModalOpen(false);
      setAdvanceForm({
        amount: 5000,
        reason: "",
        date: new Date().toISOString().split("T")[0],
        totalInstallments: 3,
      });
      loadAdvances();
    } catch (err: unknown) {
      console.error("Error creating advance:", err);
      const msg = err instanceof Error ? err.message : "Failed to record advance";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingAdvance(false);
    }
  };

  // Record Installment Payment towards an Advance
  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceForPayment) return;
    if (installmentForm.amount <= 0) {
      setToast({ type: "error", message: "Installment amount must be greater than 0." });
      return;
    }

    setSavingInstallment(true);
    try {
      const newPaidAmount = selectedAdvanceForPayment.paidAmount + Number(installmentForm.amount);
      const newRemaining = Math.max(0, selectedAdvanceForPayment.amount - newPaidAmount);
      const isFullyPaid = newRemaining <= 0;

      const newInstallment: AdvanceInstallment = {
        id: `inst_${Date.now()}`,
        installmentNo: selectedAdvanceForPayment.installments.length + 1,
        amount: Number(installmentForm.amount),
        paidDate: installmentForm.paidDate,
        paymentMethod: installmentForm.paymentMethod,
        remarks: installmentForm.remarks.trim() || undefined,
        recordedAt: new Date().toISOString(),
      };

      const updatedInstallments = [...selectedAdvanceForPayment.installments, newInstallment];

      await updateDoc(doc(db, "employee_advances", selectedAdvanceForPayment.id), {
        paidAmount: newPaidAmount,
        remainingAmount: newRemaining,
        status: isFullyPaid ? "repaid" : "active",
        installments: updatedInstallments,
        updatedAt: new Date().toISOString(),
      });

      setToast({ 
        type: "success", 
        message: `Installment of ${formatINR(newInstallment.amount)} recorded! Remaining: ${formatINR(newRemaining)}` 
      });
      setSelectedAdvanceForPayment(null);
      loadAdvances();
    } catch (err: unknown) {
      console.error("Error recording installment:", err);
      const msg = err instanceof Error ? err.message : "Failed to record installment";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingInstallment(false);
    }
  };

  // Advances summary calculations
  const totalAdvanceAmount = advances.reduce((acc, a) => acc + a.amount, 0);
  const totalRepaidAmount = advances.reduce((acc, a) => acc + a.paidAmount, 0);
  const totalOutstanding = advances.reduce((acc, a) => acc + a.remainingAmount, 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 font-sans">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
          <span className="text-xs text-zinc-500 font-mono">Loading employee profile...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center font-sans">
        <AlertCircle className="h-10 w-10 text-zinc-400 mb-2" />
        <h2 className="text-base font-bold text-zinc-900">Employee Not Found</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          The requested employee record does not exist or has been removed.
        </p>
        <Link
          href="/employees"
          className="mt-4 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Employee Directory</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-900 select-none">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Breadcrumb & Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/employees"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
              title="Back to Employees"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-3">
              {employee.profilePicUrl ? (
                <img
                  src={employee.profilePicUrl}
                  alt={employee.name}
                  className="h-11 w-11 rounded-full object-cover border-2 border-emerald-500/30 shrink-0"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 shrink-0 text-base">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                    {employee.name}
                  </h1>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                    ID: {employee.employeeId}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-semibold capitalize ${
                    employee.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                  }`}>
                    {employee.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-zinc-700">{employee.role}</span>
                  <span>•</span>
                  <span>{employee.store}</span>
                  <span>•</span>
                  <span className="font-mono">{employee.mobile}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/employees/id-cards"
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5 text-emerald-600" />
              <span>View ID Card</span>
            </Link>

            <button
              onClick={() => {
                if (activeTab === "advances") loadAdvances();
                else if (activeTab === "attendance") loadAttendance();
                else loadEmployee();
              }}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex items-center gap-2 border-b border-zinc-200 text-xs font-medium">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Profile & KYC Details</span>
          </button>

          <button
            onClick={() => setActiveTab("advances")}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === "advances"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Salary Advances & Installments</span>
            {advances.filter((a) => a.status === "active").length > 0 && (
              <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[9px] font-mono font-bold">
                {advances.filter((a) => a.status === "active").length} ACTIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === "attendance"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Attendance History</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ================= TAB 1: PROFILE & KYC DETAILS ================= */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
            {/* Left 2 Cols: Details & Documents */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal & Compensation Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Employment & Compensation
                  </h3>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                    {employee.wageType}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">Role</span>
                    <span className="font-semibold text-zinc-900">{employee.role}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">Store Branch</span>
                    <span className="font-semibold text-zinc-900">{employee.store}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {employee.wageType === "monthly" ? "Monthly Salary" : "Daily Wage Rate"}
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-700">
                      {formatINR(employee.salary)}
                      <span className="text-[10px] text-zinc-400 font-normal">
                        {employee.wageType === "monthly" ? " /month" : " /day"}
                      </span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">Mobile Number</span>
                    <a href={`tel:${employee.mobile}`} className="font-mono font-semibold text-emerald-700 hover:underline">
                      {employee.mobile}
                    </a>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">City</span>
                    <span className="font-semibold text-zinc-900">{employee.city}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">Joining Date</span>
                    <span className="font-mono text-zinc-700">{employee.joiningDate || "—"}</span>
                  </div>

                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[11px] text-zinc-400 block mb-0.5">Residential Address</span>
                    <span className="text-zinc-800">{employee.address || "No address provided."}</span>
                  </div>
                </div>
              </div>

              {/* KYC Identification Documents (Aadhar & PAN ImageKit) */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="border-b border-zinc-100 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    KYC Identification (ImageKit Verified)
                  </h3>
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </div>

                <div className="space-y-4">
                  {/* Aadhar Card Details */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-zinc-800">Aadhar Card</span>
                      <span className="font-mono text-xs font-bold text-zinc-900 tracking-wider">
                        {employee.aadharNumber || "Not Provided"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-500 block mb-1">Aadhar Front</span>
                        {employee.aadharFrontUrl ? (
                          <div 
                            onClick={() => setPreviewImage({ url: employee.aadharFrontUrl!, title: `${employee.name} - Aadhar Front` })}
                            className="group relative h-28 rounded-md border border-zinc-200 bg-white overflow-hidden cursor-pointer shadow-2xs hover:border-emerald-500 transition-colors"
                          >
                            <img src={employee.aadharFrontUrl} alt="Aadhar Front" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                              <Eye className="h-4 w-4 mr-1" /> View Full
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-md border border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center text-zinc-400 text-xs">
                            <FileText className="h-5 w-5 mb-1" />
                            <span>No Front Image</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-zinc-500 block mb-1">Aadhar Back</span>
                        {employee.aadharBackUrl ? (
                          <div 
                            onClick={() => setPreviewImage({ url: employee.aadharBackUrl!, title: `${employee.name} - Aadhar Back` })}
                            className="group relative h-28 rounded-md border border-zinc-200 bg-white overflow-hidden cursor-pointer shadow-2xs hover:border-emerald-500 transition-colors"
                          >
                            <img src={employee.aadharBackUrl} alt="Aadhar Back" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                              <Eye className="h-4 w-4 mr-1" /> View Full
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-md border border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center text-zinc-400 text-xs">
                            <FileText className="h-5 w-5 mb-1" />
                            <span>No Back Image</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PAN Card Details */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-zinc-800">PAN Card</span>
                      <span className="font-mono text-xs font-bold uppercase text-zinc-900 tracking-wider">
                        {employee.panNumber || "Not Provided"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <span className="text-[10px] font-semibold text-zinc-500 block mb-1">PAN Card Image</span>
                      {employee.panImageUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: employee.panImageUrl!, title: `${employee.name} - PAN Card` })}
                          className="group relative h-36 max-w-sm rounded-md border border-zinc-200 bg-white overflow-hidden cursor-pointer shadow-2xs hover:border-emerald-500 transition-colors"
                        >
                          <img src={employee.panImageUrl} alt="PAN Card" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                            <Eye className="h-4 w-4 mr-1" /> View Full Image
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 max-w-sm rounded-md border border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center text-zinc-400 text-xs">
                          <CreditCard className="h-5 w-5 mb-1" />
                          <span>No PAN Image Uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contacts Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="border-b border-zinc-100 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Emergency Contact Details
                  </h3>
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact 1 */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-zinc-800">
                        {employee.emergencyContacts?.[0]?.name || "Not specified"}
                      </span>
                      <span className="rounded bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.2 text-[9px] font-semibold">
                        {employee.emergencyContacts?.[0]?.relation || "Primary"}
                      </span>
                    </div>
                    <a
                      href={`tel:${employee.emergencyContacts?.[0]?.mobile}`}
                      className="text-xs font-mono text-emerald-700 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{employee.emergencyContacts?.[0]?.mobile || "—"}</span>
                    </a>
                  </div>

                  {/* Contact 2 */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-zinc-800">
                        {employee.emergencyContacts?.[1]?.name || "Not specified"}
                      </span>
                      <span className="rounded bg-zinc-200 text-zinc-700 px-1.5 py-0.2 text-[9px] font-semibold">
                        {employee.emergencyContacts?.[1]?.relation || "Secondary"}
                      </span>
                    </div>
                    <a
                      href={`tel:${employee.emergencyContacts?.[1]?.mobile}`}
                      className="text-xs font-mono text-emerald-700 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{employee.emergencyContacts?.[1]?.mobile || "—"}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: QR Code & ID Card Card */}
            <div className="space-y-6">
              {/* QR Code Identification Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs text-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  Employee QR Code
                </h3>

                <div className="mx-auto flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-200 bg-zinc-50 max-w-[220px]">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="Employee QR Code" className="h-44 w-44 rounded-lg bg-white p-1" />
                  ) : (
                    <div className="h-44 w-44 flex items-center justify-center text-zinc-400">
                      <QrCode className="h-10 w-10 animate-pulse" />
                    </div>
                  )}
                  <span className="mt-2 font-mono font-bold text-sm text-zinc-900 tracking-wider">
                    {employee.employeeId}
                  </span>
                  <span className="text-[10px] text-zinc-500">Scan for Attendance</span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={qrCodeDataUrl}
                    download={`QR_${employee.employeeId}_${employee.name}.png`}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download QR Code Image</span>
                  </a>

                  <Link
                    href="/employees/id-cards"
                    className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Open Printable ID Card</span>
                  </Link>
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="rounded-xl border border-zinc-200 bg-emerald-50/40 p-4 border-l-4 border-l-emerald-600">
                <span className="text-xs font-bold text-emerald-900 block mb-1">
                  8-Digit POS Unique Identification
                </span>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Employee ID <span className="font-mono font-bold text-zinc-800">{employee.employeeId}</span> is configured for automated optical QR barcode attendance scanning and payroll advance accounting.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SALARY ADVANCES & INSTALLMENTS ================= */}
        {activeTab === "advances" && (
          <div className="space-y-6 max-w-5xl">
            {/* Advance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                  Total Advance Given
                </span>
                <span className="mt-1 text-xl font-mono font-bold text-zinc-900 block">
                  {formatINR(totalAdvanceAmount)}
                </span>
                <span className="text-[10px] text-zinc-400">lifetime advances</span>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                  Total Repaid / Deducted
                </span>
                <span className="mt-1 text-xl font-mono font-bold text-emerald-700 block">
                  {formatINR(totalRepaidAmount)}
                </span>
                <span className="text-[10px] text-zinc-400">recorded installments</span>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block">
                  Outstanding Balance
                </span>
                <span className="mt-1 text-xl font-mono font-bold text-amber-700 block">
                  {formatINR(totalOutstanding)}
                </span>
                <span className="text-[10px] text-amber-600/80">balance remaining to recover</span>
              </div>
            </div>

            {/* Header + Add Advance Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Salary Advances Record</h3>
                <p className="text-xs text-zinc-500">
                  Record advance salary payments and track recovery through installments.
                </p>
              </div>

              <button
                onClick={() => setIsAddAdvanceModalOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Advance</span>
              </button>
            </div>

            {/* Advances List */}
            {loadingAdvances ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : advances.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center">
                <Wallet className="h-8 w-8 text-zinc-400 mb-2" />
                <h4 className="text-xs font-semibold text-zinc-800">No Salary Advances</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  No advances have been recorded for {employee.name}.
                </p>
                <button
                  onClick={() => setIsAddAdvanceModalOpen(true)}
                  className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Record First Advance</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {advances.map((adv) => {
                  const percentPaid = adv.amount > 0 ? Math.min(100, Math.round((adv.paidAmount / adv.amount) * 100)) : 0;
                  return (
                    <div
                      key={adv.id}
                      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-mono font-bold text-zinc-900">
                              {formatINR(adv.amount)}
                            </span>
                            <span className={`rounded-full px-2 py-0.2 text-[10px] font-semibold uppercase ${
                              adv.status === "repaid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {adv.status === "repaid" ? "Fully Repaid" : "Active Recovery"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 mt-0.5">
                            <span className="font-medium text-zinc-800">Reason:</span> {adv.reason}
                          </p>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                            <span>Given on: {adv.date}</span>
                            <span>•</span>
                            <span>Scheme: {adv.totalInstallments} Installment(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {adv.status !== "repaid" && (
                            <button
                              onClick={() => {
                                setSelectedAdvanceForPayment(adv);
                                const suggested = Math.round(adv.remainingAmount / Math.max(1, (adv.totalInstallments - adv.installments.length)));
                                setInstallmentForm({
                                  amount: Math.min(adv.remainingAmount, suggested || adv.remainingAmount),
                                  paidDate: new Date().toISOString().split("T")[0],
                                  paymentMethod: "salary_deduction",
                                  remarks: `Installment #${adv.installments.length + 1}`,
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Record Installment</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Repayment Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-zinc-500 text-[11px]">
                            Repaid: <strong className="font-mono text-emerald-700">{formatINR(adv.paidAmount)}</strong>
                          </span>
                          <span className="text-zinc-500 text-[11px]">
                            Remaining: <strong className="font-mono text-amber-700">{formatINR(adv.remainingAmount)}</strong> ({percentPaid}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              percentPaid >= 100 ? "bg-emerald-500" : "bg-emerald-600"
                            }`}
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                      </div>

                      {/* Installment History Table */}
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                        <span className="text-[11px] font-bold text-zinc-700 block mb-2">
                          Installment Payment Records ({adv.installments.length})
                        </span>

                        {adv.installments.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">
                            No installment payments recorded yet for this advance.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-zinc-700">
                              <thead>
                                <tr className="text-[10px] uppercase font-semibold text-zinc-400 border-b border-zinc-200">
                                  <th className="pb-1.5">#</th>
                                  <th className="pb-1.5">Date</th>
                                  <th className="pb-1.5">Amount</th>
                                  <th className="pb-1.5">Method</th>
                                  <th className="pb-1.5">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200/60">
                                {adv.installments.map((inst) => (
                                  <tr key={inst.id} className="text-[11px]">
                                    <td className="py-1.5 font-mono text-zinc-500">#{inst.installmentNo}</td>
                                    <td className="py-1.5 font-mono">{inst.paidDate}</td>
                                    <td className="py-1.5 font-mono font-bold text-emerald-700">
                                      {formatINR(inst.amount)}
                                    </td>
                                    <td className="py-1.5 capitalize">
                                      {inst.paymentMethod.replace("_", " ")}
                                    </td>
                                    <td className="py-1.5 text-zinc-500">{inst.remarks || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: ATTENDANCE HISTORY ================= */}
        {activeTab === "attendance" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Attendance Log</h3>
                <p className="text-xs text-zinc-500">
                  Review historical attendance records marked manually or via QR scanner.
                </p>
              </div>

              <Link
                href="/employees/attendance"
                className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs"
              >
                <span>Daily Attendance Sheet</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loadingAttendance ? (
              <div className="flex h-36 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-xs text-zinc-500">
                <Calendar className="h-6 w-6 text-zinc-400 mb-1" />
                <span>No attendance records found yet for this employee.</span>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="bg-zinc-50 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Marked By</th>
                      <th className="px-4 py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {attendanceRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-2.5 font-mono font-medium text-zinc-900">{rec.date}</td>
                        <td className="px-4 py-2.5">
                          {rec.status === "present" && (
                            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                              PRESENT
                            </span>
                          )}
                          {rec.status === "half_day" && (
                            <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                              HALF DAY
                            </span>
                          )}
                          {rec.status === "absent" && (
                            <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                              ABSENT
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-zinc-600">
                          {rec.markedBy === "qr_scanner" ? "QR Scanner" : "Manual Sheet"}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-zinc-400">
                          {rec.markedAt ? new Date(rec.markedAt).toLocaleTimeString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Advance */}
      {isAddAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Add Salary Advance</h3>
                  <p className="text-[11px] text-zinc-500">For {employee.name} (ID: {employee.employeeId})</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddAdvanceModalOpen(false)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Advance Amount (₹) *
                </label>
                <input
                  type="number"
                  min={100}
                  required
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Reason for Advance *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical emergency, Festival advance, House rent"
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Advance Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={advanceForm.date}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Recovery Installments *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    required
                    value={advanceForm.totalInstallments}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, totalInstallments: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddAdvanceModalOpen(false)}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdvance}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingAdvance && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Advance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Installment Payment */}
      {selectedAdvanceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Record Installment Payment</h3>
                <p className="text-[11px] text-zinc-500">
                  Advance: {formatINR(selectedAdvanceForPayment.amount)} (Remaining: {formatINR(selectedAdvanceForPayment.remainingAmount)})
                </p>
              </div>
              <button
                onClick={() => setSelectedAdvanceForPayment(null)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordInstallment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedAdvanceForPayment.remainingAmount}
                  required
                  value={installmentForm.amount}
                  onChange={(e) => setInstallmentForm({ ...installmentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={installmentForm.paidDate}
                    onChange={(e) => setInstallmentForm({ ...installmentForm, paidDate: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={installmentForm.paymentMethod}
                    onChange={(e) => setInstallmentForm({ ...installmentForm, paymentMethod: e.target.value as any })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800"
                  >
                    <option value="salary_deduction">Salary Deduction</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deducted from October salary"
                  value={installmentForm.remarks}
                  onChange={(e) => setInstallmentForm({ ...installmentForm, remarks: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedAdvanceForPayment(null)}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInstallment}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingInstallment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Installment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <div className="flex w-full items-center justify-between pb-2 text-white text-xs font-semibold">
              <span>{previewImage.title}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-[80vh] w-auto rounded-lg object-contain border border-white/20 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
