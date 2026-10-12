"use client";

import { useState, useRef, useTransition } from "react";
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Package, 
  Tag, 
  Layers, 
  FileText,
  Sparkles,
  ArrowRight
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  addDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { download100SampleProductsExcel, SAMPLE_100_PRODUCTS } from "@/lib/sampleProductsData";
import { generate8DigitBarcode } from "@/components/AddProductView";

interface ParsedProduct {
  title: string;
  category: string;
  sku: string;
  barcode: string;
  shortcode: string;
  listPrice: number;
  salePrice: number;
  gstRate: number;
  taxType: string;
  stock: number;
  status: string;
  description: string;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (importedCount: number) => void;
}

export default function BulkUploadModal({ isOpen, onClose, onUploadSuccess }: BulkUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
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
      await download100SampleProductsExcel();
    } catch (err) {
      console.error("Failed to download sample excel:", err);
    } finally {
      setIsDownloadingSample(false);
    }
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
        throw new Error("The selected file is empty. Please ensure your file has data rows.");
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

      const normalized: ParsedProduct[] = rawRows.map((row, index) => {
        const titleVal = getVal(row, ["Product Title", "Title", "Name", "Product Name", "product_title"]);
        const catVal = getVal(row, ["Category", "Category Name", "category"]);
        const skuVal = getVal(row, ["SKU", "sku", "Item Code", "Code"]);
        const barcodeVal = getVal(row, ["Barcode", "barcode", "Bar Code", "EAN"]);
        const shortcodeVal = getVal(row, ["Shortcode", "shortcode", "Short Code", "Code"]);
        const listPriceVal = getVal(row, ["MRP / List Price", "MRP", "List Price", "mrp", "list_price"]);
        const salePriceVal = getVal(row, ["Sale Price", "Price", "sale_price", "Selling Price"]);
        const gstVal = getVal(row, ["GST Rate (%)", "GST Rate", "GST", "gst_rate", "Tax %"]);
        const taxTypeVal = getVal(row, ["Tax Type", "Tax", "tax_type"]);
        const stockVal = getVal(row, ["Opening Stock", "Stock", "Quantity", "Qty", "opening_stock"]);
        const statusVal = getVal(row, ["Status", "status", "State"]);
        const descVal = getVal(row, ["Description", "description", "Details"]);

        // Safe numbers parsing
        const listPrice = parseFloat(String(listPriceVal ?? "0").replace(/[^0-9.]/g, "")) || 0;
        const salePrice = parseFloat(String(salePriceVal ?? "0").replace(/[^0-9.]/g, "")) || listPrice;
        const gstRate = parseFloat(String(gstVal ?? "0").replace(/[^0-9.]/g, "")) || 0;
        const stock = parseInt(String(stockVal ?? "0").replace(/[^0-9]/g, ""), 10) || 0;

        // Auto-generate barcode if blank or missing
        let cleanBarcode = String(barcodeVal || "").trim();
        if (!cleanBarcode || cleanBarcode === "undefined") {
          cleanBarcode = generate8DigitBarcode();
        }

        const title = String(titleVal || `Product ${index + 1}`).trim();
        const category = String(catVal || "General").trim();
        const sku = String(skuVal || `SKU-${Date.now().toString().slice(-6)}-${index + 1}`).trim();
        const shortcode = String(shortcodeVal || "").trim();
        const taxType = String(taxTypeVal || "inclusive").toLowerCase().includes("ex") ? "exclusive" : "inclusive";
        const status = String(statusVal || "Active").toLowerCase() === "inactive" ? "Inactive" : "Active";
        const description = String(descVal || "").trim();

        return {
          title,
          category,
          sku,
          barcode: cleanBarcode,
          shortcode,
          listPrice,
          salePrice,
          gstRate,
          taxType,
          stock,
          status,
          description,
        };
      });

      // Filter out completely blank rows
      const validRows = normalized.filter((p) => p.title.length > 0);
      if (validRows.length === 0) {
        throw new Error("No valid product rows could be extracted. Please check the column headings.");
      }

      setParsedProducts(validRows);
    } catch (err: unknown) {
      console.error("Error parsing Excel:", err);
      const msg = err instanceof Error ? err.message : "Failed to read Excel file";
      setParsingError(msg);
      setParsedProducts([]);
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

  // Perform bulk upload into Firestore using chunked writeBatch
  const handleBulkUpload = async () => {
    if (parsedProducts.length === 0 || isUploading) return;

    try {
      setIsUploading(true);
      setUploadProgress({ current: 0, total: parsedProducts.length, stage: "Syncing categories..." });

      // Step 1: Pre-fetch and synchronize categories
      const catSnap = await getDocs(collection(db, "categories"));
      const categoryMap = new Map<string, string>();
      catSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name) {
          categoryMap.set(data.name.toLowerCase().trim(), docSnap.id);
        }
      });

      // Find unique categories in parsedProducts that don't exist yet
      const missingCategories = new Set<string>();
      parsedProducts.forEach((p) => {
        const catKey = p.category.toLowerCase().trim();
        if (catKey && !categoryMap.has(catKey)) {
          missingCategories.add(p.category.trim());
        }
      });

      // Insert missing categories so category dropdowns stay completely in sync
      const nowIso = new Date().toISOString();
      for (const newCatName of Array.from(missingCategories)) {
        try {
          const newDoc = await addDoc(collection(db, "categories"), {
            name: newCatName,
            status: "Active",
            createdAt: nowIso,
          });
          categoryMap.set(newCatName.toLowerCase().trim(), newDoc.id);
        } catch (e) {
          console.warn("Could not auto-add category:", newCatName, e);
        }
      }

      // Step 2: Chunked batch uploads to Firestore
      // Firestore batch size limit is 500 operations
      const BATCH_SIZE = 350;
      const total = parsedProducts.length;
      let uploadedSoFar = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = parsedProducts.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const prodRef = doc(collection(db, "products"));
          const matchedCatId = categoryMap.get(item.category.toLowerCase().trim()) || "";

          const productDoc = {
            title: item.title,
            description: item.description,
            categoryId: matchedCatId,
            categoryName: item.category,
            shortcode: item.shortcode,
            barcode: item.barcode,
            sku: item.sku,
            media: [],
            hasVariants: false,
            listPrice: item.listPrice,
            salePrice: item.salePrice,
            gstRate: item.gstRate,
            taxType: item.taxType,
            totalStock: item.stock,
            inventory: [],
            status: item.status,
            isActive: item.status === "Active",
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          batch.set(prodRef, productDoc);
        }

        setUploadProgress({
          current: Math.min(uploadedSoFar + chunk.length, total),
          total,
          stage: `Writing batch (${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(total / BATCH_SIZE)})...`,
        });

        await batch.commit();
        uploadedSoFar += chunk.length;
      }

      onUploadSuccess(parsedProducts.length);
      onClose();
    } catch (err: unknown) {
      console.error("Bulk upload failed:", err);
      const msg = err instanceof Error ? err.message : "Bulk upload failed";
      setParsingError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Quick stats
  const uniqueCategories = new Set(parsedProducts.map((p) => p.category)).size;
  const totalOpeningStock = parsedProducts.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-linear-to-r from-zinc-50 via-white to-emerald-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-800 shadow-2xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">Bulk Upload Products</h2>
                <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.2 text-[10px] font-semibold text-emerald-800">
                  Excel & CSV
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Import complete master catalogs with barcodes, pricing, GST rates, and inventory
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sample Template Download Callout */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-emerald-50/50 to-teal-50/70 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-2xs shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  100 Master Retail Products Excel Template
                  <span className="rounded bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 text-[9px] font-mono font-semibold">
                    100 ITEMS READY
                  </span>
                </h3>
                <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed max-w-xl">
                  Download our pre-formatted sample Excel file containing <strong>100 realistic master retail products</strong> across 10 categories (Groceries, Oils, Spices, Beverages, Dairy, Snacks, Apparel & Electronics) with complete barcodes, GST, and pricing.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadSample}
              disabled={isDownloadingSample}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isDownloadingSample ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download 100 Sample Products</span>
                </>
              )}
            </button>
          </div>

          {/* File Upload Drag & Drop Area */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
              Select or Drop Excel / CSV File
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                selectedFile 
                  ? "border-emerald-500 bg-emerald-50/30" 
                  : "border-zinc-300 hover:border-emerald-500 bg-zinc-50/50 hover:bg-zinc-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center gap-2.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  selectedFile ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                }`}>
                  <UploadCloud className="h-6 w-6" />
                </div>

                {selectedFile ? (
                  <div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs font-bold text-zinc-900">{selectedFile.name}</span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium mt-1">
                      Click to choose a different file or drag and drop here
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-zinc-800">
                      Click to choose Excel file or drag & drop here
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Supports <span className="font-mono text-zinc-700">.xlsx</span>, <span className="font-mono text-zinc-700">.xls</span>, and <span className="font-mono text-zinc-700">.csv</span> files
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parsing State */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2.5 py-4 text-xs text-zinc-600 font-medium bg-zinc-50 rounded-lg border border-zinc-200">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Inspecting sheets and normalizing product columns...</span>
            </div>
          )}

          {/* Error Banner */}
          {parsingError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Import Warning / Error</p>
                <p className="text-red-700 mt-0.5">{parsingError}</p>
              </div>
            </div>
          )}

          {/* Parsed Summary and Preview Table */}
          {parsedProducts.length > 0 && !isParsing && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Products Detected</p>
                    <p className="text-base font-bold text-zinc-900 font-mono">
                      {parsedProducts.length} <span className="text-xs font-normal text-emerald-700">valid items</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Categories</p>
                    <p className="text-base font-bold text-zinc-900 font-mono">
                      {uniqueCategories} <span className="text-xs font-normal text-zinc-500">groups</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Total Opening Stock</p>
                    <p className="text-base font-bold text-zinc-900 font-mono">
                      {totalOpeningStock.toLocaleString()} <span className="text-xs font-normal text-zinc-500">units</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Catalog Preview (First 8 of {parsedProducts.length} items)</span>
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    Scroll down or click upload to import all {parsedProducts.length} items
                  </span>
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100/80 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product Title</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 font-mono">Barcode</th>
                        <th className="py-2 px-3 font-mono">SKU</th>
                        <th className="py-2 px-3 text-right">MRP</th>
                        <th className="py-2 px-3 text-right">Sale Price</th>
                        <th className="py-2 px-3 text-center">GST %</th>
                        <th className="py-2 px-3 text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {parsedProducts.slice(0, 8).map((p, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                          <td className="py-2 px-3 text-zinc-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-zinc-900 max-w-[200px] truncate" title={p.title}>
                            {p.title}
                          </td>
                          <td className="py-2 px-3 text-zinc-600">{p.category}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-emerald-700 font-semibold">{p.barcode}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-zinc-500">{p.sku}</td>
                          <td className="py-2 px-3 text-right font-mono text-zinc-500 line-through">₹{p.listPrice}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">₹{p.salePrice}</td>
                          <td className="py-2 px-3 text-center font-mono text-zinc-700">{p.gstRate}%</td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-emerald-700">{p.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar during Firestore batch upload */}
          {isUploading && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  {uploadProgress.stage}
                </span>
                <span className="font-mono font-bold text-emerald-800">
                  {uploadProgress.current} / {uploadProgress.total} Products
                </span>
              </div>
              <div className="w-full bg-emerald-200/70 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-emerald-700">
                Please wait while products and category relationships are written to Firestore in optimized batches...
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {parsedProducts.length > 0 && (
              <span className="text-xs text-zinc-600 font-mono hidden sm:inline">
                Ready: <strong>{parsedProducts.length} products</strong>
              </span>
            )}
            <button
              type="button"
              onClick={handleBulkUpload}
              disabled={parsedProducts.length === 0 || isUploading || isParsing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#107548] hover:bg-[#0e633d] text-white px-5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading {uploadProgress.current}/{uploadProgress.total}...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload {parsedProducts.length > 0 ? `${parsedProducts.length} Items` : "Items"} to Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
