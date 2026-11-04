// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder, ChevronRight, Search, Edit, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<"dashboard" | "main" | "sub" | "product">("dashboard");
  const [selectedMain, setSelectedMain] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showCatModal, setShowCatModal] = useState(false);
  const [catData, setCatData] = useState({ isEdit: false, oldName: "", newName: "" });

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
    return () => { unsubInv(); unsubStatements(); };
  }, [selectedShop]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = shopStatements.filter(s => s.type === 'Sales' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = shopStatements.filter(s => s.type === 'Expense' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = shopStatements.filter(s => s.type === 'Purchase' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  const mainCategories = ["Cotton", "Polestar"];

  const getCategoryFromName = (item: any) => {
    const n = (item.productName || "").toLowerCase();
    if (n.includes("cotton") || n.includes("catton")) return "Cotton";
    if (n.includes("polestar") || n.includes("polertar")) return "Polestar";
    return "Cotton"; 
  };

  const subCategories = Array.from(new Set(
    shopInventories
      .filter(p => {
        const main = p.mainCategory || getCategoryFromName(p);
        return main === selectedMain;
      })
      .map(p => p.subCategory || p.category || "Uncategorized")
  ));

  const filteredProducts = shopInventories.filter(p => {
    const main = p.mainCategory || getCategoryFromName(p);
    const sub = p.subCategory || p.category || "Uncategorized";
    
    if (viewMode === "product") return main === selectedMain && sub === selectedSub;
    return true;
  }).filter(p => (p.productName || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const downloadPDF = async () => {
    if (filteredProducts.length === 0) return alert("ডেটা নেই!");
    const doc = new jsPDF();
    doc.setFontSize(16); 
    doc.text(`Stock Report - ${selectedShop}`, 14, 15);
    doc.text(viewMode === "product" ? `Category: ${selectedSub}` : "All Categories", 14, 22);
    
    const tableData = filteredProducts.map(item => [
      item.productName, item.size || "-", item.color || "-", item.stock, item.costPrice || "0", ((item.stock || 0) * (item.costPrice || 0)).toString()
    ]);
    
    autoTable(doc, { head: [['Product', 'Size', 'Color', 'Stock', 'Rate', 'Total']], body: tableData, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 45, 92] } });

    const pdfBlob = doc.output('blob'); 
    const file = new File([pdfBlob], `Stock_${selectedShop}.pdf`, { type: 'application/pdf' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) { 
      try { await navigator.share({ files: [file], title: 'Stock Report' }); } catch (e) {} 
    } else { doc.save(`Stock_${selectedShop}.pdf`); }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!window.confirm(`"${catName}" ক্যাটাগরির সব প্রোডাক্ট ডিলিট করতে চান?`)) return;
    try {
      const itemsToDelete = shopInventories.filter(p => (p.subCategory || p.category) === catName);
      for (const item of itemsToDelete) { await deleteDoc(doc(db, "shop_inventories", item.id)); }
      alert("ক্যাটাগরি ডিলিট হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" ডিলিট করতে চান?`)) return;
    try { await deleteDoc(doc(db, "shop_inventories", id)); } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const openAddModal = () => { 
    setIsEdit(false); 
    setFormData({ id: "", name: "", mainCategory: selectedMain, subCategory: selectedSub, variations: [{ size: "", color: "", stock: 0, costPrice: 0 }] }); 
    setShowModal(true); 
  };
  
  const openEditModal = (item: any) => { 
    setIsEdit(true); 
    setFormData({ id: item.id, name: item.productName, mainCategory: item.mainCategory || getCategoryFromName(item), subCategory: item.subCategory || item.category || "Uncategorized", variations: [{ size: item.size, color: item.color, stock: item.stock, costPrice: item.costPrice }] }); 
    setShowModal(true); 
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateDoc(doc(db, "shop_inventories", formData.id), {
          productName: formData.name, mainCategory: formData.mainCategory, subCategory: formData.subCategory, size: formData.variations[0].size, color: formData.variations[0].color, stock: Number(formData.variations[0].stock), costPrice: Number(formData.variations[0].costPrice)
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

  const handleCatSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (catData.isEdit) {
        const itemsToUpdate = shopInventories.filter(item => (item.subCategory || item.category) === catData.oldName && (item.mainCategory || getCategoryFromName(item)) === selectedMain);
        for (const item of itemsToUpdate) { await updateDoc(doc(db, "shop_inventories", item.id), { subCategory: catData.newName, category: catData.newName }); }
      } else {
        const shopInvId = `${selectedShop}_${selectedMain}_${catData.newName}_Category`.replace(/\s+/g, '_');
        await setDoc(doc(db, "shop_inventories", shopInvId), {
          shop: selectedShop, productName: "New Product", category: catData.newName, mainCategory: selectedMain, subCategory: catData.newName,
          size: "Unknown", color: "Unknown", stock: 0, costPrice: 0
        });
      }
      setShowCatModal(false); alert("সফল হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleBack = () => {
    if (viewMode === "product") setViewMode("sub");
    else if (viewMode === "sub") setViewMode("main");
    else if (viewMode === "main") setViewMode("dashboard");
    else router.push("/");
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">
            {viewMode === "dashboard" ? "Shop Dashboard" : viewMode === "main" ? "Stock Categories" : viewMode === "sub" ? selectedMain : selectedSub}
          </h2>
        </div>
        
        {viewMode === "product" && (
          <button onClick={downloadPDF} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 shadow-sm">
            <Download size={16} /> PDF / Share
          </button>
        )}
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
          <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-6">
            <div className="text-sm text-gray-500">Total Stock Value</div>
            <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>
          
          <div onClick={() => setViewMode("main")} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-pointer flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Folder size={20} className="text-brand-navy" /></div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">Stock / Products</h3>
                <p className="text-[11px] text-gray-500">View products by category</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </>
      )}

      {viewMode === "main" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {mainCategories.map(cat => (
            <div key={cat} onClick={() => { setSelectedMain(cat); setViewMode("sub"); }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center gap-2">
              <Folder size={32} className="text-brand-navy" />
              <h3 className="text-lg font-bold text-brand-navy">{cat}</h3>
            </div>
          ))}
        </div>
      )}

      {viewMode === "sub" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">Sub Categories</h3>
            <button onClick={() => { setCatData({ isEdit: false, oldName: "", newName: "" }); setShowCatModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
              <PlusCircle size={16}/> Add Category
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subCategories.map(sub => (
              <div key={sub} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-700 text-sm cursor-pointer" onClick={() => { setSelectedSub(sub); setViewMode("product"); }}>{sub}</span>
                <div className="flex gap-1">
                  <button onClick={() => handleDeleteCategory(sub)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ আগের মতো সুন্দর কার্ড ডিজাইন */}
      {viewMode === "product" && (
        <div>
          <div className="flex justify-between items-center mb-4 gap-2">
            <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-xs">
              <Search size={16} className="text-gray-400" />
              <input type="text" placeholder="Search..." className="outline-none text-sm w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 whitespace-nowrap"><PlusCircle size={16}/> Add Product</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-start mb-3 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={20} /></div>
                    <div>
                      <h3 className="text-base font-bold text-brand-navy">{item.productName}</h3>
                      <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-1">{item.size} / {item.color}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(item)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition"><Edit size={16} /></button>
                    <button onClick={() => handleDeleteProduct(item.id, item.productName)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition"><Trash2 size={16} /></button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2 mt-auto text-sm">
                  <div className="text-gray-500">Stock: <span className="font-bold text-green-600">{item.stock}</span></div>
                  <div className="text-gray-500">Rate: <span className="font-bold text-brand-navy">৳{item.costPrice}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add New Category</h3>
            <form onSubmit={handleCatSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Category Name</label>
                <input required className="w-full border p-2 rounded" value={catData.newName} onChange={e => setCatData({...catData, newName: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}
