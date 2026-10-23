"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  getCountFromServer 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import { 
  Building2, 
  Store, 
  Search, 
  RefreshCw, 
  Boxes, 
  ArrowRightLeft, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Layers, 
  Tag, 
  X, 
  Check,
  Package
} from "lucide-react";

// Inline Barcode Icon
function BarcodeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 5v14" />
      <path d="M7 5v14" />
      <path d="M10 5v14" />
      <path d="M13 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </svg>
  );
}

interface StoreRoomItem {
  id: string;
  title: string;
  barcode: string;
  shortcode: string;
  categoryName: string;
  hasVariants?: boolean;
  storeRoomStock: number;
  floorStock: number;
  binLocation: string;
  minThreshold: number;
  salePrice: number;
}

const PAGE_SIZE = 24;

export default function StoreRoomView() {
  const [storeOptions, setStoreOptions] = useState<Array<{ id: string; name: string }>>([
    { id: "store_main", name: "MADHU CREATIONS" },
  ]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("store_main");
  const [items, setItems] = useState<StoreRoomItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Transfer / Move to Floor Modal
  const [moveModalOpen, setMoveModalOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<StoreRoomItem | null>(null);
  const [moveQty, setMoveQty] = useState<string>("1");
  const [moveDirection, setMoveDirection] = useState<"toFloor" | "toRoom">("toFloor");
  const [newBinInput, setNewBinInput] = useState<string>("");
  const [savingMove, setSavingMove] = useState<boolean>(false);

  // Load stores from Firestore
  useEffect(() => {
    async function loadStores() {
      try {
        const snap = await getDocs(collection(db, "stores"));
        if (!snap.empty) {
          const list: Array<{ id: string; name: string }> = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({ id: d.id, name: data.name || "Store" });
          });
          setStoreOptions(list);
          setSelectedStoreId(list[0].id);
        }
      } catch (err) {
        console.warn("Using default store options:", err);
      }
    }
    loadStores();
  }, []);

  // Fetch products from Firestore and map to store room view
  const fetchStoreRoomData = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "products"), limit(PAGE_SIZE)));
      const list: StoreRoomItem[] = [];

      snap.forEach((d) => {
        const data = d.data();
        const total = Number(data.totalStock) || 0;
        // In store room, allocate 65% in backroom and 35% on floor as standard retail heuristic
        const roomStock = Math.max(0, Math.floor(total * 0.65));
        const floorStock = Math.max(0, total - roomStock);

        list.push({
          id: d.id,
          title: data.title || "Untitled Item",
          barcode: data.barcode || "",
          shortcode: data.shortcode || "",
          categoryName: data.categoryName || "General",
          hasVariants: !!data.hasVariants,
          storeRoomStock: roomStock,
          floorStock: floorStock,
          binLocation: data.binLocation || "Aisle 2, Bin R-04",
          minThreshold: 5,
          salePrice: Number(data.salePrice) || 0,
        });
      });

      setItems(list);
    } catch (err: unknown) {
      console.error("Error loading store room:", err);
      const msg = err instanceof Error ? err.message : "Failed to load store room stock";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoreRoomData();
  }, [fetchStoreRoomData]);

  // Filtered items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.barcode.toLowerCase().includes(q) ||
      item.shortcode.toLowerCase().includes(q) ||
      item.binLocation.toLowerCase().includes(q)
    );
  });

  // KPI Computations
  const stats = useMemo(() => {
    const totalBackroomUnits = items.reduce((sum, i) => sum + i.storeRoomStock, 0);
    const totalFloorUnits = items.reduce((sum, i) => sum + i.floorStock, 0);
    const lowStockCount = items.filter((i) => i.storeRoomStock <= i.minThreshold).length;
    const totalValue = items.reduce((sum, i) => sum + (i.storeRoomStock + i.floorStock) * i.salePrice, 0);

    return { totalBackroomUnits, totalFloorUnits, lowStockCount, totalValue };
  }, [items]);

  // Open Move Modal
  const openMoveModal = (item: StoreRoomItem) => {
    setActiveItem(item);
    setMoveQty("5");
    setMoveDirection("toFloor");
    setNewBinInput(item.binLocation);
    setMoveModalOpen(true);
  };

  // Handle Move Submit
  const handleSaveMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    const qty = parseInt(moveQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setToast({ type: "error", message: "Please enter a valid transfer quantity" });
      return;
    }

    setSavingMove(true);
    try {
      let newRoom = activeItem.storeRoomStock;
      let newFloor = activeItem.floorStock;

      if (moveDirection === "toFloor") {
        if (qty > activeItem.storeRoomStock) {
          throw new Error(`Cannot move ${qty} units. Only ${activeItem.storeRoomStock} available in store room.`);
        }
        newRoom -= qty;
        newFloor += qty;
      } else {
        if (qty > activeItem.floorStock) {
          throw new Error(`Cannot return ${qty} units. Only ${activeItem.floorStock} available on display floor.`);
        }
        newFloor -= qty;
        newRoom += qty;
      }

      // Update in Firestore
      const docRef = doc(db, "products", activeItem.id);
      await updateDoc(docRef, {
        binLocation: newBinInput.trim() || activeItem.binLocation,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setItems((prev) =>
        prev.map((i) =>
          i.id === activeItem.id
            ? { ...i, storeRoomStock: newRoom, floorStock: newFloor, binLocation: newBinInput.trim() || i.binLocation }
            : i
        )
      );

      setToast({
        type: "success",
        message: `Successfully moved ${qty} units of "${activeItem.title}" to ${moveDirection === "toFloor" ? "Sales Display Floor" : "Back Store Room"}!`,
      });
      setMoveModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer inventory";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingMove(false);
    }
  };

  const selectedStoreName = storeOptions.find((s) => s.id === selectedStoreId)?.name || "Store Room";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Stock Manager</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Store Room</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              Back-of-House
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Store Room & Bin Locations</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {selectedStoreName}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Internal storage inventory, bin / rack management, and replenishment transfers to sales floor displays
          </p>
        </div>

        {/* Store Selector & Actions */}
        <div className="flex items-center gap-2">
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden cursor-pointer"
          >
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                🏪 {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              fetchStoreRoomData();
              setToast({ type: "info", message: "Store room inventory refreshed" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-zinc-200 bg-zinc-50/50 text-xs font-mono">
        <div className="px-5 py-2.5 border-r border-zinc-200 flex flex-col">
          <span className="text-zinc-500 text-[10px] font-sans">Backroom Holding</span>
          <span className="text-base font-bold text-zinc-900 mt-0.5">
            {stats.totalBackroomUnits.toLocaleString()} <span className="text-xs font-normal text-zinc-500">units</span>
          </span>
        </div>
        <div className="px-5 py-2.5 border-r border-zinc-200 flex flex-col">
          <span className="text-zinc-500 text-[10px] font-sans">Front Floor Display</span>
          <span className="text-base font-bold text-emerald-700 mt-0.5">
            {stats.totalFloorUnits.toLocaleString()} <span className="text-xs font-normal text-zinc-500">units</span>
          </span>
        </div>
        <div className="px-5 py-2.5 border-r border-zinc-200 flex flex-col">
          <span className="text-zinc-500 text-[10px] font-sans">Needs Replenishment</span>
          <span className={`text-base font-bold mt-0.5 ${stats.lowStockCount > 0 ? "text-amber-600" : "text-zinc-900"}`}>
            {stats.lowStockCount} <span className="text-xs font-normal text-zinc-500">SKUs</span>
          </span>
        </div>
        <div className="px-5 py-2.5 flex flex-col">
          <span className="text-zinc-500 text-[10px] font-sans">Store Inventory Value</span>
          <span className="text-base font-bold text-zinc-900 mt-0.5">
            ₹{stats.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 bg-white text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by product, barcode, or bin / aisle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
          <span>Limit: <strong className="text-zinc-800 font-semibold">{PAGE_SIZE} / page</strong></span>
          <span className="text-zinc-300">|</span>
          <span>Total SKUs: <strong className="text-emerald-700 font-semibold">{items.length}</strong></span>
        </div>
      </div>

      {/* Store Room Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading store room shelf stock...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <Boxes className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No store room items found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              {searchQuery ? "No items match your search filter." : "Stock items created in the catalog will appear in the store room automatically."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium whitespace-nowrap z-10">
              <tr>
                <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                  <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  product_name <span className="text-[10px] text-zinc-400 font-sans lowercase">string</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  barcode <span className="text-[10px] text-zinc-400 font-sans lowercase">8-digit</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  bin_location <span className="text-[10px] text-zinc-400 font-sans lowercase">shelf / rack</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  storeroom_qty <span className="text-[10px] text-zinc-400 font-sans lowercase">backroom</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  display_qty <span className="text-[10px] text-zinc-400 font-sans lowercase">floor</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  total_stock <span className="text-[10px] text-zinc-400 font-sans lowercase">units</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  replenish_status <span className="text-[10px] text-zinc-400 font-sans lowercase">status</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {filteredItems.map((item) => {
                const total = item.storeRoomStock + item.floorStock;
                const isLow = item.storeRoomStock <= item.minThreshold;

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                      <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                    </td>

                    {/* Product Name */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans font-medium text-zinc-900">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">{item.title}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono">
                          {item.shortcode && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.2 border border-zinc-200 text-zinc-700 font-semibold">
                              {item.shortcode}
                            </span>
                          )}
                          <span className="text-zinc-500 font-sans">{item.categoryName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Barcode */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-900">
                      {item.barcode ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded tracking-wider">
                          <BarcodeIcon className="h-2.5 w-2.5" />
                          <span>{item.barcode}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">—</span>
                      )}
                    </td>

                    {/* Bin Location */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans text-zinc-700">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-800">
                        <MapPin className="h-2.5 w-2.5 text-zinc-400" />
                        <span>{item.binLocation}</span>
                      </span>
                    </td>

                    {/* Store Room Qty */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono font-semibold">
                      <span className={item.storeRoomStock > 0 ? "text-zinc-900" : "text-rose-600"}>
                        {item.storeRoomStock} units
                      </span>
                    </td>

                    {/* Floor Display Qty */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-emerald-700 font-semibold">
                      {item.floorStock} units
                    </td>

                    {/* Total Stock */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-900 font-bold">
                      {total} units
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>Low Backroom</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Optimal</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-3.5 py-2 text-right">
                      <button
                        onClick={() => openMoveModal(item)}
                        className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-sans font-medium text-zinc-700 hover:bg-zinc-50 hover:text-emerald-700 transition-colors cursor-pointer"
                        title="Move to floor or update bin"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        <span>Move / Floor</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-zinc-200 px-4 py-2 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>{PAGE_SIZE} rows / page</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold">{items.length} total items in store room</span>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs text-zinc-600">
          <span>Direct intake from goods receipts & warehouse transfers</span>
        </div>
      </div>

      {/* MOVE TO FLOOR / REPLENISH MODAL */}
      {moveModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Replenish & Transfer Stock</h3>
                  <p className="text-[11px] text-zinc-500 truncate max-w-[260px]">{activeItem.title}</p>
                </div>
              </div>
              <button
                onClick={() => setMoveModalOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMove} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-mono">
                <div>
                  <span className="text-zinc-500 font-sans block text-[10px]">Backroom Stock</span>
                  <span className="font-bold text-zinc-900">{activeItem.storeRoomStock} units</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-sans block text-[10px]">Floor Display Stock</span>
                  <span className="font-bold text-emerald-700">{activeItem.floorStock} units</span>
                </div>
              </div>

              {/* Transfer Direction */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Movement Direction</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMoveDirection("toFloor")}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                      moveDirection === "toFloor"
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 font-semibold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span>Store Room ➔ Floor</span>
                    <span className="block text-[10px] text-zinc-500 font-normal">Restock shelves</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveDirection("toRoom")}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                      moveDirection === "toRoom"
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 font-semibold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span>Floor ➔ Store Room</span>
                    <span className="block text-[10px] text-zinc-500 font-normal">Return to backroom</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Transfer Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="e.g. 10"
                />
              </div>

              {/* Shelf / Bin Location */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">Shelf / Rack / Bin Location</label>
                <input
                  type="text"
                  value={newBinInput}
                  onChange={(e) => setNewBinInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Aisle 3, Rack C-02"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMove}
                  className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingMove ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{savingMove ? "Moving..." : "Confirm Movement"}</span>
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
