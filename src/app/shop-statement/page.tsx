// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, addDoc, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Edit, Trash2 } from "lucide-react";

function ShopStatementContent() {
  const router = useRouter();
  
  const [activeShop, setActiveShop] = useState("");
  const [statements, setStatements] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: "", type: "Sale", title: "", amount: "", shop: "" });

  useEffect(() => {
    const shop = localStorage.getItem("activeShop") || "";
    setActiveShop(shop);
    setFormData(prev => ({ ...prev, shop }));

    const unsub = onSnapshot(query(collection(db, "shop_statements"), orderBy("date", "desc")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStatements(shop ? data.filter(s => s.shop === shop) : data);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateDoc(doc(db, "shop_statements", formData.id), { type: formData.type, title: formData.title, amount: Number(formData.amount) });
      } else {
        await addDoc(collection(db, "shop_statements"), { ...formData, amount: Number(formData.amount), date: new Date().toISOString() });
      }
      setShowModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("লেনদেন ডিলিট করতে চান?")) await deleteDoc(doc(db, "shop_statements", id));
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Statement ({activeShop || "All"})</h2>
      </div>

      <button onClick={() => { setIsEdit(false); setFormData({ id: "", type: "Sale", title: "", amount: "", shop: activeShop }); setShowModal(true); }} className="bg-brand-navy text-white px-4 py-2 rounded-lg text-sm mb-4 flex items-center gap-2">
        <PlusCircle size={16}/> Add Transaction
      </button>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Details</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-center">Action</th></tr>
          </thead>
          <tbody>
            {statements.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">কোনো লেনদেন পাওয়া যায়নি।</td></tr>}
            {statements.map(st => (
              <tr key={st.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-3">{new Date(st.date).toLocaleDateString()}</td>
                <td className="px-3 py-3">{st.type}</td>
                <td className="px-3 py-3">{st.title}</td>
                <td className={`px-3 py-3 text-right font-bold ${st.type === 'Sale' ? 'text-green-600' : 'text-red-600'}`}>৳{st.amount}</td>
                <td className="px-3 py-3 flex justify-center gap-2">
                  <button onClick={() => { setIsEdit(true); setFormData(st); setShowModal(true); }} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                  <button onClick={() => handleDelete(st.id)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEdit ? "Edit Transaction" : "Add Transaction"}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="text-xs">Type</label>
                <select className="w-full border p-2 rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="Sale">Sale</option><option value="Expense">Expense</option><option value="Purchase">Purchase</option>
                </select>
              </div>
              <div><label className="text-xs">Title / Details</label><input required className="w-full border p-2 rounded" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
              <div><label className="text-xs">Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
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
