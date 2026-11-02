// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Package, Search, Edit, Trash2, X, PlusCircle } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // এডিট মডাল স্টেট
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<any>({ id: "", name: "", category: "", variations: [] });
  
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // এডিট ওপেন করার ফাংশন
  const openEdit = (product: any) => {
    setEditData(JSON.parse(JSON.stringify(product))); // ডিপ কপি
    setShowEditModal(true);
  };

  // এডিট সেভ করার ফাংশন
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productRef = doc(db, "products", editData.id);
      await updateDoc(productRef, {
        name: editData.name,
        category: editData.category,
        variations: editData.variations
      });
      setMessage("Success: প্রোডাক্ট সফলভাবে আপডেট হয়েছে!");
      setShowEditModal(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error: আপডেট করতে সমস্যা হয়েছে!");
    }
  };

  // ভ্যারিয়েশন (সাইজ/কালার) চেঞ্জ করার ফাংশন
  const handleVariationChange = (index: number, field: string, value: any) => {
    const newVariations = [...editData.variations];
    newVariations[index][field] = value;
    setEditData({ ...editData, variations: newVariations });
  };

  // নতুন ভ্যারিয়েশন যোগ করার ফাংশন
  const addVariation = () => {
    setEditData({
      ...editData,
      variations: [...editData.variations, { size: "", color: "", stock: 0, costPrice: 0 }]
    });
  };

  // ভ্যারিয়েশন ডিলিট করার ফাংশন
  const removeVariation = (index: number) => {
    const newVariations = editData.variations.filter((_: any, i: number) => i !== index);
    setEditData({ ...editData, variations: newVariations });
  };

  // পুরো প্রোডাক্ট ডিলিট করার ফাংশন
  const handleDeleteProduct = async (id: string, name: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত "${name}" প্রোডাক্টটি ডিলিট করতে চান?`)) {
      try {
        await deleteDoc(doc(db, "products", id));
        setMessage("Success: প্রোডাক্ট ডিলিট হয়েছে!");
        setTimeout(() => setMessage(""), 3000);
      } catch (error) {
        setMessage("Error: ডিলিট করতে সমস্যা হয়েছে!");
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-brand-navy">Products</h2>
      </div>

      {message && (
        <div className={`p-3 mb-4 rounded-lg font-medium text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search product or category..." 
          className="w-full bg-transparent outline-none text-sm py-1" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-start mb-3 border-b pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={20} /></div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">{product.name}</h3>
                  <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{product.category}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(product)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition"><Edit size={16} /></button>
                <button onClick={() => handleDeleteProduct(product.id, product.name)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition"><Trash2 size={16} /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-2 py-2">Size</th>
                    <th className="px-2 py-2">Color</th>
                    <th className="px-2 py-2 text-right">Stock</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variations?.map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{v.size || "Unknown"}</td>
                      <td className="px-2 py-2">{v.color || "Unknown"}</td>
                      <td className="px-2 py-2 text-right font-bold text-brand-navy">{v.stock}</td>
                      <td className="px-2 py-2 text-right text-gray-600">৳{v.costPrice || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && <div className="col-span-2 text-center py-10 text-gray-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</div>}
      </div>

      {/* ✅ এডিট মডাল (পপ-আপ) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-brand-navy">Edit Product</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Product Name</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={editData.category} onChange={(e) => setEditData({...editData, category: e.target.value})} />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Variations (Size/Color)</label>
                  <button type="button" onClick={addVariation} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100"><PlusCircle size={14}/> Add</button>
                </div>
                
                <div className="space-y-2">
                  {editData.variations?.map((v: any, i: number) => (
                    <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border">
                      <input placeholder="Size" className="w-1/4 border p-1.5 rounded text-sm" value={v.size} onChange={(e) => handleVariationChange(i, 'size', e.target.value)} />
                      <input placeholder="Color" className="w-1/4 border p-1.5 rounded text-sm" value={v.color} onChange={(e) => handleVariationChange(i, 'color', e.target.value)} />
                      <input placeholder="Stock" type="number" className="w-1/4 border p-1.5 rounded text-sm" value={v.stock} onChange={(e) => handleVariationChange(i, 'stock', Number(e.target.value))} />
                      <input placeholder="Cost (৳)" type="number" className="w-1/4 border p-1.5 rounded text-sm" value={v.costPrice} onChange={(e) => handleVariationChange(i, 'costPrice', Number(e.target.value))} />
                      <button type="button" onClick={() => removeVariation(i)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Update Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
