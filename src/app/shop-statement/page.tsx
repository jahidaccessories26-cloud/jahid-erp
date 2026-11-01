// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { PlusCircle, Trash2, TrendingUp, Search, X } from "lucide-react";

export default function ShopStatementPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // সার্চ ও ড্রপডাউন স্টেট
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    shop: "",
    type: "Sale",
    description: "", 
    amount: 0,
    date: new Date().toISOString().split("T")[0]
  });

  // প্রোডাক্ট ভ্যারিয়েশন ফ্ল্যাট করা (সার্চের জন্য)
  const allVariations = products.flatMap((p: any) =>
    (p.variations || []).map((v: any) => ({
      productId: p.id,
      productName: p.name,
      size: v.size,
      color: v.color,
      display: `${p.name} (${v.size} / ${v.color})`,
    }))
  );

  const filteredVariations = allVariations.filter((v) =>
    v.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !formData.shop) {
        setFormData(prev => ({ ...prev, shop: data[0].name }));
      }
    });

    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTrans = query(collection(db, "shop_statements"), orderBy("createdAt", "desc"));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // বাইরে ক্লিক করলে ড্রপডাউন বন্ধ হবে
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProductList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => { 
      unsubShops(); 
      unsubProducts(); 
      unsubTrans(); 
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [formData.shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shop || !formData.description || formData.amount <= 0) {
      alert("সব তথ্য সঠিকভাবে দিন!"); return;
    }

    try {
      await addDoc(collection(db, "shop_statements"), {
        ...formData,
        amount: Number(formData.amount),
        createdAt: new Date().toISOString()
      });
      setFormData({ ...formData, description: "", amount: 0 });
      setSearchTerm("");
      setShowForm(false);
      alert("Success: লেনদেন সেভ হয়েছে!");
    } catch (error) { alert("সেভ করতে সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই লেনদেনটি ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "shop_statements", id));
    }
  };

  // আজকের তারিখের হিসাব
  const today = new Date().toISOString().split("T")[0];
  const todayTrans = transactions.filter(t => t.date === today);
  
  const todaySales = todayTrans.filter(t => t.type === "Sale").reduce((sum, t) => sum + t.amount, 0);
  const todayExpenses = todayTrans.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const todayPurchases = todayTrans.filter(t => t.type === "Purchase").reduce((sum, t) => sum + t.amount, 0);
  const todayPayments = todayTrans.filter(t => t.type === "Party Payment").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <TrendingUp size={24} /> Daily Shop Statement
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <PlusCircle size={16} /> {showForm ? "Close Form" : "Add Transaction"}
        </button>
      </div>

      {/* সংক্ষিপ্ত হিসাব */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-xs text-gray-500">Today's Sales</p>
          <h3 className="text-xl font-bold text-green-600">৳{todaySales}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-xs text-gray-500">Today's Expense</p>
          <h3 className="text-xl font-bold text-red-600">৳{todayExpenses}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <p className="text-xs text-gray-500">Direct Purchase</p>
          <h3 className="text-xl font-bold text-blue-600">৳{todayPurchases}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-gray-600">
          <p className="text-xs text-gray-500">Party Payment</p>
          <h3 className="text-xl font-bold text-gray-700">৳{todayPayments}</h3>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
          <h3 className="font-bold text-sm mb-3 text-brand-navy">New Transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <select className="border p-2 rounded-lg text-sm" value={formData.shop} onChange={(e) => setFormData({...formData, shop: e.target.value})}>
              {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="border p-2 rounded-lg text-sm" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value, description: ""})}>
              <option value="Sale">Sale</option>
              <option value="Expense">Expense</option>
              <option value="Purchase">Direct Purchase</option>
              <option value="Party Payment">Party Payment</option>
            </select>

            {/* Sale হলে সার্চেবল ড্রপডাউন */}
            {formData.type === "Sale" ? (
              <div className="relative md:col-span-2" ref={dropdownRef}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Product..."
                    className="w-full border p-2 pl-9 rounded-lg text-sm"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductList(true);
                    }}
                    onFocus={() => setShowProductList(true)}
                  />
                  {searchTerm && (
                    <button 
                      type="button" 
                      onClick={() => { setSearchTerm(""); setFormData({...formData, description: ""}); }}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* ড্রপডাউন লিস্ট */}
                {showProductList && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredVariations.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">কোনো প্রোডাক্ট পাওয়া যায়নি।</div>
                    ) : (
                      filteredVariations.map((v, index) => (
                        <div
                          key={index}
                          className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, description: v.display });
                            setSearchTerm(v.display);
                            setShowProductList(false);
                          }}
                        >
                          {v.display}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <input required placeholder="Description" className="border p-2 rounded-lg text-sm md:col-span-2" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            )}

            <input required type="number" placeholder="Amount (Tk)" className="border p-2 rounded-lg text-sm" value={formData.amount || ""} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
            <input required type="date" className="border p-2 rounded-lg text-sm" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm">Save Transaction</button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description / Product</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-500">কোনো লেনদেন পাওয়া যায়নি।</td></tr>}
            {transactions.map(t => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{t.date}</td>
                <td className="px-4 py-3 font-medium text-brand-navy">{t.shop}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    t.type === 'Sale' ? 'bg-green-100 text-green-700' : 
                    t.type === 'Expense' ? 'bg-red-100 text-red-700' : 
                    t.type === 'Purchase' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                  }`}>{t.type}</span>
                </td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800">৳{t.amount}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
