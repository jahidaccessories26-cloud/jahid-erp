"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { Clock, Factory, UserCheck, PlusCircle, CheckCircle } from "lucide-react";

export default function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // নতুন স্যাম্পল ফর্মের স্টেট
  const [formData, setFormData] = useState({ 
    styleNo: "", itemName: "", buyerName: "", quantity: "", description: "", remarks: ""
  });

  // স্ট্যাটাস আপডেট করার স্টেট (ডিফল্টভাবে বর্তমান সময় সেট করা হলো)
  const [updatingSample, setUpdatingSample] = useState<any>(null);
  const [updateData, setUpdateData] = useState({ 
    status: "Sent to Factory", 
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), // Local Time
    party: "" 
  });

  // তারিখ ও সময় ফরম্যাট করার ফাংশন
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

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
        ...formData,
        quantity: Number(formData.quantity),
        currentStatus: "Received from Buyer",
        createdAt: new Date().toISOString(),
        timeline: [
          {
            step: "Received from Buyer",
            date: new Date().toISOString(), // সম্পূর্ণ তারিখ ও সময় সেভ হবে
            party: formData.buyerName,
          },
        ],
      });
      setFormData({ styleNo: "", itemName: "", buyerName: "", quantity: "", description: "", remarks: "" });
      setShowForm(false);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("ডেটা সেভ করতে সমস্যা হয়েছে!");
    }
  };

  // স্ট্যাটাস আপডেট করার ফাংশন
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingSample) return;

    const newTimelineEvent = {
      step: updateData.status,
      date: updateData.date ? new Date(updateData.date).toISOString() : new Date().toISOString(),
      party: updateData.party || "N/A",
    };

    try {
      const sampleRef = doc(db, "samples", updatingSample.id);
      await updateDoc(sampleRef, {
        currentStatus: updateData.status,
        timeline: [...updatingSample.timeline, newTimelineEvent]
      });
      setUpdatingSample(null);
      // ফর্ম রিসেট করা
      setUpdateData({ 
        status: "Sent to Factory", 
        date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), 
        party: "" 
      });
    } catch (error) {
      console.error("Error updating: ", error);
      alert("আপডেট করতে সমস্যা হয়েছে!");
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
          <h3 className="text-lg font-bold mb-4 text-brand-navy">Add New Accessories Sample</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input required placeholder="Style No" className="border p-2 rounded-lg" value={formData.styleNo} onChange={(e) => setFormData({...formData, styleNo: e.target.value})} />
            <input required placeholder="Accessory Name" className="border p-2 rounded-lg" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} />
            <input required placeholder="Buyer Name" className="border p-2 rounded-lg" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} />
            <input required type="number" placeholder="Quantity" className="border p-2 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
            <input placeholder="Description" className="border p-2 rounded-lg md:col-span-2" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">Save Sample</button>
        </form>
      )}

      {/* স্ট্যাটাস আপডেট মডাল */}
      {updatingSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-brand-navy">Update Journey: {updatingSample.itemName}</h3>
            <form onSubmit={handleUpdateStatus}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Next Step</label>
                <select className="w-full border p-2 rounded-lg" value={updateData.status} onChange={(e) => setUpdateData({...updateData, status: e.target.value})}>
                  <option value="Sent to Factory">Sent to Factory</option>
                  <option value="Received from Factory">Received from Factory</option>
                  <option value="Submitted to Buyer">Submitted to Buyer</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Date & Time</label>
                {/* type="date" থেকে পরিবর্তন করে "datetime-local" করা হলো */}
                <input type="datetime-local" className="w-full border p-2 rounded-lg" value={updateData.date} onChange={(e) => setUpdateData({...updateData, date: e.target.value})} />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Party (Factory Name / Buyer)</label>
                <input placeholder="e.g. ABC Garments" className="w-full border p-2 rounded-lg" value={updateData.party} onChange={(e) => setUpdateData({...updateData, party: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setUpdatingSample(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90">Save Step</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* স্যাম্পল লিস্ট */}
      <div className="space-y-4">
        {samples.map((sample) => (
          <div key={sample.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-brand-navy">{sample.itemName} ({sample.styleNo})</h3>
                <p className="text-sm text-gray-500">Buyer: {sample.buyerName} | Qty: {sample.quantity} pcs</p>
                {sample.description && <p className="text-sm text-gray-700 mt-1"><strong>Details:</strong> {sample.description}</p>}
              </div>
              <div className="text-right">
                <span className="block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  {sample.currentStatus}
                </span>
                <button onClick={() => {
                  setUpdatingSample(sample);
                  // মডাল ওপেন করার সময় বর্তমান লোকাল টাইম সেট করা
                  setUpdateData({ 
                    status: "Sent to Factory", 
                    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), 
                    party: "" 
                  });
                }} className="text-sm text-brand-navy font-medium hover:underline flex items-center gap-1 justify-end">
                  <CheckCircle size={14} /> Update Status
                </button>
              </div>
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
                      {/* এখানে নতুন ফরম্যাট ফাংশনটি ব্যবহার করা হলো */}
                      <Clock size={14} /> {formatDateTime(event.date)} • Party: {event.party}
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
