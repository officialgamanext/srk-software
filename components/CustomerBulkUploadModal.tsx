"use client";

import { useState, useRef } from "react";
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Users, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  collection, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  download50SampleCustomersExcel, 
  SAMPLE_50_CUSTOMERS, 
  type ExcelCustomerRow 
} from "@/lib/sampleCustomersData";
import { CustomerItem } from "@/components/CustomersView";

interface CustomerBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (importedCount: number) => void;
}

export default function CustomerBulkUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: CustomerBulkUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCustomers, setParsedCustomers] = useState<Omit<CustomerItem, "id">[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: "",
  });
  const [isDownloadingSample, setIsDownloadingSample] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Download Sample Excel
  const handleDownloadSample = async () => {
    try {
      setIsDownloadingSample(true);
      await download50SampleCustomersExcel();
    } catch (err) {
      console.error("Failed to download sample excel:", err);
    } finally {
      setIsDownloadingSample(false);
    }
  };

  // Helper to load 50 dummy customers directly for 1-click test import
  const handleLoad50DemoData = () => {
    setParsingError(null);
    setSelectedFile(null);

    const mapped = SAMPLE_50_CUSTOMERS.map((row) => ({
      customerCode: row["Customer Code"],
      customerName: row["Customer Name"],
      mobile: row["Mobile"],
      city: row["City"],
      cardNo: row["CardNo"],
      validity: row["Validity"],
      address: row["Address"],
      entryDate: row["EntryDate"],
      pin: row["Pin"],
      email: row["Email"],
      tin: row["TIN"],
      branch: row["Branch"] || "MADHU CREATIONS",
      ledger: row["Ledger"] || "SUNDRY DEBTORS",
      stopCredit: String(row["Stop Credit"]).toLowerCase() === "yes",
      opCreditBalance: Number(row["Op Credit Balance"]) || 0,
      creditDays: Number(row["Credit Days"]) || 0,
      creditLimit: Number(row["Credit Limit"]) || 0,
      group: row["Group"] || "General Retail",
      classification: row["Classification"] || "Regular",
      landLine: row["LandLine"] || "",
      billCycle: Number(row["Bill Cycle"]) || 1,
      opSales: Number(row["Op Sales"]) || 0,
      remarks: row["Remarks"] || "",
      gstNo: row["GST No"] || "",
      placeOfSupply: row["Place of Supply"] || "37-Andhra Pradesh",
      discountPercent: Number(row["Disc %"]) || 0,
      applyDiscountOnNonDisc: String(row["Apply Discount on Non-Disc"]).toLowerCase() === "yes",
      inactive: String(row["Status"]).toLowerCase() === "inactive",
      blockTSMS: String(row["Block T-SMS"]).toLowerCase() === "yes",
      blockPSMS: String(row["Block P-SMS"]).toLowerCase() === "yes",
      blockWA: String(row["Block WA"]).toLowerCase() === "yes",
      dontFollowup: String(row["Dont Followup"]).toLowerCase() === "yes",
      hasBirthDate: false,
      hasAnniversary: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    setParsedCustomers(mapped);
  };

  // Helper to parse any selected Excel or CSV file
  const processFile = async (file: File) => {
    setParsingError(null);
    setIsParsing(true);
    setSelectedFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("No worksheets found in this Excel file.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      if (rawRows.length === 0) {
        throw new Error("The selected file is empty. Please ensure your file has customer rows.");
      }

      // Normalization helper: Find value matching case-insensitive key patterns
      const getVal = (row: Record<string, unknown>, keys: string[]): unknown => {
        const rowKeys = Object.keys(row);
        for (const targetKey of keys) {
          const matched = rowKeys.find(
            (k) => k.trim().toLowerCase() === targetKey.trim().toLowerCase()
          );
          if (matched && row[matched] !== undefined && row[matched] !== "") {
            return row[matched];
          }
        }
        return undefined;
      };

      const normalized: Omit<CustomerItem, "id">[] = rawRows.map((row, index) => {
        const codeVal = getVal(row, ["Customer Code", "Code", "customer_code", "Cust Code"]);
        const nameVal = getVal(row, ["Customer Name", "Name", "customer_name", "Full Name"]);
        const mobVal = getVal(row, ["Mobile", "mobile", "Phone", "Mobile Number"]);
        const cityVal = getVal(row, ["City", "city", "Town"]);
        const cardVal = getVal(row, ["CardNo", "card_no", "Card", "Card Number"]);
        const validityVal = getVal(row, ["Validity", "validity", "Card Validity", "Expiry"]);
        const addrVal = getVal(row, ["Address", "address", "Location"]);
        const entryVal = getVal(row, ["EntryDate", "entry_date", "Date"]);
        const pinVal = getVal(row, ["Pin", "pin", "Pincode", "Zip"]);
        const emailVal = getVal(row, ["Email", "email", "Mail"]);
        const tinVal = getVal(row, ["TIN", "tin"]);
        const branchVal = getVal(row, ["Branch", "branch", "Store"]);
        const ledgerVal = getVal(row, ["Ledger", "ledger"]);
        const stopCreditVal = getVal(row, ["Stop Credit", "stop_credit", "Block Credit"]);
        const opCreditVal = getVal(row, ["Op Credit Balance", "Credit Balance", "Opening Credit", "op_credit_balance"]);
        const creditDaysVal = getVal(row, ["Credit Days", "credit_days", "Days"]);
        const creditLimitVal = getVal(row, ["Credit Limit", "credit_limit", "Limit"]);
        const groupVal = getVal(row, ["Group", "group", "Customer Group"]);
        const classVal = getVal(row, ["Classification", "classification", "Tier"]);
        const landVal = getVal(row, ["LandLine", "landline", "Phone 2"]);
        const billCycleVal = getVal(row, ["Bill Cycle", "bill_cycle"]);
        const opSalesVal = getVal(row, ["Op Sales", "op_sales", "Opening Sales"]);
        const remarksVal = getVal(row, ["Remarks", "remarks", "Notes"]);
        const gstVal = getVal(row, ["GST No", "gst_no", "GSTIN", "GST"]);
        const posVal = getVal(row, ["Place of Supply", "Pl Of Supp", "place_of_supply", "State"]);
        const discVal = getVal(row, ["Disc %", "discount", "disc_percent"]);
        const applyNonDiscVal = getVal(row, ["Apply Discount on Non-Disc", "apply_discount_on_non_disc"]);
        const statusVal = getVal(row, ["Status", "status"]);
        const blockTSMSVal = getVal(row, ["Block T-SMS", "block_t_sms"]);
        const blockPSMSVal = getVal(row, ["Block P-SMS", "block_p_sms"]);
        const blockWAVal = getVal(row, ["Block WA", "block_wa"]);
        const dontFollowVal = getVal(row, ["Dont Followup", "dont_followup"]);

        const customerCode = String(codeVal || `MC${8500 + index + 1}`).trim().toUpperCase();
        const customerName = String(nameVal || `Customer ${index + 1}`).trim();
        const mobile = String(mobVal || "—").trim();
        const city = String(cityVal || "VIJAYAWADA").trim().toUpperCase();
        const cardNo = String(cardVal || "").trim();
        const validity = String(validityVal || "2500-01-01").trim();
        const address = String(addrVal || "").trim();
        const entryDate = String(entryVal || "2026-10-06").trim();
        const pin = String(pinVal || "").trim();
        const email = String(emailVal || "").trim();
        const tin = String(tinVal || "").trim();
        const branch = String(branchVal || "MADHU CREATIONS").trim();
        const ledger = String(ledgerVal || "SUNDRY DEBTORS").trim();

        const stopCredit = String(stopCreditVal || "").toLowerCase() === "yes" || String(stopCreditVal || "").toLowerCase() === "true";
        const opCreditBalance = parseFloat(String(opCreditVal || "0").replace(/[^0-9.]/g, "")) || 0;
        const creditDays = parseInt(String(creditDaysVal || "0").replace(/[^0-9]/g, ""), 10) || 0;
        const creditLimit = parseFloat(String(creditLimitVal || "0").replace(/[^0-9.]/g, "")) || 0;

        const group = String(groupVal || "General Retail").trim();
        const classification = String(classVal || "Regular").trim();
        const landLine = String(landVal || "").trim();
        const billCycle = parseInt(String(billCycleVal || "1").replace(/[^0-9]/g, ""), 10) || 1;
        const opSales = parseFloat(String(opSalesVal || "0").replace(/[^0-9.]/g, "")) || 0;
        const remarks = String(remarksVal || "").trim();
        const gstNo = String(gstVal || "").trim().toUpperCase();
        const placeOfSupply = String(posVal || "37-Andhra Pradesh").trim();
        const discountPercent = parseFloat(String(discVal || "0").replace(/[^0-9.]/g, "")) || 0;
        const applyDiscountOnNonDisc = String(applyNonDiscVal || "").toLowerCase() === "yes";

        const inactive = String(statusVal || "").toLowerCase() === "inactive";
        const blockTSMS = String(blockTSMSVal || "").toLowerCase() === "yes";
        const blockPSMS = String(blockPSMSVal || "").toLowerCase() === "yes";
        const blockWA = String(blockWAVal || "").toLowerCase() === "yes";
        const dontFollowup = String(dontFollowVal || "").toLowerCase() === "yes";

        return {
          customerCode,
          customerName,
          mobile,
          city,
          cardNo,
          validity,
          address,
          entryDate,
          pin,
          email,
          tin,
          branch,
          ledger,
          stopCredit,
          opCreditBalance,
          creditDays,
          creditLimit,
          group,
          classification,
          landLine,
          billCycle,
          opSales,
          remarks,
          gstNo,
          placeOfSupply,
          discountPercent,
          applyDiscountOnNonDisc,
          inactive,
          blockTSMS,
          blockPSMS,
          blockWA,
          dontFollowup,
          hasBirthDate: false,
          hasAnniversary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      const validRows = normalized.filter((c) => c.customerName.length > 0);
      if (validRows.length === 0) {
        throw new Error("No valid customer rows could be extracted. Please check column headers.");
      }

      setParsedCustomers(validRows);
    } catch (err: unknown) {
      console.error("Error parsing Excel:", err);
      const msg = err instanceof Error ? err.message : "Failed to read Excel file";
      setParsingError(msg);
      setParsedCustomers([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      processFile(file);
    } else if (file) {
      setParsingError("Please drop an Excel (.xlsx, .xls) or CSV file.");
    }
  };

  // Perform bulk upload into Firestore using chunked writeBatch (500 max per batch)
  const handleUploadToFirestore = async () => {
    if (parsedCustomers.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: parsedCustomers.length, stage: "Starting import..." });

    try {
      const BATCH_SIZE = 450;
      const customersColl = collection(db, "customers");
      const total = parsedCustomers.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = parsedCustomers.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const customer of chunk) {
          const newDocRef = doc(customersColl);
          batch.set(newDocRef, {
            ...customer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        setUploadProgress({
          current: Math.min(i + chunk.length, total),
          total,
          stage: `Writing batch (${Math.min(i + chunk.length, total)} of ${total})...`,
        });

        await batch.commit();
      }

      setUploadProgress({ current: total, total, stage: "Completed successfully!" });
      onUploadSuccess(total);
      onClose();
    } catch (err: unknown) {
      console.error("Error in bulk customer upload:", err);
      const msg = err instanceof Error ? err.message : "Bulk upload failed";
      setParsingError(`Upload error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                Bulk Customer Import
                <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono px-2 py-0.5 font-semibold">
                  Excel / CSV
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                Upload customer spreadsheets or load 50 pre-built demo customer profiles in 1 click
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>Need sample data? Download the pre-formatted Excel template or quick-load 50 demo records:</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                disabled={isDownloadingSample}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>{isDownloadingSample ? "Downloading..." : "Download Sample Excel"}</span>
              </button>

              <button
                type="button"
                onClick={handleLoad50DemoData}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Quick-Load 50 Demo Customers</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-50 hover:border-emerald-500 transition-all cursor-pointer group text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 group-hover:scale-105 transition-transform mb-3 border border-emerald-200/50">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-800">
              {selectedFile ? selectedFile.name : "Choose an Excel (.xlsx, .xls) or CSV file"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Drag and drop your spreadsheet here or click to browse from computer
            </p>
          </div>

          {/* Error Notice */}
          {parsingError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{parsingError}</span>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-emerald-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  {uploadProgress.stage}
                </span>
                <span className="font-mono">
                  {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedCustomers.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Ready to Import: {parsedCustomers.length} Customers
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-500">Previewing first 10 rows</span>
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3 font-sans">Name</th>
                      <th className="py-2 px-3">Mobile</th>
                      <th className="py-2 px-3 font-sans">City</th>
                      <th className="py-2 px-3">Card No</th>
                      <th className="py-2 px-3">Op Credit</th>
                      <th className="py-2 px-3 font-sans">Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {parsedCustomers.slice(0, 10).map((c, i) => (
                      <tr key={i} className="hover:bg-zinc-50/80">
                        <td className="py-2 px-3 font-semibold text-zinc-800">{c.customerCode}</td>
                        <td className="py-2 px-3 font-sans text-zinc-900">{c.customerName}</td>
                        <td className="py-2 px-3 text-zinc-600">{c.mobile}</td>
                        <td className="py-2 px-3 font-sans text-zinc-700">{c.city}</td>
                        <td className="py-2 px-3 text-zinc-600">{c.cardNo || "—"}</td>
                        <td className="py-2 px-3 text-emerald-700 font-semibold">₹{c.opCreditBalance}</td>
                        <td className="py-2 px-3 font-sans text-zinc-500">{c.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-6 py-3.5">
          <div className="text-xs text-zinc-500">
            {parsedCustomers.length > 0 
              ? `${parsedCustomers.length} customer records prepared for Firestore batch write`
              : "Select a file or click 'Quick-Load 50 Demo Customers' to proceed"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadToFirestore}
              disabled={isUploading || parsedCustomers.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isUploading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{isUploading ? "Importing to Firestore..." : `Import ${parsedCustomers.length} Customers`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
