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

  // ইউজার চেক
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

  // ডেটা লোড
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

  // ওয়্যারহাউস স্টক ক্যালকুলেশন
  const warehouseStock = products.reduce((total, p) => {
    const prodStock = p.variations?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0;
    return total + prodStock;
  }, 0);

  // আজকের তারিখ
  const today = new Date().toISOString().split("T")[0];

  // দোকান ফিল্টার (ম্যানেজার হলে শুধু নিজের দোকান)
  const visibleShops = userRole === "admin" ? shops : shops.filter(s => s.name === userShop);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-brand-navy">Welcome back, {userName}</h2>
        <p className="text-gray-500 text-sm mt-1">Here is your business overview for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* ওয়্যারহাউস কার্ড (শুধু অ্যাডমিন দেখবে) */}
        {userRole === "admin" && (
          <Link href="/warehouse" className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-brand-navy hover:shadow-md transition group flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-brand-navy/10 p-3 rounded-xl">
                  <Store size={28} className="text-brand-navy" />
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-brand-navy transition" />
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-1">Warehouse</h3>
              <p className="text-sm text-gray-500 mb-4">Main Storage & Stock Transfer</p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-auto">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Stock:</span>
                <span className="font-bold text-brand-navy text-lg">{warehouseStock} pcs</span>
              </div>
            </div>
          </Link>
        )}

        {/* দোকানের কার্ডসমূহ */}
        {visibleShops.map((shop) => {
          // দোকানের আজকের সেলস
          const shopTodaySales = shopStatements
            .filter(s => s.shop === shop.name && s.type === "Sale" && s.date === today)
            .reduce((sum, s) => sum + s.amount, 0);

          // দোকানের মোট স্টক
          const shopStock = shopInventories
            .filter(i => i.shop === shop.name)
            .reduce((sum, i) => sum + i.stock, 0);

          return (
            <Link key={shop.id} href="/shop-inventory" className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500 hover:shadow-md transition group flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-green-50 p-3 rounded-xl">
                    <Building2 size={28} className="text-green-600" />
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-green-600 transition" />
                </div>
                <h3 className="text-xl font-bold text-brand-navy mb-1">{shop.name}</h3>
                <p className="text-sm text-gray-500 mb-4">Shop Overview</p>
              </div>
              
              <div className="space-y-2 mt-auto">
                <div className="bg-green-50/50 p-2.5 rounded-lg border border-green-100 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-green-800 font-medium"><TrendingUp size={14}/> Today's Sales</div>
                  <span className="font-bold text-green-700">৳{shopTodaySales}</span>
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-blue-800 font-medium"><Package size={14}/> Current Stock</div>
                  <span className="font-bold text-blue-700">{shopStock} pcs</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
