import ComingSoonView from "@/components/ComingSoonView";

export default function CustomersPage() {
  const sampleCustomers = [
    { id: "cst_01", sku_code: "MEM-801", product_name: "Suresh Kumar", category: "+91 98765 43210", price: "Balance: ₹0", stock_qty: "420 Pts", barcode: "GOLD", status: "In Stock" },
    { id: "cst_02", sku_code: "MEM-802", product_name: "Ananya Sharma", category: "+91 98490 12345", price: "Credit: ₹1,500", stock_qty: "150 Pts", barcode: "SILVER", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Retail Operations"
      moduleName="Customers & Loyalty CRM"
      path="/customers"
      description="Member profiles, loyalty reward points, store credit khata ledgers, and SMS promotional campaigns"
      badge="CRM & LOYALTY"
      itemCount={520}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleCustomers}
    />
  );
}
