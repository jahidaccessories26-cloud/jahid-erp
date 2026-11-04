// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment, deleteDoc, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder, ChevronRight, Search, Edit, Trash2, Users } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  const [shopBuyers, setShopBuyers] = useState<any[]>([]);

  // ভিউ স্টেট (ড্যাশবোর্ড, ক্যাটাগরি, প্রোডাক্ট, বায়ারglass)
  const [viewMode, setViewMode] = useState<"dashboard" | "main" | "sub" | "product" | "buyers" | "buyer_statement">("dashboard");
  const [selectedMain, setSelectedMain] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // পপ-আপ স্টেটসমূহ
  const [showDailyEntry, setShowDailyEntry] = useState(false);
  const [dailyEntryData, setDailyEntryData] = useState({ type: "Sale", title: "", amount: "" });
  
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", phone: "" });

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<any>({ id: "", name: "", mainCategory: "", subCategory: "", variations: [] });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") setUserRole("admin");
        else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            if (docSnap.data().assignedShop) setSelectedShop(docSnap.data().assignedShop);
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });
    return () => unsubShops();
  }, [selectedShop]);

  useEffect(() => {
    if (!selectedShop) return;
    
    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopInventories(data.filter(item => item.shop === selectedShop));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopStatements(data.filter(item => item.shop === selectedShop));
    });

    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopBuyers(data.filter(item => item.shop === selectedShop));
    });

    return () => { unsubInv(); unsubStatements(); unsubBuyers(); };
  }, [selectedShop]);

  // আজকের হিসাব
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStatements = shopStatements.filter(s => s.date?.startsWith(todayStr));

  const todaySales = todayStatements.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = todayStatements.filter(s => s.type === 'Expense').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = todayStatements.filter(s => s.type === 'Purchase').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  // ডেইলি এন্ট্রি সেভ
  const handleDailyEntrySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "shop_statements"), {
        shop: selectedShop,
        type: dailyEntryData.type,
        title: dailyEntryData.title,
        amount: Number(dailyEntryData.amount),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      setShowDailyEntry(false);
      setDailyEntryData({ type: "Sale", title: "", amount: "" });
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // বায়ার অ্যাড/এডিট সেভ
  const handleBuyerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (buyerFormData.id) {
        await updateDoc(doc(db, "buyers", buyerFormData.id), {
          name: buyerFormData.name, phone: buyerFormData.phone
        });
      } else {
        await addDoc(collection(db, "buyers"), {
          shop: selectedShop, name: buyerFormData.name, phone: buyerFormData.phone, createdAt: new Date().toISOString()
        });
      }
      setShowBuyerModal(false);
      setBuyerFormData({ id: "", name: "", phone: "" });
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // বায়ার ডিলিট
  const handleDeleteBuyer = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" কে ডিলিট করতে চান?`)) return;
    await deleteDoc(doc(db, "buyers", id));
  };

  // লেনদেন ডিলিট (History থেকে)
  const handleDeleteStatement = async (id: string) => {
    if (!window.confirm(`লেনদেনটি ডিলিট করতে চান?`)) return;
    await deleteDoc(doc(db, "shop_statements", id));
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      {/* হেডার */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (viewMode === "dashboard") router.push("/");
            else if (viewMode === "main" || viewMode === "buyers") setViewMode("dashboard");
            else if (viewMode === "sub") setViewMode("main");
            else if (viewMode === "product") setViewMode("sub");
            else if (viewMode === "buyer_statement") setViewMode("buyers");
          }} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">
            {viewMode === "dashboard" ? "Shop Dashboard" : viewMode === "main" ? "Stock Categories" : viewMode === "sub" ? selectedMain : viewMode === "product" ? selectedSub : viewMode === "buyers" ? "Buyers / Parties" : selectedBuyer?.name}
          </h2>
        </div>
      </div>

      {viewMode === "dashboard" && (
        <>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
            <Store size={18} className="text-brand-navy ml-2" />
            <select className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
              {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl border-t-4 border-green-500"><div className="text-xs text-gray-500">Today's Sales</div><h3 className="text-lg font-bold text-green-600">{todaySales}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-red-500"><div className="text-xs text-gray-500">Expense</div><h3 className="text-lg font-bold text-red-600">{todayExpense}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500"><div className="text-xs text-gray-500">Purchase</div><h3 className="text-lg font-bold text-blue-600">{todayPurchase}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-brand-navy"><div className="text-xs text-gray-500">Profit/Loss</div><h3 className="text-lg font-bold text-brand-navy">{profitLoss}</h3></div>
          </div>

          <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-4">
            <div className="text-sm text-gray-500">Total Stock Value</div>
            <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>

          {/* অ্যাকশন বাটনসমূহ */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setShowDailyEntry(true)} className="bg-brand-navy text-white p-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm">
              <PlusCircle size={16} /> Daily Entry
            </button>
            <button onClick={() => setViewMode("buyers")} className="bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm">
              <Users size={16} /> Buyers / Parties
            </button>
          </div>

          <div onClick={() => setViewMode("main")} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-pointer flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Folder size={20} className="text-brand-navy" /></div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">Stock / Products</h3>
                <p className="text-[11px] text-gray-500">View products by category</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          {/* Today's History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-sm">Today's History</div>
            <div className="p-3 space-y-2">
              {todayStatements.length === 0 && <p className="text-center text-sm text-gray-400 py-2">আজকে কোনো লেনদেন নেই।</p>}
              {todayStatements.map((stmt) => (
                <div key={stmt.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-bold text-brand-navy text-sm">{stmt.title}</p>
                    <p className="text-[10px] text-gray-500">{stmt.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${stmt.type === 'Sale' ? 'text-green-600' : 'text-red-600'}`}>৳{stmt.amount}</span>
                    <button onClick={() => handleDeleteStatement(stmt.id)} className="text-red-500 bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Buyers List */}
      {viewMode === "buyers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">All Buyers</h3>
            <button onClick={() => { setBuyerFormData({ id: "", name: "", phone: "" }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
              <PlusCircle size={16}/> Add Buyer
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shopBuyers.map(buyer => (
              <div key={buyer.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="cursor-pointer" onClick={() => { setSelectedBuyer(buyer); setViewMode("buyer_statement"); }}>
                  <p className="font-bold text-brand-navy text-sm">{buyer.name}</p>
                  <p className="text-[11px] text-gray-500">{buyer.phone}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setBuyerFormData(buyer); setShowBuyerModal(true); }} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => handleDeleteBuyer(buyer.id, buyer.name)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buyer Statement (খাতা) */}
      {viewMode === "buyer_statement" && selectedBuyer && (
        <div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-brand-navy mb-4">
            <h3 className="text-lg font-bold text-brand-navy">{selectedBuyer.name}</h3>
            <p className="text-sm text-gray-500">{selectedBuyer.phone}</p>
            {/* এখানে ভবিষ্যতে অর্ডার, ডেলিভারি ও পেমেন্টের হিসাব বসবে */}
            <p className="text-sm text-gray-400 mt-4 text-center">Order, Delivery & Payment features coming soon...</p>
          </div>
        </div>
      )}

      {/* Stock Categories & Products (আগের মতোই) */}
      {viewMode === "main" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {["Cotton", "Polestar"].map(cat => (
            <div key={cat} onClick={() => { setSelectedMain(cat); setViewMode("sub"); }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center gap-2">
              <Folder size={32} className="text-brand-navy" />
              <h3 className="text-lg font-bold text-brand-navy">{cat}</h3>
            </div>
          ))}
        </div>
      )}

      {viewMode === "sub" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from(new Set(shopInventories.filter(p => p.mainCategory === selectedMain).map(p => p.subCategory))).map(sub => (
            <div key={sub} onClick={() => { setSelectedSub(sub); setViewMode("product"); }} className="bg-white p-4 rounded-xl shadow-sm cursor-pointer flex items-center justify-between">
              <span className="font-bold text-gray-700">{sub}</span><ChevronRight size={18} className="text-gray-400" />
            </div>
          ))}
        </div>
      )}

      {viewMode === "product" && (
        <div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-4">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr><th className="px-2 py-3">Product</th><th className="px-2 py-3 text-center">Stock</th></tr>
              </thead>
              <tbody>
                {shopInventories.filter(p => p.mainCategory === selectedMain && p.subCategory === selectedSub).map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-3">
                      <div className="font-bold text-brand-navy">{item.productName}</div>
                      <div className="text-[10px] text-gray-500">{item.size} / {item.color}</div>
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-green-600">{item.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Entry Modal */}
      {showDailyEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add Daily Entry</h3>
            <form onSubmit={handleDailyEntrySave} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Entry Type</label>
                <select className="w-full border p-2 rounded" value={dailyEntryData.type} onChange={e => setDailyEntryData({...dailyEntryData, type: e.target.value})}>
                  <option value="Sale">Sale (বিক্রি)</option>
                  <option value="Expense">Expense (খরচ)</option>
                  <option value="Purchase">Purchase (বাইরের মাল ক্রয়)</option>
                </select>
              </div>
              <div><label className="text-xs">Title / Description</label><input required className="w-full border p-2 rounded" value={dailyEntryData.title} onChange={e => setDailyEntryData({...dailyEntryData, title: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={dailyEntryData.amount} onChange={e => setDailyEntryData({...dailyEntryData, amount: e.target.value})} /></div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDailyEntry(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Buyer Modal */}
      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})} /></div>
              <div><label className="text-xs">Phone</label><input className="w-full border p-2 rounded" value={buyerFormData.phone} onChange={e => setBuyerFormData({...buyerFormData, phone: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBuyerModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
