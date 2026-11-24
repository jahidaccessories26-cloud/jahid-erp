// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, where, doc, getDoc, runTransaction, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Factory, Edit, Trash2, ChevronDown, ChevronUp, PlusCircle } from "lucide-react";

// কেনা ও অর্ডারের এন্ট্রি এই নামে জমা থাকে (কোনো দোকানের নয়)
const COMPANY = "__company";
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: any) => "৳" + (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-IN");

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const todayStr = () => toDateInput(new Date().toISOString());
const dateToIso = (dateStr: string) => dateStr === todayStr() ? new Date().toISOString() : new Date(`${dateStr}T12:00:00`).toISOString();

const emptyItem = () => ({ name: "", category: "", size: "", color: "", qty: "", costPrice: "" });
const keyOf = (i: any) => [i.name, i.category, i.size, i.color].map(x => String(x || "").trim().toLowerCase()).join("|");
const sumTotal = (items: any[]) => items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.costPrice || 0), 0);

// ---------- স্টক হিসাবের সাহায্যকারী (ট্রান্সজেকশনের ভেতরে ব্যবহার হয়) ----------
const loadProd = async (tx: any, work: any, id: string) => {
  if (work[id]) return work[id];
  const ref = doc(db, "products", id);
  const snap = await tx.get(ref);
  if (!snap.exists()) { work[id] = { ref, missing: true }; return work[id]; }
  const d: any = snap.data();
  work[id] = { ref, changed: false, data: { ...d, variations: (d.variations || []).map((v: any) => ({ ...v })) } };
  return work[id];
};

const reverseItems = async (tx: any, work: any, items: any[]) => {
  for (const it of items || []) {
    if (!it.productId) continue;
    const w = await loadProd(tx, work, it.productId);
    if (w.missing) throw new Error(`${it.name} প্রোডাক্ট খুঁজে পাওয়া যায়নি!`);
    const v = w.data.variations.find((x: any) => x.size === it.size && x.color === it.color);
    if (!v) throw new Error(`${it.name} (${it.size}/${it.color}) খুঁজে পাওয়া যায়নি!`);
    v.stock = round3(Number(v.stock || 0) - Number(it.qty || 0));
    w.changed = true;
  }
};

const checkNoNegative = (work: any) => {
  for (const k of Object.keys(work)) {
    const w = work[k];
    if (!w.changed || w.isNew) continue;
    for (const v of w.data.variations) {
      if (Number(v.stock || 0) < -0.0001) {
        throw new Error(`${w.data.name} (${v.size}/${v.color}): মালের কিছু অংশ দোকানে চলে গেছে বা কমে গেছে, তাই এটা করা যাবে না।`);
      }
    }
  }
};

export default function PurchasePage() {
  const router = useRouter();
  const [role, setRole] = useState("loading");
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState("");
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  // শুধু অ্যাডমিন
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

  useEffect(() => {
    if (role !== "admin") return;
    const subs = [
      onSnapshot(query(collection(db, "shops")), s => setShops(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "products")), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "categories")), s => setDbCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "shop_statements"), where("type", "in", ["Creditor", "PurchaseOrder", "PurchaseReceipt"])), s => setDocs(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => subs.forEach(u => u());
  }, [role]);

  if (role === "loading") return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (role !== "admin") return <div className="text-center py-20 text-red-600 font-bold">এই পেজ শুধু অ্যাডমিন দেখতে পারবেন।</div>;

  // ---------- তালিকা ও হিসাব ----------
  const byDateDesc = (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime();
  const creditors = docs.filter(d => d.type === "Creditor").sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const orders = docs.filter(d => d.type === "PurchaseOrder").sort(byDateDesc);
  const receipts = docs.filter(d => d.type === "PurchaseReceipt").sort(byDateDesc);
  const allCategories = Array.from(new Set([...dbCategories.map(c => c.name), ...products.map(p => p.category)])).filter(Boolean);
  const productNames = Array.from(new Set(products.map(p => p.name))).filter(Boolean);
  const payShops = ["Warehouse", ...shops.map(s => s.name)];

  const orderInfo = (po: any) => {
    const got: any = {};
    receipts.filter(r => r.purchaseId === po.id).forEach(r => (r.items || []).forEach((it: any) => { got[keyOf(it)] = (got[keyOf(it)] || 0) + Number(it.qty || 0); }));
    const rows = (po.items || []).map((it: any) => { const g = got[keyOf(it)] || 0; return { ...it, got: g, pending: round3(Number(it.qty || 0) - g) }; });
    return { rows, done: rows.length > 0 && rows.every((r: any) => r.pending <= 0) };
  };
  const openOrders = orders.filter(o => o.status !== "Closed" && !orderInfo(o).done);
  const doneOrders = orders.filter(o => o.status === "Closed" || orderInfo(o).done);

  const findProductId = (name: string, category: string) => {
    const n = name.trim().toLowerCase();
    const p = products.find(x => (x.name || "").trim().toLowerCase() === n && x.category === category);
    return p ? p.id : null;
  };

  // ---------- ফর্ম খোলা ----------
  const baseForm = () => ({ id: "", purchaseId: "", creditorId: "", newName: "", date: todayStr(), origDate: "", origIso: "", expectedDate: "", items: [emptyItem()], paid: "", payShop: "Warehouse", note: "", advanceId: "" });
  const openLocal = () => { setForm(baseForm()); setModal("local"); };
  const openOrder = () => { setForm(baseForm()); setModal("order"); };
  const openReceive = (po: any) => {
    const items = orderInfo(po).rows.filter((r: any) => r.pending > 0).map((r: any) => ({ name: r.name, category: r.category, size: r.size, color: r.color, qty: String(r.pending), costPrice: String(r.costPrice ?? "") }));
    setForm({ ...baseForm(), purchaseId: po.id, creditorId: po.creditorId, items: items.length ? items : [emptyItem()] });
    setModal("receive");
  };
  const openEditReceipt = (r: any) => {
    setForm({ ...baseForm(), id: r.id, purchaseId: r.purchaseId || "", creditorId: r.creditorId, date: toDateInput(r.date), origDate: toDateInput(r.date), origIso: r.date, items: (r.items || []).map((i: any) => ({ name: i.name, category: i.category, size: i.size, color: i.color, qty: String(i.qty), costPrice: String(i.costPrice ?? "") })), paid: r.paid ? String(r.paid) : "", payShop: r.payShop || "Warehouse", note: r.note || "" });
    setModal("editReceipt");
  };
  const openEditOrder = (po: any) => {
    setForm({ ...baseForm(), id: po.id, creditorId: po.creditorId, date: toDateInput(po.date), origDate: toDateInput(po.date), origIso: po.date, expectedDate: po.expectedDate || "", items: (po.items || []).map((i: any) => ({ name: i.name, category: i.category, size: i.size, color: i.color, qty: String(i.qty), costPrice: String(i.costPrice ?? "") })), paid: po.advance ? String(po.advance) : "", payShop: po.advanceShop || "Warehouse", note: po.note || "", advanceId: po.advanceId || "" });
    setModal("editOrder");
  };

  // ---------- আইটেম ফর্ম ----------
  const updateItem = (idx: number, patch: any) => {
    const items = form.items.map((it: any, i: number) => i === idx ? { ...it, ...patch } : it);
    const it = items[idx];
    const p = products.find(x => (x.name || "").trim().toLowerCase() === (it.name || "").trim().toLowerCase());
    if (p) {
      if (!it.category) it.category = p.category || "";
      const v = (p.variations || []).find((x: any) => x.size === it.size && x.color === it.color);
      if (v && (it.costPrice === "" || it.costPrice === undefined)) it.costPrice = String(v.costPrice ?? "");
    }
    setForm({ ...form, items });
  };
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) });

  const supplierOf = () => {
    if (form.creditorId && form.creditorId !== "__new") {
      const c = creditors.find(x => x.id === form.creditorId);
      return c ? { id: c.id, name: c.name } : null;
    }
    const n = (form.newName || "").trim();
    if (!n) return null;
    const ex = creditors.find(x => (x.name || "").trim().toLowerCase() === n.toLowerCase());
    return ex ? { id: ex.id, name: ex.name } : { id: "", name: n };
  };

  const cleanItems = () => {
    const out: any[] = [];
    for (const it of form.items) {
      if (!(it.name || it.size || it.color || it.qty)) continue;
      if (!(it.name || "").trim() || !it.category || !(it.size || "").trim() || !(it.color || "").trim() || !(Number(it.qty) > 0)) return null;
      out.push({ name: it.name.trim(), category: it.category, size: it.size.trim(), color: it.color.trim(), qty: Number(it.qty), costPrice: Number(it.costPrice || 0) });
    }
    return out.length ? out : null;
  };

  // ---------- মাল পাওয়া (স্টক + দেনা + নগদ একসাথে) ----------
  const saveReceipt = async (source: string) => {
    const sup = supplierOf();
    if (!sup) return alert("সরবরাহকারী বাছুন বা নতুন নাম লিখুন!");
    const items = cleanItems();
    if (!items) return alert("প্রতিটা আইটেমে নাম, ক্যাটাগরি, সাইজ, রঙ ও পরিমাণ দিন!");
    if (!form.date) return alert("তারিখ দিন!");
    const total = Math.round(sumTotal(items) * 100) / 100;
    const paid = Number(form.paid || 0);
    if (paid > total && !window.confirm(`দেওয়া টাকা (${money(paid)}) মোট বিলের (${money(total)}) চেয়ে বেশি। তবুও সেভ করবেন?`)) return;

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const isEdit = !!form.id;
        const receiptRef = isEdit ? doc(db, "shop_statements", form.id) : doc(collection(db, "shop_statements"));

        // ১. পড়া
        let old: any = null;
        if (isEdit) {
          const s = await tx.get(receiptRef);
          if (!s.exists()) throw new Error("এন্ট্রিটি খুঁজে পাওয়া যায়নি!");
          old = s.data();
        }
        const work: any = {};
        if (old) await reverseItems(tx, work, old.items);

        const newProds: any = {};
        const finalItems: any[] = [];
        for (const it of items) {
          let id = findProductId(it.name, it.category);
          let w: any;
          if (id) {
            w = await loadProd(tx, work, id);
            if (w.missing) throw new Error(`${it.name} প্রোডাক্ট খুঁজে পাওয়া যায়নি!`);
          } else {
            const nk = `${it.name.toLowerCase()}|${it.category}`;
            if (!newProds[nk]) {
              const ref = doc(collection(db, "products"));
              newProds[nk] = { id: ref.id, ref, isNew: true, changed: true, data: { name: it.name, category: it.category, variations: [], createdAt: new Date().toISOString() } };
              work[ref.id] = newProds[nk];
            }
            w = newProds[nk];
            id = w.id;
          }
          let v = w.data.variations.find((x: any) => x.size === it.size && x.color === it.color);
          if (!v) { v = { size: it.size, color: it.color, stock: 0, costPrice: 0 }; w.data.variations.push(v); }
          v.stock = round3(Number(v.stock || 0) + it.qty);
          if (it.costPrice > 0) v.costPrice = it.costPrice;
          w.changed = true;
          finalItems.push({ ...it, productId: id });
        }
        checkNoNegative(work);

        // ২. লেখা
        for (const k of Object.keys(work)) {
          const w = work[k];
          if (!w.changed) continue;
          if (w.isNew) tx.set(w.ref, w.data); else tx.update(w.ref, { variations: w.data.variations });
        }

        let creditorId = sup.id;
        if (!creditorId) {
          const cref = doc(collection(db, "shop_statements"));
          tx.set(cref, { shop: COMPANY, type: "Creditor", name: sup.name, kind: "Supplier", amount: 0, date: new Date().toISOString() });
          creditorId = cref.id;
        }
        const dateIso = (isEdit && form.date === form.origDate) ? old.date : dateToIso(form.date);

        const debtRef = old?.debtAddId ? doc(db, "shop_statements", old.debtAddId) : doc(collection(db, "shop_statements"));
        tx.set(debtRef, { shop: COMPANY, type: "DebtAdd", creditorId, amount: total, note: `মাল কেনা (${(old?.source || source) === "Factory" ? "ফ্যাক্টরি" : "লোকাল"})`, date: dateIso, purchaseId: receiptRef.id });

        let paidOutId = old?.paidOutId || "";
        if (paid > 0) {
          const pref = paidOutId ? doc(db, "shop_statements", paidOutId) : doc(collection(db, "shop_statements"));
          paidOutId = pref.id;
          tx.set(pref, { shop: form.payShop, type: "PaidOut", category: "", title: sup.name, note: "মাল কেনার টাকা", amount: paid, creditorId, purchaseId: receiptRef.id, date: dateIso });
        } else if (paidOutId) {
          tx.delete(doc(db, "shop_statements", paidOutId));
          paidOutId = "";
        }

        tx.set(receiptRef, {
          shop: COMPANY, type: "PurchaseReceipt", source: old?.source || source, purchaseId: form.purchaseId || old?.purchaseId || "",
          creditorId, supplierName: sup.name, date: dateIso, items: finalItems, total, paid, payShop: form.payShop,
          debtAddId: debtRef.id, paidOutId, note: (form.note || "").trim()
        });
      });
      setModal(""); alert("সেভ হয়েছে! ওয়্যারহাউসের স্টক ও সরবরাহকারীর দেনা ঠিক হয়েছে।");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "সমস্যা হয়েছে!");
    }
    setBusy(false);
  };

  const deleteReceipt = async (r: any) => {
    if (!window.confirm("এই কেনা ডিলিট করলে ওয়্যারহাউসের স্টক কমবে এবং সরবরাহকারীর দেনা থেকেও মুছে যাবে। নিশ্চিত?")) return;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "shop_statements", r.id);
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error("এন্ট্রিটি আগেই মুছে গেছে!");
        const old: any = s.data();
        const work: any = {};
        await reverseItems(tx, work, old.items);
        checkNoNegative(work);
        for (const k of Object.keys(work)) {
          const w = work[k];
          if (w.changed) tx.update(w.ref, { variations: w.data.variations });
        }
        if (old.debtAddId) tx.delete(doc(db, "shop_statements", old.debtAddId));
        if (old.paidOutId) tx.delete(doc(db, "shop_statements", old.paidOutId));
        tx.delete(ref);
      });
      alert("ডিলিট হয়েছে!");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "সমস্যা হয়েছে!");
    }
  };

  // ---------- ফ্যাক্টরি অর্ডার ----------
  const saveOrder = async () => {
    const sup = supplierOf();
    if (!sup) return alert("ফ্যাক্টরির নাম বাছুন বা নতুন নাম লিখুন!");
    const items = cleanItems();
    if (!items) return alert("প্রতিটা আইটেমে নাম, ক্যাটাগরি, সাইজ, রঙ ও পরিমাণ দিন!");
    if (!form.date) return alert("তারিখ দিন!");
    const advance = Number(form.paid || 0);

    setBusy(true);
    try {
      const batch = writeBatch(db);
      let creditorId = sup.id;
      if (!creditorId) {
        const cref = doc(collection(db, "shop_statements"));
        batch.set(cref, { shop: COMPANY, type: "Creditor", name: sup.name, kind: "Supplier", amount: 0, date: new Date().toISOString() });
        creditorId = cref.id;
      }
      const isEdit = !!form.id;
      const poRef = isEdit ? doc(db, "shop_statements", form.id) : doc(collection(db, "shop_statements"));
      const dateIso = (isEdit && form.date === form.origDate) ? form.origIso : dateToIso(form.date);

      let advanceId = form.advanceId || "";
      if (advance > 0) {
        const aref = advanceId ? doc(db, "shop_statements", advanceId) : doc(collection(db, "shop_statements"));
        advanceId = aref.id;
        batch.set(aref, { shop: form.payShop, type: "PaidOut", category: "", title: sup.name, note: "অগ্রিম (অর্ডারের সময়)", amount: advance, creditorId, purchaseId: poRef.id, date: dateIso });
      } else if (advanceId) {
        batch.delete(doc(db, "shop_statements", advanceId));
        advanceId = "";
      }

      const data = { shop: COMPANY, type: "PurchaseOrder", source: "Factory", creditorId, supplierName: sup.name, date: dateIso, expectedDate: form.expectedDate || "", items, advance, advanceShop: form.payShop, advanceId, note: (form.note || "").trim() };
      if (isEdit) batch.update(poRef, data); else batch.set(poRef, { ...data, status: "Open" });
      await batch.commit();
      setModal(""); alert("অর্ডার সেভ হয়েছে!");
    } catch (error) { console.error(error); alert("সমস্যা হয়েছে!"); }
    setBusy(false);
  };

  const deleteOrder = async (po: any) => {
    if (receipts.some(r => r.purchaseId === po.id)) return alert("এই অর্ডারে মাল পাওয়ার এন্ট্রি আছে। আগে সেগুলো ডিলিট করুন।");
    if (!window.confirm("এই অর্ডার ডিলিট করবেন? (অগ্রিম দেওয়া থাকলে ওই টাকার এন্ট্রিও মুছে যাবে)")) return;
    try {
      const batch = writeBatch(db);
      if (po.advanceId) batch.delete(doc(db, "shop_statements", po.advanceId));
      batch.delete(doc(db, "shop_statements", po.id));
      await batch.commit();
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const toggleClose = async (po: any) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "shop_statements", po.id), { status: po.status === "Closed" ? "Open" : "Closed" });
      await batch.commit();
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (modal === "order" || modal === "editOrder") await saveOrder();
    else await saveReceipt(modal === "local" ? "Local" : "Factory");
  };

  const formTotal = sumTotal(form.items || []);
  const isOrderForm = modal === "order" || modal === "editOrder";
  const titles: any = { local: "লোকাল থেকে কেনা (মাল পেয়েছি)", order: "ফ্যাক্টরিতে নতুন অর্ডার", receive: "মাল পেলাম", editReceipt: "কেনা এডিট", editOrder: "অর্ডার এডিট" };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">মাল কেনা</h2>
          <p className="text-xs text-gray-500">কেনা মাল ওয়্যারহাউসে ঢুকবে, তারপর দোকানে পাঠাবেন</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <button onClick={openLocal} className="bg-green-600 text-white py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1"><ShoppingCart size={22} /> লোকাল থেকে কিনলাম<span className="text-[10px] font-normal text-white/80">মাল হাতে পেয়েছি</span></button>
        <button onClick={openOrder} className="bg-blue-600 text-white py-4 rounded-xl font-bold text-sm flex flex-col items-center gap-1"><Factory size={22} /> ফ্যাক্টরিতে অর্ডার দিলাম<span className="text-[10px] font-normal text-white/80">মাল পরে আসবে</span></button>
      </div>

      {/* চলতি অর্ডার */}
      <h3 className="font-bold text-gray-700 mb-2">চলতি অর্ডার (মাল আসতে বাকি) — {openOrders.length}</h3>
      <div className="space-y-3 mb-6">
        {openOrders.length === 0 && <p className="text-sm text-gray-500 bg-white border rounded-lg p-4 text-center">কোনো চলতি অর্ডার নেই।</p>}
        {openOrders.map(po => {
          const info = orderInfo(po);
          return (
            <div key={po.id} className="bg-white border rounded-xl overflow-hidden">
              <div className="p-3 flex justify-between items-start">
                <div>
                  <p className="font-bold text-brand-navy">{po.supplierName}</p>
                  <p className="text-xs text-gray-500">অর্ডার: {new Date(po.date).toLocaleDateString("en-GB")}{po.expectedDate ? ` • আসার কথা: ${new Date(`${po.expectedDate}T12:00:00`).toLocaleDateString("en-GB")}` : ""}</p>
                  {po.advance > 0 && <p className="text-xs text-green-700">অগ্রিম দেওয়া: {money(po.advance)}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditOrder(po)} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14} /></button>
                  <button onClick={() => deleteOrder(po)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="px-3 pb-2 space-y-1">
                {info.rows.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs border-t pt-1">
                    <span className="text-gray-700">{r.name} • {r.size}/{r.color}</span>
                    <span className="text-gray-600">অর্ডার {r.qty} • এসেছে {r.got} • <b className={r.pending > 0 ? "text-orange-600" : "text-green-600"}>বাকি {r.pending}</b></span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 pt-1">
                <button onClick={() => openReceive(po)} className="bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm">মাল পেলাম</button>
                <button onClick={() => toggleClose(po)} className="border py-2.5 rounded-lg text-sm text-gray-600">বন্ধ করুন (বাকি মাল আসবে না)</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* কেনা মালের তালিকা */}
      <h3 className="font-bold text-gray-700 mb-2">কেনা মালের তালিকা (মাল পেয়েছি) — {receipts.length}</h3>
      <div className="space-y-3 mb-6">
        {receipts.length === 0 && <p className="text-sm text-gray-500 bg-white border rounded-lg p-4 text-center">এখনো কিছু কেনা হয়নি।</p>}
        {receipts.map(r => (
          <div key={r.id} className="bg-white border rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-brand-navy">{r.supplierName} <span className={`text-[10px] px-1.5 py-0.5 rounded ml-1 ${r.source === "Factory" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{r.source === "Factory" ? "ফ্যাক্টরি" : "লোকাল"}</span></p>
                <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString("en-GB")}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEditReceipt(r)} className="p-1.5 text-blue-600 bg-blue-50 rounded"><Edit size={14} /></button>
                <button onClick={() => deleteReceipt(r)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-2 space-y-0.5">
              {(r.items || []).map((it: any, i: number) => (
                <p key={i} className="text-xs text-gray-600">{it.name} • {it.size}/{it.color} — {it.qty} × ৳{it.costPrice}</p>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div className="bg-gray-50 rounded-lg py-1.5"><p className="text-[10px] text-gray-500">মোট বিল</p><p className="font-bold text-sm">{money(r.total)}</p></div>
              <div className="bg-green-50 rounded-lg py-1.5"><p className="text-[10px] text-gray-500">দিয়েছি</p><p className="font-bold text-sm text-green-700">{money(r.paid)}</p></div>
              <div className="bg-red-50 rounded-lg py-1.5"><p className="text-[10px] text-gray-500">বাকি</p><p className="font-bold text-sm text-red-600">{money(Number(r.total || 0) - Number(r.paid || 0))}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* শেষ হওয়া / বন্ধ অর্ডার */}
      <div className="bg-white border rounded-xl mb-4">
        <button onClick={() => setShowDone(!showDone)} className="w-full p-3 flex justify-between items-center">
          <span className="font-bold text-gray-600 text-sm">পুরো আসা বা বন্ধ করা অর্ডার ({doneOrders.length})</span>
          {showDone ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showDone && (
          <div className="px-3 pb-3 space-y-2">
            {doneOrders.length === 0 && <p className="text-xs text-gray-500">কিছু নেই।</p>}
            {doneOrders.map(po => (
              <div key={po.id} className="border rounded-lg p-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-brand-navy">{po.supplierName}</p>
                  <p className="text-[11px] text-gray-500">{new Date(po.date).toLocaleDateString("en-GB")} • {po.status === "Closed" ? "বন্ধ করা" : "পুরো এসেছে"}</p>
                </div>
                <div className="flex gap-1">
                  {po.status === "Closed" && <button onClick={() => toggleClose(po)} className="px-2 py-1 text-xs border rounded">আবার চালু করুন</button>}
                  <button onClick={() => deleteOrder(po)} className="p-1.5 text-red-600 bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <datalist id="productNames">{productNames.map(n => <option key={n} value={n} />)}</datalist>

      {/* ফর্ম */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
          <div className="bg-white p-4 rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3">{titles[modal]}</h3>
            {modal === "editReceipt" && <p className="text-xs bg-yellow-100 text-yellow-800 p-2 rounded mb-3">এডিট করলে আগের স্টক ও দেনা উল্টে নতুন হিসাব বসবে।</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium">{isOrderForm ? "ফ্যাক্টরির নাম" : "কার কাছ থেকে কিনলেন"}</label>
                <select className="w-full border p-2 rounded" value={form.creditorId} onChange={e => setForm({ ...form, creditorId: e.target.value })}>
                  <option value="">-- বাছুন --</option>
                  {creditors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">+ নতুন নাম লিখব</option>
                </select>
                {form.creditorId === "__new" && <input className="w-full border p-2 rounded mt-2" placeholder="নতুন নাম" value={form.newName} onChange={e => setForm({ ...form, newName: e.target.value })} />}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">{isOrderForm ? "অর্ডারের তারিখ" : "তারিখ"}</label><input type="date" required max={todayStr()} className="w-full border p-2 rounded" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                {isOrderForm && <div><label className="text-xs font-medium">কবে আসার কথা</label><input type="date" className="w-full border p-2 rounded" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} /></div>}
              </div>

              <p className="text-sm font-bold text-gray-700 pt-1">মালের তালিকা</p>
              {form.items.map((it: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-2 bg-gray-50 space-y-2">
                  <div className="flex gap-2">
                    <input list="productNames" placeholder="প্রোডাক্টের নাম" className="flex-1 border p-2 rounded text-sm" value={it.name} onChange={e => updateItem(idx, { name: e.target.value })} />
                    {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-500"><Trash2 size={16} /></button>}
                  </div>
                  <select className="w-full border p-2 rounded text-sm" value={it.category} onChange={e => updateItem(idx, { category: e.target.value })}>
                    <option value="">-- ক্যাটাগরি --</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="সাইজ (যেমন 5 MM)" className="border p-2 rounded text-sm" value={it.size} onChange={e => updateItem(idx, { size: e.target.value })} />
                    <input placeholder="রঙ" className="border p-2 rounded text-sm" value={it.color} onChange={e => updateItem(idx, { color: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="any" placeholder={isOrderForm ? "অর্ডার পরিমাণ" : "পরিমাণ (পিস)"} className="border p-2 rounded text-sm font-bold" value={it.qty} onChange={e => updateItem(idx, { qty: e.target.value })} />
                    <input type="number" step="any" placeholder="কেনা দাম (৳)" className="border p-2 rounded text-sm" value={it.costPrice} onChange={e => updateItem(idx, { costPrice: e.target.value })} />
                  </div>
                  <p className="text-xs text-right text-gray-500">= {money(Number(it.qty || 0) * Number(it.costPrice || 0))}</p>
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} className="w-full border border-dashed py-2 rounded-lg text-sm text-brand-navy flex items-center justify-center gap-1"><PlusCircle size={16} /> আরেকটা আইটেম যোগ করুন</button>

              <div className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
                <span className="font-bold text-brand-navy text-sm">মোট বিল</span>
                <span className="text-xl font-bold text-brand-navy">{money(formTotal)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">{isOrderForm ? "অগ্রিম দিলে (৳)" : "এখন কত টাকা দিলেন (৳)"}</label>
                  <input type="number" step="any" className="w-full border p-2 rounded font-bold" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">কোথা থেকে দিলেন</label>
                  <select className="w-full border p-2 rounded" value={form.payShop} onChange={e => setForm({ ...form, payShop: e.target.value })}>
                    {payShops.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              {!isOrderForm && <p className="text-xs text-red-600">বাকি থাকবে (সরবরাহকারীর দেনা): {money(formTotal - Number(form.paid || 0))}</p>}

              <div><label className="text-xs font-medium">নোট (না লিখলেও চলবে)</label><input className="w-full border p-2 rounded" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal("")} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-brand-navy text-white rounded disabled:opacity-50">{busy ? "সেভ হচ্ছে..." : isOrderForm ? "অর্ডার সেভ করুন" : "মাল স্টকে তুলুন"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
