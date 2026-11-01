// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { PlusCircle, Trash2, TrendingUp, Search, X, Edit, Filter, Calendar } from "lucide-react";

export default function ShopStatementPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // ইউজার স্টেট
  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  
  // ফিল্টার স্টেট
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterShop, setFilterShop] = useState("All");

  // ফর্ম স্টেট
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // এডিট করার জন্য
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    shop: "",
    type: "Sale",
    description: "", 
    amount: 0,
    date: new Date().toISOString().split("T")[0]
  });

  // প্রোডাক্ট ভ্যারিয়েশন ফ্ল্যাট করা
  const allVariations = products.flatMap((p: any) =>
    (p.variations || []).map((v: any) => ({
      display: `${p.name} (${v.size} / ${v.color})`,
    }))
  );

  const filteredVariations = allVariations.filter((v) =>
    v.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ডেটা লোড
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            setUserShop(docSnap.data().assignedShop || "");
            setFilterShop(docSnap.data().assignedShop || ""); // ম্যানেজারের নিজের দোকান ডিফল্ট
          }
        }
      }
    });

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
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProductList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => { 
      unsubAuth();
      unsubShops(); 
      unsubProducts(); 
      unsubTrans(); 
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shop || !formData.description || formData.amount <= 0) {
      alert("সব তথ্য সঠিকভাবে দিন!"); return;
    }

    try {
      if (editingId) {
        // এডিট আপডেট
        await updateDoc(doc(db, "shop_statements", editingId), {
          ...formData,
          amount: Number(formData.amount),
          updatedAt: new Date().toISOString()
        });
        alert("Success: লেনদেন আপডেট হয়েছে!");
      } else {
        // নতুন এন্ট্রি
        await addDoc(collection(db, "shop_statements"), {
          ...formData,
          amount: Number(formData.amount),
          createdAt: new Date().toISOString()
        });
        alert("Success: নতুন লেনদেন সেভ হয়েছে!");
      }
      resetForm();
    } catch (error) { alert("সেভ করতে সমস্যা হয়েছে!"); }
  };

  const resetForm = () => {
    setFormData({ ...formData, description: "", amount: 0 });
    setSearchTerm("");
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (t: any) => {
    setFormData({
      shop: t.shop,
      type: t.type,
      description: t.description,
      amount: t.amount,
      date: t.date
    });
    setSearchTerm(t.type === "Sale" ? t.description : "");
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই লেনদেনটি ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "shop_statements", id));
    }
  };

  // ডেটা ফিল্টার
  const filteredTransactions = transactions.filter(t => {
    const matchDate = filterDate ? t.date === filterDate : true;
    const matchShop = filterShop === "All" ? true : t.shop === filterShop;
    return matchDate && matchShop;
  });

  const totalSales = filteredTransactions.filter(t => t.type === "Sale").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const totalPurchases = filteredTransactions.filter(t => t.type === "Purchase").reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = filteredTransactions.filter(t => t.type === "Party Payment").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <TrendingUp size={24} /> Shop Statements
        </h2>
        <button 
          onClick={() => { setShowForm(!showForm); setEditingId(null); }} 
          className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <PlusCircle size={16} /> {showForm ? "Close Form" : "Add Transaction"}
        </button>
      </div>

      {/* ফিল্টার বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-2">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg flex-1">
          <Calendar size={16} className="text-gray-400" />
          <input 
            type="date" 
            className="w-full bg-transparent outline-none text-sm font-medium text-brand-navy"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        
        {userRole === "admin" && (
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg md:w-64">
            <Filter size={16} className="text-gray-400" />
            <select 
              className="w-full bg-transparent outline-none text-sm font-medium text-brand-navy cursor-pointer"
              value={filterShop}
              onChange={(e) => setFilterShop(e.target.value)}
            >
              <option value="All">All Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* সারসংক্ষেপ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-xs text-gray-500 mb-1">Total Sales</p>
          <h3 className="text-xl font-bold text-green-600">৳{totalSales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-xs text-gray-500 mb-1">Total Expense</p>
          <h3 className="text-xl font-bold text-red-600">৳{totalExpenses.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <p className="text-xs text-gray-500 mb-1">Direct Purchase</p>
          <h3 className="text-xl font-bold text-blue-600">৳{totalPurchases.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-gray-600">
          <p className="text-xs text-gray-500 mb-1">Party Payment</p>
          <h3 className="text-xl font-bold text-gray-700">৳{totalPayments.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
          <h3 className="font-bold text-sm mb-3 text-brand-navy">{editingId ? "Edit Transaction" : "New Transaction"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <select disabled={userRole !== "admin"} className="border p-2 rounded-lg text-sm bg-gray-50 disabled:opacity-70" value={formData.shop} onChange={(e) => setFormData({...formData, shop: e.target.value})}>
              {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="border p-2 rounded-lg text-sm" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value, description: ""})}>
              <option value="Sale">Sale</option>
              <option value="Expense">Expense</option>
              <option value="Purchase">Direct Purchase</option>
              <option value="Party Payment">Party Payment</option>
            </select>

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
                    <button type="button" onClick={() => { setSearchTerm(""); setFormData({...formData, description: ""}); }} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"><X size={16} /></button>
                  )}
                </div>
                {showProductList && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredVariations.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">কোনো প্রোডাক্ট পাওয়া যায়নি।</div>
                    ) : (
                      filteredVariations.map((v, index) => (
                        <div key={index} className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b last:border-0"
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
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm">{editingId ? "Update" : "Save"}</button>
            {editingId && <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>}
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
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
              {filteredTransactions.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-500">কোনো লেনদেন পাওয়া যায়নি।</td></tr>}
              {filteredTransactions.map(t => (
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
                  <td className="px-4 py-3 text-right font-bold text-gray-800">৳{t.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleEdit(t)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                    </div>
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
