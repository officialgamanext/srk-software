import ComingSoonView from "@/components/ComingSoonView";

export default function OrdersPage() {
  const sampleOrders = [
    { id: "ord_1001", sku_code: "BILL-54201", product_name: "Walk-in Retail Customer", category: "Cash Sale", price: "₹1,240.00", stock_qty: "6 Items", barcode: "POS-01", status: "In Stock" },
    { id: "ord_1002", sku_code: "BILL-54202", product_name: "Ramesh Sharma (Member #48)", category: "UPI PhonePe", price: "₹2,680.00", stock_qty: "12 Items", barcode: "POS-01", status: "In Stock" },
    { id: "ord_1003", sku_code: "BILL-54203", product_name: "Pooja Reddy (Member #192)", category: "Card HDFC", price: "₹890.00", stock_qty: "3 Items", barcode: "POS-02", status: "In Stock" },
  ];

  return (
    <ComingSoonView
      category="Retail Operations"
      moduleName="Orders & Sales Invoices"
      path="/orders"
      description="Sales ledger, daily closing Z-reports, customer receipts, and return/refund processing"
      badge="LEDGER"
      itemCount={1420}
      columns={["id", "sku_code", "product_name", "category", "price", "stock_qty", "barcode", "status"]}
      sampleData={sampleOrders}
    />
  );
}
