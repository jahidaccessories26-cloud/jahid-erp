// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder, ChevronRight, Search, Edit, Trash2, Users, Share2, MapPin, Phone } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ShopDashboardPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("admin");
  const [selectedShop, setSelectedShop] = useState("");
  const [shops, setShops] = useState<any[]>([]);
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [shopStatements, setShopStatements] = useState<any[]>([]);
  const [shopBuyers, setShopBuyers] = useState<any[]>([]);
  const [shopBuyerOrders, setShopBuyerOrders] = useState<any[]>([]); 

  // ভিউ স্টেট
  const [viewMode, setViewMode] = useState<"dashboard" | "main" | "sub" | "product" | "buyers" | "buyer_statement">("dashboard");
  const [selectedMain, setSelectedMain] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // সার্চ স্টেট
  const [prodSearch, setProdSearch] = useState("");

  // ডেইলি এন্ট্রি স্টেট
  const [showDailyEntry, setShowDailyEntry] = useState(false);
  const [dailyEntryData, setDailyEntryData] = useState({ type: "Sale", title: "", amount: "", productId: "", qty: "", expenseType: "Shop Expense" });
  
  // বায়ার স্টেট (নাম, ফোন, ঠিকানা)
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", phone: "", address: "" });

  // অর্ডার স্টেট
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isEditOrder, setIsEditOrder] = useState(false);
  const [orderData, setOrderData] = useState({ id: "", garments: "", orderNo: "", styleNo: "", items: [] as any[] });
  const [tempOrderItem, setTempOrderItem] = useState({ productId: "", productName: "", qty: "", amount: "" });

  // ডেলিভারি স্টেট
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isEditDelivery, setIsEditDelivery] = useState(false);
  const [deliveryData, setDeliveryData] = useState({ id: "", garments: "", orderNo: "", styleNo: "", items: [] as any[] });
  const [tempDeliveryItem, setTempDeliveryItem] = useState({ productId: "", productName: "", qty: "", amount: "" });
  
  // পেমেন্ট স্টেট
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isEditPayment, setIsEditPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({ id: "", amount: "", details: "", orderNoRef: "" });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") setUserRole("admin");
        else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            if (docSnap.data().assignedShop) setSelectedShop(docSnap.data().assignedShop);
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });
    return () => unsubShops();
  }, [selectedShop]);

  useEffect(() => {
    if (!selectedShop) return;
    
    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.shop === selectedShop));
    });
    const unsubStatements = onSnapshot(query(collection(db, "shop_statements")), (snapshot) => {
      setShopStatements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.shop === selectedShop));
    });
    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      setShopBuyers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.shop === selectedShop));
    });
    const unsubOrders = onSnapshot(query(collection(db, "buyer_orders")), (snapshot) => {
      setShopBuyerOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.shop === selectedShop));
    });

    return () => { unsubInv(); unsubStatements(); unsubBuyers(); unsubOrders(); };
  }, [selectedShop]);

  // হিসাব
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStatements = shopStatements.filter(s => s.date?.startsWith(todayStr));
  const todaySales = todayStatements.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayExpense = todayStatements.filter(s => s.type === 'Expense').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const todayPurchase = todayStatements.filter(s => s.type === 'Purchase').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const profitLoss = todaySales - (todayExpense + todayPurchase);

  let totalStockValue = 0;
  shopInventories.forEach(item => { totalStockValue += (Number(item.stock) || 0) * (Number(item.costPrice) || 0); });

  // সার্চ করা প্রোডাক্ট
  const searchedProducts = shopInventories.filter(p => 
    p.productName.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 5);

  // বায়ার সেভ
  const handleBuyerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (buyerFormData.id) {
        await updateDoc(doc(db, "buyers", buyerFormData.id), { name: buyerFormData.name, phone: buyerFormData.phone, address: buyerFormData.address });
      } else {
        await addDoc(collection(db, "buyers"), { shop: selectedShop, name: buyerFormData.name, phone: buyerFormData.phone, address: buyerFormData.address, createdAt: new Date().toISOString() });
      }
      setShowBuyerModal(false); setBuyerFormData({ id: "", name: "", phone: "", address: "" }); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // অর্ডার সেভ
  const handleOrderSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderData.items.length === 0) return alert("কমপক্ষে একটি আইটেম যোগ করুন!");
    try {
      if (isEditOrder) {
        await updateDoc(doc(db, "buyer_orders", orderData.id), { garments: orderData.garments, orderNo: orderData.orderNo, styleNo: orderData.styleNo, items: orderData.items });
      } else {
        await addDoc(collection(db, "buyer_orders"), {
          shop: selectedShop, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          garments: orderData.garments, orderNo: orderData.orderNo, styleNo: orderData.styleNo, items: orderData.items, 
          type: "Order", date: new Date().toISOString()
        });
      }
      setShowOrderModal(false); setOrderData({ id: "", garments: "", orderNo: "", styleNo: "", items: [] }); alert("অর্ডার সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডেলিভারি সেভ (স্টক চেক সহ)
  const handleDeliverySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deliveryData.items.length === 0) return alert("কমপক্ষে একটি আইটেম যোগ করুন!");
    try {
      // স্টক চেক
      for (const item of deliveryData.items) {
        const prod = shopInventories.find(p => p.id === item.productId);
        if (!prod || prod.stock < Number(item.qty)) {
          return alert(`${item.productName} এর স্টক পর্যাপ্ত নয়! (আছে: ${prod?.stock || 0})`);
        }
      }

      if (isEditDelivery) {
        await updateDoc(doc(db, "buyer_orders", deliveryData.id), { garments: deliveryData.garments, orderNo: deliveryData.orderNo, styleNo: deliveryData.styleNo, items: deliveryData.items });
      } else {
        // স্টক কমানো
        for (const item of deliveryData.items) {
           await updateDoc(doc(db, "shop_inventories", item.productId), { stock: increment(-Number(item.qty)) });
        }
        await addDoc(collection(db, "buyer_orders"), {
          shop: selectedShop, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          garments: deliveryData.garments, orderNo: deliveryData.orderNo, styleNo: deliveryData.styleNo, items: deliveryData.items, 
          type: "Delivery", date: new Date().toISOString()
        });
      }
      setShowDeliveryModal(false); setDeliveryData({ id: "", garments: "", orderNo: "", styleNo: "", items: [] }); alert("ডেলিভারি সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // পেমেন্ট সেভ
  const handlePaymentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditPayment) {
        await updateDoc(doc(db, "buyer_orders", paymentData.id), { amount: Number(paymentData.amount), details: paymentData.details, orderNoRef: paymentData.orderNoRef });
      } else {
        await addDoc(collection(db, "buyer_orders"), {
          shop: selectedShop, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, type: "Payment", amount: Number(paymentData.amount), details: paymentData.details, orderNoRef: paymentData.orderNoRef, date: new Date().toISOString()
        });
      }
      setShowPaymentModal(false); setPaymentData({ id: "", amount: "", details: "", orderNoRef: "" }); alert("পেমেন্ট সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডিলিট ফাংশন
  const deleteBuyer = async (id: string) => { if(window.confirm("বায়ার ডিলিট করবেন?")) await deleteDoc(doc(db, "buyers", id)); };
  const deleteOrder = async (id: string, type: string, items?: any[]) => { 
    if(window.confirm("লেনদেন ডিলিট করবেন?")) {
      if(type === "Delivery" && items) {
         for (const item of items) {
           await updateDoc(doc(db, "shop_inventories", item.productId), { stock: increment(Number(item.qty)) });
         }
      }
      await deleteDoc(doc(db, "buyer_orders", id)); 
    }
  };

  const buyerOrders = shopBuyerOrders.filter(o => o.buyerId === selectedBuyer?.id).sort((a,b) => new Date(b.date) - new Date(a.date));
  const buyerTotalBill = buyerOrders.filter(o => o.type === "Delivery").reduce((sum, o) => sum + o.items.reduce((s:number, i:any) => s + Number(i.amount), 0), 0);
  const buyerTotalPaid = buyerOrders.filter(o => o.type === "Payment").reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const buyerDue = buyerTotalBill - buyerTotalPaid;

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (viewMode === "dashboard") router.push("/");
            else if (viewMode === "main" || viewMode === "buyers") setViewMode("dashboard");
            else if (viewMode === "sub") setViewMode("main");
            else if (viewMode === "product") setViewMode("sub");
            else if (viewMode === "buyer_statement") setViewMode("buyers");
          }} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">
            {viewMode === "dashboard" ? "Shop Dashboard" : viewMode === "main" ? "Stock Categories" : viewMode === "sub" ? selectedMain : viewMode === "product" ? selectedSub : viewMode === "buyers" ? "Buyers" : selectedBuyer?.name}
          </h2>
        </div>
      </div>

      {viewMode === "dashboard" && (
        <>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
            <Store size={18} className="text-brand-navy ml-2" />
            <select className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
              {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl border-t-4 border-green-500"><div className="text-xs text-gray-500">Today's Sales</div><h3 className="text-lg font-bold text-green-600">{todaySales}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-red-500"><div className="text-xs text-gray-500">Expense</div><h3 className="text-lg font-bold text-red-600">{todayExpense}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500"><div className="text-xs text-gray-500">Purchase</div><h3 className="text-lg font-bold text-blue-600">{todayPurchase}</h3></div>
            <div className="bg-white p-3 rounded-xl border-t-4 border-brand-navy"><div className="text-xs text-gray-500">Profit/Loss</div><h3 className="text-lg font-bold text-brand-navy">{profitLoss}</h3></div>
          </div>

          <div className="bg-white p-4 rounded-xl border-t-4 border-green-500 mb-4">
            <div className="text-sm text-gray-500">Total Stock Value</div>
            <h3 className="text-2xl font-bold text-green-600">{totalStockValue.toLocaleString('en-IN')}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setShowDailyEntry(true)} className="bg-brand-navy text-white p-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm">
              <PlusCircle size={16} /> Daily Entry
            </button>
            <button onClick={() => setViewMode("buyers")} className="bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm">
              <Users size={16} /> Buyers / Parties
            </button>
          </div>

          <div onClick={() => setViewMode("main")} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md cursor-pointer flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Folder size={20} className="text-brand-navy" /></div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">Stock / Products</h3>
                <p className="text-[11px] text-gray-500">View products by category</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </>
      )}

      {viewMode === "buyers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">All Buyers</h3>
            <button onClick={() => { setBuyerFormData({ id: "", name: "", phone: "", address: "" }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
              <PlusCircle size={16}/> Add Buyer
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shopBuyers.map(buyer => (
              <div key={buyer.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="cursor-pointer" onClick={() => { setSelectedBuyer(buyer); setViewMode("buyer_statement"); }}>
                  <p className="font-bold text-brand-navy text-sm">{buyer.name}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Phone size={10}/> {buyer.phone}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin size={10}/> {buyer.address}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setBuyerFormData(buyer); setShowBuyerModal(true); }} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => deleteBuyer(buyer.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "buyer_statement" && selectedBuyer && (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white p-2 rounded-lg border-t-2 border-blue-500 text-center"><p className="text-[10px] text-gray-500">Total Bill</p><p className="font-bold text-blue-600">{buyerTotalBill}</p></div>
            <div className="bg-white p-2 rounded-lg border-t-2 border-green-500 text-center"><p className="text-[10px] text-gray-500">Paid</p><p className="font-bold text-green-600">{buyerTotalPaid}</p></div>
            <div className="bg-white p-2 rounded-lg border-t-2 border-red-500 text-center"><p className="text-[10px] text-gray-500">Due</p><p className="font-bold text-red-600">{buyerDue}</p></div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button onClick={() => { setIsEditOrder(false); setOrderData({ id: "", garments: "", orderNo: "", styleNo: "", items: [] }); setShowOrderModal(true); }} className="bg-blue-600 text-white py-2 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><PlusCircle size={14}/> Order</button>
            <button onClick={() => { setIsEditDelivery(false); setDeliveryData({ id: "", garments: "", orderNo: "", styleNo: "", items: [] }); setShowDeliveryModal(true); }} className="bg-brand-navy text-white py-2 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><PlusCircle size={14}/> Delivery</button>
            <button onClick={() => { setIsEditPayment(false); setPaymentData({ id: "", amount: "", details: "", orderNoRef: "" }); setShowPaymentModal(true); }} className="bg-green-600 text-white py-2 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><PlusCircle size={14}/> Payment</button>
          </div>

          <div className="flex justify-end mb-2">
             <button onClick={() => {
                let text = `Statement for ${selectedBuyer.name}\nTotal Bill: ${buyerTotalBill}\nPaid: ${buyerTotalPaid}\nDue: ${buyerDue}\n\nDetails:\n`;
                buyerOrders.forEach(o => { text += `${new Date(o.date).toLocaleDateString()} - ${o.type} - ৳${o.type === 'Payment' ? o.amount : o.items.reduce((s:number, i:any)=>s+Number(i.amount),0)}\n`; });
                if(navigator.share) navigator.share({ title: 'Statement', text });
                else alert("Your browser doesn't support share.");
             }} className="text-brand-navy text-sm flex items-center gap-1 font-bold"><Share2 size={16}/> Share Statement</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-sm">Statement Ledger</div>
             <div className="p-3 space-y-3">
              {buyerOrders.length === 0 && <p className="text-center text-sm text-gray-400 py-2">কোনো লেনদেন নেই।</p>}
              {buyerOrders.map((ord) => (
                <div key={ord.id} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-bold text-brand-navy text-sm">{ord.type} {ord.type === 'Delivery' && `(${ord.garments} - ${ord.orderNo})`}</p>
                    {ord.type === "Delivery" && ord.items.map((it:any, idx:number) => (
                       <p key={idx} className="text-[10px] text-gray-500">- {it.productName} ({it.qty} pcs)</p>
                    ))}
                    <p className="text-[10px] text-gray-500">{ord.details || ord.orderNoRef}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-bold text-sm ${ord.type === 'Payment' ? 'text-green-600' : 'text-brand-navy'}`}>৳{ord.type === 'Payment' ? ord.amount : ord.items.reduce((s:number, i:any)=>s+Number(i.amount),0)}</span>
                    <div className="flex gap-1">
                       <button onClick={() => {
                         if(ord.type === "Payment") { setIsEditPayment(true); setPaymentData({ id: ord.id, amount: ord.amount, details: ord.details || "", orderNoRef: ord.orderNoRef || "" }); setShowPaymentModal(true); }
                         else if(ord.type === "Delivery") { setIsEditDelivery(true); setDeliveryData({ id: ord.id, garments: ord.garments, orderNo: ord.orderNo, styleNo: ord.styleNo, items: ord.items }); setShowDeliveryModal(true); }
                         else if(ord.type === "Order") { setIsEditOrder(true); setOrderData({ id: ord.id, garments: ord.garments, orderNo: ord.orderNo, styleNo: ord.styleNo, items: ord.items }); setShowOrderModal(true); }
                       }} className="text-blue-500 bg-blue-50 p-1 rounded"><Edit size={12}/></button>
                       <button onClick={() => deleteOrder(ord.id, ord.type, ord.items)} className="text-red-500 bg-red-50 p-1 rounded"><Trash2 size={12}/></button>
                    </div>
                  </div>
                </div>
              ))}
             </div>
          </div>
        </div>
      )}

      {viewMode === "main" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {["Cotton", "Polestar"].map(cat => (
            <div key={cat} onClick={() => { setSelectedMain(cat); setViewMode("sub"); }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col items-center gap-2">
              <Folder size={32} className="text-brand-navy" />
              <h3 className="text-lg font-bold text-brand-navy">{cat}</h3>
            </div>
          ))}
        </div>
      )}
      {viewMode === "sub" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from(new Set(shopInventories.filter(p => p.mainCategory === selectedMain).map(p => p.subCategory))).map(sub => (
            <div key={sub} onClick={() => { setSelectedSub(sub); setViewMode("product"); }} className="bg-white p-4 rounded-xl shadow-sm cursor-pointer flex items-center justify-between">
              <span className="font-bold text-gray-700">{sub}</span><ChevronRight size={18} className="text-gray-400" />
            </div>
          ))}
        </div>
      )}
      {viewMode === "product" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-4">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600"><tr><th className="px-2 py-3">Product</th><th className="px-2 py-3 text-center">Stock</th></tr></thead>
            <tbody>
              {shopInventories.filter(p => p.mainCategory === selectedMain && p.subCategory === selectedSub).map(item => (
                <tr key={item.id} className="border-b">
                  <td className="px-2 py-3"><div className="font-bold text-brand-navy">{item.productName}</div><div className="text-[10px] text-gray-500">{item.size} / {item.color}</div></td>
                  <td className="px-2 py-3 text-center font-bold text-green-600">{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Entry Modal */}
      {showDailyEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Add Daily Entry</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await addDoc(collection(db, "shop_statements"), { shop: selectedShop, type: dailyEntryData.type, title: dailyEntryData.title, amount: Number(dailyEntryData.amount), date: new Date().toISOString() });
              setShowDailyEntry(false); alert("Saved!");
            }} className="space-y-3">
              <div><label className="text-xs font-medium">Entry Type</label>
                <select className="w-full border p-2 rounded" value={dailyEntryData.type} onChange={e => setDailyEntryData({...dailyEntryData, type: e.target.value})}>
                  <option value="Sale">Sale</option><option value="Expense">Expense</option><option value="Purchase">Purchase</option>
                </select>
              </div>
              <div><label className="text-xs">Title/Note</label><input required className="w-full border p-2 rounded" value={dailyEntryData.title} onChange={e => setDailyEntryData({...dailyEntryData, title: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={dailyEntryData.amount} onChange={e => setDailyEntryData({...dailyEntryData, amount: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowDailyEntry(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Buyer Modal */}
      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})} /></div>
              <div><label className="text-xs">Phone</label><input className="w-full border p-2 rounded" value={buyerFormData.phone} onChange={e => setBuyerFormData({...buyerFormData, phone: e.target.value})} /></div>
              <div><label className="text-xs">Address</label><input className="w-full border p-2 rounded" value={buyerFormData.address} onChange={e => setBuyerFormData({...buyerFormData, address: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowBuyerModal(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Order & Delivery Modals (Multi-Items) */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Add Order</h3>
            <div className="space-y-3 bg-gray-50 p-3 rounded mb-3 border">
              <input placeholder="Product Name..." className="w-full border p-2 rounded text-sm" value={tempOrderItem.productName} onChange={e => setTempOrderItem({...tempOrderItem, productName: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Qty" type="number" className="w-full border p-2 rounded text-sm" value={tempOrderItem.qty} onChange={e => setTempOrderItem({...tempOrderItem, qty: e.target.value})} />
                <input placeholder="Amount ৳" type="number" className="w-full border p-2 rounded text-sm" value={tempOrderItem.amount} onChange={e => setTempOrderItem({...tempOrderItem, amount: e.target.value})} />
              </div>
              <button type="button" onClick={() => { setOrderData({...orderData, items: [...orderData.items, tempOrderItem]}); setTempOrderItem({ productId: "", productName: "", qty: "", amount: "" }); }} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold">+ Add Item</button>
            </div>
            
            {orderData.items.map((it, i) => <div key={i} className="text-xs bg-gray-100 p-2 rounded mb-1 flex justify-between">{it.productName} ({it.qty} pcs) - ৳{it.amount}</div>)}

            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={handleOrderSave} className="px-4 py-2 bg-brand-navy text-white rounded text-sm">Save Order</button></div>
          </div>
        </div>
      )}

      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Add Delivery</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input placeholder="Garments Name" className="w-full border p-2 rounded text-sm" value={deliveryData.garments} onChange={e => setDeliveryData({...deliveryData, garments: e.target.value})} />
              <input placeholder="Order No" className="w-full border p-2 rounded text-sm" value={deliveryData.orderNo} onChange={e => setDeliveryData({...deliveryData, orderNo: e.target.value})} />
            </div>
            
            <div className="space-y-3 bg-gray-50 p-3 rounded mb-3 border">
              <div className="relative">
                <input placeholder="Search Product..." className="w-full border p-2 rounded text-sm" value={tempDeliveryItem.productName} onChange={e => setTempDeliveryItem({...tempDeliveryItem, productName: e.target.value})} />
                {tempDeliveryItem.productName && !tempDeliveryItem.productId && (
                  <div className="absolute z-10 w-full bg-white border mt-1 rounded shadow max-h-32 overflow-y-auto">
                    {searchedProducts.map(p => <div key={p.id} onClick={() => setTempDeliveryItem({...tempDeliveryItem, productId: p.id, productName: p.productName, amount: p.costPrice.toString()})} className="p-2 text-xs border-b hover:bg-blue-50 cursor-pointer">{p.productName} - Stock: {p.stock}</div>)}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Qty" type="number" className="w-full border p-2 rounded text-sm" value={tempDeliveryItem.qty} onChange={e => setTempDeliveryItem({...tempDeliveryItem, qty: e.target.value})} />
                <input placeholder="Amount ৳" type="number" className="w-full border p-2 rounded text-sm" value={tempDeliveryItem.amount} onChange={e => setTempDeliveryItem({...tempDeliveryItem, amount: e.target.value})} />
              </div>
              <button type="button" onClick={() => { if(!tempDeliveryItem.productId) return alert("Select product!"); setDeliveryData({...deliveryData, items: [...deliveryData.items, tempDeliveryItem]}); setTempDeliveryItem({ productId: "", productName: "", qty: "", amount: "" }); }} className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold">+ Add Item to Delivery</button>
            </div>

            {deliveryData.items.map((it, i) => <div key={i} className="text-xs bg-gray-100 p-2 rounded mb-1 flex justify-between">{it.productName} ({it.qty} pcs) - ৳{it.amount}</div>)}

            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowDeliveryModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={handleDeliverySave} className="px-4 py-2 bg-brand-navy text-white rounded text-sm">Save Delivery</button></div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEditPayment ? "Edit Payment" : "Add Payment"}</h3>
            <form onSubmit={handlePaymentSave} className="space-y-3">
              <div><label className="text-xs">Order Ref (Optional)</label><input className="w-full border p-2 rounded" value={paymentData.orderNoRef} onChange={e => setPaymentData({...paymentData, orderNoRef: e.target.value})} /></div>
              <div><label className="text-xs">Note</label><input className="w-full border p-2 rounded" value={paymentData.details} onChange={e => setPaymentData({...paymentData, details: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
