"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, addDoc, doc, updateDoc, increment, deleteDoc, getDoc } from "firebase/firestore";
import { ShoppingBag, PlusCircle, Store, CheckCircle, X, Building2, Edit, Trash2 } from "lucide-react";

type ViewMode = "garments" | "buyers" | "orders";

export default function CorporateOrdersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("garments");
  
  // ডেটা স্টেট
  const [garments, setGarments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // সিলেক্টেড স্টেট
  const [selectedGarment, setSelectedGarment] = useState<string>("");
  const [selectedBuyer, setSelectedBuyer] = useState<string>("");

  // ফর্ম স্টেট
  const [showGarmentForm, setShowGarmentForm] = useState(false);
  const [newGarmentName, setNewGarmentName] = useState("");
  
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  
  const [buyerName, setBuyerName] = useState("");
  const [selectedShop, setSelectedShop] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  
  // ডেলিভারি মডাল স্টেট
  const [deliveryOrder, setDeliveryOrder] = useState<any>(null);
  const [deliverQty, setDeliverQty] = useState<number>(0);
  const [challanNo, setChallanNo] = useState("");
  
  const [message, setMessage] = useState("");

  // ফায়ারবেস থেকে ডেটা আনা
  useEffect(() => {
    const unsubGarments = onSnapshot(query(collection(db, "garments")), (snapshot) => {
      setGarments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubOrders = onSnapshot(query(collection(db, "corporate_orders")), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });
    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubGarments(); unsubOrders(); unsubShops(); unsubProducts(); };
  }, [selectedShop]);

  // নতুন গার্মেন্টস তৈরি
  const handleCreateGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarmentName) return;
    setMessage("");
    try {
      await addDoc(collection(db, "garments"), {
        name: newGarmentName,
        createdAt: new Date().toISOString()
      });
      setNewGarmentName("");
      setShowGarmentForm(false);
      setMessage("Success: নতুন গার্মেন্টস যোগ হয়েছে!");
    } catch (error) { setMessage("Error: গার্মেন্টস যোগ করতে সমস্যা হয়েছে!"); }
  };

  // গার্মেন্টস ডিলিট
  const handleDeleteGarment = async (id: string, name: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত "${name}" গার্মেন্টসটি ডিলিট করতে চান?`)) {
      try {
        await deleteDoc(doc(db, "garments", id));
      } catch (error) { console.error(error); }
    }
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const product = products.find(p => p.id === e.target.value);
    setSelectedProduct(product || null);
    setSelectedVarIndex(product && product.variations.length > 0 ? 0 : -1);
  };

  // অর্ডার ফর্ম ওপেন করা
  const openNewOrderForm = () => {
    setEditingOrder(null);
    setBuyerName(selectedBuyer || ""); // যদি বায়ার পেজ থেকে আসে, তবে নাম অটো বসবে
    setSelectedProduct(null);
    setTotalQuantity(0);
    setMessage(""); // পুরনো মেসেজ ক্লিয়ার
    setShowOrderForm(true);
  };

  // অর্ডার সেভ (নতুন বা এডিট)
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName || !selectedProduct || selectedVarIndex === -1 || totalQuantity <= 0) {
      setMessage("Error: সব তথ্য সঠিকভাবে দিন।"); return;
    }

    const variation = selectedProduct.variations[selectedVarIndex];

    try {
      if (editingOrder) {
        await updateDoc(doc(db, "corporate_orders", editingOrder.id), {
          buyerName, shop: selectedShop, productId: selectedProduct.id,
          productName: selectedProduct.name, size: variation.size, color: variation.color,
          totalOrdered: totalQuantity, date: date
        });
        await updateDoc(doc(db, "corporate_orders", editingOrder.id), {
          pending: totalQuantity - editingOrder.delivered
        });
        setMessage("Success: অর্ডার আপডেট হয়েছে!");
      } else {
        await addDoc(collection(db, "corporate_orders"), {
          garmentName: selectedGarment, buyerName, shop: selectedShop, 
          productId: selectedProduct.id, productName: selectedProduct.name, 
          size: variation.size, color: variation.color,
          totalOrdered: totalQuantity, delivered: 0, pending: totalQuantity, 
          date: date, createdAt: new Date().toISOString()
        });
        setMessage("Success: নতুন অর্ডার তৈরি হয়েছে!");
      }
      setShowOrderForm(false);
      setEditingOrder(null);
      setBuyerName(""); setSelectedProduct(null); setTotalQuantity(0);
      
      // অর্ডার সেভ হলে অটোমেটিক "orders" ভিউতে নিয়ে যাবে (যাতে নতুন অর্ডারটা দেখা যায়)
      setSelectedBuyer(buyerName); 
      setViewMode("orders");
      
    } catch (error) { setMessage("Error: অর্ডার সেভ করতে সমস্যা হয়েছে!"); }
  };

  // অর্ডার এডিট করার জন্য ফর্ম খোলা
  const handleEditOrder = (order: any) => {
    setMessage("");
    setEditingOrder(order);
    setBuyerName(order.buyerName);
    setSelectedShop(order.shop);
    const prod = products.find(p => p.id === order.productId);
    setSelectedProduct(prod);
    const varIndex = prod?.variations.findIndex((v:any) => v.size === order.size && v.color === order.color);
    setSelectedVarIndex(varIndex >= 0 ? varIndex : -1);
    setTotalQuantity(order.totalOrdered);
    setDate(order.date);
    setShowOrderForm(true);
  };

  // ডেলিভারি মডাল
  const openDeliveryModal = (order: any) => {
    setMessage("");
    setDeliveryOrder(order); setDeliverQty(0);
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setChallanNo(`CH-${dateString}-${randomNum}`);
  };

  const handleDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrder || deliverQty <= 0) return;
    if (deliverQty > deliveryOrder.pending) { setMessage("Error: বাকি থাকা অর্ডারের চেয়ে বেশি ডেলিভারি দেওয়া যাবে না!"); return; }

    try {
      const shopInvId = `${deliveryOrder.shop}_${deliveryOrder.productId}_${deliveryOrder.size}_${deliveryOrder.color}`;
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDoc(shopInvRef);

      if (!shopInvSnap.exists() || shopInvSnap.data().stock < deliverQty) {
        setMessage(`Error: ${deliveryOrder.shop}-এ পর্যাপ্ত স্টক নেই!`); return;
      }

      await updateDoc(shopInvRef, { stock: increment(-deliverQty) });
      await updateDoc(doc(db, "corporate_orders", deliveryOrder.id), { delivered: increment(deliverQty), pending: increment(-deliverQty) });

      await addDoc(collection(db, "stock_logs"), {
        shop: deliveryOrder.shop, productName: deliveryOrder.productName, size: deliveryOrder.size, color: deliveryOrder.color,
        quantity: deliverQty, type: "Corporate Delivery", buyerName: deliveryOrder.buyerName, garmentName: deliveryOrder.garmentName,
        challanNo: challanNo, date: new Date().toISOString(), createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${deliverQty} পিস ডেলিভারি আপডেট হয়েছে! (Challan: ${challanNo})`);
      setDeliveryOrder(null); setDeliverQty(0);
    } catch (error) { setMessage("Error: ডেলিভারি আপডেট করতে সমস্যা হয়েছে!"); }
  };

  // ফিল্টার করা ডেটা
  const filteredBuyers = Array.from(new Set(orders.filter(o => o.garmentName === selectedGarment).map(o => o.buyerName)));
  const filteredOrders = orders.filter(o => o.garmentName === selectedGarment && o.buyerName === selectedBuyer);

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* হেডার */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => { setViewMode("garments"); setMessage(""); }} className="hover:text-brand-navy">All Garments</button>
            {viewMode !== "garments" && <><span>/</span><button onClick={() => { setViewMode("buyers"); setMessage(""); }} className="hover:text-brand-navy">{selectedGarment}</button></>}
            {viewMode === "orders" && <><span>/</span><span className="text-brand-navy font-semibold">{selectedBuyer}</span></>}
          </div>
          <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
            {viewMode === "garments" && <><Building2 size={28} /> Garments Companies</>}
            {viewMode === "buyers" && <><Store size={28} /> {selectedGarment} - Buyers</>}
            {viewMode === "orders" && <><ShoppingBag size={28} /> {selectedBuyer} - Orders</>}
          </h2>
        </div>

        {/* অ্যাকশন বাটন */}
        {viewMode === "garments" && (
          <button onClick={() => { setShowGarmentForm(!showGarmentForm); setMessage(""); }} className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 flex items-center gap-2">
            <PlusCircle size={18} /> New Garments
          </button>
        )}
        {(viewMode === "buyers" || viewMode === "orders") && !showOrderForm && (
          <button onClick={openNewOrderForm} className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 flex items-center gap-2">
            <PlusCircle size={18} /> New Order
          </button>
        )}
      </div>

      {message && <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message}</div>}

      {/* গার্মেন্টস ফর্ম */}
      {showGarmentForm && viewMode === "garments" && (
        <form onSubmit={handleCreateGarment} className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6 flex gap-4">
          <input required placeholder="Enter Garments Name (e.g. Riddisha)" className="flex-1 border p-2 rounded-lg" value={newGarmentName} onChange={(e) => setNewGarmentName(e.target.value)} />
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">Save</button>
        </form>
      )}

      {/* অর্ডার ফর্ম (সবার উপরে শো করবে) */}
      {showOrderForm && (
        <form onSubmit={handleSaveOrder} className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8 animate-fade-in">
          <h3 className="text-lg font-bold mb-4 text-brand-navy">{editingOrder ? "Edit Order" : "Add New Order"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Buyer Name</label>
              <input required placeholder="e.g. H&M" className="w-full border p-2 rounded-lg" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fulfilling Shop</label>
              <select required className="w-full border p-2 rounded-lg" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Select Product</label>
              <select required className="w-full border p-2 rounded-lg" onChange={handleProductChange} value={selectedProduct?.id || ""}>
                <option value="" disabled>-- Select Product --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Size / Color</label>
              <select required className="w-full border p-2 rounded-lg" value={selectedVarIndex} onChange={(e) => setSelectedVarIndex(Number(e.target.value))} disabled={!selectedProduct}>
                <option value="-1" disabled>-- Select --</option>
                {selectedProduct?.variations.map((v: any, i: number) => <option key={i} value={i}>{v.size} / {v.color}</option>)}
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
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">{editingOrder ? "Update Order" : "Save Order"}</button>
            <button type="button" onClick={() => { setShowOrderForm(false); setEditingOrder(null); }} className="px-6 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      )}

      {/* গার্মেন্টস লিস্ট */}
      {viewMode === "garments" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {garments.length === 0 && <p className="text-gray-500">কোনো গার্মেন্টস নেই। নতুন যোগ করুন।</p>}
          {garments.map(g => {
            const garmentOrders = orders.filter(o => o.garmentName === g.name);
            const totalPending = garmentOrders.reduce((sum, o) => sum + o.pending, 0);
            
            return (
              <div key={g.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-brand-navy cursor-pointer transition relative group" onClick={() => { setSelectedGarment(g.name); setViewMode("buyers"); setMessage(""); }}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-brand-navy">{g.name}</h3>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGarment(g.id, g.name); }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-500">Total Buyers: {new Set(garmentOrders.map(o => o.buyerName)).size}</p>
                <p className="text-sm text-gray-500">Pending Orders: {totalPending} pcs</p>
              </div>
            );
          })}
        </div>
      )}

      {/* বায়ার লিস্ট */}
      {viewMode === "buyers" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredBuyers.length === 0 && !showOrderForm && <p className="text-gray-500 col-span-3">এই গার্মেন্টসের অধীনে কোনো বায়ার নেই। নতুন অর্ডার যোগ করুন।</p>}
          {filteredBuyers.map(buyer => {
            const buyerOrders = orders.filter(o => o.garmentName === selectedGarment && o.buyerName === buyer);
            const totalPending = buyerOrders.reduce((sum, o) => sum + o.pending, 0);
            
            return (
              <div key={buyer} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-brand-navy cursor-pointer transition" onClick={() => { setSelectedBuyer(buyer); setViewMode("orders"); setMessage(""); }}>
                <h3 className="text-xl font-bold text-brand-navy mb-2">{buyer}</h3>
                <p className="text-sm text-gray-500">Total Orders: {buyerOrders.length}</p>
                <p className="text-sm text-gray-500">Pending Items: {totalPending} pcs</p>
              </div>
            );
          })}
        </div>
      )}

      {/* অর্ডারের বিস্তারিত */}
      {viewMode === "orders" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Product Details</th>
                  <th className="px-4 py-3 font-semibold text-center">Total</th>
                  <th className="px-4 py-3 font-semibold text-center">Delivered</th>
                  <th className="px-4 py-3 font-semibold text-center">Pending</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">কোনো অর্ডার নেই।</td></tr>}
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-4 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-brand-navy">{order.productName}</div>
                      <div className="text-xs text-gray-600">{order.size} / {order.color} | Shop: {order.shop}</div>
                    </td>
                    <td className="px-4 py-4 text-center font-semibold">{order.totalOrdered}</td>
                    <td className="px-4 py-4 text-center font-bold text-blue-600">{order.delivered}</td>
                    <td className="px-4 py-4 text-center font-bold text-red-600">{order.pending}</td>
                    <td className="px-4 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleEditOrder(order)} className="text-gray-500 hover:text-brand-navy bg-gray-100 p-1.5 rounded" title="Edit Order">
                        <Edit size={16} />
                      </button>
                      {order.pending > 0 && (
                        <button onClick={() => openDeliveryModal(order)} className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-navy/90 flex items-center gap-1">
                          <CheckCircle size={14} /> Deliver
                        </button>
                      )}
                      {order.pending === 0 && (
                        <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ডেলিভারি মডাল */}
      {deliveryOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-4 bg-brand-navy text-white">
              <h3 className="font-bold text-lg">Update Delivery</h3>
              <button onClick={() => setDeliveryOrder(null)} className="hover:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleDelivery} className="p-6">
              <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 font-bold flex justify-between items-center">
                <span>Challan No:</span><span>{challanNo}</span>
              </div>
              <div className="mb-4 bg-gray-50 p-3 rounded-lg text-sm border">
                <p><strong>Buyer:</strong> {deliveryOrder.buyerName}</p>
                <p><strong>Product:</strong> {deliveryOrder.productName} ({deliveryOrder.size}/{deliveryOrder.color})</p>
                <p><strong>Pending:</strong> {deliveryOrder.pending} pcs</p>
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
