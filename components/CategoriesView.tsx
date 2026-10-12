"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  FolderTree, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  FileSpreadsheet
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  description?: string;
  status?: string;
  createdAt?: string;
}

const PAGE_SIZE = 24;

export default function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Add Category Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [categoryName, setCategoryName] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>("");

  // Edit State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState<string>("");

  // Pagination Cursors stored in ref
  const pageSnapshotsRef = useRef<{ [page: number]: DocumentSnapshot }>({});

  // Fetch Total Count from Firestore
  const fetchTotalCount = useCallback(async () => {
    try {
      const coll = collection(db, "categories");
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (err) {
      console.warn("Server count fallback:", err);
      try {
        const snap = await getDocs(collection(db, "categories"));
        setTotalCount(snap.size);
      } catch (fallbackErr) {
        console.error("Fallback count failed:", fallbackErr);
      }
    }
  }, []);

  // Fetch Categories for current page (Limit 24)
  const fetchPage = useCallback(async (pageToFetch: number) => {
    setLoading(true);
    try {
      const coll = collection(db, "categories");
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
        console.warn("Ordered query fallback:", queryErr);
        snap = await getDocs(query(coll, limit(PAGE_SIZE)));
      }

      const items: Category[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          name: data.name || "Untitled Category",
          description: data.description || "—",
          status: data.status || "Active",
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      setCategories(items);

      if (snap.docs.length > 0) {
        const lastVisible = snap.docs[snap.docs.length - 1];
        pageSnapshotsRef.current[pageToFetch] = lastVisible;
      }
    } catch (err: unknown) {
      console.error("Error loading categories:", err);
      const msg = err instanceof Error ? err.message : "Failed to load categories";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load once on mount
  useEffect(() => {
    fetchTotalCount();
    fetchPage(1);
  }, [fetchTotalCount, fetchPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.max(1, Math.ceil(totalCount / PAGE_SIZE))) return;
    setCurrentPage(newPage);
    fetchPage(newPage);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setModalError("Please enter a category name");
      return;
    }

    setSaving(true);
    setModalError("");
    try {
      const createdAt = new Date().toISOString();
      const newCategoryData = {
        name: categoryName.trim(),
        status: "Active",
        createdAt,
      };

      const docRef = await addDoc(collection(db, "categories"), newCategoryData);

      // Instantly add new item to local list without full refetch
      const newCategoryItem: Category = {
        id: docRef.id,
        ...newCategoryData,
      };
      setCategories((prev) => [newCategoryItem, ...prev]);
      setTotalCount((prev) => prev + 1);

      setCategoryName("");
      setIsAddModalOpen(false);
      setToast({ type: "success", message: `Category "${newCategoryData.name}" added successfully!` });
    } catch (err: unknown) {
      console.error("Error saving category:", err);
      const msg = err instanceof Error ? err.message : "Failed to save category";
      setModalError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "categories", id), {
        name: editName.trim(),
        updatedAt: new Date().toISOString(),
      });
      // Instantly update in local state without full refetch
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, name: editName.trim() } : cat))
      );
      setEditingCategory(null);
      setEditName("");
      setToast({ type: "success", message: "Category updated successfully!" });
    } catch (err: unknown) {
      console.error("Error updating category:", err);
      const msg = err instanceof Error ? err.message : "Failed to update category";
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      // Instantly remove from local state without full refetch
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setToast({ type: "success", message: `Category "${name}" deleted.` });
    } catch (err: unknown) {
      console.error("Error deleting category:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete category";
      setToast({ type: "error", message: msg });
    }
  };

  const displayedCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-hidden bg-white select-none">
      {/* Top Header Bar matching Supabase Studio */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Product Manager</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">Categories</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {totalCount} Total
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Categories</h1>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-zinc-700">
              {totalCount} {totalCount === 1 ? "category" : "categories"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Organize products into merchandise hierarchies for POS quick-keys and taxation
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              pageSnapshotsRef.current = {};
              fetchTotalCount();
              fetchPage(currentPage);
              setToast({ type: "info", message: "Refreshed categories from server" });
            }}
            title="Refresh from Firebase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => {
              setCategoryName("");
              setModalError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] hover:bg-[#0e633d] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Table Toolbar matching Image 2 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 bg-white text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter categories by name or ID..."
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

      {/* Categories Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-400">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading categories from Firestore...</span>
          </div>
        ) : displayedCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3 border border-zinc-200">
              <FolderTree className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">No categories found</h3>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              {searchQuery ? "No categories match your search filter." : "Click 'Add Category' above to create your first category."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#107548] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0e633d] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Category</span>
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur-xs border-b border-zinc-200 text-zinc-500 font-medium">
              <tr>
                <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                  <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  id <span className="text-[10px] text-zinc-400 font-sans lowercase">uuid</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  category_name <span className="text-[10px] text-zinc-400 font-sans lowercase">string</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  status <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                  created_at <span className="text-[10px] text-zinc-400 font-sans lowercase">timestamp</span>
                </th>
                <th className="px-3.5 py-2 font-mono text-[11px] text-right uppercase tracking-wider text-zinc-600">
                  actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
              {displayedCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                    <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                  </td>

                  {/* ID */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 text-zinc-400 font-mono text-[10px]">
                    {cat.id.length > 14 ? `${cat.id.slice(0, 14)}...` : cat.id}
                  </td>

                  {/* Name (Inline editable) */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 font-sans font-medium text-zinc-900">
                    {editingCategory?.id === cat.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded border border-emerald-500 px-2 py-0.5 text-xs font-sans text-zinc-900 focus:outline-hidden"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateCategory(cat.id)}
                          className="rounded p-1 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                          title="Save"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="rounded p-1 bg-zinc-200 text-zinc-600 hover:bg-zinc-300 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{cat.name}</span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      {cat.status || "Active"}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-3.5 py-2 border-r border-zinc-200/60 text-zinc-500 text-[10px]">
                    {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-2 text-right">
                    <div className="flex items-center justify-end gap-1 font-sans">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setEditName(cat.name);
                        }}
                        className="rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                        title="Edit name"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete category"
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

      {/* Pagination Footer matching Image 2 */}
      <div className="border-t border-zinc-200 px-4 py-2 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>Page {currentPage} of {totalPages}</span>
          <span className="text-zinc-300">|</span>
          <span>{PAGE_SIZE} rows / page</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold">{totalCount} total records</span>
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

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                  <FolderTree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Add New Category</h3>
                  <p className="text-xs text-zinc-500">Save merchandise taxonomy to Firebase</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Edible Oils, Dairy Products, Beverages"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                  required
                />
              </div>

              {modalError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !categoryName.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{saving ? "Saving..." : "Save Category"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Supabase Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
