// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, addDoc, increment } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, ArrowLeft, ShoppingCart, Users, Box, Package, Wallet, X, PlusCircle, Search } from "lucide-react";

export default function ShopDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopName = searchParams.get("shop") || "";

  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState("");

  // লোকাল সেল স্টেট
  const [showLocalSale, setShowLocalSale] = useState(false);
  const [localSaleData, setLocalSaleData] = useState({ productId: "", qty: "", amount: "" });

  // পার্টি সেল স্টেট
  const [showPartySale, setShowPartySale] = useState(false);
  const [partySaleData, setPartySaleData] = useState({ buyerId: "", productId: "", qty: "", amount: "" });
  const [buyers, setBuyers] = useState<any[]>([]);

  useEffect(() => {
    if (!shopName) return;

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopInventories(data.filter(item => item.shop === shopName));
    });

    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopStatements(data.filter(item => item.shop === shopName));
    });

    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyers(data.filter(item => item.shop === shopName));
    });

    return () => { unsubInv(); unsubStatements(); unsubBuyers(); };
  }, [shopName]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayStatements = shopStatements.filter(s => s.date?.startsWith(todayStr));
  const todaySales = todayStatements.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = todayStatements.filter(s => s.type === 'Expense').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = todayStatements.filter(s => s.type === 'Purchase').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  const searchedProducts = shopInventories.filter(p => p.productName.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5);

  // লোকাল সেল সেভ
  const handleLocalSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = shopInventories.find(p => p.id === localSaleData.productId);
      if (!prod || prod.stock < Number(localSaleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");
      
      await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(localSaleData.qty)) });
      await addDoc(collection(db, "shop_statements"), {
        shop: shopName, type: "Sale", title: prod.productName, amount: Number(localSaleData.amount), date: new Date().toISOString()
      });
      setShowLocalSale(false); setLocalSaleData({ productId: "", qty: "", amount: "" }); setProdSearch(""); alert("সেল সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // পার্টি সেল সেভ
  const handlePartySale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = shopInventories.find(p => p.id === partySaleData.productId);
      const buyer = buyers.find(b => b.id === partySaleData.buyerId);
      if (!prod || prod.stock < Number(partySaleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");
      
      await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(partySaleData.qty)) });
      await addDoc(collection(db, "buyer_orders"), {
        shop: shopName, buyerId: buyer.id, buyerName: buyer.name, type: "Delivery", 
        items: [{ productId: prod.id, productName: prod.productName, qty: Number(partySaleData.qty), amount: Number(partySaleData.amount) }],
        date: new Date().toISOString()
      });
      setShowPartySale(false); setPartySaleData({ buyerId: "", productId: "", qty: "", amount: "" }); setProdSearch(""); alert("পার্টি সেল সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{shopName} Dashboard</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl border-t-4 border-green-500"><div className="text-xs text-gray-500">Today's Sales</div><h3 className="text-lg font-bold text-green-600">{todaySales}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-red-500"><div className="text-xs text-gray-500">Expense</div><h3 className="text-lg font-bold text-red-600">{todayExpense}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500"><div className="text-xs text-gray-500">Purchase</div><h3 className="text-lg font-bold text-blue-600">{todayPurchase}</h3></div>
        <div className="bg-white p-3 rounded-xl border-t-4 border-brand-navy"><div className="text-xs text-gray-500">Profit/Loss</div><h3 className="text-lg font-bold text-brand-navy">{profitLoss}</h3></div>
      </div>

      <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-6">
        <div className="text-sm text-gray-500">Total Stock Value</div>
        <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
      </div>

      {/* সেল বাটনসমূহ */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setShowLocalSale(true)} className="bg-blue-600 text-white p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm">
          <PlusCircle size={24} /> Local Sale
        </button>
        <button onClick={() => setShowPartySale(true)} className="bg-brand-navy text-white p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm">
          <PlusCircle size={24} /> Party Sale
        </button>
      </div>

      <h3 className="font-bold text-gray-700 mb-3">Quick Links</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div onClick={() => router.push(`/sales?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2"><ShoppingCart size={24} className="text-green-600"/> <span className="text-sm font-bold">Sales History</span></div>
        <div onClick={() => router.push(`/buyer-statement?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2"><Users size={24} className="text-purple-600"/> <span className="text-sm font-bold">Buyers</span></div>
        <div onClick={() => router.push(`/shop-inventory?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2"><Package size={24} className="text-blue-600"/> <span className="text-sm font-bold">Stock</span></div>
        <div onClick={() => router.push(`/shop-statement?shop=${shopName}`)} className="bg-white p-4 rounded-xl border cursor-pointer flex flex-col items-center gap-2"><Wallet size={24} className="text-orange-600"/> <span className="text-sm font-bold">Expense</span></div>
      </div>

      {/* লোকাল সেল মডাল */}
      {showLocalSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Local Sale</h3>
            <form onSubmit={handleLocalSale} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Search Product</label>
                <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                  {searchedProducts.map(p => (
                    <div key={p.id} onClick={() => { setLocalSaleData({...localSaleData, productId: p.id, amount: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} - Stock: {p.stock}</div>
                  ))}
                </div>
              </div>
              <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={localSaleData.qty} onChange={e => setLocalSaleData({...localSaleData, qty: e.target.value})} /></div>
              <div><label className="text-xs">Total Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={localSaleData.amount} onChange={e => setLocalSaleData({...localSaleData, amount: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLocalSale(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* পার্টি সেল মডাল */}
      {showPartySale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Party Sale</h3>
            <form onSubmit={handlePartySale} className="space-y-3">
              <div><label className="text-xs">Select Buyer</label>
                <select required className="w-full border p-2 rounded" value={partySaleData.buyerId} onChange={e => setPartySaleData({...partySaleData, buyerId: e.target.value})}>
                  <option value="">-- Select --</option>
                  {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Search Product</label>
                <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                  {searchedProducts.map(p => (
                    <div key={p.id} onClick={() => { setPartySaleData({...partySaleData, productId: p.id, amount: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} - Stock: {p.stock}</div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={partySaleData.qty} onChange={e => setPartySaleData({...partySaleData, qty: e.target.value})} /></div>
                <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={partySaleData.amount} onChange={e => setPartySaleData({...partySaleData, amount: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPartySale(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
