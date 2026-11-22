// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit, Trash2, Share2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// খরচের ধরন (স্ক্রিনে বাংলা, PDF-এ ইংরেজি)
const CATEGORIES = { Rent: "ভাড়া", Salary: "বেতন", Utility: "বিদ্যুৎ/গ্যাস/পানি", Food: "নাস্তা/খাবার", Transport: "পরিবহন", Other: "অন্যান্য" };

const TYPE_INFO = {
  Expense: { label: "খরচ", color: "text-red-600", bg: "bg-red-50" },
  PaidOut: { label: "পেমেন্ট দিয়েছি", color: "text-orange-600", bg: "bg-orange-50" },
  Transfer: { label: "নিজস্ব ট্রান্সফার", color: "text-purple-600", bg: "bg-purple-50" },
  Purchase: { label: "মাল কেনা", color: "text-blue-600", bg: "bg-blue-50" },
};

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const todayStr = () => toDateInput(new Date().toISOString());
const dateToIso = (dateStr: string) => dateStr === todayStr() ? new Date().toISOString() : new Date(`${dateStr}T12:00:00`).toISOString();

const emptyForm = (type: string) => ({ id: "", type, category: "Other", title: "", note: "", amount: "", creditorId: "", date: todayStr(), origDate: "" });

function ShopStatementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shop, setShop] = useState(searchParams.get("shop") || "");

  const [statements, setStatements] = useState<any[]>([]);
  const [partyDocs, setPartyDocs] = useState<any[]>([]);

  const [mode, setMode] = useState("day");
  const [dayVal, setDayVal] = useState(todayStr());
  const [monthVal, setMonthVal] = useState(todayStr().slice(0, 7));

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<any>(emptyForm("Expense"));
  const [creditors, setCreditors] = useState<any[]>([]);

  useEffect(() => {
    setDayVal(todayStr());
    setMonthVal(todayStr().slice(0, 7));
    if (!shop) setShop(localStorage.getItem("activeShop") || "");
  }, []);

  useEffect(() => {
    if (!shop) return;
    const u1 = onSnapshot(query(collection(db, "shop_statements"), where("shop", "==", shop)), (snap) => {
      setStatements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "buyer_orders"), where("shop", "==", shop)), (snap) => {
      setPartyDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, [shop]);

  // দেনার খাতার নামগুলো (পাওনাদার/লোন), "পেমেন্ট দিলাম" ফর্মে বাছার জন্য
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "shop_statements"), where("type", "==", "Creditor")), (snap) => {
      setCreditors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ---------- হিসাব ----------
  const inPeriod = (iso: string) => {
    if (!iso) return false;
    const d = toDateInput(iso);
    return mode === "day" ? d === dayVal : d.slice(0, 7) === monthVal;
  };
  const sum = (list: any[]) => list.reduce((s, t) => s + Number(t.amount || 0), 0);
  const byType = (type: string) => statements.filter(s => s.type === type && inPeriod(s.date));

  const sales = byType("Sale");
  const expenses = byType("Expense");
  const paidOuts = byType("PaidOut");
  const transfers = byType("Transfer");
  const purchases = byType("Purchase");
  const partyPay = partyDocs.filter(t => t.type === "Payment" && inPeriod(t.date));
  const partyBill = partyDocs.filter(t => t.type === "Delivery" && inPeriod(t.date));

  const cashIn = sum(sales) + sum(partyPay);
  const cashOut = sum(expenses) + sum(paidOuts) + sum(transfers) + sum(purchases);
  const net = cashIn - cashOut;

  const entries = [...expenses, ...paidOuts, ...transfers, ...purchases].sort((a, b) => new Date(b.date) - new Date(a.date));

  const periodLabel = mode === "day"
    ? new Date(`${dayVal}T12:00:00`).toLocaleDateString("en-GB")
    : monthVal.split("-").reverse().join("/");

  // ---------- এন্ট্রি সেভ / এডিট / ডিলিট ----------
  const openNew = (type: string) => { setForm(emptyForm(type)); setIsEdit(false); setShowModal(true); };

  const openEdit = (st: any) => {
    setForm({ id: st.id, type: st.type, category: st.category || "Other", title: st.title || "", note: st.note || "", amount: String(st.amount ?? ""), creditorId: st.creditorId || "", date: toDateInput(st.date), origDate: toDateInput(st.date) });
    setIsEdit(true); setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return alert("টাকার পরিমাণ লিখুন!");
    if (!form.date) return alert("তারিখ দিন!");
    const title = form.title.trim();
    if (form.type === "PaidOut" && !title) return alert("কাকে দিলেন তা লিখুন!");
    if (form.type === "Transfer" && !title) return alert("কোন অ্যাকাউন্টে গেল তা লিখুন!");
    const data = { type: form.type, category: form.type === "Expense" ? form.category : "", title, note: form.note.trim(), amount, ...(form.type === "PaidOut" ? { creditorId: form.creditorId || "" } : {}) };
    try {
      if (isEdit) {
        await updateDoc(doc(db, "shop_statements", form.id), { ...data, ...(form.date !== form.origDate ? { date: dateToIso(form.date) } : {}) });
      } else {
        await addDoc(collection(db, "shop_statements"), { ...data, shop, date: dateToIso(form.date) });
      }
      setShowModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("এই এন্ট্রি ডিলিট করবেন?")) return;
    try { await deleteDoc(doc(db, "shop_statements", id)); } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const entryText = (st: any) => {
    if (st.type === "Expense") return `${CATEGORIES[st.category] || "খরচ"}${st.title ? " - " + st.title : ""}`;
    if (st.type === "PaidOut") return `কাকে: ${st.title}${st.note ? " (" + st.note + ")" : ""}`;
    if (st.type === "Transfer") return `অ্যাকাউন্ট: ${st.title}${st.note ? " (" + st.note + ")" : ""}`;
    return st.title || "";
  };

  // ---------- PDF ----------
  const handlePdf = async () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`${shop} - Accounts`, 14, 16);
    pdf.setFontSize(11);
    pdf.text(`${mode === "day" ? "Date" : "Month"}: ${periodLabel}`, 14, 23);

    const summaryRows = [
      ["Local Sales", sum(sales)],
      ["Party Payments Received", sum(partyPay)],
      ["Total Cash In", cashIn],
      ["Expenses", sum(expenses)],
      ["Payments Out (to people)", sum(paidOuts)],
      ["Transfers to Own Account", sum(transfers)],
      ...(sum(purchases) > 0 ? [["Purchases", sum(purchases)]] : []),
      ["Total Cash Out", cashOut],
      ["NET CASH", net],
      ["Party Sales Billed (credit, not cash)", sum(partyBill)],
    ];
    autoTable(pdf, { head: [["Summary", "Amount (BDT)"]], body: summaryRows, startY: 28, styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" } } });
    let y = pdf.lastAutoTable.finalY + 10;

    const byDate = (list: any[]) => [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

    const addSection = (title: string, head: string[], rows: any[][], total: number) => {
      if (rows.length === 0) return;
      if (y > 250) { pdf.addPage(); y = 16; }
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, 14, y);
      pdf.setFont("helvetica", "normal");
      const foot = head.map((_, i) => i === head.length - 2 ? "Total" : i === head.length - 1 ? total : "");
      autoTable(pdf, { head: [head], body: rows, foot: [foot], startY: y + 3, styles: { fontSize: 8 }, columnStyles: { [head.length - 1]: { halign: "right" } } });
      y = pdf.lastAutoTable.finalY + 10;
    };

    addSection("Local Sales", ["Date", "Product", "Qty", "Amount"], byDate(sales).map(s => [fmt(s.date), s.title || "", s.qty || "", s.amount || 0]), sum(sales));
    addSection("Party Payments Received", ["Date", "Buyer", "Order", "Amount"], byDate(partyPay).map(t => [fmt(t.date), t.buyerName || "", t.orderNoRef || "-", t.amount || 0]), sum(partyPay));
    addSection("Expenses", ["Date", "Category", "Details", "Amount"], byDate(expenses).map(s => [fmt(s.date), s.category || "-", s.title || "", s.amount || 0]), sum(expenses));
    addSection("Payments Out (to people)", ["Date", "Paid To", "Note", "Amount"], byDate(paidOuts).map(s => [fmt(s.date), s.title || "", s.note || "", s.amount || 0]), sum(paidOuts));
    addSection("Transfers to Own Account", ["Date", "Account", "Note", "Amount"], byDate(transfers).map(s => [fmt(s.date), s.title || "", s.note || "", s.amount || 0]), sum(transfers));
    addSection("Purchases", ["Date", "Details", "Note", "Amount"], byDate(purchases).map(s => [fmt(s.date), s.title || "", s.note || "", s.amount || 0]), sum(purchases));

    const fileName = `Accounts_${shop}_${mode === "day" ? dayVal : monthVal}.pdf`;
    const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Shop Accounts" }); } catch (e) {}
    } else { pdf.save(fileName); }
  };

  const typeLabel = TYPE_INFO[form.type]?.label || "এন্ট্রি";

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">দোকানের হিসাব</h2>
          <p className="text-xs text-gray-500">{shop || "দোকান বাছা হয়নি"}</p>
        </div>
      </div>

      {!shop && <p className="bg-yellow-100 text-yellow-800 p-3 rounded-lg text-sm mb-4">আগে দোকানের ড্যাশবোর্ড থেকে এই পেজে আসুন।</p>}

      {/* দিন / মাস বাছাই */}
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

      {/* এক নজরে হিসাব */}
      <div className="bg-white rounded-xl border mb-4 overflow-hidden">
        <p className="bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">{mode === "day" ? "দিনের" : "মাসের"} হিসাব: {periodLabel}</p>
        <div className="p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>লোকাল বিক্রি</span><b className="text-green-600">৳{sum(sales)}</b></div>
          <div className="flex justify-between"><span>পার্টির কাছ থেকে পাওয়া টাকা</span><b className="text-green-600">৳{sum(partyPay)}</b></div>
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট আয় (নগদ)</span><b className="text-green-700">৳{cashIn}</b></div>
          <div className="flex justify-between pt-2"><span>খরচ</span><b className="text-red-600">৳{sum(expenses)}</b></div>
          <div className="flex justify-between"><span>পেমেন্ট দিয়েছি (অন্যকে)</span><b className="text-orange-600">৳{sum(paidOuts)}</b></div>
          <div className="flex justify-between"><span>নিজস্ব অ্যাকাউন্টে ট্রান্সফার</span><b className="text-purple-600">৳{sum(transfers)}</b></div>
          {sum(purchases) > 0 && <div className="flex justify-between"><span>মাল কেনা</span><b className="text-blue-600">৳{sum(purchases)}</b></div>}
          <div className="flex justify-between border-t pt-1"><span className="font-bold">মোট বের হয়েছে</span><b className="text-red-700">৳{cashOut}</b></div>
        </div>
        <div className={`px-3 py-3 flex justify-between items-center ${net >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <span className="font-bold text-brand-navy">হাতে থাকা নিট নগদ</span>
          <span className={`text-xl font-bold ${net >= 0 ? "text-green-700" : "text-red-700"}`}>৳{net}</span>
        </div>
        <p className="px-3 py-2 text-xs text-gray-500 border-t">পার্টি সেলে বাকিতে মাল দেওয়া হয়েছে ৳{sum(partyBill)} (এটা নগদে ধরা হয়নি)</p>
      </div>

      {/* নতুন এন্ট্রি বাটন */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <button disabled={!shop} onClick={() => openNew("Expense")} className="bg-red-600 text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">+ খরচ</button>
        <button disabled={!shop} onClick={() => openNew("PaidOut")} className="bg-orange-500 text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">+ পেমেন্ট দিলাম</button>
        <button disabled={!shop} onClick={() => openNew("Transfer")} className="bg-purple-600 text-white py-3 rounded-lg text-sm font-bold disabled:opacity-50">+ নিজস্ব ট্রান্সফার</button>
      </div>
      <button onClick={handlePdf} className="w-full bg-brand-navy text-white py-2 rounded-lg text-sm mb-4 flex items-center justify-center gap-2"><Share2 size={16} /> হিসাবের PDF শেয়ার করুন</button>

      {/* খরচ / পেমেন্ট / ট্রান্সফারের তালিকা */}
      <h3 className="font-bold text-gray-700 mb-2">খরচ, পেমেন্ট ও ট্রান্সফার ({entries.length})</h3>
      <div className="space-y-2 mb-6">
        {entries.length === 0 && <p className="text-center text-sm text-gray-500 py-4">এই সময়ে কোনো এন্ট্রি নেই।</p>}
        {entries.map(st => {
          const info = TYPE_INFO[st.type] || TYPE_INFO.Expense;
          return (
            <div key={st.id} className="bg-white border rounded-lg p-3 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className={`text-xs font-bold ${info.color}`}>{info.label} • {new Date(st.date).toLocaleDateString("en-GB")}</p>
                <p className="text-sm text-gray-700 break-words">{entryText(st)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold ${info.color}`}>৳{st.amount}</p>
                <div className="flex gap-1 justify-end mt-1">
                  <button onClick={() => openEdit(st)} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(st.id)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* লোকাল বিক্রি (দেখার জন্য) */}
      <div className="bg-white border rounded-lg p-3 mb-3 flex justify-between items-center">
        <div>
          <p className="text-sm font-bold text-green-700">লোকাল বিক্রি ({sales.length} টি)</p>
          <p className="text-xs text-gray-500">মোট ৳{sum(sales)}। এডিট বা ডিলিট করতে Sales History-তে যান।</p>
        </div>
        <button onClick={() => router.push(`/sales?shop=${shop}`)} className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold">দেখুন</button>
      </div>

      {/* পার্টির কাছ থেকে পাওয়া টাকা (দেখার জন্য) */}
      <div className="bg-white border rounded-lg p-3">
        <p className="text-sm font-bold text-green-700 mb-1">পার্টির কাছ থেকে পাওয়া টাকা ({partyPay.length} টি)</p>
        <p className="text-xs text-gray-500 mb-2">এডিট বা ডিলিট করতে Buyers পেজে যান।</p>
        {partyPay.length === 0 && <p className="text-xs text-gray-400">এই সময়ে কিছু পাওয়া যায়নি।</p>}
        {[...partyPay].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
          <div key={t.id} className="flex justify-between text-sm border-t py-1">
            <span className="text-gray-700">{t.buyerName} {t.orderNoRef ? `(অর্ডার ${t.orderNoRef})` : ""}</span>
            <b className="text-green-600">৳{t.amount}</b>
          </div>
        ))}
      </div>

      {/* এন্ট্রি ফর্ম */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{isEdit ? `${typeLabel} এডিট` : `নতুন ${typeLabel}`}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="text-xs font-medium">তারিখ</label><input type="date" required max={todayStr()} className="w-full border p-2 rounded" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>

              {form.type === "Expense" && (
                <>
                  <div>
                    <label className="text-xs font-medium">খরচের ধরন</label>
                    <select className="w-full border p-2 rounded" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {Object.keys(CATEGORIES).map(k => <option key={k} value={k}>{CATEGORIES[k]}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-medium">বিবরণ (না লিখলেও চলবে)</label><input className="w-full border p-2 rounded" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                </>
              )}

              {form.type === "PaidOut" && (
                <>
                  {creditors.length > 0 && (
                    <div>
                      <label className="text-xs font-medium">দেনার খাতার কাউকে শোধ করছেন? (না হলে ফাঁকা রাখুন)</label>
                      <select className="w-full border p-2 rounded" value={form.creditorId} onChange={e => { const c = creditors.find(x => x.id === e.target.value); setForm({ ...form, creditorId: e.target.value, title: c ? c.name : form.title }); }}>
                        <option value="">-- না, অন্য কাউকে দিলাম --</option>
                        {creditors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {form.creditorId && <p className="text-[11px] text-green-700 mt-1">এর দেনা নিজে থেকে কমে যাবে।</p>}
                    </div>
                  )}
                  <div><label className="text-xs font-medium">কাকে দিলেন (নাম)</label><input required readOnly={!!form.creditorId} className={`w-full border p-2 rounded ${form.creditorId ? "bg-gray-100 text-gray-600" : ""}`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                  <div><label className="text-xs font-medium">কী বাবদ (না লিখলেও চলবে)</label><input className="w-full border p-2 rounded" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                </>
              )}

              {form.type === "Transfer" && (
                <>
                  <div><label className="text-xs font-medium">কোন অ্যাকাউন্টে (যেমন: বিকাশ, ব্যাংক, মালিকের নাম)</label><input required className="w-full border p-2 rounded" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                  <div><label className="text-xs font-medium">নোট (না লিখলেও চলবে)</label><input className="w-full border p-2 rounded" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                </>
              )}

              {form.type === "Purchase" && (
                <div><label className="text-xs font-medium">বিবরণ</label><input className="w-full border p-2 rounded" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              )}

              <div><label className="text-xs font-medium">টাকা (৳)</label><input required type="number" step="any" className="w-full border p-2 rounded text-lg font-bold" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopStatementPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <ShopStatementContent />
    </Suspense>
  );
}
