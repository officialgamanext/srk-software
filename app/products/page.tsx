import ComingSoonView from "@/components/ComingSoonView";

export default function ProductsPage() {
  const sampleProducts = [
    { id: "prd_01a", sku_code: "SKU-8801", product_name: "Organic Basmati Rice 5kg", category: "Grains & Cereals", price: "₹480.00", stock_qty: "45", barcode: "8901234567890", status: "In Stock" },
    { id: "prd_02b", sku_code: "SKU-8802", product_name: "Tata Tea Gold 500g", category: "Beverages", price: "₹310.00", stock_qty: "82", barcode: "8901234567891", status: "In Stock" },
    { id: "prd_03c", sku_code: "SKU-8803", product_name: "Aashirvaad Shudh Chakki Atta 10kg", category: "Flours & Staples", price: "₹450.00", stock_qty: "12", barcode: "8901234567892", status: "Low Stock" },
    { id: "prd_04d", sku_code: "SKU-8804", product_name: "Fortune Sunlite Refined Sunflower Oil 1L", category: "Edible Oils", price: "₹165.00", stock_qty: "140", barcode: "8901234567893", status: "In Stock" },
    { id: "prd_05e", sku_code: "SKU-8805", product_name: "Amul Pure Butter Salted 500g", category: "Dairy & Chilled", price: "₹275.00", stock_qty: "6", barcode: "8901234567894", status: "Low Stock" },
    { id: "prd_06f", sku_code: "SKU-8806", product_name: "Maggi Masala 2-Min Instant Noodles 70g", category: "Packaged Foods", price: "₹14.00", stock_qty: "320", barcode: "8901234567895", status: "In Stock" },
    { id: "prd_07g", sku_code: "SKU-8807", product_name: "Cadbury Dairy Milk Silk 150g", category: "Chocolates & Snacks", price: "₹175.00", stock_qty: "0", barcode: "8901234567896", status: "Out of Stock" },
  ];

  return (
    <ComingSoonView
      category="Product Manager"
      moduleName="Products Catalog"
      path="/products"
      description="Central inventory database for managing barcodes, retail prices, tax rates, and SKU stocks"
      badge="LIVE SCHEMA"
      itemCount={1248}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleProducts}
    />
  );
}
