// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store, Edit, X, DollarSign, Filter, Download, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shopParam = searchParams.get("shop");

  const [userRole, setUserRole] = useState("manager");
  const [selectedShop, setSelectedShop] = useState("");
  
  const [products, setProducts] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  // এডিট স্টেট
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editStock, setEditStock] = useState(0);
  const [editPrice, setEditPrice] = useState(0);

  // ইউজার চেক
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
          setSelectedShop(shopParam || "All Shops");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            setSelectedShop(docSnap.data().assignedShop || "");
          }
        }
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, [shopParam]);

  // ডেটা লোড
  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      setStatements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProducts(); unsubInv(); unsubStatements(); };
  }, []);

  // মাস্টার ভ্যারিয়েশন ফ্ল্যাট করা
  const masterVars = products.flatMap((p: any) => 
    (p.variations || []).map((v: any) => ({
      productId: p.id,
      productName: p.name,
      category: p.category || "Others",
      size: v.size,
      color: v.color,
      costPrice: v.costPrice || 0,
    }))
  );

  // ক্যাটাগরি লিস্ট তৈরি (ফিল্টারের জন্য)
  const allCategories = ["All", ...Array.from(new Set(masterVars.map((m: any) => m.category)))];

  // শপ ইনভেন্টরি ম্যাপ
  const invMap = new Map();
  inventories.filter(i => i.shop === selectedShop).forEach(i => {
    invMap.set(`${i.productName}_${i.size}_${i.color}`, i);
  });

  // ডেটা প্রসেস
  let totalStockQty = 0;
  let totalStockValue = 0;

  const displayList = masterVars
    .map(m => {
      const inv = invMap.get(`${m.productName}_${m.size}_${m.color}`);
      const stock = inv ? inv.stock : 0;
      const price = inv ? inv.costPrice : m.costPrice;
      const value = stock * price;
      
      totalStockQty += stock;
      totalStockValue += value;

      return { ...m, stock, value, price, inventoryId: inv?.id };
    })
    .filter(item => {
      const matchCat = filterCategory === "All" || item.category === filterCategory;
      const matchSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.size.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });

  // আজকের লেনদেন
  const today = new Date().toISOString().split("T")[0];
  const todayTrans = statements.filter(t => t.shop === selectedShop && t.date === today);
  const todaySales = todayTrans.filter(t => t.type === "Sale").reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = todayTrans.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const todayPurchase = todayTrans.filter(t => t.type === "Purchase").reduce((sum, t) => sum + t.amount, 0);
  const todayProfit = todaySales - todayExpense - todayPurchase;

  // এডিট হ্যান্ডলার
  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditStock(item.stock);
    setEditPrice(item.price || 0);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      if (editingItem.inventoryId) {
        await updateDoc(doc(db, "shop_inventories", editingItem.inventoryId), { 
          stock: Number(editStock),
          costPrice: Number(editPrice)
        });
      } else {
        const { setDoc } = await import("firebase/firestore");
        const newId = `${selectedShop}_${editingItem.productName}_${editingItem.size}_${editingItem.color}`.replace(/\s+/g, '_').replace(/\//g, '-');
        await setDoc(doc(db, "shop_inventories", newId), {
          shop: selectedShop,
          productName: editingItem.productName,
          category: editingItem.category,
          size: editingItem.size,
          color: editingItem.color,
          stock: Number(editStock),
          costPrice: Number(editPrice)
        });
      }
      setEditingItem(null);
      alert("Success: স্টক ও দাম আপডেট হয়েছে!");
    } catch (error) { 
      console.error(error);
      alert("আপডেট করতে সমস্যা হয়েছে!"); 
    }
  };

  // ✅ PDF ডাউনলোড
  const downloadPDF = async () => {
    if (displayList.length === 0) { alert("ডেটা নেই!"); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Shop Report - ${selectedShop}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Stock: ${totalStockQty} pcs | Value: BDT ${totalStockValue}`, 14, 22);

    const tableData = displayList.map(item => [
      item.productName, 
      item.size === "Unknown" ? "-" : item.size, 
      item.color === "Unknown" ? "-" : item.color, 
      item.stock, `৳${item.price}`, `৳${item.value}`
    ]);

    autoTable(doc, {
      head: [['Product', 'Size', 'Color', 'Stock', 'Rate', 'Value']],
      body: tableData, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 45, 92] },
    });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `${selectedShop}_Report.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Shop Report' }); } catch (e) {}
    } else { doc.save(`${selectedShop}_Report.pdf`); }
  };

  // ✅ Excel (CSV) ডাউনলোড
  const downloadCSV = () => {
    if (displayList.length === 0) { alert("ডেটা নেই!"); return; }
    let csvContent = "Product,Size,Color,Stock,Rate,Value\n";
    displayList.forEach(item => {
      const size = (item.size === "Unknown" ? "-" : item.size).replace(/,/g, " ");
      const color = (item.color === "Unknown" ? "-" : item.color).replace(/,/g, " ");
      csvContent += `${item.productName.replace(/,/g, " ")},${size},${color},${item.stock},${item.price},${item.value}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedShop}_Report.csv`;
    link.click();
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* হেডার */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Dashboard</h2>
        </div>
        
        {/* ✅ নতুন ডাউনলোড বাটন */}
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={downloadCSV} className="flex-1 md:flex-none justify-center bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700 transition shadow-sm">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button onClick={downloadPDF} className="flex-1 md:flex-none justify-center bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-brand-navy/90 transition shadow-sm">
            <Download size={16} /> PDF / Share
          </button>
        </div>
      </div>

      <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center gap-3">
        <Store size={24} />
        <div>
          <p className="text-[10px] text-gray-300 uppercase tracking-wider">Shop</p>
          <h3 className="font-bold text-lg">{selectedShop}</h3>
        </div>
      </div>

      {/* সামারি কার্ড (আজকের হিসাব) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Sales</p>
          <h3 className="text-sm md:text-base font-bold text-green-600 truncate">৳{todaySales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Expense</p>
          <h3 className="text-sm md:text-base font-bold text-red-600 truncate">৳{todayExpense.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-blue-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Purchase</p>
          <h3 className="text-sm md:text-base font-bold text-blue-600 truncate">৳{todayPurchase.toLocaleString('en-IN')}</h3>
        </div>
        <div className={`bg-white p-3 rounded-xl shadow-sm border-t-4 ${todayProfit >= 0 ? 'border-brand-navy' : 'border-orange-500'}`}>
          <p className="text-[10px] text-gray-500 mb-1">Profit/Loss</p>
          <h3 className={`text-sm md:text-base font-bold truncate ${todayProfit >= 0 ? 'text-brand-navy' : 'text-orange-600'}`}>৳{todayProfit.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* স্টক সামারি (✅ এখানে লেখা কাটার সমস্যা ঠিক করা হয়েছে) */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500 flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg"><Package size={20} className="text-blue-600"/></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-1">Total Stock</p>
            <h3 className="text-base md:text-lg font-bold text-brand-navy truncate">{Math.round(totalStockQty).toLocaleString('en-IN')} pcs</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500 flex items-center gap-3">
          <div className="bg-green-50 p-2 rounded-lg"><DollarSign size={20} className="text-green-600"/></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-1">Total Value</p>
            <h3 className="text-base md:text-lg font-bold text-green-600 truncate">৳{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* সার্চ ও ক্যাটাগরি ফিল্টার */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 flex-1">
          <Search size={18} className="text-gray-400 ml-2" />
          <input type="text" placeholder="Search product..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 md:w-64">
          <Filter size={18} className="text-gray-400 ml-2" />
          <select className="w-full bg-transparent outline-none text-sm font-medium text-brand-navy cursor-pointer" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* প্রোডাক্ট টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Product Details</th>
                <th className="px-3 py-3 font-semibold text-center">Stock</th>
                <th className="px-3 py-3 font-semibold text-right">Price (৳)</th>
                <th className="px-3 py-3 font-semibold text-right">Value (৳)</th>
                <th className="px-3 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</td></tr>}
              {displayList.map((item, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{item.category}</div>
                    {/* ✅ Unknown ফিল্টার করা হয়েছে */}
                    <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {item.size && item.size !== "Unknown" ? item.size : ""} 
                      {item.color && item.color !== "Unknown" ? ` / ${item.color}` : ""}
                      {(!item.size || item.size === "Unknown") && (!item.color || item.color === "Unknown") ? "Standard" : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg font-bold text-xs ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{item.stock}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">৳{item.price}</td>
                  <td className="px-3 py-3 text-right font-bold text-brand-navy">৳{item.value.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => handleEditClick(item)} className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition"><Edit size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* এডিট মডাল */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Edit Product</h3>
              <button onClick={() => setEditingItem(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
              <p className="font-bold text-brand-navy">{editingItem.productName}</p>
              <p className="text-gray-500 text-xs">{editingItem.size} / {editingItem.color}</p>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                <input required type="number" className="w-full border p-2 rounded-lg font-bold" value={editStock} onChange={(e) => setEditStock(Number(e.target.value))} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Cost Price (৳)</label>
                <input required type="number" className="w-full border p-2 rounded-lg font-bold" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
