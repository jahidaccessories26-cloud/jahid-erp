// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, addDoc, increment } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, PlusCircle, Edit, Trash2, Building, Share2, Wallet, ShoppingBag } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function BuyerStatementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopParam = searchParams.get("shop") || "";

  const [buyers, setBuyers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", companyName: "", shop: shopParam });

  // ডেলিভারি স্টেট
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [isEditDelivery, setIsEditDelivery] = useState(false);
  const [saleData, setSaleData] = useState({ id: "", productId: "", productName: "", qty: "", salePrice: "", amount: "", orderNo: "", styleNo: "", oldQty: 0 });
  const [prodSearch, setProdSearch] = useState("");

  // পেমেন্ট স্টেট
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isEditPayment, setIsEditPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({ id: "", amount: "", note: "", orderNoRef: "" });

  useEffect(() => {
    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyers(data.filter(b => shopParam === "" || b.shop === shopParam));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data.filter(p => shopParam === "" || p.shop === shopParam));
    });

    return () => { unsubBuyers(); unsubProducts(); };
  }, [shopParam]);

  useEffect(() => {
    if (!selectedBuyer) return;
    const unsubOrders = onSnapshot(query(collection(db, "buyer_orders")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyerOrders(data.filter(o => o.buyerId === selectedBuyer.id).sort((a,b) => new Date(b.date) - new Date(a.date)));
    });
    return () => unsubOrders();
  }, [selectedBuyer]);

  const handleBuyerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (buyerFormData.id) {
        await updateDoc(doc(db, "buyers", buyerFormData.id), { name: buyerFormData.name, companyName: buyerFormData.companyName });
      } else {
        await addDoc(collection(db, "buyers"), { ...buyerFormData, createdAt: new Date().toISOString() });
      }
      setShowBuyerModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডেলিভারি সেভ (এডিট + নতুন)
  const handleSaleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditDelivery) {
        const diff = Number(saleData.qty) - Number(saleData.oldQty);
        if (diff !== 0 && saleData.productId) {
          const prod = products.find(p => p.id === saleData.productId);
          if (diff > 0 && (!prod || prod.stock < diff)) return alert("স্টক পর্যাপ্ত নয়!");
          await updateDoc(doc(db, "shop_inventories", saleData.productId), { stock: increment(-diff) });
        }
        await updateDoc(doc(db, "buyer_orders", saleData.id), {
          orderNo: saleData.orderNo, styleNo: saleData.styleNo, qty: Number(saleData.qty), amount: Number(saleData.amount), price: Number(saleData.salePrice)
        });
        alert("ডেলিভারি আপডেট হয়েছে!");
      } else {
        const prod = products.find(p => p.id === saleData.productId);
        if (!prod || prod.stock < Number(saleData.qty)) return alert("স্টক পর্যাপ্ত নয়!");

        await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(saleData.qty)) });
        await addDoc(collection(db, "buyer_orders"), {
          shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          companyName: selectedBuyer.companyName, orderNo: saleData.orderNo, styleNo: saleData.styleNo, 
          productId: saleData.productId, productName: saleData.productName, 
          qty: Number(saleData.qty), price: Number(saleData.salePrice), amount: Number(saleData.amount),
          type: "Delivery", date: new Date().toISOString()
        });
        alert("নতুন ডেলিভারি সেভ হয়েছে!");
      }
      setShowSaleModal(false); setProdSearch("");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // পেমেন্ট সেভ (এডিট + নতুন)
  const handlePaymentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditPayment) {
        await updateDoc(doc(db, "buyer_orders", paymentData.id), {
          amount: Number(paymentData.amount), details: paymentData.note, orderNoRef: paymentData.orderNoRef
        });
        alert("পেমেন্ট আপডেট হয়েছে!");
      } else {
        await addDoc(collection(db, "buyer_orders"), {
          shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          type: "Payment", amount: Number(paymentData.amount), details: paymentData.note, 
          orderNoRef: paymentData.orderNoRef, date: new Date().toISOString()
        });
        alert("পেমেন্ট সেভ হয়েছে!");
      }
      setShowPaymentModal(false);
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDeleteOrder = async (id: string, type: string, prodId: string, qty: number) => {
    if (!window.confirm("ডিলিট করলে স্টক ফেরত আসবে। নিশ্চিত?")) return;
    try {
      if (type === "Delivery" && prodId) {
        await updateDoc(doc(db, "shop_inventories", prodId), { stock: increment(Number(qty)) });
      }
      await deleteDoc(doc(db, "buyer_orders", id));
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleShareStatement = async () => {
    if (buyerOrders.length === 0) return alert("ডেটা নেই!");
    const pdf = new jsPDF();

    const totalBill = buyerOrders.filter(o => o.type === "Delivery").reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const totalPaid = buyerOrders.filter(o => o.type === "Payment").reduce((sum, o) => sum + Number(o.amount || 0), 0);

    // হেডার: গার্মেন্টস (কোম্পানি) -> বায়ার -> হিসাব
    pdf.setFontSize(18);
    pdf.text(`${selectedBuyer.companyName || "N/A"}`, 14, 16);
    pdf.setFontSize(12);
    pdf.text(`Buyer: ${selectedBuyer.name}`, 14, 24);
    pdf.setFontSize(10);
    pdf.text(`Total Bill: BDT ${totalBill}   |   Total Paid: BDT ${totalPaid}   |   Due: BDT ${totalBill - totalPaid}`, 14, 31);

    // পুরনো থেকে নতুন ক্রমে সাজানো
    const sorted = [...buyerOrders].sort((a, b) => new Date(a.date) - new Date(b.date));
    const tableData = sorted.map(o => {
      const dateStr = new Date(o.date).toLocaleDateString("en-GB");
      if (o.type === "Delivery") {
        return [dateStr, o.orderNo || "-", o.styleNo || "-", o.productName || "", o.qty || "", o.price || "", o.amount || 0, ""];
      }
      return [dateStr, o.orderNoRef || "-", "-", `Payment${o.details ? " - " + o.details : ""}`, "", "", "", o.amount || 0];
    });

    autoTable(pdf, {
      head: [['Date', 'Order No', 'Style', 'Details', 'Qty', 'Rate', 'Bill', 'Paid']],
      body: tableData,
      foot: [['', '', '', 'Total', '', '', totalBill, totalPaid]],
      startY: 36,
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    });

    const fileName = `Statement_${selectedBuyer.companyName || ""}_${selectedBuyer.name}.pdf`;
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Buyer Statement' }); } catch (e) {}
    } else { pdf.save(fileName); }
  };

  const searchedProducts = products.filter(p => p.productName.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5);

  // এই বায়ারের আগের অর্ডার ও স্টাইলের তালিকা (বারবার লেখা এড়াতে)
  const orderList: any[] = [];
  buyerOrders.filter(o => o.type === "Delivery").forEach(o => {
    if (!orderList.find(x => x.orderNo === o.orderNo && x.styleNo === (o.styleNo || ""))) {
      orderList.push({ orderNo: o.orderNo, styleNo: o.styleNo || "" });
    }
  });
  const selectedOrderIdx = orderList.findIndex(x => x.orderNo === saleData.orderNo && x.styleNo === saleData.styleNo);

  if (selectedBuyer) {
    let totalBill = buyerOrders.filter(o => o.type === "Delivery").reduce((sum, o) => sum + Number(o.amount || 0), 0);
    let totalPaid = buyerOrders.filter(o => o.type === "Payment").reduce((sum, o) => sum + Number(o.amount || 0), 0);
    let due = totalBill - totalPaid;
    
    return (
      <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedBuyer(null)} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{selectedBuyer.companyName}</h2>
              <p className="text-sm font-medium text-gray-600">{selectedBuyer.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleShareStatement} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Share2 size={16}/> Statement</button>
            <button onClick={() => { const last = buyerOrders.find(o => o.type === "Delivery"); setIsEditDelivery(false); setProdSearch(""); setSaleData({ id: "", productId: "", productName: "", qty: "", salePrice: "", amount: "", orderNo: last ? last.orderNo : "", styleNo: last ? (last.styleNo || "") : "", oldQty: 0 }); setShowSaleModal(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><ShoppingBag size={16}/> Add Delivery</button>
            <button onClick={() => { setIsEditPayment(false); setPaymentData({ id: "", amount: "", note: "", orderNoRef: "" }); setShowPaymentModal(true); }} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Wallet size={16}/> Add Payment</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500 text-center">
            <p className="text-xs text-gray-500">Total Bill</p>
            <p className="font-bold text-blue-600 text-lg">৳{totalBill}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border-t-4 border-green-500 text-center">
            <p className="text-xs text-gray-500">Total Paid</p>
            <p className="font-bold text-green-600 text-lg">৳{totalPaid}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border-t-4 border-red-500 text-center">
            <p className="text-xs text-gray-500">Due</p>
            <p className="font-bold text-red-600 text-lg">৳{due}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="md:hidden p-3 space-y-3 bg-gray-50">
            {buyerOrders.length === 0 && <p className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</p>}
            {buyerOrders.map((o) => (
              <div key={o.id} className="bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex justify-between items-start border-b pb-2 mb-2">
                  <div>
                    <p className={`font-bold ${o.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>{o.type}</p>
                    <p className="text-[11px] text-gray-500">{new Date(o.date).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-bold ${o.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>৳{o.amount}</p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-xs text-gray-600 max-w-[70%]">
                    {o.type === "Delivery" ? `${o.productName} (${o.qty} pcs) - Order: ${o.orderNo} | Style: ${o.styleNo || "-"}` : `Ref: ${o.orderNoRef || "-"} | ${o.details || ""}`}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if(o.type === "Payment") { setIsEditPayment(true); setPaymentData({ id: o.id, amount: o.amount, note: o.details || "", orderNoRef: o.orderNoRef || "" }); setShowPaymentModal(true); }
                      else { setIsEditDelivery(true); setSaleData({ id: o.id, productId: o.productId, productName: o.productName, qty: o.qty, salePrice: o.price || "", amount: o.amount, orderNo: o.orderNo, styleNo: o.styleNo, oldQty: o.qty }); setShowSaleModal(true); }
                    }} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteOrder(o.id, o.type, o.productId, o.qty)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <table className="w-full text-left text-sm hidden md:table">
            <thead className="bg-gray-100 text-gray-600">
              <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Details</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-center">Action</th></tr>
            </thead>
            <tbody>
              {buyerOrders.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</td></tr>}
              {buyerOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">{new Date(o.date).toLocaleDateString()}</td>
                  <td className={`px-3 py-3 font-bold ${o.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>{o.type}</td>
                  <td className="px-3 py-3">
                    {o.type === "Delivery" ? `${o.productName} (${o.qty} pcs) - Order: ${o.orderNo} | Style: ${o.styleNo || "-"}` : `Payment for Order: ${o.orderNoRef || "N/A"} | ${o.details || ""}`}
                  </td>
                  <td className={`px-3 py-3 text-right font-bold ${o.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>৳{o.amount}</td>
                  <td className="px-3 py-3 flex justify-center gap-2">
                    <button onClick={() => {
                      if(o.type === "Payment") { setIsEditPayment(true); setPaymentData({ id: o.id, amount: o.amount, note: o.details || "", orderNoRef: o.orderNoRef || "" }); setShowPaymentModal(true); }
                      else { setIsEditDelivery(true); setSaleData({ id: o.id, productId: o.productId, productName: o.productName, qty: o.qty, salePrice: o.price || "", amount: o.amount, orderNo: o.orderNo, styleNo: o.styleNo, oldQty: o.qty }); setShowSaleModal(true); }
                    }} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteOrder(o.id, o.type, o.productId, o.qty)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showSaleModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">{isEditDelivery ? "Edit Delivery" : "Add Delivery"}</h3>
              <form onSubmit={handleSaleSave} className="space-y-3">
                {!isEditDelivery && (
                  <div>
                    <label className="text-xs font-medium">Select Order</label>
                    <select className="w-full border p-2 rounded" value={selectedOrderIdx >= 0 ? String(selectedOrderIdx) : "new"} onChange={e => {
                      if (e.target.value === "new") { setSaleData({...saleData, orderNo: "", styleNo: ""}); }
                      else { const o = orderList[Number(e.target.value)]; setSaleData({...saleData, orderNo: o.orderNo, styleNo: o.styleNo}); }
                    }}>
                      <option value="new">+ নতুন অর্ডার (নিচে লিখুন)</option>
                      {orderList.map((o, idx) => (
                        <option key={idx} value={String(idx)}>{o.orderNo} | Style: {o.styleNo || "-"}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Order No</label><input required className="w-full border p-2 rounded" value={saleData.orderNo} onChange={e => setSaleData({...saleData, orderNo: e.target.value})} placeholder="e.g. 101" /></div>
                  <div><label className="text-xs">Style No</label><input required className="w-full border p-2 rounded" value={saleData.styleNo} onChange={e => setSaleData({...saleData, styleNo: e.target.value})} /></div>
                </div>
                <div>
                  <label className="text-xs font-medium">Search Product</label>
                  <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} disabled={isEditDelivery} />
                  {!isEditDelivery && (
                    <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                      {searchedProducts.map(p => (
                        <div key={p.id} onClick={() => { setSaleData({...saleData, productId: p.id, productName: p.productName, salePrice: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} - Stock: {p.stock}</div>
                      ))}
                    </div>
                  )}
                  {isEditDelivery && <p className="text-xs text-green-600 mt-1">Selected: {saleData.productName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={saleData.qty} onChange={e => setSaleData({...saleData, qty: e.target.value, amount: String(Number(e.target.value || 0) * Number(saleData.salePrice || 0))})} /></div>
                  <div><label className="text-xs">Sale Price (৳)</label><input required type="number" className="w-full border p-2 rounded" value={saleData.salePrice} onChange={e => setSaleData({...saleData, salePrice: e.target.value, amount: String(Number(saleData.qty || 0) * Number(e.target.value || 0))})} /></div>
                </div>
                <div><label className="text-xs">Total Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={saleData.amount} onChange={e => setSaleData({...saleData, amount: e.target.value})} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowSaleModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm">
              <h3 className="text-lg font-bold mb-4">{isEditPayment ? "Edit Payment" : "Add Payment"}</h3>
              <form onSubmit={handlePaymentSave} className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Select Order</label>
                  <select required className="w-full border p-2 rounded mb-2" value={paymentData.orderNoRef} onChange={e => setPaymentData({...paymentData, orderNoRef: e.target.value})}>
                    <option value="">-- Select Order --</option>
                    {Array.from(new Set(buyerOrders.filter(o => o.type === "Delivery").map(o => o.orderNo))).map((orderNo, idx) => (
                      <option key={idx} value={orderNo}>{orderNo}</option>
                    ))}
                  </select>
                </div>
                <div><label className="text-xs">Payment Amount (৳)</label><input required type="number" className="w-full border p-2 rounded text-lg font-bold text-green-600" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} /></div>
                <div><label className="text-xs">Note (Optional)</label><input className="w-full border p-2 rounded" value={paymentData.note} onChange={e => setPaymentData({...paymentData, note: e.target.value})} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save Payment</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Buyers ({shopParam || "All"})</h2>
        </div>
        <button onClick={() => { setBuyerFormData({ id: "", name: "", companyName: "", shop: shopParam }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <PlusCircle size={16}/> Add Buyer
        </button>
      </div>

      <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-sm mb-4">
        <Search size={16} className="text-gray-400" />
        <input type="text" placeholder="Search Buyer..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {buyers.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(buyer => (
          <div key={buyer.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition" onClick={() => setSelectedBuyer(buyer)}>
            <div>
              <p className="font-bold text-brand-navy">{buyer.companyName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Building size={12}/> {buyer.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setBuyerFormData(buyer); setShowBuyerModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
              <button onClick={(e) => { e.stopPropagation(); if(window.confirm("ডিলিট করবেন?")) deleteDoc(doc(db, "buyers", buyer.id)); }} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>

      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Company Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.companyName} onChange={e => setBuyerFormData({...buyerFormData, companyName: e.target.value})} /></div>
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBuyerModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuyerStatementPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <BuyerStatementContent />
    </Suspense>
  );
}
