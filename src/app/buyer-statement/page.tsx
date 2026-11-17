// @ts-nocheck
"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc, addDoc, increment } from "firebase/firestore";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, PlusCircle, Edit, Trash2, X, Phone, MapPin, Building, Share2, ShoppingBag } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function BuyerStatementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopParam = searchParams.get("shop") || "";

  const [buyers, setBuyers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // বায়ার অ্যাড/এডিট স্টেট
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [buyerFormData, setBuyerFormData] = useState({ id: "", name: "", phone: "", address: "", garmentsName: "", shop: shopParam });

  // পার্টি সেল (ডেলিভারি) স্টেট
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleData, setSaleData] = useState({ id: "", garments: "", orderNo: "", styleNo: "", productId: "", productName: "", qty: "", amount: "", paymentType: "Due" });
  const [prodSearch, setProdSearch] = useState("");
  const [isEditSale, setIsEditSale] = useState(false);

  useEffect(() => {
    const unsubBuyers = onSnapshot(query(collection(db, "buyers")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyers(data.filter(b => shopParam === "" || b.shop === shopParam));
    });

    const unsubProducts = onSnapshot(query(collection(db, "shop_inventories")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data.filter(p => shopParam === "" || p.shop === shopParam));
    });

    return () => { unsubBuyers(); unsubProducts(); };
  }, [shopParam]);

  // বায়ার সিলেক্ট করলে তার অর্ডার লোড হবে
  useEffect(() => {
    if (!selectedBuyer) return;
    const unsubOrders = onSnapshot(query(collection(db, "buyer_orders")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuyerOrders(data.filter(o => o.buyerId === selectedBuyer.id).sort((a,b) => new Date(b.date) - new Date(a.date)));
    });
    return () => unsubOrders();
  }, [selectedBuyer]);

  // বায়ার সেভ
  const handleBuyerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (buyerFormData.id) {
        await updateDoc(doc(db, "buyers", buyerFormData.id), { name: buyerFormData.name, phone: buyerFormData.phone, address: buyerFormData.address, garmentsName: buyerFormData.garmentsName });
      } else {
        await addDoc(collection(db, "buyers"), { ...buyerFormData, createdAt: new Date().toISOString() });
      }
      setShowBuyerModal(false); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // পার্টি সেল (ডেলিভারি) সেভ
  const handleSaleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === saleData.productId);
      if (!isEditSale && (!prod || prod.stock < Number(saleData.qty))) return alert("স্টক পর্যাপ্ত নয়!");

      if (isEditSale) {
        await updateDoc(doc(db, "buyer_orders", saleData.id), {
          garments: saleData.garments, orderNo: saleData.orderNo, styleNo: saleData.styleNo, productName: saleData.productName, qty: Number(saleData.qty), amount: Number(saleData.amount), paymentType: saleData.paymentType
        });
      } else {
        // স্টক কমানো
        await updateDoc(doc(db, "shop_inventories", prod.id), { stock: increment(-Number(saleData.qty)) });
        
        // বায়ারের খাতায় যোগ করা
        await addDoc(collection(db, "buyer_orders"), {
          shop: shopParam, buyerId: selectedBuyer.id, buyerName: selectedBuyer.name, 
          garments: saleData.garments, orderNo: saleData.orderNo, styleNo: saleData.styleNo, 
          productId: saleData.productId, productName: saleData.productName, 
          qty: Number(saleData.qty), amount: Number(saleData.amount), paymentType: saleData.paymentType,
          type: "Delivery", date: new Date().toISOString()
        });
      }
      setShowSaleModal(false); setProdSearch(""); alert("সেভ হয়েছে!");
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // ডিলিট লেনদেন
  const handleDeleteOrder = async (id: string, type: string, prodId: string, qty: number) => {
    if (!window.confirm("ডিলিট করলে স্টক ফেরত আসবে। নিশ্চিত?")) return;
    try {
      if (type === "Delivery" && prodId) {
        await updateDoc(doc(db, "shop_inventories", prodId), { stock: increment(Number(qty)) });
      }
      await deleteDoc(doc(db, "buyer_orders", id));
    } catch (error) { alert("সমস্যা হয়েছে!"); }
  };

  // বায়ার স্টেটমেন্ট PDF শেয়ার
  const handleShareStatement = async () => {
    if (buyerOrders.length === 0) return alert("ডেটা নেই!");
    const doc = new jsPDF();
    doc.text(`Statement - ${selectedBuyer.name}`, 14, 15);
    doc.text(`Shop: ${shopParam}`, 14, 22);
    
    let totalBill = buyerOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    doc.text(`Total Bill: BDT ${totalBill}`, 14, 28);

    const tableData = buyerOrders.map(o => [new Date(o.date).toLocaleDateString(), o.garments, o.orderNo, o.productName, o.qty, o.amount, o.paymentType]);
    autoTable(doc, { head: [['Date', 'Garments', 'Order', 'Product', 'Qty', 'Amount', 'Type']], body: tableData, startY: 35 });

    const pdfBlob = doc.output('blob'); 
    const file = new File([pdfBlob], `Statement_${selectedBuyer.name}.pdf`, { type: 'application/pdf' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) { 
      try { await navigator.share({ files: [file], title: 'Buyer Statement' }); } catch (e) {} 
    } else { doc.save(`Statement_${selectedBuyer.name}.pdf`); }
  };

  const searchedProducts = products.filter(p => p.productName.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5);

  if (selectedBuyer) {
    let totalAmount = buyerOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    
    return (
      <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedBuyer(null)} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-brand-navy">{selectedBuyer.name}</h2>
              <p className="text-xs text-gray-500">{selectedBuyer.garmentsName} | {selectedBuyer.phone}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShareStatement} className="bg-brand-navy text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><Share2 size={16}/> Share</button>
            <button onClick={() => { setSaleData({ id: "", garments: selectedBuyer.garmentsName || "", orderNo: "", styleNo: "", productId: "", productName: "", qty: "", amount: "", paymentType: "Due" }); setIsEditSale(false); setShowSaleModal(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"><PlusCircle size={16}/> Add Sale</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Order/Style</th><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-center">Action</th></tr>
            </thead>
            <tbody>
              {buyerOrders.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">কোনো লেনদেন নেই।</td></tr>}
              {buyerOrders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">{new Date(o.date).toLocaleDateString()}</td>
                  <td className="px-3 py-3 font-medium text-brand-navy">{o.orderNo} / {o.styleNo}</td>
                  <td className="px-3 py-3">{o.productName} ({o.qty} pcs)</td>
                  <td className="px-3 py-3 text-right font-bold text-green-600">৳{o.amount}</td>
                  <td className="px-3 py-3 flex justify-center gap-2">
                    <button onClick={() => { setSaleData({ ...o }); setIsEditSale(true); setShowSaleModal(true); }} className="p-1 text-blue-600 bg-blue-50 rounded"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteOrder(o.id, o.type, o.productId, o.qty)} className="p-1 text-red-600 bg-red-50 rounded"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* পার্টি সেল মডাল */}
        {showSaleModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-5 rounded-xl w-full max-w-sm">
              <h3 className="text-lg font-bold mb-4">{isEditSale ? "Edit Sale" : "Add Party Sale"}</h3>
              <form onSubmit={handleSaleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Order No</label><input required className="w-full border p-2 rounded" value={saleData.orderNo} onChange={e => setSaleData({...saleData, orderNo: e.target.value})} /></div>
                  <div><label className="text-xs">Style No</label><input required className="w-full border p-2 rounded" value={saleData.styleNo} onChange={e => setSaleData({...saleData, styleNo: e.target.value})} /></div>
                </div>
                <div>
                  <label className="text-xs font-medium">Search Product</label>
                  <input type="text" placeholder="Type name..." className="w-full border p-2 rounded mb-1" value={prodSearch} onChange={e => setProdSearch(e.target.value)} disabled={isEditSale} />
                  {!isEditSale && (
                    <div className="max-h-24 overflow-y-auto border rounded bg-gray-50">
                      {searchedProducts.map(p => (
                        <div key={p.id} onClick={() => { setSaleData({...saleData, productId: p.id, productName: p.productName, amount: p.costPrice.toString()}); setProdSearch(p.productName); }} className="p-2 text-xs border-b cursor-pointer hover:bg-blue-50">{p.productName} - Stock: {p.stock}</div>
                      ))}
                    </div>
                  )}
                  {isEditSale && <p className="text-xs text-green-600 mt-1">Selected: {saleData.productName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Quantity</label><input required type="number" className="w-full border p-2 rounded" value={saleData.qty} onChange={e => setSaleData({...saleData, qty: e.target.value})} /></div>
                  <div><label className="text-xs">Total Amount (৳)</label><input required type="number" className="w-full border p-2 rounded" value={saleData.amount} onChange={e => setSaleData({...saleData, amount: e.target.value})} /></div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowSaleModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Sale</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 px-2 md:px-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="bg-gray-100 p-2 rounded-lg"><ArrowLeft size={20} /></button>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">Buyers ({shopParam || "All"})</h2>
        </div>
        <button onClick={() => { setBuyerFormData({ id: "", name: "", phone: "", address: "", garmentsName: "", shop: shopParam }); setShowBuyerModal(true); }} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <PlusCircle size={16}/> Add Buyer
        </button>
      </div>

      <div className="bg-white p-2 rounded-lg border flex items-center gap-2 w-full max-w-sm mb-4">
        <Search size={16} className="text-gray-400" />
        <input type="text" placeholder="Search Buyer..." className="outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {buyers.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(buyer => (
          <div key={buyer.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition" onClick={() => setSelectedBuyer(buyer)}>
            <div>
              <p className="font-bold text-brand-navy">{buyer.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Building size={12}/> {buyer.garmentsName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {buyer.phone}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setBuyerFormData(buyer); setShowBuyerModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
              <button onClick={(e) => { e.stopPropagation(); if(window.confirm("ডিলিট করবেন?")) deleteDoc(doc(db, "buyers", buyer.id)); }} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>

      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{buyerFormData.id ? "Edit Buyer" : "Add Buyer"}</h3>
            <form onSubmit={handleBuyerSave} className="space-y-3">
              <div><label className="text-xs">Garments/Company Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.garmentsName} onChange={e => setBuyerFormData({...buyerFormData, garmentsName: e.target.value})} /></div>
              <div><label className="text-xs">Buyer Name</label><input required className="w-full border p-2 rounded" value={buyerFormData.name} onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})} /></div>
              <div><label className="text-xs">Phone</label><input className="w-full border p-2 rounded" value={buyerFormData.phone} onChange={e => setBuyerFormData({...buyerFormData, phone: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBuyerModal(false)} className="px-4 py-2 border rounded">Cancel</button>
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
