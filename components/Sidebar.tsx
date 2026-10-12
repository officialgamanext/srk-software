"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  FolderTree, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronRight, 
  ShoppingCart, 
  Receipt, 
  Users, 
  Warehouse, 
  BarChart3, 
  Settings, 
  Sparkles, 
  FileText, 
  Activity, 
  Layers, 
  HelpCircle, 
  ExternalLink
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [productManagerOpen, setProductManagerOpen] = useState(true);
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [variantCount, setVariantCount] = useState<number | null>(null);

  // Subscribe to category & variant count updates from Firestore
  useEffect(() => {
    let unsubCat: () => void = () => {};
    let unsubVar: () => void = () => {};

    try {
      unsubCat = onSnapshot(collection(db, "categories"), (snap) => {
        setCategoryCount(snap.size);
      }, (err) => console.warn("Category listener notice:", err));

      unsubVar = onSnapshot(collection(db, "variants"), (snap) => {
        setVariantCount(snap.size);
      }, (err) => console.warn("Variant listener notice:", err));
    } catch (e) {
      console.warn("Firestore listeners error:", e);
    }

    return () => {
      unsubCat();
      unsubVar();
    };
  }, []);

  // Helper to test if a route is active
  const isActive = (path: string) => {
    if (path === "/dashboard" && (pathname === "/dashboard" || pathname === "/")) return true;
    return pathname === path || pathname?.startsWith(path + "/");
  };

  const isProductManagerActive = 
    isActive("/products") || 
    isActive("/categories") || 
    isActive("/variants");

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col justify-between h-[calc(100vh-3rem)] text-xs select-none">
      {/* Primary Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {/* Dashboard Link */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-all ${
            isActive("/dashboard")
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
        >
          <LayoutDashboard className={`h-4 w-4 shrink-0 ${isActive("/dashboard") ? "text-zinc-900" : "text-zinc-500"}`} />
          <span>Dashboard</span>
        </Link>

        {/* Product Manager Accordion */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setProductManagerOpen(!productManagerOpen)}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-all ${
              isProductManagerActive
                ? "text-zinc-900 bg-zinc-50/70"
                : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package className={`h-4 w-4 shrink-0 ${isProductManagerActive ? "text-emerald-600" : "text-zinc-500"}`} />
              <span className="font-medium">Product Manager</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="rounded bg-emerald-50 border border-emerald-200/50 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                CORE
              </span>
              {productManagerOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </div>
          </button>

          {/* Sub-items inside Product Manager Accordion */}
          {productManagerOpen && (
            <div className="mt-1 ml-4 pl-2 border-l border-zinc-200/80 space-y-0.5">
              {/* Products Sub-menu */}
              <Link
                href="/products"
                className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                  isActive("/products")
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Boxes className={`h-3.5 w-3.5 shrink-0 ${isActive("/products") ? "text-zinc-900" : "text-zinc-400"}`} />
                  <span>Products</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">1,248</span>
              </Link>

              {/* Categories Sub-menu */}
              <Link
                href="/categories"
                className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                  isActive("/categories")
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderTree className={`h-3.5 w-3.5 shrink-0 ${isActive("/categories") ? "text-zinc-900" : "text-zinc-400"}`} />
                  <span>Categories</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-mono font-medium bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50">
                  {categoryCount !== null ? categoryCount : "..."}
                </span>
              </Link>

              {/* Variants Sub-menu */}
              <Link
                href="/variants"
                className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                  isActive("/variants")
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className={`h-3.5 w-3.5 shrink-0 ${isActive("/variants") ? "text-zinc-900" : "text-zinc-400"}`} />
                  <span>Variants</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-mono font-medium bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50">
                  {variantCount !== null ? variantCount : "..."}
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Section Divider */}
        <div className="my-2 border-t border-zinc-200/80" />

        {/* Retail Operations */}
        <div className="space-y-0.5">
          <Link
            href="/pos"
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/pos")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="h-4 w-4 text-zinc-500" />
              <span>POS Terminal</span>
            </div>
            <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 text-[9px] font-semibold">
              NEW
            </span>
          </Link>

          <Link
            href="/orders"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/orders")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Receipt className="h-4 w-4 text-zinc-500" />
            <span>Orders & Bills</span>
          </Link>

          <Link
            href="/inventory"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/inventory")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Warehouse className="h-4 w-4 text-zinc-500" />
            <span>Inventory Stock</span>
          </Link>

          <Link
            href="/customers"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/customers")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <Users className="h-4 w-4 text-zinc-500" />
            <span>Customers</span>
          </Link>
        </div>

        {/* Section Divider */}
        <div className="my-2 border-t border-zinc-200/80" />

        {/* Insights & Logs */}
        <div className="space-y-0.5">
          <Link
            href="/analytics"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/analytics")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <BarChart3 className="h-4 w-4 text-zinc-500" />
            <span>Analytics</span>
          </Link>

          <Link
            href="/logs"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium cursor-pointer transition-colors ${
              isActive("/logs")
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            <FileText className="h-4 w-4 text-zinc-500" />
            <span>Audit Logs</span>
          </Link>
        </div>
      </div>

      {/* Pinned Bottom Navigation: Settings */}
      <div className="border-t border-zinc-200 p-2 space-y-1 bg-zinc-50/50">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 font-medium cursor-pointer transition-colors ${
            isActive("/settings")
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          <Settings className="h-4 w-4 text-zinc-500" />
          <span>Project Settings</span>
        </Link>
      </div>
    </aside>
  );
}
