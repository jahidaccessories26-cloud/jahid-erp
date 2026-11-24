// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, Package, Wallet, ArrowRight, Factory } from "lucide-react";

const CACHE_KEY = "homeCacheV1";
const money = (n: any) => "৳" + (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-IN");

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// সংখ্যা না আসা পর্যন্ত ঝিমিয়ে থাকা ধূসর বক্স দেখায়
function Num({ value, className = "" }: { value: any; className?: string }) {
  if (value === undefined || value === null) {
    return <span className="inline-block w-20 h-5 bg-gray-200 rounded animate-pulse align-middle" />;
  }
  return <span className={className}>{money(value)}</span>;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="bg-gray-200 h-20" />
      <div className="p-4 space-y-3">
        <div className="bg-gray-100 h-14 rounded-xl" />
        <div className="bg-gray-100 h-10 rounded-xl" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shopInv, setShopInv] = useState<any[]>([]);
  const [todayStatements, setTodayStatements] = useState<any[]>([]);
  const [todayParty, setTodayParty] = useState<any[]>([]);
  const [fresh, setFresh] = useState(false);
  const [cache, setCache] = useState<any>(null);
  const ready = useRef<any>({});

  useEffect(() => {
    // আগের বার যা দেখা গিয়েছিল, সেটা সাথে সাথে দেখানো হয়
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c) setCache(c);
    } catch (e) {}

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    const mark = (k: string) => {
      ready.current[k] = true;
      if (Object.keys(ready.current).length >= 5) setFresh(true);
    };

    const subs = [
      onSnapshot(query(collection(db, "shops")), s => { setShops(s.docs.map(d => ({ id: d.id, ...d.data() }))); mark("shops"); }),
      onSnapshot(query(collection(db, "products")), s => { setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))); mark("products"); }),
      onSnapshot(query(collection(db, "shop_inventories")), s => { setShopInv(s.docs.map(d => ({ id: d.id, ...d.data() }))); mark("inv"); }),
      onSnapshot(query(collection(db, "shop_statements"), where("date", ">=", startIso)), s => { setTodayStatements(s.docs.map(d => ({ id: d.id, ...d.data() }))); mark("stm"); }),
      onSnapshot(query(collection(db, "buyer_orders"), where("date", ">=", startIso)), s => { setTodayParty(s.docs.map(d => ({ id: d.id, ...d.data() }))); mark("party"); }),
    ];
    return () => subs.forEach(u => u());
  }, []);

  // ---------- সংখ্যা হিসাব ----------
  const live: any = { warehouse: { value: 0, count: 0 }, shops: {} };
  products.forEach(p => (p.variations || []).forEach((v: any) => {
    live.warehouse.value += Number(v.stock || 0) * Number(v.costPrice || 0);
    live.warehouse.count += 1;
  }));
  shops.forEach(s => { live.shops[s.name] = { sales: 0, party: 0, stock: 0 }; });
  shopInv.forEach(i => { const r = live.shops[i.shop]; if (r) r.stock += Number(i.stock || 0) * Number(i.costPrice || 0); });
  todayStatements.forEach(s => { const r = live.shops[s.shop]; if (r && s.type === "Sale") r.sales += Number(s.amount || 0); });
  todayParty.forEach(t => { const r = live.shops[t.shop]; if (r && t.type === "Delivery") r.party += Number(t.amount || 0); });

  // সব তথ্য এলে সেটা ফোনে জমা রাখা হয়, পরের বার দ্রুত দেখানোর জন্য
  useEffect(() => {
    if (!fresh) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ day: dayKey(), shops: shops.map(s => ({ id: s.id, name: s.name })), summary: live }));
    } catch (e) {}
  }, [fresh, shops, products, shopInv, todayStatements, todayParty]);

  const sameDay = cache?.day === dayKey();
  const shopList = shops.length > 0 ? shops : (cache?.shops || []);
  const src = fresh ? live : cache?.summary;
  const wh = src?.warehouse;
  const shopStat = (name: string) => {
    const r = src?.shops?.[name];
    if (!r) return {};
    // পুরনো দিনের বিক্রির সংখ্যা নতুন দিনে দেখানো হয় না
    return fresh || sameDay ? r : { stock: r.stock };
  };

  let dateLabel = "";
  try { dateLabel = new Date().toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long" }); } catch (e) {}

  return (
    <div className="max-w-5xl mx-auto p-4 pb-10">
      <div className="mb-5">
        <p className="text-sm text-gray-500">{dateLabel}</p>
        <h1 className="text-2xl font-bold text-brand-navy">Welcome, Jahid</h1>
        {!fresh && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span> তথ্য আপডেট হচ্ছে...
          </p>
        )}
      </div>

      {/* মালিকের জন্য: দৈনিক মোট হিসাব ও মাল কেনা */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div onClick={() => router.push("/daily-report")} className="bg-brand-navy text-white p-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-90 transition flex items-center gap-3">
          <div className="bg-white/15 p-3 rounded-xl"><Wallet size={24} /></div>
          <div className="flex-1">
            <h2 className="font-bold text-lg leading-tight">দৈনিক মোট হিসাব</h2>
            <p className="text-xs text-white/70">লাভ-লস, মালের দাম, পার্টির পাওনা, আমার দেনা</p>
          </div>
          <ArrowRight size={20} className="text-white/70" />
        </div>
        <div onClick={() => router.push("/purchase")} className="bg-emerald-700 text-white p-4 rounded-2xl shadow-sm cursor-pointer hover:opacity-90 transition flex items-center gap-3">
          <div className="bg-white/15 p-3 rounded-xl"><Factory size={24} /></div>
          <div className="flex-1">
            <h2 className="font-bold text-lg leading-tight">মাল কেনা</h2>
            <p className="text-xs text-white/70">লোকাল থেকে কেনা, ফ্যাক্টরিতে অর্ডার, মাল পাওয়া</p>
          </div>
          <ArrowRight size={20} className="text-white/70" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ওয়্যারহাউস কার্ড */}
        <div onClick={() => router.push("/shop-dashboard?shop=Warehouse")} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition">
          <div className="bg-brand-navy text-white p-4 flex items-center gap-3">
            <div className="bg-white/15 p-3 rounded-xl"><Package size={24} /></div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Warehouse</h2>
              <p className="text-xs text-white/70">মেইন স্টোর</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">মোট মালের দাম</p>
              <p className="text-xl font-bold text-brand-navy"><Num value={wh?.value} /></p>
            </div>
            <div className="flex justify-between items-center text-sm px-1">
              <span className="text-gray-500">আইটেম (সাইজ/রঙসহ)</span>
              <b className="text-brand-navy">{wh ? wh.count : "…"}</b>
            </div>
          </div>
          <div className="border-t px-4 py-2 text-sm font-bold text-brand-navy flex justify-between items-center">খুলুন <ArrowRight size={16} /></div>
        </div>

        {/* লোড হওয়ার সময় ফাঁকা কার্ড */}
        {shopList.length === 0 && !fresh && (<><SkeletonCard /><SkeletonCard /></>)}

        {/* দোকানের কার্ড */}
        {shopList.map((shop: any) => {
          const st: any = shopStat(shop.name);
          return (
            <div key={shop.id} onClick={() => router.push(`/shop-dashboard?shop=${shop.name}`)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4 flex items-center gap-3">
                <div className="bg-white/20 p-3 rounded-xl"><Store size={24} /></div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{shop.name}</h2>
                  <p className="text-xs text-white/80">দোকান</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500">আজকের লোকাল বিক্রি</p>
                    <p className="font-bold text-green-700"><Num value={st.sales} /></p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500">আজকের পার্টি বিল</p>
                    <p className="font-bold text-blue-700"><Num value={st.party} /></p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">মালের দাম</span>
                  <b className="text-brand-navy"><Num value={st.stock} /></b>
                </div>
              </div>
              <div className="border-t px-4 py-2 text-sm font-bold text-green-700 flex justify-between items-center">খুলুন <ArrowRight size={16} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
