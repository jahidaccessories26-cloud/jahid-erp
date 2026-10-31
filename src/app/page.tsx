"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Package, AlertCircle, CheckCircle, ShoppingBag, DollarSign } from "lucide-react";

export default function Dashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

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

    return () => { unsubSamples(); unsubSales(); unsubProducts(); unsubOrders(); };
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todaySalesTotal = sales.filter(s => s.date.startsWith(today)).reduce((sum, s) => sum + s.totalAmount, 0);
  const pendingCorporateOrders = orders.reduce((sum, o) => sum + o.pending, 0);
  const pendingSamples = samples.filter(s => s.currentStatus !== "Approved" && s.currentStatus !== "Rejected").length;
  const todaySamples = samples.filter(s => s.createdAt.startsWith(today)).length;

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-brand-navy mb-4">Dashboard Overview</h2>
      
      {/* মোবাইলে ২ কলাম, ডেস্কটপে ৪ কলাম */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-green-600 flex flex-col justify-between">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Today's Sales</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl md:text-3xl font-bold text-green-700">Tk. {todaySalesTotal}</h3>
            <DollarSign size={24} className="text-green-600/20 hidden md:block" />
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-red-500 flex flex-col justify-between">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Pending Orders</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl md:text-3xl font-bold text-red-600">{pendingCorporateOrders} <span className="text-xs font-normal">pcs</span></h3>
            <ShoppingBag size={24} className="text-red-500/20 hidden md:block" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-brand-navy flex flex-col justify-between">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Total Products</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl md:text-3xl font-bold text-brand-navy">{products.length}</h3>
            <Package size={24} className="text-brand-navy/20 hidden md:block" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-blue-500 flex flex-col justify-between">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">Pending Samples</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl md:text-3xl font-bold text-blue-600">{pendingSamples}</h3>
            <AlertCircle size={24} className="text-blue-500/20 hidden md:block" />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
             <h3 className="text-base md:text-lg font-bold text-brand-navy mb-1">Today's New Samples</h3>
             <p className="text-sm text-gray-500">আজকে {todaySamples} টি নতুন স্যাম্পল যোগ হয়েছে।</p>
           </div>
           <CheckCircle size={28} className="text-brand-navy/20" />
        </div>
      </div>
    </div>
  );
}
