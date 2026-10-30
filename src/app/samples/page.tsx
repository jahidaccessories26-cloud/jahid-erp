"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { Clock, Factory, UserCheck, PlusCircle } from "lucide-react";

export default function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ styleNo: "", buyerName: "", quantity: "" });

  // ফায়ারবেস থেকে ডেটা রিড করা
  useEffect(() => {
    const q = query(collection(db, "samples"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSamples(data);
    });
    return () => unsubscribe();
  }, []);

  // নতুন স্যাম্পল সেভ করা
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "samples"), {
        styleNo: formData.styleNo,
        buyerName: formData.buyerName,
        quantity: Number(formData.quantity),
        currentStatus: "Received from Buyer",
        createdAt: new Date().toISOString(),
        timeline: [
          {
            step: "Received from Buyer",
            date: new Date().toISOString().split("T")[0],
            party: formData.buyerName,
          },
        ],
      });
      setFormData({ styleNo: "", buyerName: "", quantity: "" });
      setShowForm(false);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("ডেটা সেভ করতে সমস্যা হয়েছে!");
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-brand-navy">Sample Tracking</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
        >
          <PlusCircle size={18} /> New Sample
        </button>
      </div>

      {/* নতুন স্যাম্পল ফর্ম */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
          <h3 className="text-lg font-bold mb-4 text-brand-navy">Add New Sample</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input required placeholder="Style No (e.g. ST-101)" className="border p-2 rounded-lg" value={formData.styleNo} onChange={(e) => setFormData({...formData, styleNo: e.target.value})} />
            <input required placeholder="Buyer Name" className="border p-2 rounded-lg" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} />
            <input required type="number" placeholder="Quantity" className="border p-2 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">Save Sample</button>
        </form>
      )}

      {/* স্যাম্পল লিস্ট */}
      <div className="space-y-4">
        {samples.length === 0 && <p className="text-gray-500">কোনো স্যাম্পল পাওয়া যায়নি। নতুন স্যাম্পল যোগ করুন।</p>}
        
        {samples.map((sample) => (
          <div key={sample.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-brand-navy">{sample.styleNo}</h3>
                <p className="text-sm text-gray-500">Buyer: {sample.buyerName} | Qty: {sample.quantity} pcs</p>
              </div>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                {sample.currentStatus}
              </span>
            </div>

            {/* টাইমলাইন */}
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
              {sample.timeline.map((event: any, index: number) => (
                <div key={index} className="ml-6 relative">
                  <span className="absolute -left-[35px] top-1 bg-white rounded-full">
                    {event.step.includes("Buyer") ? <UserCheck size={20} className="text-green-600" /> : <Factory size={20} className="text-blue-600" />}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">{event.step}</span>
                    <span className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Clock size={14} /> {event.date} • Party: {event.party}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
