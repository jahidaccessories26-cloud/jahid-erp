"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { PlusCircle, Store, Trash2 } from "lucide-react";

export default function ShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [newShop, setNewShop] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const q = query(collection(db, "shops"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
    });
    return () => unsubscribe();
  }, []);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = newShop.trim();
    if (!trimmedName) return;

    const isDuplicate = shops.some(
      (shop) => shop.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setError("এই দোকানটি আগেই যোগ করা আছে!");
      return;
    }

    try {
      await addDoc(collection(db, "shops"), {
        name: trimmedName,
        createdAt: new Date().toISOString(),
      });
      setNewShop("");
      setSuccess("দোকান সফলভাবে যোগ হয়েছে!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError("দোকান যোগ করতে সমস্যা হয়েছে!");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই দোকানটি ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, "shops", id));
      } catch (error) {
        console.error("Error deleting: ", error);
        alert("ডিলিট করতে সমস্যা হয়েছে!");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-brand-navy mb-6">Shop Management</h2>

      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Store size={20} /> Add New Shop
        </h3>
        
        {error && <p className="text-red-500 text-sm mb-3 font-medium">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-3 font-medium">{success}</p>}

        <form onSubmit={handleAddShop} className="flex gap-3">
          <input 
            required 
            type="text" 
            placeholder="e.g. Shop 1 (Sadarghat)" 
            className="flex-1 border p-2 rounded-lg" 
            value={newShop} 
            onChange={(e) => setNewShop(e.target.value)} 
          />
          <button type="submit" className="bg-brand-navy text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy/90 flex items-center gap-2">
            <PlusCircle size={18} /> Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-600">Shop Name</th>
              <th className="px-6 py-4 font-semibold text-gray-600 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-gray-500">কোনো দোকান পাওয়া যায়নি।</td>
              </tr>
            )}
            {shops.map((shop) => (
              <tr key={shop.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-brand-navy">{shop.name}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(shop.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
