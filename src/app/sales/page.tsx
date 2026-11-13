// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, Download, Store, Edit, Trash2, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopParam = searchParams.get("shop"); // URL থেকে দোকানের নাম নিচ্ছে

  const [shops, setShops] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // ✅ ডিফল্টভাবে URL-এর দোকান সিলেক্ট থাকবে
  const [selectedShop, setSelectedShop] = useState(shopParam || "All Shops");

  // এডিট স্টেট
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editData, setEditData] = useState({ title: "", amount: 0 });

  useEffect(() => {
    // দোকানের লিস্ট লোড
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    // সেলস লোড
    const unsubSales = onSnapshot(query(collection(db, "shop_statements"), orderBy("date", "desc")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data.filter(s => s.type === 'Sale'));
    });

    return () => { unsubShops(); unsubSales(); };
  }, []);

  // ডেটা ফিল্টার
  const filteredSales = sales
    .filter(s => selectedShop === "All Shops" || s.shop === selectedShop)
    .filter(s => (s.title || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = filteredSales.filter(s => s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // এডিট সেভ
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "shop_statements", editingSale.id), { title: editData.title, amount: Number(editData.amount) });
      setEditingSale(null); alert("আপডেট হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডিলিট
  const handleDelete = async (id: string) => {
    if (window.confirm("এই সেলস ডিলিট করতে চান? (স্টক ফেরত আসবে না)")) {
      await deleteDoc(doc(db, "shop_statements", id));
    }
  };

  // PDF ডাউনলোড
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

      {/* সার্চ ও ফিল্টার */}
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

      {/* টেবিল */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-brand-navy text-white">
            <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Shop</th><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-center">Action</th></tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">কোনো লেনদেন পাওয়া যায়নি।</td></tr>}
            {filteredSales.map(sale => (
              <tr key={sale.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-3 py-3 font-medium text-brand-navy">{sale.shop}</td>
                <td className="px-3 py-3">{sale.title}</td>
                <td className="px-3 py-3 text-right font-bold text-green-600">৳{sale.amount}</td>
                <td className="px-3 py-3 flex justify-center gap-2">
                  <button onClick={() => { setEditingSale(sale); setEditData({ title: sale.title, amount: sale.amount }); }} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => handleDelete(sale.id)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* এডিট মডাল */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Edit Sale</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div><label className="text-xs">Details</label><input required className="w-full border p-2 rounded" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={editData.amount} onChange={e => setEditData({...editData, amount: Number(e.target.value)})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingSale(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Suspense দিয়ে র‍্যাপ করা হলো যাতে URL প্যারামিটার ঠিকমতো কাজ করে
export default function SalesPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <SalesHistoryContent />
    </Suspense>
  );
}
