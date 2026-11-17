// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, orderBy, addDoc, increment } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, Download, Store, Edit, Trash2, PlusCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopName = searchParams.get("shop") || "";

  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // এডিট স্টেট
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editData, setEditData] = useState({ title: "", qty: 0, price: 0, amount: 0 });

  // নতুন সেল স্টেট
  const [showAddSale, setShowAddSale] = useState(false);
  const [newSaleData, setNewSaleData] = useState({ productId: "", productName: "", qty: "", salePrice: "", amount: "" });
  const [prodSearch, setProdSearch] = useState("");

  useEffect(() => {
    if (!shopName) return;

    const unsubSales = onSnapshot(query(collection(db, "shop_statements"), orderBy("date", "desc")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data.filter(s => s.shop === shopName && s.type === 'Sale'));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data.filter(p => p.shop === shopName));
    });

    return () => { unsubSales(); unsubProducts(); };
  }, [shopName]);

  // ✅ অটোমেটিক টোটাল টাকা হিসাব
  useEffect(() => {
    const qty = Number(newSaleData.qty) || 0;
    const price = Number(newSaleData.salePrice) || 0;
    if (qty > 0 && price > 0) {
      setNewSaleData(prev => ({ ...prev, amount: (qty * price).toString() }));
    } else {
      setNewSaleData(prev => ({ ...prev, amount: "" }));
    }
  }, [newSaleData.qty, newSaleData.salePrice]);

  const filteredSales = sales.filter(s => (s.title || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = filteredSales.filter(s => s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const handleSaveNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === newSaleData.productId);
      if (!prod || prod.stock < Number(newSaleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");
      
      await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(newSaleData.qty)) });
      await addDoc(collection(db, "shop_statements"), {
        shop: shopName, type: "Sale", title: prod.productName, qty: Number(newSaleData.qty), price: Number(newSaleData.salePrice), amount: Number(newSaleData.amount), date: new Date().toISOString()
      });
      
      setShowAddSale(false); setNewSaleData({ productId: "", productName: "", qty: "", salePrice: "", amount: "" }); setProdSearch("");
      alert("নতুন সেল সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "shop_statements", editingSale.id), { title: editData.title, qty: Number(editData.qty), price: Number(editData.price), amount: Number(editData.amount) });
      setEditingSale(null); alert("আপডেট হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("এই সেলস ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "shop_statements", id));
    }
  };

  const handleShare = () => {
    if (filteredSales.length === 0) return alert("ডেটা নেই!");
    const doc = new jsPDF();
    doc.text(`Sales History - ${shopName}`, 14, 15);
    const tableData = filteredSales.map(s => [new Date(s.date).toLocaleDateString(), s.title, s.qty || "-", s.price || "-", `৳${s.amount}`]);
    autoTable(doc, { head: [['Date', 'Product', 'Qty', 'Price', 'Total']], body: tableData, startY: 25 });
    doc.save(`Sales_${Date.now()}.pdf`);
  };

  const searchedProducts = products.filter(p => p.productName.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Sales History</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setShowAddSale(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 flex-1 justify-center md:flex-none"><PlusCircle size={16}/> Add Sale</button>
          <button onClick={handleShare} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Download size={16}/> PDF</button>
        </div>
      </div>

      <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 font-bold border border-green-300">
        Today's Total Sales: ৳{todayTotal}
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Store size={16} className="text-gray-400 ml-2" />
        <span className="font-bold text-sm text-brand-navy py-1">{shopName}</span>
      </div>

      <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-sm mb-4">
        <Search size={16} className="text-gray-400" />
        <input type="text" placeholder="Search..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* মোবাইল ফ্রেন্ডলি কার্ড ডিজাইন */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="md:hidden p-3 space-y-3 bg-gray-50">
          {filteredSales.length === 0 && <p className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</p>}
          {filteredSales.map(sale => (
            <div key={sale.id} className="bg-white p-3 rounded-lg border shadow-sm">
              <div className="flex justify-between items-start border-b pb-2 mb-2">
                <div>
                  <p className="font-bold text-brand-navy">{sale.title}</p>
                  <p className="text-[11px] text-gray-500">{new Date(sale.date).toLocaleDateString()}</p>
                </div>
                <p className="font-bold text-green-600">৳{sale.amount}</p>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Qty: {sale.qty || "-"} | Price: ৳{sale.price || "-"}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingSale(sale); setEditData({ title: sale.title, qty: sale.qty, price: sale.price, amount: sale.amount }); }} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => handleDelete(sale.id)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ডেস্কটপ টেবিল */}
        <table className="w-full text-left text-sm hidden md:table">
          <thead className="bg-brand-navy text-white">
            <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-center">Qty</th><th className="px-3 py-3 text-right">Price</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-center">Action</th></tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</td></tr>}
            {filteredSales.map(sale => (
              <tr key={sale.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-3 py-3 font-medium text-brand-navy">{sale.title}</td>
                <td className="px-3 py-3 text-center">{sale.qty || "-"}</td>
                <td className="px-3 py-3 text-right">৳{sale.price || "-"}</td>
                <td className="px-3 py-3 text-right font-bold text-green-600">৳{sale.amount}</td>
                <td className="px-3 py-3 flex justify-center gap-2">
                  <button onClick={() => { setEditingSale(sale); setEditData({ title: sale.title, qty: sale.qty, price: sale.price, amount: sale.amount }); }} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => handleDelete(sale.id)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* নতুন সেল করার মডাল */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add New Sale</h3>
            <form onSubmit={handleSaveNewSale} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Shop</label>
                <div className="w-full border p-2 rounded bg-gray-50 text-brand-navy font-medium">{shopName}</div>
              </div>
              <div className="relative">
                <label className="text-xs font-bold text-gray-700">Search Product</label>
                <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                {prodSearch && (
                  <div className="absolute w-full max-h-32 overflow-y-auto border rounded bg-white shadow-lg z-10">
                    {searchedProducts.map(p => (
                      <div key={p.id} onClick={() => { setNewSaleData({...newSaleData, productId: p.id, productName: p.productName, salePrice: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50 flex justify-between">
                        <span>{p.productName}</span>
                        <span className="text-gray-500">Stock: {p.stock}</span>
                      </div>
                    ))}
                  </div>
                )}
                {newSaleData.productName && <p className="text-xs text-green-600 font-bold mt-1">Selected: {newSaleData.productName}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Quantity</label>
                  <input required type="number" className="w-full border p-2 rounded" value={newSaleData.qty} onChange={e => setNewSaleData({...newSaleData, qty: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Sale Price (৳)</label>
                  <input required type="number" className="w-full border p-2 rounded" value={newSaleData.salePrice} onChange={e => setNewSaleData({...newSaleData, salePrice: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Total Amount (৳)</label>
                <input required type="number" className="w-full border p-2 rounded font-bold text-green-600 text-lg bg-green-50" value={newSaleData.amount} readOnly />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSale(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* এডিট মডাল */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Edit Sale</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div><label className="text-xs">Product</label><input required className="w-full border p-2 rounded" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={editData.qty} onChange={e => setEditData({...editData, qty: Number(e.target.value)})} /></div>
                <div><label className="text-xs">Sale Price</label><input required type="number" className="w-full border p-2 rounded" value={editData.price} onChange={e => setEditData({...editData, price: Number(e.target.value)})} /></div>
              </div>
              <div><label className="text-xs">Total Amount</label><input required type="number" className="w-full border p-2 rounded font-bold text-green-600" value={editData.amount} onChange={e => setEditData({...editData, amount: Number(e.target.value)})} /></div>
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

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <SalesHistoryContent />
    </Suspense>
  );
}
