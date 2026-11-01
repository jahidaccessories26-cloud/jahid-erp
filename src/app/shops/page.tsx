"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { PlusCircle, Store, Trash2, Edit, X } from "lucide-react";

export default function ShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [newShop, setNewShop] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // এডিট স্টেট
  const [editingShop, setEditingShop] = useState<any>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const q = query(collection(db, "shops"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShops(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    const trimmedName = newShop.trim();
    if (!trimmedName) return;

    const isDuplicate = shops.some(shop => shop.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) { setError("এই দোকানটি আগেই যোগ করা আছে!"); return; }

    try {
      await addDoc(collection(db, "shops"), { name: trimmedName, createdAt: new Date().toISOString() });
      setNewShop("");
      setSuccess("দোকান সফলভাবে যোগ হয়েছে!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError("দোকান যোগ করতে সমস্যা হয়েছে!"); }
  };

  // এডিট আপডেট
  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    try {
      await updateDoc(doc(db, "shops", editingShop.id), { name: editName.trim() });
      setEditingShop(null);
    } catch (error) { alert("এডিট করতে সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই দোকানটি ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "shops", id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4">Shop Management</h2>

      <div className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Store size={18} /> Add New Shop</h3>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}
        <form onSubmit={handleAddShop} className="flex gap-2">
          <input required type="text" placeholder="e.g. Shop 1 (Sadarghat)" className="flex-1 border p-2 rounded-lg text-sm" value={newShop} onChange={(e) => setNewShop(e.target.value)} />
          <button type="submit" className="bg-brand-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-navy/90 flex items-center gap-1">
            <PlusCircle size={16} /> Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">Shop Name</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-brand-navy">{shop.name}</td>
                <td className="px-4 py-3 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingShop(shop); setEditName(shop.name); }} className="text-brand-navy bg-gray-100 p-1.5 rounded-lg hover:bg-gray-200"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(shop.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-brand-navy">Edit Shop</h3>
              <button onClick={() => setEditingShop(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            <form onSubmit={handleUpdateShop}>
              <input required className="w-full border p-2 rounded-lg text-sm mb-4" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingShop(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
