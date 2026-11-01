// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { Package, Search, Edit, X, PlusCircle, ShoppingCart, Trash2, Factory, History, User } from "lucide-react";

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  
  // কার্ট
  const [cart, setCart] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ইউজার ডেটা
  const [currentUserName, setCurrentUserName] = useState("Admin");

  // প্রোডাকশন স্টেট
  const [showProdModal, setShowProdModal] = useState(false);
  const [prodData, setProdData] = useState({ productId: "", size: "", color: "", qty: 0, costPrice: 0 });

  // এডিট স্টেট
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ productId: "", varIndex: -1, newStock: 0, newPrice: 0 });

  const [message, setMessage] = useState("");

  useEffect(() => {
    // ইউজারের নাম বের করা (কে ট্রান্সফার করছে)
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setCurrentUserName("Admin (Jahid)");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            const role = docSnap.data().role;
            const name = docSnap.data().name || user.email;
            setCurrentUserName(`${name} (${role})`);
          }
        }
      }
    });

    const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });

    const unsubTransfers = onSnapshot(query(collection(db, "stock_logs"), orderBy("createdAt", "desc")), (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // ট্রান্সফার লগ ফিল্টার
      setTransfers(allLogs.filter((log: any) => log.type === "Warehouse Transfer" || log.type === "Production Inward"));
    });

    return () => { unsubAuth(); unsubProducts(); unsubShops(); unsubTransfers(); };
  }, [selectedShop]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // কার্ট
  const addToCart = (product: any, varIndex: number) => {
    const variation = product.variations[varIndex];
    const existingIndex = cart.findIndex(c => c.productId === product.id && c.varIndex === varIndex);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { productId: product.id, varIndex, name: product.name, size: variation.size, color: variation.color, qty: 1, maxStock: variation.stock }]);
    }
  };

  const updateCartQty = (index: number, qty: number) => {
    const newCart = [...cart];
    newCart[index].qty = qty;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  // ট্রান্সফার (কে ট্রান্সফার করছে তার নামসহ)
  const handleBulkTransfer = async () => {
    if (cart.length === 0 || !selectedShop) { setMessage("Error: কার্টে আইটেম নেই বা দোকান সিলেক্ট করা হয়নি!"); return; }
    try {
      for (const item of cart) {
        if (item.qty > item.maxStock) { setMessage(`Error: ${item.name}-এর স্টক পর্যাপ্ত নয়!`); return; }
        const product = products.find(p => p.id === item.productId);
        const variation = product.variations[item.varIndex];

        const updatedVariations = [...product.variations];
        updatedVariations[item.varIndex].stock -= item.qty;
        await updateDoc(doc(db, "products", product.id), { variations: updatedVariations });

        const shopInvId = `${selectedShop}_${product.id}_${variation.size}_${variation.color}`.replace(/\s+/g, '_');
        const shopInvRef = doc(db, "shop_inventories", shopInvId);
        const shopInvSnap = await getDoc(shopInvRef);

        if (shopInvSnap.exists()) {
          await updateDoc(shopInvRef, { stock: increment(item.qty) });
        } else {
          await setDoc(shopInvRef, {
            shop: selectedShop, productName: product.name, category: product.category,
            size: variation.size, color: variation.color, stock: item.qty, costPrice: variation.costPrice
          });
        }

        // লগ সেভ (কার নাম সহ)
        await addDoc(collection(db, "stock_logs"), {
          shop: selectedShop, productName: product.name, size: variation.size, color: variation.color,
          quantity: item.qty, type: "Warehouse Transfer", transferredBy: currentUserName,
          date: new Date().toISOString(), createdAt: new Date().toISOString()
        });
      }
      setMessage(`Success: ${cart.length} টি আইটেম ${selectedShop}-এ পাঠানো হয়েছে!`);
      setCart([]);
    } catch (error) { setMessage("ট্রান্সফার করতে সমস্যা হয়েছে!"); }
  };

  // নতুন প্রোডাকশন
  const handleProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, size, color, qty, costPrice } = prodData;
    const product = products.find(p => p.id === productId);
    
    if (!product || !size || !color || qty <= 0) { setMessage("Error: সব তথ্য সঠিকভাবে দিন!"); return; }

    try {
      let updatedVariations = [...(product.variations || [])];
      const existingIndex = updatedVariations.findIndex(v => v.size === size && v.color === color);

      if (existingIndex >= 0) {
        updatedVariations[existingIndex].stock += Number(qty);
        if (costPrice > 0) updatedVariations[existingIndex].costPrice = Number(costPrice);
      } else {
        updatedVariations.push({ size, color, stock: Number(qty), costPrice: Number(costPrice) || 0 });
      }

      await updateDoc(doc(db, "products", productId), { variations: updatedVariations });

      await addDoc(collection(db, "stock_logs"), {
        shop: "Warehouse", productName: product.name, size, color,
        quantity: qty, type: "Production Inward", transferredBy: currentUserName,
        date: new Date().toISOString(), createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${qty} পিস ${product.name} (${size}/${color}) ওয়্যারহাউসে যোগ হয়েছে!`);
      setShowProdModal(false);
      setProdData({ productId: "", size: "", color: "", qty: 0, costPrice: 0 });
    } catch (error) { setMessage("প্রোডাকশন যোগ করতে সমস্যা হয়েছে!"); }
  };

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
    <div className="max-w-6xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-brand-navy">Warehouse Stock</h2>
        <button onClick={() => { setProdData({ productId: "", size: "", color: "", qty: 0, costPrice: 0 }); setShowProdModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
          <Factory size={16}/> Add Production
        </button>
      </div>

      {message && <div className={`p-3 mb-4 rounded-lg font-medium text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message}</div>}

      {/* ট্রান্সফার হিস্ট্রি (উপরে) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><History size={16}/> Recent Activities</h3>
        </div>
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2 text-right">By</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</td></tr>}
              {transfers.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">
                    <div className="font-medium text-gray-800">{new Date(log.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px]">{new Date(log.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-bold text-brand-navy">{log.productName}</span><br/>
                    <span className="text-[10px] text-gray-500">{log.size}/{log.color}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-green-600">
                    {log.type === "Warehouse Transfer" ? "-" : "+"}{log.quantity}
                  </td>
                  <td className="px-3 py-2 font-medium text-brand-navy">{log.shop}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-gray-600 flex items-center justify-end gap-1">
                    <User size={10}/> {log.transferredBy || "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* সার্চ */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Search product..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* প্রোডাক্ট লিস্ট */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                  <tr><th className="px-2 py-1">Size/Color</th><th className="px-2 py-1 text-right">Stock</th><th className="px-2 py-1 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {product.variations.map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{v.size} / {v.color}</td>
                      <td className="px-2 py-2 text-right font-bold text-brand-navy">{v.stock}</td>
                      <td className="px-2 py-2 text-center flex justify-center gap-1">
                        <button onClick={() => { setEditData({ productId: product.id, varIndex: i, newStock: v.stock, newPrice: v.costPrice }); setShowEditModal(true); }} className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200 transition"><Edit size={14} /></button>
                        <button onClick={() => addToCart(product, i)} className="bg-blue-50 text-blue-600 p-1.5 rounded hover:bg-blue-100 transition"><PlusCircle size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* কার্ট */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 shadow-2xl p-4 z-40 md:static md:shadow-none md:border-none md:p-0 md:mb-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-brand-navy mb-2 flex items-center gap-2"><ShoppingCart size={16}/> Transfer Cart ({cart.length})</h4>
              <div className="flex overflow-x-auto gap-2 pb-2">
                {cart.map((item, i) => (
                  <div key={i} className="bg-gray-50 border rounded-lg p-2 text-xs flex items-center gap-2 min-w-max">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-[10px] text-gray-500">{item.size}/{item.color}</p>
                    </div>
                    <input type="number" min="1" max={item.maxStock} className="w-14 border p-1 rounded text-center" value={item.qty} onChange={(e) => updateCartQty(i, Number(e.target.value))} />
                    <button onClick={() => removeFromCart(i)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select className="border p-2 rounded-lg text-sm font-medium w-full md:w-40" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <button onClick={handleBulkTransfer} className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap hover:bg-brand-navy/90">Transfer All</button>
            </div>
          </div>
        </div>
      )}

      {/* প্রোডাকশন মডাল */}
      {showProdModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-navy mb-4">Add New Production</h3>
            <form onSubmit={handleProduction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Select Product</label>
                <select required className="w-full border p-2 rounded-lg text-sm" onChange={(e) => setProdData({...prodData, productId: e.target.value})} value={prodData.productId}>
                  <option value="" disabled>-- Select Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Size</label>
                  <input required placeholder="e.g. 5 MM" className="w-full border p-2 rounded-lg text-sm" value={prodData.size} onChange={(e) => setProdData({...prodData, size: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Color</label>
                  <input required placeholder="e.g. Black" className="w-full border p-2 rounded-lg text-sm" value={prodData.color} onChange={(e) => setProdData({...prodData, color: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Production Quantity (pcs)</label>
                <input required type="number" min="1" className="w-full border p-2 rounded-lg text-sm font-bold" value={prodData.qty || ""} onChange={(e) => setProdData({...prodData, qty: Number(e.target.value)})} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Cost Price (৳)</label>
                <input type="number" min="0" className="w-full border p-2 rounded-lg text-sm" value={prodData.costPrice || ""} onChange={(e) => setProdData({...prodData, costPrice: Number(e.target.value)})} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowProdModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Add to Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* এডিট মডাল */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-navy mb-4">Edit Warehouse Stock</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">New Stock</label>
                <input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newStock} onChange={(e) => setEditData({...editData, newStock: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Cost Price (৳)</label>
                <input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newPrice} onChange={(e) => setEditData({...editData, newPrice: Number(e.target.value)})} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
