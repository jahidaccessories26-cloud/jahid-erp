"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { PlusCircle, FolderPlus, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ফায়ারবেস থেকে ক্যাটাগরি লিস্ট রিড করা
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
    });
    return () => unsubscribe();
  }, []);

  // নতুন ক্যাটাগরি সেভ করা
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = newCategory.trim();
    if (!trimmedName) return;

    // ডুপ্লিকেট চেক (Case-insensitive)
    const isDuplicate = categories.some(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setError("এই ক্যাটাগরিটি আগেই যোগ করা আছে!");
      return;
    }

    try {
      await addDoc(collection(db, "categories"), {
        name: trimmedName,
        createdAt: new Date().toISOString(),
      });
      setNewCategory("");
      setSuccess("ক্যাটাগরি সফলভাবে যোগ হয়েছে!");
      setTimeout(() => setSuccess(""), 3000); // ৩ সেকেন্ড পর মেসেজ মুছে যাবে
    } catch (err) {
      console.error(err);
      setError("ক্যাটাগরি সেভ করতে সমস্যা হয়েছে!");
    }
  };

  // ক্যাটাগরি ডিলিট করা
  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই ক্যাটাগরিটি ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, "categories", id));
      } catch (error) {
        console.error("Error deleting: ", error);
        alert("ডিলিট করতে সমস্যা হয়েছে!");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-brand-navy mb-6">Category Management</h2>

      {/* নতুন ক্যাটাগরি ফর্ম */}
      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FolderPlus size={20} /> Add New Category
        </h3>
        
        {error && <p className="text-red-500 text-sm mb-3 font-medium">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-3 font-medium">{success}</p>}

        <form onSubmit={handleAddCategory} className="flex gap-3">
          <input 
            required 
            type="text" 
            placeholder="e.g. Interlining, Poly Bag, Label" 
            className="flex-1 border p-2 rounded-lg" 
            value={newCategory} 
            onChange={(e) => setNewCategory(e.target.value)} 
          />
          <button type="submit" className="bg-brand-navy text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy/90 flex items-center gap-2">
            <PlusCircle size={18} /> Add
          </button>
        </form>
      </div>

      {/* ক্যাটাগরি লিস্ট */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-600">Category Name</th>
              <th className="px-6 py-4 font-semibold text-gray-600 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-gray-500">কোনো ক্যাটাগরি পাওয়া যায়নি।</td>
              </tr>
            )}
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-brand-navy">{cat.name}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(cat.id)} 
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                    title="Delete Category"
                  >
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
