"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { History, ArrowDownRight, ArrowUpRight, Store, Building2 } from "lucide-react";

export default function StockLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("All"); // 'All', 'Warehouse', বা দোকানের নাম

  useEffect(() => {
    // লগ ডেটা আনা
    const qLogs = query(collection(db, "stock_logs"), orderBy("createdAt", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // দোকানের লিস্ট আনা (ট্যাব তৈরি করার জন্য)
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLogs(); unsubShops(); };
  }, []);

  // লোকেশন অনুযায়ী ডেটা ফিল্টার
  const filteredLogs = logs.filter(log => {
    if (selectedLocation === "All") return true;
    if (selectedLocation === "Warehouse") return log.shop === "Warehouse" || !log.shop; // ওয়্যারহাউসের লগ
    return log.shop === selectedLocation; // নির্দিষ্ট দোকানের লগ
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2 mb-4">
        <History size={24} /> Stock History
      </h2>

      {/* লোকেশন ট্যাব */}
      <div className="flex overflow-x-auto gap-2 mb-4 pb-2">
        <button 
          onClick={() => setSelectedLocation("All")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedLocation === "All" ? "bg-brand-navy text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}
        >
          All Locations
        </button>
        
        <button 
          onClick={() => setSelectedLocation("Warehouse")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-1 ${selectedLocation === "Warehouse" ? "bg-brand-navy text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}
        >
          <Building2 size={16} /> Warehouse
        </button>

        {shops.map((shop) => (
          <button 
            key={shop.id}
            onClick={() => setSelectedLocation(shop.name)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-1 ${selectedLocation === shop.name ? "bg-brand-navy text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}
          >
            <Store size={16} /> {shop.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Product Details</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">এই লোকেশনে কোনো হিস্ট্রি পাওয়া যায়নি।</td>
                </tr>
              )}
              {filteredLogs.map((log) => {
                const isOutgoing = ["POS Sale", "Corporate Delivery", "Transfer"].includes(log.type);
                const isIncoming = ["Opening Stock", "Transfer In"].includes(log.type);
                
                return (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">
                      <div className="text-xs font-medium text-gray-800">{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px]">{new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        log.type === 'POS Sale' ? 'bg-green-100 text-green-700' : 
                        log.type === 'Corporate Delivery' ? 'bg-red-100 text-red-700' :
                        log.type === 'Opening Stock' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-800'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{log.productName}</div>
                      <div className="text-[10px] text-gray-500">{log.size} / {log.color}</div>
                      {log.challanNo && <div className="text-[10px] text-brand-navy font-medium">Inv: {log.challanNo}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`font-bold flex items-center justify-end gap-1 ${isOutgoing ? 'text-red-600' : isIncoming ? 'text-green-600' : 'text-brand-navy'}`}>
                        {isOutgoing ? <ArrowDownRight size={14}/> : isIncoming ? <ArrowUpRight size={14}/> : null}
                        {log.quantity}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
