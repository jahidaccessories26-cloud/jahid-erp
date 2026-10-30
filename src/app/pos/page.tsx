"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, addDoc, increment } from "firebase/firestore";
import { Store, ShoppingCart, DollarSign } from "lucide-react";

export default function POSPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  
  // ফর্ম স্টেট
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [message, setMessage] = useState("");

  // ফায়ারবেস থেকে দোকানের লিস্ট আনা
  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0].name);
      }
    });
    return () => unsubShops();
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

  // প্রোডাক্ট সিলেক্ট করলে দাম সেট হয়ে যাবে
  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    const item = inventory.find(i => i.id === itemId);
    setSelectedItem(item || null);
    if (item) {
      setSellPrice(item.sellingPrice); // ডিফল্ট বিক্রির দাম
      setQuantity(1);
    }
  };

  // বিক্রি সম্পন্ন করা
  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedItem) {
      setMessage("Error: প্রোডাক্ট সিলেক্ট করুন।");
      return;
    }
    if (quantity <= 0) {
      setMessage("Error: পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }
    if (quantity > selectedItem.stock) {
      setMessage(`Error: এই প্রোডাক্টের স্টক মাত্র ${selectedItem.stock} পিস!`);
      return;
    }
    if (sellPrice <= 0) {
      setMessage("Error: বিক্রির দাম ০ এর বেশি হতে হবে।");
      return;
    }

    try {
      // ১. দোকানের ইনভেন্টরি থেকে স্টক কমানো
      const itemRef = doc(db, "shop_inventories", selectedItem.id);
      await updateDoc(itemRef, { stock: increment(-quantity) });

      // ২. বিক্রয় রেকর্ড সেভ করা
      const totalAmount = quantity * sellPrice;
      const totalCost = quantity * selectedItem.costPrice;
      const profit = totalAmount - totalCost;

      await addDoc(collection(db, "sales"), {
        shop: selectedShop,
        productName: selectedItem.productName,
        category: selectedItem.category,
        size: selectedItem.size,
        color: selectedItem.color,
        quantity: quantity,
        sellPrice: sellPrice,
        totalAmount: totalAmount,
        costPrice: selectedItem.costPrice,
        totalCost: totalCost,
        profit: profit,
        paymentMethod: paymentMethod,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${quantity} পিস বিক্রি হয়েছে! মোট: ৳${totalAmount}`);
      setSelectedItem(null);
      setQuantity(1);
      setSellPrice(0);
      
    } catch (error) {
      console.error(error);
      setMessage("Error: বিক্রি করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
          <ShoppingCart size={28} /> POS (Sales)
        </h2>
        
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
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy">
        <h3 className="text-xl font-bold mb-4 text-brand-navy flex items-center gap-2">
          <DollarSign size={22} /> New Sale
        </h3>
        
        <form onSubmit={handleSale} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Select Product from Stock</label>
            <select 
              required 
              className="w-full border p-2 rounded-lg" 
              onChange={handleItemChange} 
              value={selectedItem?.id || ""}
            >
              <option value="" disabled>-- Select Product --</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.productName} ({item.size} / {item.color}) - Stock: {item.stock} pcs
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input 
              required 
              type="number" 
              min="1" 
              className="w-full border p-2 rounded-lg" 
              value={quantity || ""} 
              onChange={(e) => setQuantity(Number(e.target.value))} 
              disabled={!selectedItem}
            />
            {selectedItem && (
              <p className="text-xs text-gray-500 mt-1">Available: {selectedItem.stock} pcs</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Selling Price (৳)</label>
            <input 
              required 
              type="number" 
              min="1" 
              className="w-full border p-2 rounded-lg font-bold text-green-700" 
              value={sellPrice || ""} 
              onChange={(e) => setSellPrice(Number(e.target.value))} 
              disabled={!selectedItem}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select 
              className="w-full border p-2 rounded-lg" 
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Bkash">Bkash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
            </select>
          </div>

          <div className="md:col-span-2 mt-4">
            {selectedItem && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Total Amount:</span>
                  <span className="font-bold">৳{quantity * sellPrice}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Estimated Profit:</span>
                  <span className="font-bold">৳{(sellPrice - selectedItem.costPrice) * quantity}</span>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={!selectedItem}
              className="bg-green-600 text-white w-full py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              Complete Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
