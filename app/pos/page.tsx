import ComingSoonView from "@/components/ComingSoonView";

export default function PosPage() {
  const samplePosLanes = [
    { id: "lane_01", sku_code: "COUNTER-1", product_name: "Cashier Counter A (Express Lane)", category: "Terminal #01", price: "₹24,850.00", stock_qty: "42 Bills", barcode: "READY", status: "In Stock" },
    { id: "lane_02", sku_code: "COUNTER-2", product_name: "Cashier Counter B (Main Lane)", category: "Terminal #02", price: "₹38,910.00", stock_qty: "58 Bills", barcode: "READY", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Retail Operations"
      moduleName="Point of Sale (POS) Terminal"
      path="/pos"
      description="High-speed barcode scanner billing lane with ESC/POS thermal receipt printing and multi-tender payments"
      badge="HARDWARE READY"
      itemCount={2}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={samplePosLanes}
    />
  );
}
