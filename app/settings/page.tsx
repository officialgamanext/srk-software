import ComingSoonView from "@/components/ComingSoonView";

export default function SettingsPage() {
  const sampleSettings = [
    { id: "cfg_01", sku_code: "STORE_NAME", product_name: "SRK Retail Hyderabad Outlet", category: "Store Info", price: "GSTIN: 36ABCDE1234F1Z5", stock_qty: "Tel: +91 40 2345 6789", barcode: "CONFIG", status: "In Stock" },
    { id: "cfg_02", sku_code: "THERMAL_PRINTER", product_name: "TVS RP-3200 Star ESC/POS 80mm", category: "Hardware", price: "Baud: 9600, USB001", stock_qty: "Auto-Cut: ON", barcode: "CONFIG", status: "In Stock" },
    { id: "cfg_03", sku_code: "INVOICE_PREFIX", product_name: "Tax Invoice Serial Prefix", category: "Billing", price: "Prefix: SRK/2026/", stock_qty: "Next: #054204", barcode: "CONFIG", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Configuration"
      moduleName="Store & System Settings"
      path="/settings"
      description="Store profile, tax GSTIN configuration, hardware receipt printer preferences, and role permissions"
      badge="SETTINGS"
      itemCount={14}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleSettings}
    />
  );
}
