"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getCountFromServer,
  type DocumentSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import { 
  generate8DigitEmpId, 
  uploadFileToImageKit, 
  formatINR, 
  EMPLOYEE_ROLES 
} from "@/lib/employeeUtils";
import * as XLSX from "xlsx";
import { 
  Users, 
  UserPlus, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  MapPin, 
  Building2, 
  FileSpreadsheet, 
  Sparkles, 
  AlertCircle,
  Eye,
  Camera,
  Upload,
  CreditCard,
  FileText,
  BadgeCheck,
  QrCode,
  ShieldAlert,
  Wallet,
  Calendar,
  Image as ImageIcon
} from "lucide-react";

export interface EmergencyContact {
  relation: string;
  name: string;
  mobile: string;
}

export interface EmployeeItem {
  id: string;
  employeeId: string; // 8-digit numeric auto unique
  name: string;
  mobile: string;
  city: string;
  address: string;
  role: string;
  wageType: "monthly" | "daily";
  salary: number; // Monthly salary or daily wages in ₹

  // Identification
  aadharNumber: string;
  aadharFrontUrl?: string;
  aadharBackUrl?: string;
  panNumber: string;
  panImageUrl?: string;

  // Profile Picture
  profilePicUrl?: string;

  // Two Emergency Contacts
  emergencyContacts: [EmergencyContact, EmergencyContact];

  store: string;
  joiningDate: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt?: string;
}

const PAGE_SIZE = 24;

const RELATIONS = ["Father", "Mother", "Spouse", "Brother", "Sister", "Friend", "Other"];

function getDefaultEmployeeFormData(): Omit<EmployeeItem, "id"> {
  const today = new Date().toISOString().split("T")[0];
  return {
    employeeId: generate8DigitEmpId(),
    name: "",
    mobile: "",
    city: "Hyderabad",
    address: "",
    role: "Sales Executive",
    wageType: "monthly",
    salary: 18000,
    aadharNumber: "",
    aadharFrontUrl: "",
    aadharBackUrl: "",
    panNumber: "",
    panImageUrl: "",
    profilePicUrl: "",
    emergencyContacts: [
      { relation: "Father", name: "", mobile: "" },
      { relation: "Spouse", name: "", mobile: "" },
    ],
    store: "Main Branch (Hyderabad)",
    joiningDate: today,
    status: "active",
    createdAt: "",
  };
}

export default function EmployeesView() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [wageFilter, setWageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Stores loaded from Firestore
  const [storeOptions, setStoreOptions] = useState<string[]>([
    "Main Branch (Hyderabad)",
    "Retail Outlet (Secunderabad)",
    "MADHU CREATIONS",
    "Warehouse Depot (Madhapur)",
  ]);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<EmployeeItem, "id">>(getDefaultEmployeeFormData());
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // File states for ImageKit uploads
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [aadharFrontFile, setAadharFrontFile] = useState<File | null>(null);
  const [aadharBackFile, setAadharBackFile] = useState<File | null>(null);
  const [panImageFile, setPanImageFile] = useState<File | null>(null);

  // Local image previews
  const [profilePicPreview, setProfilePicPreview] = useState<string>("");
  const [aadharFrontPreview, setAadharFrontPreview] = useState<string>("");
  const [aadharBackPreview, setAadharBackPreview] = useState<string>("");
  const [panImagePreview, setPanImagePreview] = useState<string>("");

  // Delete confirmation
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeItem | null>(null);

  // Pagination Cursors
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch store options
  useEffect(() => {
    async function loadStores() {
      try {
        const snap = await getDocs(collection(db, "stores"));
        const names: string[] = [];
        snap.forEach((d) => {
          const sName = d.data().name;
          if (sName && !names.includes(sName)) names.push(sName);
        });
        if (names.length > 0) {
          setStoreOptions((prev) => Array.from(new Set([...prev, ...names])));
        }
      } catch (err) {
        console.warn("Could not load stores for employee branches:", err);
      }
    }
    loadStores();
  }, []);

  // Fetch Total Count using getCountFromServer
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "employees");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback for employees:", err);
      try {
        const snap = await getDocs(collection(db, "employees"));
        setTotalCount(snap.size);
      } catch (fallbackErr) {
        console.error("Fallback employee count failed:", fallbackErr);
      }
    }
  }, []);

  // Fetch Page of Employees (Limit 24)
  const fetchPage = useCallback(async (pageToFetch: number) => {
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

      let snap;
      try {
        snap = await getDocs(q);
      } catch (queryErr) {
        console.warn("Ordered query fallback for employees:", queryErr);
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: EmployeeItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          employeeId: data.employeeId || "00000000",
          name: data.name || "Unnamed Employee",
          mobile: data.mobile || "—",
          city: data.city || "Hyderabad",
          address: data.address || "",
          role: data.role || "Sales Executive",
          wageType: (data.wageType as "monthly" | "daily") || "monthly",
          salary: Number(data.salary) || 0,
          aadharNumber: data.aadharNumber || "",
          aadharFrontUrl: data.aadharFrontUrl || "",
          aadharBackUrl: data.aadharBackUrl || "",
          panNumber: data.panNumber || "",
          panImageUrl: data.panImageUrl || "",
          profilePicUrl: data.profilePicUrl || "",
          emergencyContacts: data.emergencyContacts || [
            { relation: "Father", name: "", mobile: "" },
            { relation: "Spouse", name: "", mobile: "" },
          ],
          store: data.store || "Main Branch",
          joiningDate: data.joiningDate || "",
          status: (data.status as "active" | "inactive") || "active",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || "",
        });
      });

      setEmployees(items);

      if (snap.docs.length > 0) {
        pageSnapshotsRef.current[pageToFetch] = snap.docs[snap.docs.length - 1];
      }
    } catch (err: unknown) {
      console.error("Error loading employees:", err);
      const msg = err instanceof Error ? err.message : "Failed to load employees";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTotalCount();
    fetchPage(1);
  }, [fetchTotalCount, fetchPage]);

  // Open Add Modal
  const openAddModal = () => {
    setFormData(getDefaultEmployeeFormData());
    setProfilePicFile(null);
    setAadharFrontFile(null);
    setAadharBackFile(null);
    setPanImageFile(null);
    setProfilePicPreview("");
    setAadharFrontPreview("");
    setAadharBackPreview("");
    setPanImagePreview("");
    setModalMode("add");
    setEditingEmployeeId(null);
    setFormError("");
    setUploadProgress("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (emp: EmployeeItem) => {
    setFormData({
      employeeId: emp.employeeId,
      name: emp.name,
      mobile: emp.mobile,
      city: emp.city,
      address: emp.address,
      role: emp.role,
      wageType: emp.wageType,
      salary: emp.salary,
      aadharNumber: emp.aadharNumber,
      aadharFrontUrl: emp.aadharFrontUrl || "",
      aadharBackUrl: emp.aadharBackUrl || "",
      panNumber: emp.panNumber,
      panImageUrl: emp.panImageUrl || "",
      profilePicUrl: emp.profilePicUrl || "",
      emergencyContacts: emp.emergencyContacts || [
        { relation: "Father", name: "", mobile: "" },
        { relation: "Spouse", name: "", mobile: "" },
      ],
      store: emp.store,
      joiningDate: emp.joiningDate,
      status: emp.status,
      createdAt: emp.createdAt,
    });
    setProfilePicFile(null);
    setAadharFrontFile(null);
    setAadharBackFile(null);
    setPanImageFile(null);
    setProfilePicPreview(emp.profilePicUrl || "");
    setAadharFrontPreview(emp.aadharFrontUrl || "");
    setAadharBackPreview(emp.aadharBackUrl || "");
    setPanImagePreview(emp.panImageUrl || "");
    setModalMode("edit");
    setEditingEmployeeId(emp.id);
    setFormError("");
    setUploadProgress("");
    setIsModalOpen(true);
  };

  // Handle Save Employee (Uploads images to ImageKit first, then saves to Firestore)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError("Please enter the employee's full name.");
      return;
    }
    if (!formData.mobile.trim()) {
      setFormError("Please enter a valid mobile number.");
      return;
    }
    if (!formData.employeeId || formData.employeeId.length !== 8) {
      setFormError("Employee ID must be an 8-digit numeric number.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      let finalProfilePicUrl = formData.profilePicUrl || "";
      let finalAadharFrontUrl = formData.aadharFrontUrl || "";
      let finalAadharBackUrl = formData.aadharBackUrl || "";
      let finalPanImageUrl = formData.panImageUrl || "";

      // 1. Upload Profile Pic to ImageKit
      if (profilePicFile) {
        setUploadProgress("Uploading employee profile picture to ImageKit...");
        const res = await uploadFileToImageKit(
          profilePicFile, 
          "/employees/profile", 
          `emp_${formData.employeeId}_profile_${Date.now()}.jpg`
        );
        finalProfilePicUrl = res.url;
      }

      // 2. Upload Aadhar Front to ImageKit
      if (aadharFrontFile) {
        setUploadProgress("Uploading Aadhar Card front to ImageKit...");
        const res = await uploadFileToImageKit(
          aadharFrontFile, 
          "/employees/aadhar", 
          `emp_${formData.employeeId}_aadhar_front_${Date.now()}.jpg`
        );
        finalAadharFrontUrl = res.url;
      }

      // 3. Upload Aadhar Back to ImageKit
      if (aadharBackFile) {
        setUploadProgress("Uploading Aadhar Card back to ImageKit...");
        const res = await uploadFileToImageKit(
          aadharBackFile, 
          "/employees/aadhar", 
          `emp_${formData.employeeId}_aadhar_back_${Date.now()}.jpg`
        );
        finalAadharBackUrl = res.url;
      }

      // 4. Upload PAN Card Image to ImageKit
      if (panImageFile) {
        setUploadProgress("Uploading PAN Card image to ImageKit...");
        const res = await uploadFileToImageKit(
          panImageFile, 
          "/employees/pan", 
          `emp_${formData.employeeId}_pan_${Date.now()}.jpg`
        );
        finalPanImageUrl = res.url;
      }

      setUploadProgress("Saving employee record to database...");
      const nowIso = new Date().toISOString();

      const payload = {
        ...formData,
        employeeId: formData.employeeId.trim(),
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        salary: Number(formData.salary) || 0,
        aadharNumber: formData.aadharNumber.trim(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        profilePicUrl: finalProfilePicUrl,
        aadharFrontUrl: finalAadharFrontUrl,
        aadharBackUrl: finalAadharBackUrl,
        panImageUrl: finalPanImageUrl,
        updatedAt: nowIso,
      };

      if (modalMode === "add") {
        payload.createdAt = nowIso;
        await addDoc(collection(db, "employees"), payload);
        setToast({ 
          type: "success", 
          message: `Employee "${payload.name}" (ID: ${payload.employeeId}) created successfully!` 
        });
      } else if (editingEmployeeId) {
        await updateDoc(doc(db, "employees", editingEmployeeId), payload);
        setToast({ 
          type: "success", 
          message: `Employee "${payload.name}" updated successfully!` 
        });
      }

      setIsModalOpen(false);
      fetchTotalCount();
      fetchPage(1);
      setCurrentPage(1);
    } catch (err: unknown) {
      console.error("Error saving employee:", err);
      const msg = err instanceof Error ? err.message : "Failed to save employee";
      setFormError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
      setUploadProgress("");
    }
  };

  // Delete Employee
  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await deleteDoc(doc(db, "employees", employeeToDelete.id));
      setToast({
        type: "success",
        message: `Employee "${employeeToDelete.name}" deleted.`,
      });
      setEmployeeToDelete(null);
      fetchTotalCount();
      fetchPage(currentPage);
    } catch (err: unknown) {
      console.error("Error deleting employee:", err);
      setToast({ type: "error", message: "Failed to delete employee." });
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (employees.length === 0) {
      setToast({ type: "info", message: "No employee data to export." });
      return;
    }

    const exportRows = filteredEmployees.map((emp) => ({
      "Employee ID": emp.employeeId,
      "Full Name": emp.name,
      "Mobile Number": emp.mobile,
      "Role": emp.role,
      "Store Branch": emp.store,
      "City": emp.city,
      "Address": emp.address,
      "Wage Type": emp.wageType.toUpperCase(),
      "Salary / Wages": emp.salary,
      "Aadhar Number": emp.aadharNumber || "—",
      "PAN Number": emp.panNumber || "—",
      "Emergency Contact 1": `${emp.emergencyContacts[0]?.name || "—"} (${emp.emergencyContacts[0]?.relation}): ${emp.emergencyContacts[0]?.mobile || "—"}`,
      "Emergency Contact 2": `${emp.emergencyContacts[1]?.name || "—"} (${emp.emergencyContacts[1]?.relation}): ${emp.emergencyContacts[1]?.mobile || "—"}`,
      "Joining Date": emp.joiningDate,
      "Status": emp.status.toUpperCase(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `SRK-Employees-${new Date().toISOString().split("T")[0]}.xlsx`);
    setToast({ type: "success", message: "Exported employees to Excel successfully." });
  };

  // Filtered List
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleFilter !== "all" && emp.role !== roleFilter) return false;
      if (wageFilter !== "all" && emp.wageType !== wageFilter) return false;
      if (statusFilter !== "all" && emp.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesId = emp.employeeId.includes(q);
        const matchesMobile = emp.mobile.includes(q);
        const matchesCity = emp.city.toLowerCase().includes(q);
        const matchesRole = emp.role.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesMobile && !matchesCity && !matchesRole) {
          return false;
        }
      }

      return true;
    });
  }, [employees, roleFilter, wageFilter, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchPage(newPage);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-900 select-none">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <Users className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                Employee Manager
              </h1>
              <span className="rounded bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
                STAFF & PAYROLL
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Manage retail staff, 8-digit unique IDs, KYC identification documents (ImageKit), emergency contacts, and compensation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/employees/scan"
              className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer transition-colors shadow-xs"
            >
              <QrCode className="h-3.5 w-3.5 text-emerald-600" />
              <span>Scan QR</span>
            </Link>

            <Link
              href="/employees/id-cards"
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer transition-colors shadow-xs"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-zinc-600" />
              <span>ID Cards</span>
            </Link>

            <button
              onClick={() => {
                fetchTotalCount();
                fetchPage(currentPage);
              }}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors shadow-xs"
              title="Refresh staff list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors shadow-xs"
              title="Export to Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export</span>
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer transition-all shadow-xs active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
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
              <span className="text-[11px] font-medium uppercase tracking-wider">Monthly Staff</span>
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-blue-900">
                {employees.filter((e) => e.wageType === "monthly").length}
              </span>
              <span className="text-[10px] text-blue-600/70">salaried roles</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Daily Wage Staff</span>
              <Wallet className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-900">
                {employees.filter((e) => e.wageType === "daily").length}
              </span>
              <span className="text-[10px] text-amber-600/70">daily wage basis</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Status</span>
              <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {employees.filter((e) => e.status === "active").length}
              </span>
              <span className="text-[10px] text-zinc-400">active in system</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, 8-digit ID, mobile, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/50 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Roles</option>
              {EMPLOYEE_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Wage Filter */}
            <select
              value={wageFilter}
              onChange={(e) => setWageFilter(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Wage Types</option>
              <option value="monthly">Monthly Salary</option>
              <option value="daily">Daily Wages</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs text-zinc-500 font-mono">Loading staff directory (24 limit)...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">No employees found</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                {searchQuery || roleFilter !== "all"
                  ? "No staff members matched your current filter criteria."
                  : "No staff records added yet. Click 'Add Employee' to register staff with ImageKit KYC documents and auto 8-digit unique ID."}
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Employee</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role & Store</th>
                    <th className="px-4 py-3">Mobile & City</th>
                    <th className="px-4 py-3">Compensation</th>
                    <th className="px-4 py-3">KYC Verification</th>
                    <th className="px-4 py-3">Emergency Contacts</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-sans">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Avatar, Name, 8-digit ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {emp.profilePicUrl ? (
                            <img
                              src={emp.profilePicUrl}
                              alt={emp.name}
                              className="h-9 w-9 rounded-full object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/employees/${emp.id}`}
                              className="font-semibold text-zinc-900 hover:text-emerald-700 transition-colors"
                            >
                              {emp.name}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-mono font-bold text-zinc-700 border border-zinc-200">
                                ID: {emp.employeeId}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Store */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-800">{emp.role}</div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 text-zinc-400" />
                          <span>{emp.store}</span>
                        </div>
                      </td>

                      {/* Mobile & City */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-zinc-800 font-mono">
                          <Phone className="h-3 w-3 text-zinc-400" />
                          <span>{emp.mobile}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          <span>{emp.city}</span>
                        </div>
                      </td>

                      {/* Compensation */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-zinc-900">
                          {formatINR(emp.salary)}
                        </div>
                        <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                          {emp.wageType === "monthly" ? "Monthly" : "Daily Wage"}
                        </span>
                      </td>

                      {/* KYC Identification */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="font-medium text-zinc-700">Aadhar:</span>
                            {emp.aadharNumber ? (
                              <span className="font-mono text-zinc-600">
                                •••• {emp.aadharNumber.slice(-4)}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                            {emp.aadharFrontUrl && (
                              <span className="rounded bg-emerald-50 text-emerald-700 px-1 text-[9px] font-bold">
                                IMG
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="font-medium text-zinc-700">PAN:</span>
                            {emp.panNumber ? (
                              <span className="font-mono text-zinc-600 uppercase">
                                {emp.panNumber}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                            {emp.panImageUrl && (
                              <span className="rounded bg-emerald-50 text-emerald-700 px-1 text-[9px] font-bold">
                                IMG
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Emergency Contacts */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 text-[11px]">
                          {emp.emergencyContacts?.[0]?.name ? (
                            <div className="text-zinc-800">
                              <span className="font-semibold">{emp.emergencyContacts[0].name}</span>{" "}
                              <span className="text-zinc-400">({emp.emergencyContacts[0].relation})</span>:{" "}
                              <span className="font-mono text-zinc-600">{emp.emergencyContacts[0].mobile}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">No emergency contact 1</span>
                          )}
                          {emp.emergencyContacts?.[1]?.name && (
                            <div className="text-zinc-500 text-[10px]">
                              <span>{emp.emergencyContacts[1].name}</span> ({emp.emergencyContacts[1].relation}):{" "}
                              <span className="font-mono">{emp.emergencyContacts[1].mobile}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          emp.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${emp.status === "active" ? "bg-emerald-600" : "bg-zinc-400"}`} />
                          {emp.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 transition-colors"
                            title="View Employee Profile & Advances"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => openEditModal(emp)}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-colors"
                            title="Edit Employee"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEmployeeToDelete(emp)}
                            className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors"
                            title="Delete Employee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                <span>staff members (Limit 24 / page)</span>
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

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl my-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">
                    {modalMode === "add" ? "Register New Employee" : "Edit Employee Record"}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Complete personal info, ImageKit KYC documents, wage details, and 2 emergency contacts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-4">
              {/* Top Row: Profile Picture + 8-Digit Unique ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                {/* Profile Picture Upload */}
                <div className="flex flex-col items-center sm:items-start gap-2">
                  <label className="text-xs font-semibold text-zinc-700">Profile Photo</label>
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 rounded-full border-2 border-dashed border-zinc-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {profilePicPreview ? (
                        <img src={profilePicPreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-6 w-6 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="profilePicInput"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProfilePicFile(file);
                            setProfilePicPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <label
                        htmlFor="profilePicInput"
                        className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer shadow-xs"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Choose Photo</span>
                      </label>
                      <p className="mt-1 text-[10px] text-zinc-400">JPG, PNG, WebP</p>
                    </div>
                  </div>
                </div>

                {/* 8-Digit Auto Unique Employee ID */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-700">
                      Auto 8-Digit Unique Employee ID *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, employeeId: generate8DigitEmpId() })}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate New 8-Digit ID
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={8}
                      pattern="[0-9]{8}"
                      value={formData.employeeId}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
                        setFormData({ ...formData, employeeId: val });
                      }}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono font-bold text-zinc-900 tracking-wider focus:border-emerald-500 focus:outline-hidden"
                      placeholder="e.g. 84920153"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-mono font-bold">
                      8-DIGIT NUMERIC
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    This ID will be used for attendance marking, QR code ID cards, and salary advances.
                  </p>
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar Verma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Location & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hyderabad, Vijayawada"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="Door no, street, locality, landmark"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Role, Store, and Wage Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Employee Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    {EMPLOYEE_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Store Branch *
                  </label>
                  <select
                    value={formData.store}
                    onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    {storeOptions.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Wage Type *
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, wageType: "monthly" })}
                      className={`rounded border py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        formData.wageType === "monthly"
                          ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, wageType: "daily" })}
                      className={`rounded border py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        formData.wageType === "daily"
                          ? "border-amber-600 bg-amber-50 text-amber-800 font-semibold"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Daily
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {formData.wageType === "monthly" ? "Monthly Salary (₹) *" : "Daily Wages (₹) *"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.salary || ""}
                    onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* KYC Identification: Aadhar and PAN with ImageKit Uploads */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>KYC Identification & Documents (Saved to ImageKit)</span>
                </div>

                {/* Aadhar Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Aadhar Card Number
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="XXXX XXXX XXXX"
                      value={formData.aadharNumber}
                      onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Aadhar Front Image
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="aadharFrontInput"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAadharFrontFile(file);
                            setAadharFrontPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <label
                        htmlFor="aadharFrontInput"
                        className="flex-1 flex items-center justify-center gap-1 rounded border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer truncate"
                      >
                        <Upload className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {aadharFrontFile ? aadharFrontFile.name : aadharFrontPreview ? "Replace Front" : "Upload Front"}
                        </span>
                      </label>
                      {aadharFrontPreview && (
                        <a href={aadharFrontPreview} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline text-[11px] shrink-0">
                          View
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Aadhar Back Image
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="aadharBackInput"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAadharBackFile(file);
                            setAadharBackPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <label
                        htmlFor="aadharBackInput"
                        className="flex-1 flex items-center justify-center gap-1 rounded border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer truncate"
                      >
                        <Upload className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {aadharBackFile ? aadharBackFile.name : aadharBackPreview ? "Replace Back" : "Upload Back"}
                        </span>
                      </label>
                      {aadharBackPreview && (
                        <a href={aadharBackPreview} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline text-[11px] shrink-0">
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* PAN Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      PAN Card Number
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. ABCDE1234F"
                      value={formData.panNumber}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-mono font-bold uppercase text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      PAN Card Image
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="panImageInput"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPanImageFile(file);
                            setPanImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <label
                        htmlFor="panImageInput"
                        className="flex-1 flex items-center justify-center gap-1 rounded border border-zinc-300 bg-white py-1.5 px-2 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer truncate"
                      >
                        <Upload className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {panImageFile ? panImageFile.name : panImagePreview ? "Replace PAN Img" : "Upload PAN Card"}
                        </span>
                      </label>
                      {panImagePreview && (
                        <a href={panImagePreview} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline text-[11px] shrink-0">
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contacts (Two contacts required) */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>Two Emergency Contact Details (Mandatory)</span>
                </div>

                {/* Emergency Contact 1 */}
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-[11px] font-bold text-zinc-700 block mb-1.5">
                    Emergency Contact 1
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Relation</label>
                      <select
                        value={formData.emergencyContacts[0]?.relation || "Father"}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[0] = { ...updated[0], relation: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs text-zinc-800"
                      >
                        {RELATIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Suresh Kumar"
                        value={formData.emergencyContacts[0]?.name || ""}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[0] = { ...updated[0], name: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs text-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Mobile Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9123456780"
                        value={formData.emergencyContacts[0]?.mobile || ""}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[0] = { ...updated[0], mobile: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs font-mono text-zinc-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact 2 */}
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-[11px] font-bold text-zinc-700 block mb-1.5">
                    Emergency Contact 2
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Relation</label>
                      <select
                        value={formData.emergencyContacts[1]?.relation || "Spouse"}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[1] = { ...updated[1], relation: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs text-zinc-800"
                      >
                        {RELATIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sunita Devi"
                        value={formData.emergencyContacts[1]?.name || ""}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[1] = { ...updated[1], name: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs text-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Mobile Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543219"
                        value={formData.emergencyContacts[1]?.mobile || ""}
                        onChange={(e) => {
                          const updated = [...formData.emergencyContacts] as [EmergencyContact, EmergencyContact];
                          updated[1] = { ...updated[1], mobile: e.target.value };
                          setFormData({ ...formData, emergencyContacts: updated });
                        }}
                        className="w-full rounded border border-zinc-300 py-1 px-2 text-xs font-mono text-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Joining Date and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Employment Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="active">Active (Full Access & Attendance)</option>
                    <option value="inactive">Inactive / On Leave</option>
                  </select>
                </div>
              </div>

              {/* Upload Progress Indicator */}
              {uploadProgress && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 animate-pulse">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
                >
                  {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{modalMode === "add" ? "Save & Upload Employee" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Remove Employee</h3>
                <p className="text-xs text-zinc-500">
                  Are you sure you want to remove <span className="font-semibold text-zinc-800">{employeeToDelete.name}</span> (ID: <span className="font-mono">{employeeToDelete.employeeId}</span>)?
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              <button
                onClick={() => setEmployeeToDelete(null)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer transition-colors"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
