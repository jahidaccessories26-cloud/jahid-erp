"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, getDoc, increment } from "firebase/firestore";
import { ShoppingBag, PlusCircle, Store, CheckCircle, X, History, FileText } from "lucide-react";

export default function CorporateOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  
  // নতুন অর্ডার ফর্ম স্টেট
  const [showForm, setShowForm] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  
  // ডেলিভারি মডাল স্টেট
  const [deliveryOrder, setDeliveryOrder] = useState<any>(null);
  const [deliverQty, setDeliverQty] = useState<number>(0);
  const [challanNo, setChallanNo] = useState(""); // চালান নং
  
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

    const qOrders = query(collection(db, "corporate_orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });

    const qLogs = query(collection(db, "stock_logs"), orderBy("createdAt", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const allLogs: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filteredLogs = allLogs.filter(log => log.type === "Corporate Delivery");
      setDeliveryLogs(filteredLogs);
    });

    return () => { unsubShops(); unsubProducts(); unsubOrders(); unsubLogs(); };
  }, [selectedShop]);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
    setSelectedVarIndex(product && product.variations.length > 0 ? 0 : -1);
  };

  // নতুন অর্ডার তৈরি
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!buyerName || !selectedProduct || selectedVarIndex === -1 || totalQuantity <= 0) {
      setMessage("Error: সব তথ্য সঠিকভাবে দিন।");
      return;
    }

    const variation = selectedProduct.variations[selectedVarIndex];

    try {
      await addDoc(collection(db, "corporate_orders"), {
        buyerName,
        shop: selectedShop,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        size: variation.size,
        color: variation.color,
        totalOrdered: totalQuantity,
        delivered: 0,
        pending: totalQuantity,
        date: date,
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${buyerName} এর জন্য নতুন অর্ডার তৈরি হয়েছে!`);
      setBuyerName("");
      setSelectedProduct(null);
      setTotalQuantity(0);
      setShowForm(false);
    } catch (error) {
      console.error(error);
      setMessage("Error: অর্ডার তৈরি করতে সমস্যা হয়েছে!");
    }
  };

  // ডেলিভারি মডাল ওপেন করার ফাংশন (অটোমেটিক চালান নং তৈরি)
  const openDeliveryModal = (order: any) => {
    setDeliveryOrder(order);
    setDeliverQty(0);
    
    // অটোমেটিক চালান নং জেনারেট করা (যেমন: CH-20261101-1234)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const randomNum = Math.floor(1000 + Math.random() * 9000); // ৪ ডিজিটের র‍্যান্ডম
    setChallanNo(`CH-${dateString}-${randomNum}`);
  };

  // ডেলিভারি আপডেট করা
  const handleDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrder || deliverQty <= 0) return;
    setMessage("");

    if (deliverQty > deliveryOrder.pending) {
      setMessage("Error: বাকি থাকা অর্ডারের চেয়ে বেশি ডেলিভারি দেওয়া যাবে না!");
      return;
    }

    try {
      const shopInvId = `${deliveryOrder.shop}_${deliveryOrder.productId}_${deliveryOrder.size}_${deliveryOrder.color}`;
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDoc(shopInvRef);

      if (!shopInvSnap.exists() || shopInvSnap.data().stock < deliverQty) {
        setMessage(`Error: ${deliveryOrder.shop}-এ পর্যাপ্ত স্টক নেই! (বর্তমান স্টক: ${shopInvSnap.data()?.stock || 0} pcs)`);
        return;
      }

      // স্টক আপডেট
      await updateDoc(shopInvRef, { stock: increment(-deliverQty) });

      // অর্ডারের হিসাব আপডেট
      const orderRef = doc(db, "corporate_orders", deliveryOrder.id);
      await updateDoc(orderRef, {
        delivered: increment(deliverQty),
        pending: increment(-deliverQty)
      });

      // স্টক লগে চালান ও সময়সহ সেভ করা
      await addDoc(collection(db, "stock_logs"), {
        shop: deliveryOrder.shop,
        productName: deliveryOrder.productName,
        size: deliveryOrder.size,
        color: deliveryOrder.color,
        quantity: deliverQty,
        type: "Corporate Delivery", 
        buyerName: deliveryOrder.buyerName,
        challanNo: challanNo, // অটোমেটিক চালান নং
        date: new Date().toISOString(), // পূর্ণ তারিখ ও সময় সেভ হবে
        createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${deliverQty} পিস ডেলিভারি আপডেট হয়েছে! (Challan: ${challanNo})`);
      setDeliveryOrder(null);
      setDeliverQty(0);
      setChallanNo("");

    } catch (error) {
      console.error(error);
      setMessage("Error: ডেলিভারি আপডেট করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
          <ShoppingBag size={28} /> Corporate Orders
        </h2>
        
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
        >
          <PlusCircle size={18} /> {showForm ? "Close Form" : "New Order"}
        </button>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* নতুন অর্ডার ফর্ম */}
      {showForm && (
        <form onSubmit={handleCreateOrder} className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8">
          <h3 className="text-lg font-bold mb-4 text-brand-navy">Create New Corporate Order</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Buyer / Company Name</label>
              <input required placeholder="e.g. H&M, Zara" className="w-full border p-2 rounded-lg" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fulfilling Shop</label>
              <select required className="w-full border p-2 rounded-lg" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.name}>{shop.name}</option>
                ))}
              </select>
            </div>
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
                <option value="-1" disabled>-- Select --</option>
                {selectedProduct?.variations.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.size} / {v.color}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total Order Quantity (pcs)</label>
              <input required type="number" min="1" className="w-full border p-2 rounded-lg" value={totalQuantity || ""} onChange={(e) => setTotalQuantity(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Order Date</label>
              <input required type="date" className="w-full border p-2 rounded-lg" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">Save Order</button>
        </form>
      )}

      {/* অর্ডার লিস্ট */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <Store size={20} /> All Corporate Orders
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Buyer & Product</th>
                <th className="px-4 py-3 font-semibold">Shop</th>
                <th className="px-4 py-3 font-semibold text-center">Total</th>
                <th className="px-4 py-3 font-semibold text-center">Delivered</th>
                <th className="px-4 py-3 font-semibold text-center">Pending</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">কোনো অর্ডার পাওয়া যায়নি।</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-brand-navy">{order.buyerName}</div>
                    <div className="text-xs text-gray-600">{order.productName} ({order.size}/{order.color})</div>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{order.shop}</td>
                  <td className="px-4 py-4 text-center font-semibold">{order.totalOrdered}</td>
                  <td className="px-4 py-4 text-center font-bold text-blue-600">{order.delivered}</td>
                  <td className="px-4 py-4 text-center font-bold text-red-600">{order.pending}</td>
                  <td className="px-4 py-4 text-right">
                    {order.pending > 0 ? (
                      <button 
                        onClick={() => openDeliveryModal(order)}
                        className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-navy/90 flex items-center gap-1 ml-auto"
                      >
                        <CheckCircle size={14} /> Deliver
                      </button>
                    ) : (
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ডেলিভারি হিস্ট্রি টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <History size={20} /> Delivery History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Challan No</th>
                <th className="px-4 py-3 font-semibold">Buyer</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Shop</th>
                <th className="px-4 py-3 font-semibold text-center">Delivered Qty</th>
              </tr>
            </thead>
            <tbody>
              {deliveryLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">কোনো ডেলিভারি হিস্ট্রি পাওয়া যায়নি।</td>
                </tr>
              )}
              {deliveryLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-500">
                    {new Date(log.date).toLocaleDateString()} <br/>
                    <span className="text-xs">{new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </td>
                  <td className="px-4 py-4 font-medium text-brand-navy flex items-center gap-1">
                    <FileText size={14}/> {log.challanNo || "N/A"}
                  </td>
                  <td className="px-4 py-4 font-bold text-brand-navy">{log.buyerName}</td>
                  <td className="px-4 py-4">{log.productName} ({log.size}/{log.color})</td>
                  <td className="px-4 py-4 text-gray-600">{log.shop}</td>
                  <td className="px-4 py-4 text-center font-bold text-green-600">{log.quantity} pcs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ডেলিভারি মডাল */}
      {deliveryOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-brand-navy text-white">
              <h3 className="font-bold text-lg">Update Delivery</h3>
              <button onClick={() => setDeliveryOrder(null)} className="hover:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleDelivery} className="p-6">
              
              <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 font-bold flex justify-between items-center">
                <span>Challan No:</span>
                <span>{challanNo}</span>
              </div>

              <div className="mb-4 bg-gray-50 p-3 rounded-lg text-sm border">
                <p><strong>Buyer:</strong> {deliveryOrder.buyerName}</p>
                <p><strong>Product:</strong> {deliveryOrder.productName} ({deliveryOrder.size}/{deliveryOrder.color})</p>
                <p><strong>Pending:</strong> {deliveryOrder.pending} pcs</p>
                <p><strong>From Shop:</strong> {deliveryOrder.shop}</p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Deliver Quantity (pcs)</label>
                <input required type="number" min="1" max={deliveryOrder.pending} className="w-full border p-2 rounded-lg text-lg font-bold" value={deliverQty || ""} onChange={(e) => setDeliverQty(Number(e.target.value))} />
              </div>
              
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDeliveryOrder(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Confirm Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
