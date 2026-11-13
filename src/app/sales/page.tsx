// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, increment, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Store, Package } from "lucide-react";

export default function SalesPage() {
  const router = useRouter();
  
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  
  // ✅ লোকাল স্টোরেজ থেকে দোকানের নাম নেওয়া হচ্ছে
  const [saleData, setSaleData] = useState(() => {
    let activeShop = "";
    if (typeof window !== "undefined") {
      activeShop = localStorage.getItem("activeShop") || "";
    }
    return { shop: activeShop, productId: "", qty: "", amount: "" };
  });

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubProducts(); };
  }, []);

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === saleData.productId);
      if (!prod || prod.stock < Number(saleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");
      
      // স্টক কমানো
      await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(saleData.qty)) });
      
      // হিস্ট্রিতে যোগ করা
      await addDoc(collection(db, "shop_statements"), {
        shop: saleData.shop, type: "Sale", title: prod.productName, amount: Number(saleData.amount), date: new Date().toISOString()
      });
      
      setSaleData({ shop: saleData.shop, productId: "", qty: "", amount: "" }); 
      setProdSearch("");
      alert("নতুন সেল সেভ হয়েছে!");
      router.back(); 
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // প্রোডাক্ট সার্চ (শুধু সিলেক্ট করা দোকানের)
  const searchedProducts = products.filter(p => 
    (p.shop === saleData.shop) && 
    p.productName.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Add New Sale</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleSaveSale} className="space-y-4">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Shop</label>
            <div className="flex items-center border rounded-lg p-2 bg-gray-50">
              <Store size={18} className="text-gray-400 mr-2" />
              <select 
                required 
                className="w-full bg-transparent outline-none font-medium text-brand-navy" 
                value={saleData.shop} 
                onChange={e => setSaleData({...saleData, shop: e.target.value})}
              >
                <option value="">-- Select Shop --</option>
                {/* ✅ যদি লোকাল স্টোরেজে দোকান থাকে, তবে শুধু সেই দোকানটাই অপশন হিসেবে দেখাবে */}
                {saleData.shop ? (
                  <option value={saleData.shop}>{saleData.shop}</option>
                ) : (
                  shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Search Product</label>
            <div className="flex items-center border rounded-lg p-2">
              <Package size={18} className="text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Type product name to search..." 
                className="w-full outline-none text-sm" 
                value={prodSearch} 
                onChange={e => setProdSearch(e.target.value)} 
              />
            </div>
            {prodSearch && (
              <div className="mt-2 border rounded-lg overflow-hidden bg-white shadow-sm">
                {searchedProducts.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No product found in this shop.</p>
                ) : (
                  searchedProducts.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { setSaleData({...saleData, productId: p.id, amount: p.costPrice.toString()}); setProdSearch(p.productName); }} 
                      className="p-3 text-sm border-b last:border-0 cursor-pointer hover:bg-blue-50 flex justify-between"
                    >
                      <span className="font-medium">{p.productName}</span>
                      <span className="text-xs text-gray-500">Stock: {p.stock}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
              <input 
                required 
                type="number" 
                className="w-full border p-2 rounded-lg outline-none focus:border-brand-navy" 
                value={saleData.qty} 
                onChange={e => setSaleData({...saleData, qty: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Total Amount (৳)</label>
              <input 
                required 
                type="number" 
                className="w-full border p-2 rounded-lg outline-none focus:border-brand-navy font-bold text-green-600" 
                value={saleData.amount} 
                onChange={e => setSaleData({...saleData, amount: e.target.value})} 
              />
            </div>
          </div>

          <div className="pt-4 border-t mt-4">
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition">
              <PlusCircle size={20} /> Save Sale
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
