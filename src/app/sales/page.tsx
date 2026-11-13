// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, orderBy, addDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Download, Store, Edit, Trash2, PlusCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesHistoryPage() {
  const router = useRouter();
  
  // ✅ LocalStorage থেকে দোকানের নাম নেওয়া হচ্ছে (URL এর ঝামেলা বাদ)
  const [selectedShop, setSelectedShop] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeShop") || "All Shops";
    }
    return "All Shops";
  });

  const [shops, setShops] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // এডিট স্টেট
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editData, setEditData] = useState({ title: "", amount: 0 });

  // নতুন সেল স্টেট
  const [showAddSale, setShowAddSale] = useState(false);
  const [newSaleData, setNewSaleData] = useState({ productId: "", qty: "", amount: "", shop: "" });
  const [prodSearch, setProdSearch] = useState("");

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    const unsubSales = onSnapshot(query(collection(db, "shop_statements"), orderBy("date", "desc")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data.filter(s => s.type === 'Sale'));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubSales(); unsubProducts(); };
  }, []);

  // সিলেক্টেড শপ পরিবর্তন হলে LocalStorage আপডেট
  const handleShopChange = (shopName: string) => {
    setSelectedShop(shopName);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeShop", shopName);
    }
  };

  const filteredSales = sales
    .filter(s => selectedShop === "All Shops" || s.shop === selectedShop)
    .filter(s => (s.title || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTotal = filteredSales.filter(s => s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const handleSaveNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === newSaleData.productId);
      if (!prod || prod.stock < Number(newSaleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");
      
      await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(newSaleData.qty)) });
      await addDoc(collection(db, "shop_statements"), {
        shop: newSaleData.shop || selectedShop, type: "Sale", title: prod.productName, amount: Number(newSaleData.amount), date: new Date().toISOString()
      });
      
      setShowAddSale(false); setNewSaleData({ productId: "", qty: "", amount: "", shop: "" }); setProdSearch("");
      alert("নতুন সেল সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "shop_statements", editingSale.id), { title: editData.title, amount: Number(editData.amount) });
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
    doc.text(`Sales History - ${selectedShop}`, 14, 15);
    const tableData = filteredSales.map(s => [new Date(s.date).toLocaleDateString(), s.shop, s.title, `৳${s.amount}`]);
    autoTable(doc, { head: [['Date', 'Shop', 'Product', 'Amount']], body: tableData, startY: 25 });
    doc.save(`Sales_${Date.now()}.pdf`);
  };

  const searchedProducts = products.filter(p => 
    p.shop === (newSaleData.shop || selectedShop) && 
    p.productName.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Sales History</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setNewSaleData({...newSaleData, shop: selectedShop === "All Shops" ? "" : selectedShop}); setShowAddSale(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><PlusCircle size={16}/> Add New Sale</button>
          <button onClick={handleShare} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Download size={16}/> PDF</button>
        </div>
      </div>

      <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 font-bold border border-green-300">
        Today's Total Sales: ৳{todayTotal}
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-2">
        <div className="flex items-center gap-2 border rounded-lg px-2 py-1 flex-1">
          <Store size={16} className="text-gray-400" />
          <select className="w-full bg-transparent outline-none text-sm font-medium" value={selectedShop} onChange={(e) => handleShopChange(e.target.value)}>
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

      {/* নতুন সেল করার মডাল */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add New Sale</h3>
            <form onSubmit={handleSaveNewSale} className="space-y-3">
              <div>
                <label className="text-xs">Shop</label>
                <select className="w-full border p-2 rounded" value={newSaleData.shop} onChange={e => setNewSaleData({...newSaleData, shop: e.target.value})}>
                  <option value="">-- Select Shop --</option>
                  {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Search Product</label>
                <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                  {searchedProducts.map(p => (
                    <div key={p.id} onClick={() => { setNewSaleData({...newSaleData, productId: p.id, amount: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} - Stock: {p.stock}</div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={newSaleData.qty} onChange={e => setNewSaleData({...newSaleData, qty: e.target.value})} /></div>
                <div><label className="text-xs">Total Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={newSaleData.amount} onChange={e => setNewSaleData({...newSaleData, amount: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSale(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
