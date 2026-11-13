// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, PlusCircle, Edit, Trash2, Phone, MapPin } from "lucide-react";

function BuyerStatementContent() {
  const router = useRouter();
  
  // লোকাল স্টোরেজ থেকে দোকানের নাম নেওয়া
  const [activeShop, setActiveShop] = useState("");
  const [buyers, setBuyers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: "", name: "", phone: "", address: "", shop: "" });

  useEffect(() => {
    const shop = localStorage.getItem("activeShop") || "";
    setActiveShop(shop);
    setFormData(prev => ({ ...prev, shop }));

    const unsub = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyers(shop ? data.filter(b => b.shop === shop) : data);
    });
    return () => unsub();
  }, []);

  const filteredBuyers = buyers.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateDoc(doc(db, "buyers", formData.id), { name: formData.name, phone: formData.phone, address: formData.address });
      } else {
        await addDoc(collection(db, "buyers"), { ...formData, createdAt: new Date().toISOString() });
      }
      setShowModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("বায়ার ডিলিট করতে চান?")) await deleteDoc(doc(db, "buyers", id));
  };

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Buyers ({activeShop || "All"})</h2>
      </div>

      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-sm">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="Search Buyer..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => { setIsEdit(false); setFormData({ id: "", name: "", phone: "", address: "", shop: activeShop }); setShowModal(true); }} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <PlusCircle size={16}/> Add Buyer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredBuyers.map(buyer => (
          <div key={buyer.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <p className="font-bold text-brand-navy">{buyer.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Phone size={12}/> {buyer.phone}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/> {buyer.address}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setIsEdit(true); setFormData(buyer); setShowModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
              <button onClick={() => handleDelete(buyer.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{isEdit ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="text-xs">Phone</label><input className="w-full border p-2 rounded" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><label className="text-xs">Address</label><input className="w-full border p-2 rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
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

export default function BuyerStatementPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
      <BuyerStatementContent />
    </Suspense>
  );
}
