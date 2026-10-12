"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
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
  Boxes, 
  Plus, 
  Search, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Tag, 
  Image as ImageIcon, 
  Sliders,
  FileSpreadsheet
} from "lucide-react";
import BulkUploadModal from "@/components/BulkUploadModal";

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

export interface ProductItem {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  shortcode?: string;
  barcode?: string;
  sku?: string;
  media?: Array<{ url: string; sizeKB?: number }>;
  hasVariants?: boolean;
  listPrice?: number;
  salePrice?: number;
  gstRate?: number;
  taxType?: string;
  totalStock?: number;
  variants?: Array<{
    id: string;
    name: string;
    barcode?: string;
    shortcode?: string;
    salePrice: number;
    listPrice: number;
    totalStock: number;
  }>;
  status?: string;
  createdAt?: string;
}

const PAGE_SIZE = 24;

export default function ProductsView() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Upload Modal State
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState<boolean>(false);

  // Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Pagination Cursors stored in ref to prevent infinite loops
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch Total Count using getCountFromServer (0 extra document reads!)
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "products");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback for products:", err);
      try {
        const snap = await getDocs(collection(db, "products"));
        setTotalCount(snap.size);
      } catch (fallbackErr) {
        console.error("Fallback count failed:", fallbackErr);
      }
    }
  }, []);

  // Fetch Page of Products (Limit 24)
  const fetchPage = useCallback(async (pageToFetch: number) => {
    setLoading(true);
    try {
      const coll = collection(db, "products");
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
        console.warn("Ordered query fallback for products:", queryErr);
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: ProductItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || "Untitled Product",
          description: data.description || "",
          categoryId: data.categoryId || "",
          categoryName: data.categoryName || "General",
          shortcode: data.shortcode || "",
          barcode: data.barcode || "",
          sku: data.sku || "",
          media: data.media || [],
          hasVariants: data.hasVariants || false,
          listPrice: data.listPrice ?? 0,
          salePrice: data.salePrice ?? 0,
          gstRate: data.gstRate ?? 18,
          taxType: data.taxType || "inclusive",
          totalStock: data.totalStock ?? 0,
          variants: data.variants || [],
          status: data.status || "Active",
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      setProducts(items);

      if (snap.docs.length > 0) {
        pageSnapshotsRef.current[pageToFetch] = snap.docs[snap.docs.length - 1];
      }
    } catch (err: unknown) {
      console.error("Error loading products:", err);
      const msg = err instanceof Error ? err.message : "Failed to load products";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotalCount();
    fetchPage(1);
  }, [fetchTotalCount, fetchPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.max(1, Math.ceil(totalCount / PAGE_SIZE))) return;
    setCurrentPage(newPage);
    fetchPage(newPage);
  };

  const handleDeleteProduct = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete product "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setToast({ type: "success", message: `Product "${title}" deleted successfully!` });
    } catch (err: unknown) {
      console.error("Error deleting product:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete product";
      setToast({ type: "error", message: msg });
    }
  };

  const displayedProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.shortcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-white select-none">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Product Manager</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Products</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {totalCount} Total
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Products Catalog</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {totalCount} {totalCount === 1 ? "product" : "products"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Central repository for barcodes, retail prices, GST tax rates, variants, and multi-location inventory
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              pageSnapshotsRef.current = {};
              fetchTotalCount();
              fetchPage(currentPage);
              setToast({ type: "info", message: "Refreshed products from server" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Bulk Upload Button */}
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-[#107548] px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Import products in bulk from Excel or CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Bulk Upload</span>
          </button>

          {/* Add Product Button redirecting to /products/add */}
          <Link
            href="/products/add"
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Table Toolbar matching Image 2 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 bg-white text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by title, 8-digit barcode, short code, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
          <span>Limit: <strong className="text-zinc-800 font-semibold">{PAGE_SIZE} / page</strong></span>
          <span className="text-zinc-300">|</span>
          <span>Total Count: <strong className="text-emerald-700 font-semibold">{totalCount}</strong></span>
        </div>
      </div>

      {/* Products Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading products from Firestore (Limit 24)...</span>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <Boxes className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No products found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              {searchQuery ? "No products match your search filter." : "Click 'Add Product' above to create your first merchandise catalog item."}
            </p>
            {!searchQuery && (
              <Link
                href="/products/add"
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#107548] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0e633d] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Product</span>
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur-xs border-b border-zinc-200 text-zinc-500 font-medium">
              <tr>
                <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                  <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                </th>
                <th className="w-12 px-2 py-2 text-center border-r border-zinc-200/60">
                  media
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  product_title <span className="text-[10px] text-zinc-400 font-sans lowercase">string</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  category <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  type <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  sale_price <span className="text-[10px] text-zinc-400 font-sans lowercase">inr</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  stock <span className="text-[10px] text-zinc-400 font-sans lowercase">units</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  tax_gst <span className="text-[10px] text-zinc-400 font-sans lowercase">%</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  status <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {displayedProducts.map((p) => {
                const primaryImage = p.media && p.media.length > 0 ? p.media[0].url : null;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                      <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                    </td>

                    {/* Image Thumbnail */}
                    <td className="px-2 py-1.5 border-r border-zinc-200/60 text-center">
                      {primaryImage ? (
                        <img
                          src={primaryImage}
                          alt={p.title}
                          className="h-8 w-8 rounded object-cover mx-auto border border-zinc-200"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-zinc-100 border border-zinc-200 mx-auto flex items-center justify-center text-zinc-400">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </td>

                    {/* Title, Shortcode & Barcode */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans font-medium text-zinc-900">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">{p.title}</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] font-mono">
                          {p.shortcode && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.2 border border-zinc-200 text-zinc-700 font-semibold">
                              {p.shortcode}
                            </span>
                          )}
                          {p.barcode && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded tracking-wider">
                              <BarcodeIcon className="h-2.5 w-2.5" />
                              <span>{p.barcode}</span>
                            </span>
                          )}
                          {p.sku && !p.barcode && (
                            <span className="text-zinc-400">{p.sku}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans text-zinc-700">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                        <Tag className="h-3 w-3 text-zinc-400" />
                        <span>{p.categoryName || "General"}</span>
                      </span>
                    </td>

                    {/* Type: Simple or Variants */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60">
                      {p.hasVariants ? (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          <Sliders className="h-3 w-3" />
                          <span>{p.variants?.length || 0} Variants</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-zinc-100 text-zinc-600 px-1.5 py-0.5 text-[10px] font-sans font-medium">
                          Simple
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-900">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-emerald-700">₹{p.salePrice?.toFixed(2) || "0.00"}</span>
                        {p.listPrice && p.listPrice > (p.salePrice || 0) && (
                          <span className="text-[10px] text-zinc-400 line-through">₹{p.listPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono font-medium">
                      <span className={`${(p.totalStock ?? 0) > 0 ? "text-zinc-800" : "text-rose-600 font-semibold"}`}>
                        {p.totalStock ?? 0} units
                      </span>
                    </td>

                    {/* GST */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60 font-mono text-zinc-600 text-[10px]">
                      {p.gstRate}% {p.taxType === "inclusive" ? "incl." : "excl."}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2 border-r border-zinc-200/60">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        {p.status || "Active"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 font-sans">
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.title)}
                          className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete product"
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
      <div className="border-t border-zinc-200 px-4 py-2 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>Page {currentPage} of {totalPages}</span>
          <span className="text-zinc-300">|</span>
          <span>{PAGE_SIZE} rows / page</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold">{totalCount} total products</span>
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-1 font-sans">
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
        </div>
      </div>

      {/* Bulk Upload Excel Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onUploadSuccess={(importedCount) => {
          pageSnapshotsRef.current = {};
          fetchTotalCount();
          fetchPage(1);
          setCurrentPage(1);
          setToast({
            type: "success",
            message: `Successfully imported ${importedCount} products into your catalog!`,
          });
        }}
      />

      {/* Floating Supabase Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
