// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubShops();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-brand-navy mb-6">Welcome, Jahid</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ওয়্যারহাউস কার্ড */}
        <div onClick={() => router.push(`/shop-dashboard?shop=Warehouse`)} className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-brand-navy cursor-pointer hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-brand-navy/10 p-3 rounded-lg"><Store className="text-brand-navy" size={24} /></div>
            <div>
              <h2 className="font-bold text-lg">Warehouse</h2>
              <p className="text-xs text-gray-500">Main Storage</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">Stock Value:</p>
          <p className="font-bold text-brand-navy text-lg">৳0</p>
        </div>

        {/* শপ কার্ডসমূহ */}
        {shops.map(shop => (
          <div key={shop.id} onClick={() => router.push(`/shop-dashboard?shop=${shop.name}`)} className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500 cursor-pointer hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-50 p-3 rounded-lg"><Store className="text-green-600" size={24} /></div>
              <div>
                <h2 className="font-bold text-lg">{shop.name}</h2>
                <p className="text-xs text-gray-500">Overview</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm border-t pt-2 mt-2">
              <span className="text-gray-500">Sales</span>
              <span className="font-bold text-green-600">৳0</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-500">Stock</span>
              <span className="font-bold text-brand-navy">৳0</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
