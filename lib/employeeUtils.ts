/**
 * Utility functions for Employee Manager module
 */

// Generate 8-digit numeric auto unique employee ID
export function generate8DigitEmpId(): string {
  // Generates integer between 10000000 and 99999999
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return num.toString();
}

// Upload a single file to ImageKit via our Next.js API route
export async function uploadFileToImageKit(
  file: File, 
  folder: string = "/employees", 
  customFileName?: string
): Promise<{ url: string; fileId?: string; name: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  if (customFileName) {
    formData.append("fileName", customFileName);
  } else {
    const ext = file.name.split(".").pop() || "jpg";
    formData.append("fileName", `emp_${Date.now()}_${Math.random().toString(36).slice(-4)}.${ext}`);
  }

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to upload file to ImageKit");
  }

  return {
    url: data.url,
    fileId: data.fileId,
    name: data.name,
  };
}

// Format Currency
export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

// Common Indian Retail roles
export const EMPLOYEE_ROLES = [
  "Cashier",
  "Store Manager",
  "Assistant Manager",
  "Sales Executive",
  "Inventory Supervisor",
  "Billing Clerk",
  "Master Tailor",
  "Fashion Consultant",
  "Accountant",
  "Security Officer",
  "Store Helper",
  "Delivery Partner"
];
