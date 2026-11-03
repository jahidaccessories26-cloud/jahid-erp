// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, setDoc, increment, query, orderBy, onSnapshot } from "firebase/firestore";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function BulkUploadPage() {
  const [rawData, setRawData] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  
  // ✅ নতুন স্টেট: দোকান সিলেক্ট করার জন্য
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");

  // ফায়ারবেস থেকে দোকানের লিস্ট লোড করা
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });
    return () => unsub();
  }, [selectedShop]);

  const getCategory = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("cotton file")) return "Cotton File";
    if (n.includes("cotton loop")) return "Cotton Loop";
    if (n.includes("silk loop")) return "Silk Loop";
    if (n.includes("polestar loop")) return "Polestar Loop";
    if (n.includes("tar loop")) return "Tar Loop";
    if (n.includes("lup")) return "Lup";
    if (n.includes("drow cot")) return "Drow Cot";
    if (n.includes("geza")) return "Geza";
    if (n.includes("tube") || n.includes("catton tube")) return "Cotton Tube";
    if (n.includes("dosting")) return "Cotton Dosting";
    if (n.includes("label")) return "Cotton Label";
    if (n.includes("tape") && !n.includes("bright")) return "Cotton Tape";
    if (n.includes("polertar") || n.includes("polestar tube")) return "Polestar Tube";
    if (n.includes("polestar")) return "Polestar Dosting";
    if (n.includes("canvas")) return "Canvas";
    if (n.includes("bright")) return "Bright Tape";
    if (n.includes("tar")) return "Tar File";
    
    const words = name.split(" ");
    if (words.length >= 2) return words.slice(0, 2).join(" ");
    return "Others";
  };

  const handleProcess = async () => {
    if (!rawData.trim() || !selectedShop) { setMessage("Error: ডেটা পেস্ট করুন এবং দোকান সিলেক্ট করুন!"); return; }
    setLoading(true);
    setMessage("");

    const lines = rawData.trim().split("\n");
    let count = 0;

    for (const line of lines) {
      const parts = line.split("\t").map(p => p.trim());
      if (parts.length < 3) continue;

      const rawName = parts[0];
      const qty = Number(parts[1]) || 0;
      const rate = Number(parts[2]) || 0;
      const category = getCategory(rawName);

      let size = "";
      let color = "Unknown";
      const colors = ["Grey", "White", "Black", "Navy", "Milance", "Zebra", "Red", "Blue", "Green", "Yellow", "Silver", "Cream", "Peach", "Laylon"];
      
      const sizeMatch = rawName.match(/(\d+(\.\d+)?\s*(CM|MM|Inch|mm|cm)?|\d+\/\d+)/i);
      if (sizeMatch) size = sizeMatch[0].toUpperCase();

      for (const c of colors) {
        if (rawName.toLowerCase().includes(c.toLowerCase())) {
          color = c;
          break;
        }
      }

      let productName = category;
      let extraName = rawName;
      if (sizeMatch) extraName = extraName.replace(sizeMatch[0], "");
      extraName = extraName.replace(new RegExp(colors.join("|"), "gi"), "");
      extraName = extraName.replace(/\(.*\)/g, "").replace(/\s+/g, " ").trim();
      extraName = extraName.replace(/Colour/i, "").trim();
      extraName = extraName.replace(new RegExp(category, "gi"), "").trim();

      if (extraName && category !== "Others") {
         size = `${size} ${extraName}`.trim();
      }

      // ✅ দোকানের ইনভেন্টরি আইডি তৈরি (যেমন: Sadoghat_ProductId_Size_Color)
      const shopInvId = `${selectedShop}_${productName}_${size}_${color}`.replace(/\s+/g, '_').replace(/\//g, '-');
      const shopInvRef = doc(db, "shop_inventories", shopInvId);
      const shopInvSnap = await getDocs(query(collection(db, "shop_inventories"))); // চেক করার জন্য
      
      // চেক করা হচ্ছে আগে থেকেই এই প্রোডাক্ট আছে কি না
      const existingItem = shopInvSnap.docs.find(d => d.id === shopInvId);

      if (existingItem) {
        // থাকলে স্টক ও দাম আপডেট হবে
        await updateDoc(shopInvRef, { stock: increment(qty), costPrice: rate });
      } else {
        // না থাকলে নতুন করে যোগ হবে
        await setDoc(shopInvRef, {
          shop: selectedShop, 
          productName: productName, 
          category: category,
          size: size || "Unknown", 
          color: color, 
          stock: qty, 
          costPrice: rate
        });
      }

      // Products কালেকশনেও ডেটা অ্যাড করা (যাতে ওয়্যারহাউস বা অন্যান্য জায়গায় কাজে লাগে)
      const prodQuery = await getDocs(query(collection(db, "products")));
      const existingProduct = prodQuery.docs.find(d => d.data().name === productName && d.data().category === category);
      
      if (existingProduct) {
         let variations = existingProduct.data().variations;
         let varIdx = variations.findIndex((v:any) => v.size === (size || "Unknown") && v.color === color);
         if(varIdx >= 0){
           variations[varIdx].stock += qty;
           variations[varIdx].costPrice = rate;
         } else {
           variations.push({size: size || "Unknown", color, stock: qty, costPrice: rate});
         }
         await updateDoc(doc(db, "products", existingProduct.id), { variations });
      } else {
         await addDoc(collection(db, "products"), {
            name: productName,
            category: category,
            variations: [{ size: size || "Unknown", color, stock: qty, costPrice: rate }],
            createdAt: new Date().toISOString()
         });
      }

      count++;
    }
    
    setMessage(`Success: ${count} টি আইটেম ${selectedShop}-এ সফলভাবে আপলোড হয়েছে!`);
    setLoading(false);
    setRawData("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4">Bulk Product Upload</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-4">
        
        {/* ✅ দোকান সিলেক্ট করার ড্রপডাউন */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Shop (দোকান সিলেক্ট করুন)</label>
          <select 
            className="w-full border p-2 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-brand-navy"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            {shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Paste Excel Data (Name, Qty, Rate)</label>
          <textarea 
            rows={10} 
            className="w-full border p-2 rounded-lg text-sm font-mono" 
            placeholder="সব ডেটা একসাথে পেস্ট করুন..." 
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
          ></textarea>
        </div>

        <button onClick={handleProcess} disabled={loading} className="bg-brand-navy text-white px-6 py-2 rounded-lg font-medium text-sm w-full flex items-center justify-center gap-2 hover:bg-brand-navy/90 disabled:bg-gray-400">
          {loading ? "Processing..." : <><Upload size={16}/> Process All Data</>}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg font-medium flex items-center gap-2 ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message.includes("Error") ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
          {message}
        </div>
      )}
    </div>
  );
}
