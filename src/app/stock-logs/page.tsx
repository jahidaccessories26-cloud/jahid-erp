"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { History, Filter, ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function StockLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    const q = query(collection(db, "stock_logs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => filterType === "All" || log.type === filterType);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <History size={24} /> Stock History
        </h2>
        
        <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm w-full md:w-auto">
          <Filter size={18} className="text-brand-navy" />
          <select className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer text-sm w-full" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            <option value="Opening Stock">Opening Stock</option>
            <option value="Transfer">Warehouse Transfer</option>
            <option value="Corporate Delivery">Corporate Delivery</option>
            <option value="POS Sale">POS Sale</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Shop/Ref</th>
                <th className="px-4 py-3 font-semibold">Product Details</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">কোনো হিস্ট্রি পাওয়া যায়নি।</td>
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
                      <div className="font-medium text-brand-navy">{log.shop || "Warehouse"}</div>
                      {log.challanNo && <div className="text-[10px] text-gray-500">Inv: {log.challanNo}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{log.productName}</div>
                      <div className="text-[10px] text-gray-500">{log.size} / {log.color}</div>
                      {log.buyerName && <div className="text-[10px] text-gray-500">Buyer: {log.buyerName}</div>}
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
