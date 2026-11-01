// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store, Edit, X, DollarSign, TrendingUp, ShoppingBag, Folder } from "lucide-react";

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
      productId: p.id,
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

  // ডেটা প্রসেস ও ক্যাটাগরি অনুযায়ী গ্রুপিং
  let totalStockQty = 0;
  let totalStockValue = 0;
  const groupedData = {};

  masterVars.forEach(m => {
    const inv = invMap.get(`${m.productName}_${m.size}_${m.color}`);
    const stock = inv ? inv.stock : 0;
    const price = m.costPrice || (inv ? inv.costPrice : 0);
    const value = stock * price;

    totalStockQty += stock;
    totalStockValue += value;

    if (!groupedData[m.category]) groupedData[m.category] = [];
    groupedData[m.category].push({ ...m, stock, value, inventoryId: inv?.id, price });
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
    setEditPrice(item.price);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      if (editingItem.inventoryId) {
        // যদি ইনভেন্টরিতে থাকে, আপডেট করো
        await updateDoc(doc(db, "shop_inventories", editingItem.inventoryId), { 
          stock: Number(editStock),
          costPrice: Number(editPrice)
        });
      } else {
        alert("এই প্রোডাক্টটি এখনো দোকানে আসেনি। দয়া করে ওয়্যারহাউস থেকে ট্রান্সফার করুন।");
      }
      setEditingItem(null);
      alert("Success: আপডেট হয়েছে!");
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Dashboard</h2>
      </div>

      {/* হেডার */}
      <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store size={24} />
          <div>
            <p className="text-[10px] text-gray-300 uppercase tracking-wider">Shop</p>
            <h3 className="font-bold text-lg">{selectedShop}</h3>
          </div>
        </div>
      </div>

      {/* সামারি কার্ড */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Sales</p>
          <h3 className="text-base font-bold text-green-600">৳{todaySales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Expense</p>
          <h3 className="text-base font-bold text-red-600">৳{todayExpense.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-t-4 border-blue-500">
          <p className="text-[10px] text-gray-500 mb-1">Today's Purchase</p>
          <h3 className="text-base font-bold text-blue-600">৳{todayPurchase.toLocaleString('en-IN')}</h3>
        </div>
        <div className={`bg-white p-3 rounded-xl shadow-sm border-t-4 ${todayProfit >= 0 ? 'border-brand-navy' : 'border-orange-500'}`}>
          <p className="text-[10px] text-gray-500 mb-1">Net Profit/Loss</p>
          <h3 className={`text-base font-bold ${todayProfit >= 0 ? 'text-brand-navy' : 'text-orange-600'}`}>৳{todayProfit.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* স্টক সামারি */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 mb-6">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg"><Package size={20} className="text-blue-600"/></div>
          <div>
            <p className="text-[10px] text-gray-500">Total Stock</p>
            <h3 className="text-base font-bold text-brand-navy">{totalStockQty} pcs</h3>
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="bg-green-50 p-2 rounded-lg"><DollarSign size={20} className="text-green-600"/></div>
          <div>
            <p className="text-[10px] text-gray-500">Total Value</p>
            <h3 className="text-base font-bold text-brand-navy">৳{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* সার্চ */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* ক্যাটাগরি ওয়াইজ প্রোডাক্ট লিস্ট */}
      <div className="space-y-4">
        {Object.keys(groupedData).length === 0 && <p className="text-center text-gray-500 py-6">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>}
        
        {Object.entries(groupedData).map(([category, items]: [string, any[]]) => {
          // সার্চ ফিল্টার
          const filteredItems = items.filter(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()));
          if (filteredItems.length === 0) return null;

          return (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* ক্যাটাগরি হেডার */}
              <div className="bg-gray-50 p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-brand-navy text-sm">
                  <Folder size={16} /> {category}
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">{filteredItems.length} Items</span>
              </div>
              
              {/* আইটেম টেবিল */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-center">Stock</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Value</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-bold text-gray-800">{item.productName}</div>
                          <div className="text-[10px] text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-0.5">{item.size} / {item.color}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-1 rounded font-bold ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{item.stock}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">৳{item.price}</td>
                        <td className="px-3 py-2 text-right font-bold text-brand-navy">৳{item.value.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleEditClick(item)} className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition">
                            <Edit size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* এডিট মডাল */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Edit Stock</h3>
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
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
