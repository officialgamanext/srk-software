import ComingSoonView from "@/components/ComingSoonView";

export default function ProductDashboardPage() {
  const analyticsData = [
    { id: "stat_01", sku_code: "CAT-TOP", product_name: "Grains & Pulses", category: "High Volume", price: "₹1,42,800 Sales", stock_qty: "1,200 Units", barcode: "98.4% Fill", status: "In Stock" },
    { id: "stat_02", sku_code: "CAT-SEC", product_name: "Dairy & Chilled", category: "Fast Turn", price: "₹84,200 Sales", stock_qty: "450 Units", barcode: "95.1% Fill", status: "In Stock" },
    { id: "stat_03", sku_code: "CAT-LOW", product_name: "Packaged Snacks", category: "High Margin", price: "₹63,100 Sales", stock_qty: "820 Units", barcode: "92.0% Fill", status: "Low Stock" },
  ];

  return (
    <ComingSoonView
      category="Product Manager"
      moduleName="Product Analytics & Dashboard"
      path="/products/dashboard"
      description="Stock velocity telemetry, replenishment forecasts, fast-moving items, and category revenue performance"
      badge="PRODUCT DASHBOARD"
      itemCount={38}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={analyticsData}
    />
  );
}
