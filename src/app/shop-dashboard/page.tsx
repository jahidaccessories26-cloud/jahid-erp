// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, ArrowLeft, ShoppingCart, Users, Box, Package, TrendingUp, Wallet } from "lucide-react";

export default function ShopDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopQuery = searchParams.get("shop"); // URL থেকে দোকানের নাম নিচ্ছে
  
  const [selectedShop, setSelectedShop] = useState(shopQuery || "");
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);

  // লোড হওয়ার সময় ডেটা আনা
  useEffect(() => {
    if (!selectedShop) return;

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopInventories(data.filter(item => item.shop === selectedShop));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopStatements(data.filter(item => item.shop === selectedShop));
    });

    return () => { unsubInv(); unsubStatements(); };
  }, [selectedShop]);

  // আজকের হিসাব
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStatements = shopStatements.filter(s => s.date?.startsWith(todayStr));
  const todaySales = todayStatements.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = todayStatements.filter(s => s.type === 'Expense').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = todayStatements.filter(s => s.type === 'Purchase').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      {/* হেডার */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{selectedShop || "Shop"} Dashboard</h2>
      </div>

      {/* ওভারভিউ কার্ড */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-green-500"><div className="text-xs text-gray-500">Today's Sales</div><h3 className="text-lg font-bold text-green-600">{todaySales}</h3></div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-red-500"><div className="text-xs text-gray-500">Expense</div><h3 className="text-lg font-bold text-red-600">{todayExpense}</h3></div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-blue-500"><div className="text-xs text-gray-500">Purchase</div><h3 className="text-lg font-bold text-blue-600">{todayPurchase}</h3></div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-brand-navy"><div className="text-xs text-gray-500">Profit/Loss</div><h3 className="text-lg font-bold text-brand-navy">{profitLoss}</h3></div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500 mb-6">
        <div className="text-sm text-gray-500">Total Stock Value</div>
        <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
      </div>

      {/* ✅ কুইক অ্যাকশন (যেগুলো দোকানের ভেতরে কাজ করবে) */}
      <h3 className="font-bold text-gray-700 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        
        <div onClick={() => router.push(`/sales?shop=${selectedShop}`)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-2">
          <div className="bg-green-50 p-3 rounded-full"><ShoppingCart className="text-green-600" size={24} /></div>
          <span className="font-bold text-gray-700 text-sm text-center">Sales</span>
        </div>

        <div onClick={() => router.push(`/buyer-statement?shop=${selectedShop}`)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-2">
          <div className="bg-purple-50 p-3 rounded-full"><Users className="text-purple-600" size={24} /></div>
          <span className="font-bold text-gray-700 text-sm text-center">Buyers</span>
        </div>

        <div onClick={() => router.push(`/samples?shop=${selectedShop}`)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-2">
          <div className="bg-teal-50 p-3 rounded-full"><Box className="text-teal-600" size={24} /></div>
          <span className="font-bold text-gray-700 text-sm text-center">Samples</span>
        </div>

        <div onClick={() => router.push(`/shop-inventory?shop=${selectedShop}`)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-2">
          <div className="bg-blue-50 p-3 rounded-full"><Package className="text-blue-600" size={24} /></div>
          <span className="font-bold text-gray-700 text-sm text-center">Stock</span>
        </div>

        <div onClick={() => router.push(`/shop-statement?shop=${selectedShop}`)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-2">
          <div className="bg-orange-50 p-3 rounded-full"><Wallet className="text-orange-600" size={24} /></div>
          <span className="font-bold text-gray-700 text-sm text-center">Expense</span>
        </div>

      </div>
    </div>
  );
}
