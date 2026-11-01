// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store } from "lucide-react";

function ShopInventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shopParam = searchParams.get("shop"); // URL থেকে দোকানের নাম

  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  
  const [products, setProducts] = useState<any[]>([]);
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
          setSelectedShop(shopParam || "No Shop Selected"); 
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
  }, [shopParam]);

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProducts(); unsubInv(); };
  }, []);

  const allMasterVariations = products.flatMap((p: any) =>
    (p.variations || []).map((v: any) => ({
      productName: p.name,
      category: p.category,
      size: v.size,
      color: v.color,
    }))
  );

  const shopInvMap = new Map();
  shopInventories.filter(i => i.shop === selectedShop).forEach(item => {
    const key = `${item.productName}_${item.size}_${item.color}`;
    shopInvMap.set(key, item.stock);
  });

  const displayList = allMasterVariations
    .map(master => {
      const key = `${master.productName}_${master.size}_${master.color}`;
      const shopStock = shopInvMap.get(key) || 0;
      return { ...master, shopStock };
    })
    .filter(item => {
      return item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
             item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
             item.color.toLowerCase().includes(searchTerm.toLowerCase());
    });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Inventory</h2>
      </div>

      {selectedShop && (
        <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center gap-3">
          <Store size={24} />
          <div>
            <p className="text-[10px] text-gray-300 uppercase tracking-wider">Location</p>
            <h3 className="font-bold text-lg">{selectedShop}</h3>
          </div>
        </div>
      )}

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Size/Color</th>
                <th className="px-3 py-3 font-semibold text-right">Stock</th>
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
                  <td className="px-3 py-3">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500">{item.category}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-800">{item.size}</div>
                    <div className="text-[10px] text-gray-500">{item.color}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
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

export default function ShopInventoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>}>
      <ShopInventoryContent />
    </Suspense>
  );
}
