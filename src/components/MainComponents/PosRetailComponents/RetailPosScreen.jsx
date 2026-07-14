import React, { useState } from "react";
import RetailTopBar from "./RetailTopBar";
import RetailEmptyState from "./RetailEmptyState";
import RetailRightPanel from "./RetailRightPanel";

const DEFAULT_CATEGORIES = [
  "All Items",
  "Food & Beverage",
  "Electronics",
  "Gifts",
  "Wine & Liquor",
  "Home & Garden",
];

const DEFAULT_QUICK_KEYS = [
  { label: "Plastic Bag" },
  { label: "Price Check" },
  { label: "Manual Entry" },
  { label: "Void Last Scan" },
];

const RetailPosScreen = ({
  transactionNumber = "00001",
  categories = DEFAULT_CATEGORIES,
  quickKeys = DEFAULT_QUICK_KEYS,
  cashier,
  onBarcodeSubmit,
  onProceedToPayment,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [searchValue, setSearchValue] = useState("");

  return (
    <div
      className="flex flex-1 min-h-0 min-w-0 overflow-hidden"
      style={{ backgroundColor: "var(--app-bg)" }}
    >
      <main className="flex flex-col flex-1 min-h-0 min-w-0">
        <RetailTopBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onBarcodeSubmit={onBarcodeSubmit}
        />
        <RetailEmptyState quickKeys={quickKeys} />
      </main>

      <RetailRightPanel
        transactionNumber={transactionNumber}
        isNewTransaction
        subtotal={0}
        discounts={0}
        tax={0}
        total={0}
        cashier={cashier}
        onProceedToPayment={onProceedToPayment}
      />
    </div>
  );
};

export default RetailPosScreen;
