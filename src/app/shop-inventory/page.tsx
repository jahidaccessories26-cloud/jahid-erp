// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Package, Search, ArrowLeft, Store, Edit, X, DollarSign, Trash2, PlusCircle } from "lucide-react";

export default function ShopInventoryPage() {
  const router = useRouter();
  
  const [userRole, setUserRole] = useState("manager");
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  
  const [shopInventories, setShopInventories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingItem, setEditingItem] = useState<any>(null);
  const [editData, setEditData] = useState({ productName: "", category: "", size: "", color: "", stock: 0, costPrice: 0 });

  // ইউজার চেক
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role || "manager");
            setSelectedShop(docSnap.data().assignedShop || "");
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // ডেটা লোড
  useEffect(() => {
    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop && userRole === "admin") {
        setSelectedShop(data[0].name);
      }
    });

    const unsubInv = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      setShopInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubShops(); unsubInv(); };
  }, [selectedShop, userRole]);

  // ✅ দোকানের ডেটা ফিল্টার (সরাসরি shop_inventories থেকে)
  let totalStockValue = 0;
  
  const displayList = shopInventories
    .filter(item => item.shop === selectedShop)
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return (item.productName || "").toLowerCase().includes(searchLower) || 
             (item.category || "").toLowerCase().includes(searchLower) ||
             (item.size || "").toLowerCase().includes(searchLower) ||
             (item.color || "").toLowerCase().includes(searchLower);
    })
    .map(item => {
      const itemValue = (item.stock || 0) * (item.costPrice || 0);
      totalStockValue += itemValue;
      return { ...item, itemValue };
    });

  // এডিট ওপেন
  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditData({
      productName: item.productName || "",
      category: item.category || "",
      size: item.size || "",
      color: item.color || "",
      stock: item.stock || 0,
      costPrice: item.costPrice || 0
    });
  };

  // এডিট সেভ
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const invRef = doc(db, "shop_inventories", editingItem.id);
      await updateDoc(invRef, { 
        productName: editData.productName,
        category: editData.category,
        size: editData.size,
        color: editData.color,
        stock: Number(editData.stock),
        costPrice: Number(editData.costPrice)
      });
      setEditingItem(null);
      alert("Success: প্রোডাক্ট আপডেট হয়েছে!");
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  // ডিলিট
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত "${name}" দোকানের স্টক থেকে ডিলিট করতে চান?`)) {
      try {
        await deleteDoc(doc(db, "shop_inventories", id));
        alert("Success: ডিলিট হয়েছে!");
      } catch (error) { alert("ডিলিট করতে সমস্যা হয়েছে!"); }
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Shop Inventory</h2>
      </div>

      {/* অ্যাডমিনের জন্য দোকান সিলেক্ট */}
      {userRole === "admin" && (
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
          <Store size={18} className="text-brand-navy ml-2" />
          <select 
            className="w-full bg-transparent outline-none text-sm font-bold text-brand-navy py-2 cursor-pointer"
            value={selectedShop} 
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="" disabled>-- Select Shop --</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.name}>{shop.name}</option>
            ))}
          </select>
        </div>
      )}

      {userRole !== "admin" && selectedShop && (
        <div className="bg-brand-navy text-white px-4 py-3 rounded-xl shadow-md mb-4 flex items-center gap-3">
          <Store size={24} />
          <div>
            <p className="text-[10px] text-gray-300 uppercase tracking-wider">Location</p>
            <h3 className="font-bold text-lg">{selectedShop}</h3>
          </div>
        </div>
      )}

      {/* সারসংক্ষেপ কার্ড */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Package size={14}/> Total Stock Items</div>
          <h3 className="text-xl font-bold text-brand-navy">
            {displayList.reduce((sum, item) => sum + (item.stock || 0), 0)} pcs
          </h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><DollarSign size={14}/> Total Stock Value</div>
          <h3 className="text-xl font-bold text-green-600">
            ৳{totalStockValue.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      {/* সার্চ বার */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search product, size, color..." 
          className="w-full bg-transparent outline-none text-sm py-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ইনভেন্টরি টেবিল */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Product Details</th>
                <th className="px-3 py-3 font-semibold text-center">Stock</th>
                <th className="px-3 py-3 font-semibold text-right">Value (৳)</th>
                <th className="px-3 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    এই দোকানে কোনো প্রোডাক্ট পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {displayList.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="font-bold text-brand-navy text-xs md:text-sm">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 mb-1">{item.category}</div>
                    <div className="text-[10px] text-gray-700 bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {item.size} / {item.color}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg font-bold text-xs ${
                      item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">
                    ৳{item.itemValue.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button 
                        onClick={() => handleEditClick(item)} 
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id, item.productName)} 
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* এডিট মডাল */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-navy">Edit Shop Product</h3>
              <button onClick={() => setEditingItem(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleUpdateItem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Product Name</label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={editData.productName} onChange={(e) => setEditData({...editData, productName: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={editData.category} onChange={(e) => setEditData({...editData, category: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Size</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={editData.size} onChange={(e) => setEditData({...editData, size: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Color</label>
                  <input required className="w-full border p-2 rounded-lg text-sm" value={editData.color} onChange={(e) => setEditData({...editData, color: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Stock</label>
                  <input required type="number" className="w-full border p-2 rounded-lg text-lg font-bold" value={editData.stock} onChange={(e) => setEditData({...editData, stock: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Cost Price (৳)</label>
                  <input required type="number" className="w-full border p-2 rounded-lg text-sm" value={editData.costPrice} onChange={(e) => setEditData({...editData, costPrice: Number(e.target.value)})} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t mt-2">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
