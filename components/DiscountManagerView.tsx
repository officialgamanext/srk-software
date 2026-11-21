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
import * as XLSX from "xlsx";
import { 
  Tag, 
  Percent, 
  ShoppingCart, 
  Boxes, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  FileSpreadsheet, 
  Store, 
  Calendar, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowUpDown
} from "lucide-react";

export type DiscountType = "order" | "product" | "customer";
export type DiscountMethod = "percentage" | "fixed";

export interface DiscountItem {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  method: DiscountMethod;
  value: number;

  // Order Discount fields
  minOrderValue?: number;
  maxDiscountAmount?: number;

  // Product Discount fields
  applicableLevel?: "all" | "category" | "product";
  targetCategoryId?: string;
  targetCategoryName?: string;
  targetProductId?: string;
  targetProductName?: string;
  targetBarcode?: string;
  minQuantity?: number;

  // Customer Discount fields
  customerTarget?: "all" | "group" | "tier" | "specific_customer";
  targetCustomerGroup?: string;
  targetCustomerTier?: string;
  targetCustomerCode?: string;
  targetCustomerName?: string;
  applyOnNonDiscountedOnly?: boolean;
  minBillAmount?: number;

  // Common metadata
  store: string;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount?: number;
  status: "active" | "inactive";
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export const CUSTOMER_GROUPS = [
  "General Retail",
  "Privilege / VIP",
  "Wholesale / Trader",
  "Corporate / Institutional",
  "Staff / Internal",
  "Walk-in",
];

export const CUSTOMER_TIERS = [
  "Regular",
  "Gold Tier",
  "Silver Tier",
  "Platinum Tier",
  "Credit Customer",
];

const PAGE_SIZE = 24;

interface DiscountManagerViewProps {
  defaultTab?: "all" | "order" | "product" | "customer";
}

function generateDiscountCode(type: DiscountType): string {
  const prefix = type === "order" ? "ORD" : type === "product" ? "PRD" : "CUST";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

function getDefaultFormData(type: DiscountType = "order"): Omit<DiscountItem, "id"> {
  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(now.getFullYear() + 1);

  const startDate = now.toISOString().split("T")[0];
  const endDate = nextYear.toISOString().split("T")[0];

  return {
    code: generateDiscountCode(type),
    name: "",
    type,
    method: "percentage",
    value: 10,
    minOrderValue: 0,
    maxDiscountAmount: 0,
    applicableLevel: "all",
    targetCategoryId: "",
    targetCategoryName: "",
    targetProductId: "",
    targetProductName: "",
    targetBarcode: "",
    minQuantity: 1,
    customerTarget: "all",
    targetCustomerGroup: "Privilege / VIP",
    targetCustomerTier: "Gold Tier",
    targetCustomerCode: "",
    targetCustomerName: "",
    applyOnNonDiscountedOnly: false,
    minBillAmount: 0,
    store: "All Stores",
    startDate,
    endDate,
    usageLimit: 0,
    usedCount: 0,
    status: "active",
    description: "",
    createdAt: "",
  };
}

export default function DiscountManagerView({ defaultTab = "all" }: DiscountManagerViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "order" | "product" | "customer">(defaultTab);
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "percentage" | "fixed">("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  // Options loaded from Firestore
  const [storeOptions, setStoreOptions] = useState<string[]>(["All Stores", "MADHU CREATIONS"]);
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; barcode?: string }[]>([]);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<DiscountItem, "id">>(getDefaultFormData("order"));
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // Delete confirmation
  const [discountToDelete, setDiscountToDelete] = useState<DiscountItem | null>(null);

  // Pagination Cursors
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch dropdown collections from Firestore
  useEffect(() => {
    async function loadAuxData() {
      try {
        // Load Stores
        const storesSnap = await getDocs(collection(db, "stores"));
        const sNames: string[] = ["All Stores", "MADHU CREATIONS"];
        storesSnap.forEach((d) => {
          const nm = d.data().name;
          if (nm && !sNames.includes(nm)) sNames.push(nm);
        });
        setStoreOptions(Array.from(new Set(sNames)));

        // Load Categories
        const catSnap = await getDocs(collection(db, "categories"));
        const cats: { id: string; name: string }[] = [];
        catSnap.forEach((d) => {
          cats.push({ id: d.id, name: d.data().name || "Unnamed" });
        });
        setCategoryOptions(cats);

        // Load Products sample (limit 100 for dropdown)
        const prodSnap = await getDocs(query(collection(db, "products"), limit(100)));
        const prods: { id: string; name: string; barcode?: string }[] = [];
        prodSnap.forEach((d) => {
          const p = d.data();
          prods.push({
            id: d.id,
            name: p.name || "Unnamed Product",
            barcode: p.barcode || p.code || "",
          });
        });
        setProductOptions(prods);
      } catch (err) {
        console.warn("Failed to load aux data for discounts:", err);
      }
    }
    loadAuxData();
  }, []);

  // Fetch Total Count using getCountFromServer (Firebase Server Count)
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "discounts");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback for discounts:", err);
      try {
        const snap = await getDocs(collection(db, "discounts"));
        setTotalCount(snap.size);
      } catch (fallbackErr) {
        console.error("Fallback discount count failed:", fallbackErr);
      }
    }
  }, []);

  // Fetch Page of Discounts (Limit 24)
  const fetchPage = useCallback(async (pageToFetch: number) => {
    setLoading(true);
    try {
      const coll = collection(db, "discounts");
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
        console.warn("Ordered discounts query fallback:", queryErr);
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: DiscountItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          code: data.code || "DISC",
          name: data.name || "Untitled Discount",
          type: (data.type as DiscountType) || "order",
          method: (data.method as DiscountMethod) || "percentage",
          value: Number(data.value) || 0,
          minOrderValue: Number(data.minOrderValue) || 0,
          maxDiscountAmount: Number(data.maxDiscountAmount) || 0,
          applicableLevel: data.applicableLevel || "all",
          targetCategoryId: data.targetCategoryId || "",
          targetCategoryName: data.targetCategoryName || "",
          targetProductId: data.targetProductId || "",
          targetProductName: data.targetProductName || "",
          targetBarcode: data.targetBarcode || "",
          minQuantity: Number(data.minQuantity) || 1,
          customerTarget: data.customerTarget || "all",
          targetCustomerGroup: data.targetCustomerGroup || "",
          targetCustomerTier: data.targetCustomerTier || "",
          targetCustomerCode: data.targetCustomerCode || "",
          targetCustomerName: data.targetCustomerName || "",
          applyOnNonDiscountedOnly: !!data.applyOnNonDiscountedOnly,
          minBillAmount: Number(data.minBillAmount) || 0,
          store: data.store || "All Stores",
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          usageLimit: Number(data.usageLimit) || 0,
          usedCount: Number(data.usedCount) || 0,
          status: (data.status as "active" | "inactive") || "active",
          description: data.description || "",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || "",
        });
      });

      setDiscounts(items);

      if (snap.docs.length > 0) {
        pageSnapshotsRef.current[pageToFetch] = snap.docs[snap.docs.length - 1];
      }
    } catch (err: unknown) {
      console.error("Error loading discounts:", err);
      const msg = err instanceof Error ? err.message : "Failed to load discounts";
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

  // Handle Tab Switch
  const handleTabChange = (tab: "all" | "order" | "product" | "customer") => {
    setActiveTab(tab);
  };

  // Filtered Items for display
  const filteredDiscounts = useMemo(() => {
    return discounts.filter((item) => {
      // Type Tab filter
      if (activeTab !== "all" && item.type !== activeTab) return false;

      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) return false;

      // Method filter
      if (methodFilter !== "all" && item.method !== methodFilter) return false;

      // Store filter
      if (storeFilter !== "all" && item.store !== storeFilter && item.store !== "All Stores") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = item.code.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        const matchesCat = (item.targetCategoryName || "").toLowerCase().includes(q);
        const matchesProd = (item.targetProductName || "").toLowerCase().includes(q);
        const matchesCust = (item.targetCustomerName || item.targetCustomerGroup || item.targetCustomerTier || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDesc && !matchesCat && !matchesProd && !matchesCust) {
          return false;
        }
      }

      return true;
    });
  }, [discounts, activeTab, statusFilter, methodFilter, storeFilter, searchQuery]);

  // Counts for Stats Cards
  const stats = useMemo(() => {
    const orderCount = discounts.filter((d) => d.type === "order").length;
    const productCount = discounts.filter((d) => d.type === "product").length;
    const customerCount = discounts.filter((d) => d.type === "customer").length;
    const activeCount = discounts.filter((d) => d.status === "active").length;
    return {
      total: totalCount,
      order: orderCount,
      product: productCount,
      customer: customerCount,
      active: activeCount,
    };
  }, [discounts, totalCount]);

  // Open Add Modal
  const openAddModal = (presetType?: DiscountType) => {
    const typeToUse = presetType || (activeTab === "all" ? "order" : activeTab);
    setFormData(getDefaultFormData(typeToUse));
    setModalMode("add");
    setEditingDiscountId(null);
    setFormError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: DiscountItem) => {
    setFormData({
      code: item.code,
      name: item.name,
      type: item.type,
      method: item.method,
      value: item.value,
      minOrderValue: item.minOrderValue || 0,
      maxDiscountAmount: item.maxDiscountAmount || 0,
      applicableLevel: item.applicableLevel || "all",
      targetCategoryId: item.targetCategoryId || "",
      targetCategoryName: item.targetCategoryName || "",
      targetProductId: item.targetProductId || "",
      targetProductName: item.targetProductName || "",
      targetBarcode: item.targetBarcode || "",
      minQuantity: item.minQuantity || 1,
      customerTarget: item.customerTarget || "all",
      targetCustomerGroup: item.targetCustomerGroup || "Privilege / VIP",
      targetCustomerTier: item.targetCustomerTier || "Gold Tier",
      targetCustomerCode: item.targetCustomerCode || "",
      targetCustomerName: item.targetCustomerName || "",
      applyOnNonDiscountedOnly: !!item.applyOnNonDiscountedOnly,
      minBillAmount: item.minBillAmount || 0,
      store: item.store || "All Stores",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      usageLimit: item.usageLimit || 0,
      usedCount: item.usedCount || 0,
      status: item.status,
      description: item.description || "",
      createdAt: item.createdAt,
    });
    setEditingDiscountId(item.id);
    setModalMode("edit");
    setFormError("");
    setIsModalOpen(true);
  };

  // Save Discount
  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Please enter a discount name.");
      return;
    }
    if (!formData.code.trim()) {
      setFormError("Please enter or generate a discount code.");
      return;
    }
    if (Number(formData.value) <= 0) {
      setFormError("Discount value must be greater than 0.");
      return;
    }
    if (formData.method === "percentage" && Number(formData.value) > 100) {
      setFormError("Percentage discount cannot exceed 100%.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        value: Number(formData.value),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscountAmount: Number(formData.maxDiscountAmount) || 0,
        minQuantity: Number(formData.minQuantity) || 1,
        minBillAmount: Number(formData.minBillAmount) || 0,
        usageLimit: Number(formData.usageLimit) || 0,
        usedCount: Number(formData.usedCount) || 0,
        updatedAt: nowIso,
      };

      if (modalMode === "add") {
        payload.createdAt = nowIso;
        await addDoc(collection(db, "discounts"), payload);
        setToast({ type: "success", message: `Discount "${payload.name}" created successfully!` });
      } else if (editingDiscountId) {
        await updateDoc(doc(db, "discounts", editingDiscountId), payload);
        setToast({ type: "success", message: `Discount "${payload.name}" updated successfully!` });
      }

      setIsModalOpen(false);
      fetchTotalCount();
      fetchPage(1);
      setCurrentPage(1);
    } catch (err: unknown) {
      console.error("Error saving discount:", err);
      const msg = err instanceof Error ? err.message : "Failed to save discount";
      setFormError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // Quick Status Toggle
  const handleToggleStatus = async (item: DiscountItem) => {
    const newStatus = item.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "discounts", item.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setDiscounts((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, status: newStatus } : d))
      );
      setToast({
        type: "success",
        message: `Discount "${item.name}" marked as ${newStatus}.`,
      });
    } catch (err: unknown) {
      console.error("Error toggling status:", err);
      setToast({ type: "error", message: "Failed to update discount status." });
    }
  };

  // Delete Discount
  const handleConfirmDelete = async () => {
    if (!discountToDelete) return;
    try {
      await deleteDoc(doc(db, "discounts", discountToDelete.id));
      setToast({
        type: "success",
        message: `Discount "${discountToDelete.name}" deleted.`,
      });
      setDiscountToDelete(null);
      fetchTotalCount();
      fetchPage(currentPage);
    } catch (err: unknown) {
      console.error("Error deleting discount:", err);
      setToast({ type: "error", message: "Failed to delete discount." });
    }
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setToast({ type: "success", message: `Copied "${code}" to clipboard!` });
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (discounts.length === 0) {
      setToast({ type: "info", message: "No discount data to export." });
      return;
    }

    const exportRows = filteredDiscounts.map((d) => ({
      "Discount Code": d.code,
      "Discount Name": d.name,
      "Discount Type": d.type === "order" ? "Order Discount" : d.type === "product" ? "Product Discount" : "Customer Discount",
      "Calculation Method": d.method === "percentage" ? "Percentage (%)" : "Fixed Amount (₹)",
      "Value": d.method === "percentage" ? `${d.value}%` : `₹${d.value}`,
      "Min Order Value": d.minOrderValue || 0,
      "Max Cap Amount": d.maxDiscountAmount || 0,
      "Target Category": d.targetCategoryName || "—",
      "Target Product": d.targetProductName || "—",
      "Target Customer": d.targetCustomerGroup || d.targetCustomerTier || d.targetCustomerName || "—",
      "Store": d.store,
      "Start Date": d.startDate,
      "End Date": d.endDate,
      "Used Count": d.usedCount || 0,
      "Usage Limit": d.usageLimit || "Unlimited",
      "Status": d.status.toUpperCase(),
      "Created At": d.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Discounts");
    XLSX.writeFile(workbook, `SRK-Discounts-${new Date().toISOString().split("T")[0]}.xlsx`);
    setToast({ type: "success", message: "Exported discounts to Excel successfully." });
  };

  // Pagination navigation
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
                <Tag className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                Discount Manager
              </h1>
              <span className="rounded bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
                PROMO & POS
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Configure rule-based promotional discounts across Orders, Products, and Customer tiers with latest 24 limits and server counts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchTotalCount();
                fetchPage(currentPage);
              }}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer transition-colors shadow-xs"
              title="Refresh discounts list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer transition-colors shadow-xs"
              title="Export to Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export</span>
            </button>

            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer transition-all shadow-xs active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Discount</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {/* Total Discounts */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Rules</span>
              <Tag className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-zinc-900">{stats.total}</span>
              <span className="text-[10px] text-zinc-400">rules created</span>
            </div>
          </div>

          {/* Order Discounts */}
          <div 
            onClick={() => handleTabChange("order")}
            className={`rounded-lg border p-3 shadow-xs cursor-pointer transition-all ${
              activeTab === "order" ? "border-blue-500 bg-blue-50/30" : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-blue-700">Order Discount</span>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-blue-900">{stats.order}</span>
              <span className="text-[10px] text-blue-600/70">Cart / Bill</span>
            </div>
          </div>

          {/* Product Discounts */}
          <div 
            onClick={() => handleTabChange("product")}
            className={`rounded-lg border p-3 shadow-xs cursor-pointer transition-all ${
              activeTab === "product" ? "border-amber-500 bg-amber-50/30" : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">Product Discount</span>
              <Boxes className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-900">{stats.product}</span>
              <span className="text-[10px] text-amber-600/70">Item / Category</span>
            </div>
          </div>

          {/* Customer Discounts */}
          <div 
            onClick={() => handleTabChange("customer")}
            className={`rounded-lg border p-3 shadow-xs cursor-pointer transition-all ${
              activeTab === "customer" ? "border-purple-500 bg-purple-50/30" : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-purple-700">Customer Discount</span>
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-purple-900">{stats.customer}</span>
              <span className="text-[10px] text-purple-600/70">VIP / Tiers</span>
            </div>
          </div>

          {/* Active Rules */}
          <div className="hidden lg:block rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Status</span>
              <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-700">{stats.active}</span>
              <span className="text-[10px] text-zinc-400">currently active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Main Category Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
            <button
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-zinc-900 shadow-xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <span>All Discounts</span>
              <span className="rounded bg-zinc-200/70 px-1.5 py-0.2 text-[10px] font-mono">
                {discounts.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("order")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "order"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
              <span>Order Discount</span>
              <span className="rounded bg-blue-100/70 px-1.5 py-0.2 text-[10px] font-mono text-blue-800">
                {discounts.filter((d) => d.type === "order").length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("product")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "product"
                  ? "bg-white text-amber-700 shadow-xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Boxes className="h-3.5 w-3.5 text-amber-600" />
              <span>Product Discount</span>
              <span className="rounded bg-amber-100/70 px-1.5 py-0.2 text-[10px] font-mono text-amber-800">
                {discounts.filter((d) => d.type === "product").length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("customer")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "customer"
                  ? "bg-white text-purple-700 shadow-xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Users className="h-3.5 w-3.5 text-purple-600" />
              <span>Customer Discount</span>
              <span className="rounded bg-purple-100/70 px-1.5 py-0.2 text-[10px] font-mono text-purple-800">
                {discounts.filter((d) => d.type === "customer").length}
              </span>
            </button>
          </div>

          {/* Search and Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search code, name, target..."
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

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as "all" | "percentage" | "fixed")}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (₹)</option>
            </select>

            {/* Store Filter */}
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Stores</option>
              {storeOptions.filter((s) => s !== "All Stores").map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area / Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs text-zinc-500 font-mono">Loading discounts (24 limit)...</span>
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">No discounts found</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                {searchQuery || statusFilter !== "all" || activeTab !== "all"
                  ? "No discount rules match your current filter settings. Try resetting filters."
                  : "No discount rules have been configured yet. Start by creating an Order Discount, Product Discount, or Customer Discount."}
              </p>
            </div>
            <button
              onClick={() => openAddModal()}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Discount</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Discount Details</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Value & Rules</th>
                    <th className="px-4 py-3">Applicability / Target</th>
                    <th className="px-4 py-3">Validity</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-sans">
                  {filteredDiscounts.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Code and Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyCode(item.code)}
                            className="group flex items-center gap-1 rounded bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 text-[11px] font-mono font-bold text-zinc-800 border border-zinc-200 transition-colors"
                            title="Click to copy code"
                          >
                            <span>{item.code}</span>
                            <Copy className="h-3 w-3 text-zinc-400 group-hover:text-zinc-700 opacity-60 group-hover:opacity-100" />
                          </button>
                          <span className="font-semibold text-zinc-900">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <Store className="h-3 w-3 text-zinc-400" />
                          <span>{item.store}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3">
                        {item.type === "order" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            <ShoppingCart className="h-3 w-3" />
                            Order Discount
                          </span>
                        )}
                        {item.type === "product" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Boxes className="h-3 w-3" />
                            Product Discount
                          </span>
                        )}
                        {item.type === "customer" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                            <Users className="h-3 w-3" />
                            Customer Discount
                          </span>
                        )}
                      </td>

                      {/* Value & Rules */}
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-1 font-mono font-bold text-zinc-900">
                          {item.method === "percentage" ? (
                            <span className="text-emerald-700 text-sm">{item.value}% OFF</span>
                          ) : (
                            <span className="text-emerald-700 text-sm">₹{item.value} OFF</span>
                          )}
                        </div>
                        <div className="mt-0.5 space-y-0.5 text-[10px] text-zinc-500">
                          {item.type === "order" && (
                            <>
                              {item.minOrderValue ? (
                                <div>Min Cart: <span className="font-mono text-zinc-700">₹{item.minOrderValue}</span></div>
                              ) : null}
                              {item.maxDiscountAmount ? (
                                <div>Max Cap: <span className="font-mono text-zinc-700">₹{item.maxDiscountAmount}</span></div>
                              ) : null}
                            </>
                          )}
                          {item.type === "product" && (
                            <>
                              <div>Min Qty: <span className="font-mono text-zinc-700">{item.minQuantity || 1} unit(s)</span></div>
                            </>
                          )}
                          {item.type === "customer" && (
                            <>
                              {item.minBillAmount ? (
                                <div>Min Bill: <span className="font-mono text-zinc-700">₹{item.minBillAmount}</span></div>
                              ) : null}
                              {item.applyOnNonDiscountedOnly && (
                                <div className="text-amber-600 font-medium">Non-discounted items only</div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Applicability / Target */}
                      <td className="px-4 py-3">
                        {item.type === "order" && (
                          <span className="text-zinc-600 font-medium">Entire Order Bill Total</span>
                        )}
                        {item.type === "product" && (
                          <div className="text-[11px]">
                            {item.applicableLevel === "all" && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 font-medium">All Products</span>
                            )}
                            {item.applicableLevel === "category" && (
                              <div>
                                <span className="text-zinc-400">Category: </span>
                                <span className="font-semibold text-zinc-800">{item.targetCategoryName || "Any"}</span>
                              </div>
                            )}
                            {item.applicableLevel === "product" && (
                              <div>
                                <div className="font-semibold text-zinc-800">{item.targetProductName || "Selected Product"}</div>
                                {item.targetBarcode && (
                                  <span className="font-mono text-[10px] text-zinc-400">{item.targetBarcode}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {item.type === "customer" && (
                          <div className="text-[11px]">
                            {item.customerTarget === "all" && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 font-medium">All Customers</span>
                            )}
                            {item.customerTarget === "group" && (
                              <div>
                                <span className="text-zinc-400">Group: </span>
                                <span className="font-semibold text-purple-800">{item.targetCustomerGroup || "Any Group"}</span>
                              </div>
                            )}
                            {item.customerTarget === "tier" && (
                              <div>
                                <span className="text-zinc-400">Tier: </span>
                                <span className="font-semibold text-purple-800">{item.targetCustomerTier || "Any Tier"}</span>
                              </div>
                            )}
                            {item.customerTarget === "specific_customer" && (
                              <div>
                                <span className="text-zinc-400">Customer: </span>
                                <span className="font-semibold text-zinc-800">{item.targetCustomerName || item.targetCustomerCode || "Specific"}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-700">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          <span>{item.startDate || "—"}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 pl-4">
                          to {item.endDate || "—"}
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-zinc-800">
                          {item.usedCount || 0}
                          <span className="text-zinc-400 text-[10px]">
                            {" "}
                            / {item.usageLimit ? item.usageLimit : "∞"}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400">redemptions</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                            item.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200"
                          }`}
                          title="Click to toggle status"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.status === "active" ? "bg-emerald-600" : "bg-zinc-400"}`} />
                          <span className="capitalize">{item.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-colors"
                            title="Edit Discount"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDiscountToDelete(item)}
                            className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors"
                            title="Delete Discount"
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
                <span>discounts (Limit 24 / page)</span>
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

      {/* Add / Edit Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">
                    {modalMode === "add" ? "Create New Discount" : "Edit Discount Rule"}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Configure promotional rules for orders, products, or customer tiers.
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
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDiscount} className="mt-4 space-y-4">
              {/* Type Selection (Order, Product, Customer) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  1. Discount Category *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        type: "order",
                        code: modalMode === "add" ? generateDiscountCode("order") : formData.code 
                      });
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all cursor-pointer ${
                      formData.type === "order"
                        ? "border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20"
                        : "border-zinc-200 hover:border-zinc-300 text-zinc-700"
                    }`}
                  >
                    <ShoppingCart className={`h-5 w-5 ${formData.type === "order" ? "text-blue-600" : "text-zinc-500"}`} />
                    <span className="text-xs font-semibold">Order Discount</span>
                    <span className="text-[10px] text-zinc-500">Cart & Bill total</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        type: "product",
                        code: modalMode === "add" ? generateDiscountCode("product") : formData.code 
                      });
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all cursor-pointer ${
                      formData.type === "product"
                        ? "border-amber-500 bg-amber-50/50 text-amber-900 ring-2 ring-amber-500/20"
                        : "border-zinc-200 hover:border-zinc-300 text-zinc-700"
                    }`}
                  >
                    <Boxes className={`h-5 w-5 ${formData.type === "product" ? "text-amber-600" : "text-zinc-500"}`} />
                    <span className="text-xs font-semibold">Product Discount</span>
                    <span className="text-[10px] text-zinc-500">Specific item / category</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        type: "customer",
                        code: modalMode === "add" ? generateDiscountCode("customer") : formData.code 
                      });
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all cursor-pointer ${
                      formData.type === "customer"
                        ? "border-purple-500 bg-purple-50/50 text-purple-900 ring-2 ring-purple-500/20"
                        : "border-zinc-200 hover:border-zinc-300 text-zinc-700"
                    }`}
                  >
                    <Users className={`h-5 w-5 ${formData.type === "customer" ? "text-purple-600" : "text-zinc-500"}`} />
                    <span className="text-xs font-semibold">Customer Discount</span>
                    <span className="text-[10px] text-zinc-500">VIP & member tiers</span>
                  </button>
                </div>
              </div>

              {/* Basic Fields: Name, Code, Method, Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Discount Name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Discount Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali Bonanza, Flat 200 Off"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Discount Code with Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-700">
                      Discount Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, code: generateDiscountCode(formData.type) })}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-0.5"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Code
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DIWALI10, ORD-9821"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 uppercase focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Method */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Discount Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, method: "percentage" })}
                      className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        formData.method === "percentage"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      Percentage (%)
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, method: "fixed" })}
                      className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        formData.method === "fixed"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <span>₹ Fixed Amount</span>
                    </button>
                  </div>
                </div>

                {/* Value */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Discount Value ({formData.method === "percentage" ? "%" : "₹"}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={formData.method === "percentage" ? 100 : 999999}
                      value={formData.value || ""}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                      {formData.method === "percentage" ? "%" : "₹"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Type-Specific Rules */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {formData.type === "order" && "Order Discount Rules"}
                    {formData.type === "product" && "Product Discount Rules"}
                    {formData.type === "customer" && "Customer Discount Rules"}
                  </span>
                </div>

                {/* If Order Discount */}
                {formData.type === "order" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">
                        Minimum Cart / Order Value (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0 for no minimum"
                        value={formData.minOrderValue || ""}
                        onChange={(e) => setFormData({ ...formData, minOrderValue: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">
                        Maximum Discount Cap (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0 for no maximum cap"
                        value={formData.maxDiscountAmount || ""}
                        onChange={(e) => setFormData({ ...formData, maxDiscountAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {/* If Product Discount */}
                {formData.type === "product" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">
                        Applicable Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: "all", label: "All Products" },
                          { val: "category", label: "Specific Category" },
                          { val: "product", label: "Specific Product" },
                        ].map((lvl) => (
                          <button
                            type="button"
                            key={lvl.val}
                            onClick={() => setFormData({ ...formData, applicableLevel: lvl.val as "all" | "category" | "product" })}
                            className={`rounded-md border py-1 px-2 text-xs font-medium cursor-pointer transition-colors ${
                              formData.applicableLevel === lvl.val
                                ? "border-amber-600 bg-amber-50 text-amber-800 font-semibold"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.applicableLevel === "category" && (
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">
                          Select Category
                        </label>
                        <select
                          value={formData.targetCategoryId || ""}
                          onChange={(e) => {
                            const selectedCat = categoryOptions.find((c) => c.id === e.target.value);
                            setFormData({
                              ...formData,
                              targetCategoryId: e.target.value,
                              targetCategoryName: selectedCat ? selectedCat.name : "",
                            });
                          }}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Choose Category --</option>
                          {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.applicableLevel === "product" && (
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">
                          Select Product
                        </label>
                        <select
                          value={formData.targetProductId || ""}
                          onChange={(e) => {
                            const selectedProd = productOptions.find((p) => p.id === e.target.value);
                            setFormData({
                              ...formData,
                              targetProductId: e.target.value,
                              targetProductName: selectedProd ? selectedProd.name : "",
                              targetBarcode: selectedProd?.barcode || "",
                            });
                          }}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Choose Product --</option>
                          {productOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.barcode ? `(${p.barcode})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">
                        Minimum Item Quantity (Buy X units)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.minQuantity || 1}
                        onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 1 })}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {/* If Customer Discount */}
                {formData.type === "customer" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">
                        Target Customer Segment
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { val: "all", label: "All Customers" },
                          { val: "group", label: "Customer Group" },
                          { val: "tier", label: "Classification Tier" },
                          { val: "specific_customer", label: "Specific Customer" },
                        ].map((t) => (
                          <button
                            type="button"
                            key={t.val}
                            onClick={() => setFormData({ ...formData, customerTarget: t.val as "all" | "group" | "tier" | "specific_customer" })}
                            className={`rounded-md border py-1 px-2 text-xs font-medium cursor-pointer transition-colors ${
                              formData.customerTarget === t.val
                                ? "border-purple-600 bg-purple-50 text-purple-800 font-semibold"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.customerTarget === "group" && (
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">
                          Select Customer Group
                        </label>
                        <select
                          value={formData.targetCustomerGroup || "Privilege / VIP"}
                          onChange={(e) => setFormData({ ...formData, targetCustomerGroup: e.target.value })}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                        >
                          {CUSTOMER_GROUPS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.customerTarget === "tier" && (
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">
                          Select Classification / Loyalty Tier
                        </label>
                        <select
                          value={formData.targetCustomerTier || "Gold Tier"}
                          onChange={(e) => setFormData({ ...formData, targetCustomerTier: e.target.value })}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                        >
                          {CUSTOMER_TIERS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.customerTarget === "specific_customer" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">
                            Customer Code / Phone
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. MC8539 or 9876543210"
                            value={formData.targetCustomerCode || ""}
                            onChange={(e) => setFormData({ ...formData, targetCustomerCode: e.target.value })}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">
                            Customer Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Rajesh Sharma"
                            value={formData.targetCustomerName || ""}
                            onChange={(e) => setFormData({ ...formData, targetCustomerName: e.target.value })}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="applyOnNonDisc"
                        checked={!!formData.applyOnNonDiscountedOnly}
                        onChange={(e) => setFormData({ ...formData, applyOnNonDiscountedOnly: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="applyOnNonDisc" className="text-xs text-zinc-700 cursor-pointer">
                        Apply discount on non-discounted items only
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Store & Date Constraints */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Store Branch */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Applicable Store
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

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Valid From Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Valid Until Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Usage Limit and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Total Usage Limit (0 for unlimited)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.usageLimit || 0}
                    onChange={(e) => setFormData({ ...formData, usageLimit: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Discount Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="active">Active (Available for POS)</option>
                    <option value="inactive">Inactive / Paused</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Description / Terms & Conditions
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional terms, e.g. applicable during festive weekend only..."
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Modal Actions */}
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
                  <span>{modalMode === "add" ? "Create Discount" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {discountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Delete Discount Rule</h3>
                <p className="text-xs text-zinc-500">
                  Are you sure you want to delete <span className="font-semibold text-zinc-800 font-mono">{discountToDelete.code}</span> ({discountToDelete.name})?
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              <button
                onClick={() => setDiscountToDelete(null)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer transition-colors"
              >
                Delete Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
