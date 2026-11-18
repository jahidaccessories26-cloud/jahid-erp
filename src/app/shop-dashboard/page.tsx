// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, ArrowLeft, ShoppingCart, Users, Package, Wallet, PlusCircle } from "lucide-react";

// আজকের তারিখ (ফোনের সময় অনুযায়ী)
const localDate = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

function ShopDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopName = searchParams.get("shop") || "";

  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  const [partyDocs, setPartyDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!shopName) return;

    // ✅ দোকানের নাম লোকাল স্টোরেজে সেভ করা হচ্ছে
    if (typeof window !== "undefined") {
      localStorage.setItem("activeShop", shopName);
    }

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopInventories(data.filter(item => item.shop === shopName));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements"), where("shop", "==", shopName)), (snapshot) => {
      setShopStatements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubParty = onSnapshot(query(collection(db, "buyer_orders"), where("shop", "==", shopName)), (snapshot) => {
      setPartyDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubInv(); unsubStatements(); unsubParty(); };
  }, [shopName]);

  const todayStr = localDate(new Date().toISOString());
  const isToday = (s: any) => s.date && localDate(s.date) === todayStr;
  const sumType = (list: any[], types: string[]) => list.filter(s => isToday(s) && types.includes(s.type)).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const todaySales = sumType(shopStatements, ["Sale"]);
  const partyReceived = sumType(partyDocs, ["Payment"]);
  const todayExpense = sumType(shopStatements, ["Expense"]);
  const todayPaidOut = sumType(shopStatements, ["PaidOut", "Transfer", "Purchase"]);
  const netCash = todaySales + partyReceived - (todayExpense + todayPaidOut);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{shopName} Dashboard</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl border-t-4 border-green-500"><div className="text-xs text-gray-500">আজকের লোকাল বিক্রি</div><h3 className="text-lg font-bold text-green-600">{todaySales}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-teal-500"><div className="text-xs text-gray-500">পার্টির কাছ থেকে পাওয়া</div><h3 className="text-lg font-bold text-teal-600">{partyReceived}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-red-500"><div className="text-xs text-gray-500">আজকের খরচ</div><h3 className="text-lg font-bold text-red-600">{todayExpense}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-orange-500"><div className="text-xs text-gray-500">পেমেন্ট ও ট্রান্সফার</div><h3 className="text-lg font-bold text-orange-600">{todayPaidOut}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-brand-navy col-span-2"><div className="text-xs text-gray-500">আজকের নিট নগদ (আয় − খরচ − পেমেন্ট − ট্রান্সফার)</div><h3 className={`text-xl font-bold ${netCash >= 0 ? "text-brand-navy" : "text-red-600"}`}>{netCash}</h3></div>
      </div>

      <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-6">
        <div className="text-sm text-gray-500">Total Stock Value</div>
        <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
      </div>

      {/* ✅ সেল বাটনসমূহ */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => router.push(`/sales?shop=${shopName}`)} className="bg-blue-600 text-white p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-blue-700 transition">
          <PlusCircle size={24} /> Add Local Sale
        </button>
        <button onClick={() => router.push(`/buyer-statement?shop=${shopName}`)} className="bg-brand-navy text-white p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-brand-navy/90 transition">
          <PlusCircle size={24} /> Add Party Sale
        </button>
      </div>

      <h3 className="font-bold text-gray-700 mb-3">Quick Links</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div onClick={() => router.push(`/sales?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2 hover:shadow-md"><ShoppingCart size={24} className="text-green-600"/> <span className="text-sm font-bold">Sales History</span></div>
        <div onClick={() => router.push(`/buyer-statement?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2 hover:shadow-md"><Users size={24} className="text-purple-600"/> <span className="text-sm font-bold">Buyers</span></div>
        <div onClick={() => router.push(`/shop-inventory?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2 hover:shadow-md"><Package size={24} className="text-blue-600"/> <span className="text-sm font-bold">Stock</span></div>
        <div onClick={() => router.push(`/shop-statement?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2 hover:shadow-md"><Wallet size={24} className="text-orange-600"/> <span className="text-sm font-bold">দৈনিক হিসাব</span></div>
      </div>
    </div>
  );
}

// ✅ Suspense দিয়ে র‍্যাপ করা হলো যাতে বিল্ড ফেইল না করে
export default function ShopDashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-bold text-brand-navy">Loading Dashboard...</div>}>
      <ShopDashboardContent />
    </Suspense>
  );
}
