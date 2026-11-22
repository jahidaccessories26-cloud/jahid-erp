// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, where, doc, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Edit, Trash2, ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// দেনার খাতার এন্ট্রি এই নামে জমা থাকে (কোনো দোকানের নয়)
const COMPANY = "__company";
const KINDS = { Supplier: "মহাজন / সরবরাহকারী", Loan: "লোন", Other: "অন্যান্য" };

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const todayStr = () => toDateInput(new Date().toISOString());
const dateToIso = (dateStr: string) => dateStr === todayStr() ? new Date().toISOString() : new Date(`${dateStr}T12:00:00`).toISOString();
const money = (n: any) => "৳" + (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-IN");
const sum = (list: any[]) => list.reduce((s, t) => s + Number(t.amount || 0), 0);

export default function DailyReportPage() {
  const router = useRouter();
  const [role, setRole] = useState("loading");

  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shopInv, setShopInv] = useState<any[]>([]);
  const [partyAll, setPartyAll] = useState<any[]>([]);
  const [debtDocs, setDebtDocs] = useState<any[]>([]);
  const [periodStatements, setPeriodStatements] = useState<any[]>([]);

  const [mode, setMode] = useState("day");
  const [dayVal, setDayVal] = useState(todayStr());
  const [monthVal, setMonthVal] = useState(todayStr().slice(0, 7));

  const [showBuyerDues, setShowBuyerDues] = useState(false);
  const [openCreditor, setOpenCreditor] = useState("");
  const [modal, setModal] = useState("");
  const [form, setForm] = useState<any>({});

  // শুধু অ্যাডমিন দেখতে পারবে
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user || !user.email) return;
      if (user.email === "admin@jahid.com") { setRole("admin"); return; }
      try {
        const snap = await getDoc(doc(db, "users", user.email));
        setRole(snap.exists() && snap.data().role === "admin" ? "admin" : "other");
      } catch (e) { setRole("other"); }
    });
    return () => unsub();
  }, []);

  useEffect(() => { setDayVal(todayStr()); setMonthVal(todayStr().slice(0, 7)); }, []);

  const getRange = () => {
    if (mode === "day") {
      return [new Date(`${dayVal}T00:00:00`).toISOString(), new Date(`${dayVal}T23:59:59.999`).toISOString()];
    }
    const [y, m] = monthVal.split("-").map(Number);
    return [new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString(), new Date(y, m, 0, 23, 59, 59, 999).toISOString()];
  };
  const [rangeStart, rangeEnd] = getRange();

  // সবসময়ের ডেটা (মালের দাম, পাওনা, দেনা)
  useEffect(() => {
    if (role !== "admin") return;
    const subs = [
      onSnapshot(query(collection(db, "shops")), s => setShops(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "products")), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "shop_inventories")), s => setShopInv(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "buyer_orders"), where("type", "in", ["Delivery", "Payment"])), s => setPartyAll(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "shop_statements"), where("type", "in", ["Creditor", "DebtAdd", "PaidOut"])), s => setDebtDocs(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => subs.forEach(u => u());
  }, [role]);

  // নির্বাচিত দিন বা মাসের দোকানের হিসাব
  useEffect(() => {
    if (role !== "admin") return;
    const unsub = onSnapshot(query(collection(db, "shop_statements"), where("date", ">=", rangeStart), where("date", "<=", rangeEnd)), s => {
      setPeriodStatements(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [role, mode, dayVal, monthVal]);

  if (role === "loading") return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (role !== "admin") return <div className="text-center py-20 text-red-600 font-bold">এই পেজ শুধু অ্যাডমিন দেখতে পারবেন।</div>;

  // ---------- লাভ-লস ও নগদ হিসাব ----------
  const periodParty = partyAll.filter(t => t.date >= rangeStart && t.date <= rangeEnd);
  const invCost: any = {};
  shopInv.forEach(i => { invCost[i.id] = Number(i.costPrice || 0); });
  const unitCost = (t: any) => {
    if (t.costPrice !== undefined && t.costPrice !== null) return Number(t.costPrice);
    if (t.productId && invCost[t.productId] !== undefined) return invCost[t.productId];
    return null;
  };

  const shopKeys = Array.from(new Set([
    ...shops.map(s => s.name),
    ...periodStatements.filter(s => ["Sale", "Expense", "PaidOut", "Transfer", "Purchase"].includes(s.type)).map(s => s.shop || ""),
    ...periodParty.map(t => t.shop || ""),
  ])).filter(k => k !== COMPANY);

  const calc = (key: string) => {
    const sel = (arr: any[], type: string) => arr.filter(x => x.type === type && (x.shop || "") === key);
    const sales = sel(periodStatements, "Sale");
    const deliveries = sel(periodParty, "Delivery");
    const payments = sel(periodParty, "Payment");
    const expenses = sel(periodStatements, "Expense");
    const paidOuts = sel(periodStatements, "PaidOut");
    const transfers = sel(periodStatements, "Transfer");
    const purchases = sel(periodStatements, "Purchase");
    let unknown = 0;
    const cogs = [...sales, ...deliveries].reduce((s, t) => {
      const c = unitCost(t);
      if (c === null) { unknown++; return s; }
      return s + c * Number(t.qty || 0);
    }, 0);
    const revenue = sum(sales) + sum(deliveries);
    return {
      key, localSales: sum(sales), partyBill: sum(deliveries), partyPaid: sum(payments), revenue, cogs,
      expense: sum(expenses), paidOut: sum(paidOuts), transfer: sum(transfers), purchase: sum(purchases),
      profit: revenue - cogs - sum(expenses),
      cashIn: sum(sales) + sum(payments),
      cashOut: sum(expenses) + sum(paidOuts) + sum(transfers) + sum(purchases),
      unknown,
    };
  };
  const rows = shopKeys.map(calc).map(r => ({ ...r, net: r.cashIn - r.cashOut }));
  const T: any = {};
  rows.forEach(r => Object.keys(r).forEach(k => { if (k !== "key") T[k] = (T[k] || 0) + r[k]; }));
  const t = (k: string) => Number(T[k] || 0);

  // ---------- মোট অবস্থা ----------
  let warehouseValue = 0;
  products.forEach(p => (p.variations || []).forEach((v: any) => { warehouseValue += Number(v.stock || 0) * Number(v.costPrice || 0); }));
  const shopValues: any = {};
  shopInv.forEach(i => { shopValues[i.shop || ""] = (shopValues[i.shop || ""] || 0) + Number(i.stock || 0) * Number(i.costPrice || 0); });
  const shopValueTotal = Object.keys(shopValues).reduce((s, k) => s + shopValues[k], 0);
  const stockTotal = warehouseValue + shopValueTotal;

  const buyerMap: any = {};
  partyAll.forEach(x => {
    const id = x.buyerId || x.buyerName || "?";
    if (!buyerMap[id]) buyerMap[id] = { name: "", bill: 0, paid: 0 };
    if (x.type === "Delivery") { buyerMap[id].bill += Number(x.amount || 0); buyerMap[id].name = x.companyName ? `${x.companyName} (${x.buyerName || ""})` : (x.buyerName || buyerMap[id].name); }
    else { buyerMap[id].paid += Number(x.amount || 0); if (!buyerMap[id].name) buyerMap[id].name = x.buyerName || ""; }
  });
  const buyerDues = Object.keys(buyerMap).map(k => ({ ...buyerMap[k], due: buyerMap[k].bill - buyerMap[k].paid })).filter(b => b.due > 0.0001).sort((a, b) => b.due - a.due);
  const receivable = buyerDues.reduce((s, b) => s + b.due, 0);

  const creditors = debtDocs.filter(d => d.type === "Creditor");
  const creditorInfo = creditors.map(c => {
    const adds = debtDocs.filter(d => d.type === "DebtAdd" && d.creditorId === c.id);
    const pays = debtDocs.filter(d => d.type === "PaidOut" && d.creditorId === c.id);
    const entries = [...adds, ...pays].sort((a, b) => new Date(b.date) - new Date(a.date));
    return { ...c, entries, balance: sum(adds) - sum(pays) };
  }).sort((a, b) => b.balance - a.balance);
  const totalDebt = creditorInfo.reduce((s, c) => s + c.balance, 0);
  const netPosition = stockTotal + receivable - totalDebt;

  const periodLabel = mode === "day" ? new Date(`${dayVal}T12:00:00`).toLocaleDateString("en-GB") : monthVal.split("-").reverse().join("/");

  // ---------- দেনার খাতা: সেভ / ডিলিট ----------
  const openModal = (name: string, data: any) => { setForm(data); setModal(name); };

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount || 0);
    try {
      if (modal === "creditor") {
        const name = (form.name || "").trim();
        if (!name) return alert("নাম লিখুন!");
        if (creditors.some(c => c.name === name && c.id !== form.id)) return alert("এই নাম আগে থেকেই আছে!");
        if (form.id) {
          await updateDoc(doc(db, "shop_statements", form.id), { name, kind: form.kind });
          await Promise.all(debtDocs.filter(d => d.type === "PaidOut" && d.creditorId === form.id).map(d => updateDoc(doc(db, "shop_statements", d.id), { title: name })));
        } else {
          const ref = await addDoc(collection(db, "shop_statements"), { shop: COMPANY, type: "Creditor", name, kind: form.kind, amount: 0, date: new Date().toISOString() });
          if (Number(form.opening) > 0) {
            await addDoc(collection(db, "shop_statements"), { shop: COMPANY, type: "DebtAdd", creditorId: ref.id, amount: Number(form.opening), note: "আগের বাকি", date: new Date().toISOString() });
          }
        }
      } else if (modal === "debt") {
        if (!(amount > 0)) return alert("টাকার পরিমাণ লিখুন!");
        await addDoc(collection(db, "shop_statements"), { shop: COMPANY, type: "DebtAdd", creditorId: form.creditorId, amount, note: (form.note || "").trim(), date: dateToIso(form.date) });
      } else if (modal === "pay") {
        if (!(amount > 0)) return alert("টাকার পরিমাণ লিখুন!");
        if (!form.shop) return alert("কোন দোকান থেকে দিলেন তা বাছুন!");
        await addDoc(collection(db, "shop_statements"), { shop: form.shop, type: "PaidOut", category: "", title: form.creditorName, note: (form.note || "").trim(), amount, creditorId: form.creditorId, date: dateToIso(form.date) });
      } else if (modal === "edit") {
        if (!(amount > 0)) return alert("টাকার পরিমাণ লিখুন!");
        await updateDoc(doc(db, "shop_statements", form.id), { amount, note: (form.note || "").trim(), ...(form.date !== form.origDate ? { date: dateToIso(form.date) } : {}) });
      }
      setModal(""); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const deleteEntry = async (entry: any) => {
    const msg = entry.type === "PaidOut" ? "এই শোধ ডিলিট করলে দোকানের হিসাব থেকেও মুছে যাবে। নিশ্চিত?" : "এই এন্ট্রি ডিলিট করবেন?";
    if (!window.confirm(msg)) return;
    try { await deleteDoc(doc(db, "shop_statements", entry.id)); } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const deleteCreditor = async (c: any) => {
    if (c.entries.length > 0) return alert("এই নামে এন্ট্রি আছে। আগে সেগুলো ডিলিট করুন।");
    if (!window.confirm("এই নাম ডিলিট করবেন?")) return;
    try { await deleteDoc(doc(db, "shop_statements", c.id)); } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ---------- PDF ----------
  const handlePdf = async () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text("Jahid Accessories - Daily Report", 14, 16);
    pdf.setFontSize(11);
    pdf.text(`${mode === "day" ? "Date" : "Month"}: ${periodLabel}`, 14, 23);

    autoTable(pdf, {
      head: [["Profit / Loss", "Amount (BDT)"]],
      body: [
        ["Local Sales", t("localSales")], ["Party Sales (billed)", t("partyBill")], ["Total Sales", t("revenue")],
        ["Cost of goods sold", t("cogs")], ["Expenses", t("expense")], ["PROFIT / LOSS", t("profit")],
      ],
      startY: 28, styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" } },
    });
    autoTable(pdf, {
      head: [["Cash", "Amount (BDT)"]],
      body: [
        ["Local Sales", t("localSales")], ["Party Payments Received", t("partyPaid")], ["Total Cash In", t("cashIn")],
        ["Expenses", t("expense")], ["Payments Out (to people)", t("paidOut")], ["Transfers to Own Account", t("transfer")],
        ...(t("purchase") > 0 ? [["Purchases", t("purchase")]] : []),
        ["Total Cash Out", t("cashOut")], ["NET CASH", t("cashIn") - t("cashOut")],
      ],
      startY: pdf.lastAutoTable.finalY + 8, styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" } },
    });
    autoTable(pdf, {
      head: [["Shop", "Local", "Party Bill", "Expense", "Profit", "Net Cash"]],
      body: rows.map(r => [r.key || "-", r.localSales, r.partyBill, r.expense, Math.round(r.profit * 100) / 100, r.net]),
      startY: pdf.lastAutoTable.finalY + 8, styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    autoTable(pdf, {
      head: [["Overall Position (today)", "Amount (BDT)"]],
      body: [
        ["Warehouse Stock Value", Math.round(warehouseValue)], ["Shops Stock Value", Math.round(shopValueTotal)], ["Total Stock Value", Math.round(stockTotal)],
        ["Receivable from Parties", Math.round(receivable)], ["My Total Debt / Loan", Math.round(totalDebt)],
        ["Stock + Receivable - Debt (excl. cash)", Math.round(netPosition)],
      ],
      startY: pdf.lastAutoTable.finalY + 8, styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" } },
    });
    if (creditorInfo.length > 0) {
      autoTable(pdf, {
        head: [["I Owe To", "Type", "Balance (BDT)"]],
        body: creditorInfo.map(c => [c.name, c.kind || "-", Math.round(c.balance)]),
        startY: pdf.lastAutoTable.finalY + 8, styles: { fontSize: 8 }, columnStyles: { 2: { halign: "right" } },
      });
    }
    if (buyerDues.length > 0) {
      autoTable(pdf, {
        head: [["Party Due", "Amount (BDT)"]],
        body: buyerDues.slice(0, 30).map(b => [b.name, Math.round(b.due)]),
        startY: pdf.lastAutoTable.finalY + 8, styles: { fontSize: 8 }, columnStyles: { 1: { halign: "right" } },
      });
    }

    const fileName = `Daily_Report_${mode === "day" ? dayVal : monthVal}.pdf`;
    const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Daily Report" }); } catch (e) {}
    } else { pdf.save(fileName); }
  };

  const modalTitle = modal === "creditor" ? (form.id ? "নাম এডিট" : "নতুন পাওনাদার / লোন") : modal === "debt" ? `${form.creditorName} — দেনা বাড়ল` : modal === "pay" ? `${form.creditorName} — শোধ করলাম` : "এন্ট্রি এডিট";

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">দৈনিক মোট হিসাব</h2>
      </div>

      {/* দিন / মাস */}
      <div className="bg-white p-3 rounded-xl border mb-4">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={() => setMode("day")} className={`py-2 rounded-lg text-sm font-bold ${mode === "day" ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600"}`}>দিনের হিসাব</button>
          <button onClick={() => setMode("month")} className={`py-2 rounded-lg text-sm font-bold ${mode === "month" ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600"}`}>মাসের হিসাব</button>
        </div>
        <div className="flex gap-2">
          {mode === "day"
            ? <input type="date" max={todayStr()} className="flex-1 border p-2 rounded" value={dayVal} onChange={e => e.target.value && setDayVal(e.target.value)} />
            : <input type="month" max={todayStr().slice(0, 7)} className="flex-1 border p-2 rounded" value={monthVal} onChange={e => e.target.value && setMonthVal(e.target.value)} />}
          <button onClick={() => { setDayVal(todayStr()); setMonthVal(todayStr().slice(0, 7)); }} className="px-3 py-2 border rounded text-sm">আজ</button>
        </div>
      </div>

      <button onClick={handlePdf} className="w-full bg-brand-navy text-white py-2 rounded-lg text-sm mb-4 flex items-center justify-center gap-2"><Share2 size={16} /> রিপোর্টের PDF শেয়ার করুন</button>

      {/* লাভ-লস */}
      <div className="bg-white rounded-xl border mb-4 overflow-hidden">
        <p className="bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">লাভ-লস: {periodLabel}</p>
        <div className="p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>লোকাল বিক্রি</span><b className="text-green-600">{money(t("localSales"))}</b></div>
          <div className="flex justify-between"><span>পার্টি সেল (বিল)</span><b className="text-green-600">{money(t("partyBill"))}</b></div>
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট বিক্রি</span><b>{money(t("revenue"))}</b></div>
          <div className="flex justify-between pt-1"><span>বিক্রি হওয়া মালের কেনা দাম</span><b className="text-orange-600">− {money(t("cogs"))}</b></div>
          <div className="flex justify-between"><span>খরচ</span><b className="text-red-600">− {money(t("expense"))}</b></div>
        </div>
        <div className={`px-3 py-3 flex justify-between items-center ${t("profit") >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <span className="font-bold text-brand-navy">{t("profit") >= 0 ? "লাভ" : "লস"}</span>
          <span className={`text-xl font-bold ${t("profit") >= 0 ? "text-green-700" : "text-red-700"}`}>{money(Math.abs(t("profit")))}</span>
        </div>
        {t("unknown") > 0 && <p className="px-3 py-2 text-xs bg-yellow-100 text-yellow-800">{t("unknown")} টি বিক্রির কেনা দাম জানা নেই, ওগুলো হিসাবে ধরা হয়নি।</p>}
        <p className="px-3 py-2 text-xs text-gray-500 border-t">পেমেন্ট দেওয়া, নিজস্ব ট্রান্সফার ও দেনা শোধ লাভ-লস কমায় না, এগুলো শুধু নগদ কমায়।</p>
      </div>

      {/* নগদ হিসাব */}
      <div className="bg-white rounded-xl border mb-4 overflow-hidden">
        <p className="bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">নগদ হিসাব</p>
        <div className="p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>লোকাল বিক্রি</span><b className="text-green-600">{money(t("localSales"))}</b></div>
          <div className="flex justify-between"><span>পার্টির কাছ থেকে পাওয়া</span><b className="text-green-600">{money(t("partyPaid"))}</b></div>
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট আয়</span><b className="text-green-700">{money(t("cashIn"))}</b></div>
          <div className="flex justify-between pt-1"><span>খরচ</span><b className="text-red-600">{money(t("expense"))}</b></div>
          <div className="flex justify-between"><span>পেমেন্ট দিয়েছি (দেনা শোধসহ)</span><b className="text-orange-600">{money(t("paidOut"))}</b></div>
          <div className="flex justify-between"><span>নিজস্ব অ্যাকাউন্টে ট্রান্সফার</span><b className="text-purple-600">{money(t("transfer"))}</b></div>
          {t("purchase") > 0 && <div className="flex justify-between"><span>মাল কেনা</span><b className="text-blue-600">{money(t("purchase"))}</b></div>}
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট বের হয়েছে</span><b className="text-red-700">{money(t("cashOut"))}</b></div>
        </div>
        <div className={`px-3 py-3 flex justify-between items-center ${t("cashIn") - t("cashOut") >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <span className="font-bold text-brand-navy">নিট নগদ</span>
          <span className={`text-xl font-bold ${t("cashIn") - t("cashOut") >= 0 ? "text-green-700" : "text-red-700"}`}>{money(t("cashIn") - t("cashOut"))}</span>
        </div>
      </div>

      {/* দোকান অনুযায়ী */}
      <h3 className="font-bold text-gray-700 mb-2">দোকান অনুযায়ী</h3>
      <div className="space-y-2 mb-4">
        {rows.length === 0 && <p className="text-sm text-gray-500">কোনো দোকান পাওয়া যায়নি।</p>}
        {rows.map(r => (
          <div key={r.key} className="bg-white border rounded-lg p-3">
            <p className="font-bold text-brand-navy mb-1">{r.key || "(দোকান বাছা হয়নি)"}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span>লোকাল বিক্রি</span><b>{money(r.localSales)}</b></div>
              <div className="flex justify-between"><span>পার্টি বিল</span><b>{money(r.partyBill)}</b></div>
              <div className="flex justify-between"><span>খরচ</span><b className="text-red-600">{money(r.expense)}</b></div>
              <div className="flex justify-between"><span>{r.profit >= 0 ? "লাভ" : "লস"}</span><b className={r.profit >= 0 ? "text-green-600" : "text-red-600"}>{money(Math.abs(r.profit))}</b></div>
              <div className="flex justify-between col-span-2 border-t pt-1"><span>নিট নগদ</span><b className={r.net >= 0 ? "text-green-700" : "text-red-700"}>{money(r.net)}</b></div>
            </div>
          </div>
        ))}
      </div>

      {/* মোট অবস্থা */}
      <div className="bg-white rounded-xl border mb-4 overflow-hidden">
        <p className="bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">এখনকার মোট অবস্থা</p>
        <div className="p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>ওয়্যারহাউসের মালের দাম</span><b>{money(warehouseValue)}</b></div>
          {Object.keys(shopValues).map(k => <div key={k} className="flex justify-between"><span>{k || "(দোকান বাছা হয়নি)"} — মালের দাম</span><b>{money(shopValues[k])}</b></div>)}
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট মালের দাম</span><b className="text-brand-navy">{money(stockTotal)}</b></div>
          <div className="flex justify-between pt-2"><span>পার্টির কাছে মোট পাওনা</span><b className="text-green-600">{money(receivable)}</b></div>
          <div className="flex justify-between"><span>আমার মোট দেনা / লোন</span><b className="text-red-600">{money(totalDebt)}</b></div>
        </div>
        <div className="px-3 py-3 bg-blue-50 flex justify-between items-center">
          <span className="font-bold text-brand-navy text-sm">মাল + পাওনা − দেনা<br /><span className="text-[10px] font-normal text-gray-500">(হাতে থাকা নগদ টাকা বাদে)</span></span>
          <span className={`text-xl font-bold ${netPosition >= 0 ? "text-brand-navy" : "text-red-700"}`}>{money(netPosition)}</span>
        </div>
      </div>

      {/* পার্টির পাওনা */}
      <div className="bg-white rounded-xl border mb-4">
        <button onClick={() => setShowBuyerDues(!showBuyerDues)} className="w-full p-3 flex justify-between items-center">
          <span className="font-bold text-green-700 text-sm">কার কাছে কত পাওনা ({buyerDues.length} জন)</span>
          {showBuyerDues ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showBuyerDues && (
          <div className="px-3 pb-3">
            {buyerDues.length === 0 && <p className="text-xs text-gray-500">কারো কাছে বাকি নেই।</p>}
            {buyerDues.map((b, i) => <div key={i} className="flex justify-between text-sm border-t py-1"><span className="text-gray-700">{b.name}</span><b className="text-green-600">{money(b.due)}</b></div>)}
          </div>
        )}
      </div>

      {/* দেনার খাতা */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-700">দেনার খাতা (আমি কাকে কত দেব)</h3>
        <button onClick={() => openModal("creditor", { id: "", name: "", kind: "Supplier", opening: "" })} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><PlusCircle size={14} /> নতুন নাম</button>
      </div>
      {creditorInfo.length === 0 && <p className="text-sm text-gray-500 mb-4">এখনো কোনো পাওনাদার বা লোন যোগ করা হয়নি।</p>}
      <div className="space-y-2 mb-6">
        {creditorInfo.map(c => {
          const isOpen = openCreditor === c.id;
          return (
            <div key={c.id} className="bg-white border rounded-lg overflow-hidden">
              <div className="p-3 flex justify-between items-start">
                <div>
                  <p className="font-bold text-brand-navy">{c.name}</p>
                  <p className="text-xs text-gray-500">{KINDS[c.kind] || "অন্যান্য"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-500">বাকি</p>
                  <p className={`font-bold text-lg ${c.balance > 0 ? "text-red-600" : "text-green-600"}`}>{money(c.balance)}</p>
                  <div className="flex gap-1 justify-end mt-1">
                    <button onClick={() => openModal("creditor", { id: c.id, name: c.name, kind: c.kind || "Supplier", opening: "" })} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={13} /></button>
                    <button onClick={() => deleteCreditor(c)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button onClick={() => openModal("debt", { creditorId: c.id, creditorName: c.name, date: todayStr(), amount: "", note: "" })} className="bg-orange-500 text-white py-2 rounded-lg text-sm font-bold">+ দেনা বাড়ল</button>
                <button onClick={() => openModal("pay", { creditorId: c.id, creditorName: c.name, date: todayStr(), amount: "", note: "", shop: shops[0]?.name || "" })} className="bg-green-600 text-white py-2 rounded-lg text-sm font-bold">শোধ করলাম</button>
              </div>
              <button onClick={() => setOpenCreditor(isOpen ? "" : c.id)} className="w-full border-t py-2 text-xs text-gray-600 flex items-center justify-center gap-1">
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} হিসাব দেখুন ({c.entries.length})
              </button>
              {isOpen && (
                <div className="bg-gray-50 p-3 space-y-2">
                  {c.entries.length === 0 && <p className="text-xs text-gray-500 text-center">কোনো এন্ট্রি নেই।</p>}
                  {c.entries.map(en => (
                    <div key={en.id} className="bg-white border rounded p-2 flex justify-between items-start gap-2">
                      <div>
                        <p className={`text-xs font-bold ${en.type === "PaidOut" ? "text-green-600" : "text-red-600"}`}>{en.type === "PaidOut" ? `শোধ (${en.shop})` : "দেনা বাড়ল"} • {new Date(en.date).toLocaleDateString("en-GB")}</p>
                        {en.note && <p className="text-xs text-gray-600">{en.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold ${en.type === "PaidOut" ? "text-green-600" : "text-red-600"}`}>{money(en.amount)}</p>
                        <div className="flex gap-1 justify-end mt-1">
                          <button onClick={() => openModal("edit", { id: en.id, type: en.type, shop: en.shop, amount: String(en.amount ?? ""), note: en.note || "", date: toDateInput(en.date), origDate: toDateInput(en.date) })} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={13} /></button>
                          <button onClick={() => deleteEntry(en)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ফর্ম */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{modalTitle}</h3>
            <form onSubmit={handleModalSave} className="space-y-3">
              {modal === "creditor" && (
                <>
                  <div><label className="text-xs font-medium">নাম (কাকে দেব)</label><input required className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div>
                    <label className="text-xs font-medium">ধরন</label>
                    <select className="w-full border p-2 rounded" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                      {Object.keys(KINDS).map(k => <option key={k} value={k}>{KINDS[k]}</option>)}
                    </select>
                  </div>
                  {!form.id && <div><label className="text-xs font-medium">এখন পর্যন্ত কত বাকি (৳) - না থাকলে ফাঁকা রাখুন</label><input type="number" step="any" className="w-full border p-2 rounded" value={form.opening} onChange={e => setForm({ ...form, opening: e.target.value })} /></div>}
                </>
              )}

              {(modal === "debt" || modal === "pay" || modal === "edit") && (
                <>
                  <div><label className="text-xs font-medium">তারিখ</label><input type="date" required max={todayStr()} className="w-full border p-2 rounded" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                  {modal === "pay" && (
                    <div>
                      <label className="text-xs font-medium">কোন দোকান থেকে দিলেন</label>
                      <select className="w-full border p-2 rounded" value={form.shop} onChange={e => setForm({ ...form, shop: e.target.value })}>
                        {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {modal === "edit" && form.type === "PaidOut" && <p className="text-xs text-gray-500">দোকান: {form.shop}</p>}
                  <div><label className="text-xs font-medium">টাকা (৳)</label><input required type="number" step="any" className="w-full border p-2 rounded text-lg font-bold" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                  <div><label className="text-xs font-medium">নোট (না লিখলেও চলবে)</label><input className="w-full border p-2 rounded" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal("")} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
