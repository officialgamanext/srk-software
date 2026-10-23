"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import { 
  Truck, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Trash2, 
  X, 
  Check, 
  Store, 
  Warehouse, 
  FileText, 
  Boxes,
  MapPin,
  Calendar
} from "lucide-react";

export interface StockTransferRecord {
  id: string;
  transferNumber: string;
  sourceType: "warehouse" | "store";
  sourceName: string;
  destinationType: "warehouse" | "store";
  destinationName: string;
  items: Array<{
    productId: string;
    productTitle: string;
    barcode?: string;
    quantity: number;
  }>;
  totalQuantity: number;
  vehicleNumber?: string;
  eWayBill?: string;
  status: "Draft" | "In Transit" | "Completed" | "Cancelled";
  transferDate: string;
  notes?: string;
  createdAt: string;
}

const PAGE_SIZE = 24;

export default function StockTransferView() {
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Transfer Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [sourceName, setSourceName] = useState<string>("Central Warehouse");
  const [destinationName, setDestinationName] = useState<string>("MADHU CREATIONS");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [eWayBill, setEWayBill] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>("2026-10-23");
  const [catalogProducts, setCatalogProducts] = useState<
    Array<{ id: string; title: string; barcode?: string }>
  >([]);
  const [lineItems, setLineItems] = useState<
    Array<{ productId: string; productTitle: string; barcode?: string; quantity: number }>
  >([]);
  const [savingTransfer, setSavingTransfer] = useState<boolean>(false);

  // Locations options
  const [allLocations, setAllLocations] = useState<Array<{ name: string; type: "warehouse" | "store" }>>([
    { name: "Central Warehouse", type: "warehouse" },
    { name: "MADHU CREATIONS", type: "store" },
  ]);

  // Load locations
  useEffect(() => {
    async function loadLocs() {
      try {
        const list: Array<{ name: string; type: "warehouse" | "store" }> = [];
        const whSnap = await getDocs(collection(db, "warehouses"));
        whSnap.forEach((d) => list.push({ name: d.data().name || "Warehouse", type: "warehouse" }));

        const storeSnap = await getDocs(collection(db, "stores"));
        storeSnap.forEach((d) => list.push({ name: d.data().name || "Store", type: "store" }));

        if (list.length > 0) {
          setAllLocations(list);
          if (list.length >= 2) {
            setSourceName(list[0].name);
            setDestinationName(list[1].name);
          }
        }
      } catch (e) {
        console.warn("Failed to load locations for stock transfer:", e);
      }
    }
    loadLocs();
  }, []);

  // Load catalog
  useEffect(() => {
    async function loadCatalog() {
      try {
        const snap = await getDocs(query(collection(db, "products"), limit(50)));
        const list: Array<{ id: string; title: string; barcode?: string }> = [];
        snap.forEach((d) => {
          list.push({ id: d.id, title: d.data().title || "Product", barcode: d.data().barcode || "" });
        });
        setCatalogProducts(list);
        if (list.length > 0) {
          setLineItems([{ productId: list[0].id, productTitle: list[0].title, barcode: list[0].barcode, quantity: 20 }]);
        }
      } catch (err) {
        console.warn("Catalog load failed:", err);
      }
    }
    loadCatalog();
  }, []);

  // Fetch Transfers
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "stock_transfers"));
      const list: StockTransferRecord[] = [];

      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          transferNumber: data.transferNumber || `TRF-${d.id.slice(-4).toUpperCase()}`,
          sourceType: data.sourceType || "warehouse",
          sourceName: data.sourceName || "Central Warehouse",
          destinationType: data.destinationType || "store",
          destinationName: data.destinationName || "MADHU CREATIONS",
          items: Array.isArray(data.items) ? data.items : [],
          totalQuantity: data.totalQuantity ?? 0,
          vehicleNumber: data.vehicleNumber || "",
          eWayBill: data.eWayBill || "",
          status: data.status || "In Transit",
          transferDate: data.transferDate || "2026-10-23",
          notes: data.notes || "",
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      // Demo seeds if empty
      if (list.length === 0) {
        const sampleSeeds: Array<Omit<StockTransferRecord, "id">> = [
          {
            transferNumber: "TRF-2026-0881",
            sourceType: "warehouse",
            sourceName: "Central Warehouse",
            destinationType: "store",
            destinationName: "MADHU CREATIONS",
            items: [
              { productId: "p1", productTitle: "Formal Cotton Slim Shirt", barcode: "10048291", quantity: 30 },
              { productId: "p2", productTitle: "Denim Regular Fit Jeans", barcode: "10084723", quantity: 20 },
            ],
            totalQuantity: 50,
            vehicleNumber: "AP-16-TX-9982",
            eWayBill: "241908221804",
            status: "In Transit",
            transferDate: "2026-10-23",
            notes: "Inter-city replenishment dispatch via express freight",
            createdAt: new Date().toISOString(),
          },
          {
            transferNumber: "TRF-2026-0880",
            sourceType: "warehouse",
            sourceName: "Central Warehouse",
            destinationType: "store",
            destinationName: "Guntur Branch",
            items: [
              { productId: "p3", productTitle: "Linen Casual Trousers", barcode: "10099412", quantity: 40 },
            ],
            totalQuantity: 40,
            vehicleNumber: "AP-07-ZZ-1200",
            eWayBill: "241908221799",
            status: "Completed",
            transferDate: "2026-10-22",
            notes: "Delivered & verified by Store Manager",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ];

        for (const s of sampleSeeds) {
          const docRef = await addDoc(collection(db, "stock_transfers"), s);
          list.push({ id: docRef.id, ...s });
        }
      }

      setTransfers(list);
    } catch (err: unknown) {
      console.error("Failed to load transfers:", err);
      const msg = err instanceof Error ? err.message : "Failed to load stock transfers";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Update Status
  const handleUpdateTransferStatus = async (
    id: string,
    newStatus: StockTransferRecord["status"]
  ) => {
    try {
      await updateDoc(doc(db, "stock_transfers", id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
      );
      setToast({ type: "success", message: `Transfer marked as ${newStatus}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setToast({ type: "error", message: msg });
    }
  };

  // Delete
  const handleDeleteTransfer = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to delete transfer challan ${num}?`)) return;
    try {
      await deleteDoc(doc(db, "stock_transfers", id));
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      setToast({ type: "success", message: `Transfer ${num} deleted` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setToast({ type: "error", message: msg });
    }
  };

  // Create Transfer Submit
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceName === destinationName) {
      setToast({ type: "error", message: "Source and destination locations cannot be the same" });
      return;
    }
    if (lineItems.length === 0) {
      setToast({ type: "error", message: "Please specify items to transfer" });
      return;
    }

    setSavingTransfer(true);
    try {
      const transferNumber = `TRF-${Date.now().toString().slice(-4)}`;
      const totalQuantity = lineItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

      const srcLoc = allLocations.find((l) => l.name === sourceName);
      const dstLoc = allLocations.find((l) => l.name === destinationName);

      const payload: Omit<StockTransferRecord, "id"> = {
        transferNumber,
        sourceType: srcLoc?.type || "warehouse",
        sourceName,
        destinationType: dstLoc?.type || "store",
        destinationName,
        items: lineItems,
        totalQuantity,
        vehicleNumber: vehicleNo.trim().toUpperCase(),
        eWayBill: eWayBill.trim(),
        status: "In Transit",
        transferDate,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "stock_transfers"), payload);
      setTransfers((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setToast({ type: "success", message: `Challan ${transferNumber} created! Goods in transit.` });
      setModalOpen(false);
      setVehicleNo("");
      setEWayBill("");
      setNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch transfer";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingTransfer(false);
    }
  };

  // Filtered
  const filteredTransfers = transfers.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      t.transferNumber.toLowerCase().includes(q) ||
      t.sourceName.toLowerCase().includes(q) ||
      t.destinationName.toLowerCase().includes(q) ||
      t.vehicleNumber?.toLowerCase().includes(q) ||
      t.eWayBill?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();
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
            <span className="font-semibold text-zinc-800">Stock Transfer</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {transfers.length} Challans
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Stock Transfer & E-Way Delivery Challans</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {transfers.filter((t) => t.status === "In Transit").length} in transit
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Inter-location stock transfers between warehouses and stores with goods dispatch notes and transit audit
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchTransfers();
              setToast({ type: "info", message: "Stock transfers refreshed" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Transfer</span>
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
              placeholder="Search by transfer ID, vehicle number, or e-way bill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 text-xs">
          {["all", "in transit", "completed", "cancelled"].map((st) => (
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

      {/* Transfers Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading stock transfer challans...</span>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <Truck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No stock transfers found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              Click 'Create Transfer' above to dispatch stock between any warehouse or retail store.
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
                  challan_no <span className="text-[10px] text-zinc-400 font-sans lowercase">code</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  source ➔ destination <span className="text-[10px] text-zinc-400 font-sans lowercase">route</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  items_dispatched <span className="text-[10px] text-zinc-400 font-sans lowercase">volume</span>
                </th>
                <th className="w-32 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  transport / vehicle <span className="text-[10px] text-zinc-400 font-sans lowercase">reg</span>
                </th>
                <th className="w-28 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  date <span className="text-[10px] text-zinc-400 font-sans lowercase">dispatch</span>
                </th>
                <th className="w-28 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  transit_status <span className="text-[10px] text-zinc-400 font-sans lowercase">state</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {filteredTransfers.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                    <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                  </td>

                  {/* Transfer No */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-semibold text-zinc-900">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 border border-zinc-200">
                      {t.transferNumber}
                    </span>
                  </td>

                  {/* Route: Source -> Destination */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans">
                    <div className="flex items-center gap-1.5 text-zinc-900 font-medium">
                      <span className="flex items-center gap-1">
                        {t.sourceType === "warehouse" ? <Warehouse className="h-3.5 w-3.5 text-zinc-500" /> : <Store className="h-3.5 w-3.5 text-emerald-600" />}
                        <span>{t.sourceName}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-400" />
                      <span className="flex items-center gap-1 font-semibold text-emerald-800">
                        {t.destinationType === "warehouse" ? <Warehouse className="h-3.5 w-3.5 text-zinc-500" /> : <Store className="h-3.5 w-3.5 text-emerald-600" />}
                        <span>{t.destinationName}</span>
                      </span>
                    </div>
                  </td>

                  {/* Items Dispatched */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900 font-mono">
                        {t.totalQuantity} units ({t.items.length} {t.items.length === 1 ? "SKU" : "SKUs"})
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-xs font-mono">
                        {t.items.map((i) => `${i.productTitle} (${i.quantity})`).join(", ")}
                      </span>
                    </div>
                  </td>

                  {/* Vehicle / Waybill */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-800">
                    <div className="flex flex-col">
                      <span className="font-semibold">{t.vehicleNumber || "Local Transfer"}</span>
                      {t.eWayBill && <span className="text-[10px] text-zinc-400">E-Way: {t.eWayBill}</span>}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-600">
                    {t.transferDate}
                  </td>

                  {/* Status */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60">
                    {t.status === "In Transit" && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                        <Truck className="h-3 w-3" />
                        <span>In Transit</span>
                      </span>
                    )}
                    {t.status === "Completed" && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Delivered</span>
                      </span>
                    )}
                    {t.status === "Cancelled" && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                        <span>Cancelled</span>
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-3.5 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 font-sans">
                      {t.status === "In Transit" && (
                        <button
                          onClick={() => handleUpdateTransferStatus(t.id, "Completed")}
                          className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          Mark Delivered
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete challan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-zinc-200 px-4 py-2 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>{PAGE_SIZE} rows / page</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold">{transfers.length} total transfers recorded</span>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs text-zinc-600">
          <span>Compliant with Indian GST E-way delivery requirements</span>
        </div>
      </div>

      {/* CREATE TRANSFER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">New Stock Transfer Challan</h3>
                  <p className="text-[11px] text-zinc-500">Dispatch stock between warehouses and retail stores</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Source Location</label>
                  <select
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {allLocations.map((l) => (
                      <option key={l.name} value={l.name}>
                        {l.type === "warehouse" ? "🏢 WH: " : "🏪 Store: "}
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Destination Location</label>
                  <select
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {allLocations.map((l) => (
                      <option key={l.name} value={l.name}>
                        {l.type === "warehouse" ? "🏢 WH: " : "🏪 Store: "}
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transit Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">Vehicle / Driver Reg No</label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 uppercase font-mono focus:border-emerald-500 focus:outline-hidden"
                    placeholder="e.g. AP-16-TX-9982"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-700">E-Way Bill No (Optional)</label>
                  <input
                    type="text"
                    value={eWayBill}
                    onChange={(e) => setEWayBill(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                    placeholder="e.g. 241908221804"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700">Stock Items to Transfer</label>
                {catalogProducts.length > 0 ? (
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const selectedProd = catalogProducts.find((p) => p.id === e.target.value);
                            if (selectedProd) {
                              const updated = [...lineItems];
                              updated[idx] = {
                                ...updated[idx],
                                productId: selectedProd.id,
                                productTitle: selectedProd.title,
                                barcode: selectedProd.barcode,
                              };
                              setLineItems(updated);
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
                            const updated = [...lineItems];
                            updated[idx].quantity = val;
                            setLineItems(updated);
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
                <label className="block text-xs font-semibold text-zinc-700">Dispatch Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Fragile merchandise handled with care"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTransfer}
                  className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingTransfer ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{savingTransfer ? "Dispatching..." : "Dispatch Transfer"}</span>
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
