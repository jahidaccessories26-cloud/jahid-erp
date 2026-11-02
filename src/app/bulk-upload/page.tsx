// @ts-nocheck
"use client";
import { useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc } from "firebase/firestore";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function BulkUploadPage() {
  const [rawData, setRawData] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // ✅ নতুন আপডেট করা ক্যাটাগরি লজিক
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
    if (n.includes("polertar")) return "Polestar Tube";
    if (n.includes("polestar")) return "Polestar Dosting";
    if (n.includes("canvas")) return "Canvas";
    if (n.includes("bright")) return "Bright Tape";
    if (n.includes("tar")) return "Tar File";
    
    // যদি কোনো ক্যাটাগরি না মেলে, তবে নামের প্রথম ২টা শব্দকে ক্যাটাগরি বানাবে
    const words = name.split(" ");
    if (words.length >= 2) return words.slice(0, 2).join(" ");
    
    return "Others";
  };

  const handleProcess = async () => {
    if (!rawData.trim()) { setMessage("Error: ডেটা পেস্ট করুন!"); return; }
    setLoading(true);
    setMessage("");
    setProcessedCount(0);

    const lines = rawData.trim().split("\n");
    let count = 0;

    const productsRef = collection(db, "products");
    const existingSnapshot = await getDocs(productsRef);
    
    const existingProducts: any[] = existingSnapshot.docs.map(doc => {
      const data: any = doc.data();
      return { id: doc.id, ...data };
    });

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
      
      // ✅ নতুন সাইজ খোঁজার লজিক (7 Inch, 3/4, 12/1 সব ধরবে)
      const sizeMatch = rawName.match(/(\d+(\.\d+)?\s*(CM|MM|Inch|mm|cm)?|\d+\/\d+)/i);
      if (sizeMatch) {
        size = sizeMatch[0].toUpperCase();
      }

      // কালার খোঁজা
      for (const c of colors) {
        if (rawName.toLowerCase().includes(c.toLowerCase())) {
          color = c;
          break;
        }
      }

      // প্রোডাক্টের নাম পরিষ্কার করা
      let productName = category; // ডিফল্টভাবে ক্যাটাগরির নামই প্রোডাক্টের নাম হবে
      
      // যদি নাম থেকে স্পেসিফিক কিছু বের করতে চান, তবে নিচের লজিক কাজ করবে
      // এখানে আমরা rawName থেকে সাইজ, কালার এবং ক্যাটাগরির নাম বাদ দিয়ে বাকি অংশ প্রোডাক্টের নামের সাথে যোগ করছি
      let extraName = rawName;
      if (sizeMatch) extraName = extraName.replace(sizeMatch[0], "");
      extraName = extraName.replace(new RegExp(colors.join("|"), "gi"), "");
      extraName = extraName.replace(/\(.*\)/g, "").replace(/\s+/g, " ").trim();
      extraName = extraName.replace(/Colour/i, "").trim();
      extraName = extraName.replace(new RegExp(category, "gi"), "").trim(); // ক্যাটাগরি নাম বাদ

      if (extraName && category !== "Others") {
         size = `${size} ${extraName}`.trim(); // যেমন: 3/4 Jhalar
      }

      const newVariation = { size: size || "Unknown", color, stock: qty, costPrice: rate };

      const existingProduct = existingProducts.find((p: any) => 
        p.name && p.name.toLowerCase() === productName.toLowerCase() && 
        p.category === category
      );

      if (existingProduct) {
        // ✅ ডাবল চেক লজিক: একই সাইজ ও কালার থাকলে নতুন ভ্যারিয়েশন না বানিয়ে স্টক আপডেট করবে
        const varIndex = existingProduct.variations.findIndex((v: any) => v.size === newVariation.size && v.color === newVariation.color);
        
        if (varIndex >= 0) {
          existingProduct.variations[varIndex].stock += qty;
          existingProduct.variations[varIndex].costPrice = rate; // দাম আপডেট
        } else {
          existingProduct.variations.push(newVariation);
        }

        await updateDoc(doc(db, "products", existingProduct.id), {
          variations: existingProduct.variations
        });
      } else {
        const newDocRef = await addDoc(collection(db, "products"), {
          name: productName,
          category: category,
          variations: [newVariation],
          createdAt: new Date().toISOString()
        });
        
        existingProducts.push({ id: newDocRef.id, name: productName, category: category, variations: [newVariation] });
      }

      count++;
    }

    setProcessedCount(count);
    setMessage(`Success: ${count} টি আইটেম প্রসেস করা হয়েছে!`);
    setLoading(false);
    setRawData("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4">Bulk Product Upload</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-4">
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
