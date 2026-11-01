// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Edit, X } from "lucide-react";

export default function ShopDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shopParam = searchParams.get("shop");

  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // ইউজার ও দোকান চেক
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
            setUserShop(docSnap.data().assignedShop || "");
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

  // মাস্টার ভ্যারিয়েশন (ক্যাটাগরি সহ)
  const masterVars = products.flatMap((p: any) => 
    (p.variations || []).map((v: any) => ({
      productName: p.name,
      category: p.category || "Uncategorized",
      size: v.size,
      color: v.color,
      costPrice: v.costPrice || 0,
    }))
  );

  // শপ ইনভেন্টরি ম্যাপ
  const invMap = new Map();
  inventories.filter(i => i.shop === selectedShop).forEach(i => {
    invMap.set(`${i.productName}_${i.size}_${i.color}`, i);
  });

  // ডেটা প্রসেস
  let totalStockQty = 0;
  let totalStockValue = 0;

  const stockList = masterVars
    .map(m => {
      const inv = invMap.get(`${m.productName}_${m.size}_${m.color}`);
      const stock = inv ? inv.stock : 0;
      const value = stock * m.costPrice;
      
      totalStockQty += stock;
      totalStockValue += value;

      return { ...m, stock, value };
    })
    .filter(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));

  // আজকের লেনদেন
  const today = new Date().toISOString().split("T")[0];
  const todayTrans = statements.filter(t => t.shop === selectedShop && t.date === today);

  const todaySales = todayTrans.filter(t => t.type === "Sale").reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = todayTrans.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
  const todayPurchase = todayTrans.filter(t => t.type === "Purchase").reduce((sum, t) => sum + t.amount, 0);
  
  // লাভ-লোকসান (সহজ হিসাব)
  const todayProfit = todaySales - todayExpense - todayPurchase;

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Dashboard</h2>
      </div>

      {/* দোকানের নাম */}
      <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center gap-3">
        <Store size={24} />
        <div>
          <p className="text-[10px] text-gray-300 uppercase tracking-wider">Shop</p>
          <h3 className="font-bold text-lg">{selectedShop}</h3>
        </div>
      </div>

      {/* ৪টি সামারি কার্ড */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Today's Sales</p>
          <h3 className="text-base md:text-xl font-bold text-green-600">৳{todaySales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Today's Expense</p>
          <h3 className="text-base md:text-xl font-bold text-red-600">৳{todayExpense.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Today's Purchase</p>
          <h3 className="text-base md:text-xl font-bold text-blue-600">৳{todayPurchase.toLocaleString('en-IN')}</h3>
        </div>
        <div className={`bg-white p-3 md:p-4 rounded-xl shadow-sm border-t-4 ${todayProfit >= 0 ? 'border-brand-navy' : 'border-orange-500'}`}>
          <p className="text-[10px] md:text-xs text-gray-500 mb-1">Net Profit/Loss</p>
          <h3 className={`text-base md:text-xl font-bold ${todayProfit >= 0 ? 'text-brand-navy' : 'text-orange-600'}`}>
            ৳{todayProfit.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      {/* স্টক সামারি */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 mb-6">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg"><Package size={20} className="text-blue-600"/></div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-500">Total Stock Qty</p>
            <h3 className="text-base md:text-lg font-bold text-brand-navy">{totalStockQty.toLocaleString('en-IN')} pcs</h3>
          </div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="bg-green-50 p-2 rounded-lg"><DollarSign size={20} className="text-green-600"/></div>
          <div>
            <p className="text-[10px] md:text-xs text-gray-500">Total Stock Value</p>
            <h3 className="text-base md:text-lg font-bold text-brand-navy">৳{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* সার্চ বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search by product or category..." 
          className="w-full bg-transparent outline-none text-sm py-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* স্টক টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-sm md:text-base flex items-center gap-2"><Package size={18}/> Stock Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Product & Category</th>
                <th className="px-3 py-2 font-semibold text-center">Stock</th>
                <th className="px-3 py-2 font-semibold text-right">Value (৳)</th>
              </tr>
            </thead>
            <tbody>
              {stockList.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</td></tr>
              )}
              {stockList.map((item, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{item.category}</div>
                    <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded">{item.size} / {item.color}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg font-bold text-xs ${
                      item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700">
                    ৳{item.value.toLocaleString('en-IN')}
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
