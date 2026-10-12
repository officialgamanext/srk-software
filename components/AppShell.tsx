"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import PrinterModal from "./PrinterModal";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState("");

  // Prevent mouse wheel from inadvertently changing values on number inputs
  useEffect(() => {
    const handleWheel = () => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === "number"
      ) {
        document.activeElement.blur();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Supabase Header */}
      <Header 
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)} 
        connectedPrinter={connectedPrinter}
      />

      {/* Main Layout: Sidebar + Page Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Hardware Printer Configuration Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onConnected={(name) => setConnectedPrinter(name)}
      />
    </div>
  );
}
