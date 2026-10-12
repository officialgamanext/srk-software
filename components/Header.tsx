"use client";

import { useState } from "react";
import { 
  Zap, 
  ChevronDown, 
  ChevronsUpDown, 
  Search, 
  HelpCircle, 
  Bell, 
  LayoutGrid, 
  Printer, 
  LogOut, 
  User, 
  ShieldCheck, 
  Store, 
  Check, 
  ExternalLink,
  Sparkles
} from "lucide-react";

interface HeaderProps {
  onOpenPrinterModal: () => void;
  connectedPrinter?: string;
}

export default function Header({ onOpenPrinterModal, connectedPrinter = "TVS RP-3200 (ESC/POS)" }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("Main Branch (Hyderabad)");
  const [selectedEnv, setSelectedEnv] = useState("main");

  return (
    <header className="sticky top-0 z-40 flex h-12 w-full items-center justify-between border-b border-zinc-200 bg-white px-3 sm:px-4 select-none font-sans">
      {/* Left side: Brand, Breadcrumbs, Project selector, Environment, Connect Printer button */}
      <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar py-1">
        {/* Supabase-style Lightning Bolt Logo */}
        <div className="flex items-center gap-1.5 shrink-0 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#24b47e]/10 text-[#24b47e] transition-transform hover:scale-105">
            <svg 
              viewBox="0 0 24 24" 
              className="h-4 w-4 fill-current text-[#24b47e]" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Separator */}
        <span className="text-zinc-300 text-xs font-light select-none">/</span>

        {/* Organization / Brand with Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-zinc-900 tracking-tight hover:text-zinc-700 cursor-pointer transition-colors">
            SRK Retail
          </span>
          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
            POS
          </span>
        </div>

        {/* Separator */}
        <span className="text-zinc-300 text-xs font-light select-none">/</span>

        {/* Store / Project Selector Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 cursor-pointer transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-zinc-500" />
            <span className="max-w-[130px] truncate">{selectedBranch}</span>
            <ChevronsUpDown className="h-3 w-3 text-zinc-400 ml-0.5" />
          </button>

          {isProjectDropdownOpen && (
            <div 
              className="absolute left-0 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
              onClick={() => setIsProjectDropdownOpen(false)}
            >
              <div className="px-2 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Select Store Location
              </div>
              {[
                { name: "Main Branch (Hyderabad)", code: "HYD-01" },
                { name: "Retail Outlet (Secunderabad)", code: "SEC-02" },
                { name: "Warehouse Depot (Madhapur)", code: "MDP-03" },
              ].map((loc) => (
                <button
                  key={loc.code}
                  onClick={() => setSelectedBranch(loc.name)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer transition-colors"
                >
                  <span className="truncate">{loc.name}</span>
                  {selectedBranch === loc.name && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <span className="text-zinc-300 text-xs font-light select-none">/</span>

        {/* Branch / Environment with PRODUCTION badge */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100 cursor-pointer transition-colors"
          >
            <span className="font-mono text-zinc-700 font-medium">{selectedEnv}</span>
            <span className="rounded border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-700 tracking-wider uppercase">
              PRODUCTION
            </span>
            <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
          </button>

          {isBranchDropdownOpen && (
            <div 
              className="absolute left-0 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg z-50 animate-in fade-in duration-100 text-xs"
              onClick={() => setIsBranchDropdownOpen(false)}
            >
              <button
                onClick={() => setSelectedEnv("main")}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors"
              >
                <span>main (Production)</span>
                {selectedEnv === "main" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() => setSelectedEnv("staging")}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors"
              >
                <span>staging (Testing)</span>
                {selectedEnv === "staging" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            </div>
          )}
        </div>

        {/* Connect Printer Button (Supabase Pill Button Style) */}
        <button
          type="button"
          onClick={onOpenPrinterModal}
          className="group flex items-center gap-1.5 rounded-full bg-[#107548] hover:bg-[#0e633d] px-3 py-1 text-xs font-medium text-white shadow-xs transition-all active:scale-95 shrink-0 ml-1 cursor-pointer"
          title="Hardware Printer Configuration"
        >
          <Printer className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          <span>Connect Printer</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
        </button>
      </div>

      {/* Right side: Feedback, Search, Help, Notifications, Layout, Login Details Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Feedback Link */}
        <button className="hidden md:inline-flex items-center rounded-md px-2 py-1 text-xs font-normal text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer transition-colors">
          Feedback
        </button>

        {/* Search input with Ctrl+K shortcut badge */}
        <div className="relative hidden lg:flex items-center">
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-300 cursor-pointer transition-colors w-44">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-400">Search...</span>
            <kbd className="ml-auto rounded border border-zinc-200 bg-white px-1 py-0.2 text-[10px] font-mono text-zinc-400">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Help icon button */}
        <button 
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-colors"
          title="Documentation & Guides"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Notifications with indicator dot */}
        <button 
          className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </button>

        {/* Layout toggle icon */}
        <button 
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer transition-colors"
          title="Layout Mode"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>

        {/* Login Details & Profile Menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-0.5 pr-2.5 hover:border-zinc-300 cursor-pointer transition-all focus:outline-hidden"
          >
            {/* Supabase style high contrast avatar badge */}
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white uppercase">
              SK
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] font-medium leading-none text-zinc-800">SivaKrishna</span>
              <span className="text-[9px] text-zinc-400 leading-none mt-0.5">Admin</span>
            </div>
            <ChevronDown className="h-3 w-3 text-zinc-400 ml-0.5" />
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div 
              className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
              onClick={() => setIsProfileOpen(false)}
            >
              {/* User summary header */}
              <div className="border-b border-zinc-100 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-zinc-900">Arumulla SivaKrishna</p>
                  <span className="rounded bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">admin@srkretail.com</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600 bg-zinc-50 p-1.5 rounded-md border border-zinc-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Store Owner / Full Access</span>
                </div>
              </div>

              {/* Printer status pill in user drawer */}
              <div className="px-3 py-2 border-b border-zinc-100 text-[11px]">
                <div className="flex items-center justify-between text-zinc-500 mb-1">
                  <span>Hardware Printer</span>
                  <span className="text-emerald-600 font-medium">Ready</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-700">
                  <Printer className="h-3 w-3 text-zinc-400" />
                  <span className="truncate">{connectedPrinter}</span>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="py-1">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Account Settings</span>
                </button>
                <button 
                  onClick={onOpenPrinterModal}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors"
                >
                  <Printer className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Printer Preferences</span>
                </button>
              </div>

              {/* Sign out */}
              <div className="border-t border-zinc-100 pt-1">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
