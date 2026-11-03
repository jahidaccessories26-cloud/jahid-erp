// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Search, Filter, Edit, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  
  // সার্চ ও ফিল্টার
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // ✅ এডিট স্টেট (অ্যারে হিসেবে, যাতে একাধিক সাইজ এডিট করা যায়)
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editVariations, setEditVariations] = useState<any[]>([]);

  // অ্যাড প্রোডাক্ট স্টেট
  const [showAddModal, setShowAddModal] = useState(false);
  const [addData, setAddData] = useState({ productName: "", category: "", size: "", color: "", stock: "", costPrice: "" });

  // ইউজার চেক
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            if (docSnap.data().assignedShop) {
              setSelectedShop(docSnap.data().assignedShop);
            }
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // দোকান লোড
  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0].name);
      }
    });
    return () => unsubShops();
  }, [selectedShop]);

  // ডেটা লোড
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
  
  const categories = Array.from(new Set(shopInventories.map(item => item.category).filter(Boolean)));
  const displayList = shopInventories
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = (item.productName || "").toLowerCase().includes(searchLower) || 
                          (item.size || "").toLowerCase().includes(searchLower) ||
                          (item.color || "").toLowerCase().includes(searchLower);
      const matchCategory = categoryFilter === "All" || item.category === categoryFilter;
      return matchSearch && matchCategory;
    })
    .map(item => {
      const itemValue = (Number(item.stock) || 0) * (Number(item.costPrice) || 0);
      totalStockValue += itemValue;
      return { ...item, itemValue };
    });

  // PDF
  const downloadPDF = async () => {
    if (displayList.length === 0) { alert("ডাউনলোড করার জন্য কোনো ডেটা নেই!"); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Stock Report - ${selectedShop}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Value: BDT ${totalStockValue.toLocaleString('en-IN')}`, 14, 22);

    const tableData = displayList.map(item => [
      item.productName, item.size === "Unknown" ? "-" : (item.size || "-"), item.color === "Unknown" ? "-" : (item.color || "-"), item.stock, `BDT ${item.costPrice}`, `BDT ${item.itemValue.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      head: [['Product', 'Size', 'Color', 'Stock', 'Rate', 'Total']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 45, 92] },
    });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `${selectedShop}_Stock.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Stock' }); } catch (e) { console.log(e); }
    } else {
      doc.save(`${selectedShop}_Stock.pdf`);
    }
  };

  // অ্যাড প্রোডাক্ট
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    try {
      const shopInvId = `${selectedShop}_${addData.productName}_${addData.size}_${addData.color}`.replace(/\s+/g, '_').replace(/\//g, '-');
      const invRef = doc(db, "shop_inventories", shopInvId);
      const snap = await getDoc(invRef);

      if (snap.exists()) {
        await updateDoc(invRef, { stock: increment(Number(addData.stock) || 0), costPrice: Number(addData.costPrice) || 0 });
      } else {
        await setDoc(invRef, {
          shop: selectedShop, productName: addData.productName, category: addData.category, size: addData.size || "Unknown", color: addData.color || "Unknown", stock: Number(addData.stock) || 0, costPrice: Number(addData.costPrice) || 0
        });
      }
      setShowAddModal(false);
      setAddData({ productName: "", category: "", size: "", color: "", stock: "", costPrice: "" });
      alert("Success: প্রোডাক্ট যোগ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ✅ এডিট ওপেন করার ফাংশন
  const handleEditClick = (item: any) => {
    setEditingProduct(item);
    // একটি সিঙ্গেল আইটেমকে অ্যারের ভেতরে রাখছি, যাতে UI একই রকম থাকে
    setEditVariations([{
      id: item.id,
      size: item.size || "",
      color: item.color || "",
      stock: item.stock || 0,
      costPrice: item.costPrice || 0
    }]);
  };

  // ✅ ভ্যারিয়েশন চেঞ্জ
  const handleVariationChange = (index: number, field: string, value: any) => {
    const newVars = [...editVariations];
    newVars[index][field] = value;
    setEditVariations(newVars);
  };

  // ✅ এডিট সেভ (স্টক ও দাম)
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const invRef = doc(db, "shop_inventories", editingProduct.id);
      await updateDoc(invRef, { 
        productName: editingProduct.productName, 
        category: editingProduct.category, 
        size: editVariations[0].size, 
        color: editVariations[0].color, 
        stock: Number(editVariations[0].stock), 
        costPrice: Number(editVariations[0].costPrice)
      });
      setEditingProduct(null);
      alert("Success: আপডেট হয়েছে!");
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  // ডিলিট
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`"${name}" ডিলিট করতে চান?`)) {
      await deleteDoc(doc(db, "shop_inventories", id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Dashboard</h2>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none justify-center bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700 transition shadow-sm">
            <PlusCircle size={16} /> Add Product
          </button>
          <button onClick={downloadPDF} className="flex-1 md:flex-none justify-center bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-brand-navy/90 transition shadow-sm">
            <Download size={16} /> PDF / Share
          </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Store size={18} className="text-brand-navy ml-2" />
        <select className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2 cursor-pointer" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
          {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <div className="text-xs text-gray-500 mb-1">Today's Sales</div>
          <h3 className="text-lg font-bold text-green-600">৳{todaySales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-red-500">
          <div className="text-xs text-gray-500 mb-1">Today's Expense</div>
          <h3 className="text-lg font-bold text-red-600">৳{todayExpense.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <div className="text-xs text-gray-500 mb-1">Today's Purchase</div>
          <h3 className="text-lg font-bold text-blue-600">৳{todayPurchase.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-brand-navy">
          <div className="text-xs text-gray-500 mb-1">Profit/Loss</div>
          <h3 className={`text-lg font-bold ${profitLoss >= 0 ? 'text-brand-navy' : 'text-red-600'}`}>৳{profitLoss.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-t-4 border-green-500 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <DollarSign size={16}/> Total Stock Value
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-green-600 truncate">
          ৳{totalStockValue.toLocaleString('en-IN')}
        </h3>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 flex-1">
          <Search size={18} className="text-gray-400 ml-2" />
          <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 md:w-64">
          <Filter size={18} className="text-gray-400 ml-2" />
          <select className="w-full bg-transparent outline-none text-sm py-1 cursor-pointer font-medium text-gray-700" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm min-w-full">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-2 py-3 font-semibold w-[45%]">Product Details</th>
                <th className="px-2 py-3 font-semibold text-center w-[15%]">Stock</th>
                <th className="px-2 py-3 font-semibold text-right w-[20%]">Value</th>
                <th className="px-2 py-3 font-semibold text-center w-[20%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</td></tr>}
              {displayList.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <div className="font-bold text-brand-navy text-xs md:text-sm line-clamp-2">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{item.category}</div>
                    <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {item.size && item.size !== "Unknown" ? item.size : ""} 
                      {item.color && item.color !== "Unknown" ? ` / ${item.color}` : ""}
                      {(!item.size || item.size === "Unknown") && (!item.color || item.color === "Unknown") ? "Standard" : ""}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span className={`inline-block px-1.5 py-1 rounded-lg font-bold text-[11px] ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{item.stock}</span>
                  </td>
                  <td className="px-2 py-3 text-right font-medium text-[11px] text-gray-700">৳{item.itemValue.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => handleEditClick(item)} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(item.id, item.productName)} className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Add Product</h3>
              <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div><label className="block text-xs font-medium mb-1">Product Name</label><input required className="w-full border p-2 rounded-lg text-sm" value={addData.productName} onChange={(e) => setAddData({...addData, productName: e.target.value})} /></div>
              <div><label className="block text-xs font-medium mb-1">Category</label><input required className="w-full border p-2 rounded-lg text-sm" value={addData.category} onChange={(e) => setAddData({...addData, category: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium mb-1">Size</label><input required className="w-full border p-2 rounded-lg text-sm" value={addData.size} onChange={(e) => setAddData({...addData, size: e.target.value})} /></div>
                <div><label className="block text-xs font-medium mb-1">Color</label><input required className="w-full border p-2 rounded-lg text-sm" value={addData.color} onChange={(e) => setAddData({...addData, color: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium mb-1">Stock</label><input required type="number" placeholder="0" className="w-full border p-2 rounded-lg text-lg font-bold" value={addData.stock} onChange={(e) => setAddData({...addData, stock: e.target.value})} /></div>
                <div><label className="block text-xs font-medium mb-1">Cost Price (৳)</label><input required type="number" placeholder="0" className="w-full border p-2 rounded-lg text-sm" value={addData.costPrice} onChange={(e) => setAddData({...addData, costPrice: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Add Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Edit Modal (Size/Color & Add Variation সহ) */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Edit Product</h3>
              <button onClick={() => setEditingProduct(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Product Name</label>
                  <input required className="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white" value={editingProduct.productName} onChange={(e) => setEditingProduct({...editingProduct, productName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <input required className="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white" value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Variations (Size/Color)</label>
                  {/* ✅ Add Size/Color বাটন */}
                  <button type="button" onClick={() => setEditVariations([...editVariations, { id: "", size: "", color: "", stock: 0, costPrice: 0 }])} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-medium transition">
                    <PlusCircle size={14}/> Add Size/Color
                  </button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editVariations.map((v: any, i: number) => (
                    <div key={i} className="flex flex-col md:flex-row gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex w-full gap-2">
                        <input placeholder="Size" className="w-1/2 border p-2 rounded-lg text-sm" value={v.size} onChange={(e) => handleVariationChange(i, 'size', e.target.value)} />
                        <input placeholder="Color" className="w-1/2 border p-2 rounded-lg text-sm" value={v.color} onChange={(e) => handleVariationChange(i, 'color', e.target.value)} />
                      </div>
                      <div className="flex w-full gap-2 items-center">
                        <input placeholder="Stock" type="number" className="w-1/3 border p-2 rounded-lg text-sm" value={v.stock} onChange={(e) => handleVariationChange(i, 'stock', Number(e.target.value))} />
                        <input placeholder="Cost (৳)" type="number" className="w-1/3 border p-2 rounded-lg text-sm" value={v.costPrice} onChange={(e) => handleVariationChange(i, 'costPrice', Number(e.target.value))} />
                        {/* ডিলিট বাটন */}
                        <button type="button" onClick={() => {
                          if (editVariations.length === 1) {
                            alert("কমপক্ষে একটি ভ্যারিয়েশন থাকতে হবে।");
                            return;
                          }
                          const newVars = editVariations.filter((_, idx) => idx !== i);
                          setEditVariations(newVars);
                        }} className="w-1/3 flex justify-center text-red-500 hover:bg-red-50 p-2 rounded-lg border border-red-100 transition"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <button type="button" onClick={() => setEditingProduct(null)} className="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
