"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";
import { Store, ArrowRight, History } from "lucide-react";

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]); // নতুন স্টেট দোকানের জন্য
  const [showForm, setShowForm] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);
  const [quantity, setQuantity] = useState<number>(0);
  const [destination, setDestination] = useState(""); 
  
  const [message, setMessage] = useState("");

  useEffect(() => {
    // প্রোডাক্ট লিস্ট
    const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });

    // দোকান লিস্ট
    const qShops = query(collection(db, "shops"), orderBy("createdAt", "desc"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !destination) {
        setDestination(data[0].name); // প্রথম দোকান ডিফল্ট সিলেক্ট
      }
    });

    // ট্রান্সফার হিস্ট্রি
    const qTransfers = query(collection(db, "transfers"), orderBy("createdAt", "desc"));
    const unsubTransfers = onSnapshot(qTransfers, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTransfers(data);
    });

    return () => {
      unsubProducts();
      unsubShops();
      unsubTransfers();
    };
  }, [destination]);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
    setSelectedVarIndex(product && product.variations.length > 0 ? 0 : -1);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedProduct || selectedVarIndex === -1) {
      setMessage("Error: অনুগ্রহ করে প্রোডাক্ট এবং ভ্যারিয়েশন সিলেক্ট করুন।");
      return;
    }

    const variation = selectedProduct.variations[selectedVarIndex];

    if (quantity <= 0) {
      setMessage("Error: পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }

    if (quantity > variation.stock) {
      setMessage(`Error: ওয়্যারহাউসে মাত্র ${variation.stock} পিস আছে!`);
      return;
    }

    if (!destination) {
      setMessage("Error: দোকান সিলেক্ট করুন।");
      return;
    }

    try {
      // ১. ওয়্যারহাউস স্টক কমানো
      const updatedVariations = [...selectedProduct.variations];
      updatedVariations[selectedVarIndex].stock -= quantity;
      const productRef = doc(db, "products", selectedProduct.id);
      await updateDoc(productRef, { variations: updatedVariations });

      // ২. ট্রান্সফার হিস্ট্রি সেভ করা
      await addDoc(collection(db, "transfers"), {
        productName: selectedProduct.name,
        category: selectedProduct.category,
        size: variation.size,
        color: variation.color,
        quantity: quantity,
        destination: destination,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${quantity} পিস ${selectedProduct.name} ${destination}-এ পাঠানো হয়েছে!`);
      setQuantity(0);
      setSelectedProduct(null);
      setSelectedVarIndex(-1);
      setShowForm(false);

    } catch (error) {
      console.error(error);
      setMessage("Error: ট্রান্সফার করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-brand-navy">Warehouse Management</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
        >
          <ArrowRight size={18} /> {showForm ? "Close Form" : "Transfer to Shop"}
        </button>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleTransfer} className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8">
          <h3 className="text-xl font-bold mb-4 text-brand-navy flex items-center gap-2">
            <Store size={22} /> Send Stock to Shops
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              <label className="block text-sm font-medium mb-1">Select Variation</label>
              <select required className="w-full border p-2 rounded-lg" value={selectedVarIndex} onChange={(e) => setSelectedVarIndex(Number(e.target.value))} disabled={!selectedProduct}>
                <option value="-1" disabled>-- Select Size & Color --</option>
                {selectedProduct?.variations.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.size} / {v.color} (Stock: {v.stock})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Quantity (pcs)</label>
              <input required type="number" min="1" placeholder="0" className="w-full border p-2 rounded-lg" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Destination</label>
              <select required className="w-full border p-2 rounded-lg" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.name}>{shop.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="bg-green-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-green-700 mt-6 w-full md:w-auto">
            Transfer Stock Now
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <History size={20} /> Recent Stock Transfers
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Product</th>
                <th className="px-6 py-3 font-semibold">Size / Color</th>
                <th className="px-6 py-3 font-semibold text-right">Qty</th>
                <th className="px-6 py-3 font-semibold">Destination</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">কোনো ট্রান্সফার হিস্ট্রি পাওয়া যায়নি।</td>
                </tr>
              )}
              {transfers.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-brand-navy">{t.productName}</td>
                  <td className="px-6 py-4">{t.size} / {t.color}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600">{t.quantity}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{t.destination}</span>
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
