"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
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
  Warehouse, 
  Store, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Minus, 
  Edit3, 
  Sliders, 
  Boxes, 
  PackageCheck, 
  AlertTriangle,
  ArrowUpDown,
  X,
  Check,
  Building2,
  Tag
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

export interface StoreStockAllocation {
  locationId: string;
  locationName: string;
  type: "store" | "warehouse";
  quantity: number;
}

export interface ProductVariantItem {
  id: string;
  name: string;
  color?: string;
  size?: string;
  barcode?: string;
  shortcode?: string;
  inventory?: StoreStockAllocation[];
  totalStock?: number;
  salePrice?: number;
}

export interface InventoryProductItem {
  id: string;
  title: string;
  categoryName?: string;
  shortcode?: string;
  barcode?: string;
  sku?: string;
  hasVariants?: boolean;
  totalStock?: number;
  inventory?: StoreStockAllocation[];
  variants?: ProductVariantItem[];
  status?: string;
  createdAt?: string;
}

export interface LocationCol {
  id: string;
  name: string;
  type: "warehouse" | "store";
}

const PAGE_SIZE = 24;

export default function InventoryStockView() {
  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [locations, setLocations] = useState<LocationCol[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Quick Adjust Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProductItem | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<ProductVariantItem | null>(null);
  const [adjustLocationId, setAdjustLocationId] = useState<string>("");
  const [adjustQtyInput, setAdjustQtyInput] = useState<string>("");
  const [adjustMode, setAdjustMode] = useState<"set" | "add">("set");
  const [savingAdjust, setSavingAdjust] = useState<boolean>(false);

  // Fetch Locations (Warehouses + Stores)
  const fetchLocations = useCallback(async () => {
    try {
      const locs: LocationCol[] = [];

      // 1. Fetch Warehouses
      try {
        const whSnap = await getDocs(collection(db, "warehouses"));
        whSnap.forEach((d) => {
          const data = d.data();
          locs.push({
            id: d.id,
            name: data.name || "Main Warehouse",
            type: "warehouse",
          });
        });
      } catch (err) {
        console.warn("Error fetching warehouses:", err);
      }

      // 2. Fetch Stores
      try {
        const storeSnap = await getDocs(collection(db, "stores"));
        storeSnap.forEach((d) => {
          const data = d.data();
          locs.push({
            id: d.id,
            name: data.name || "Retail Store",
            type: "store",
          });
        });
      } catch (err) {
        console.warn("Error fetching stores:", err);
      }

      // Fallback defaults if database hasn't populated stores/warehouses yet
      if (locs.length === 0) {
        locs.push(
          { id: "wh_central", name: "Central Warehouse", type: "warehouse" },
          { id: "store_main", name: "MADHU CREATIONS", type: "store" }
        );
      }

      setLocations(locs);
      if (locs.length > 0 && !adjustLocationId) {
        setAdjustLocationId(locs[0].id);
      }
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }, [adjustLocationId]);

  // Fetch Total Count
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "products");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Fallback count for inventory:", err);
      try {
        const snap = await getDocs(collection(db, "products"));
        setTotalCount(snap.size);
      } catch (e) {
        console.error("Count fallback failed:", e);
      }
    }
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const coll = collection(db, "products");
      let snap;
      try {
        snap = await getDocs(query(coll, orderBy("createdAt", "desc"), limit(PAGE_SIZE)));
      } catch {
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: InventoryProductItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || "Untitled Product",
          categoryName: data.categoryName || "General",
          shortcode: data.shortcode || "",
          barcode: data.barcode || "",
          sku: data.sku || "",
          hasVariants: !!data.hasVariants,
          totalStock: data.totalStock ?? 0,
          inventory: Array.isArray(data.inventory) ? data.inventory : [],
          variants: Array.isArray(data.variants) ? data.variants : [],
          status: data.status || "Active",
          createdAt: data.createdAt || "",
        });
      });

      setProducts(items);

      // Auto-expand products with variants by default
      const withVariants = new Set<string>();
      items.forEach((p) => {
        if (p.hasVariants && p.variants && p.variants.length > 0) {
          withVariants.add(p.id);
        }
      });
      setExpandedProductIds(withVariants);
    } catch (err: unknown) {
      console.error("Error loading products for inventory:", err);
      const msg = err instanceof Error ? err.message : "Failed to load stock data";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchTotalCount();
    fetchProducts();
  }, [fetchLocations, fetchTotalCount, fetchProducts]);

  // Toggle variant rows
  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Helper to extract stock for a specific location
  const getLocationStock = (
    inventory: StoreStockAllocation[] | undefined,
    loc: LocationCol,
    fallbackTotal?: number
  ): number => {
    if (inventory && Array.isArray(inventory) && inventory.length > 0) {
      // Match by ID first, then by name
      const match = inventory.find(
        (item) => item.locationId === loc.id || item.locationName.toLowerCase() === loc.name.toLowerCase()
      );
      if (match) return match.quantity || 0;
      // If inventory has allocations for other locations, this one is 0
      const totalAllocated = inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      if (totalAllocated > 0) return 0;
    }
    // If completely unallocated and product has totalStock, show in primary warehouse
    if (fallbackTotal && fallbackTotal > 0 && locations.length > 0) {
      if (loc.id === locations[0].id) {
        return fallbackTotal;
      }
    }
    return 0;
  };

  // Calculate sum of stock across all locations for display
  const calculateTotalStock = (inventory: StoreStockAllocation[] | undefined, fallback = 0): number => {
    if (!inventory || !Array.isArray(inventory) || inventory.length === 0) return fallback;
    return inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  };

  // Categories list for filter
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.shortcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.variants?.some(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.shortcode?.toLowerCase().includes(q)
      );

    const matchesCategory =
      selectedCategory === "all" || p.categoryName === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Calculate grand total units across all loaded products
  const grandTotalUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.totalStock || 0), 0);
  }, [products]);

  // Open Adjust Modal
  const openAdjustModal = (product: InventoryProductItem, variant?: ProductVariantItem) => {
    setAdjustingProduct(product);
    setAdjustingVariant(variant || null);
    const targetInv = variant ? variant.inventory : product.inventory;
    const initialLoc = locations[0]?.id || "";
    setAdjustLocationId(initialLoc);

    const currentQty = getLocationStock(
      targetInv,
      locations.find((l) => l.id === initialLoc) || locations[0]
    );
    setAdjustQtyInput(currentQty.toString());
    setAdjustMode("set");
    setAdjustModalOpen(true);
  };

  // Save Stock Adjustment directly to Firestore
  const handleSaveStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const targetLoc = locations.find((l) => l.id === adjustLocationId);
    if (!targetLoc) {
      setToast({ type: "error", message: "Please select a valid warehouse or store" });
      return;
    }

    const inputNum = parseInt(adjustQtyInput, 10);
    if (isNaN(inputNum) || inputNum < 0) {
      setToast({ type: "error", message: "Please enter a valid non-negative quantity" });
      return;
    }

    setSavingAdjust(true);
    try {
      const productRef = doc(db, "products", adjustingProduct.id);

      if (!adjustingVariant) {
        // Simple product adjustment
        const currentInv = Array.isArray(adjustingProduct.inventory)
          ? [...adjustingProduct.inventory]
          : [];
        
        const locIndex = currentInv.findIndex(
          (i) => i.locationId === targetLoc.id || i.locationName.toLowerCase() === targetLoc.name.toLowerCase()
        );

        let newQty = inputNum;
        if (adjustMode === "add") {
          const prevQty = locIndex >= 0 ? currentInv[locIndex].quantity : 0;
          newQty = Math.max(0, prevQty + inputNum);
        }

        if (locIndex >= 0) {
          currentInv[locIndex] = {
            ...currentInv[locIndex],
            quantity: newQty,
          };
        } else {
          currentInv.push({
            locationId: targetLoc.id,
            locationName: targetLoc.name,
            type: targetLoc.type,
            quantity: newQty,
          });
        }

        const newTotalStock = currentInv.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

        await updateDoc(productRef, {
          inventory: currentInv,
          totalStock: newTotalStock,
          updatedAt: new Date().toISOString(),
        });

        // Update local state
        setProducts((prev) =>
          prev.map((p) =>
            p.id === adjustingProduct.id
              ? { ...p, inventory: currentInv, totalStock: newTotalStock }
              : p
          )
        );

        setToast({
          type: "success",
          message: `Updated ${targetLoc.name} stock to ${newQty} for "${adjustingProduct.title}"`,
        });
      } else {
        // Variant adjustment
        const updatedVariants = (adjustingProduct.variants || []).map((v) => {
          if (v.id !== adjustingVariant.id) return v;

          const currentInv = Array.isArray(v.inventory) ? [...v.inventory] : [];
          const locIndex = currentInv.findIndex(
            (i) => i.locationId === targetLoc.id || i.locationName.toLowerCase() === targetLoc.name.toLowerCase()
          );

          let newQty = inputNum;
          if (adjustMode === "add") {
            const prevQty = locIndex >= 0 ? currentInv[locIndex].quantity : 0;
            newQty = Math.max(0, prevQty + inputNum);
          }

          if (locIndex >= 0) {
            currentInv[locIndex] = {
              ...currentInv[locIndex],
              quantity: newQty,
            };
          } else {
            currentInv.push({
              locationId: targetLoc.id,
              locationName: targetLoc.name,
              type: targetLoc.type,
              quantity: newQty,
            });
          }

          const vTotal = currentInv.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          return {
            ...v,
            inventory: currentInv,
            totalStock: vTotal,
          };
        });

        const overallTotal = updatedVariants.reduce((sum, v) => sum + (v.totalStock || 0), 0);

        await updateDoc(productRef, {
          variants: updatedVariants,
          totalStock: overallTotal,
          updatedAt: new Date().toISOString(),
        });

        setProducts((prev) =>
          prev.map((p) =>
            p.id === adjustingProduct.id
              ? { ...p, variants: updatedVariants, totalStock: overallTotal }
              : p
          )
        );

        setToast({
          type: "success",
          message: `Updated ${targetLoc.name} stock for variant "${adjustingVariant.name}"`,
        });
      }

      setAdjustModalOpen(false);
    } catch (err: unknown) {
      console.error("Failed to update stock:", err);
      const msg = err instanceof Error ? err.message : "Failed to update stock in database";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingAdjust(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Stock Manager</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Inventory Stock</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {totalCount} SKUs
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Multi-Location Inventory Matrix</h1>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-800">
              {grandTotalUnits.toLocaleString()} units total
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time stock ledger across all physical warehouses, retail store outlets, and product variant SKUs
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchLocations();
              fetchTotalCount();
              fetchProducts();
              setToast({ type: "info", message: "Inventory matrix refreshed from server" });
            }}
            title="Refresh stock from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {products.length > 0 && (
            <button
              onClick={() => openAdjustModal(products[0])}
              className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Quick Stock In</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 px-4 py-2 bg-white text-xs gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by product name, 8-digit barcode, or short code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          {categoriesList.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700 focus:border-emerald-500 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Categories ({categoriesList.length})</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span>Locations: <strong className="text-zinc-800 font-semibold">{locations.length}</strong></span>
            <span className="text-zinc-300">|</span>
            <span>SKUs: <strong className="text-emerald-700 font-semibold">{totalCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Matrix Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading multi-location inventory matrix...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <Boxes className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No inventory products found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              {searchQuery ? "No items match your search filter." : "Create products in the Products Catalog to see their live inventory matrix here."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-medium z-10 whitespace-nowrap">
              <tr>
                <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                  <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                </th>
                <th className="min-w-[240px] px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  product_name <span className="text-[10px] text-zinc-400 font-sans lowercase">string</span>
                </th>
                <th className="w-36 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  barcode_id <span className="text-[10px] text-zinc-400 font-sans lowercase">8-digit</span>
                </th>
                <th className="w-28 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  short_code <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                </th>

                {/* Dynamic Columns for Warehouses and Stores */}
                {locations.map((loc) => (
                  <th
                    key={loc.id}
                    className="min-w-[130px] px-3 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-700 bg-zinc-100/50"
                  >
                    <div className="flex items-center gap-1.5">
                      {loc.type === "warehouse" ? (
                        <Warehouse className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      ) : (
                        <Store className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="truncate" title={loc.name}>
                        {loc.name}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Total Stock Column */}
                <th className="w-28 px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-900 bg-emerald-50/70">
                  total_stock <span className="text-[10px] text-emerald-700 font-sans lowercase">units</span>
                </th>

                {/* Actions */}
                <th className="w-24 px-3 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {filteredProducts.map((p) => {
                const isExpanded = expandedProductIds.has(p.id);
                const hasVariants = !!p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0;
                const pTotal = p.totalStock ?? 0;

                return (
                  <Fragment key={p.id}>
                    {/* Main Product Row */}
                    <tr className={`transition-colors hover:bg-zinc-50/80 ${hasVariants ? "bg-zinc-50/30" : ""}`}>
                      <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                        <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                      </td>

                      {/* Product Name */}
                      <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans text-zinc-900">
                        <div className="flex items-center gap-2">
                          {hasVariants && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="p-1 rounded hover:bg-zinc-200/60 text-zinc-500 cursor-pointer"
                              title={isExpanded ? "Collapse variants" : "Expand variants"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-900">{p.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-sans">
                              <span className="inline-flex items-center gap-1 text-zinc-500">
                                <Tag className="h-2.5 w-2.5" />
                                {p.categoryName || "General"}
                              </span>
                              {hasVariants && (
                                <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.2 text-[9px] font-medium">
                                  {p.variants?.length} Variants
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Barcode ID */}
                      <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-900">
                        {p.barcode ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded tracking-wider">
                            <BarcodeIcon className="h-2.5 w-2.5" />
                            <span>{p.barcode}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">No barcode</span>
                        )}
                      </td>

                      {/* Short Code */}
                      <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono">
                        {p.shortcode ? (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 border border-zinc-200 text-zinc-700 font-semibold">
                            {p.shortcode}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Each Location Column */}
                      {locations.map((loc) => {
                        if (hasVariants) {
                          // Aggregate stock across all variants for this location
                          const totalLocVariantStock = (p.variants || []).reduce(
                            (acc, v) => acc + getLocationStock(v.inventory, loc),
                            0
                          );
                          return (
                            <td
                              key={loc.id}
                              className="px-3 py-2 border-r border-zinc-200/60 font-mono text-zinc-700 font-medium"
                            >
                              <span className={totalLocVariantStock > 0 ? "text-zinc-900 font-semibold" : "text-zinc-400"}>
                                {totalLocVariantStock}
                              </span>
                            </td>
                          );
                        }

                        // Simple product stock
                        const stockInLoc = getLocationStock(p.inventory, loc, p.totalStock);
                        return (
                          <td
                            key={loc.id}
                            className="px-3 py-2 border-r border-zinc-200/60 font-mono"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustLocationId(loc.id);
                                openAdjustModal(p);
                              }}
                              className={`group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer ${
                                stockInLoc > 0 ? "text-zinc-900 font-semibold" : "text-zinc-400"
                              }`}
                              title={`Click to adjust stock at ${loc.name}`}
                            >
                              <span>{stockInLoc}</span>
                              <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-zinc-400" />
                            </button>
                          </td>
                        );
                      })}

                      {/* Total Stock */}
                      <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono bg-emerald-50/30">
                        <span
                          className={`font-bold ${
                            pTotal > 0 ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {pTotal} units
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-sans font-medium text-zinc-700 hover:bg-zinc-50 hover:text-emerald-700 transition-colors cursor-pointer"
                          title="Adjust or add stock"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Variant Sub-rows */}
                    {hasVariants &&
                      isExpanded &&
                      p.variants?.map((v) => {
                        const vTotal = v.totalStock ?? calculateTotalStock(v.inventory, 0);

                        return (
                          <tr
                            key={v.id}
                            className="bg-zinc-50/60 border-t border-zinc-100 hover:bg-zinc-100/60 transition-colors"
                          >
                            <td className="px-3 py-1.5 text-center border-r border-zinc-200/60">
                              <span className="text-zinc-300 text-[10px]">↳</span>
                            </td>

                            {/* Variant Title */}
                            <td className="px-3.5 py-1.5 pl-8 border-r border-zinc-200/60 font-sans">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-zinc-800">{v.name}</span>
                                {v.color && (
                                  <span className="rounded bg-white border border-zinc-200 px-1 text-[9px] text-zinc-600">
                                    {v.color}
                                  </span>
                                )}
                                {v.size && (
                                  <span className="rounded bg-white border border-zinc-200 px-1 text-[9px] text-zinc-600">
                                    {v.size}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Variant Barcode */}
                            <td className="px-3.5 py-1.5 border-r border-zinc-200/60 font-mono">
                              {v.barcode ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-white border border-emerald-200/60 px-1 py-0.2 rounded text-[10px]">
                                  <BarcodeIcon className="h-2 w-2" />
                                  <span>{v.barcode}</span>
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Variant Shortcode */}
                            <td className="px-3.5 py-1.5 border-r border-zinc-200/60 font-mono text-zinc-600">
                              {v.shortcode || "—"}
                            </td>

                            {/* Variant Location Stocks */}
                            {locations.map((loc) => {
                              const vLocStock = getLocationStock(v.inventory, loc, vTotal);
                              return (
                                <td
                                  key={loc.id}
                                  className="px-3 py-1.5 border-r border-zinc-200/60 font-mono"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdjustLocationId(loc.id);
                                      openAdjustModal(p, v);
                                    }}
                                    className={`group inline-flex items-center gap-1 px-1 py-0.2 rounded hover:bg-white transition-colors cursor-pointer ${
                                      vLocStock > 0 ? "text-zinc-900 font-medium" : "text-zinc-400"
                                    }`}
                                    title={`Adjust ${v.name} stock at ${loc.name}`}
                                  >
                                    <span>{vLocStock}</span>
                                    <Edit3 className="h-2 w-2 opacity-0 group-hover:opacity-100 text-zinc-400" />
                                  </button>
                                </td>
                              );
                            })}

                            {/* Variant Total */}
                            <td className="px-3.5 py-1.5 border-r border-zinc-200/60 font-mono font-bold text-zinc-900">
                              <span className={vTotal > 0 ? "text-emerald-700" : "text-rose-600"}>
                                {vTotal}
                              </span>
                            </td>

                            {/* Variant Action */}
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => openAdjustModal(p, v)}
                                className="inline-flex items-center gap-1 rounded bg-white border border-zinc-200 px-1.5 py-0.5 text-[9px] font-sans text-zinc-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors cursor-pointer"
                              >
                                <span>Adjust</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
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
          <span className="text-emerald-700 font-semibold">{totalCount} total products registered</span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-800 font-semibold">{locations.length} active locations</span>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs text-zinc-600">
          <span>Auto-synchronized with POS and Store Room</span>
        </div>
      </div>

      {/* QUICK STOCK ADJUST MODAL */}
      {adjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <PackageCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Adjust Inventory Stock
                  </h3>
                  <p className="text-[11px] text-zinc-500 truncate max-w-[260px]">
                    {adjustingProduct.title} {adjustingVariant ? `(${adjustingVariant.name})` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStockAdjust} className="p-5 space-y-4 text-xs">
              {/* Product Info Summary */}
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">Barcode ID:</span>
                  <span className="font-semibold text-emerald-700">
                    {adjustingVariant?.barcode || adjustingProduct.barcode || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-sans">Short Code:</span>
                  <span className="font-semibold text-zinc-800">
                    {adjustingVariant?.shortcode || adjustingProduct.shortcode || "—"}
                  </span>
                </div>
                {adjustingVariant && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-sans">Variant:</span>
                    <span className="font-semibold text-indigo-700">
                      {adjustingVariant.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Location Select */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Target Location (Warehouse / Store)
                </label>
                <select
                  value={adjustLocationId}
                  onChange={(e) => {
                    setAdjustLocationId(e.target.value);
                    const targetLoc = locations.find((l) => l.id === e.target.value);
                    if (targetLoc) {
                      const cur = getLocationStock(
                        adjustingVariant ? adjustingVariant.inventory : adjustingProduct.inventory,
                        targetLoc
                      );
                      setAdjustQtyInput(cur.toString());
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.type === "warehouse" ? "🏢 Warehouse: " : "🏪 Store: "}
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjust Mode */}
              <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setAdjustMode("set")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    adjustMode === "set"
                      ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Set Absolute Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode("add")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    adjustMode === "add"
                      ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  + Add Inbound Stock
                </button>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  {adjustMode === "set" ? "New Exact Stock Count" : "Quantity to Add to Current Stock"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustQtyInput}
                    onChange={(e) => setAdjustQtyInput(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                    placeholder="e.g. 50"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-zinc-400 font-mono">
                    units
                  </span>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdjust}
                  className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingAdjust ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{savingAdjust ? "Updating Stock..." : "Confirm Stock Update"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Supabase Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
