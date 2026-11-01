// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { Store, ArrowRight, Package, Filter, Search } from "lucide-react";

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  
  // ফর্ম স্টেট
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);
  const [quantity, setQuantity] = useState<number>(0);
  const [destination, setDestination] = useState(""); 
  const [message, setMessage] = useState("");

  // ফিল্টার ও সার্চ
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !destination) {
        setDestination(data[0].name); 
      }
    });

    return () => { unsubProducts(); unsubShops(); };
  }, [destination]);

  // ক্যাটাগরি লিস্ট
  const allCategories = ["All", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // ফিল্টার করা প্রোডাক্ট লিস্ট
  const filteredProducts = products.filter(p => {
    const matchCat = filterCategory === "All" || p.category === filterCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const product = products.find(p => p.id === e.target.value);
    setSelectedProduct(product || null);
    setSelectedVarIndex(product && product.variations.length > 0 ? 0 : -1);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedProduct || selectedVarIndex === -1) {
      setMessage("Error: প্রোডাক্ট এবং ভ্যারিয়েশন সিলেক্ট করুন।"); return;
    }

    const variation = selectedProduct.variations[selectedVarIndex];

    if (quantity <= 0) {
      setMessage("Error: পরিমাণ ০ এর বেশি হতে হবে।"); return;
    }
    if (quantity > variation.stock) {
      setMessage(`Error: ওয়্যারহাউসে মাত্র ${variation.stock} পিস আছে!`); return;
    }
    if (!destination) {
      setMessage("Error: দোকান সিলেক্ট করুন।"); return;
    }

    try {
      // ১. ওয়্যারহাউস স্টক কমানো
      const updatedVariations = [...selectedProduct.variations];
      updatedVariations[selectedVarIndex].stock -= quantity;
      await updateDoc(doc(db, "products", selectedProduct.id), { variations: updatedVariations });

      // ২. দোকানের ইনভেন্টরি বাড়ানো/তৈরি করা
      const shopInvId = `${destination}_${selectedProduct.id}_${variation.size}_${variation.color}`.replace(/\s+/g, '_');
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDoc(shopInvRef);

      if (shopInvSnap.exists()) {
        await updateDoc(shopInvRef, { stock: increment(quantity) });
      } else {
        await setDoc(shopInvRef, {
          shop: destination,
          productName: selectedProduct.name,
          category: selectedProduct.category,
          size: variation.size,
          color: variation.color,
          stock: quantity,
          costPrice: variation.costPrice,
          sellingPrice: variation.sellingPrice || 0
        });
      }

      // ৩. ট্রান্সফার লগ সেভ
      await addDoc(collection(db, "stock_logs"), {
        shop: destination,
        productName: selectedProduct.name,
        size: variation.size,
        color: variation.color,
        quantity: quantity,
        type: "Warehouse Transfer",
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${quantity} পিস ${selectedProduct.name} ${destination}-এ পাঠানো হয়েছে!`);
      setQuantity(0);
      setSelectedProduct(null);
      setSelectedVarIndex(-1);
      setShowForm(false);

    } catch (error) {
      console.error(error);
      setMessage("Error: ট্রান্সফার করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy">Warehouse</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-navy/90 transition flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <ArrowRight size={18} /> {showForm ? "Close Transfer" : "Transfer to Shop"}
        </button>
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded-lg font-medium text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* ট্রান্সফার ফর্ম */}
      {showForm && (
        <form onSubmit={handleTransfer} className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
          <h3 className="text-lg font-bold mb-3 text-brand-navy flex items-center gap-2"><Store size={20} /> Transfer Stock</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Select Product</label>
              <select required className="w-full border p-2 rounded-lg text-sm" onChange={handleProductChange} value={selectedProduct?.id || ""}>
                <option value="" disabled>-- Select Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Size / Color</label>
              <select required className="w-full border p-2 rounded-lg text-sm" value={selectedVarIndex} onChange={(e) => setSelectedVarIndex(Number(e.target.value))} disabled={!selectedProduct}>
                <option value="-1" disabled>-- Select --</option>
                {selectedProduct?.variations.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.size} / {v.color} (Stock: {v.stock})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Quantity (pcs)</label>
              <input required type="number" min="1" placeholder="0" className="w-full border p-2 rounded-lg text-sm" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Destination Shop</label>
              <select required className="w-full border p-2 rounded-lg text-sm" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.name}>{shop.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm mt-2 w-full md:w-auto">
            Confirm Transfer
          </button>
        </form>
      )}

      {/* সার্চ ও ক্যাটাগরি ফিল্টার */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 flex-1">
          <Search size={18} className="text-gray-400 ml-2" />
          <input type="text" placeholder="Search product..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 md:w-64">
          <Filter size={18} className="text-gray-400 ml-2" />
          <select className="w-full bg-transparent outline-none text-sm font-medium text-brand-navy cursor-pointer" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* প্রোডাক্ট লিস্ট */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredProducts.length === 0 && <p className="text-gray-500 text-center col-span-2 py-4">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>}
        
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 mb-2 border-b pb-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={18} /></div>
              <div>
                <h3 className="text-sm font-bold text-brand-navy">{product.name}</h3>
                <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{product.category}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-1 py-1">Size</th><th className="px-1 py-1">Color</th>
                    <th className="px-1 py-1 text-right">Stock</th><th className="px-1 py-1 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variations.map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-1 py-1.5 font-medium">{v.size}</td>
                      <td className="px-1 py-1.5">{v.color}</td>
                      <td className="px-1 py-1.5 text-right font-semibold text-brand-navy">{v.stock}</td>
                      <td className="px-1 py-1.5 text-right text-gray-500">৳{v.costPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
