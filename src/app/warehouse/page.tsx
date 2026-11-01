// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { Store, ArrowRight, Package, Search, Edit, X, ArrowRightCircle } from "lucide-react";

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  
  // ফিল্টার ও সার্চ
  const [searchTerm, setSearchTerm] = useState("");
  
  // ট্রান্সফার মডাল স্টেট
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    product: null,
    varIndex: -1,
    qty: 0,
    shop: ""
  });

  // এডিট মডাল স্টেট
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    productId: "",
    varIndex: -1,
    newStock: 0,
    newPrice: 0
  });

  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0) {
        setTransferData(prev => ({ ...prev, shop: data[0].name }));
      }
    });

    return () => { unsubProducts(); unsubShops(); };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ট্রান্সফার হ্যান্ডলার
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { product, varIndex, qty, shop } = transferData;
    setMessage("");

    if (!product || varIndex === -1 || qty <= 0 || !shop) {
      setMessage("সব তথ্য সঠিকভাবে দিন!"); return;
    }

    const variation = product.variations[varIndex];
    if (qty > variation.stock) {
      setMessage(`Error: ওয়্যারহাউসে মাত্র ${variation.stock} পিস আছে!`); return;
    }

    try {
      // ওয়্যারহাউস স্টক কমানো
      const updatedVariations = [...product.variations];
      updatedVariations[varIndex].stock -= qty;
      await updateDoc(doc(db, "products", product.id), { variations: updatedVariations });

      // দোকানের ইনভেন্টরি বাড়ানো
      const shopInvId = `${shop}_${product.id}_${variation.size}_${variation.color}`.replace(/\s+/g, '_');
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDoc(shopInvRef);

      if (shopInvSnap.exists()) {
        await updateDoc(shopInvRef, { stock: increment(qty) });
      } else {
        await setDoc(shopInvRef, {
          shop: shop, productName: product.name, category: product.category,
          size: variation.size, color: variation.color, stock: qty,
          costPrice: variation.costPrice, sellingPrice: variation.sellingPrice || 0
        });
      }

      // লগ সেভ
      await addDoc(collection(db, "stock_logs"), {
        shop: shop, productName: product.name, size: variation.size, color: variation.color,
        quantity: qty, type: "Warehouse Transfer", date: new Date().toISOString(), createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${qty} পিস ${product.name} ${shop}-এ পাঠানো হয়েছে!`);
      setShowTransferModal(false);
    } catch (error) { setMessage("ট্রান্সফার করতে সমস্যা হয়েছে!"); }
  };

  // এডিট হ্যান্ডলার
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, varIndex, newStock, newPrice } = editData;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      const updatedVariations = [...product.variations];
      updatedVariations[varIndex].stock = newStock;
      updatedVariations[varIndex].costPrice = newPrice;
      await updateDoc(doc(db, "products", productId), { variations: updatedVariations });
      
      setMessage("Success: স্টক ও দাম আপডেট হয়েছে!");
      setShowEditModal(false);
    } catch (error) { setMessage("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy">Warehouse Stock</h2>
      </div>

      {message && (
        <div className={`p-3 mb-4 rounded-lg font-medium text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* সার্চ বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search product or category..." 
          className="w-full bg-transparent outline-none text-sm py-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* প্রোডাক্ট লিস্ট */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.length === 0 && <p className="text-gray-500 text-center col-span-2 py-4">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>}
        
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 mb-3 border-b pb-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={18} /></div>
              <div>
                <h3 className="text-sm font-bold text-brand-navy">{product.name}</h3>
                <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{product.category}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left mb-3">
                <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-2 py-1">Size/Color</th>
                    <th className="px-2 py-1 text-right">Stock</th>
                    <th className="px-2 py-1 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variations.map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{v.size} / {v.color}</td>
                      <td className="px-2 py-2 text-right font-bold text-brand-navy">{v.stock}</td>
                      <td className="px-2 py-2 text-center flex justify-center gap-1">
                        <button 
                          onClick={() => {
                            setEditData({ productId: product.id, varIndex: i, newStock: v.stock, newPrice: v.costPrice });
                            setShowEditModal(true);
                          }}
                          className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200 transition"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setTransferData({ product, varIndex: i, qty: 0, shop: shops[0]?.name || "" });
                            setShowTransferModal(true);
                          }}
                          className="bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 transition"
                        >
                          <ArrowRightCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ট্রান্সফার মডাল */}
      {showTransferModal && transferData.product && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Transfer Stock</h3>
              <button onClick={() => setShowTransferModal(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
              <p className="font-bold text-brand-navy">{transferData.product.name}</p>
              <p className="text-gray-500 text-xs">{transferData.product.variations[transferData.varIndex].size} / {transferData.product.variations[transferData.varIndex].color}</p>
              <p className="text-gray-500 text-xs mt-1">Available: <strong>{transferData.product.variations[transferData.varIndex].stock} pcs</strong></p>
            </div>

            <form onSubmit={handleTransfer}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Quantity (pcs)</label>
                <input required type="number" min="1" max={transferData.product.variations[transferData.varIndex].stock} className="w-full border p-2 rounded-lg font-bold" value={transferData.qty || ""} onChange={(e) => setTransferData({...transferData, qty: Number(e.target.value)})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Destination Shop</label>
                <select className="w-full border p-2 rounded-lg text-sm font-medium" value={transferData.shop} onChange={(e) => setTransferData({...transferData, shop: e.target.value})}>
                  {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Transfer Now</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* এডিট মডাল */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Edit Warehouse Stock</h3>
              <button onClick={() => setShowEditModal(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>

            <form onSubmit={handleEdit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">New Stock Quantity</label>
                <input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newStock} onChange={(e) => setEditData({...editData, newStock: Number(e.target.value)})} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Cost Price (৳)</label>
                <input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newPrice} onChange={(e) => setEditData({...editData, newPrice: Number(e.target.value)})} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
