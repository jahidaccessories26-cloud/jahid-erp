"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { Package, AlertCircle, CheckCircle, ShoppingBag, DollarSign, Store, Box } from "lucide-react";

export default function Dashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  
  const [userRole, setUserRole] = useState("manager");
  const [userShop, setUserShop] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // ১. ইউজারের রোল এবং দোকান চেক করা
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        // ফলব্যাক লজিক: ইমেইলে admin থাকলে সরাসরি অ্যাডমিন
        if (user.email.includes("admin@jahid.com")) {
          setUserRole("admin");
          setUserName("Jahid (Admin)");
        } else {
          // ফায়ারবেস থেকে রোল চেক করা
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

  // ২. ডেটা লোড করা
  useEffect(() => {
    const unsubSamples = onSnapshot(query(collection(db, "samples")), (snapshot) => {
      setSamples(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSales = onSnapshot(query(collection(db, "sales")), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubOrders = onSnapshot(query(collection(db, "corporate_orders")), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShopInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubSamples(); unsubSales(); unsubProducts(); unsubOrders(); unsubShopInv(); };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading Dashboard...</div>;

  // ৩. ডেটা ফিল্টার
  const today = new Date().toISOString().split("T")[0];

  // অ্যাডমিন ডেটা
  const adminTodaySales = sales.filter(s => s.date.startsWith(today)).reduce((sum, s) => sum + s.totalAmount, 0);
  const adminPendingOrders = orders.reduce((sum, o) => sum + o.pending, 0);
  const adminPendingSamples = samples.filter(s => s.currentStatus !== "Approved" && s.currentStatus !== "Rejected").length;

  // ম্যানেজার ডেটা
  const managerTodaySales = sales.filter(s => s.shop === userShop && s.date.startsWith(today)).reduce((sum, s) => sum + s.totalAmount, 0);
  const managerPendingOrders = orders.filter(o => o.shop === userShop).reduce((sum, o) => sum + o.pending, 0);
  const managerStock = shopInventories.filter(i => i.shop === userShop).reduce((sum, i) => sum + i.stock, 0);

  // ওয়্যারহাউস স্টক
  const warehouseStock = products.reduce((total, p) => {
    const prodStock = p.variations?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0) || 0;
    return total + prodStock;
  }, 0);

  // রোল চেক
  const isAdmin = userRole === "admin";
  const isManager = ["manager", "assistant_manager"].includes(userRole);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-navy">Dashboard Overview</h2>
          <p className="text-gray-500 text-sm mt-1">Welcome back, <strong>{userName || "User"}</strong> ({userRole})</p>
        </div>
      </div>

      {/* ------------------- অ্যাডমিন ড্যাশবোর্ড ------------------- */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-green-600">
              <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Today's Total Sales</p>
              <h3 className="text-xl md:text-3xl font-bold text-green-700">Tk. {adminTodaySales}</h3>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-red-500">
              <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Pending Orders</p>
              <h3 className="text-xl md:text-3xl font-bold text-red-600">{adminPendingOrders} <span className="text-xs font-normal">pcs</span></h3>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-brand-navy">
              <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Total Products</p>
              <h3 className="text-xl md:text-3xl font-bold text-brand-navy">{products.length}</h3>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-blue-500">
              <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Pending Samples</p>
              <h3 className="text-xl md:text-3xl font-bold text-blue-600">{adminPendingSamples}</h3>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2"><Store size={18}/> Warehouse Status</h3>
            <p className="text-gray-600">Total items currently in warehouse: <strong>{warehouseStock} pcs</strong></p>
          </div>
        </>
      )}

      {/* ------------------- ম্যানেজার ড্যাশবোর্ড ------------------- */}
      {isManager && (
        <>
          <div className="bg-brand-navy text-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-3">
            <Store size={24} />
            <div>
              <p className="text-xs text-gray-300">Assigned Shop</p>
              <h3 className="text-lg font-bold">{userShop || "No Shop Assigned"}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-green-600">
              <p className="text-gray-500 text-sm font-medium mb-1">Today's Sales (My Shop)</p>
              <h3 className="text-2xl font-bold text-green-700">Tk. {managerTodaySales}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-500">
              <p className="text-gray-500 text-sm font-medium mb-1">My Current Stock</p>
              <h3 className="text-2xl font-bold text-blue-600">{managerStock} <span className="text-sm font-normal">pcs</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-red-500">
              <p className="text-gray-500 text-sm font-medium mb-1">Pending Orders (My Shop)</p>
              <h3 className="text-2xl font-bold text-red-600">{managerPendingOrders} <span className="text-sm font-normal">pcs</span></h3>
            </div>
          </div>

          <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 flex items-center justify-between">
             <div>
               <h3 className="font-bold text-blue-900 mb-1 flex items-center gap-2"><Box size={18}/> Warehouse Stock</h3>
               <p className="text-sm text-blue-700">মাল প্রয়োজন হলে ওয়্যারহাউস থেকে ট্রান্সফার করুন।</p>
             </div>
             <h3 className="text-2xl font-bold text-brand-navy">{warehouseStock} pcs</h3>
          </div>
        </>
      )}
    </div>
  );
}
