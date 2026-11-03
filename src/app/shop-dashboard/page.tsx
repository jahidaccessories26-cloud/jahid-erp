// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState(""); // ডিফল্টে খালি থাকবে
  
  const [shops, setShops] = useState<any[]>([]); // দোকানের লিস্ট রাখার জন্য
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);

  // অ্যাড প্রোডাক্ট স্টেট
  const [showAddModal, setShowAddModal] = useState(false);
  const [addData, setAddData] = useState({ productName: "", category: "", size: "", color: "", stock: 0, costPrice: 0 });

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
            // ম্যানেজার হলে তার অ্যাসাইন করা দোকান সেট হবে
            if (docSnap.data().assignedShop) {
              setSelectedShop(docSnap.data().assignedShop);
            }
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // ✅ নতুন লজিক: অ্যাডমিনের জন্য দোকানের লিস্ট লোড করা এবং ডিফল্ট দোকান সিলেক্ট করা
  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      
      // যদি অ্যাডমিন হয় এবং কোনো দোকান সিলেক্ট করা না থাকে, তবে প্রথম দোকানটা অটো সিলেক্ট হবে
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0].name);
      }
    });
    return () => unsubShops();
  }, [selectedShop]);

  // ডেটা লোড (দোকান সিলেক্ট হলে)
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

  // আজকের হিসাব
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = shopStatements.filter(s => s.type === 'Sales' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = shopStatements.filter(s => s.type === 'Expense' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = shopStatements.filter(s => s.type === 'Purchase' && s.date?.startsWith(todayStr)).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  // টোটাল ভ্যালু
  let totalStockValue = 0;
  shopInventories.forEach(item => {
    totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0);
  });

  // PDF ডাউনলোড ফাংশন
  const downloadPDF = async () => {
    if (shopInventories.length === 0) {
      alert("ডাউনলোড করার জন্য কোনো ডেটা নেই!");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Stock Report - ${selectedShop}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Value: BDT ${totalStockValue.toLocaleString('en-IN')}`, 14, 22);

    const tableData = shopInventories.map(item => [
      item.productName, 
      item.size === "Unknown" ? "-" : (item.size || "-"), 
      item.color === "Unknown" ? "-" : (item.color || "-"), 
      item.stock, 
      `BDT ${item.costPrice}`, 
      `BDT ${((item.stock || 0) * (item.costPrice || 0)).toLocaleString('en-IN')}`
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

  // নতুন প্রোডাক্ট অ্যাড ফাংশন
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) { alert("দোকান সিলেক্ট করা নেই!"); return; }
    try {
      const shopInvId = `${selectedShop}_${addData.productName}_${addData.size}_${addData.color}`.replace(/\s+/g, '_').replace(/\//g, '-');
      const invRef = doc(db, "shop_inventories", shopInvId);
      const snap = await getDoc(invRef);

      if (snap.exists()) {
        await updateDoc(invRef, { stock: increment(Number(addData.stock)), costPrice: Number(addData.costPrice) });
        alert("Success: আগের প্রোডাক্টের সাথে স্টক যোগ হয়েছে!");
      } else {
        await setDoc(invRef, {
          shop: selectedShop,
          productName: addData.productName,
          category: addData.category,
          size: addData.size || "Unknown",
          color: addData.color || "Unknown",
          stock: Number(addData.stock),
          costPrice: Number(addData.costPrice)
        });
        alert("Success: নতুন প্রোডাক্ট যোগ হয়েছে!");
      }
      setShowAddModal(false);
      setAddData({ productName: "", category: "", size: "", color: "", stock: 0, costPrice: 0 });
    } catch (error) { alert("প্রোডাক্ট অ্যাড করতে সমস্যা হয়েছে!"); }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      
      {/* হেডার */}
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

      {/* ✅ দোকান সিলেক্ট ড্রপডাউন (এখান থেকেই দোকান বদলাতে পারবেন) */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Store size={18} className="text-brand-navy ml-2" />
        <select 
          className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2 cursor-pointer" 
          value={selectedShop} 
          onChange={(e) => setSelectedShop(e.target.value)}
        >
          {shops.map((shop) => (
            <option key={shop.id} value={shop.name}>{shop.name}</option>
          ))}
        </select>
      </div>

      {/* আজকের হিসাব */}
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

      {/* টোটাল ভ্যালু কার্ড (শুধু ভ্যালু) */}
      <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-t-4 border-green-500 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <DollarSign size={16}/> Total Stock Value
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-green-600 truncate">
          ৳{totalStockValue.toLocaleString('en-IN')}
        </h3>
      </div>

      {/* নতুন প্রোডাক্ট অ্যাড মডাল */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Add Product to {selectedShop}</h3>
              <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Product Name</label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={addData.productName} onChange={(e) => setAddData({...addData, productName: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={addData.category} onChange={(e) => setAddData({...addData, category: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Size</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={addData.size} onChange={(e) => setAddData({...addData, size: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Color</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={addData.color} onChange={(e) => setAddData({...addData, color: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Stock</label>
                  <input required type="number" className="w-full border p-2 rounded-lg text-lg font-bold" value={addData.stock} onChange={(e) => setAddData({...addData, stock: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Cost Price (৳)</label>
                  <input required type="number" className="w-full border p-2 rounded-lg text-sm" value={addData.costPrice} onChange={(e) => setAddData({...addData, costPrice: Number(e.target.value)})} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t mt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Add Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
