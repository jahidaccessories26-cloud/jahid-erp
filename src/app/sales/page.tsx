// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, Download, Store } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialShop = searchParams.get("shop") || "All Shops";

  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState(initialShop);
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
    });
    const unsubSales = onSnapshot(query(collection(db, "shop_statements"), orderBy("date", "desc")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data.filter(s => s.type === 'Sale'));
    });
    return () => { unsubShops(); unsubSales(); };
  }, []);

  const filteredSales = sales
    .filter(s => selectedShop === "All Shops" || s.shop === selectedShop)
    .filter(s => (s.title || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = filteredSales.filter(s => s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const handleShare = () => {
    if (filteredSales.length === 0) return alert("ডেটা নেই!");
    const doc = new jsPDF();
    doc.text(`Sales History - ${selectedShop}`, 14, 15);
    const tableData = filteredSales.map(s => [new Date(s.date).toLocaleDateString(), s.shop, s.title, `৳${s.amount}`]);
    autoTable(doc, { head: [['Date', 'Shop', 'Product', 'Amount']], body: tableData, startY: 25 });
    doc.save(`Sales_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Sales History</h2>
        </div>
        <button onClick={handleShare} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Download size={16}/> PDF</button>
      </div>

      <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 font-bold border border-green-300">
        Today's Total Sales: ৳{todayTotal}
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-2">
        <div className="flex items-center gap-2 border rounded-lg px-2 py-1 flex-1">
          <Store size={16} className="text-gray-400" />
          <select className="w-full bg-transparent outline-none text-sm font-medium" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            <option value="All Shops">All Shops</option>
            {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 border rounded-lg px-2 py-1 flex-1">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Shop</th><th className="px-3 py-3">Details</th><th className="px-3 py-3 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-500">কোনো লেনদেন পাওয়া যায়নি।</td></tr>}
            {filteredSales.map(sale => (
              <tr key={sale.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-3 py-3 font-medium text-brand-navy">{sale.shop}</td>
                <td className="px-3 py-3">{sale.title}</td>
                <td className="px-3 py-3 text-right font-bold text-green-600">৳{sale.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
