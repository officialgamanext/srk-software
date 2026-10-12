import ComingSoonView from "@/components/ComingSoonView";

export default function InventoryPage() {
  const sampleInventory = [
    { id: "inv_101", sku_code: "WH-A1", product_name: "Warehouse Depot A (Bulk Dry Storage)", category: "Main Storage", price: "Capacity: 85%", stock_qty: "4,200 Units", barcode: "HYD-WH1", status: "In Stock" },
    { id: "inv_102", sku_code: "WH-B2", product_name: "Cold Storage Locker B (Dairy)", category: "Cold Chain 4°C", price: "Capacity: 60%", stock_qty: "850 Units", barcode: "HYD-CLD", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Retail Operations"
      moduleName="Inventory & Stock Movement"
      path="/inventory"
      description="Stock reconciliations, purchase orders (PO), vendor goods receipt note (GRN), and warehouse transfers"
      badge="STOCK LEDGER"
      itemCount={840}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleInventory}
    />
  );
}
