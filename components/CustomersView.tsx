"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Calendar, 
  Building2, 
  ShieldAlert, 
  DollarSign, 
  Percent, 
  FileText, 
  Sparkles, 
  AlertCircle,
  Eye,
  Filter,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info
} from "lucide-react";

// Indian Place of Supply (GST State Codes)
const PLACE_OF_SUPPLY_OPTIONS = [
  { code: "37", name: "37-Andhra Pradesh" },
  { code: "36", name: "36-Telangana" },
  { code: "29", name: "29-Karnataka" },
  { code: "33", name: "33-Tamil Nadu" },
  { code: "27", name: "27-Maharashtra" },
  { code: "07", name: "07-Delhi" },
  { code: "32", name: "32-Kerala" },
  { code: "24", name: "24-Gujarat" },
  { code: "19", name: "19-West Bengal" },
  { code: "08", name: "08-Rajasthan" },
  { code: "09", name: "09-Uttar Pradesh" },
  { code: "23", name: "23-Madhya Pradesh" },
  { code: "21", name: "21-Odisha" },
  { code: "03", name: "03-Punjab" },
  { code: "06", name: "06-Haryana" },
  { code: "10", name: "10-Bihar" },
  { code: "30", name: "30-Goa" },
  { code: "02", name: "02-Himachal Pradesh" },
  { code: "01", name: "01-Jammu and Kashmir" },
  { code: "05", name: "05-Uttarakhand" },
  { code: "18", name: "18-Assam" },
  { code: "11", name: "11-Sikkim" },
  { code: "12", name: "12-Arunachal Pradesh" },
  { code: "13", name: "13-Nagaland" },
  { code: "14", name: "14-Manipur" },
  { code: "15", name: "15-Mizoram" },
  { code: "16", name: "16-Tripura" },
  { code: "17", name: "17-Meghalaya" },
  { code: "20", name: "20-Jharkhand" },
  { code: "22", name: "22-Chhattisgarh" },
  { code: "31", name: "31-Lakshadweep" },
  { code: "34", name: "34-Puducherry" },
  { code: "35", name: "35-Andaman and Nicobar Islands" },
  { code: "38", name: "38-Ladakh" },
  { code: "96", name: "96-Foreign Country" },
  { code: "97", name: "97-Other Territory" },
];

const COMMON_CITIES = [
  "VIJAYAWADA",
  "HYDERABAD",
  "GUNTUR",
  "VISAKHAPATNAM",
  "RAJAHMUNDRY",
  "TIRUPATI",
  "NELLORE",
  "KURNOOL",
  "KAKINADA",
  "WARANGAL",
  "BANGALORE",
  "CHENNAI",
  "MUMBAI",
  "DELHI",
];

const CUSTOMER_GROUPS = [
  "General Retail",
  "Privilege / VIP",
  "Wholesale / Trader",
  "Corporate / Institutional",
  "Staff / Internal",
  "Walk-in",
];

const CUSTOMER_CLASSIFICATIONS = [
  "Regular",
  "Gold Tier",
  "Silver Tier",
  "Platinum Tier",
  "First-time Buyer",
  "Credit Customer",
];

export interface CustomerItem {
  id: string;
  // Left side fields from screenshot
  customerCode: string;
  customerName: string;
  hasBirthDate?: boolean;
  birthDate?: string;
  hasAnniversary?: boolean;
  anniversary?: string;
  city: string;
  cardNo?: string;
  validity?: string;
  mobile: string;
  address?: string;
  entryDate?: string;
  pin?: string;
  email?: string;
  tin?: string;
  branch: string;
  ledger?: string;
  stopCredit?: boolean;
  opCreditBalance?: number;
  creditDays?: number;
  creditLimit?: number;

  // Right side fields from screenshot
  group?: string;
  classification?: string;
  landLine?: string;
  billCycle?: number;
  opSales?: number;
  remarks?: string;
  gstNo?: string;
  placeOfSupply?: string;
  discountPercent?: number;
  applyDiscountOnNonDisc?: boolean;

  // Bottom flags from screenshot
  inactive?: boolean;
  blockTSMS?: boolean;
  blockPSMS?: boolean;
  blockWA?: boolean;
  dontFollowup?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

// Initial form state generator (uses static date for SSR prerender safety)
function getDefaultFormData(): Omit<CustomerItem, "id"> {
  const defaultDate = "2026-10-06";
  return {
    customerCode: "",
    customerName: "",
    hasBirthDate: false,
    birthDate: defaultDate,
    hasAnniversary: false,
    anniversary: defaultDate,
    city: "VIJAYAWADA",
    cardNo: "",
    validity: "2500-01-01",
    mobile: "",
    address: "",
    entryDate: defaultDate,
    pin: "",
    email: "",
    tin: "",
    branch: "MADHU CREATIONS",
    ledger: "SUNDRY DEBTORS",
    stopCredit: false,
    opCreditBalance: 0,
    creditDays: 0,
    creditLimit: 0,
    group: "General Retail",
    classification: "Regular",
    landLine: "",
    billCycle: 1,
    opSales: 0,
    remarks: "",
    gstNo: "",
    placeOfSupply: "37-Andhra Pradesh",
    discountPercent: 0,
    applyDiscountOnNonDisc: false,
    inactive: false,
    blockTSMS: false,
    blockPSMS: false,
    blockWA: false,
    dontFollowup: false,
  };
}

// Generate code helper matching screenshot format: e.g. MC + 4 random digits (MC8539)
function generateCustomerCode(prefix = "MC"): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${randomNum}`;
}

const PAGE_SIZE = 24;

export default function CustomersView() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "credit_blocked">("all");

  // Dynamic store branch options from Firestore
  const [storeOptions, setStoreOptions] = useState<string[]>(["MADHU CREATIONS"]);

  // Toast notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Full Screen Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CustomerItem, "id">>(getDefaultFormData());
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Customer Detail Drawer state
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);

  // Pagination Cursors stored in ref
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch branches/stores from Firestore to populate Branch dropdown
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
          setStoreOptions((prev) => Array.from(new Set(["MADHU CREATIONS", ...names])));
        }
      } catch (err) {
        console.warn("Could not load stores for branches:", err);
      }
    }
    loadStores();
  }, []);

  // Fetch Total Count using getCountFromServer (Firebase Server Count)
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "customers");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback for customers:", err);
      try {
        const snap = await getDocs(collection(db, "customers"));
        setTotalCount(snap.size);
      } catch (fallbackErr) {
        console.error("Fallback customer count failed:", fallbackErr);
      }
    }
  }, []);

  // Fetch Page of Customers (Limit 24)
  const fetchPage = useCallback(async (pageToFetch: number) => {
    setLoading(true);
    try {
      const coll = collection(db, "customers");
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
        console.warn("Ordered customer query fallback:", queryErr);
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: CustomerItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          customerCode: data.customerCode || "—",
          customerName: data.customerName || "Unnamed Customer",
          hasBirthDate: !!data.hasBirthDate,
          birthDate: data.birthDate || "",
          hasAnniversary: !!data.hasAnniversary,
          anniversary: data.anniversary || "",
          city: data.city || "VIJAYAWADA",
          cardNo: data.cardNo || "",
          validity: data.validity || "2500-01-01",
          mobile: data.mobile || "—",
          address: data.address || "",
          entryDate: data.entryDate || "",
          pin: data.pin || "",
          email: data.email || "",
          tin: data.tin || "",
          branch: data.branch || "MADHU CREATIONS",
          ledger: data.ledger || "SUNDRY DEBTORS",
          stopCredit: !!data.stopCredit,
          opCreditBalance: Number(data.opCreditBalance) || 0,
          creditDays: Number(data.creditDays) || 0,
          creditLimit: Number(data.creditLimit) || 0,
          group: data.group || "General Retail",
          classification: data.classification || "Regular",
          landLine: data.landLine || "",
          billCycle: Number(data.billCycle) || 1,
          opSales: Number(data.opSales) || 0,
          remarks: data.remarks || "",
          gstNo: data.gstNo || "",
          placeOfSupply: data.placeOfSupply || "37-Andhra Pradesh",
          discountPercent: Number(data.discountPercent) || 0,
          applyDiscountOnNonDisc: !!data.applyDiscountOnNonDisc,
          inactive: !!data.inactive,
          blockTSMS: !!data.blockTSMS,
          blockPSMS: !!data.blockPSMS,
          blockWA: !!data.blockWA,
          dontFollowup: !!data.dontFollowup,
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
        });
      });

      setCustomers(items);

      if (snap.docs.length > 0) {
        pageSnapshotsRef.current[pageToFetch] = snap.docs[snap.docs.length - 1];
      }
    } catch (err: unknown) {
      console.error("Error loading customers:", err);
      const msg = err instanceof Error ? err.message : "Failed to load customers";
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

  // Handle Page Change
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchPage(newPage);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setModalMode("add");
    setEditingCustomerId(null);
    const newForm = getDefaultFormData();
    const today = new Date().toISOString().split("T")[0];
    newForm.customerCode = generateCustomerCode("MC");
    newForm.birthDate = today;
    newForm.anniversary = today;
    newForm.entryDate = today;
    setFormData(newForm);
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (c: CustomerItem) => {
    setModalMode("edit");
    setEditingCustomerId(c.id);
    setFormData({
      customerCode: c.customerCode,
      customerName: c.customerName,
      hasBirthDate: c.hasBirthDate,
      birthDate: c.birthDate || new Date().toISOString().split("T")[0],
      hasAnniversary: c.hasAnniversary,
      anniversary: c.anniversary || new Date().toISOString().split("T")[0],
      city: c.city || "VIJAYAWADA",
      cardNo: c.cardNo || "",
      validity: c.validity || "2500-01-01",
      mobile: c.mobile || "",
      address: c.address || "",
      entryDate: c.entryDate || new Date().toISOString().split("T")[0],
      pin: c.pin || "",
      email: c.email || "",
      tin: c.tin || "",
      branch: c.branch || "MADHU CREATIONS",
      ledger: c.ledger || "SUNDRY DEBTORS",
      stopCredit: c.stopCredit || false,
      opCreditBalance: c.opCreditBalance || 0,
      creditDays: c.creditDays || 0,
      creditLimit: c.creditLimit || 0,
      group: c.group || "General Retail",
      classification: c.classification || "Regular",
      landLine: c.landLine || "",
      billCycle: c.billCycle || 1,
      opSales: c.opSales || 0,
      remarks: c.remarks || "",
      gstNo: c.gstNo || "",
      placeOfSupply: c.placeOfSupply || "37-Andhra Pradesh",
      discountPercent: c.discountPercent || 0,
      applyDiscountOnNonDisc: c.applyDiscountOnNonDisc || false,
      inactive: c.inactive || false,
      blockTSMS: c.blockTSMS || false,
      blockPSMS: c.blockPSMS || false,
      blockWA: c.blockWA || false,
      dontFollowup: c.dontFollowup || false,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Live "Similar Names" computation based on current input vs loaded customers
  const similarNames = useMemo(() => {
    const queryName = formData.customerName.trim().toLowerCase();
    if (!queryName || queryName.length < 2) return [];

    return customers
      .filter((c) => {
        if (modalMode === "edit" && c.id === editingCustomerId) return false;
        const name = c.customerName.toLowerCase();
        return name.includes(queryName) || queryName.includes(name);
      })
      .slice(0, 10);
  }, [formData.customerName, customers, modalMode, editingCustomerId]);

  // Form Submit (Save / Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName.trim()) {
      setFormError("Please enter the customer name");
      return;
    }
    if (!formData.customerCode.trim()) {
      setFormError("Please specify or generate a customer code");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (modalMode === "add") {
        const payload = {
          ...formData,
          customerCode: formData.customerCode.trim().toUpperCase(),
          customerName: formData.customerName.trim(),
          mobile: formData.mobile.trim() || "—",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, "customers"), payload);
        const newCustomer: CustomerItem = {
          id: docRef.id,
          ...payload,
        };

        // Optimistic update
        setCustomers((prev) => [newCustomer, ...prev]);
        setTotalCount((prev) => prev + 1);
        setToast({ 
          type: "success", 
          message: `Customer "${payload.customerName}" (${payload.customerCode}) created successfully!` 
        });
      } else if (modalMode === "edit" && editingCustomerId) {
        const payload = {
          ...formData,
          customerCode: formData.customerCode.trim().toUpperCase(),
          customerName: formData.customerName.trim(),
          mobile: formData.mobile.trim() || "—",
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, "customers", editingCustomerId), payload);

        setCustomers((prev) =>
          prev.map((c) => (c.id === editingCustomerId ? { ...c, ...payload } : c))
        );
        setToast({ 
          type: "success", 
          message: `Customer "${payload.customerName}" updated successfully!` 
        });
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error("Error saving customer:", err);
      const msg = err instanceof Error ? err.message : "Failed to save customer";
      setFormError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "customers", id));
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      if (viewingCustomer?.id === id) setViewingCustomer(null);
      setToast({ type: "success", message: `Customer "${name}" deleted successfully` });
    } catch (err: unknown) {
      console.error("Error deleting customer:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete customer";
      setToast({ type: "error", message: msg });
    }
  };

  // Filtered displayed customers
  const displayedCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      c.customerName.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q) ||
      c.mobile.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      (c.cardNo && c.cardNo.toLowerCase().includes(q)) ||
      (c.gstNo && c.gstNo.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterStatus === "active") return !c.inactive;
    if (filterStatus === "inactive") return !!c.inactive;
    if (filterStatus === "credit_blocked") return !!c.stopCredit;

    return true;
  });

  // Calculate quick summary metrics
  const activeCount = customers.filter((c) => !c.inactive).length;
  const creditBlockedCount = customers.filter((c) => c.stopCredit).length;
  const totalOpBalance = customers.reduce((sum, c) => sum + (c.opCreditBalance || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Retail Operations</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Customers</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {totalCount} Total
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Customer Directory & CRM</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {totalCount} {totalCount === 1 ? "customer" : "customers"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Member accounts, loyalty card validity, credit limits, khata balances, and promotional preferences
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              pageSnapshotsRef.current = {};
              fetchTotalCount();
              fetchPage(currentPage);
              setToast({ type: "info", message: "Customer directory refreshed from server" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-2.5 bg-zinc-50/80 border-b border-zinc-200 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-emerald-100/70 text-emerald-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">Total Registered</div>
            <div className="text-xs font-bold text-zinc-900 font-mono">{totalCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-blue-100/70 text-blue-700">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">Active (Loaded)</div>
            <div className="text-xs font-bold text-zinc-900 font-mono">{activeCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-rose-100/70 text-rose-700">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">Credit Stopped</div>
            <div className="text-xs font-bold text-rose-700 font-mono">{creditBlockedCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-amber-100/70 text-amber-700">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-medium">Op Credit Total</div>
            <div className="text-xs font-bold text-zinc-900 font-mono">₹{totalOpBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 py-2.5 border-b border-zinc-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by code, customer name, mobile, city, card..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[11px] text-zinc-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status:
          </span>
          {(["all", "active", "inactive", "credit_blocked"] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setFilterStatus(filterKey)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                filterStatus === filterKey
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {filterKey === "all" && "All"}
              {filterKey === "active" && "Active"}
              {filterKey === "inactive" && "Inactive"}
              {filterKey === "credit_blocked" && "Credit Blocked"}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table List */}
      <div className="flex-1 overflow-auto bg-white">
        {loading && customers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading customers from server (limit 24)...</span>
          </div>
        ) : displayedCustomers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                {searchQuery ? "No matching customers found" : "No customers registered yet"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                {searchQuery 
                  ? "Try adjusting your search terms or filter to find the customer"
                  : "Click 'Add Customer' to create your first customer profile with loyalty card, credit terms, and GST details."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenAddModal}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#107548] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add Customer</span>
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 border-r border-zinc-200/60 w-12 text-center">#</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60">Code</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60">Customer Name</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60">Mobile & City</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60">Card & Branch</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60">Credit / Balance</th>
                <th className="py-2.5 px-4 border-r border-zinc-200/60 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 font-mono">
              {displayedCustomers.map((c, index) => {
                const serialNum = (currentPage - 1) * PAGE_SIZE + index + 1;
                return (
                  <tr 
                    key={c.id} 
                    className="hover:bg-zinc-50/80 transition-colors group cursor-default"
                  >
                    {/* Index */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 text-center text-zinc-400 text-[11px]">
                      {serialNum}
                    </td>

                    {/* Customer Code */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60">
                      <span className="font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 text-[11px]">
                        {c.customerCode}
                      </span>
                    </td>

                    {/* Customer Name */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 font-sans">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200/60 uppercase">
                          {c.customerName.charAt(0) || "C"}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 text-xs flex items-center gap-1.5">
                            {c.customerName}
                            {c.stopCredit && (
                              <span className="rounded bg-rose-50 text-rose-700 border border-rose-200 px-1 text-[9px] font-semibold">
                                STOP CREDIT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <span>{c.group || "General Retail"}</span>
                            <span>•</span>
                            <span className="text-zinc-400">{c.classification || "Regular"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Mobile & City */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 font-sans">
                      <div className="flex flex-col text-xs text-zinc-700">
                        <span className="font-mono flex items-center gap-1">
                          <Phone className="h-3 w-3 text-zinc-400" />
                          {c.mobile || "—"}
                        </span>
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          {c.city}
                        </span>
                      </div>
                    </td>

                    {/* Card & Branch */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 font-sans">
                      <div className="flex flex-col text-xs">
                        <span className="font-mono text-zinc-800 flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-zinc-400" />
                          {c.cardNo ? c.cardNo : <span className="text-zinc-400 italic">No Card</span>}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate max-w-[140px] flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 text-zinc-400" />
                          {c.branch}
                        </span>
                      </div>
                    </td>

                    {/* Credit / Balance */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 font-mono">
                      <div className="flex flex-col text-xs">
                        <span className="text-zinc-900 font-semibold">
                          ₹{(c.opCreditBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-sans">
                          Limit: ₹{(c.creditLimit || 0).toLocaleString("en-IN")} ({c.creditDays || 0}d)
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5 border-r border-zinc-200/60 text-center font-sans">
                      {c.inactive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right font-sans">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                          title="View customer profile"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="rounded p-1 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Edit customer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c.id, c.customerName)}
                          className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete customer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-zinc-200 px-6 py-2.5 bg-zinc-50 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>Page {currentPage} of {totalPages}</span>
          <span className="text-zinc-300">|</span>
          <span>{PAGE_SIZE} rows / page</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold">{totalCount} total registered customers</span>
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-1 font-sans">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1 || loading}
            className="flex items-center rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="First page"
          >
            First
          </button>

          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </button>
          
          <span className="px-2 py-1 text-xs font-mono font-medium text-zinc-800">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || loading}
            className="flex items-center rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Last page"
          >
            Last
          </button>
        </div>
      </div>

      {/* FULL SCREEN MODAL: ADD / EDIT CUSTOMER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 animate-in fade-in duration-150">
          {/* Modal Header */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                  {modalMode === "add" ? "Add New Customer" : `Edit Customer: ${formData.customerName || formData.customerCode}`}
                  {formData.customerCode && (
                    <span className="rounded bg-zinc-100 border border-zinc-200 font-mono text-xs px-2 py-0.5 text-zinc-700 font-semibold">
                      {formData.customerCode}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-zinc-500">
                  Configure member profile, contact, credit limits, sales ledger, and communication preferences
                </p>
              </div>
            </div>

            {/* Quick header actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Close (Esc)
              </button>
              <button
                type="button"
                onClick={(e) => handleSaveCustomer(e)}
                disabled={saving || !formData.customerName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{saving ? "Saving Customer..." : modalMode === "add" ? "Save Customer" : "Update Customer"}</span>
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer ml-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSaveCustomer} className="max-w-7xl mx-auto space-y-6">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TWO COLUMN GRID MATCHING SCREENSHOT OPTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* ================= LEFT COLUMN ================= */}
                <div className="space-y-6">
                  {/* Basic & Contact Information Card */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
                    <div className="border-b border-zinc-100 pb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          General Profile & Contact Details
                        </h3>
                      </div>
                      <span className="text-[10px] text-zinc-400">Required fields marked with *</span>
                    </div>

                    {/* Customer Code & Generate Code Button */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Customer Code <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="e.g. MC8539"
                          value={formData.customerCode}
                          onChange={(e) => setFormData({ ...formData, customerCode: e.target.value.toUpperCase() })}
                          className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 uppercase"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newCode = generateCustomerCode("MC");
                            setFormData({ ...formData, customerCode: newCode });
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Generate Code</span>
                        </button>
                      </div>
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VENKATESWARA RAO, ANANYA SHARMA"
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        required
                        autoFocus
                      />
                    </div>

                    {/* BirthDate & Anniversary (Checkbox + Date input as in screenshot) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* BirthDate */}
                      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.hasBirthDate}
                              onChange={(e) => setFormData({ ...formData, hasBirthDate: e.target.checked })}
                              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>BirthDate</span>
                          </label>
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <input
                          type="date"
                          value={formData.birthDate || ""}
                          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                          disabled={!formData.hasBirthDate}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 disabled:opacity-40 disabled:bg-zinc-100"
                        />
                      </div>

                      {/* Anniversary */}
                      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.hasAnniversary}
                              onChange={(e) => setFormData({ ...formData, hasAnniversary: e.target.checked })}
                              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>Anniversary</span>
                          </label>
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <input
                          type="date"
                          value={formData.anniversary || ""}
                          onChange={(e) => setFormData({ ...formData, anniversary: e.target.value })}
                          disabled={!formData.hasAnniversary}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 disabled:opacity-40 disabled:bg-zinc-100"
                        />
                      </div>
                    </div>

                    {/* City */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-700">City</label>
                        <span className="text-[10px] text-zinc-400">Select or enter custom</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          list="city-suggestions"
                          type="text"
                          placeholder="e.g. VIJAYAWADA"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value.toUpperCase() })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 uppercase"
                        />
                        <datalist id="city-suggestions">
                          {COMMON_CITIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* CardNo & Validity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          CardNo
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GOLD-8539, 102938"
                          value={formData.cardNo}
                          onChange={(e) => setFormData({ ...formData, cardNo: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Validity
                        </label>
                        <input
                          type="date"
                          value={formData.validity || "2500-01-01"}
                          onChange={(e) => setFormData({ ...formData, validity: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Mobile */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Street, door no, landmark, locality..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* EntryDate & Pin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          EntryDate
                        </label>
                        <input
                          type="date"
                          value={formData.entryDate || ""}
                          onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Pin Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 520001"
                          maxLength={6}
                          value={formData.pin}
                          onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Email & TIN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          placeholder="customer@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          TIN
                        </label>
                        <input
                          type="text"
                          placeholder="Tax Identification Number"
                          value={formData.tin}
                          onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Branch & Ledger */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Branch
                        </label>
                        <select
                          value={formData.branch}
                          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          {storeOptions.map((store) => (
                            <option key={store} value={store}>
                              {store}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Ledger
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SUNDRY DEBTORS"
                          value={formData.ledger}
                          onChange={(e) => setFormData({ ...formData, ledger: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Credit Terms & Ledger Terms Card */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
                    <div className="border-b border-zinc-100 pb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          Credit & Financial Khata Terms
                        </h3>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.stopCredit}
                          onChange={(e) => setFormData({ ...formData, stopCredit: e.target.checked })}
                          className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Stop Credit</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Op Credit Balance
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.opCreditBalance}
                            onChange={(e) => setFormData({ ...formData, opCreditBalance: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Credit Days
                        </label>
                        <input
                          type="number"
                          value={formData.creditDays}
                          onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Credit Limit
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.creditLimit}
                            onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN ================= */}
                <div className="space-y-6">
                  {/* Similar Names Box (Matching screenshot's top-right live panel) */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          Similar Names
                        </h3>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {similarNames.length} {similarNames.length === 1 ? "match" : "matches"} found
                      </span>
                    </div>

                    <div className="min-h-[140px] max-h-[180px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5 text-xs">
                      {similarNames.length > 0 ? (
                        <div className="space-y-1.5">
                          {similarNames.map((s) => (
                            <div 
                              key={s.id} 
                              className="flex items-center justify-between p-1.5 rounded bg-white border border-zinc-200 text-xs hover:bg-zinc-50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">
                                  {s.customerCode}
                                </span>
                                <span className="font-medium text-zinc-900">{s.customerName}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {s.mobile || s.city}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[110px] flex-col items-center justify-center text-zinc-400 text-center">
                          <Info className="h-4 w-4 mb-1 text-zinc-300" />
                          <span className="text-xs">
                            {formData.customerName.trim().length >= 2 
                              ? "No similar names found. Customer name appears unique!"
                              : "Start typing customer name to see live duplicate warnings."}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Group, Classification & Operational Sales Card */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
                    <div className="border-b border-zinc-100 pb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                          Classification, Billing & Sales Details
                        </h3>
                      </div>
                    </div>

                    {/* Group & Classification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Group
                        </label>
                        <input
                          list="customer-groups"
                          type="text"
                          placeholder="e.g. General Retail"
                          value={formData.group}
                          onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                        <datalist id="customer-groups">
                          {CUSTOMER_GROUPS.map((g) => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Classification
                        </label>
                        <input
                          list="customer-classifications"
                          type="text"
                          placeholder="e.g. Regular"
                          value={formData.classification}
                          onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                        <datalist id="customer-classifications">
                          {CUSTOMER_CLASSIFICATIONS.map((cl) => (
                            <option key={cl} value={cl} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* LandLine */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        LandLine
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 0866-2489000"
                        value={formData.landLine}
                        onChange={(e) => setFormData({ ...formData, landLine: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Bill Cycle & Op Sales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Bill Cycle
                        </label>
                        <input
                          type="number"
                          value={formData.billCycle}
                          onChange={(e) => setFormData({ ...formData, billCycle: parseInt(e.target.value) || 1 })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Op Sales
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.opSales}
                            onChange={(e) => setFormData({ ...formData, opSales: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Special instructions, preferences, landmark..."
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* GST No & Place of Supply (Pl Of Supp) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          GST No
                        </label>
                        <input
                          type="text"
                          maxLength={15}
                          placeholder="e.g. 37AAAAA0000A1Z5"
                          value={formData.gstNo}
                          onChange={(e) => setFormData({ ...formData, gstNo: e.target.value.toUpperCase() })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Pl Of Supp (Place of Supply)
                        </label>
                        <select
                          value={formData.placeOfSupply}
                          onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          {PLACE_OF_SUPPLY_OPTIONS.map((state) => (
                            <option key={state.code} value={state.name}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Discount & Non-Disc Items Checkbox */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-center">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Disc %
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={formData.discountPercent}
                            onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                            className="w-full pr-6 pl-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">%</span>
                        </div>
                      </div>

                      <div className="sm:pt-4">
                        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.applyDiscountOnNonDisc}
                            onChange={(e) => setFormData({ ...formData, applyDiscountOnNonDisc: e.target.checked })}
                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span>Apply Discount on Non-Disc Items</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Operational Flags & Preferences (Checkboxes from bottom of screenshot) */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="border-b border-zinc-100 pb-2">
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        Communication & Operational Flags
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.inactive}
                          onChange={(e) => setFormData({ ...formData, inactive: e.target.checked })}
                          className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className={formData.inactive ? "text-rose-600 font-semibold" : ""}>
                          Inactive
                        </span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.blockTSMS}
                          onChange={(e) => setFormData({ ...formData, blockTSMS: e.target.checked })}
                          className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Block T-SMS</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.blockPSMS}
                          onChange={(e) => setFormData({ ...formData, blockPSMS: e.target.checked })}
                          className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Block P-SMS</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.blockWA}
                          onChange={(e) => setFormData({ ...formData, blockWA: e.target.checked })}
                          className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Block WA</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.dontFollowup}
                          onChange={(e) => setFormData({ ...formData, dontFollowup: e.target.checked })}
                          className="rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Dont Followup</span>
                      </label>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Sticky action controls inside form */}
              <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-zinc-200 bg-white py-3 px-4 rounded-xl shadow-md">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-800">
                    {modalMode === "add" ? "New Record" : "Updating Existing Customer"}
                  </span>
                  <span>•</span>
                  <span>Branch: {formData.branch}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.customerName.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {saving ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>{saving ? "Saving Customer..." : modalMode === "add" ? "Save Customer" : "Update Customer"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAIL VIEW DRAWER */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col border-l border-zinc-200 text-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm border border-emerald-200/60 uppercase">
                  {viewingCustomer.customerName.charAt(0) || "C"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    {viewingCustomer.customerName}
                    <span className="rounded bg-zinc-100 border border-zinc-200 font-mono text-[10px] px-1.5 py-0.2 text-zinc-700">
                      {viewingCustomer.customerCode}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {viewingCustomer.group} • {viewingCustomer.classification}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingCustomer(null)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Profile Card */}
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Contact & Location</h4>
                <div className="grid grid-cols-2 gap-2 text-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Mobile</span>
                    <span className="font-mono font-medium">{viewingCustomer.mobile || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Landline</span>
                    <span className="font-mono font-medium">{viewingCustomer.landLine || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Email</span>
                    <span className="truncate block font-medium">{viewingCustomer.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">City & Pin</span>
                    <span className="font-medium">{viewingCustomer.city} {viewingCustomer.pin ? `- ${viewingCustomer.pin}` : ""}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-400 block text-[10px]">Address</span>
                    <span className="font-medium">{viewingCustomer.address || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Membership & Dates */}
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Membership & Dates</h4>
                <div className="grid grid-cols-2 gap-2 text-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Card Number</span>
                    <span className="font-mono font-semibold">{viewingCustomer.cardNo || "No Card"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Card Validity</span>
                    <span className="font-mono">{viewingCustomer.validity || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">BirthDate</span>
                    <span>{viewingCustomer.hasBirthDate ? viewingCustomer.birthDate : "Not Set"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Anniversary</span>
                    <span>{viewingCustomer.hasAnniversary ? viewingCustomer.anniversary : "Not Set"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Entry Date</span>
                    <span>{viewingCustomer.entryDate || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Branch</span>
                    <span>{viewingCustomer.branch}</span>
                  </div>
                </div>
              </div>

              {/* Credit & Terms */}
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Credit & Financials</h4>
                <div className="grid grid-cols-2 gap-2 text-zinc-800 font-mono">
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Op Credit Balance</span>
                    <span className="text-emerald-700 font-bold">
                      ₹{(viewingCustomer.opCreditBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Credit Limit</span>
                    <span>₹{(viewingCustomer.creditLimit || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Credit Days</span>
                    <span>{viewingCustomer.creditDays || 0} days</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Stop Credit</span>
                    <span className={viewingCustomer.stopCredit ? "text-rose-600 font-bold" : "text-zinc-600"}>
                      {viewingCustomer.stopCredit ? "YES (BLOCKED)" : "NO (ACTIVE)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Op Sales</span>
                    <span>₹{(viewingCustomer.opSales || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-sans">Bill Cycle</span>
                    <span>{viewingCustomer.billCycle || 1}</span>
                  </div>
                </div>
              </div>

              {/* Tax & GST */}
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2.5">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tax & GST</h4>
                <div className="grid grid-cols-2 gap-2 text-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">GSTIN</span>
                    <span className="font-mono font-medium">{viewingCustomer.gstNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Place of Supply</span>
                    <span>{viewingCustomer.placeOfSupply || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">TIN</span>
                    <span className="font-mono">{viewingCustomer.tin || "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Default Discount</span>
                    <span className="font-mono">{viewingCustomer.discountPercent || 0}%</span>
                  </div>
                </div>
              </div>

              {/* Communication Flags */}
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Flags & Preferences</h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${viewingCustomer.inactive ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {viewingCustomer.inactive ? "Inactive Account" : "Active Account"}
                  </span>
                  {viewingCustomer.blockTSMS && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Block T-SMS
                    </span>
                  )}
                  {viewingCustomer.blockPSMS && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Block P-SMS
                    </span>
                  )}
                  {viewingCustomer.blockWA && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Block WhatsApp
                    </span>
                  )}
                  {viewingCustomer.dontFollowup && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                      Do Not Followup
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-zinc-200 p-4 bg-zinc-50 flex items-center justify-between">
              <button
                onClick={() => handleDeleteCustomer(viewingCustomer.id, viewingCustomer.customerName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toEdit = viewingCustomer;
                    setViewingCustomer(null);
                    handleOpenEditModal(toEdit);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Supabase Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
