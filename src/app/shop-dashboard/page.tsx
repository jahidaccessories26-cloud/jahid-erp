// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);

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
  shopInventories.forEach(item => {
    totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0);
  });

  // ✅ শুধু PDF ডাউনলোড (ড্যাশবোর্ডের জন্য)
  const downloadPDF = async () => {
    if (shopInventories.length === 0) { alert("ডাউনলোড করার জন্য কোনো ডেটা নেই!"); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Stock Report - ${selectedShop}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Value: BDT ${totalStockValue.toLocaleString('en-IN')}`, 14, 22);

    const tableData = shopInventories.map(item => [
      item.productName, item.size === "Unknown" ? "-" : (item.size || "-"), item.color === "Unknown" ? "-" : (item.color || "-"), item.stock, `BDT ${item.costPrice}`, `BDT ${((item.stock || 0) * (item.costPrice || 0)).toLocaleString('en-IN')}`
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
          <button onClick={downloadPDF} className="flex-1 md:flex-none justify-center bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-brand-navy/90 transition shadow-sm">
            <Download size={16} /> PDF / Share
          </button>
        </div>
      </div>

      {/* দোকান সিলেক্ট */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Store size={18} className="text-brand-navy ml-2" />
        <select className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2 cursor-pointer" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
          {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
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

      {/* টোটাল ভ্যালু কার্ড */}
      <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border-t-4 border-green-500 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <DollarSign size={16}/> Total Stock Value
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-green-600 truncate">
          ৳{totalStockValue.toLocaleString('en-IN')}
        </h3>
      </div>

      {/* ✅ নতুন স্টক ফোল্ডার বাটন */}
      <div 
        onClick={() => router.push('/shop-products')} 
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer flex flex-col items-center justify-center gap-3"
      >
        <div className="bg-brand-navy/10 p-4 rounded-full">
          <Package size={40} className="text-brand-navy" />
        </div>
        <h3 className="text-xl font-bold text-brand-navy">Stock / Products</h3>
        <p className="text-sm text-gray-500 text-center">Click here to view and edit products by category</p>
      </div>
      
    </div>
  );
}
