// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../lib/firebase";
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc,
  increment, getDoc, setDoc, deleteDoc, runTransaction,
} from "firebase/firestore";
import { Package, Search, Edit, X, PlusCircle, ShoppingCart, Trash2, Factory, History, User, Filter, Calendar, Check, ChevronUp, ChevronDown, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // কার্ট সিস্টেম
  const [cart, setCart] = useState<any[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // হিস্ট্রি ফিল্টার
  const [historyShopFilter, setHistoryShopFilter] = useState("All");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  // ইউজার ডেটা
  const [currentUserName, setCurrentUserName] = useState("Admin");

  // প্রোডাকশন স্টেট
  const [showProdModal, setShowProdModal] = useState(false);
  const [prodData, setProdData] = useState({ productName: "", category: "", size: "", color: "", qty: "", costPrice: "" });

  // সাজেশন স্টেট
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // এডিট স্টেট (প্রোডাক্ট)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ productId: "", varIndex: -1, newStock: 0, newPrice: 0 });

  // এডিট/ডিলিট স্টেট (হিস্ট্রি লেনদেনের জন্য)
  const [showLogEditModal, setShowLogEditModal] = useState(false);
  const [editLogData, setEditLogData] = useState({ logId: "", newQty: 0, newTotalPrice: 0, oldQty: 0, shop: "", productName: "", size: "", color: "", type: "" });

  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setCurrentUserName("Admin (Jahid)");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setCurrentUserName(`${docSnap.data().name || user.email} (${docSnap.data().role})`);
          }
        }
      }
    });

    const unsubProducts = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCategories = onSnapshot(query(collection(db, "categories")), (snapshot) => {
      setDbCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubShops = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });

    const unsubTransfers = onSnapshot(query(collection(db, "stock_logs"), orderBy("createdAt", "desc")), (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransfers(allLogs.filter((log: any) => log.type === "Warehouse Transfer" || log.type === "Production Inward"));
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubAuth(); unsubProducts(); unsubCategories(); unsubShops(); unsubTransfers();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedShop]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allCategories = Array.from(new Set([...dbCategories.map(c => c.name), ...products.map(p => p.category)])).filter(Boolean);
  const uniqueProductNames = Array.from(new Set(products.map(p => p.name)));
  const filteredSuggestions = uniqueProductNames.filter(name => name.toLowerCase().includes(prodData.productName.toLowerCase()));

  const filteredHistory = transfers.filter(t => {
    const matchShop = historyShopFilter === "All" || t.shop === historyShopFilter;
    let matchDate = true;
    if (t.createdAt) {
      const logDate = t.createdAt.split('T')[0];
      if (historyStartDate && logDate < historyStartDate) matchDate = false;
      if (historyEndDate && logDate > historyEndDate) matchDate = false;
    } else {
      matchDate = false;
    }
    return matchShop && matchDate;
  });

  const totalPcs = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const downloadPDF = async () => {
    if (filteredHistory.length === 0) {
      alert("ডাউনলোড করার জন্য কোনো ডেটা নেই!");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("786 Jahid Accessories - Warehouse Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Shop: ${historyShopFilter === "All" ? "All Shops" : historyShopFilter}`, 14, 22);
    doc.text(`Date: ${historyStartDate || "Start"} to ${historyEndDate || "Today"}`, 14, 28);

    const tableData = filteredHistory.map(log => [
      new Date(log.createdAt).toLocaleDateString(),
      log.productName,
      `${log.size}/${log.color}`,
      log.quantity,
      `৳${log.totalPrice || 0}`,
      log.shop,
      log.transferredBy || "System"
    ]);

    autoTable(doc, {
      head: [['Date', 'Product', 'Size/Color', 'Qty', 'Total Price', 'Destination', 'By']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 45, 92] },
    });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Warehouse_Report_${Date.now()}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Warehouse Report',
          text: 'Here is the warehouse stock report from 786 Jahid Accessories.',
        });
      } catch (error) { console.log('Share canceled or failed', error); }
    } else {
      doc.save(`Warehouse_Report_${Date.now()}.pdf`);
    }
  };

  const addToCart = (product: any, varIndex: number) => {
    const variation = product.variations[varIndex];
    const existingIndex = cart.findIndex(c => c.productId === product.id && c.varIndex === varIndex);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty = Number(newCart[existingIndex].qty) + 1;
      setCart(newCart);
    } else {
      setCart([...cart, { productId: product.id, varIndex, name: product.name, size: variation.size, color: variation.color, qty: "1", maxStock: variation.stock, costPrice: variation.costPrice || 0 }]);
    }
    setMessage(`Success: ${product.name} কার্টে যোগ হয়েছে!`);
    setTimeout(() => setMessage(""), 2000);
  };

  const updateCartQty = (index: number, qty: string) => {
    const newCart = [...cart];
    newCart[index].qty = qty;
    setCart(newCart);
  };

  const confirmCartQty = (index: number) => {
    const item = cart[index];
    const qty = Number(item.qty);
    if (qty <= 0) {
      alert("পরিমাণ ০ এর বেশি হতে হবে!");
      updateCartQty(index, "1");
    } else if (qty > item.maxStock) {
      alert(`সর্বোচ্চ ${item.maxStock} পিস দেওয়া যাবে!`);
      updateCartQty(index, String(item.maxStock));
    }
  };

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const handleBulkTransfer = async () => {
    if (cart.length === 0 || !selectedShop) { setMessage("Error: কার্টে আইটেম নেই বা দোকান সিলেক্ট করা হয়নি!"); return; }
    const invalidItem = cart.find(item => Number(item.qty) <= 0);
    if (invalidItem) { setMessage(`Error: ${invalidItem.name}-এর পরিমাণ সঠিকভাবে দিন!`); return; }

    try {
      for (const item of cart) {
        if (Number(item.qty) > item.maxStock) { setMessage(`Error: ${item.name}-এর স্টক পর্যাপ্ত নয়!`); return; }
        const product = products.find(p => p.id === item.productId);
        const variation = product.variations[item.varIndex];
        const qty = Number(item.qty);
        const totalPrice = qty * (variation.costPrice || 0);

        const updatedVariations = [...product.variations];
        updatedVariations[item.varIndex].stock -= qty;
        await updateDoc(doc(db, "products", product.id), { variations: updatedVariations });

        const shopInvId = `${selectedShop}_${product.id}_${variation.size}_${variation.color}`.replace(/\s+/g, '_');
        const shopInvRef = doc(db, "shop_inventories", shopInvId);
        const shopInvSnap = await getDoc(shopInvRef);

        if (shopInvSnap.exists()) {
          await updateDoc(shopInvRef, { stock: increment(qty) });
        } else {
          await setDoc(shopInvRef, {
            shop: selectedShop, productName: product.name, category: product.category,
            size: variation.size, color: variation.color, stock: qty, costPrice: variation.costPrice || 0
          });
        }

        await addDoc(collection(db, "stock_logs"), {
          shop: selectedShop,
          productId: product.id,               // ✅ future-proof edit/delete
          productName: product.name,
          size: variation.size,
          color: variation.color,
          quantity: qty,
          totalPrice: totalPrice,
          type: "Warehouse Transfer",
          transferredBy: currentUserName,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
      setMessage(`Success: ${cart.length} টি আইটেম ${selectedShop}-এ পাঠানো হয়েছে!`);
      setCart([]);
      setCartOpen(false);
    } catch (error) { setMessage("ট্রান্সফার করতে সমস্যা হয়েছে!"); }
  };

  const handleProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productName, category, size, color, qty, costPrice } = prodData;
    const numQty = Number(qty);
    const numCost = Number(costPrice) || 0;

    if (!productName || !category || !size || !color || numQty <= 0) { setMessage("Error: সব তথ্য সঠিকভাবে দিন!"); return; }

    try {
      let existingProduct = products.find(p => p.name.toLowerCase() === productName.toLowerCase() && p.category === category);
      let productId: string;

      if (existingProduct) {
        productId = existingProduct.id;
        let updatedVariations = [...(existingProduct.variations || [])];
        const existingIndex = updatedVariations.findIndex(v => v.size === size && v.color === color);
        if (existingIndex >= 0) {
          updatedVariations[existingIndex].stock += numQty;
          if (numCost > 0) updatedVariations[existingIndex].costPrice = numCost;
        } else {
          updatedVariations.push({ size, color, stock: numQty, costPrice: numCost });
        }
        await updateDoc(doc(db, "products", existingProduct.id), { variations: updatedVariations });
      } else {
        const newProdRef = await addDoc(collection(db, "products"), {
          name: productName, category: category,
          variations: [{ size, color, stock: numQty, costPrice: numCost }],
          createdAt: new Date().toISOString()
        });
        productId = newProdRef.id;
      }

      await addDoc(collection(db, "stock_logs"), {
        productId: productId,                  // ✅ future-proof edit/delete
        shop: "Warehouse", productName, size, color,
        quantity: numQty, totalPrice: numQty * numCost, type: "Production Inward",
        transferredBy: currentUserName,
        date: new Date().toISOString(), createdAt: new Date().toISOString()
      });

      setMessage(`Success: ${numQty} পিস ${productName} যোগ হয়েছে!`);
      setShowProdModal(false);
      setProdData({ productName: "", category: "", size: "", color: "", qty: "", costPrice: "" });
    } catch (error) { setMessage("প্রোডাকশন যোগ করতে সমস্যা হয়েছে!"); }
  };

  // প্রোডাক্টের স্টক/দাম সরাসরি এডিট
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, varIndex, newStock, newPrice } = editData;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      const updatedVariations = [...product.variations];
      updatedVariations[varIndex].stock = Number(newStock);
      updatedVariations[varIndex].costPrice = Number(newPrice);
      await updateDoc(doc(db, "products", productId), { variations: updatedVariations });
      setMessage("Success: স্টক ও দাম আপডেট হয়েছে!");
      setShowEditModal(false);
    } catch (error) { setMessage("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  // ------------------------------------------------------------------
  // হেল্পার: লগের প্রোডাক্ট খুঁজে বের করা (productId আগে, না থাকলে fallback)
  // ------------------------------------------------------------------
  const resolveProductInTransaction = async (transaction: any, logData: any) => {
    let productRef: any = null;
    let product: any = null;

    if (logData.productId) {
      productRef = doc(db, "products", logData.productId);
      const snap = await transaction.get(productRef);
      if (snap.exists()) product = { id: snap.id, ...snap.data() };
    }

    if (!product) {
      // Fallback: state থেকে name + size + color মিলিয়ে খোঁজা
      const found = products.find(p =>
        p.name === logData.productName &&
        (p.variations || []).some((v: any) => v.size === logData.size && v.color === logData.color)
      );
      if (found) {
        productRef = doc(db, "products", found.id);
        const snap = await transaction.get(productRef);
        if (snap.exists()) product = { id: snap.id, ...snap.data() };
      }
    }

    return { product, productRef };
  };

  // ------------------------------------------------------------------
  // EDIT history log (atomic: products + shop_inventories + stock_logs)
  // ------------------------------------------------------------------
  const handleLogEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { logId, newQty, newTotalPrice } = editLogData;

    if (newQty <= 0) {
      alert("পরিমাণ ০ এর বেশি হতে হবে!");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // ১. লগ রিড
        const logRef = doc(db, "stock_logs", logId);
        const logSnap = await transaction.get(logRef);
        if (!logSnap.exists()) throw new Error("Stock log not found");
        const logData = logSnap.data();

        const diffQty = Number(newQty) - Number(logData.quantity); // + = বাড়ানো, - = কমানো

        // ২. প্রোডাক্ট খোঁজা
        const { product, productRef } = await resolveProductInTransaction(transaction, logData);
        if (!product) throw new Error("Product not found");

        const variations = [...(product.variations || [])];
        const varIndex = variations.findIndex((v: any) => v.size === logData.size && v.color === logData.color);
        if (varIndex < 0) throw new Error("Variation not found");

        if (logData.type === "Warehouse Transfer") {
          // ওয়্যারহাউস: diff>0 হলে স্টক কমবে, diff<0 হলে বাড়বে
          const newWhStock = (variations[varIndex].stock || 0) - diffQty;
          if (newWhStock < 0) throw new Error("Warehouse stock insufficient for this increase");
          variations[varIndex].stock = newWhStock;
          transaction.update(productRef, { variations });

          // দোকান: diff>0 হলে বাড়বে, diff<0 হলে কমবে
          const shopInvId = `${logData.shop}_${product.id}_${logData.size}_${logData.color}`.replace(/\s+/g, "_");
          const shopInvRef = doc(db, "shop_inventories", shopInvId);
          const shopInvSnap = await transaction.get(shopInvRef);

          if (shopInvSnap.exists()) {
            transaction.update(shopInvRef, { stock: increment(diffQty) });
          } else if (diffQty > 0) {
            transaction.set(shopInvRef, {
              shop: logData.shop,
              productName: logData.productName,
              category: product.category || "",
              size: logData.size,
              color: logData.color,
              stock: diffQty,
              costPrice: variations[varIndex].costPrice || 0,
            });
          }
        } else if (logData.type === "Production Inward") {
          // প্রোডাকশন: diff>0 হলে ওয়্যারহাউস স্টক বাড়বে, diff<0 হলে কমবে
          const newWhStock = (variations[varIndex].stock || 0) + diffQty;
          if (newWhStock < 0) throw new Error("Warehouse stock insufficient for this decrease");
          variations[varIndex].stock = newWhStock;
          transaction.update(productRef, { variations });
        }

        // ৩. লগ আপডেট
        transaction.update(logRef, {
          quantity: Number(newQty),
          totalPrice: Number(newTotalPrice),
        });
      });

      setMessage("Success: লেনদেন সফলভাবে আপডেট হয়েছে!");
      setShowLogEditModal(false);
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error?.message || "আপডেট করতে সমস্যা হয়েছে!"}`);
    }
  };

  // ------------------------------------------------------------------
  // DELETE history log (atomic)
  // ------------------------------------------------------------------
  const handleLogDelete = async () => {
    if (!confirm("আপনি কি নিশ্চিত এই লেনদেনটি ডিলিট করতে চান? (ডিলিট করলে স্টক আগের অবস্থায় ফিরে যাবে)")) return;

    const { logId } = editLogData;

    try {
      await runTransaction(db, async (transaction) => {
        const logRef = doc(db, "stock_logs", logId);
        const logSnap = await transaction.get(logRef);
        if (!logSnap.exists()) throw new Error("Stock log not found");
        const logData = logSnap.data();
        const qty = Number(logData.quantity);

        const { product, productRef } = await resolveProductInTransaction(transaction, logData);

        if (logData.type === "Warehouse Transfer") {
          if (!product) throw new Error("Product not found");

          // ওয়্যারহাউস স্টকে ফেরত যোগ
          const variations = [...(product.variations || [])];
          const varIndex = variations.findIndex((v: any) => v.size === logData.size && v.color === logData.color);
          if (varIndex < 0) throw new Error("Variation not found");
          variations[varIndex].stock = (variations[varIndex].stock || 0) + qty;
          transaction.update(productRef, { variations });

          // দোকানের স্টক থেকে বিয়োগ
          const shopInvId = `${logData.shop}_${product.id}_${logData.size}_${logData.color}`.replace(/\s+/g, "_");
          const shopInvRef = doc(db, "shop_inventories", shopInvId);
          const shopInvSnap = await transaction.get(shopInvRef);
          if (shopInvSnap.exists()) {
            const current = shopInvSnap.data().stock || 0;
            transaction.update(shopInvRef, { stock: Math.max(0, current - qty) });
          }
        } else if (logData.type === "Production Inward") {
          if (!product) throw new Error("Product not found");

          // প্রোডাকশন হলে ওয়্যারহাউস থেকে বাদ
          const variations = [...(product.variations || [])];
          const varIndex = variations.findIndex((v: any) => v.size === logData.size && v.color === logData.color);
          if (varIndex < 0) throw new Error("Variation not found");
          variations[varIndex].stock = Math.max(0, (variations[varIndex].stock || 0) - qty);
          transaction.update(productRef, { variations });
        }

        // লগ ডিলিট
        transaction.delete(logRef);
      });

      setMessage("Success: লেনদেন ডিলিট হয়েছে!");
      setShowLogEditModal(false);
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error?.message || "ডিলিট করতে সমস্যা হয়েছে!"}`);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto ${cart.length > 0 ? "pb-24" : "pb-6"}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-brand-navy">Warehouse Stock</h2>
        <button onClick={() => { setProdData({ productName: "", category: "", size: "", color: "", qty: "", costPrice: "" }); setShowProdModal(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
          <Factory size={16} /> Add Production
        </button>
      </div>

      {message && <div className={`p-3 mb-4 rounded-lg font-medium text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-3 border-b bg-gray-50 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><History size={16} /> Recent Activities</h3>
            <button onClick={downloadPDF} className="bg-brand-navy text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-navy/90">
              <Download size={14} /> PDF / Share
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <select className="text-xs font-medium outline-none bg-white border rounded-lg px-2 py-1.5 flex-1" value={historyShopFilter} onChange={(e) => setHistoryShopFilter(e.target.value)}>
              <option value="All">All Shops</option>
              {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1 flex-1">
              <span className="text-[10px] text-gray-500 font-bold">From</span>
              <input type="date" className="text-xs outline-none bg-transparent w-full" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1 flex-1">
              <span className="text-[10px] text-gray-500 font-bold">To</span>
              <input type="date" className="text-xs outline-none bg-transparent w-full" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-50 space-y-2 max-h-80 overflow-y-auto">
          {filteredHistory.length === 0 && <div className="text-center py-4 text-gray-500 text-sm">কোনো লেনদেন নেই।</div>}
          {filteredHistory.map(log => (
            <div key={log.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2 relative">

              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => {
                    setEditLogData({
                      logId: log.id,
                      newQty: log.quantity,
                      newTotalPrice: log.totalPrice || 0,
                      oldQty: log.quantity,
                      shop: log.shop,
                      productName: log.productName,
                      size: log.size,
                      color: log.color,
                      type: log.type
                    });
                    setShowLogEditModal(true);
                  }}
                  className="text-blue-500 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md"
                >
                  <Edit size={14} />
                </button>
              </div>

              <div className="flex justify-between items-start border-b pb-2 pr-8">
                <div>
                  <span className="font-bold text-brand-navy text-sm">{log.productName}</span>
                  <span className="text-[11px] text-gray-500 block">{log.size}/{log.color}</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${log.type === "Warehouse Transfer" ? "text-red-600" : "text-green-600"}`}>
                    {log.type === "Warehouse Transfer" ? "-" : "+"}{log.quantity} pcs
                  </span>
                  <span className="text-[11px] text-gray-600 block font-bold">৳{log.totalPrice || 0}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-600">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">Date: {new Date(log.createdAt).toLocaleDateString()}</span>
                  <span>By: {log.transferredBy || "System"}</span>
                </div>
                <div className="text-right">
                  <span className="bg-gray-100 px-2 py-1 rounded font-medium">{log.shop}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-2">
        <Search size={18} className="text-gray-400 ml-2" />
        <input type="text" placeholder="Search product..." className="w-full bg-transparent outline-none text-sm py-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 mb-3 border-b pb-2">
              <div className="bg-brand-navy/10 p-1.5 rounded-lg"><Package className="text-brand-navy" size={20} /></div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">{product.name}</h3>
                <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{product.category}</span>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left mb-3">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr><th className="px-2 py-2">Size/Color</th><th className="px-2 py-2 text-right">Stock</th><th className="px-2 py-2 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {product.variations.map((v: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-3 font-medium">
                        {v.size} / {v.color}
                        <div className="text-[11px] text-gray-500 font-bold">৳ {v.costPrice || 0}</div>
                      </td>
                      <td className="px-2 py-3 text-right font-bold text-brand-navy">{v.stock}</td>
                      <td className="px-2 py-3 text-center flex justify-center gap-2">
                        <button onClick={() => { setEditData({ productId: product.id, varIndex: i, newStock: v.stock, newPrice: v.costPrice }); setShowEditModal(true); }} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition"><Edit size={18} /></button>
                        <button onClick={() => addToCart(product, i)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition"><PlusCircle size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <>
          {cartOpen && (
            <div onClick={() => setCartOpen(false)} className="fixed inset-0 bg-black/40 z-40 md:hidden" />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-brand-navy shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-brand-navy text-white">
              <button onClick={() => setCartOpen(!cartOpen)} className="flex items-center gap-2 flex-1 text-left">
                <ShoppingCart size={20} />
                <div>
                  <p className="font-bold text-sm">{cart.length} items • {totalPcs} pcs</p>
                  <p className="text-[11px] text-white/70">Tap to {cartOpen ? "collapse" : "view"} cart</p>
                </div>
              </button>
              <button onClick={() => setCartOpen(!cartOpen)} className="p-2 rounded-lg hover:bg-white/10">
                {cartOpen ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
              </button>
            </div>

            {cartOpen && (
              <div className="overflow-y-auto max-h-[70vh] px-3 md:px-4 py-3">
                <div className="space-y-2 mb-3">
                  {cart.map((item, i) => (
                    <div key={i} className="bg-gray-50 border rounded-lg p-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-brand-navy text-sm truncate">{item.name}</p>
                        <p className="text-[11px] text-gray-500">{item.size}/{item.color} • ৳{item.costPrice}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={item.maxStock}
                        className="w-16 md:w-20 border p-1.5 rounded-lg text-center font-bold text-sm"
                        value={item.qty}
                        onChange={(e) => updateCartQty(i, e.target.value)}
                        onBlur={() => confirmCartQty(i)}
                      />
                      <button onClick={() => removeFromCart(i)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pb-2">
                  <select className="border-2 border-gray-300 p-3 rounded-lg text-sm font-medium w-full" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
                    {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (confirm("সব আইটেম কার্ট থেকে মুছে ফেলবেন?")) { setCart([]); setCartOpen(false); } }}
                      className="flex-1 border-2 border-red-500 text-red-500 py-3 rounded-lg font-medium text-sm hover:bg-red-50"
                    >
                      Clear All
                    </button>
                    <button onClick={handleBulkTransfer} className="flex-[2] bg-brand-navy text-white py-3 rounded-lg font-bold text-sm hover:bg-brand-navy/90">
                      Transfer All →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showProdModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-navy mb-4">Add New Production</h3>
            <form onSubmit={handleProduction} className="space-y-3">
              <div className="relative" ref={suggestionRef}>
                <label className="block text-xs font-medium mb-1">Product Name (Type New or Old)</label>
                <input required placeholder="e.g. Cotton Tube" className="w-full border p-2 rounded-lg text-sm" value={prodData.productName} onChange={(e) => { setProdData({ ...prodData, productName: e.target.value }); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
                {showSuggestions && prodData.productName && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredSuggestions.map(name => (
                      <div key={name} className="p-2 text-sm hover:bg-blue-50 cursor-pointer" onClick={() => { setProdData({ ...prodData, productName: name }); setShowSuggestions(false); }}>{name}</div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select required className="w-full border p-2 rounded-lg text-sm" value={prodData.category} onChange={(e) => setProdData({ ...prodData, category: e.target.value })}>
                  <option value="" disabled>-- Select Category --</option>
                  {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-medium mb-1">Size</label><input required placeholder="e.g. 5 MM" className="w-full border p-2 rounded-lg text-sm" value={prodData.size} onChange={(e) => setProdData({ ...prodData, size: e.target.value })} /></div>
                <div><label className="block text-xs font-medium mb-1">Color</label><input required placeholder="e.g. Black" className="w-full border p-2 rounded-lg text-sm" value={prodData.color} onChange={(e) => setProdData({ ...prodData, color: e.target.value })} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1">Production Quantity (pcs)</label><input required type="number" min="1" className="w-full border p-2 rounded-lg text-sm font-bold" value={prodData.qty} onChange={(e) => setProdData({ ...prodData, qty: e.target.value })} /></div>
              <div><label className="block text-xs font-medium mb-1">Cost Price (৳)</label><input type="number" min="0" className="w-full border p-2 rounded-lg text-sm" value={prodData.costPrice} onChange={(e) => setProdData({ ...prodData, costPrice: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowProdModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Add to Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* এডিট মডাল (প্রোডাক্ট) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-navy mb-4">Edit Warehouse Stock</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div><label className="block text-xs font-medium mb-1">New Stock</label><input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newStock} onChange={(e) => setEditData({ ...editData, newStock: Number(e.target.value) })} /></div>
              <div><label className="block text-xs font-medium mb-1">Cost Price (৳)</label><input required type="number" min="0" className="w-full border p-2 rounded-lg font-bold" value={editData.newPrice} onChange={(e) => setEditData({ ...editData, newPrice: Number(e.target.value) })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ এডিট + ডিলিট মডাল (হিস্ট্রি লেনদেনের জন্য) */}
      {showLogEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-navy mb-2">Edit History</h3>
            <p className="text-xs text-gray-500 mb-4">{editLogData.productName} ({editLogData.size}/{editLogData.color}) - {editLogData.shop}</p>

            <form onSubmit={handleLogEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">New Quantity (পরিমাণ)</label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full border p-2 rounded-lg font-bold"
                  value={editLogData.newQty}
                  onChange={(e) => setEditLogData({ ...editLogData, newQty: Number(e.target.value) })}
                />
                <p className="text-[10px] text-gray-400 mt-1">(পরিমাণ বাড়ালে বা কমালে ওয়্যারহাউস ও দোকানের স্টক অটোমেটিক আপডেট হবে)</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">New Total Price (৳)</label>
                <input
                  required
                  type="number"
                  min="0"
                  className="w-full border p-2 rounded-lg font-bold"
                  value={editLogData.newTotalPrice}
                  onChange={(e) => setEditLogData({ ...editLogData, newTotalPrice: Number(e.target.value) })}
                />
              </div>
              <div className="flex justify-between gap-2 pt-3 border-t mt-2">
                <button type="button" onClick={handleLogDelete} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200">
                  ডিলিট করুন
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowLogEditModal(false)} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
