"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Database, 
  Copy, 
  Check, 
  ExternalLink, 
  Server, 
  HardDrive, 
  Boxes, 
  Printer, 
  Layers, 
  FolderTree, 
  Sparkles, 
  ArrowUpRight, 
  ShieldCheck, 
  Activity, 
  CreditCard, 
  Zap,
  TrendingUp,
  RotateCw,
  QrCode,
  FileSpreadsheet
} from "lucide-react";

export default function DashboardView() {
  const [copied, setCopied] = useState(false);
  const storeEndpoint = "srk-pos-hyderabad.retail.cloud";

  const handleCopy = () => {
    navigator.clipboard.writeText(storeEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto bg-white">
      {/* Sub-header Navigation / Breadcrumb Bar matching Image 1 */}
      <div className="border-b border-zinc-200 px-6 py-3 flex items-center justify-between bg-white text-xs">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="font-semibold text-zinc-800">Project Overview</span>
          <span className="text-zinc-300">/</span>
          <span>Retail System Telemetry</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-mono font-medium text-emerald-700">All Systems Operational</span>
        </div>
      </div>

      {/* Main Studio Canvas with Dot Grid (Image 1 reference) */}
      <div className="flex-1 p-6 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Project Details Header matching Image 1 */}
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xs p-6 rounded-2xl border border-zinc-200/80 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">SRK Retail Main Branch</h1>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  ONLINE
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-xs text-zinc-500">{storeEndpoint}</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics from Image 1 */}
            <div className="grid grid-cols-3 gap-3 md:gap-6 border-t md:border-t-0 md:border-l border-zinc-100 pt-3 md:pt-0 md:pl-6">
              <div>
                <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                  COMPUTE SIZE
                </div>
                <div className="mt-1 inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-800">
                  NANO
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                  RECENT BRANCH
                </div>
                <div className="mt-1 font-mono text-xs font-medium text-zinc-700">
                  main (active)
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                  LAST BACKUP
                </div>
                <div className="mt-1 font-mono text-xs font-medium text-zinc-700">
                  12 mins ago
                </div>
              </div>
            </div>
          </div>

          {/* Central Architecture Node Card (matching Korean DB node in Image 1) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Node Card */}
            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900">Primary Retail Database</h3>
                      <span className="rounded bg-emerald-100/70 text-emerald-800 text-[10px] font-medium px-1.5 py-0.2">Healthy</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">South Asia (Hyderabad Retail Cluster)</p>
                    <p className="text-[11px] font-mono text-zinc-400">ap-south-1 · t3.nano</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  <span className="text-sm">🇮🇳</span>
                  <span>Branch #01</span>
                </div>
              </div>

              {/* Resource Bars matching Image 1 */}
              <div className="mt-6 pt-4 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                  <span className="text-zinc-400 text-[10px] block">CPU UTILIZATION</span>
                  <span className="text-zinc-800 font-bold text-sm">2.4%</span>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                  <span className="text-zinc-400 text-[10px] block">STORAGE DISK</span>
                  <span className="text-zinc-800 font-bold text-sm">15%</span>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                  <span className="text-zinc-400 text-[10px] block">MEMORY RAM</span>
                  <span className="text-zinc-800 font-bold text-sm">48%</span>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                  <span className="text-zinc-400 text-[10px] block">POS CONNECTIONS</span>
                  <span className="text-emerald-700 font-bold text-sm">4 / 50</span>
                </div>
              </div>
            </div>

            {/* Quick Status & Hardware Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Peripheral Hardware</h3>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70">
                    <div className="flex items-center gap-2">
                      <Printer className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-zinc-800">Thermal Printer</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-semibold">
                      ESC/POS Ready
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-zinc-600" />
                      <span className="font-medium text-zinc-800">Barcode Scanner</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                      HID USB Connected
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-zinc-600" />
                      <span className="font-medium text-zinc-800">UPI / Card Terminal</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                      Dynamic QR Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 mt-4">
                <Link
                  href="/products"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white py-2 text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>Open Product Catalog</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Dock Links (matching Framework, Server, Direct, ORM, MCP, API Keys in Image 1) */}
          <div className="pt-2">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-3">
              FAST ACCESS QUICK MODULES
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { title: "Products", subtitle: "Manage 1,248 items", icon: Boxes, href: "/products" },
                { title: "Categories", subtitle: "Tax & tax-slabs", icon: FolderTree, href: "/categories" },
                { title: "Variants", subtitle: "Sizes, units, packs", icon: Layers, href: "/variants" },
                { title: "POS Terminal", subtitle: "Cashier billing lane", icon: CreditCard, href: "/pos" },
                { title: "Stock Audit", subtitle: "Inventory reconciliation", icon: HardDrive, href: "/inventory" },
                { title: "Receipts", subtitle: "Thermal template setup", icon: Printer, href: "/settings" },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex flex-col p-4 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-xs transition-all text-left cursor-pointer"
                >
                  <item.icon className="h-5 w-5 text-zinc-500 group-hover:text-emerald-600 transition-colors mb-2" />
                  <span className="text-xs font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                    {item.subtitle}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
