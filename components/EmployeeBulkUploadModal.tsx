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
  Check,
  Building2,
  Phone,
  ShieldCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  collection, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generate8DigitEmpId } from "@/lib/employeeUtils";
import type { EmployeeItem, EmergencyContact } from "@/components/EmployeesView";

interface EmployeeBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (importedCount: number) => void;
}

export interface ExcelEmployeeRow {
  "Employee ID"?: string;
  "Full Name": string;
  "Mobile": string;
  "City": string;
  "Address": string;
  "Role": string;
  "Wage Type": string;
  "Salary / Wages": number;
  "Store Branch": string;
  "Aadhar Number": string;
  "PAN Number": string;
  "Emergency 1 Name": string;
  "Emergency 1 Relation": string;
  "Emergency 1 Mobile": string;
  "Emergency 2 Name": string;
  "Emergency 2 Relation": string;
  "Emergency 2 Mobile": string;
  "Joining Date": string;
  "Status": string;
}

// 10 Sample Demo Employees for Template & 1-Click Testing
export const SAMPLE_EMPLOYEES_DATA: ExcelEmployeeRow[] = [
  {
    "Employee ID": "84920153",
    "Full Name": "Ramesh Kumar Verma",
    "Mobile": "9876543210",
    "City": "Hyderabad",
    "Address": "Flat 302, Sai Residency, Madhapur",
    "Role": "Store Manager",
    "Wage Type": "Monthly",
    "Salary / Wages": 35000,
    "Store Branch": "Main Branch (Hyderabad)",
    "Aadhar Number": "4819 2831 9283",
    "PAN Number": "ABCPV1234A",
    "Emergency 1 Name": "Suresh Verma",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9123456780",
    "Emergency 2 Name": "Sunita Verma",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9876543219",
    "Joining Date": "2026-01-15",
    "Status": "Active"
  },
  {
    "Employee ID": "91028471",
    "Full Name": "Priya Lakshmi Sharma",
    "Mobile": "9849012345",
    "City": "Secunderabad",
    "Address": "H.No 12-4-88, MG Road, Secunderabad",
    "Role": "Cashier",
    "Wage Type": "Monthly",
    "Salary / Wages": 22000,
    "Store Branch": "Retail Outlet (Secunderabad)",
    "Aadhar Number": "7392 8401 9284",
    "PAN Number": "BKLPS8291B",
    "Emergency 1 Name": "Rajesh Sharma",
    "Emergency 1 Relation": "Spouse",
    "Emergency 1 Mobile": "9849098765",
    "Emergency 2 Name": "Kavitha Sharma",
    "Emergency 2 Relation": "Mother",
    "Emergency 2 Mobile": "9849011122",
    "Joining Date": "2026-02-01",
    "Status": "Active"
  },
  {
    "Employee ID": "62019482",
    "Full Name": "Venkata Rao Kalepu",
    "Mobile": "9885012398",
    "City": "Vijayawada",
    "Address": "Besant Road, Governorpet",
    "Role": "Sales Executive",
    "Wage Type": "Monthly",
    "Salary / Wages": 19000,
    "Store Branch": "MADHU CREATIONS",
    "Aadhar Number": "8291 9384 1029",
    "PAN Number": "CJKPK9182C",
    "Emergency 1 Name": "Kalepu Satyanarayana",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9885099999",
    "Emergency 2 Name": "Kalepu Madhavi",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9885088888",
    "Joining Date": "2026-03-10",
    "Status": "Active"
  },
  {
    "Employee ID": "74820194",
    "Full Name": "Mohammed Abdul Rafiq",
    "Mobile": "9700123456",
    "City": "Hyderabad",
    "Address": "Charminar Main Road, Old City",
    "Role": "Master Tailor",
    "Wage Type": "Daily",
    "Salary / Wages": 950,
    "Store Branch": "Main Branch (Hyderabad)",
    "Aadhar Number": "9182 7364 8291",
    "PAN Number": "DRFMA7182D",
    "Emergency 1 Name": "Abdul Hafeez",
    "Emergency 1 Relation": "Brother",
    "Emergency 1 Mobile": "9700987654",
    "Emergency 2 Name": "Fatima Begum",
    "Emergency 2 Relation": "Mother",
    "Emergency 2 Mobile": "9700777888",
    "Joining Date": "2026-04-05",
    "Status": "Active"
  },
  {
    "Employee ID": "53920184",
    "Full Name": "Anil Kumar Reddy",
    "Mobile": "9949123488",
    "City": "Hyderabad",
    "Address": "Plot 54, Jubilee Hills Road No. 36",
    "Role": "Inventory Supervisor",
    "Wage Type": "Monthly",
    "Salary / Wages": 26000,
    "Store Branch": "Warehouse Depot (Madhapur)",
    "Aadhar Number": "6281 9283 7461",
    "PAN Number": "ERDAK6182E",
    "Emergency 1 Name": "Sanjeeva Reddy",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9949988776",
    "Emergency 2 Name": "Swathi Reddy",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9949112233",
    "Joining Date": "2026-05-12",
    "Status": "Active"
  },
  {
    "Employee ID": "83019284",
    "Full Name": "Deepika Narayana",
    "Mobile": "9618123450",
    "City": "Secunderabad",
    "Address": "Near Clock Tower, Sarojini Devi Road",
    "Role": "Fashion Consultant",
    "Wage Type": "Monthly",
    "Salary / Wages": 21000,
    "Store Branch": "Retail Outlet (Secunderabad)",
    "Aadhar Number": "5192 8374 9182",
    "PAN Number": "FNDDN5182F",
    "Emergency 1 Name": "Narayana Swamy",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9618998877",
    "Emergency 2 Name": "Meenakshi",
    "Emergency 2 Relation": "Sister",
    "Emergency 2 Mobile": "9618665544",
    "Joining Date": "2026-06-01",
    "Status": "Active"
  },
  {
    "Employee ID": "49201842",
    "Full Name": "Kiran Sai Teja",
    "Mobile": "9550123987",
    "City": "Hyderabad",
    "Address": "KPHB Colony Phase 3, Kukatpally",
    "Role": "Billing Clerk",
    "Wage Type": "Monthly",
    "Salary / Wages": 18500,
    "Store Branch": "Main Branch (Hyderabad)",
    "Aadhar Number": "3829 1029 4819",
    "PAN Number": "GKSKT4182G",
    "Emergency 1 Name": "Subba Rao",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9550998811",
    "Emergency 2 Name": "Pooja Teja",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9550334455",
    "Joining Date": "2026-07-15",
    "Status": "Active"
  },
  {
    "Employee ID": "63910284",
    "Full Name": "Mallesh Goud",
    "Mobile": "9440123490",
    "City": "Hyderabad",
    "Address": "Near Gachibowli Stadium",
    "Role": "Security Officer",
    "Wage Type": "Monthly",
    "Salary / Wages": 17000,
    "Store Branch": "Main Branch (Hyderabad)",
    "Aadhar Number": "2918 3847 1928",
    "PAN Number": "HMGOU3182H",
    "Emergency 1 Name": "Narsimha Goud",
    "Emergency 1 Relation": "Brother",
    "Emergency 1 Mobile": "9440987650",
    "Emergency 2 Name": "Laxmi Goud",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9440554433",
    "Joining Date": "2026-08-01",
    "Status": "Active"
  },
  {
    "Employee ID": "72910384",
    "Full Name": "Srinivasulu Naidu",
    "Mobile": "9391123409",
    "City": "Hyderabad",
    "Address": "Kondapur RTO Office Road",
    "Role": "Store Helper",
    "Wage Type": "Daily",
    "Salary / Wages": 650,
    "Store Branch": "Main Branch (Hyderabad)",
    "Aadhar Number": "1928 3746 5829",
    "PAN Number": "ISNAI2182I",
    "Emergency 1 Name": "Govind Naidu",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9391987654",
    "Emergency 2 Name": "Radha Naidu",
    "Emergency 2 Relation": "Mother",
    "Emergency 2 Mobile": "9391443322",
    "Joining Date": "2026-08-20",
    "Status": "Active"
  },
  {
    "Employee ID": "81029384",
    "Full Name": "Harish Chandra Gupta",
    "Mobile": "9246123499",
    "City": "Secunderabad",
    "Address": "Marredpally West, Secunderabad",
    "Role": "Accountant",
    "Wage Type": "Monthly",
    "Salary / Wages": 30000,
    "Store Branch": "Retail Outlet (Secunderabad)",
    "Aadhar Number": "4918 2736 4910",
    "PAN Number": "JHCGU1182J",
    "Emergency 1 Name": "Mahesh Gupta",
    "Emergency 1 Relation": "Father",
    "Emergency 1 Mobile": "9246998877",
    "Emergency 2 Name": "Rekha Gupta",
    "Emergency 2 Relation": "Spouse",
    "Emergency 2 Mobile": "9246223344",
    "Joining Date": "2026-09-01",
    "Status": "Active"
  }
];

export default function EmployeeBulkUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: EmployeeBulkUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedEmployees, setParsedEmployees] = useState<Omit<EmployeeItem, "id">[]>([]);
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

  // Download Sample Excel Template
  const handleDownloadSample = () => {
    setIsDownloadingSample(true);
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_EMPLOYEES_DATA);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, "SRK_Employees_Bulk_Upload_Template.xlsx");
    } catch (err) {
      console.error("Failed to download sample excel:", err);
    } finally {
      setIsDownloadingSample(false);
    }
  };

  // 1-Click Load 10 Demo Staff Records
  const handleLoadDemoData = () => {
    setParsingError(null);
    setSelectedFile(null);

    const mapped: Omit<EmployeeItem, "id">[] = SAMPLE_EMPLOYEES_DATA.map((row) => ({
      employeeId: row["Employee ID"] || generate8DigitEmpId(),
      name: row["Full Name"],
      mobile: String(row["Mobile"]),
      city: row["City"],
      address: row["Address"],
      role: row["Role"],
      wageType: row["Wage Type"].toLowerCase() === "daily" ? "daily" : "monthly",
      salary: Number(row["Salary / Wages"]) || 0,
      store: row["Store Branch"] || "Main Branch (Hyderabad)",
      aadharNumber: row["Aadhar Number"] || "",
      aadharFrontUrl: "",
      aadharBackUrl: "",
      panNumber: row["PAN Number"] || "",
      panImageUrl: "",
      profilePicUrl: "",
      emergencyContacts: [
        {
          relation: row["Emergency 1 Relation"] || "Father",
          name: row["Emergency 1 Name"] || "",
          mobile: String(row["Emergency 1 Mobile"] || ""),
        },
        {
          relation: row["Emergency 2 Relation"] || "Spouse",
          name: row["Emergency 2 Name"] || "",
          mobile: String(row["Emergency 2 Mobile"] || ""),
        },
      ],
      joiningDate: row["Joining Date"] || new Date().toISOString().split("T")[0],
      status: String(row["Status"]).toLowerCase() === "inactive" ? "inactive" : "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    setParsedEmployees(mapped);
  };

  // Parse Excel or CSV file
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
        throw new Error("The selected file is empty. Please ensure it contains employee rows.");
      }

      // Case-insensitive column matcher
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

      const normalized: Omit<EmployeeItem, "id">[] = rawRows.map((row) => {
        const idVal = getVal(row, ["Employee ID", "ID", "Employee Code", "Emp ID", "employee_id"]);
        const nameVal = getVal(row, ["Full Name", "Name", "Employee Name", "employee_name"]);
        const mobVal = getVal(row, ["Mobile", "mobile", "Phone", "Mobile Number", "Contact"]);
        const cityVal = getVal(row, ["City", "city", "Town", "Location"]);
        const addrVal = getVal(row, ["Address", "address", "Residential Address"]);
        const roleVal = getVal(row, ["Role", "role", "Designation", "Job Title"]);
        const wageVal = getVal(row, ["Wage Type", "wage_type", "Salary Type", "Wage"]);
        const salVal = getVal(row, ["Salary / Wages", "Salary", "Wages", "Pay", "salary"]);
        const storeVal = getVal(row, ["Store Branch", "Store", "Branch", "Location Branch"]);
        const aadharVal = getVal(row, ["Aadhar Number", "Aadhar", "aadhar_number", "UIDAI"]);
        const panVal = getVal(row, ["PAN Number", "PAN", "pan_number"]);
        const em1Name = getVal(row, ["Emergency 1 Name", "Emergency Contact 1 Name", "Contact 1 Name"]);
        const em1Rel = getVal(row, ["Emergency 1 Relation", "Relation 1", "Contact 1 Relation"]);
        const em1Mob = getVal(row, ["Emergency 1 Mobile", "Emergency 1 Phone", "Contact 1 Mobile"]);
        const em2Name = getVal(row, ["Emergency 2 Name", "Emergency Contact 2 Name", "Contact 2 Name"]);
        const em2Rel = getVal(row, ["Emergency 2 Relation", "Relation 2", "Contact 2 Relation"]);
        const em2Mob = getVal(row, ["Emergency 2 Mobile", "Emergency 2 Phone", "Contact 2 Mobile"]);
        const joinVal = getVal(row, ["Joining Date", "Join Date", "Date of Joining", "DOJ"]);
        const statusVal = getVal(row, ["Status", "status", "Employment Status"]);

        // Auto 8-digit unique ID if missing or invalid
        let finalEmpId = String(idVal || "").replace(/[^0-9]/g, "");
        if (finalEmpId.length !== 8) {
          finalEmpId = generate8DigitEmpId();
        }

        const name = String(nameVal || "Unnamed Employee").trim();
        const mobile = String(mobVal || "0000000000").trim();
        const city = String(cityVal || "Hyderabad").trim();
        const address = String(addrVal || "").trim();
        const role = String(roleVal || "Sales Executive").trim();
        const wageType = String(wageVal || "").toLowerCase().includes("daily") ? "daily" : "monthly";
        const salary = parseFloat(String(salVal || "0").replace(/[^0-9.]/g, "")) || 0;
        const store = String(storeVal || "Main Branch (Hyderabad)").trim();
        const aadharNumber = String(aadharVal || "").trim();
        const panNumber = String(panVal || "").toUpperCase().trim();
        const joiningDate = String(joinVal || new Date().toISOString().split("T")[0]).trim();
        const status = String(statusVal || "").toLowerCase() === "inactive" ? "inactive" : "active";

        const emergencyContacts: [EmergencyContact, EmergencyContact] = [
          {
            relation: String(em1Rel || "Father").trim(),
            name: String(em1Name || "").trim(),
            mobile: String(em1Mob || "").trim(),
          },
          {
            relation: String(em2Rel || "Spouse").trim(),
            name: String(em2Name || "").trim(),
            mobile: String(em2Mob || "").trim(),
          },
        ];

        return {
          employeeId: finalEmpId,
          name,
          mobile,
          city,
          address,
          role,
          wageType,
          salary,
          store,
          aadharNumber,
          aadharFrontUrl: "",
          aadharBackUrl: "",
          panNumber,
          panImageUrl: "",
          profilePicUrl: "",
          emergencyContacts,
          joiningDate,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      setParsedEmployees(normalized);
    } catch (err: unknown) {
      console.error("Excel parse error:", err);
      const msg = err instanceof Error ? err.message : "Failed to parse file.";
      setParsingError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  // Upload parsed employees to Firestore in batches of 500
  const handleCommitUpload = async () => {
    if (parsedEmployees.length === 0) return;
    setIsUploading(true);
    setUploadProgress({
      current: 0,
      total: parsedEmployees.length,
      stage: "Connecting to database...",
    });

    try {
      const coll = collection(db, "employees");
      const BATCH_SIZE = 450;
      let committed = 0;

      for (let i = 0; i < parsedEmployees.length; i += BATCH_SIZE) {
        const slice = parsedEmployees.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        slice.forEach((emp) => {
          const newDocRef = doc(coll);
          batch.set(newDocRef, emp);
        });

        setUploadProgress({
          current: i + slice.length,
          total: parsedEmployees.length,
          stage: `Writing batch (${i + 1} to ${i + slice.length})...`,
        });

        await batch.commit();
        committed += slice.length;
      }

      onUploadSuccess(committed);
      onClose();
    } catch (err: unknown) {
      console.error("Upload commit error:", err);
      const msg = err instanceof Error ? err.message : "Failed to commit records to Firestore.";
      setParsingError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl border border-zinc-200 bg-white shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Bulk Import Employees
              </h2>
              <p className="text-xs text-zinc-500">
                Upload staff lists via Excel (.xlsx, .xls) or CSV. Auto-assigns 8-digit unique IDs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Actions: Download Template & 1-Click Demo Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadSample}
              disabled={isDownloadingSample}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-left hover:bg-zinc-100/70 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-zinc-900 block">
                    Download Excel Template
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Pre-filled with headers, KYC columns & emergency contacts
                  </span>
                </div>
              </div>
              <Download className="h-4 w-4 text-zinc-400 shrink-0" />
            </button>

            <button
              onClick={handleLoadDemoData}
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-left hover:bg-emerald-100/60 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-emerald-900 block">
                    Load 10 Sample Staff Records
                  </span>
                  <span className="text-[10px] text-emerald-700/80">
                    Test 1-click import with realistic retail profiles
                  </span>
                </div>
              </div>
              <span className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold">
                1-CLICK
              </span>
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) processFile(file);
            }}
            className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/40 p-6 text-center hover:border-emerald-500 hover:bg-emerald-50/10 transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
            />

            <UploadCloud className="h-9 w-9 text-zinc-400 mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-zinc-800">
              {selectedFile ? selectedFile.name : "Drag and drop your Excel or CSV file here"}
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Supports .xlsx, .xls, and .csv files up to 20MB
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-xs cursor-pointer"
            >
              <span>Browse Files</span>
            </button>
          </div>

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Parsing spreadsheet rows...</span>
            </div>
          )}

          {/* Error Banner */}
          {parsingError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{parsingError}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedEmployees.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-zinc-900">
                    Ready to Import: {parsedEmployees.length} Staff Records
                  </span>
                </div>
                <button
                  onClick={() => setParsedEmployees([])}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  Clear preview
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="bg-zinc-50 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">8-Digit ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Mobile</th>
                      <th className="px-3 py-2">Store</th>
                      <th className="px-3 py-2">Compensation</th>
                      <th className="px-3 py-2">Emergency 1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {parsedEmployees.slice(0, 50).map((emp, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60">
                        <td className="px-3 py-1.5 font-mono font-bold text-zinc-900">{emp.employeeId}</td>
                        <td className="px-3 py-1.5 font-medium text-zinc-900">{emp.name}</td>
                        <td className="px-3 py-1.5 text-zinc-600">{emp.role}</td>
                        <td className="px-3 py-1.5 font-mono text-zinc-700">{emp.mobile}</td>
                        <td className="px-3 py-1.5 text-zinc-500 truncate max-w-[120px]">{emp.store}</td>
                        <td className="px-3 py-1.5 font-mono">
                          ₹{emp.salary} ({emp.wageType})
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-zinc-600">
                          {emp.emergencyContacts[0]?.name ? `${emp.emergencyContacts[0].name} (${emp.emergencyContacts[0].relation})` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedEmployees.length > 50 && (
                <p className="text-[10px] text-zinc-400 text-center">
                  Showing first 50 rows of {parsedEmployees.length} total rows.
                </p>
              )}
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                <span>{uploadProgress.stage}</span>
                <span className="font-mono">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-200"
                  style={{
                    width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            {parsedEmployees.length > 0 ? `${parsedEmployees.length} records ready` : "No file loaded"}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCommitUpload}
              disabled={parsedEmployees.length === 0 || isUploading}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
            >
              {isUploading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              <span>Import {parsedEmployees.length > 0 ? `${parsedEmployees.length} Staff` : "Employees"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
