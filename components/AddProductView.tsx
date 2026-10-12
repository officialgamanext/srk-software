"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  collection, 
  getDocs, 
  addDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast, { type ToastMessage } from "@/components/Toast";
import SearchableDropdown, { type DropdownOption } from "@/components/SearchableDropdown";
import CustomDateTimePicker from "@/components/CustomDateTimePicker";
import { compressImageTo60KB } from "@/lib/imageCompressor";
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  Plus, 
  Check, 
  RefreshCw, 
  Image as ImageIcon, 
  Store, 
  Warehouse, 
  Layers, 
  Tag, 
  Sliders, 
  Boxes, 
  X,
  Hash,
  Palette,
  Sparkles
} from "lucide-react";

// Inline Barcode Icon for clean POS branding
function BarcodeIcon({ className = "h-4 w-4" }: { className?: string }) {
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

// Generate an 8-digit numeric unique barcode (10000000 to 99999999)
export function generate8DigitBarcode(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (10000000 + (array[0] % 90000000)).toString();
  }
  return (10000000 + Math.floor(Date.now() % 90000000)).toString();
}

export interface StoreStockAllocation {
  locationId: string;
  locationName: string;
  type: "store" | "warehouse";
  quantity: number;
}

export interface VariantRow {
  id: string;
  combinationName: string;
  color?: string;
  size?: string;
  attributes?: { [key: string]: string };
  barcode: string; // 8-digit numeric barcode (non-editable)
  shortcode: string;
  listPrice: string;
  salePrice: string;
  gstRate: string;
  taxType: "inclusive" | "exclusive" | "";
  inventory: StoreStockAllocation[];
  totalStock: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
  type: "store" | "warehouse";
  address?: string;
}

// GST Options for Searchable Dropdowns
const GST_OPTIONS: DropdownOption[] = [
  { value: "0", label: "0% GST", sublabel: "Nil rated / Exempt" },
  { value: "3", label: "3% GST", sublabel: "Gold / Precious metals" },
  { value: "5", label: "5% GST", sublabel: "Apparel / Essentials" },
  { value: "12", label: "12% GST", sublabel: "Standard processed foods" },
  { value: "18", label: "18% GST", sublabel: "General merchandise standard rate" },
  { value: "28", label: "28% GST", sublabel: "Luxury / Premium goods" },
];

const TAX_TYPE_OPTIONS: DropdownOption[] = [
  { value: "inclusive", label: "Tax Inclusive", sublabel: "Retail MRP already includes GST" },
  { value: "exclusive", label: "Tax Exclusive", sublabel: "GST added on top at POS checkout" },
];

export default function AddProductView() {
  const router = useRouter();

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Form Basic Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [shortcode, setShortcode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sku, setSku] = useState("");
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // Media state
  const [uploadedImages, setUploadedImages] = useState<
    Array<{ url: string; fileId?: string; name: string; sizeKB: number }>
  >([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");

  // Variants Toggle
  const [hasVariants, setHasVariants] = useState(false);

  // Simple Product Pricing & Tax - NO PREBUILT DEFAULTS
  const [simpleListPrice, setSimpleListPrice] = useState("");
  const [simpleSalePrice, setSimpleSalePrice] = useState("");
  const [simpleGstRate, setSimpleGstRate] = useState("");
  const [simpleTaxType, setSimpleTaxType] = useState<"inclusive" | "exclusive" | "">("");
  const [simpleInventory, setSimpleInventory] = useState<StoreStockAllocation[]>([]);

  // Flexible Color & Size Variant Matrix:
  // Starts completely EMPTY - NO PREBUILT COLORS OR SIZES!
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorSizesMap, setColorSizesMap] = useState<{ [color: string]: string[] }>({});

  // Inputs for adding new color or size
  const [newColorInput, setNewColorInput] = useState("");
  const [newSizeInput, setNewSizeInput] = useState("");

  // Bulk price setter for variants
  const [bulkListPrice, setBulkListPrice] = useState("");
  const [bulkSalePrice, setBulkSalePrice] = useState("");
  const [bulkGstRate, setBulkGstRate] = useState("");

  // Variant Rows
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Inventory Modal State
  const [allLocations, setAllLocations] = useState<LocationOption[]>([]);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [inventoryTargetVariantId, setInventoryTargetVariantId] = useState<string | null>(null);
  const [currentAllocations, setCurrentAllocations] = useState<{ [locationId: string]: number }>({});

  // Global Submit state
  const [savingProduct, setSavingProduct] = useState(false);

  // Fetch Categories, Stores & Warehouses from Firestore
  useEffect(() => {
    async function loadMasterData() {
      try {
        const catSnap = await getDocs(collection(db, "categories"));
        const catList: CategoryOption[] = [];
        catSnap.forEach((doc) => {
          catList.push({ id: doc.id, name: doc.data().name || "Unnamed Category" });
        });
        setCategories(catList);
        // Do NOT select any category by default

        const storesSnap = await getDocs(collection(db, "stores"));
        const locList: LocationOption[] = [];
        storesSnap.forEach((doc) => {
          locList.push({
            id: doc.id,
            name: doc.data().name || "Store",
            type: "store",
            address: doc.data().address,
          });
        });

        const warehousesSnap = await getDocs(collection(db, "warehouses"));
        warehousesSnap.forEach((doc) => {
          locList.push({
            id: doc.id,
            name: doc.data().name || "Warehouse",
            type: "warehouse",
            address: doc.data().address,
          });
        });

        setAllLocations(locList);
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    }

    loadMasterData();
  }, []);

  // Sync variant rows when colorSizesMap changes while preserving existing prices & inventory
  const syncVariantRows = useCallback((map: { [color: string]: string[] }) => {
    setVariantRows((prevRows) => {
      const existingMap = new Map<string, VariantRow>();
      prevRows.forEach((r) => {
        existingMap.set(r.combinationName, r);
      });

      const usedBarcodes = new Set<string>();
      if (barcode) usedBarcodes.add(barcode);
      prevRows.forEach((r) => usedBarcodes.add(r.barcode));

      const newRows: VariantRow[] = [];

      Object.entries(map).forEach(([color, colorSizes]) => {
        colorSizes.forEach((size) => {
          const comboName = `${color} / ${size}`;
          if (existingMap.has(comboName)) {
            newRows.push(existingMap.get(comboName)!);
          } else {
            let varBarcode = generate8DigitBarcode();
            while (usedBarcodes.has(varBarcode)) {
              varBarcode = generate8DigitBarcode();
            }
            usedBarcodes.add(varBarcode);

            const varShortcode = shortcode 
              ? `${shortcode}-${color.slice(0, 3).toUpperCase()}-${size}` 
              : `${color.slice(0, 3).toUpperCase()}-${size}`;

            newRows.push({
              id: `var_${Date.now()}_${color}_${size}`,
              combinationName: comboName,
              color,
              size,
              attributes: { Color: color, Size: size },
              barcode: varBarcode,
              shortcode: varShortcode,
              listPrice: simpleListPrice || bulkListPrice || "",
              salePrice: simpleSalePrice || bulkSalePrice || "",
              gstRate: simpleGstRate || bulkGstRate || "",
              taxType: (simpleTaxType as "inclusive" | "exclusive" | "") || "",
              inventory: [],
              totalStock: 0,
            });
          }
        });
      });

      return newRows;
    });
  }, [barcode, shortcode, simpleListPrice, simpleSalePrice, simpleGstRate, simpleTaxType, bulkListPrice, bulkSalePrice, bulkGstRate]);

  // Initial client mount: generate barcode
  useEffect(() => {
    setBarcode(generate8DigitBarcode());
  }, []);

  // Toggle a specific size under a specific color
  const handleToggleColorSize = (color: string, size: string) => {
    setColorSizesMap((prev) => {
      const currentSizes = prev[color] || [];
      const updatedSizes = currentSizes.includes(size)
        ? currentSizes.filter((s) => s !== size)
        : [...currentSizes, size];

      const newMap = { ...prev, [color]: updatedSizes };
      syncVariantRows(newMap);
      return newMap;
    });
  };

  // Add new color
  const handleAddColor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newColorInput.trim();
    if (!trimmed) return;
    if (colors.includes(trimmed)) {
      setToast({ type: "info", message: `Color "${trimmed}" is already added` });
      return;
    }
    const updatedColors = [...colors, trimmed];
    setColors(updatedColors);
    setColorSizesMap((prev) => ({ ...prev, [trimmed]: [] }));
    setNewColorInput("");
    setToast({ type: "success", message: `Added color "${trimmed}". Now select or add sizes for it.` });
  };

  // Remove a color entirely
  const handleRemoveColor = (colorToRemove: string) => {
    setColors((prev) => prev.filter((c) => c !== colorToRemove));
    setColorSizesMap((prev) => {
      const copy = { ...prev };
      delete copy[colorToRemove];
      syncVariantRows(copy);
      return copy;
    });
  };

  // Add new master size
  const handleAddSize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSizeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (sizes.includes(trimmed)) {
      setToast({ type: "info", message: `Size "${trimmed}" is already added` });
      return;
    }
    setSizes((prev) => [...prev, trimmed]);
    setNewSizeInput("");
  };

  // Quick preset helper to add common apparel sizes
  const handleAddCommonSizesPreset = () => {
    const common = ["S", "M", "L", "XL", "XXL"];
    const merged = Array.from(new Set([...sizes, ...common]));
    setSizes(merged);
    setToast({ type: "info", message: "Added common apparel sizes (S, M, L, XL, XXL)" });
  };

  // Quick preset helper to add common footwear sizes
  const handleAddFootwearSizesPreset = () => {
    const common = ["6", "7", "8", "9", "10", "11"];
    const merged = Array.from(new Set([...sizes, ...common]));
    setSizes(merged);
    setToast({ type: "info", message: "Added standard footwear sizes (6 to 11)" });
  };

  // Select all sizes for a color
  const handleSelectAllSizesForColor = (color: string) => {
    setColorSizesMap((prev) => {
      const newMap = { ...prev, [color]: [...sizes] };
      syncVariantRows(newMap);
      return newMap;
    });
  };

  // Clear all sizes for a color
  const handleClearAllSizesForColor = (color: string) => {
    setColorSizesMap((prev) => {
      const newMap = { ...prev, [color]: [] };
      syncVariantRows(newMap);
      return newMap;
    });
  };

  // Bulk apply prices to all variant rows
  const handleApplyBulkPrices = () => {
    if (!bulkSalePrice && !bulkListPrice) {
      setToast({ type: "info", message: "Please enter list or sale price to apply" });
      return;
    }
    setVariantRows((prev) =>
      prev.map((r) => ({
        ...r,
        listPrice: bulkListPrice || r.listPrice,
        salePrice: bulkSalePrice || r.salePrice,
        gstRate: bulkGstRate || r.gstRate,
      }))
    );
    setToast({
      type: "success",
      message: `Applied prices to all ${variantRows.length} variant combinations!`,
    });
  };

  // Add a manual custom variant row
  const handleAddCustomVariantRow = () => {
    const customName = prompt("Enter custom variant name (e.g. 'Red / Free Size' or 'Navy / Cotton / Special'):");
    if (!customName || !customName.trim()) return;

    const varBarcode = generate8DigitBarcode();
    const newRow: VariantRow = {
      id: `var_custom_${Date.now()}`,
      combinationName: customName.trim(),
      barcode: varBarcode,
      shortcode: shortcode ? `${shortcode}-CUST` : "CUST",
      listPrice: simpleListPrice || bulkListPrice || "0",
      salePrice: simpleSalePrice || bulkSalePrice || "0",
      gstRate: simpleGstRate || bulkGstRate || "18",
      taxType: simpleTaxType || "inclusive",
      inventory: [],
      totalStock: 0,
    };

    setVariantRows((prev) => [...prev, newRow]);
    setToast({ type: "success", message: `Custom variant "${customName}" added!` });
  };

  // Regenerate barcode for a specific variant row
  const handleRegenerateVariantBarcode = (rowId: string) => {
    const newBarcode = generate8DigitBarcode();
    setVariantRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, barcode: newBarcode } : r))
    );
    setToast({ type: "info", message: `Regenerated 8-digit barcode: ${newBarcode}` });
  };

  // Delete a specific variant row
  const handleDeleteVariantRow = (rowId: string) => {
    setVariantRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Handle Image Upload with Client-Side 60KB Compression + ImageKit
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setUploadProgressMsg("Optimizing image to <= 60KB...");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgressMsg(`Compressing "${file.name}" to 60KB...`);

        const compressed = await compressImageTo60KB(file, 60 * 1024);

        setUploadProgressMsg(
          `Uploading to ImageKit (${compressed.originalSizeKB}KB ➔ ${compressed.sizeKB}KB)...`
        );

        const formData = new FormData();
        formData.append("file", compressed.blob, compressed.fileName);
        formData.append("fileName", compressed.fileName);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to upload to ImageKit");
        }

        setUploadedImages((prev) => [
          ...prev,
          {
            url: data.url,
            fileId: data.fileId,
            name: data.name,
            sizeKB: compressed.sizeKB,
          },
        ]);
      }

      setToast({
        type: "success",
        message: "Images compressed to <= 60KB and uploaded to ImageKit!",
      });
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const msg = err instanceof Error ? err.message : "Failed to process image";
      setToast({ type: "error", message: msg });
    } finally {
      setIsUploadingImage(false);
      setUploadProgressMsg("");
      e.target.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Open Inventory Allocation Modal
  const openInventoryModal = (variantId?: string) => {
    setInventoryTargetVariantId(variantId || null);

    const initialMap: { [locId: string]: number } = {};
    if (variantId) {
      const v = variantRows.find((row) => row.id === variantId);
      if (v) {
        v.inventory.forEach((item) => {
          initialMap[item.locationId] = item.quantity;
        });
      }
    } else {
      simpleInventory.forEach((item) => {
        initialMap[item.locationId] = item.quantity;
      });
    }

    setCurrentAllocations(initialMap);
    setIsInventoryModalOpen(true);
  };

  // Save Inventory Modal Allocations
  const saveInventoryAllocations = () => {
    const allocations: StoreStockAllocation[] = [];
    let total = 0;

    allLocations.forEach((loc) => {
      const qty = currentAllocations[loc.id] || 0;
      if (qty > 0) {
        allocations.push({
          locationId: loc.id,
          locationName: loc.name,
          type: loc.type,
          quantity: qty,
        });
        total += qty;
      }
    });

    if (inventoryTargetVariantId) {
      setVariantRows((prev) =>
        prev.map((r) =>
          r.id === inventoryTargetVariantId
            ? { ...r, inventory: allocations, totalStock: total }
            : r
        )
      );
    } else {
      setSimpleInventory(allocations);
    }

    setIsInventoryModalOpen(false);
    setToast({
      type: "success",
      message: `Updated inventory stock (${total} units across locations)`,
    });
  };

  // Total Stock calculations
  const simpleTotalStock = simpleInventory.reduce((acc, item) => acc + item.quantity, 0);
  const variantTotalStock = variantRows.reduce((acc, item) => acc + item.totalStock, 0);

  // Submit Product to Firestore
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ type: "error", message: "Please enter product title" });
      return;
    }

    if (hasVariants && variantRows.length === 0) {
      setToast({
        type: "error",
        message: "Please configure and select at least one variant combination",
      });
      return;
    }

    setSavingProduct(true);
    try {
      const categoryObj = categories.find((c) => c.id === categoryId);
      const createdAt = new Date().toISOString();

      const productPayload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        categoryName: categoryObj?.name || "General",
        shortcode: shortcode.trim(),
        barcode: barcode.trim(),
        sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        scheduledDateTime: scheduledDateTime || createdAt,
        media: uploadedImages,
        hasVariants,
        status: "Active",
        createdAt,
        updatedAt: createdAt,
      };

      if (!hasVariants) {
        productPayload.listPrice = parseFloat(simpleListPrice) || 0;
        productPayload.salePrice = parseFloat(simpleSalePrice) || 0;
        productPayload.gstRate = parseFloat(simpleGstRate) || 0;
        productPayload.taxType = simpleTaxType;
        productPayload.inventory = simpleInventory;
        productPayload.totalStock = simpleTotalStock;
      } else {
        productPayload.colorSizesMap = colorSizesMap;
        productPayload.variants = variantRows.map((r) => ({
          id: r.id,
          name: r.combinationName,
          color: r.color || "",
          size: r.size || "",
          barcode: r.barcode,
          shortcode: r.shortcode,
          listPrice: parseFloat(r.listPrice) || 0,
          salePrice: parseFloat(r.salePrice) || 0,
          gstRate: parseFloat(r.gstRate) || 0,
          taxType: r.taxType,
          inventory: r.inventory,
          totalStock: r.totalStock,
        }));
        productPayload.totalStock = variantTotalStock;
        if (variantRows.length > 0) {
          productPayload.salePrice = parseFloat(variantRows[0].salePrice) || 0;
          productPayload.listPrice = parseFloat(variantRows[0].listPrice) || 0;
          if (!barcode.trim()) {
            productPayload.barcode = variantRows[0].barcode;
          }
        }
      }

      await addDoc(collection(db, "products"), productPayload);

      setToast({
        type: "success",
        message: `Product "${title.trim()}" saved successfully!`,
      });

      setTimeout(() => {
        router.push("/products");
      }, 900);
    } catch (err: unknown) {
      console.error("Error creating product:", err);
      const msg = err instanceof Error ? err.message : "Failed to create product";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingProduct(false);
    }
  };

  // Convert categories list to DropdownOption format
  const categoryOptions: DropdownOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto bg-white font-sans select-none">
      {/* Top Sticky Header Bar matching other pages */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors cursor-pointer"
            title="Back to products list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/products" className="hover:underline">Product Manager</Link>
              <span>/</span>
              <Link href="/products" className="hover:underline">Products</Link>
              <span>/</span>
              <span className="font-semibold text-zinc-800">Add Product</span>
            </div>
            <h1 className="text-base font-bold text-zinc-900 tracking-tight">Create New Product</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/products"
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmitProduct}
            disabled={savingProduct || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {savingProduct ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>{savingProduct ? "Saving Product..." : "Save Product"}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Form Body matching other pages */}
      <div className="w-full px-6 py-5 space-y-5">
        {/* 1. General Product Details */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-4">
            <Tag className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-zinc-900">General Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Product Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Premium Cotton T-Shirt, Sunflower Oil 1L, Basmati Rice 5kg"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                autoFocus
                required
              />
            </div>

            {/* Custom Searchable Dropdown for Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Category <span className="text-rose-500">*</span>
              </label>
              <SearchableDropdown
                options={categoryOptions}
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
                placeholder="Search or select category..."
                searchPlaceholder="Filter categories..."
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Product Description
              </label>
              <textarea
                placeholder="Write detailed merchandise features, ingredients, usage instructions, or specification notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Shortcode on the left, Barcode beside it on the right (NOT EDITABLE), and Custom Date/Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Short Code (POS Quick-Key)</span>
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">e.g. TSH-01</span>
              </div>
              <input
                type="text"
                placeholder="e.g. SH-01, TSHIRT, OIL-1L"
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-700 flex items-center gap-1.5 whitespace-nowrap">
                  <BarcodeIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Barcode (8-Digit)</span>
                  <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 text-[9px] font-mono font-semibold whitespace-nowrap">
                    AUTO-UNIQUE
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = generate8DigitBarcode();
                    setBarcode(newCode);
                    setToast({ type: "info", message: `Generated new barcode: ${newCode}` });
                  }}
                  className="text-[10px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-mono cursor-pointer whitespace-nowrap"
                  title="Generate new 8-digit unique barcode"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Regenerate</span>
                </button>
              </div>
              <input
                type="text"
                maxLength={8}
                value={barcode}
                readOnly
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-900 font-mono tracking-widest font-semibold cursor-not-allowed select-all"
                title="Barcode is auto-generated and unique (click Regenerate above to generate new)"
              />
            </div>

            {/* Custom Date & Time Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Launch / Availability Date & Time
              </label>
              <CustomDateTimePicker
                value={scheduledDateTime}
                onChange={(val) => setScheduledDateTime(val)}
                placeholder="Pick calendar date & time..."
                includeTime={true}
              />
            </div>
          </div>
        </div>

        {/* 2. Media / ImageKit with Auto 60KB Compression */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-zinc-900">Product Media & Images</h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto Compressed &lt;= 60KB
            </span>
          </div>

          {/* Upload Drop Area */}
          <div className="mb-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-emerald-500/80 bg-zinc-50/50 hover:bg-emerald-50/20 rounded-xl p-5 cursor-pointer transition-all text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 shadow-xs mb-2 text-zinc-500">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-800">
                Click to upload product image
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Each image is automatically optimized to &le; 60KB without losing sharp visual quality, then hosted on ImageKit CDN
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFileChange}
                disabled={isUploadingImage}
                className="hidden"
              />
            </label>
          </div>

          {isUploadingImage && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg mb-4">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{uploadProgressMsg || "Optimizing and uploading..."}</span>
            </div>
          )}

          {/* Uploaded Images Gallery */}
          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {uploadedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-lg border border-zinc-200 overflow-hidden bg-zinc-100 shadow-2xs"
                >
                  <img
                    src={img.url}
                    alt={`Product media ${idx + 1}`}
                    className="h-28 w-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-[9px] font-mono font-medium text-white px-1.5 py-0.5 rounded">
                    {img.sizeKB} KB
                  </div>
                  {idx === 0 && (
                    <div className="absolute bottom-1 left-1 bg-emerald-600 text-[9px] font-semibold text-white px-1.5 py-0.2 rounded">
                      Primary
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-md bg-white/90 text-rose-600 hover:bg-rose-50 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                    title="Remove Image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Variants Section (Positioned ABOVE Inventory as requested!) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Product Variants & Options</h2>
                <p className="text-xs text-zinc-500">Configure independent sizes per color without mandatory combinations</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-zinc-700">
                {hasVariants ? "Variants Enabled" : "Simple Product"}
              </span>
              <button
                type="button"
                onClick={() => setHasVariants(!hasVariants)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  hasVariants ? "bg-[#107548]" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    hasVariants ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* If VARIANTS ENABLED */}
          {hasVariants ? (
            <div className="space-y-5">
              {/* Master Attribute Controls (NO PREBUILT SIZES OR COLORS FORCED!) */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Colors List */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-800 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Product Colors</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-normal">({colors.length} added)</span>
                    </label>
                    <div className="flex items-center gap-1.5 mb-2">
                      <input
                        type="text"
                        placeholder="Type color name (e.g. Red, Blue, Black)..."
                        value={newColorInput}
                        onChange={(e) => setNewColorInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddColor(e)}
                        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddColor()}
                        className="rounded-lg bg-zinc-800 text-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-900 cursor-pointer"
                      >
                        Add Color
                      </button>
                    </div>
                  </div>

                  {/* Master Sizes List */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-800 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Product Sizes / Dimensions</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-normal">({sizes.length} added)</span>
                    </label>
                    <div className="flex items-center gap-1.5 mb-2">
                      <input
                        type="text"
                        placeholder="Type size (e.g. S, M, L, Free Size, 32)..."
                        value={newSizeInput}
                        onChange={(e) => setNewSizeInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddSize(e)}
                        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSize()}
                        className="rounded-lg bg-zinc-800 text-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-900 cursor-pointer"
                      >
                        Add Size
                      </button>
                    </div>

                    {/* Quick Preset Buttons (Optional Shortcuts) */}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-zinc-500">
                      <span>Quick presets:</span>
                      <button
                        type="button"
                        onClick={handleAddCommonSizesPreset}
                        className="text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Apparel (S, M, L, XL, XXL)
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={handleAddFootwearSizesPreset}
                        className="text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Footwear (6 to 11)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Per-Color Size Matrix Grid: Click a size pill to toggle for that color! */}
                {colors.length === 0 ? (
                  <div className="py-6 border-t border-dashed border-zinc-200 text-center text-zinc-400 text-xs">
                    <p>No colors added yet.</p>
                    <p className="text-zinc-500 mt-1">Type a color above and click &quot;Add Color&quot; to configure your variants.</p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-200/80">
                    <div className="text-xs font-semibold text-zinc-800 mb-3 flex items-center justify-between">
                      <span>Select Available Sizes for Each Color:</span>
                      <span className="text-[11px] text-zinc-500 font-normal">
                        Click size badges to toggle availability per color
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {colors.map((color) => {
                        const selectedSizes = colorSizesMap[color] || [];
                        return (
                          <div
                            key={color}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs"
                          >
                            {/* Color Title with count */}
                            <div className="flex items-center gap-2 min-w-36">
                              <span className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                                <span>{color}</span>
                              </span>
                              <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-mono text-zinc-500">
                                {selectedSizes.length} {selectedSizes.length === 1 ? "size" : "sizes"}
                              </span>
                            </div>

                            {/* Size Badges / Toggles */}
                            <div className="flex-1 flex flex-wrap items-center gap-1.5">
                              {sizes.length === 0 ? (
                                <span className="text-zinc-400 italic text-xs">
                                  No sizes added yet. Type a size above to select for {color}.
                                </span>
                              ) : (
                                sizes.map((size) => {
                                  const isSelected = selectedSizes.includes(size);
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => handleToggleColorSize(color, size)}
                                      className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected
                                          ? "bg-[#107548] text-white border-[#107548] shadow-2xs"
                                          : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
                                      }`}
                                    >
                                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                      <span>{size}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>

                            {/* Quick Select All / Clear & Delete Color */}
                            {sizes.length > 0 && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllSizesForColor(color)}
                                  className="text-zinc-500 hover:text-emerald-700 px-1.5 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                                >
                                  All
                                </button>
                                <span className="text-zinc-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleClearAllSizesForColor(color)}
                                  className="text-zinc-500 hover:text-zinc-800 px-1.5 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                                >
                                  None
                                </button>
                                <span className="text-zinc-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColor(color)}
                                  className="text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title={`Remove ${color} completely`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bulk Price Application Bar with Searchable Dropdown */}
                {variantRows.length > 0 && (
                  <div className="pt-3 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                      <span>⚡ Quick Set Prices for All Variants:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="List Price (MRP ₹)"
                        value={bulkListPrice}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => setBulkListPrice(e.target.value)}
                        className="w-32 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Sale Price (₹)"
                        value={bulkSalePrice}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => setBulkSalePrice(e.target.value)}
                        className="w-32 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                      <div className="w-36">
                        <SearchableDropdown
                          options={GST_OPTIONS}
                          value={bulkGstRate}
                          onChange={(val) => setBulkGstRate(val)}
                          placeholder="Select GST %..."
                          searchPlaceholder="GST %"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyBulkPrices}
                        className="rounded-lg bg-[#107548] text-white px-3.5 py-1.5 font-medium hover:bg-[#0d603a] cursor-pointer transition-colors shadow-2xs"
                      >
                        Apply to All
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Variant Rows Table with Barcode (READONLY), Shortcode, Price, GST & Inventory */}
              {variantRows.length > 0 && (
                <div className="border border-zinc-200 rounded-lg overflow-x-auto bg-white">
                  <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-zinc-800">
                        Active Variant Combinations ({variantRows.length})
                      </span>
                      <span className="text-zinc-500 text-[11px] font-mono">
                        Total Stock: <strong className="text-emerald-700">{variantTotalStock} units</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomVariantRow}
                      className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Custom Variant</span>
                    </button>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 font-medium">
                      <tr>
                        <th className="px-3 py-2 border-r border-zinc-200/60">Variant Name</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-36">
                          <span className="flex items-center gap-1">
                            <BarcodeIcon className="h-3 w-3 text-emerald-600" />
                            <span>8-Digit Barcode</span>
                          </span>
                        </th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-28">Short Code</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-28">List Price (₹)</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-28">Sale Price (₹)</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-32">GST %</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-32">Tax Type</th>
                        <th className="px-3 py-2 border-r border-zinc-200/60 w-36">Inventory</th>
                        <th className="px-2 py-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {variantRows.map((row) => (
                        <tr key={row.id} className="hover:bg-zinc-50/60">
                          {/* Name */}
                          <td className="px-3 py-2 border-r border-zinc-200/60 font-medium text-zinc-900">
                            {row.combinationName}
                          </td>

                          {/* 8-Digit Numeric Barcode (READ ONLY + REGENERATE) */}
                          <td className="px-2.5 py-1.5 border-r border-zinc-200/60">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                maxLength={8}
                                value={row.barcode}
                                readOnly
                                className="w-22 rounded border border-zinc-200 bg-zinc-50/80 px-2 py-1 text-xs text-zinc-900 font-mono tracking-wider font-semibold cursor-not-allowed select-all"
                                title="Barcode is auto-generated (click regenerate icon to get new)"
                              />
                              <button
                                type="button"
                                onClick={() => handleRegenerateVariantBarcode(row.id)}
                                className="p-1 text-zinc-400 hover:text-emerald-700 hover:bg-zinc-100 rounded cursor-pointer"
                                title="Regenerate unique 8-digit barcode"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* Short Code */}
                          <td className="px-2.5 py-1.5 border-r border-zinc-200/60">
                            <input
                              type="text"
                              value={row.shortcode}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setVariantRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, shortcode: val } : r
                                  )
                                );
                              }}
                              className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-900 font-mono uppercase focus:border-emerald-500 focus:outline-hidden"
                              placeholder="Code"
                            />
                          </td>

                          {/* List Price */}
                          <td className="px-3 py-2 border-r border-zinc-200/60">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={row.listPrice}
                              onWheel={(e) => e.currentTarget.blur()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariantRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, listPrice: val } : r
                                  )
                                );
                              }}
                              className="w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-mono"
                            />
                          </td>

                          {/* Sale Price */}
                          <td className="px-3 py-2 border-r border-zinc-200/60">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={row.salePrice}
                              onWheel={(e) => e.currentTarget.blur()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariantRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, salePrice: val } : r
                                  )
                                );
                              }}
                              className="w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-mono"
                            />
                          </td>

                          {/* GST % with SearchableDropdown */}
                          <td className="px-2 py-1.5 border-r border-zinc-200/60">
                            <SearchableDropdown
                              options={GST_OPTIONS}
                              value={row.gstRate}
                              placeholder="Select GST..."
                              onChange={(val) => {
                                setVariantRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, gstRate: val } : r))
                                );
                              }}
                            />
                          </td>

                          {/* Tax Type with SearchableDropdown */}
                          <td className="px-2 py-1.5 border-r border-zinc-200/60">
                            <SearchableDropdown
                              options={TAX_TYPE_OPTIONS}
                              value={row.taxType}
                              placeholder="Select Tax..."
                              onChange={(val) => {
                                setVariantRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, taxType: val as "inclusive" | "exclusive" | "" } : r
                                  )
                                );
                              }}
                            />
                          </td>

                          {/* Inventory Allocation */}
                          <td className="px-3 py-2 border-r border-zinc-200/60">
                            <button
                              type="button"
                              onClick={() => openInventoryModal(row.id)}
                              className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50 transition-colors cursor-pointer w-full justify-between"
                            >
                              <span className="font-mono font-medium text-emerald-700">
                                {row.totalStock}u
                              </span>
                              <span className="text-[10px] text-zinc-500 font-sans underline">
                                Edit Stock
                              </span>
                            </button>
                          </td>

                          {/* Delete row */}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteVariantRow(row.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="Delete variant combination"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* If SIMPLE PRODUCT: Show Pricing and Inventory sections here */
            <div className="space-y-6 pt-2">
              {/* Pricing Section with Custom Searchable Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-200">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">
                    List Price / MRP (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-zinc-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={simpleListPrice}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimpleListPrice(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white pl-6 pr-3 py-1.5 text-xs text-zinc-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">
                    Sale Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-zinc-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={simpleSalePrice}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setSimpleSalePrice(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white pl-6 pr-3 py-1.5 text-xs text-zinc-900 font-mono focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Custom Searchable GST Rate Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">
                    GST Rate (%)
                  </label>
                  <SearchableDropdown
                    options={GST_OPTIONS}
                    value={simpleGstRate}
                    onChange={(val) => setSimpleGstRate(val)}
                    placeholder="Select GST rate..."
                    searchPlaceholder="Search GST rate..."
                  />
                </div>

                {/* Custom Searchable Tax Type Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">
                    Tax Computation
                  </label>
                  <SearchableDropdown
                    options={TAX_TYPE_OPTIONS}
                    value={simpleTaxType}
                    onChange={(val) => setSimpleTaxType(val as "inclusive" | "exclusive")}
                    placeholder="Select Tax computation..."
                    searchPlaceholder="Search tax type..."
                  />
                </div>
              </div>

              {/* Simple Product Inventory Section */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-xs font-semibold text-zinc-900">
                      Inventory Allocation across Stores & Warehouses
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => openInventoryModal()}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300/80 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <span>Edit Inventory Allocations</span>
                  </button>
                </div>

                <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-zinc-500">Total Stock</span>
                    <span className="text-lg font-bold font-mono text-emerald-700">
                      {simpleTotalStock} units
                    </span>
                  </div>

                  <div className="h-8 w-px bg-zinc-200 mx-2" />

                  <div className="flex-1 flex flex-wrap gap-2 text-xs">
                    {simpleInventory.length === 0 ? (
                      <span className="text-zinc-400 italic">
                        No locations allocated yet. Click &quot;Edit Inventory Allocations&quot; to assign stock.
                      </span>
                    ) : (
                      simpleInventory.map((item) => (
                        <span
                          key={item.locationId}
                          className="inline-flex items-center gap-1.5 rounded bg-white border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700"
                        >
                          {item.type === "store" ? (
                            <Store className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Warehouse className="h-3 w-3 text-zinc-600" />
                          )}
                          <span className="font-medium">{item.locationName}:</span>
                          <strong className="font-mono text-zinc-900">{item.quantity}</strong>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Allocation Modal (Stores & Warehouses) */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Stock Inventory Allocation
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Assign stock quantities per Store and Warehouse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {allLocations.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-xs">
                  <p>No stores or warehouses configured yet.</p>
                  <p className="text-zinc-500 mt-1">
                    Please create locations under <strong>Stores</strong> and <strong>Warehouses</strong> pages.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Retail Stores Section */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Retail Store Outlets</span>
                    </h4>
                    <div className="space-y-2">
                      {allLocations
                        .filter((l) => l.type === "store")
                        .map((loc) => (
                          <div
                            key={loc.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5"
                          >
                            <div>
                              <div className="text-xs font-semibold text-zinc-900">{loc.name}</div>
                              {loc.address && (
                                <div className="text-[11px] text-zinc-500 truncate max-w-xs">{loc.address}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-400">Qty:</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={currentAllocations[loc.id] !== undefined && currentAllocations[loc.id] !== 0 ? currentAllocations[loc.id] : ""}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") {
                                    setCurrentAllocations((prev) => {
                                      const next = { ...prev };
                                      delete next[loc.id];
                                      return next;
                                    });
                                  } else {
                                    const val = parseInt(raw) || 0;
                                    setCurrentAllocations((prev) => ({
                                      ...prev,
                                      [loc.id]: Math.max(0, val),
                                    }));
                                  }
                                }}
                                className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs font-mono text-right text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Warehouses Section */}
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                      <Warehouse className="h-3.5 w-3.5 text-zinc-600" />
                      <span>Central Godowns & Warehouses</span>
                    </h4>
                    <div className="space-y-2">
                      {allLocations
                        .filter((l) => l.type === "warehouse")
                        .map((loc) => (
                          <div
                            key={loc.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5"
                          >
                            <div>
                              <div className="text-xs font-semibold text-zinc-900">{loc.name}</div>
                              {loc.address && (
                                <div className="text-[11px] text-zinc-500 truncate max-w-xs">{loc.address}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-400">Qty:</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={currentAllocations[loc.id] !== undefined && currentAllocations[loc.id] !== 0 ? currentAllocations[loc.id] : ""}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") {
                                    setCurrentAllocations((prev) => {
                                      const next = { ...prev };
                                      delete next[loc.id];
                                      return next;
                                    });
                                  } else {
                                    const val = parseInt(raw) || 0;
                                    setCurrentAllocations((prev) => ({
                                      ...prev,
                                      [loc.id]: Math.max(0, val),
                                    }));
                                  }
                                }}
                                className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs font-mono text-right text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-3">
              <div className="text-xs text-zinc-600 font-mono">
                Total Allocated:{" "}
                <strong className="text-emerald-700">
                  {Object.values(currentAllocations).reduce((a, b) => a + b, 0)} units
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInventoryModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveInventoryAllocations}
                  className="rounded-lg bg-[#107548] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#0d603a] transition-colors cursor-pointer"
                >
                  Apply Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Supabase Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
