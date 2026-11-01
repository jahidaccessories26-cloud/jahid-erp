// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { Store, Building2, ChevronRight, Package, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
          setUserName("Jahid");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            setUserShop(docSnap.data().assignedShop || "");
            setUserName(docSnap.data().name || "User");
          }
        }
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      setShopStatements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubProducts(); unsubInv(); unsubStatements(); };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>;

  const warehouseValue = products.reduce((total, p) => {
    const prodValue = p.variations?.reduce((sum: number, v: any) => sum + ((v.stock || 0) * (v.costPrice || 0)), 0) || 0;
    return total + prodValue;
  }, 0);

  const today = new Date().toISOString().split("T")[0];
  const visibleShops = userRole === "admin" ? shops : shops.filter(s => s.name === userShop);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Welcome, {userName}</h2>
        <p className="text-gray-500 text-[11px] md:text-sm mt-0.5">Business overview for today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        
        {/* ওয়্যারহাউস কার্ড */}
        {userRole === "admin" && (
          <Link href="/warehouse" className="bg-white p-3 md:p-5 rounded-xl shadow-sm border-t-4 border-brand-navy hover:shadow-md transition group flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className="bg-brand-navy/10 p-2 md:p-3 rounded-lg md:rounded-xl">
                  <Store size={20} className="text-brand-navy md:hidden" />
                  <Store size={24} className="text-brand-navy hidden md:block" />
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-navy transition" />
              </div>
              <h3 className="text-sm md:text-lg font-bold text-brand-navy mb-0.5">Warehouse</h3>
              <p className="text-[10px] md:text-xs text-gray-500 mb-2 md:mb-4">Main Storage</p>
            </div>
            
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 mt-auto">
              <span className="text-[10px] md:text-xs text-gray-600 block mb-0.5">Stock Value:</span>
              <span className="font-bold text-brand-navy text-xs md:text-lg block truncate">৳{warehouseValue.toLocaleString('en-IN')}</span>
            </div>
          </Link>
        )}

        {/* দোকানের কার্ডসমূহ */}
        {visibleShops.map((shop) => {
          const shopTodaySales = shopStatements
            .filter(s => s.shop === shop.name && s.type === "Sale" && s.date === today)
            .reduce((sum, s) => sum + s.amount, 0);

          const shopStockValue = shopInventories
            .filter(i => i.shop === shop.name)
            .reduce((sum, i) => sum + ((i.stock || 0) * (i.costPrice || 0)), 0);

          return (
            <Link key={shop.id} href={`/shop-inventory?shop=${shop.name}`} className="bg-white p-3 md:p-5 rounded-xl shadow-sm border-t-4 border-green-500 hover:shadow-md transition group flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-2 md:mb-4">
                  <div className="bg-green-50 p-2 md:p-3 rounded-lg md:rounded-xl">
                    <Building2 size={20} className="text-green-600 md:hidden" />
                    <Building2 size={24} className="text-green-600 hidden md:block" />
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-green-600 transition" />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-brand-navy mb-0.5 leading-tight">{shop.name}</h3>
                <p className="text-[10px] md:text-xs text-gray-500 mb-2 md:mb-4">Overview</p>
              </div>
              
              <div className="space-y-1.5 md:space-y-2 mt-auto">
                <div className="bg-green-50/50 p-2 rounded-lg border border-green-100">
                  <div className="flex items-center gap-1 text-[9px] md:text-xs text-green-800 font-medium mb-0.5"><TrendingUp size={10}/> Sales</div>
                  <span className="font-bold text-green-700 text-xs md:text-base block truncate">৳{shopTodaySales.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-1 text-[9px] md:text-xs text-blue-800 font-medium mb-0.5"><Package size={10}/> Stock</div>
                  <span className="font-bold text-blue-700 text-xs md:text-base block truncate">৳{shopStockValue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
