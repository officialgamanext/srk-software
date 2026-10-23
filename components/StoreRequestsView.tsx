"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import { 
  Inbox, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  Truck, 
  AlertCircle, 
  X, 
  Check, 
  Store, 
  Warehouse, 
  Layers, 
  Trash2, 
  ChevronRight,
  FileText
} from "lucide-react";

export interface StoreRequestItem {
  id: string;
  requestCode: string;
  requestingStore: string;
  sourceLocation: string;
  items: Array<{
    productId: string;
    productTitle: string;
    barcode?: string;
    quantity: number;
  }>;
  priority: "High" | "Medium" | "Normal";
  status: "Pending" | "Approved" | "Dispatched" | "Received" | "Rejected";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

const PAGE_SIZE = 24;

export default function StoreRequestsView() {
  const [requests, setRequests] = useState<StoreRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Request Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [requestingStore, setRequestingStore] = useState<string>("MADHU CREATIONS");
  const [sourceLocation, setSourceLocation] = useState<string>("Central Warehouse");
  const [priority, setPriority] = useState<"High" | "Medium" | "Normal">("Normal");
  const [notes, setNotes] = useState<string>("");
  const [requestItems, setRequestItems] = useState<
    Array<{ productId: string; productTitle: string; barcode?: string; quantity: number }>
  >([]);
  const [catalogProducts, setCatalogProducts] = useState<
    Array<{ id: string; title: string; barcode?: string }>
  >([]);
  const [savingRequest, setSavingRequest] = useState<boolean>(false);

  // Store & Warehouse Options
  const [stores, setStores] = useState<string[]>(["MADHU CREATIONS"]);
  const [sources, setSources] = useState<string[]>(["Central Warehouse"]);

  // Fetch locations
  useEffect(() => {
    async function loadLocations() {
      try {
        const storeSnap = await getDocs(collection(db, "stores"));
        if (!storeSnap.empty) {
          const sList: string[] = [];
          storeSnap.forEach((d) => sList.push(d.data().name || "Store"));
          setStores(sList);
          setRequestingStore(sList[0]);
        }

        const whSnap = await getDocs(collection(db, "warehouses"));
        if (!whSnap.empty) {
          const wList: string[] = [];
          whSnap.forEach((d) => wList.push(d.data().name || "Warehouse"));
          setSources(wList);
          setSourceLocation(wList[0]);
        }
      } catch (err) {
        console.warn("Locations fallback:", err);
      }
    }
    loadLocations();
  }, []);

  // Fetch product catalog for request item selection
  useEffect(() => {
    async function loadCatalog() {
      try {
        const snap = await getDocs(query(collection(db, "products"), limit(50)));
        const list: Array<{ id: string; title: string; barcode?: string }> = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data.title || "Untitled Product",
            barcode: data.barcode || "",
          });
        });
        setCatalogProducts(list);
        if (list.length > 0) {
          setRequestItems([{ productId: list[0].id, productTitle: list[0].title, barcode: list[0].barcode, quantity: 10 }]);
        }
      } catch (err) {
        console.warn("Product load for store requests:", err);
      }
    }
    loadCatalog();
  }, []);

  // Fetch store requests from Firestore
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "store_requests"));
      const list: StoreRequestItem[] = [];

      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          requestCode: data.requestCode || `REQ-${d.id.slice(-4).toUpperCase()}`,
          requestingStore: data.requestingStore || "MADHU CREATIONS",
          sourceLocation: data.sourceLocation || "Central Warehouse",
          items: Array.isArray(data.items) ? data.items : [],
          priority: data.priority || "Normal",
          status: data.status || "Pending",
          notes: data.notes || "",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || "",
        });
      });

      // If empty in database, seed demo realistic store requests so users see immediate value
      if (list.length === 0) {
        const sampleSeed: Array<Omit<StoreRequestItem, "id">> = [
          {
            requestCode: "REQ-2026-0101",
            requestingStore: "MADHU CREATIONS",
            sourceLocation: "Central Warehouse",
            items: [
              { productId: "p1", productTitle: "Formal Cotton Slim Shirt", barcode: "10048291", quantity: 25 },
              { productId: "p2", productTitle: "Denim Regular Fit Jeans", barcode: "10084723", quantity: 15 },
            ],
            priority: "High",
            status: "Pending",
            notes: "Weekend festive rush replenishment for Vijayawada showroom",
            createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          },
          {
            requestCode: "REQ-2026-0102",
            requestingStore: "MADHU CREATIONS",
            sourceLocation: "Central Warehouse",
            items: [
              { productId: "p3", productTitle: "Linen Casual Trousers", barcode: "10099412", quantity: 30 },
            ],
            priority: "Normal",
            status: "Approved",
            notes: "Routine weekly replenishment",
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          },
          {
            requestCode: "REQ-2026-0103",
            requestingStore: "Guntur Branch",
            sourceLocation: "Central Warehouse",
            items: [
              { productId: "p4", productTitle: "Polo T-Shirt Athletic Navy", barcode: "10077112", quantity: 50 },
            ],
            priority: "Medium",
            status: "Dispatched",
            notes: "In transit via dispatch van AP-16-TX-4402",
            createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          },
        ];

        for (const seed of sampleSeed) {
          const docRef = await addDoc(collection(db, "store_requests"), seed);
          list.push({ id: docRef.id, ...seed });
        }
      }

      setRequests(list);
    } catch (err: unknown) {
      console.error("Failed to load requests:", err);
      const msg = err instanceof Error ? err.message : "Failed to load store requests";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Update Status in Firestore
  const handleUpdateStatus = async (
    id: string,
    newStatus: StoreRequestItem["status"]
  ) => {
    try {
      await updateDoc(doc(db, "store_requests", id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      setToast({ type: "success", message: `Request status updated to ${newStatus}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setToast({ type: "error", message: msg });
    }
  };

  // Delete Request
  const handleDeleteRequest = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete request ${code}?`)) return;
    try {
      await deleteDoc(doc(db, "store_requests", id));
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setToast({ type: "success", message: `Request ${code} deleted` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete request";
      setToast({ type: "error", message: msg });
    }
  };

  // Create Request Submit
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestItems.length === 0) {
      setToast({ type: "error", message: "Please add at least one item to the request" });
      return;
    }

    setSavingRequest(true);
    try {
      const requestCode = `REQ-${Date.now().toString().slice(-4)}`;
      const payload: Omit<StoreRequestItem, "id"> = {
        requestCode,
        requestingStore,
        sourceLocation,
        items: requestItems,
        priority,
        status: "Pending",
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "store_requests"), payload);
      setRequests((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setToast({ type: "success", message: `Request ${requestCode} created successfully!` });
      setIsModalOpen(false);
      setNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create store request";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingRequest(false);
    }
  };

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.requestCode.toLowerCase().includes(q) ||
      r.requestingStore.toLowerCase().includes(q) ||
      r.sourceLocation.toLowerCase().includes(q) ||
      r.items.some((i) => i.productTitle.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Stock Manager</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Store Requests</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {requests.length} Requests
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Inter-Store & Warehouse Stock Requests</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {requests.filter((r) => r.status === "Pending").length} pending
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Stock replenishment orders from retail branches to central warehouse and inter-outlet stock requisitions
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchRequests();
              setToast({ type: "info", message: "Store requests refreshed" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Store Request</span>
          </button>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 px-4 py-2 bg-white text-xs gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by request code, store, or product item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-xs">
          {["all", "pending", "approved", "dispatched", "received"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 capitalize cursor-pointer transition-colors ${
                statusFilter === st
                  ? "bg-zinc-900 text-white font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading store requisitions...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No store requests found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              Click 'New Store Request' to raise a replenishment requisition for any store outlet.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium whitespace-nowrap z-10">
              <tr>
                <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                  <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                </th>
                <th className="w-32 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  request_id <span className="text-[10px] text-zinc-400 font-sans lowercase">code</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  requesting_store <span className="text-[10px] text-zinc-400 font-sans lowercase">destination</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  source_depot <span className="text-[10px] text-zinc-400 font-sans lowercase">warehouse</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  items_requested <span className="text-[10px] text-zinc-400 font-sans lowercase">quantity</span>
                </th>
                <th className="w-24 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  priority <span className="text-[10px] text-zinc-400 font-sans lowercase">tier</span>
                </th>
                <th className="w-28 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  status <span className="text-[10px] text-zinc-400 font-sans lowercase">state</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  workflow_action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {filteredRequests.map((r) => {
                const totalUnits = r.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

                return (
                  <tr key={r.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                      <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                    </td>

                    {/* Request Code */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-semibold text-zinc-900">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 border border-zinc-200">
                        {r.requestCode}
                      </span>
                    </td>

                    {/* Requesting Store */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans font-medium text-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{r.requestingStore}</span>
                      </div>
                    </td>

                    {/* Source Warehouse */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans text-zinc-700">
                      <div className="flex items-center gap-1.5">
                        <Warehouse className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{r.sourceLocation}</span>
                      </div>
                    </td>

                    {/* Items Requested */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">
                          {totalUnits} units ({r.items.length} {r.items.length === 1 ? "SKU" : "SKUs"})
                        </span>
                        <div className="text-[10px] text-zinc-500 truncate max-w-xs font-mono">
                          {r.items.map((i) => `${i.productTitle} (${i.quantity})`).join(", ")}
                        </div>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60">
                      {r.priority === "High" ? (
                        <span className="rounded bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 font-sans font-semibold text-[10px]">
                          High
                        </span>
                      ) : r.priority === "Medium" ? (
                        <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 font-sans font-semibold text-[10px]">
                          Medium
                        </span>
                      ) : (
                        <span className="rounded bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.2 font-sans text-[10px]">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60">
                      {r.status === "Pending" && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          <Clock className="h-3 w-3" />
                          <span>Pending</span>
                        </span>
                      )}
                      {r.status === "Approved" && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          <Check className="h-3 w-3" />
                          <span>Approved</span>
                        </span>
                      )}
                      {r.status === "Dispatched" && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          <Truck className="h-3 w-3" />
                          <span>Dispatched</span>
                        </span>
                      )}
                      {r.status === "Received" && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Received</span>
                        </span>
                      )}
                    </td>

                    {/* Workflow Actions */}
                    <td className="px-3.5 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        {r.status === "Pending" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "Approved")}
                            className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === "Approved" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "Dispatched")}
                            className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            Dispatch
                          </button>
                        )}
                        {r.status === "Dispatched" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "Received")}
                            className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            Mark Received
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRequest(r.id, r.requestCode)}
                          className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                          title="Delete request"
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

      {/* CREATE NEW REQUEST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Inbox className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Create Stock Requisition</h3>
                  <p className="text-[11px] text-zinc-500">Order inventory from warehouse or inter-branch</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Requesting Store</label>
                  <select
                    value={requestingStore}
                    onChange={(e) => setRequestingStore(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {stores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Fulfilling Location</label>
                  <select
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {sources.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Priority Level</label>
                <div className="flex gap-2">
                  {(["Normal", "Medium", "High"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        priority === p
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700">Items to Requisition</label>
                {catalogProducts.length > 0 ? (
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    {requestItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const selectedProd = catalogProducts.find((p) => p.id === e.target.value);
                            if (selectedProd) {
                              const updated = [...requestItems];
                              updated[idx] = {
                                ...updated[idx],
                                productId: selectedProd.id,
                                productTitle: selectedProd.title,
                                barcode: selectedProd.barcode,
                              };
                              setRequestItems(updated);
                            }
                          }}
                          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800"
                        >
                          {catalogProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} {p.barcode ? `(${p.barcode})` : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            const updated = [...requestItems];
                            updated[idx].quantity = val;
                            setRequestItems(updated);
                          }}
                          className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-mono font-semibold"
                          placeholder="Qty"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 italic">No products available in catalog.</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Requisition Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Replenish ahead of weekend promotion"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRequest}
                  className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingRequest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{savingRequest ? "Submitting..." : "Submit Requisition"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
