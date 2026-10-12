"use client";

import { useState } from "react";
import { Printer, CheckCircle2, Wifi, Usb, Bluetooth, RefreshCw, X, FileText, Check } from "lucide-react";
import SearchableDropdown from "./SearchableDropdown";

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (printerName: string) => void;
}

export default function PrinterModal({ isOpen, onClose, onConnected }: PrinterModalProps) {
  const [connectionType, setConnectionType] = useState<"usb" | "lan" | "bluetooth">("usb");
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [paperWidth, setPaperWidth] = useState("80mm");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("");
  const [bluetoothDevice, setBluetoothDevice] = useState("");
  const [autoCutter, setAutoCutter] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  if (!isOpen) return null;

  const handleTestPrint = () => {
    setIsTesting(true);
    setTestSuccess(false);
    setTimeout(() => {
      setIsTesting(false);
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
    }, 1200);
  };

  const handleSave = () => {
    setIsConnected(true);
    if (onConnected) onConnected(selectedPrinter);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Connect Hardware Printer</h3>
              <p className="text-xs text-zinc-500">Configure thermal receipt printer for POS billing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Connection Type Tabs */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">Connection Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConnectionType("usb")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  connectionType === "usb"
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <Usb className="h-4 w-4" />
                USB Direct
              </button>
              <button
                type="button"
                onClick={() => setConnectionType("lan")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  connectionType === "lan"
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <Wifi className="h-4 w-4" />
                Ethernet / WiFi
              </button>
              <button
                type="button"
                onClick={() => setConnectionType("bluetooth")}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  connectionType === "bluetooth"
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <Bluetooth className="h-4 w-4" />
                Bluetooth
              </button>
            </div>
          </div>

          {/* Form Details */}
          {connectionType === "usb" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Detected USB Printer</label>
                <SearchableDropdown
                  value={selectedPrinter}
                  onChange={(val) => setSelectedPrinter(val)}
                  options={[
                    { value: "TVS RP-3200 Star (ESC/POS 80mm)", label: "TVS RP-3200 Star (ESC/POS 80mm) - [Connected USB001]" },
                    { value: "EPSON TM-T88VI Thermal", label: "EPSON TM-T88VI Thermal Receipt - [Ready USB002]" },
                    { value: "Posiflex AURA-6900", label: "Posiflex AURA-6900 Series - [Available]" },
                    { value: "Generic 58mm Thermal Printer", label: "Generic 58mm Mini USB Thermal" },
                  ]}
                  placeholder="Select USB Printer..."
                />
              </div>
            </div>
          ) : connectionType === "lan" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Printer IP Address</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.150"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 font-mono focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Port</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="9100"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 font-mono focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Bluetooth Device</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <SearchableDropdown
                    value={bluetoothDevice}
                    onChange={(val) => setBluetoothDevice(val)}
                    options={[
                      { value: "RP-BT-800 (Paired - In Range)", label: "RP-BT-800 (Paired - In Range)" },
                      { value: "MPT-II Mobile POS Printer", label: "MPT-II Mobile POS Printer" },
                    ]}
                    placeholder="Select Bluetooth Device..."
                  />
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer h-[38px] shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scan
                </button>
              </div>
            </div>
          )}

          {/* Paper Width & Format */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Paper Roll Width</label>
              <div className="flex gap-2">
                {["80mm (Standard)", "58mm (Compact)"].map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setPaperWidth(width.startsWith("80") ? "80mm" : "58mm")}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      paperWidth === (width.startsWith("80") ? "80mm" : "58mm")
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {width}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Auto-Cutter Action</label>
              <SearchableDropdown
                value={autoCutter}
                onChange={(val) => setAutoCutter(val)}
                options={[
                  { value: "Full Cut After Bill", label: "Full Cut After Bill" },
                  { value: "Partial Cut", label: "Partial Cut" },
                  { value: "Do Not Cut", label: "Do Not Cut" },
                ]}
                placeholder="Select Cutter Action..."
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Test print job dispatched successfully! Hardware response: OK (ESC/POS 200).</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-500" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-zinc-500" />
            )}
            {isTesting ? "Testing..." : "Print Test Ticket"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] transition-colors cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
