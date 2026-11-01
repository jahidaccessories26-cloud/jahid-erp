// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { Store, Package, Search } from "lucide-react";

export default function ShopInventoryPage() {
  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  
  const [products, setProducts] = useState<any[]>([]);
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

  // ওয়্যারহাউসের সব ভ্যারিয়েশন ফ্ল্যাট করা (মাস্টার লিস্ট)
  const allMasterVariations = products.flatMap((p: any) =>
    (p.variations || []).map((v: any) => ({
      productId: p.id,
      productName: p.name,
      category: p.category,
      size: v.size,
      color: v.color,
      masterStock: v.stock || 0,
      costPrice: v.costPrice || 0
    }))
  );

  // নির্দিষ্ট দোকানের ইনভেন্টরি ম্যাপ তৈরি (দ্রুত খোঁজার জন্য)
  const shopInvMap = new Map();
  shopInventories.filter(i => i.shop === selectedShop).forEach(item => {
    // কী তৈরি: productName_size_color
    const key = `${item.productName}_${item.size}_${item.color}`;
    shopInvMap.set(key, item.stock);
  });

  // ফিল্টার করা লিস্ট (মাস্টার + দোকানের স্টক একসাথে)
  const displayList = allMasterVariations
    .map(master => {
      const key = `${master.productName}_${master.size}_${master.color}`;
      const shopStock = shopInvMap.get(key) || 0; // দোকানে না থাকলে ০
      return { ...master, shopStock };
    })
    .filter(item => {
      const searchMatch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.color.toLowerCase().includes(searchTerm.toLowerCase());
      // শুধু ওই প্রোডাক্টগুলো দেখাবে যেগুলো হয় ওয়্যারহাউসে আছে, নাহয় দোকানে আছে
      return searchMatch;
    });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy">Shop Inventory</h2>
        
        {/* অ্যাডমিন দোকান সিলেক্ট করতে পারবে */}
        {userRole === "admin" ? (
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm w-full md:w-auto">
            <Store size={20} className="text-brand-navy" />
            <select 
              className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer w-full"
              value={selectedShop} 
              onChange={(e) => setSelectedShop(e.target.value)}
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.name}>{shop.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 w-full md:w-auto justify-center">
            <Store size={18} /> {userShop}
          </div>
        )}
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
        <div className="p-3 bg-gray-50 border-b flex items-center gap-2 font-bold text-gray-700 text-sm md:text-base">
          <Package size={18} /> Stock at {selectedShop || "Select a Shop"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-2 md:px-4 py-2 font-semibold">Product</th>
                <th className="px-2 md:px-4 py-2 font-semibold">Size/Color</th>
                <th className="px-2 md:px-4 py-2 font-semibold text-right">Shop Stock</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    কোনো প্রোডাক্ট পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {displayList.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-2 md:px-4 py-2">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500">{item.category}</div>
                  </td>
                  <td className="px-2 md:px-4 py-2">
                    <div className="font-medium text-gray-800">{item.size}</div>
                    <div className="text-[10px] text-gray-500">{item.color}</div>
                  </td>
                  <td className="px-2 md:px-4 py-2 text-right">
                    <span className={`inline-block px-2 py-1 rounded font-bold text-xs md:text-sm ${
                      item.shopStock > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {item.shopStock}
                    </span>
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
