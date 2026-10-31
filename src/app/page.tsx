"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Package, AlertCircle, CheckCircle, ShoppingCart, Box, ShoppingBag, DollarSign } from "lucide-react";

export default function Dashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // ফায়ারবেস থেকে সব ডেটা আনা
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

  // ডেটা ক্যালকুলেশন
  const today = new Date().toISOString().split("T")[0];
  
  const todaySales = sales.filter(s => s.date.startsWith(today));
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  const pendingCorporateOrders = orders.reduce((sum, o) => sum + o.pending, 0);
  const pendingSamples = samples.filter(s => s.currentStatus !== "Approved" && s.currentStatus !== "Rejected").length;
  
  // আজকের স্যাম্পল (শুধু রেফারেন্সের জন্য)
  const todaySamples = samples.filter(s => s.createdAt.startsWith(today)).length;

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-brand-navy mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* ১. Today's Sales */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-600 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Today's Sales</p>
            <h3 className="text-3xl font-bold text-green-700">Tk. {todaySalesTotal}</h3>
          </div>
          <DollarSign size={40} className="text-green-600/20" />
        </div>
        
        {/* ২. Pending Orders */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Pending Corporate Orders</p>
            <h3 className="text-3xl font-bold text-red-600">{pendingCorporateOrders} <span className="text-sm font-normal">pcs</span></h3>
          </div>
          <ShoppingBag size={40} className="text-red-500/20" />
        </div>

        {/* ৩. Total Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-brand-navy flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Products</p>
            <h3 className="text-3xl font-bold text-brand-navy">{products.length}</h3>
          </div>
          <Box size={40} className="text-brand-navy/20" />
        </div>

        {/* ৪. Pending Samples */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-blue-500 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Pending Samples</p>
            <h3 className="text-3xl font-bold text-blue-600">{pendingSamples}</h3>
          </div>
          <Package size={40} className="text-blue-500/20" />
        </div>

      </div>

      {/* নিচের সামারি সেকশন */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* আজকের নতুন স্যাম্পল */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
             <h3 className="text-lg font-bold text-brand-navy mb-2">Today's New Samples</h3>
             <p className="text-gray-500">আজকে {todaySamples} টি নতুন স্যাম্পল যোগ হয়েছে।</p>
           </div>
           <AlertCircle size={32} className="text-brand-navy/20" />
        </div>

        {/* দ্রুত লিংক */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
             <h3 className="text-lg font-bold text-brand-navy mb-2">Quick Actions</h3>
             <p className="text-gray-500">নতুন সেল বা অর্ডার যোগ করতে সাইডবার ব্যবহার করুন।</p>
           </div>
           <CheckCircle size={32} className="text-green-500/20" />
        </div>

      </div>
    </div>
  );
}
