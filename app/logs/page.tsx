import ComingSoonView from "@/components/ComingSoonView";

export default function LogsPage() {
  const sampleLogs = [
    { id: "log_9910", sku_code: "AUTH_LOGIN", product_name: "Admin Session Established (SK)", category: "Auth Event", price: "2026-10-12 16:04:12", stock_qty: "IP 192.168.1.45", barcode: "SECURITY", status: "In Stock" },
    { id: "log_9911", sku_code: "HW_PRINT", product_name: "ESC/POS Receipt Cut Completed", category: "Printer Event", price: "2026-10-12 16:01:50", stock_qty: "Job ID #54201", barcode: "PERIPHERAL", status: "In Stock" },
    { id: "log_9912", sku_code: "CAT_EDIT", product_name: "Updated Stock for SKU-8803", category: "Data Event", price: "2026-10-12 15:45:00", stock_qty: "Qty: 18 -> 12", barcode: "LEDGER", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Telemetry & Observability"
      moduleName="Audit & Hardware Event Logs"
      path="/logs"
      description="Immutable event audit trail for POS transactions, thermal printer communication, and user access records"
      badge="AUDIT LOGS"
      itemCount={1894}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleLogs}
    />
  );
}
