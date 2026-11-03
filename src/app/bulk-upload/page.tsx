// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, setDoc, increment, query, onSnapshot } from "firebase/firestore";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function BulkUploadPage() {
  const [rawData, setRawData] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "shops")), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setShops(data);
      if (data.length > 0 && !selectedShop) setSelectedShop(data[0].name);
    });
    return () => unsub();
  }, [selectedShop]);

  const parseCategories = (name: string) => {
    const n = name.toLowerCase();
    let mainCategory = "Others";
    let subCategory = "Others";

    if (n.includes("cotton") || n.includes("catton")) mainCategory = "Cotton";
    else if (n.includes("polestar") || n.includes("polertar")) mainCategory = "Polestar";

    if (mainCategory === "Cotton") {
      if (n.includes("solder tape")) subCategory = "Cotton Solder Tape";
      else if (n.includes("file")) subCategory = "Cotton File";
      else if (n.includes("label")) subCategory = "Cotton Label";
      else if (n.includes("tape")) subCategory = "Cotton Tape";
      else if (n.includes("canvas")) subCategory = "Cotton Canvas";
      else if (n.includes("loop")) subCategory = "Cotton Loop";
      else if (n.includes("lup")) subCategory = "Cotton Lup";
      else if (n.includes("beni")) subCategory = "Cotton Beni";
      else if (n.includes("rubber dosting") || n.includes("ra dosting")) subCategory = "Cotton Rubber Dosting";
      else if (n.includes("dosting")) subCategory = "Cotton Dosting";
      else if (n.includes("tube")) subCategory = "Cotton Tube";
      else subCategory = "Cotton Others";
    } else if (mainCategory === "Polestar") {
      if (n.includes("loop")) subCategory = "Polestar Loop";
      else if (n.includes("canvas")) subCategory = "Polestar Canvas";
      else if (n.includes("tube")) subCategory = "Polestar Tube";
      else if (n.includes("label")) subCategory = "Polestar Label";
      else if (n.includes("dosting")) subCategory = "Polestar Dosting";
      else subCategory = "Polestar Others";
    } else {
      subCategory = name.split(" ").slice(0, 2).join(" ");
    }
    return { mainCategory, subCategory };
  };

  const handleProcess = async () => {
    if (!rawData.trim() || !selectedShop) { setMessage("Error: ডেটা পেস্ট করুন এবং দোকান সিলেক্ট করুন!"); return; }
    setLoading(true);
    setMessage("");

    const lines = rawData.trim().split("\n");
    let count = 0;

    try {
      // ✅ ১. একবারেই সব ডেটা লোড করা হচ্ছে (রিড বাঁচানোর জন্য)
      const shopInvSnapshot = await getDocs(query(collection(db, "shop_inventories")));
      const existingShopItems: any[] = shopInvSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const prodSnapshot = await getDocs(query(collection(db, "products")));
      const existingProducts: any[] = prodSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const line of lines) {
        const parts = line.split("\t").map(p => p.trim());
        if (parts.length < 3) continue;

        const rawName = parts[0];
        const qty = Number(parts[1]) || 0;
        const rate = Number(parts[2]) || 0;
        
        const { mainCategory, subCategory } = parseCategories(rawName);

        let size = "";
        let color = "Unknown";
        const colors = ["Grey", "White", "Black", "Navy", "Milance", "Zebra", "Red", "Blue", "Green", "Yellow", "Silver", "Cream", "Peach", "Laylon"];
        
        const sizeMatch = rawName.match(/(\d+(\.\d+)?\s*(CM|MM|Inch|mm|cm)?|\d+\/\d+)/i);
        if (sizeMatch) size = sizeMatch[0].toUpperCase();

        for (const c of colors) {
          if (rawName.toLowerCase().includes(c.toLowerCase())) { color = c; break; }
        }

        let productName = subCategory;
        let extraName = rawName;
        if (sizeMatch) extraName = extraName.replace(sizeMatch[0], "");
        extraName = extraName.replace(new RegExp(colors.join("|"), "gi"), "");
        extraName = extraName.replace(/\(.*\)/g, "").replace(/\s+/g, " ").trim();
        extraName = extraName.replace(/Colour/i, "").trim();
        extraName = extraName.replace(new RegExp(subCategory, "gi"), "").trim();

        if (extraName && subCategory !== "Others") {
           size = `${size} ${extraName}`.trim();
        }

        const shopInvId = `${selectedShop}_${productName}_${size}_${color}`.replace(/\s+/g, '_').replace(/\//g, '-');
        
        // ✅ ২. মেমরি থেকে চেক করা হচ্ছে, ডেটাবেস থেকে নয়
        const existingShopItem = existingShopItems.find(item => item.id === shopInvId);

        if (existingShopItem) {
          await updateDoc(doc(db, "shop_inventories", shopInvId), { stock: increment(qty), costPrice: rate });
        } else {
          await setDoc(doc(db, "shop_inventories", shopInvId), {
            shop: selectedShop, productName: productName, category: subCategory, 
            mainCategory: mainCategory, subCategory: subCategory,
            size: size || "Unknown", color: color, stock: qty, costPrice: rate
          });
          // নতুন অ্যাড হলেও মেমরিতে পুশ করে দিচ্ছি, যাতে পরের লাইনে কাজে লাগে
          existingShopItems.push({ id: shopInvId, shop: selectedShop, productName, subCategory, size: size || "Unknown", color });
        }

        const existingProduct = existingProducts.find(d => d.name === productName && d.subCategory === subCategory);
        
        if (existingProduct) {
           let variations = existingProduct.variations || [];
           let varIdx = variations.findIndex((v:any) => v.size === (size || "Unknown") && v.color === color);
           if(varIdx >= 0){
             variations[varIdx].stock += qty;
             variations[varIdx].costPrice = rate;
           } else {
             variations.push({size: size || "Unknown", color, stock: qty, costPrice: rate});
           }
           await updateDoc(doc(db, "products", existingProduct.id), { variations });
        } else {
           const newProd = await addDoc(collection(db, "products"), {
              name: productName, category: subCategory, mainCategory: mainCategory, subCategory: subCategory,
              variations: [{ size: size || "Unknown", color, stock: qty, costPrice: rate }],
              createdAt: new Date().toISOString()
           });
           // মেমরিতে পুশ করা হচ্ছে
           existingProducts.push({ id: newProd.id, name: productName, subCategory, variations: [{ size: size || "Unknown", color, stock: qty, costPrice: rate }] });
        }
        count++;
      }
      setMessage(`Success: ${count} টি আইটেম ${selectedShop}-এ সফলভাবে আপলোড হয়েছে!`);
    } catch (error) {
      console.error(error);
      setMessage("Error: আপলোড করতে সমস্যা হয়েছে। ডেটা ফরম্যাট চেক করুন।");
    }
    
    setLoading(false);
    setRawData("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4">Bulk Product Upload</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-4">
        
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
