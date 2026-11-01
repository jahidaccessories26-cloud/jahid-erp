"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { PlusCircle, Box, Trash2, Edit, X, Search, Filter } from "lucide-react";

type Variation = {
  size: string;
  color: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // সার্চ এবং ফিল্টার স্টেট
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const [name, setName] = useState("");
  const [category, setCategory] = useState(""); 
  const [variations, setVariations] = useState<Variation[]>([
    { size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }
  ]);

  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qCategories = query(collection(db, "categories"));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      setDbCategories(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProducts(); unsubCategories(); };
  }, []);

  // ডেটাবেসের ক্যাটাগরি এবং প্রোডাক্টের ক্যাটাগরি—দুটো মিলিয়ে ইউনিক লিস্ট তৈরি
  const allCategories = Array.from(new Set([
    ...dbCategories.map(c => c.name),
    ...products.map(p => p.category)
  ])).filter(Boolean);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "All" || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const addVariation = () => setVariations([...variations, { size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }]);
  
  const updateVariation = (index: number, field: keyof Variation, value: string | number) => {
    const newVariations = [...variations];
    newVariations[index] = { ...newVariations[index], [field]: value };
    setVariations(newVariations);
  };

  const removeVariation = (index: number) => setVariations(variations.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) { alert("ক্যাটাগরি সিলেক্ট করুন!"); return; }

    try {
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), { name, category, variations });
        alert("Success: প্রোডাক্ট আপডেট হয়েছে!");
      } else {
        await addDoc(collection(db, "products"), { name, category, variations, createdAt: new Date().toISOString() });
        alert("Success: নতুন প্রোডাক্ট সেভ হয়েছে!");
      }
      setName(""); setVariations([{ size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }]);
      setShowForm(false); setEditingProduct(null);
    } catch (error) { alert("প্রোডাক্ট সেভ করতে সমস্যা হয়েছে!"); }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product); 
    setName(product.name); 
    setCategory(product.category);
    setVariations(product.variations); 
    setShowForm(true);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold text-brand-navy">Product Catalog</h2>
        <button 
          onClick={() => { setShowForm(!showForm); setEditingProduct(null); setName(""); setVariations([{ size: "", color: "", stock: 0, costPrice: 0, sellingPrice: 0 }]); }}
          className="bg-brand-navy text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-navy/90 transition flex items-center gap-1 w-full md:w-auto justify-center"
        >
          <PlusCircle size={16} /> {showForm ? "Close Form" : "Add New Product"}
        </button>
      </div>

      {/* সার্চ ও ক্যাটাগরি ফিল্টার বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
          <Search size={16} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by product name or category..." 
            className="w-full bg-transparent outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg md:w-64">
          <Filter size={16} className="text-gray-400" />
          <select 
            className="w-full bg-transparent outline-none text-sm font-medium text-brand-navy cursor-pointer"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-brand-navy">{editingProduct ? "Edit Product" : "Add New Product"}</h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingProduct(null); }} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1">Product Name</label>
              <input required placeholder="e.g. Dressing" className="w-full border p-1.5 rounded-lg text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select required className="w-full border p-1.5 rounded-lg text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>Select a Category</option>
                {allCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Variations (Size, Color, Stock, Price)</h4>
            
            {variations.map((v, index) => (
              <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 items-end bg-gray-50 p-2 rounded-lg border">
                <div><label className="text-[10px] font-medium text-gray-500">Size</label><input required placeholder="10 cm" className="w-full border p-1 rounded text-xs" value={v.size} onChange={(e) => updateVariation(index, "size", e.target.value)} /></div>
                <div><label className="text-[10px] font-medium text-gray-500">Color</label><input required placeholder="Red" className="w-full border p-1 rounded text-xs" value={v.color} onChange={(e) => updateVariation(index, "color", e.target.value)} /></div>
                <div><label className="text-[10px] font-medium text-gray-500">Stock</label><input required type="number" placeholder="100" className="w-full border p-1 rounded text-xs" value={v.stock || ""} onChange={(e) => updateVariation(index, "stock", Number(e.target.value))} /></div>
                <div><label className="text-[10px] font-medium text-gray-500">Cost</label><input required type="number" placeholder="50" className="w-full border p-1 rounded text-xs" value={v.costPrice || ""} onChange={(e) => updateVariation(index, "costPrice", Number(e.target.value))} /></div>
                <div className="flex gap-1 items-end">
                  <div className="flex-1"><label className="text-[10px] font-medium text-gray-500">Sell</label><input required type="number" placeholder="60" className="w-full border p-1 rounded text-xs" value={v.sellingPrice || ""} onChange={(e) => updateVariation(index, "sellingPrice", Number(e.target.value))} /></div>
                  <button type="button" onClick={() => removeVariation(index)} className="text-red-500 hover:bg-red-50 p-1 rounded mb-0.5"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            
            <button type="button" onClick={addVariation} className="text-brand-navy text-xs font-medium hover:underline flex items-center gap-1 mt-1">
              <PlusCircle size={14} /> Add Size/Color
            </button>
          </div>

          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm w-full md:w-auto mt-2">
            {editingProduct ? "Update Product" : "Save Product"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredProducts.length === 0 && <p className="text-gray-500 text-center col-span-2 py-4">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>}
        
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col relative">
            <button onClick={() => handleEdit(product)} className="absolute top-3 right-3 bg-gray-100 text-gray-500 p-1.5 rounded-lg hover:bg-brand-navy hover:text-white transition">
              <Edit size={14} />
            </button>

            <div className="flex items-center gap-2 mb-2 border-b pb-2 pr-8">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Box className="text-brand-navy" size={18} /></div>
              <div>
                <h3 className="text-sm font-bold text-brand-navy">{product.name}</h3>
                <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{product.category}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-1 py-1">Size</th><th className="px-1 py-1">Color</th>
                    <th className="px-1 py-1 text-right">Stock</th><th className="px-1 py-1 text-right">Cost</th><th className="px-1 py-1 text-right">Sell</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variations.map((v: Variation, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-1 py-1.5 font-medium">{v.size}</td>
                      <td className="px-1 py-1.5">{v.color}</td>
                      <td className="px-1 py-1.5 text-right font-semibold text-brand-navy">{v.stock}</td>
                      <td className="px-1 py-1.5 text-right text-gray-500">৳{v.costPrice}</td>
                      <td className="px-1 py-1.5 text-right text-green-600 font-medium">৳{v.sellingPrice}</td>
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
