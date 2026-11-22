// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc, deleteDoc, addDoc, increment } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, PlusCircle, Edit, Trash2, Building, Share2, Wallet, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// এই তারিখ বা তার পরের মাল দেওয়ায় স্টক কমবে। এর আগের তারিখ দিলে এটা পুরনো লেনদেন, স্টক বদলাবে না।
const STOCK_START_DATE = "2026-11-18";

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const todayStr = () => toDateInput(new Date().toISOString());
const isOldDate = (dateStr: string) => dateStr < STOCK_START_DATE;
const dateToIso = (dateStr: string) => dateStr === todayStr() ? new Date().toISOString() : new Date(`${dateStr}T12:00:00`).toISOString();

const makeEmptySale = () => ({ id: "", productId: "", productName: "", qty: "", salePrice: "", amount: "", costPrice: 0, oldQty: 0, date: todayStr(), origDate: "", noStock: false });
const makeEmptyPayment = () => ({ id: "", amount: "", note: "", oldAmount: 0, date: todayStr(), origDate: "" });

function BuyerStatementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopParam = searchParams.get("shop") || "";

  const [buyers, setBuyers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openOrderId, setOpenOrderId] = useState("");

  // বায়ার ফর্ম
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", companyName: "", shop: shopParam });

  // অর্ডার ফর্ম
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ id: "", orderNo: "", styleNo: "" });

  // যে অর্ডারে কাজ চলছে
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // মাল দেওয়ার ফর্ম
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [isEditDelivery, setIsEditDelivery] = useState(false);
  const [saleData, setSaleData] = useState<any>(makeEmptySale());
  const [prodSearch, setProdSearch] = useState("");
  const [showList, setShowList] = useState(false);

  // টাকা নেওয়ার ফর্ম
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isEditPayment, setIsEditPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(makeEmptyPayment());

  useEffect(() => {
    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setBuyers(data.filter(b => shopParam === "" || b.shop === shopParam));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(data.filter(p => shopParam === "" || p.shop === shopParam));
    });

    return () => { unsubBuyers(); unsubProducts(); };
  }, [shopParam]);

  // নির্বাচিত বায়ারের সব তথ্য (অর্ডার, মাল দেওয়া, টাকা নেওয়া)
  useEffect(() => {
    if (!selectedBuyer) { setAllDocs([]); return; }
    const unsub = onSnapshot(query(collection(db, "buyer_orders"), where("buyerId", "==", selectedBuyer.id)), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllDocs(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });
    return () => unsub();
  }, [selectedBuyer]);

  // ---------- হিসাবের সাহায্যকারী ----------
  const orders = allDocs.filter(t => t.type === "Order");
  const txs = allDocs.filter(t => t.type === "Delivery" || t.type === "Payment");
  const sumBill = (list: any[]) => list.filter(t => t.type === "Delivery").reduce((s, t) => s + Number(t.amount || 0), 0);
  const sumPaid = (list: any[]) => list.filter(t => t.type === "Payment").reduce((s, t) => s + Number(t.amount || 0), 0);
  const txOfOrder = (order: any) => txs.filter(t => t.orderId ? t.orderId === order.id : (t.orderNo === order.orderNo || t.orderNoRef === order.orderNo));
  const orphanTx = txs.filter(t => !orders.some(o => txOfOrder(o).includes(t)));

  // ---------- বায়ার ----------
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

  const handleDeleteBuyer = async (buyer: any) => {
    try {
      const snap = await getDocs(query(collection(db, "buyer_orders"), where("buyerId", "==", buyer.id)));
      if (!snap.empty) return alert("এই বায়ারের অর্ডার বা লেনদেন আছে। আগে সেগুলো ডিলিট করুন।");
      if (!window.confirm("এই বায়ার ডিলিট করবেন?")) return;
      await deleteDoc(doc(db, "buyers", buyer.id));
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- অর্ডার ----------
  const handleOrderSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderNo = orderForm.orderNo.trim();
    const styleNo = orderForm.styleNo.trim();
    if (!orderNo) return alert("অর্ডার নাম্বার লিখুন!");
    if (orders.some(o => o.orderNo === orderNo && o.id !== orderForm.id)) return alert("এই অর্ডার নাম্বার আগে থেকেই আছে!");
    try {
      if (orderForm.id) {
        const order = orders.find(o => o.id === orderForm.id);
        const related = txOfOrder(order);
        await updateDoc(doc(db, "buyer_orders", orderForm.id), { orderNo, styleNo });
        await Promise.all(related.map(t => updateDoc(doc(db, "buyer_orders", t.id),
          t.type === "Delivery" ? { orderNo, styleNo, orderId: order.id } : { orderNoRef: orderNo, orderId: order.id }
        )));
      } else {
        await addDoc(collection(db, "buyer_orders"), {
          type: "Order", shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name,
          companyName: selectedBuyer.companyName, orderNo, styleNo, date: new Date().toISOString()
        });
      }
      setShowOrderModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDeleteOrderCard = async (order: any) => {
    if (txOfOrder(order).length > 0) return alert("এই অর্ডারে মাল বা টাকার এন্ট্রি আছে। আগে সেগুলো ডিলিট করুন।");
    if (!window.confirm("এই অর্ডার ডিলিট করবেন?")) return;
    try { await deleteDoc(doc(db, "buyer_orders", order.id)); } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- মাল দেওয়া ----------
  const openDelivery = (order: any) => {
    setActiveOrder(order); setIsEditDelivery(false); setSaleData(makeEmptySale());
    setProdSearch(""); setShowList(false); setShowSaleModal(true);
  };

  const handleSaleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(saleData.qty);
    if (!(qty > 0)) return alert("পরিমাণ লিখুন!");
    if (!saleData.date) return alert("তারিখ দিন!");
    try {
      if (isEditDelivery) {
        const dateChanged = saleData.date !== saleData.origDate;
        if (dateChanged) {
          if (saleData.noStock && !isOldDate(saleData.date)) return alert("এটা পুরনো এন্ট্রি, স্টক কমেনি। তারিখ আজকের দিকে নেওয়া যাবে না।");
          if (!saleData.noStock && isOldDate(saleData.date)) return alert("এই মাল আপনার স্টক থেকে কমেছে। তারিখ পুরনো করা যাবে না। ডিলিট করে নতুন করে দিন।");
        }
        if (!saleData.noStock) {
          const diff = qty - Number(saleData.oldQty);
          if (diff !== 0 && saleData.productId) {
            const prod = products.find(p => p.id === saleData.productId);
            if (diff > 0 && (!prod || prod.stock < diff)) return alert("স্টক পর্যাপ্ত নয়!");
            await updateDoc(doc(db, "shop_inventories", saleData.productId), { stock: increment(-diff) });
          }
        }
        await updateDoc(doc(db, "buyer_orders", saleData.id), {
          qty, amount: Number(saleData.amount), price: Number(saleData.salePrice),
          ...(dateChanged ? { date: dateToIso(saleData.date) } : {})
        });
        alert("আপডেট হয়েছে!");
      } else {
        if (!saleData.productId) return alert("আগে লিস্ট থেকে প্রোডাক্ট সিলেক্ট করুন!");
        const prod = products.find(p => p.id === saleData.productId);
        if (!prod) return alert("প্রোডাক্ট পাওয়া যায়নি!");
        const noStock = isOldDate(saleData.date);
        if (!noStock) {
          if (prod.stock < qty) return alert("স্টক পর্যাপ্ত নয়!");
          await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-qty) });
        }
        await addDoc(collection(db, "buyer_orders"), {
          type: "Delivery", shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name,
          companyName: selectedBuyer.companyName, orderId: activeOrder.id, orderNo: activeOrder.orderNo, styleNo: activeOrder.styleNo || "",
          productId: saleData.productId, productName: saleData.productName,
          qty, price: Number(saleData.salePrice), amount: Number(saleData.amount), costPrice: Number(prod.costPrice || 0),
          noStock, date: dateToIso(saleData.date)
        });
        alert(noStock ? "পুরনো মাল দেওয়া সেভ হয়েছে (স্টক বদলায়নি)!" : "মাল দেওয়া সেভ হয়েছে!");
      }
      setShowSaleModal(false); setProdSearch(""); setShowList(false);
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- টাকা নেওয়া ----------
  const openPayment = (order: any) => {
    setActiveOrder(order); setIsEditPayment(false); setPaymentData(makeEmptyPayment()); setShowPaymentModal(true);
  };

  const activeOrderDue = () => {
    if (!activeOrder || !activeOrder.id) return null;
    const list = txOfOrder(activeOrder);
    return sumBill(list) - sumPaid(list) + (isEditPayment ? Number(paymentData.oldAmount || 0) : 0);
  };

  const handlePaymentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentData.amount);
    if (!(amount > 0)) return alert("টাকার পরিমাণ লিখুন!");
    if (!paymentData.date) return alert("তারিখ দিন!");
    const due = activeOrderDue();
    if (due !== null && amount > due) {
      if (!window.confirm(`এই অর্ডারের বাকি ৳${due}। আপনি ৳${amount} নিচ্ছেন, যা বাকির চেয়ে বেশি। তবুও সেভ করবেন?`)) return;
    }
    try {
      if (isEditPayment) {
        const dateChanged = paymentData.date !== paymentData.origDate;
        await updateDoc(doc(db, "buyer_orders", paymentData.id), {
          amount, details: paymentData.note,
          ...(dateChanged ? { date: dateToIso(paymentData.date) } : {})
        });
        alert("আপডেট হয়েছে!");
      } else {
        await addDoc(collection(db, "buyer_orders"), {
          type: "Payment", shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name,
          orderId: activeOrder.id, orderNoRef: activeOrder.orderNo, amount, details: paymentData.note, date: dateToIso(paymentData.date)
        });
        alert("টাকা জমা সেভ হয়েছে!");
      }
      setShowPaymentModal(false);
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- এন্ট্রি এডিট / ডিলিট ----------
  const openEditTx = (t: any, order: any) => {
    setActiveOrder(order || { id: "", orderNo: t.orderNo || t.orderNoRef || "", styleNo: t.styleNo || "" });
    if (t.type === "Payment") {
      setIsEditPayment(true);
      setPaymentData({ id: t.id, amount: String(t.amount ?? ""), note: t.details || "", oldAmount: Number(t.amount || 0), date: toDateInput(t.date), origDate: toDateInput(t.date) });
      setShowPaymentModal(true);
    } else {
      setIsEditDelivery(true); setProdSearch(""); setShowList(false);
      setSaleData({ id: t.id, productId: t.productId || "", productName: t.productName || "", qty: String(t.qty ?? ""), salePrice: String(t.price ?? ""), amount: String(t.amount ?? ""), costPrice: Number(t.costPrice || 0), oldQty: Number(t.qty || 0), date: toDateInput(t.date), origDate: toDateInput(t.date), noStock: !!t.noStock });
      setShowSaleModal(true);
    }
  };

  const handleDeleteTx = async (t: any) => {
    const msg = t.type === "Delivery"
      ? (t.noStock ? "এই পুরনো মাল দেওয়া ডিলিট করবেন? (স্টক বদলাবে না)" : "এই মাল দেওয়া ডিলিট করলে স্টক ফেরত আসবে। নিশ্চিত?")
      : "এই টাকার এন্ট্রি ডিলিট করবেন?";
    if (!window.confirm(msg)) return;
    try {
      if (t.type === "Delivery" && t.productId && !t.noStock) {
        await updateDoc(doc(db, "shop_inventories", t.productId), { stock: increment(Number(t.qty || 0)) });
      }
      await deleteDoc(doc(db, "buyer_orders", t.id));
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- PDF স্টেটমেন্ট ----------
  const handleShareStatement = async () => {
    if (txs.length === 0) return alert("ডেটা নেই!");
    const pdf = new jsPDF();
    const totalBill = sumBill(txs);
    const totalPaid = sumPaid(txs);

    // হেডার: গার্মেন্টস -> বায়ার -> মোট হিসাব
    pdf.setFontSize(18);
    pdf.text(`${selectedBuyer.companyName || "N/A"}`, 14, 16);
    pdf.setFontSize(12);
    pdf.text(`Buyer: ${selectedBuyer.name}`, 14, 24);
    pdf.setFontSize(10);
    pdf.text(`Total Bill: BDT ${totalBill}   |   Total Paid: BDT ${totalPaid}   |   Due: BDT ${totalBill - totalPaid}`, 14, 31);

    // প্রতিটা অর্ডার আলাদা ভাগে
    const sections = [...orders].reverse()
      .map(o => ({ title: `Order: ${o.orderNo}   |   Style: ${o.styleNo || "-"}`, list: txOfOrder(o), showOrder: false }))
      .filter(s => s.list.length > 0);
    if (orphanTx.length > 0) sections.push({ title: "Other entries", list: orphanTx, showOrder: true });

    let y = 40;
    sections.forEach(sec => {
      if (y > 250) { pdf.addPage(); y = 16; }
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(sec.title, 14, y);
      pdf.setFont("helvetica", "normal");

      const b = sumBill(sec.list);
      const p = sumPaid(sec.list);
      const rows = [...sec.list].sort((a, c) => new Date(a.date) - new Date(c.date)).map(t => {
        const dateStr = new Date(t.date).toLocaleDateString("en-GB");
        const orderTag = sec.showOrder ? `[${t.orderNo || t.orderNoRef || "-"}] ` : "";
        if (t.type === "Delivery") {
          return [dateStr, `${orderTag}${t.productName || ""}`, t.qty || "", t.price || "", t.amount || 0, ""];
        }
        return [dateStr, `${orderTag}Payment${t.details ? " - " + t.details : ""}`, "", "", "", t.amount || 0];
      });

      autoTable(pdf, {
        head: [['Date', 'Details', 'Qty', 'Rate', 'Bill', 'Paid']],
        body: rows,
        foot: [['', `Due: BDT ${b - p}`, '', '', b, p]],
        startY: y + 3,
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      });
      y = (pdf.lastAutoTable ? pdf.lastAutoTable.finalY : y + 20) + 10;
    });

    const fileName = `Statement_${selectedBuyer.companyName || ""}_${selectedBuyer.name}.pdf`;
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Buyer Statement' }); } catch (e) {}
    } else { pdf.save(fileName); }
  };

  const searchedProducts = products.filter(p => (p.productName || "").toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5);

  // একটা এন্ট্রির সারি (মাল দেওয়া / টাকা নেওয়া)
  const renderTx = (t: any, order: any) => (
    <div key={t.id} className="bg-white border rounded-lg p-2 flex justify-between items-start gap-2">
      <div className="min-w-0">
        <p className={`text-xs font-bold ${t.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>
          {t.type === "Payment" ? "টাকা জমা" : "মাল দেওয়া"} • {new Date(t.date).toLocaleDateString("en-GB")}{t.noStock && <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">পুরনো</span>}
        </p>
        <p className="text-xs text-gray-600 break-words">
          {t.type === "Delivery" ? `${t.productName} (${t.qty} pcs × ৳${t.price || 0})` : (t.details || "পেমেন্ট")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold ${t.type === 'Payment' ? 'text-green-600' : 'text-blue-600'}`}>৳{t.amount}</p>
        <div className="flex gap-1 justify-end mt-1">
          <button onClick={() => openEditTx(t, order)} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14} /></button>
          <button onClick={() => handleDeleteTx(t)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );

  // ================= বায়ারের পেজ =================
  if (selectedBuyer) {
    const totalBill = sumBill(txs);
    const totalPaid = sumPaid(txs);
    const due = totalBill - totalPaid;
    const payDue = activeOrderDue();

    return (
      <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedBuyer(null); setOpenOrderId(""); }} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{selectedBuyer.companyName}</h2>
              <p className="text-sm font-medium text-gray-600">{selectedBuyer.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setOrderForm({ id: "", orderNo: "", styleNo: "" }); setShowOrderModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1 flex-1 md:flex-none justify-center"><PlusCircle size={16} /> নতুন অর্ডার</button>
            <button onClick={handleShareStatement} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Share2 size={16} /> Statement</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white p-3 rounded-xl border-t-4 border-blue-500 text-center">
            <p className="text-xs text-gray-500">মোট বিল</p>
            <p className="font-bold text-blue-600 text-lg">৳{totalBill}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border-t-4 border-green-500 text-center">
            <p className="text-xs text-gray-500">মোট জমা</p>
            <p className="font-bold text-green-600 text-lg">৳{totalPaid}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border-t-4 border-red-500 text-center">
            <p className="text-xs text-gray-500">মোট বাকি</p>
            <p className="font-bold text-red-600 text-lg">৳{due}</p>
          </div>
        </div>

        {orders.length === 0 && orphanTx.length === 0 && (
          <p className="text-center py-8 text-gray-500">কোনো অর্ডার নেই। ওপরের সবুজ "নতুন অর্ডার" বাটনে চেপে অর্ডার তৈরি করুন।</p>
        )}

        {orders.map(order => {
          const list = txOfOrder(order);
          const b = sumBill(list);
          const p = sumPaid(list);
          const isOpen = openOrderId === order.id;
          return (
            <div key={order.id} className="bg-white rounded-xl border shadow-sm mb-3 overflow-hidden">
              <div className="p-3 flex justify-between items-start">
                <div>
                  <p className="font-bold text-brand-navy text-lg">অর্ডার: {order.orderNo}</p>
                  <p className="text-sm text-gray-600">স্টাইল: {order.styleNo || "-"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setOrderForm({ id: order.id, orderNo: order.orderNo, styleNo: order.styleNo || "" }); setShowOrderModal(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteOrderCard(order)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 px-3 pb-3 text-center">
                <div className="bg-blue-50 rounded-lg py-2"><p className="text-[11px] text-gray-500">বিল</p><p className="font-bold text-blue-600">৳{b}</p></div>
                <div className="bg-green-50 rounded-lg py-2"><p className="text-[11px] text-gray-500">জমা</p><p className="font-bold text-green-600">৳{p}</p></div>
                <div className="bg-red-50 rounded-lg py-2"><p className="text-[11px] text-gray-500">বাকি</p><p className="font-bold text-red-600">৳{b - p}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button onClick={() => openDelivery(order)} className="bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-1"><ShoppingBag size={18} /> মাল দিন</button>
                <button onClick={() => openPayment(order)} className="bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-1"><Wallet size={18} /> টাকা নিন</button>
              </div>

              <button onClick={() => setOpenOrderId(isOpen ? "" : order.id)} className="w-full border-t py-2 text-sm text-gray-600 flex items-center justify-center gap-1">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />} লেনদেন দেখুন ({list.length})
              </button>
              {isOpen && (
                <div className="bg-gray-50 p-3 space-y-2">
                  {list.length === 0 && <p className="text-center text-xs text-gray-500">এখনো কোনো লেনদেন নেই।</p>}
                  {list.map(t => renderTx(t, order))}
                </div>
              )}
            </div>
          );
        })}

        {orphanTx.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-300 shadow-sm mb-3 overflow-hidden">
            <div className="p-3">
              <p className="font-bold text-orange-600">অন্যান্য এন্ট্রি (কোনো অর্ডার কার্ডের সাথে মেলেনি)</p>
              <p className="text-xs text-gray-500">বিল ৳{sumBill(orphanTx)} | জমা ৳{sumPaid(orphanTx)} | বাকি ৳{sumBill(orphanTx) - sumPaid(orphanTx)}</p>
            </div>
            <div className="bg-gray-50 p-3 space-y-2">
              {orphanTx.map(t => renderTx(t, null))}
            </div>
          </div>
        )}

        {/* নতুন অর্ডার / অর্ডার এডিট */}
        {showOrderModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">{orderForm.id ? "অর্ডার এডিট" : "নতুন অর্ডার"}</h3>
              <form onSubmit={handleOrderSave} className="space-y-3">
                <div><label className="text-xs">অর্ডার নাম্বার</label><input required className="w-full border p-2 rounded" value={orderForm.orderNo} onChange={e => setOrderForm({ ...orderForm, orderNo: e.target.value })} placeholder="যেমন 4554" /></div>
                <div><label className="text-xs">স্টাইল নাম্বার</label><input required className="w-full border p-2 rounded" value={orderForm.styleNo} onChange={e => setOrderForm({ ...orderForm, styleNo: e.target.value })} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* মাল দেওয়া */}
        {showSaleModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-2">{isEditDelivery ? "মাল দেওয়া এডিট" : "মাল দিন"}</h3>
              <div className="bg-blue-50 text-blue-800 text-sm font-bold p-2 rounded mb-3">
                অর্ডার: {activeOrder?.orderNo} | স্টাইল: {activeOrder?.styleNo || "-"}
              </div>
              <form onSubmit={handleSaleSave} className="space-y-3">
                <div>
                  <label className="text-xs font-medium">তারিখ</label>
                  <input type="date" required max={todayStr()} className="w-full border p-2 rounded" value={saleData.date} onChange={e => setSaleData({ ...saleData, date: e.target.value })} />
                  {!isEditDelivery && isOldDate(saleData.date) && <p className="text-xs bg-yellow-100 text-yellow-800 p-2 rounded mt-1">এটা পুরনো তারিখ, তাই স্টক কমবে না।</p>}
                  {isEditDelivery && saleData.noStock && <p className="text-xs bg-yellow-100 text-yellow-800 p-2 rounded mt-1">এটা পুরনো এন্ট্রি, তাই স্টক বদলাবে না।</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">প্রোডাক্ট খুঁজুন</label>
                  {isEditDelivery ? (
                    <input readOnly className="w-full border p-2 rounded bg-gray-100 text-gray-600" value={saleData.productName} />
                  ) : (
                    <>
                      <input type="text" placeholder="নাম লিখুন..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => { setProdSearch(e.target.value); setShowList(true); setSaleData({ ...saleData, productId: "", productName: "" }); }} />
                      {showList && prodSearch && (
                        <div className="w-full max-h-52 overflow-y-auto border rounded bg-white">
                          {searchedProducts.map(p => (
                            <div key={p.id} onClick={() => { setSaleData({ ...saleData, productId: p.id, productName: p.productName, salePrice: p.salePrice ? String(p.salePrice) : "", costPrice: Number(p.costPrice || 0), amount: (p.salePrice && saleData.qty) ? String(Number(saleData.qty) * Number(p.salePrice)) : "" }); setProdSearch(p.productName); setShowList(false); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50 flex justify-between">
                              <div>
                                <p>{p.productName}</p>
                                {(p.size || p.color) && <p className="text-[10px] text-gray-400">{[p.size, p.color].filter(Boolean).join(" • ")}</p>}
                              </div>
                              <span className="text-gray-500 whitespace-nowrap ml-2">Stock: {Math.round(Number(p.stock || 0) * 100) / 100}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {saleData.productName && <p className="text-xs text-green-600 font-bold mt-1">Selected: {saleData.productName}</p>}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">পরিমাণ (Qty)</label><input required type="number" step="any" className="w-full border p-2 rounded" value={saleData.qty} onChange={e => setSaleData({ ...saleData, qty: e.target.value, amount: String(Number(e.target.value || 0) * Number(saleData.salePrice || 0)) })} /></div>
                  <div>
                    <label className="text-xs">বিক্রির দাম (৳)</label>
                    <input required type="number" step="any" placeholder="বিক্রির দাম" className="w-full border p-2 rounded" value={saleData.salePrice} onChange={e => setSaleData({ ...saleData, salePrice: e.target.value, amount: String(Number(saleData.qty || 0) * Number(e.target.value || 0)) })} />
                    {!isEditDelivery && saleData.productId && (
                      <p className={`text-[11px] mt-1 ${Number(saleData.salePrice) > 0 && Number(saleData.salePrice) < Number(saleData.costPrice) ? "text-red-600 font-bold" : "text-gray-500"}`}>
                        কেনা দাম: ৳{saleData.costPrice}{Number(saleData.salePrice) > 0 && Number(saleData.salePrice) < Number(saleData.costPrice) ? " — কেনা দামের চেয়ে কম, লস হবে!" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div><label className="text-xs">মোট টাকা (৳)</label><input required type="number" step="any" className="w-full border p-2 rounded font-bold text-blue-600 text-lg" value={saleData.amount} onChange={e => setSaleData({ ...saleData, amount: e.target.value })} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowSaleModal(false); setShowList(false); }} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* টাকা নেওয়া */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-2">{isEditPayment ? "টাকা জমা এডিট" : "টাকা নিন"}</h3>
              <div className="bg-green-50 text-green-800 text-sm font-bold p-2 rounded mb-3">
                অর্ডার: {activeOrder?.orderNo} | স্টাইল: {activeOrder?.styleNo || "-"}
                {payDue !== null && <p className="text-red-600 mt-1">এই অর্ডারের বাকি: ৳{payDue}</p>}
              </div>
              <form onSubmit={handlePaymentSave} className="space-y-3">
                <div><label className="text-xs font-medium">তারিখ</label><input type="date" required max={todayStr()} className="w-full border p-2 rounded" value={paymentData.date} onChange={e => setPaymentData({ ...paymentData, date: e.target.value })} /></div>
                <div><label className="text-xs">কত টাকা পেলেন (৳)</label><input required type="number" step="any" className="w-full border p-2 rounded text-lg font-bold text-green-600" value={paymentData.amount} onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })} /></div>
                <div><label className="text-xs">নোট (যেমন: নগদ, বিকাশ, চেক) - না লিখলেও চলবে</label><input className="w-full border p-2 rounded" value={paymentData.note} onChange={e => setPaymentData({ ...paymentData, note: e.target.value })} /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= বায়ার লিস্ট =================
  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Buyers ({shopParam || "All"})</h2>
        </div>
        <button onClick={() => { setBuyerFormData({ id: "", name: "", companyName: "", shop: shopParam }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <PlusCircle size={16} /> Add Buyer
        </button>
      </div>

      <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-sm mb-4">
        <Search size={16} className="text-gray-400" />
        <input type="text" placeholder="Search Buyer / Company..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {buyers.filter(b => ((b.name || "") + " " + (b.companyName || "")).toLowerCase().includes(searchTerm.toLowerCase())).map(buyer => (
          <div key={buyer.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition" onClick={() => setSelectedBuyer(buyer)}>
            <div>
              <p className="font-bold text-brand-navy">{buyer.companyName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Building size={12} /> {buyer.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setBuyerFormData(buyer); setShowBuyerModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16} /></button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteBuyer(buyer); }} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Company Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.companyName} onChange={e => setBuyerFormData({ ...buyerFormData, companyName: e.target.value })} /></div>
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({ ...buyerFormData, name: e.target.value })} /></div>
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
