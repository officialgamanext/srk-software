import ComingSoonView from "@/components/ComingSoonView";

export default function AnalyticsPage() {
  const sampleMetrics = [
    { id: "metric_01", sku_code: "KPI-SALES", product_name: "Today Gross Sales", category: "Revenue", price: "₹63,760.00", stock_qty: "+14.2% vs yesterday", barcode: "TELEMETRY", status: "In Stock" },
    { id: "metric_02", sku_code: "KPI-MARGIN", product_name: "Average Basket Size", category: "Basket Value", price: "₹540.00", stock_qty: "118 Bills", barcode: "TELEMETRY", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Insights & Telemetry"
      moduleName="Reports & Business Analytics"
      path="/analytics"
      description="Real-time sales velocity, GST filing reports, profit margin breakdown, and cashier efficiency audits"
      badge="ANALYTICS ENGINE"
      itemCount={18}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleMetrics}
    />
  );
}
