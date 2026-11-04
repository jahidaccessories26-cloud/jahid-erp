// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Store, ArrowLeft, Download, PlusCircle, DollarSign, X, Package, Folder, ChevronRight, Search, Edit, Trash2, Users } from "lucide-react";
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

  // সার্চ স্টেট
  const [prodSearch, setProdSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // ডেইলি এন্ট্রি স্টেট
  const [showDailyEntry, setShowDailyEntry] = useState(false);
  const [dailyEntryData, setDailyEntryData] = useState({ type: "Sale", title: "", amount: "", productId: "", qty: "", expenseType: "Shop Expense" });
  
  // বায়ার স্টেট (গার্মেন্টস নাম সহ)
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", phone: "", garmentsName: "" });

  // অর্ডার/ডেলিভারি/পেমেন্ট স্টেট
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isEditOrder, setIsEditOrder] = useState(false);
  const [orderData, setOrderData] = useState({ id: "", garments: "", orderNo: "", styleNo: "", productId: "", productName: "", qty: "", amount: "" });
  
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

  // সার্চ করা প্রোডাক্ট (শুধু প্রথম ৫টা দেখাবে)
  const searchedProducts = shopInventories.filter(p => 
    p.productName.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 5);

  // ডেইলি এন্ট্রি সেভ
  const handleDailyEntrySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (dailyEntryData.type === "Sale" && dailyEntryData.productId) {
        const prod = shopInventories.find(p => p.id === dailyEntryData.productId);
        if (prod) {
          const qty = Number(dailyEntryData.qty);
          await updateDoc(doc(db, "shop_inventories", prod.id), { stock: Math.max(0, prod.stock - qty) });
        }
      }
      const finalTitle = dailyEntryData.type === 'Expense' ? `${dailyEntryData.expenseType}: ${dailyEntryData.title}` : dailyEntryData.title;
      
      await addDoc(collection(db, "shop_statements"), {
        shop: selectedShop, type: dailyEntryData.type, title: finalTitle, amount: Number(dailyEntryData.amount), date: new Date().toISOString(), createdAt: new Date().toISOString()
      });
      setShowDailyEntry(false); setDailyEntryData({ type: "Sale", title: "", amount: "", productId: "", qty: "", expenseType: "Shop Expense" }); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // বায়ার সেভ
  const handleBuyerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (buyerFormData.id) {
        await updateDoc(doc(db, "buyers", buyerFormData.id), { name: buyerFormData.name, phone: buyerFormData.phone, garmentsName: buyerFormData.garmentsName });
      } else {
        await addDoc(collection(db, "buyers"), { shop: selectedShop, name: buyerFormData.name, phone: buyerFormData.phone, garmentsName: buyerFormData.garmentsName, createdAt: new Date().toISOString() });
      }
      setShowBuyerModal(false); setBuyerFormData({ id: "", name: "", phone: "", garmentsName: "" }); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // অর্ডার/ডেলিভারি সেভ
  const handleOrderSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditOrder) {
        await updateDoc(doc(db, "buyer_orders", orderData.id), {
          garments: orderData.garments, orderNo: orderData.orderNo, styleNo: orderData.styleNo, productId: orderData.productId, productName: orderData.productName, qty: Number(orderData.qty), amount: Number(orderData.amount)
        });
      } else {
        if (orderData.productId) {
           const prod = shopInventories.find(p => p.id === orderData.productId);
           if (prod) await updateDoc(doc(db, "shop_inventories", prod.id), { stock: Math.max(0, prod.stock - Number(orderData.qty)) });
        }
        await addDoc(collection(db, "buyer_orders"), {
          shop: selectedShop, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          garments: orderData.garments, orderNo: orderData.orderNo, styleNo: orderData.styleNo, productId: orderData.productId, productName: orderData.productName, qty: Number(orderData.qty), amount: Number(orderData.amount), 
          type: "Delivery", date: new Date().toISOString()
        });
      }
      setShowOrderModal(false); setOrderData({ id: "", garments: "", orderNo: "", styleNo: "", productId: "", productName: "", qty: "", amount: "" }); setProdSearch(""); setSelectedProduct(null); alert("সেভ হয়েছে!");
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
      setShowPaymentModal(false); setPaymentData({ id: "", amount: "", details: "", orderNoRef: "" }); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডিলিট ফাংশন
  const deleteStatement = async (id: string) => { if(window.confirm("ডিলিট করবেন?")) await deleteDoc(doc(db, "shop_statements", id)); };
  const deleteBuyer = async (id: string) => { if(window.confirm("বায়ার ডিলিট করবেন?")) await deleteDoc(doc(db, "buyers", id)); };
  const deleteOrder = async (id: string) => { if(window.confirm("লেনদেন ডিলিট করবেন?")) await deleteDoc(doc(db, "buyer_orders", id)); };

  const buyerOrders = shopBuyerOrders.filter(o => o.buyerId === selectedBuyer?.id).sort((a,b) => new Date(b.date) - new Date(a.date));
  const buyerTotalBill = buyerOrders.filter(o => o.type === "Delivery").reduce((sum, o) => sum + Number(o.amount || 0), 0);
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-sm">Today's History</div>
            <div className="p-3 space-y-2">
              {todayStatements.length === 0 && <p className="text-center text-sm text-gray-400 py-2">আজকে কোনো লেনদেন নেই।</p>}
              {todayStatements.map((stmt) => (
                <div key={stmt.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <div><p className="font-bold text-brand-navy text-sm">{stmt.title}</p><p className="text-[10px] text-gray-500">{stmt.type}</p></div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${stmt.type === 'Sale' ? 'text-green-600' : 'text-red-600'}`}>৳{stmt.amount}</span>
                    <button onClick={() => deleteStatement(stmt.id)} className="text-red-500 bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {viewMode === "buyers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">All Buyers</h3>
            <button onClick={() => { setBuyerFormData({ id: "", name: "", phone: "", garmentsName: "" }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
              <PlusCircle size={16}/> Add Buyer
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shopBuyers.map(buyer => (
              <div key={buyer.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="cursor-pointer" onClick={() => { setSelectedBuyer(buyer); setViewMode("buyer_statement"); }}>
                  <p className="font-bold text-brand-navy text-sm">{buyer.name} <span className="text-xs text-gray-500 font-normal">({buyer.garmentsName})</span></p>
                  <p className="text-[11px] text-gray-500">{buyer.phone}</p>
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

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => { setIsEditOrder(false); setOrderData({ id: "", garments: selectedBuyer.garmentsName || "", orderNo: "", styleNo: "", productId: "", productName: "", qty: "", amount: "" }); setShowOrderModal(true); }} className="bg-brand-navy text-white py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-1"><PlusCircle size={14}/> Add Delivery</button>
            <button onClick={() => { setIsEditPayment(false); setPaymentData({ id: "", amount: "", details: "", orderNoRef: "" }); setShowPaymentModal(true); }} className="bg-green-600 text-white py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-1"><PlusCircle size={14}/> Add Payment</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-sm">Statement Ledger</div>
             <div className="p-3 space-y-3">
              {buyerOrders.length === 0 && <p className="text-center text-sm text-gray-400 py-2">কোনো লেনদেন নেই।</p>}
              {buyerOrders.map((ord) => (
                <div key={ord.id} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-bold text-brand-navy text-sm">{ord.type === "Payment" ? "Payment" : `${ord.garments} - ${ord.orderNo}`}</p>
                    {ord.type === "Delivery" && <p className="text-[10px] text-gray-500">Style: {ord.styleNo} | Product: {ord.productName} ({ord.qty} pcs)</p>}
                    <p className="text-[10px] text-gray-500">{ord.details || ord.orderNoRef}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-bold text-sm ${ord.type === 'Payment' ? 'text-green-600' : 'text-brand-navy'}`}>৳{ord.amount}</span>
                    <div className="flex gap-1">
                       <button onClick={() => {
                         if(ord.type === "Payment") { setIsEditPayment(true); setPaymentData({ id: ord.id, amount: ord.amount, details: ord.details || "", orderNoRef: ord.orderNoRef || "" }); setShowPaymentModal(true); }
                         else { setIsEditOrder(true); setOrderData({ id: ord.id, garments: ord.garments, orderNo: ord.orderNo, styleNo: ord.styleNo, productId: ord.productId, productName: ord.productName, qty: ord.qty, amount: ord.amount }); setShowOrderModal(true); }
                       }} className="text-blue-500 bg-blue-50 p-1 rounded"><Edit size={12}/></button>
                       <button onClick={() => deleteOrder(ord.id)} className="text-red-500 bg-red-50 p-1 rounded"><Trash2 size={12}/></button>
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
            <form onSubmit={handleDailyEntrySave} className="space-y-3">
              <div><label className="text-xs font-medium">Entry Type</label>
                <select className="w-full border p-2 rounded" value={dailyEntryData.type} onChange={e => setDailyEntryData({...dailyEntryData, type: e.target.value})}>
                  <option value="Sale">Sale (বিক্রি)</option>
                  <option value="Expense">Expense (খরচ)</option>
                  <option value="Purchase">Purchase (ক্রয়)</option>
                </select>
              </div>
              
              {dailyEntryData.type === "Sale" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Search Product</label>
                    <input type="text" placeholder="Type product name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                    <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                      {searchedProducts.map(p => (
                        <div key={p.id} onClick={() => { setDailyEntryData({...dailyEntryData, productId: p.id, title: p.productName, amount: p.costPrice.toString()}); setProdSearch(""); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} ({p.size}/{p.color}) - Stock: {p.stock}</div>
                      ))}
                      {searchedProducts.length === 0 && prodSearch && <div className="p-2 text-xs text-gray-500">No product found</div>}
                    </div>
                  </div>
                  <div><label className="text-xs font-medium">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={dailyEntryData.qty} onChange={e => setDailyEntryData({...dailyEntryData, qty: e.target.value})} /></div>
                </>
              )}

              {dailyEntryData.type === "Expense" && (
                <div><label className="text-xs font-medium">Expense Category</label>
                  <select className="w-full border p-2 rounded" value={dailyEntryData.expenseType} onChange={e => setDailyEntryData({...dailyEntryData, expenseType: e.target.value})}>
                    <option value="Shop Expense">দোকান খরচ</option>
                    <option value="Bank Deposit">ব্যাংকে জমা</option>
                    <option value="Party Payment">পার্টি পেমেন্ট</option>
                    <option value="Transport">যাতায়াত</option>
                  </select>
                </div>
              )}

              <div><label className="text-xs">Title/Note</label><input required className="w-full border p-2 rounded" value={dailyEntryData.title} onChange={e => setDailyEntryData({...dailyEntryData, title: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={dailyEntryData.amount} onChange={e => setDailyEntryData({...dailyEntryData, amount: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowDailyEntry(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Buyer Modal (গার্মেন্টস নাম সহ) */}
      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Garments Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.garmentsName} onChange={e => setBuyerFormData({...buyerFormData, garmentsName: e.target.value})} /></div>
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})} /></div>
              <div><label className="text-xs">Phone</label><input className="w-full border p-2 rounded" value={buyerFormData.phone} onChange={e => setBuyerFormData({...buyerFormData, phone: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowBuyerModal(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Order Modal (গার্মেন্টস, অর্ডার ও স্টাইল নাম্বার সহ) */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEditOrder ? "Edit Delivery" : "Add Delivery"}</h3>
            <form onSubmit={handleOrderSave} className="space-y-3">
              <div><label className="text-xs">Garments Name</label><input required className="w-full border p-2 rounded" value={orderData.garments} onChange={e => setOrderData({...orderData, garments: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Order No</label><input required className="w-full border p-2 rounded" value={orderData.orderNo} onChange={e => setOrderData({...orderData, orderNo: e.target.value})} /></div>
                <div><label className="text-xs">Style No</label><input required className="w-full border p-2 rounded" value={orderData.styleNo} onChange={e => setOrderData({...orderData, styleNo: e.target.value})} /></div>
              </div>
              <div>
                <label className="text-xs font-medium">Search Product</label>
                <input type="text" placeholder="Type product name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                  {searchedProducts.map(p => (
                    <div key={p.id} onClick={() => { setOrderData({...orderData, productId: p.id, productName: p.productName, amount: p.costPrice.toString()}); setProdSearch(""); setSelectedProduct(p); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} ({p.size}/{p.color}) - Stock: {p.stock}</div>
                  ))}
                  {searchedProducts.length === 0 && prodSearch && <div className="p-2 text-xs text-gray-500">No product found</div>}
                </div>
                {orderData.productName && <p className="text-xs text-green-600 mt-1">Selected: {orderData.productName}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={orderData.qty} onChange={e => setOrderData({...orderData, qty: e.target.value})} /></div>
                <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={orderData.amount} onChange={e => setOrderData({...orderData, amount: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEditPayment ? "Edit Payment" : "Add Payment"}</h3>
            <form onSubmit={handlePaymentSave} className="space-y-3">
              <div><label className="text-xs">Order No Ref (Optional)</label><input className="w-full border p-2 rounded" value={paymentData.orderNoRef} onChange={e => setPaymentData({...paymentData, orderNoRef: e.target.value})} /></div>
              <div><label className="text-xs">Details (Note)</label><input className="w-full border p-2 rounded" value={paymentData.details} onChange={e => setPaymentData({...paymentData, details: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
