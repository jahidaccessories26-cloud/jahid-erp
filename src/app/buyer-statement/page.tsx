// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { ShoppingBag, User, CheckCircle, Clock } from "lucide-react";

export default function BuyerStatementPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuyer, setSelectedBuyer] = useState("All");

  useEffect(() => {
    const q = query(collection(db, "corporate_orders"));
    const unsub = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // বায়ার লিস্ট তৈরি
  const buyers = Array.from(new Set(orders.map(o => o.buyerName)));

  // বায়ার অনুযায়ী ডেটা ফিল্টার
  const filteredOrders = selectedBuyer === "All" ? orders : orders.filter(o => o.buyerName === selectedBuyer);

  // সামারি ক্যালকুলেশন
  const totalOrdered = filteredOrders.reduce((sum, o) => sum + o.totalOrdered, 0);
  const totalDelivered = filteredOrders.reduce((sum, o) => sum + o.delivered, 0);
  const totalPending = filteredOrders.reduce((sum, o) => sum + o.pending, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4 flex items-center gap-2">
        <User size={24} /> Buyer Statement
      </h2>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 px-2">Filter by Buyer:</span>
        <select 
          className="border p-2 rounded-lg text-sm font-medium text-brand-navy outline-none cursor-pointer w-full md:w-64"
          value={selectedBuyer}
          onChange={(e) => setSelectedBuyer(e.target.value)}
        >
          <option value="All">All Buyers</option>
          {buyers.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* সামারি কার্ড */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-brand-navy">
          <p className="text-gray-500 text-sm font-medium mb-1">Total Ordered</p>
          <h3 className="text-2xl font-bold text-brand-navy">{totalOrdered} pcs</h3>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-green-500">
          <p className="text-gray-500 text-sm font-medium mb-1">Total Delivered</p>
          <h3 className="text-2xl font-bold text-green-600">{totalDelivered} pcs</h3>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-red-500">
          <p className="text-gray-500 text-sm font-medium mb-1">Total Pending</p>
          <h3 className="text-2xl font-bold text-red-600">{totalPending} pcs</h3>
        </div>
      </div>

      {/* ডিটেইলস টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <ShoppingBag size={20} /> Order History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Delivered</th>
                <th className="px-4 py-3 text-center">Pending</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">কোনো অর্ডার পাওয়া যায়নি।</td></tr>}
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold text-brand-navy">{order.buyerName}</td>
                  <td className="px-4 py-3">
                    {order.productName} <span className="text-xs text-gray-500">({order.size} / {order.color})</span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{order.totalOrdered}</td>
                  <td className="px-4 py-3 text-center font-bold text-green-600">{order.delivered}</td>
                  <td className="px-4 py-3 text-center font-bold text-red-600">{order.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
