"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { Clock, Factory, UserCheck, PlusCircle, CheckCircle, User, Building2, Filter } from "lucide-react";

export default function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]); // গার্মেন্টস লিস্ট
  const [staffList, setStaffList] = useState<any[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [filterGarment, setFilterGarment] = useState("All"); // ফিল্টার স্টেট
  
  // নতুন স্যাম্পল ফর্মের স্টেট
  const [formData, setFormData] = useState({ 
    styleNo: "", 
    itemName: "",
    buyerName: "", 
    garmentName: "", // নতুন ফিল্ড
    quantity: "",
    description: "",
    receivedBy: "" 
  });

  // স্ট্যাটাস আপডেট করার স্টেট
  const [updatingSample, setUpdatingSample] = useState<any>(null);
  const [updateData, setUpdateData] = useState({ 
    status: "Sent to Factory", 
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), 
    party: "" 
  });

  // তারিখ ও সময় ফরম্যাট
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  useEffect(() => {
    // স্যাম্পল লিস্ট
    const qSamples = query(collection(db, "samples"), orderBy("createdAt", "desc"));
    const unsubSamples = onSnapshot(qSamples, (snapshot) => {
      setSamples(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // স্টাফ লিস্ট
    const qStaff = query(collection(db, "users"));
    const unsubStaff = onSnapshot(qStaff, (snapshot) => {
      setStaffList(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // গার্মেন্টস লিস্ট (যেহেতু Corporate Orders এ garments কালেকশন আছে)
    const qGarments = query(collection(db, "garments"));
    const unsubGarments = onSnapshot(qGarments, (snapshot) => {
      setGarments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubSamples(); unsubStaff(); unsubGarments(); };
  }, []);

  // নতুন স্যাম্পল সেভ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.garmentName) {
      alert("অনুগ্রহ করে গার্মেন্টস সিলেক্ট করুন!"); return;
    }

    try {
      await addDoc(collection(db, "samples"), {
        ...formData,
        quantity: Number(formData.quantity),
        currentStatus: "Received from Buyer",
        createdAt: new Date().toISOString(),
        timeline: [
          {
            step: "Received from Buyer",
            date: new Date().toISOString(),
            party: formData.buyerName,
            receivedBy: formData.receivedBy
          },
        ],
      });
      setFormData({ styleNo: "", itemName: "", buyerName: "", garmentName: "", quantity: "", description: "", receivedBy: "" });
      setShowForm(false);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("ডেটা সেভ করতে সমস্যা হয়েছে!");
    }
  };

  // স্ট্যাটাস আপডেট
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

  // ফিল্টার করা স্যাম্পল লিস্ট
  const filteredSamples = samples.filter(s => filterGarment === "All" || s.garmentName === filterGarment);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy">Sample Tracking</h2>
        
        <div className="flex items-center gap-3">
          {/* গার্মেন্টস ফিল্টার */}
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
            <Filter size={20} className="text-brand-navy" />
            <select 
              className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer"
              value={filterGarment} 
              onChange={(e) => setFilterGarment(e.target.value)}
            >
              <option value="All">All Garments</option>
              {garments.map((g) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 transition flex items-center gap-2"
          >
            <PlusCircle size={18} /> New Sample
          </button>
        </div>
      </div>

      {/* নতুন স্যাম্পল ফর্ম */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
          <h3 className="text-lg font-bold mb-4 text-brand-navy">Add New Accessories Sample</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            
            {/* গার্মেন্টস সিলেক্ট */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Select Garments</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <select 
                  required 
                  className="w-full border p-2 pl-10 rounded-lg" 
                  value={formData.garmentName} 
                  onChange={(e) => setFormData({...formData, garmentName: e.target.value})}
                >
                  <option value="" disabled>-- Select Garments --</option>
                  {garments.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <input required placeholder="Style No" className="border p-2 rounded-lg" value={formData.styleNo} onChange={(e) => setFormData({...formData, styleNo: e.target.value})} />
            <input required placeholder="Accessory Name" className="border p-2 rounded-lg" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} />
            <input required placeholder="Buyer Name" className="border p-2 rounded-lg" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} />
            <input required type="number" placeholder="Quantity" className="border p-2 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
            <input placeholder="Description" className="border p-2 rounded-lg md:col-span-2" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            
            {/* Received By স্টাফ সিলেক্ট */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Received By (Staff)</label>
              <select 
                required 
                className="w-full border p-2 rounded-lg" 
                value={formData.receivedBy} 
                onChange={(e) => setFormData({...formData, receivedBy: e.target.value})}
              >
                <option value="" disabled>-- Select Staff Member --</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.email}>{staff.email}</option>
                ))}
              </select>
            </div>
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
        {filteredSamples.length === 0 && <p className="text-gray-500">কোনো স্যাম্পল পাওয়া যায়নি।</p>}
        
        {filteredSamples.map((sample) => (
          <div key={sample.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                {/* গার্মেন্টসের নাম দেখানো */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                    <Building2 size={12}/> {sample.garmentName || "Unknown Garments"}
                  </span>
                  <span className="text-xs text-gray-500">Buyer: {sample.buyerName}</span>
                </div>
                <h3 className="text-xl font-bold text-brand-navy">{sample.itemName} ({sample.styleNo})</h3>
                <p className="text-sm text-gray-500">Qty: {sample.quantity} pcs</p>
                {sample.description && <p className="text-sm text-gray-700 mt-1"><strong>Details:</strong> {sample.description}</p>}
              </div>
              <div className="text-right">
                <span className="block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  {sample.currentStatus}
                </span>
                <button onClick={() => {
                  setUpdatingSample(sample);
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
                      <Clock size={14} /> {formatDateTime(event.date)} • Party: {event.party}
                    </span>
                    {event.receivedBy && (
                      <span className="text-xs text-brand-navy flex items-center gap-1 mt-0.5">
                        <User size={12}/> Received By: {event.receivedBy}
                      </span>
                    )}
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
