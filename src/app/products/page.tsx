// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { Package, Search, Edit, Trash2, X, PlusCircle, Download, FileSpreadsheet, Folder, ChevronRight, ArrowLeft, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // ✅ নতুন ভিউ স্টেট (main = Cotton/Polestar, sub = Category, product = List)
  const [viewMode, setViewMode] = useState<"main" | "sub" | "product">("main");
  const [selectedMain, setSelectedMain] = useState("");
  const [selectedSub, setSelectedSub] = useState("");

  // এডিট ও অ্যাড মডাল স্টেট
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<any>({ id: "", name: "", mainCategory: "", subCategory: "", variations: [] });
  
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // ✅ ফোল্ডার নেভিগেশন ফাংশন
  const handleMainClick = (main: string) => {
    setSelectedMain(main);
    setViewMode("sub");
    setSearchTerm("");
  };

  const handleSubClick = (sub: string) => {
    setSelectedSub(sub);
    setViewMode("product");
    setSearchTerm("");
  };

  const handleBack = () => {
    if (viewMode === "product") setViewMode("sub");
    else if (viewMode === "sub") setViewMode("main");
    setSearchTerm("");
  };

  // ✅ ফিল্টার করা ডেটা
  const mainCategories = ["Cotton", "Polestar"];
  
  const subCategories = Array.from(new Set(
    products
      .filter(p => p.mainCategory === selectedMain)
      .map(p => p.subCategory || "Others")
  ));

  const filteredProducts = products.filter(p => {
    if (viewMode === "product") {
      return p.mainCategory === selectedMain && (p.subCategory || "Others") === selectedSub;
    }
    return true;
  }).filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ✅ PDF এবং Excel
  const downloadPDF = async () => {
    if (filteredProducts.length === 0) { alert("কোনো ডেটা নেই!"); return; }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Products - ${viewMode === 'product' ? selectedSub : 'All'}`, 14, 15);
    const tableData = [];
    filteredProducts.forEach(p => {
      p.variations?.forEach((v: any) => {
        tableData.push([p.name, v.size || "-", v.color || "-", v.stock || 0, `৳${v.costPrice || 0}`]);
      });
    });
    autoTable(doc, {
      head: [['Product', 'Size', 'Color', 'Stock', 'Rate']],
      body: tableData, startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 45, 92] },
    });
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Products.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Products' }); } catch (e) { console.log(e); }
    } else { doc.save(`Products.pdf`); }
  };

  const downloadCSV = () => {
    if (filteredProducts.length === 0) { alert("কোনো ডেটা নেই!"); return; }
    let csvContent = "Product,Size,Color,Stock,Cost Price\n";
    filteredProducts.forEach(p => {
      p.variations?.forEach((v: any) => {
        csvContent += `${(p.name||"").replace(/,/g," ")},${(v.size||"-").replace(/,/g," ")},${(v.color||"-").replace(/,/g," ")},${v.stock||0},${v.costPrice||0}\n`;
      });
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Products.csv`;
    link.click();
  };

  // মডাল ওপেন (Add/Edit)
  const openAddModal = () => {
    setIsEdit(false);
    setFormData({ id: "", name: "", mainCategory: selectedMain, subCategory: selectedSub, variations: [{ size: "", color: "", stock: 0, costPrice: 0 }] });
    setShowModal(true);
  };

  const openEditModal = (product: any) => {
    setIsEdit(true);
    setFormData(JSON.parse(JSON.stringify(product)));
    setShowModal(true);
  };

  // সেভ (Add/Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateDoc(doc(db, "products", formData.id), {
          name: formData.name, mainCategory: formData.mainCategory, subCategory: formData.subCategory, variations: formData.variations
        });
        setMessage("Success: আপডেট হয়েছে!");
      } else {
        await addDoc(collection(db, "products"), {
          name: formData.name, mainCategory: formData.mainCategory, subCategory: formData.subCategory, variations: formData.variations, createdAt: new Date().toISOString()
        });
        setMessage("Success: নতুন প্রোডাক্ট যোগ হয়েছে!");
      }
      setShowModal(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) { setMessage("Error: সমস্যা হয়েছে!"); }
  };

  const addVariation = () => setFormData({ ...formData, variations: [...formData.variations, { size: "", color: "", stock: 0, costPrice: 0 }] });
  const removeVariation = (i: number) => setFormData({ ...formData, variations: formData.variations.filter((_: any, idx: number) => idx !== i) });
  const handleVarChange = (i: number, field: string, val: any) => {
    const newVars = [...formData.variations]; newVars[i][field] = val; setFormData({ ...formData, variations: newVars });
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`"${name}" ডিলিট করতে চান?`)) {
      await deleteDoc(doc(db, "products", id));
      setMessage("Success: ডিলিট হয়েছে!"); setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      
      {/* হেডার */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {viewMode !== "main" && (
            <button onClick={handleBack} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"><ArrowLeft size={20} /></button>
          )}
          <h2 className="text-2xl font-bold text-brand-navy">
            {viewMode === "main" ? "Main Categories" : viewMode === "sub" ? selectedMain : selectedSub}
          </h2>
        </div>
        
        <div className="flex gap-2">
          {viewMode === "product" && (
            <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700 transition shadow-sm">
              <PlusCircle size={16} /> Add Product
            </button>
          )}
          <button onClick={downloadCSV} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700 transition shadow-sm">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button onClick={downloadPDF} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-brand-navy/90 transition shadow-sm">
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      {message && <div className={`p-3 mb-4 rounded-lg font-medium text-sm shadow-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message}</div>}

      {/* সার্চ বার (শুধু সাব-ক্যাটাগরি বা প্রোডাক্ট ভিউতে) */}
      {viewMode !== "main" && (
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
          <Search size={18} className="text-gray-400 ml-2" />
          <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      )}

      {/* ✅ ১. মেইন ক্যাটাগরি ভিউ */}
      {viewMode === "main" && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {mainCategories.map(cat => (
            <div key={cat} onClick={() => handleMainClick(cat)} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer flex flex-col items-center justify-center gap-3">
              <div className="bg-brand-navy/10 p-4 rounded-full"><Folder size={40} className="text-brand-navy" /></div>
              <h3 className="text-xl font-bold text-brand-navy">{cat}</h3>
            </div>
          ))}
        </div>
      )}

      {/* ✅ ২. সাব-ক্যাটাগরি ভিউ */}
      {viewMode === "sub" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {subCategories.length === 0 && <div className="col-span-3 text-center py-10 text-gray-500">কোনো ক্যাটাগরি নেই।</div>}
          {subCategories.map(sub => (
            <div key={sub} onClick={() => handleSubClick(sub)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Folder size={24} className="text-blue-500" />
                <span className="font-bold text-gray-700">{sub}</span>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          ))}
        </div>
      )}

      {/* ✅ ৩. প্রোডাক্ট লিস্ট ভিউ */}
      {viewMode === "product" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-start mb-3 border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={20} /></div>
                  <div>
                    <h3 className="text-base font-bold text-brand-navy">{product.name}</h3>
                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded border">{product.subCategory}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(product)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(product.id, product.name)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition"><Trash2 size={16} /></button>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 rounded-lg">
                    <tr>
                      <th className="px-2 py-2 rounded-l-lg">Size/Color</th>
                      <th className="px-2 py-2 text-right">Stock</th>
                      <th className="px-2 py-2 text-right rounded-r-lg">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variations?.map((v: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-2 py-2 font-medium">{v.size || "Unknown"} / {v.color || "Unknown"}</td>
                        <td className="px-2 py-2 text-right font-bold text-brand-navy">{v.stock}</td>
                        <td className="px-2 py-2 text-right text-gray-600">৳{v.costPrice || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <div className="col-span-2 text-center py-10 text-gray-500">এই ক্যাটাগরিতে কোনো প্রোডাক্ট নেই। "Add Product" চাপুন।</div>}
        </div>
      )}

      {/* ✅ অ্যাড/এডিট মডাল */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-brand-navy">{isEdit ? "Edit Product" : "Add New Product"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Product Name</label>
                  <input required className="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Sub Category</label>
                  <input required className="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white" value={formData.subCategory} onChange={(e) => setFormData({...formData, subCategory: e.target.value})} />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Variations (Size/Color)</label>
                  <button type="button" onClick={addVariation} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-medium transition">
                    <PlusCircle size={14}/> Add Size/Color
                  </button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formData.variations?.map((v: any, i: number) => (
                    <div key={i} className="flex flex-col md:flex-row gap-2 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex w-full gap-2">
                        <input placeholder="Size" className="w-1/2 border p-2 rounded-lg text-sm" value={v.size} onChange={(e) => handleVarChange(i, 'size', e.target.value)} />
                        <input placeholder="Color" className="w-1/2 border p-2 rounded-lg text-sm" value={v.color} onChange={(e) => handleVarChange(i, 'color', e.target.value)} />
                      </div>
                      <div className="flex w-full gap-2 items-center">
                        <input placeholder="Stock" type="number" className="w-1/3 border p-2 rounded-lg text-sm" value={v.stock} onChange={(e) => handleVarChange(i, 'stock', Number(e.target.value))} />
                        <input placeholder="Cost" type="number" className="w-1/3 border p-2 rounded-lg text-sm" value={v.costPrice} onChange={(e) => handleVarChange(i, 'costPrice', Number(e.target.value))} />
                        <button type="button" onClick={() => removeVariation(i)} className="w-1/3 flex justify-center text-red-500 hover:bg-red-50 p-2 rounded-lg border border-red-100 transition"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy/90 shadow-sm transition">{isEdit ? "Save Changes" : "Add Product"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
