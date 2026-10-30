"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Store, Package } from "lucide-react";

export default function ShopInventoryPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);

  // ফায়ারবেস থেকে দোকানের লিস্ট আনা
  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0].name);
      }
    });
    return () => unsubShops();
  }, [selectedShop]);

  // নির্দিষ্ট দোকানের ইনভেন্টরি আনা
  useEffect(() => {
    if (!selectedShop) return;

    const qInv = query(collection(db, "shop_inventories"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      // এখানে map এবং filter আলাদা করা হয়েছে যাতে টাইপ এরর না আসে
      const allData: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filteredData = allData.filter((item) => item.shop === selectedShop);
      setInventory(filteredData);
    });
    return () => unsubInv();
  }, [selectedShop]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy">Shop Inventory</h2>
        
        {/* দোকান সিলেক্ট করার ড্রপডাউন */}
        <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
          <Store size={20} className="text-brand-navy" />
          <select 
            className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer"
            value={selectedShop} 
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.name}>{shop.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ইনভেন্টরি টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <Package size={20} /> Stock at {selectedShop || "Select a Shop"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-3 font-semibold">Product Name</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Size</th>
                <th className="px-6 py-3 font-semibold">Color</th>
                <th className="px-6 py-3 font-semibold text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    এই দোকানে এখনো কোনো মাল পাঠানো হয়নি।
                  </td>
                </tr>
              )}
              {inventory.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-brand-navy">{item.productName}</td>
                  <td className="px-6 py-4 text-gray-500">{item.category}</td>
                  <td className="px-6 py-4 font-semibold">{item.size}</td>
                  <td className="px-6 py-4">{item.color}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600 text-lg">
                    {item.stock} <span className="text-xs text-gray-400 font-normal">pcs</span>
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
