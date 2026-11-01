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

  const getCategory = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("tube")) return "Cotton Tube";
    if (n.includes("dosting")) return "Cotton Dosting";
    if (n.includes("label")) return "Cotton Label";
    if (n.includes("tape") && !n.includes("bright")) return "Cotton Tape";
    if (n.includes("polertar")) return "Polyester Tube";
    if (n.includes("polestar")) return "Polyester Dosting";
    if (n.includes("canvas")) return "Canvas";
    if (n.includes("bright")) return "Bright Tape";
    if (n.includes("tar")) return "Tar File";
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
    const existingProducts = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const line of lines) {
      const parts = line.split("\t").map(p => p.trim());
      if (parts.length < 3) continue;

      const rawName = parts[0];
      const qty = Number(parts[1]) || 0;
      const rate = Number(parts[2]) || 0;

      const category = getCategory(rawName);

      let size = "";
      let color = "Unknown";
      const colors = ["Grey", "White", "Black", "Navy", "Milance", "Zebra", "Red", "Blue", "Green", "Yellow", "Silver", "Cream", "Peach"];
      
      const sizeMatch = rawName.match(/(\d+(\.\d+)?\s*(CM|MM|CM\.|MM\.))/i);
      if (sizeMatch) size = sizeMatch[0].toUpperCase();

      for (const c of colors) {
        if (rawName.toLowerCase().includes(c.toLowerCase())) {
          color = c;
          break;
        }
      }

      let productName = rawName;
      if (sizeMatch) productName = productName.replace(sizeMatch[0], "");
      productName = productName.replace(new RegExp(colors.join("|"), "gi"), "");
      productName = productName.replace(/\(.*\)/g, "").replace(/\s+/g, " ").trim();
      productName = productName.replace(/Colour/i, "").trim();
      
      if (!productName) productName = rawName;

      const existingProduct = existingProducts.find(p => 
        p.name.toLowerCase() === productName.toLowerCase() && 
        p.category === category
      );

      // এখানে সেলিং প্রাইস বাদ দেওয়া হলো
      const newVariation = { 
        size, 
        color, 
        stock: qty, 
        costPrice: rate
      };

      if (existingProduct) {
        await updateDoc(doc(db, "products", existingProduct.id), {
          variations: [...existingProduct.variations, newVariation]
        });
        existingProduct.variations.push(newVariation);
      } else {
        const newDocRef = await addDoc(collection(db, "products"), {
          name: productName,
          category: category,
          variations: [newVariation],
          createdAt: new Date().toISOString()
        });
        
        existingProducts.push({
          id: newDocRef.id,
          name: productName,
          category: category,
          variations: [newVariation]
        });
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
