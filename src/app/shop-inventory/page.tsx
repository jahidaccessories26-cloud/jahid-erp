// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store, Edit, X, DollarSign, TrendingUp } from "lucide-react";

export default function ShopInventoryPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  
  const [products, setProducts] = useState<any[]>([]);
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingItem, setEditingItem] = useState<any>(null);
  const [editStock, setEditStock] = useState(0);

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
            setUserShop(docSnap.data().assignedShop || "");
            setSelectedShop(docSnap.data().assignedShop || "");
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // ডেটা লোড
  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop && userRole === "admin") {
        setSelectedShop(data[0].name);
      }
    });

    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubProducts(); unsubInv(); };
  }, [selectedShop, userRole]);

  // ওয়্যারহাউসের সব ভ্যারিয়েশন ফ্ল্যাট করা
  const allMasterVariations = products.flatMap((p: any) =>
    (p.variations || []).map((v: any) => ({
      productName: p.name,
      category: p.category,
      size: v.size,
      color: v.color,
      costPrice: v.costPrice || 0,
    }))
  );

  // নির্দিষ্ট দোকানের ইনভেন্টরি ম্যাপ
  const shopInvMap = new Map();
  shopInventories.filter(i => i.shop === selectedShop).forEach(item => {
    const key = `${item.productName}_${item.size}_${item.color}`;
    shopInvMap.set(key, { id: item.id, stock: item.stock });
  });

  // ফিল্টার ও ক্যালকুলেশন
  let totalStockValue = 0;
  
  const displayList = allMasterVariations
    .map(master => {
      const key = `${master.productName}_${master.size}_${master.color}`;
      const invData = shopInvMap.get(key) || { id: null, stock: 0 };
      const itemTotalValue = invData.stock * master.costPrice;
      
      totalStockValue += itemTotalValue; // মোট ভ্যালু যোগ

      return { ...master, shopStock: invData.stock, inventoryId: invData.id, itemValue: itemTotalValue };
    })
    .filter(item => {
      return item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
             item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.color.toLowerCase().includes(searchTerm.toLowerCase());
    });

  const handleEditClick = (item: any) => {
    if (!item.inventoryId) {
      alert("এই প্রোডাক্টটি এখনো দোকানে আসেনি। আগে ওয়্যারহাউস থেকে ট্রান্সফার করুন।");
      return;
    }
    setEditingItem(item);
    setEditStock(item.shopStock);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const invRef = doc(db, "shop_inventories", editingItem.inventoryId);
      await updateDoc(invRef, { stock: Number(editStock) });
      setEditingItem(null);
      alert("Success: স্টক আপডেট হয়েছে!");
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Inventory</h2>
      </div>

      {/* অ্যাডমিনের জন্য দোকান সিলেক্ট */}
      {userRole === "admin" && (
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
          <Store size={18} className="text-brand-navy ml-2" />
          <select 
            className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-1 cursor-pointer"
            value={selectedShop} 
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.name}>{shop.name}</option>
            ))}
          </select>
        </div>
      )}

      {userRole !== "admin" && selectedShop && (
        <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center gap-3">
          <Store size={24} />
          <div>
            <p className="text-[10px] text-gray-300 uppercase tracking-wider">Location</p>
            <h3 className="font-bold text-lg">{selectedShop}</h3>
          </div>
        </div>
      )}

      {/* সারসংক্ষেপ কার্ড */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Package size={14}/> Total Stock Items</div>
          <h3 className="text-xl font-bold text-brand-navy">
            {displayList.reduce((sum, item) => sum + item.shopStock, 0)} pcs
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><DollarSign size={14}/> Total Stock Value</div>
          <h3 className="text-xl font-bold text-green-600">
            ৳{totalStockValue.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      {/* সার্চ বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search by product, size, color..." 
          className="w-full bg-transparent outline-none text-sm py-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ইনভেন্টরি টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Product Details</th>
                <th className="px-3 py-3 font-semibold text-center">Stock</th>
                <th className="px-3 py-3 font-semibold text-right">Value (৳)</th>
                <th className="px-3 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    কোনো প্রোডাক্ট পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {displayList.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{item.category}</div>
                    <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {item.size} / {item.color}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg font-bold text-xs ${
                      item.shopStock > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {item.shopStock}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">
                    ৳{item.itemValue.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button 
                      onClick={() => handleEditClick(item)} 
                      className={`p-1.5 rounded-lg transition ${item.inventoryId ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* এডিট স্টক মডাল */}
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
              <p className="text-gray-500 text-xs mt-1">Cost Price: ৳{editingItem.costPrice}</p>
            </div>

            <form onSubmit={handleUpdateStock}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">New Stock Quantity</label>
                <input 
                  required 
                  type="number" 
                  className="w-full border p-2 rounded-lg text-lg font-bold" 
                  value={editStock} 
                  onChange={(e) => setEditStock(Number(e.target.value))} 
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg">Update Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
