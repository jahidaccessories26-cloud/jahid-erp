"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { PlusCircle, Box, Trash2 } from "lucide-react";

type Variation = {
  size: string;
  color: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // প্রোডাক্টের মূল তথ্য
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Dressing");
  
  // ভ্যারিয়েশন স্টেট (সাইজ ও কালার)
  const [variations, setVariations] = useState<Variation[]>([
    { size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }
  ]);

  // ফায়ারবেস থেকে প্রোডাক্ট লিস্ট রিড করা
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });
    return () => unsubscribe();
  }, []);

  // নতুন ভ্যারিয়েশন লাইন যোগ করা
  const addVariation = () => {
    setVariations([...variations, { size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }]);
  };

  // ভ্যারিয়েশনের ডেটা আপডেট করা
  const updateVariation = (index: number, field: keyof Variation, value: string | number) => {
    const newVariations = [...variations];
    newVariations[index] = { ...newVariations[index], [field]: value };
    setVariations(newVariations);
  };

  // ভ্যারিয়েশন ডিলিট করা
  const removeVariation = (index: number) => {
    const newVariations = variations.filter((_, i) => i !== index);
    setVariations(newVariations);
  };

  // প্রোডাক্ট সেভ করা
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "products"), {
        name,
        category,
        variations,
        createdAt: new Date().toISOString(),
      });
      setName("");
      setVariations([{ size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }]);
      setShowForm(false);
    } catch (error) {
      console.error("Error: ", error);
      alert("প্রোডাক্ট সেভ করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-brand-navy">Product Catalog</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
        >
          <PlusCircle size={18} /> {showForm ? "Close Form" : "Add New Product"}
        </button>
      </div>

      {/* প্রোডাক্ট অ্যাড করার ফর্ম */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
          <h3 className="text-xl font-bold mb-4 text-brand-navy">Add New Product</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input required placeholder="e.g. Dressing, Twill Tape" className="w-full border p-2 rounded-lg" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select className="w-full border p-2 rounded-lg" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Dressing">Dressing</option>
                <option value="Twill Tape">Twill Tape</option>
                <option value="Button">Button</option>
                <option value="Zipper">Zipper</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2 border-b pb-2">Variations (Size, Color & Stock)</h4>
            
            {variations.map((v, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3 items-end bg-gray-50 p-3 rounded-lg border">
                <div>
                  <label className="text-xs font-medium text-gray-500">Size</label>
                  <input required placeholder="10 cm" className="w-full border p-1.5 rounded text-sm" value={v.size} onChange={(e) => updateVariation(index, "size", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Color</label>
                  <input required placeholder="Red" className="w-full border p-1.5 rounded text-sm" value={v.color} onChange={(e) => updateVariation(index, "color", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Stock</label>
                  <input required type="number" placeholder="100" className="w-full border p-1.5 rounded text-sm" value={v.stock || ""} onChange={(e) => updateVariation(index, "stock", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Cost Price</label>
                  <input required type="number" placeholder="50" className="w-full border p-1.5 rounded text-sm" value={v.costPrice || ""} onChange={(e) => updateVariation(index, "costPrice", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Sell Price</label>
                  <input required type="number" placeholder="60" className="w-full border p-1.5 rounded text-sm" value={v.sellingPrice || ""} onChange={(e) => updateVariation(index, "sellingPrice", Number(e.target.value))} />
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => removeVariation(index)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Remove this row">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            
            <button type="button" onClick={addVariation} className="text-brand-navy text-sm font-medium hover:underline flex items-center gap-1 mt-2">
              <PlusCircle size={16} /> Add More Size/Color
            </button>
          </div>

          <button type="submit" className="bg-green-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-green-700 mt-4 w-full md:w-auto">Save Product</button>
        </form>
      )}

      {/* প্রোডাক্ট লিস্ট */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.length === 0 && <p className="text-gray-500 col-span-2">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>}
        
        {products.map((product) => (
          <div key={product.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center gap-3 mb-3 border-b pb-3">
              <div className="bg-brand-navy/10 p-2 rounded-lg">
                <Box className="text-brand-navy" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-brand-navy">{product.name}</h3>
                <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{product.category}</span>
              </div>
            </div>
            
            <div className="flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-2 py-2">Size</th>
                    <th className="px-2 py-2">Color</th>
                    <th className="px-2 py-2 text-right">Stock</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    <th className="px-2 py-2 text-right">Sell</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variations.map((v: Variation, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">{v.size}</td>
                      <td className="px-2 py-2">{v.color}</td>
                      <td className="px-2 py-2 text-right font-semibold text-brand-navy">{v.stock}</td>
                      <td className="px-2 py-2 text-right text-gray-500">৳{v.costPrice}</td>
                      <td className="px-2 py-2 text-right text-green-600 font-medium">৳{v.sellingPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
