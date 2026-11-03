// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment, addDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder, ChevronRight, Search, Filter, Edit, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  
  // ✅ ক্যাটাগরি ডেটাবেস থেকে লোড করার জন্য
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // ✅ ভিউ স্টেট
  const [viewMode, setViewMode] = useState<"dashboard" | "main" | "sub" | "product">("dashboard");
  const [selectedMain, setSelectedMain] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // অ্যাড/এডিট স্টেট
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<any>({ id: "", name: "", mainCategory: "", subCategory: "", variations: [] });

  // ✅ নতুন ক্যাটাগরি অ্যাড করার স্টেট
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
        } else {
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
    
    // ক্যাটাগরি লোড করা
    const unsubCats = onSnapshot(query(collection(db, "categories")), (snapshot) => {
      setDbCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubCats(); };
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
    return () => { unsubInv(); unsubStatements(); };
  }, [selectedShop]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = shopStatements.filter(s => s.type === 'Sales' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = shopStatements.filter(s => s.type === 'Expense' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = shopStatements.filter(s => s.type === 'Purchase' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  // ✅ ফোল্ডার ফিল্টারিং (ডেটাবেসের ক্যাটাগরি + প্রোডাক্টের ক্যাটাগরি একসাথে)
  const mainCategories = ["Cotton", "Polestar"];
  
  const dbSubCats = dbCategories.filter(c => c.mainCategory === selectedMain).map(c => c.subCategory);
  const invSubCats = shopInventories.filter(p => p.mainCategory === selectedMain).map(p => p.subCategory || "Others");
  const subCategories = Array.from(new Set([...invSubCats, ...dbSubCats]));

  const filteredProducts = shopInventories.filter(p => {
    if (viewMode === "product") return p.mainCategory === selectedMain && (p.subCategory || "Others") === selectedSub;
    return true;
  }).filter(p => p.productName.toLowerCase().includes(searchTerm.toLowerCase()));

  // ✅ ব্যাক নেভিগেশন ফিক্স
  const handleBack = () => {
    if (viewMode === "product") {
      setViewMode("sub");
    } else if (viewMode === "sub") {
      setViewMode("main");
    } else if (viewMode === "main") {
      setViewMode("dashboard");
    } else {
      router.push("/");
    }
  };

  // PDF
  const downloadPDF = async () => {
    if (shopInventories.length === 0) return alert("ডেটা নেই!");
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`Stock Report - ${selectedShop}`, 14, 15);
    const tableData = shopInventories.map(item => [item.productName, item.size || "-", item.color || "-", item.stock, `৳${item.costPrice}`, `৳${(item.stock * item.costPrice)}`]);
    autoTable(doc, { head: [['Product', 'Size', 'Color', 'Stock', 'Rate', 'Total']], body: tableData, startY: 25 });
    const pdfBlob = doc.output('blob'); const file = new File([pdfBlob], `Stock_${selectedShop}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (e) {} } else { doc.save(`Stock.pdf`); }
  };

  // অ্যাড/এডিট ওপেন
  const openAddModal = () => { setIsEdit(false); setFormData({ id: "", name: "", mainCategory: selectedMain, subCategory: selectedSub, variations: [{ size: "", color: "", stock: 0, costPrice: 0 }] }); setShowModal(true); };
  const openEditModal = (item: any) => { setIsEdit(true); setFormData({ id: item.id, name: item.productName, mainCategory: item.mainCategory, subCategory: item.subCategory, variations: [{ size: item.size, color: item.color, stock: item.stock, costPrice: item.costPrice }] }); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateDoc(doc(db, "shop_inventories", formData.id), {
          productName: formData.name, size: formData.variations[0].size, color: formData.variations[0].color, stock: Number(formData.variations[0].stock), costPrice: Number(formData.variations[0].costPrice)
        });
      } else {
        const shopInvId = `${selectedShop}_${formData.name}_${formData.variations[0].size}_${formData.variations[0].color}`.replace(/\s+/g, '_').replace(/\//g, '-');
        await setDoc(doc(db, "shop_inventories", shopInvId), {
          shop: selectedShop, productName: formData.name, category: formData.subCategory, mainCategory: formData.mainCategory, subCategory: formData.subCategory,
          size: formData.variations[0].size || "Unknown", color: formData.variations[0].color || "Unknown", stock: Number(formData.variations[0].stock), costPrice: Number(formData.variations[0].costPrice)
        });
      }
      setShowModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ✅ নতুন ক্যাটাগরি সেভ করা
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await addDoc(collection(db, "categories"), {
        mainCategory: selectedMain,
        subCategory: newCatName.trim()
      });
      setShowCatModal(false);
      setNewCatName("");
      alert("Success: নতুন ক্যাটাগরি যোগ হয়েছে!");
    } catch (error) {
      alert("ক্যাটাগরি অ্যাড করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        {/* ✅ ঠিক করা ব্যাক বাটন */}
        <button onClick={handleBack} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">
          {viewMode === "dashboard" ? "Shop Dashboard" : viewMode === "main" ? "Stock Categories" : viewMode === "sub" ? selectedMain : selectedSub}
        </h2>
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
            <div className="bg-white p-3 rounded-xl border-t-4 border-green-500"><div className="text-xs text-gray-500">Today's Sales</div><h3 className="text-lg font-bold text-green-600">৳{todaySales}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-red-500"><div className="text-xs text-gray-500">Expense</div><h3 className="text-lg font-bold text-red-600">৳{todayExpense}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500"><div className="text-xs text-gray-500">Purchase</div><h3 className="text-lg font-bold text-blue-600">৳{todayPurchase}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-brand-navy"><div className="text-xs text-gray-500">Profit/Loss</div><h3 className="text-lg font-bold text-brand-navy">৳{profitLoss}</h3></div>
          </div>
          <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-6">
            <div className="text-sm text-gray-500">Total Stock Value</div>
            <h3 className="text-2xl font-bold text-green-600">৳{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>
          
          <div onClick={() => setViewMode("main")} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center justify-center gap-3">
            <div className="bg-brand-navy/10 p-4 rounded-full"><Package size={40} className="text-brand-navy" /></div>
            <h3 className="text-xl font-bold text-brand-navy">Stock / Products</h3>
            <p className="text-sm text-gray-500">Click to view products by category</p>
          </div>
        </>
      )}

      {viewMode === "main" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {mainCategories.map(cat => (
            <div key={cat} onClick={() => { setSelectedMain(cat); setViewMode("sub"); }} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center gap-3">
              <Folder size={40} className="text-brand-navy" />
              <h3 className="text-xl font-bold text-brand-navy">{cat}</h3>
            </div>
          ))}
        </div>
      )}

      {viewMode === "sub" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {subCategories.map(sub => (
            <div key={sub} onClick={() => { setSelectedSub(sub); setViewMode("product"); }} className="bg-white p-4 rounded-xl shadow-sm cursor-pointer flex items-center justify-between">
              <span className="font-bold text-gray-700">{sub}</span><ChevronRight size={18} className="text-gray-400" />
            </div>
          ))}
          
          {/* ✅ নতুন ক্যাটাগরি অ্যাড করার বাটন */}
          <div onClick={() => setShowCatModal(true)} className="bg-blue-50 p-4 rounded-xl border border-blue-200 border-dashed cursor-pointer flex items-center justify-center gap-2 hover:bg-blue-100 transition">
            <PlusCircle size={20} className="text-blue-600" />
            <span className="font-bold text-blue-600">Add Category</span>
          </div>
        </div>
      )}

      {viewMode === "product" && (
        <div>
          <div className="flex justify-between items-center mb-4 gap-2">
            <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-xs">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Search..." className="outline-none text-sm w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><PlusCircle size={16}/> Add Product</button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr><th className="px-2 py-3">Product</th><th className="px-2 py-3 text-center">Stock</th><th className="px-2 py-3 text-center">Action</th></tr>
              </thead>
              <tbody>
                {filteredProducts.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-3">
                      <div className="font-bold text-brand-navy">{item.productName}</div>
                      <div className="text-[10px] text-gray-500">{item.size} / {item.color}</div>
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-green-600">{item.stock}</td>
                    <td className="px-2 py-3 text-center flex justify-center gap-1">
                      <button onClick={() => openEditModal(item)} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14} /></button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-gray-500">এই ক্যাটাগরিতে কোনো প্রোডাক্ট নেই।</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEdit ? "Edit Product" : "Add New Product"}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="text-xs">Product Name</label><input required className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Size</label><input className="w-full border p-2 rounded" value={formData.variations[0]?.size} onChange={e => { const v = [...formData.variations]; v[0].size = e.target.value; setFormData({...formData, variations: v}); }} /></div>
                <div><label className="text-xs">Color</label><input className="w-full border p-2 rounded" value={formData.variations[0]?.color} onChange={e => { const v = [...formData.variations]; v[0].color = e.target.value; setFormData({...formData, variations: v}); }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Stock</label><input type="number" className="w-full border p-2 rounded" value={formData.variations[0]?.stock} onChange={e => { const v = [...formData.variations]; v[0].stock = e.target.value; setFormData({...formData, variations: v}); }} /></div>
                <div><label className="text-xs">Cost</label><input type="number" className="w-full border p-2 rounded" value={formData.variations[0]?.costPrice} onChange={e => { const v = [...formData.variations]; v[0].costPrice = e.target.value; setFormData({...formData, variations: v}); }} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Add Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add New Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="text-xs">Category Name (e.g. Cotton Thread)</label>
                <input required autoFocus className="w-full border p-2 rounded" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
