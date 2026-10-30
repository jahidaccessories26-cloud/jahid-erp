"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Search, Receipt, User, Store } from "lucide-react";

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("All Shops"); // ডিফল্ট সব দোকান
  const [searchTerm, setSearchTerm] = useState("");

  // ফায়ারবেস থেকে সেলস ডেটা আনা
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSales(data);
    });
    return () => unsubscribe();
  }, []);

  // ফায়ারবেস থেকে দোকানের লিস্ট আনা
  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
    });
    return () => unsubShops();
  }, []);

  // সার্চ এবং দোকান অনুযায়ী ফিল্টার
  const filteredSales = sales.filter((sale) => {
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = 
      sale.customerName?.toLowerCase().includes(searchString) ||
      sale.customerPhone?.includes(searchString) ||
      sale.productName?.toLowerCase().includes(searchString);
    
    // দোকান ফিল্টার
    const matchesShop = selectedShop === "All Shops" || sale.shop === selectedShop;

    return matchesSearch && matchesShop;
  });

  // আজকের মোট সেলস বের করা (ফিল্টার অনুযায়ী)
  const today = new Date().toISOString().split("T")[0];
  const todaySales = filteredSales.filter(s => s.date.startsWith(today));
  const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
          <Receipt size={28} /> Sales History
        </h2>
        
        {/* আজকের সেলস সামারি */}
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold border border-green-300">
          Today's Total Sales: Tk. {todayTotal}
        </div>
      </div>

      {/* ফিল্টার এবং সার্চ বার */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
        
        {/* দোকান সিলেক্ট */}
        <div className="flex items-center gap-2 bg-gray-50 border p-2 rounded-lg">
          <Store size={20} className="text-brand-navy" />
          <select 
            className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer w-full md:w-auto"
            value={selectedShop} 
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="All Shops">All Shops</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.name}>{shop.name}</option>
            ))}
          </select>
        </div>

        {/* সার্চ বার */}
        <div className="flex-1 flex items-center gap-3 bg-gray-50 border p-2 rounded-lg">
          <Search className="text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by Customer, Mobile or Product..." 
            className="flex-1 outline-none bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* সেলস টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-navy text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Shop</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-center">Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Total (Tk.)</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">কোনো সেলস রেকর্ড পাওয়া যায়নি।</td>
                </tr>
              )}
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-500">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-brand-navy flex items-center gap-1"><User size={14}/> {sale.customerName}</div>
                    <div className="text-xs text-gray-500">{sale.customerPhone}</div>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{sale.shop}</td>
                  <td className="px-4 py-4 font-medium">{sale.productName} <span className="text-xs text-gray-400">({sale.size}/{sale.color})</span></td>
                  <td className="px-4 py-4 text-center font-bold">{sale.quantity}</td>
                  <td className="px-4 py-4 text-right font-bold text-green-600">{sale.totalAmount}</td>
                  <td className="px-4 py-4">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{sale.paymentMethod}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
