"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, addDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { Store, Package, PlusCircle, History, X } from "lucide-react";

export default function ShopInventoryPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // ওপেনিং স্টক ফর্মের স্টেট
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);
  const [quantity, setQuantity] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [message, setMessage] = useState("");

  // ফায়ারবেস থেকে ডেটা আনা
  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });

    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });

    return () => { unsubShops(); unsubProducts(); };
  }, [selectedShop]);

  // নির্দিষ্ট দোকানের ইনভেন্টরি আনা
  useEffect(() => {
    if (!selectedShop) return;
    const qInv = query(collection(db, "shop_inventories"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const allData: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filteredData = allData.filter((item) => item.shop === selectedShop);
      setInventory(filteredData);
    });
    return () => unsubInv();
  }, [selectedShop]);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
    setSelectedVarIndex(product && product.variations.length > 0 ? 0 : -1);
  };

  // ওপেনিং স্টক সেভ করা
  const handleAddOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedProduct || selectedVarIndex === -1 || quantity <= 0) {
      setMessage("Error: সব তথ্য সঠিকভাবে দিন।");
      return;
    }

    const variation = selectedProduct.variations[selectedVarIndex];
    
    try {
      // ১. দোকানের ইনভেন্টরিতে স্টক যোগ করা
      const shopInvId = `${selectedShop}_${selectedProduct.id}_${variation.size}_${variation.color}`;
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDoc(shopInvRef);

      if (shopInvSnap.exists()) {
        await updateDoc(shopInvRef, { stock: increment(quantity) });
      } else {
        await setDoc(shopInvRef, {
          shop: selectedShop,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          category: selectedProduct.category,
          size: variation.size,
          color: variation.color,
          stock: quantity,
          costPrice: variation.costPrice,
          sellingPrice: variation.sellingPrice
        });
      }

      // ২. স্টক লগ (Stock Log) সেভ করা
      await addDoc(collection(db, "stock_logs"), {
        shop: selectedShop,
        productName: selectedProduct.name,
        size: variation.size,
        color: variation.color,
        quantity: quantity,
        type: "Opening Stock", // টাইপ ওপেনিং স্টক
        date: date,
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${quantity} পিস ওপেনিং স্টক যোগ হয়েছে!`);
      setSelectedProduct(null);
      setQuantity(0);
      setShowForm(false);

    } catch (error) {
      console.error(error);
      setMessage("Error: স্টক যোগ করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy">Shop Inventory</h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* দোকান সিলেক্ট */}
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
            <Store size={20} className="text-brand-navy" />
            <select 
              className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer"
              value={selectedShop} 
              onChange={(e) => setSelectedShop(e.target.value)}
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.name}>{shop.name}</option>
              ))}
            </select>
          </div>

          {/* ওপেনিং স্টক বাটন */}
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
          >
            <PlusCircle size={18} /> Add Opening Stock
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* ওপেনিং স্টক ফর্ম */}
      {showForm && (
        <form onSubmit={handleAddOpeningStock} className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-brand-navy">Add Initial Stock for {selectedShop}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Product</label>
              <select required className="w-full border p-2 rounded-lg" onChange={handleProductChange} value={selectedProduct?.id || ""}>
                <option value="" disabled>-- Select Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Size / Color</label>
              <select required className="w-full border p-2 rounded-lg" value={selectedVarIndex} onChange={(e) => setSelectedVarIndex(Number(e.target.value))} disabled={!selectedProduct}>
                <option value="-1" disabled>-- Select Size & Color --</option>
                {selectedProduct?.variations.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.size} / {v.color}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input required type="number" min="1" className="w-full border p-2 rounded-lg" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input required type="date" className="w-full border p-2 rounded-lg" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="md:col-span-2 mt-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 w-full md:w-auto">
                Save Opening Stock
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ইনভেন্টরি টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <Package size={20} /> Stock at {selectedShop || "Select a Shop"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-3 font-semibold">Product Name</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Size</th>
                <th className="px-6 py-3 font-semibold">Color</th>
                <th className="px-6 py-3 font-semibold text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    এই দোকানে এখনো কোনো মাল নেই।
                  </td>
                </tr>
              )}
              {inventory.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-brand-navy">{item.productName}</td>
                  <td className="px-6 py-4 text-gray-500">{item.category}</td>
                  <td className="px-6 py-4 font-semibold">{item.size}</td>
                  <td className="px-6 py-4">{item.color}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600 text-lg">
                    {item.stock} <span className="text-xs text-gray-400 font-normal">pcs</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
