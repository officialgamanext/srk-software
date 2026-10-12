"use client";

import { useState } from "react";
import { 
  Sparkles, 
  Layers, 
  ArrowRight, 
  Database, 
  HardDrive, 
  Cpu, 
  Boxes, 
  Sliders, 
  FolderTree, 
  Plus, 
  Filter, 
  Search, 
  Download, 
  ExternalLink, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Terminal,
  Grid3X3,
  ListFilter
} from "lucide-react";

interface ComingSoonViewProps {
  moduleName: string;
  category: string;
  path: string;
  description: string;
  badge?: string;
  itemCount?: number;
  columns?: string[];
  sampleData?: Array<Record<string, string>>;
}

export default function ComingSoonView({
  moduleName,
  category,
  path,
  description,
  badge = "COMING SOON",
  itemCount = 142,
  columns = ["id", "sku_code", "title", "category", "price", "stock_qty", "status"],
  sampleData = [
    { id: "prd_8f01a3", sku_code: "SKU-9921", title: "Organic Basmati Rice 5kg", category: "Grains & Rice", price: "₹480.00", stock_qty: "45", status: "In Stock" },
    { id: "prd_7c12b9", sku_code: "SKU-9922", title: "Premium Sunflower Oil 1L", category: "Oils & Ghee", price: "₹165.00", stock_qty: "120", status: "In Stock" },
    { id: "prd_4e98f0", sku_code: "SKU-9923", title: "Whole Wheat Atta 10kg", category: "Flours", price: "₹420.00", stock_qty: "18", status: "Low Stock" },
    { id: "prd_2a66d5", sku_code: "SKU-9924", title: "Tata Salt Crystal 1kg", category: "Spices & Seasoning", price: "₹28.00", stock_qty: "210", status: "In Stock" },
    { id: "prd_1b44c8", sku_code: "SKU-9925", title: "Brooke Bond Red Label Tea 500g", category: "Beverages", price: "₹295.00", stock_qty: "0", status: "Out of Stock" },
  ]
}: ComingSoonViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "table">("overview");
  const [searchFilter, setSearchFilter] = useState("");

  const filteredData = sampleData.filter((row) => 
    Object.values(row).some((val) => val.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto bg-zinc-50/50">
      {/* Sub-header Navigation / Breadcrumb Bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>{category}</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-800">{moduleName}</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700">
              {badge}
            </span>
          </div>
          <h1 className="text-lg font-bold text-zinc-900 tracking-tight">{moduleName}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>

        {/* View Mode Switcher and Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Supabase segmented tab pills */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Overview & Architecture
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
                activeTab === "table"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Table Preview (Studio View)
            </button>
          </div>

          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs transition-colors cursor-pointer">
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            <span>Export Schema</span>
          </button>

          <button className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0e633d] shadow-xs transition-colors cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            <span>Add New Entry</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {activeTab === "overview" ? (
        /* Image 1 Design: Dot Matrix Canvas + Architectural Cards */
        <div className="flex-1 p-6 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] overflow-auto">
          {/* Status & Metrics Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider mb-1">
                ENDPOINT ROUTE
              </div>
              <div className="font-mono text-xs font-semibold text-zinc-800 truncate">{path}</div>
              <div className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Active Routing Listener</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider mb-1">
                STORAGE STATUS
              </div>
              <div className="text-xs font-semibold text-zinc-800">IndexedDB + Cloud Sync</div>
              <div className="text-[11px] text-zinc-500 mt-2">Offline-first local cache</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider mb-1">
                CACHE REPLICAS
              </div>
              <div className="text-xs font-semibold text-zinc-800">Local POS Cache (Active)</div>
              <div className="text-[11px] text-zinc-500 mt-2">Zero billing latency</div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider mb-1">
                HARDWARE PRINTER
              </div>
              <div className="text-xs font-semibold text-zinc-800">ESC/POS Thermal 80mm</div>
              <div className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                <span>Auto-cutter Enabled</span>
              </div>
            </div>
          </div>

          {/* Central Feature Card Matching Supabase Canvas Node (Image 1) */}
          <div className="flex flex-col items-center justify-center py-10">
            {/* Supabase Database Node Mockup (Korean flag / Node in Image 1) */}
            <div className="relative group w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-md transition-all hover:shadow-lg hover:border-zinc-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{moduleName} Node</h3>
                    <p className="text-xs text-zinc-500">Retail Microservice · Main Production</p>
                  </div>
                </div>
                {/* Location Badge */}
                <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                  <span>🇮🇳</span>
                  <span>India (Hyderabad)</span>
                </div>
              </div>

              {/* Hardware Performance Metrics from Screenshot */}
              <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>CPU 1.8%</span>
                <span className="text-zinc-300">·</span>
                <span>DISK 12%</span>
                <span className="text-zinc-300">·</span>
                <span>RAM 38%</span>
                <span className="text-zinc-300">·</span>
                <span className="text-emerald-600 font-medium">Synced: 0ms</span>
              </div>
            </div>

            {/* Coming Soon Announcement Callout */}
            <div className="mt-8 text-center max-w-md">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-2xs mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Module Interface in Staging</span>
              </div>
              <h2 className="text-base font-semibold text-zinc-900">
                {moduleName} Management is Ready for Data
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                The core layout, breadcrumbs, hardware printer bridge, and navigation routes are configured. Switch to the <strong>Table Preview</strong> tab above to view the live schema and sample rows.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Image 2 Design: Supabase Table Editor View */
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Table Editor Toolbar matching Image 2 */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 bg-white text-xs">
            {/* Search filter input */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter by id, title, category, or status..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Filter actions matching Image 2 */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                <ListFilter className="h-3.5 w-3.5 text-zinc-500" />
                <span>Sort</span>
              </button>
              <div className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold">2</span>
                <span>RLS policies</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600">
                <span>Role</span>
                <span className="font-mono font-medium text-zinc-800">retail_admin</span>
              </div>
              <button className="flex items-center gap-1 rounded-md bg-[#107548] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0e633d] cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                <span>Insert Row</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-50/90 backdrop-blur-xs border-b border-zinc-200 text-zinc-500 font-medium">
                <tr>
                  <th className="w-10 px-3 py-2 text-center border-r border-zinc-200/60">
                    <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                  </th>
                  {columns.map((col) => (
                    <th key={col} className="px-3.5 py-2 font-mono text-[11px] border-r border-zinc-200/60 uppercase tracking-wider text-zinc-600">
                      <div className="flex items-center justify-between">
                        <span>{col}</span>
                        <span className="text-[10px] text-zinc-400 font-sans lowercase">text</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-700">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-3 py-2 text-center border-r border-zinc-200/60">
                      <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 cursor-pointer" />
                    </td>
                    {columns.map((col) => (
                      <td key={col} className="px-3.5 py-2 border-r border-zinc-200/60 truncate max-w-[200px]">
                        {col === "status" ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                            row[col] === "In Stock" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                              : row[col] === "Low Stock"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : "bg-rose-50 text-rose-700 border border-rose-200/60"
                          }`}>
                            {row[col]}
                          </span>
                        ) : (
                          row[col] || "—"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar matching Image 2 */}
          <div className="border-t border-zinc-200 px-4 py-2 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span>Page 1 of 1</span>
              <span className="text-zinc-300">|</span>
              <span>100 rows</span>
              <span className="text-zinc-300">|</span>
              <span>{filteredData.length} records displayed</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="rounded px-2 py-0.5 bg-white border border-zinc-200 text-zinc-700 cursor-pointer">Data View</span>
              <span className="rounded px-2 py-0.5 text-zinc-500 hover:text-zinc-800 cursor-pointer">Definition</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
