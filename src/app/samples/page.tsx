"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Clock, Factory, UserCheck, PlusCircle, User, Building2, ArrowLeft, Edit, X, Trash2, Share2 } from "lucide-react";

type ViewMode = "garments" | "buyers" | "samples";

export default function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]); 
  const [viewMode, setViewMode] = useState<ViewMode>("garments");
  
  const [selectedGarment, setSelectedGarment] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState("");
  
  // গ্লোবাল "New Sample" ফর্মের স্টেট
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    styleNo: "", itemName: "", buyerName: "", garmentName: "", quantity: "", description: "", receivedBy: "" 
  });

  const [editingSample, setEditingSample] = useState<any>(null);
  const [editSampleData, setEditSampleData] = useState({ 
    styleNo: "", itemName: "", buyerName: "", quantity: "", description: "" 
  });

  const [updatingSample, setUpdatingSample] = useState<any>(null);
  const [updateData, setUpdateData] = useState({ 
    status: "Sent to Factory", 
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), 
    party: "",
    staffName: ""
  });

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    const unsubSamples = onSnapshot(query(collection(db, "samples"), orderBy("createdAt", "desc")), (snapshot) => {
      setSamples(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubStaff = onSnapshot(query(collection(db, "users")), (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubGarments = onSnapshot(query(collection(db, "garments")), (snapshot) => {
      setGarments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubSamples(); unsubStaff(); unsubGarments(); };
  }, []);

  // মেইন "New Sample" ফর্ম ওপেন করা (যেকোনো জায়গা থেকে)
  const openNewForm = () => {
    setFormData({
      styleNo: "", itemName: "", buyerName: "", garmentName: "", quantity: "", description: "", receivedBy: ""
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.garmentName) { alert("গার্মেন্টস সিলেক্ট করুন!"); return; }
    if (!formData.buyerName) { alert("বায়ার নাম দিন!"); return; }

    try {
      await addDoc(collection(db, "samples"), {
        ...formData,
        quantity: Number(formData.quantity),
        currentStatus: "Received from Buyer",
        createdAt: new Date().toISOString(),
        timeline: [{ step: "Received from Buyer", date: new Date().toISOString(), party: formData.buyerName, receivedBy: formData.receivedBy }],
      });
      setFormData({ styleNo: "", itemName: "", buyerName: "", garmentName: "", quantity: "", description: "", receivedBy: "" });
      setShowForm(false);
      alert("Success: স্যাম্পল সফলভাবে যোগ হয়েছে!");
    } catch (error) { alert("ডেটা সেভ করতে সমস্যা হয়েছে!"); }
  };

  const handleEditSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSample) return;
    try {
      await updateDoc(doc(db, "samples", editingSample.id), {
        styleNo: editSampleData.styleNo, itemName: editSampleData.itemName,
        buyerName: editSampleData.buyerName, quantity: Number(editSampleData.quantity), description: editSampleData.description
      });
      setEditingSample(null);
    } catch (error) { alert("এডিট করতে সমস্যা হয়েছে!"); }
  };

  const handleDeleteSample = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই স্যাম্পলটি ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "samples", id));
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingSample) return;

    const newTimelineEvent = {
      step: updateData.status,
      date: updateData.date ? new Date(updateData.date).toISOString() : new Date().toISOString(),
      party: updateData.party || "N/A",
      handledBy: updateData.staffName
    };

    try {
      const sampleRef = doc(db, "samples", updatingSample.id);
      await updateDoc(sampleRef, { currentStatus: updateData.status, timeline: [...updatingSample.timeline, newTimelineEvent] });
      setUpdatingSample(null);
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  const handleCopyLink = (sampleId: string) => {
    const url = `${window.location.origin}/track?id=${sampleId}`;
    navigator.clipboard.writeText(url);
    alert("Tracking Link copied! Send this link to the buyer.");
  };

  // ডেটা গ্রুপিং
  const garmentsList = Array.from(new Set(samples.map(s => s.garmentName).filter(Boolean)));
  const buyersList = Array.from(new Set(samples.filter(s => s.garmentName === selectedGarment).map(s => s.buyerName)));
  const filteredSamples = samples.filter(s => s.garmentName === selectedGarment && s.buyerName === selectedBuyer);

  return (
    <div className="max-w-5xl mx-auto">
      {/* হেডার এবং গ্লোবাল New Sample বাটন */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <button onClick={() => setViewMode("garments")} className="hover:text-brand-navy">All Garments</button>
            {viewMode !== "garments" && <><span>/</span><button onClick={() => setViewMode("buyers")} className="hover:text-brand-navy">{selectedGarment}</button></>}
            {viewMode === "samples" && <><span>/</span><span className="text-brand-navy font-bold">{selectedBuyer}</span></>}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-brand-navy">
            {viewMode === "garments" && "Garments List"}
            {viewMode === "buyers" && `${selectedGarment} - Buyers`}
            {viewMode === "samples" && `${selectedBuyer} - Samples`}
          </h2>
        </div>
        
        {/* সবার উপরে New Sample বাটন */}
        <button onClick={openNewForm} className="bg-brand-navy text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-brand-navy/90 transition">
          <PlusCircle size={18} /> New Sample
        </button>
      </div>

      {/* গ্লোবাল New Sample ফর্ম */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-lg border-t-4 border-brand-navy mb-6 text-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-brand-navy">Add New Sample</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {/* Garments Name ড্রপডাউন */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Select Garments <span className="text-red-500">*</span></label>
              <select required className="w-full border p-2 rounded-lg" value={formData.garmentName} onChange={(e) => setFormData({...formData, garmentName: e.target.value})}>
                <option value="" disabled>-- Select Garments --</option>
                {garments.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </div>

            <input required placeholder="Style No" className="border p-2 rounded-lg" value={formData.styleNo} onChange={(e) => setFormData({...formData, styleNo: e.target.value})} />
            <input required placeholder="Accessory Name" className="border p-2 rounded-lg" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} />
            
            {/* Buyer Name টেক্সট ইনপুট */}
            <div>
              <label className="block text-xs font-medium mb-1">Buyer Name <span className="text-red-500">*</span></label>
              <input required placeholder="e.g. H&M, Zara" className="w-full border p-2 rounded-lg" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} />
            </div>
            
            <input required type="number" placeholder="Quantity" className="border p-2 rounded-lg" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
            <input placeholder="Description" className="border p-2 rounded-lg md:col-span-2" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            
            <select required className="border p-2 rounded-lg md:col-span-2" value={formData.receivedBy} onChange={(e) => setFormData({...formData, receivedBy: e.target.value})}>
              <option value="" disabled>-- Received By (Staff) --</option>
              {staffList.map((staff) => <option key={staff.id} value={staff.email}>{staff.email}</option>)}
            </select>
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium text-sm w-full md:w-auto">Save Sample</button>
        </form>
      )}

      {/* Garments List */}
      {viewMode === "garments" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {garmentsList.map((g) => (
            <div key={g} onClick={() => { setSelectedGarment(g); setViewMode("buyers"); }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-brand-navy transition flex items-center gap-3">
              <Building2 size={24} className="text-brand-navy" />
              <span className="font-bold text-sm text-brand-navy">{g}</span>
            </div>
          ))}
          {garmentsList.length === 0 && <p className="text-gray-500 text-sm col-span-2">কোনো গার্মেন্টস নেই। "New Sample" এ ক্লিক করে প্রথম স্যাম্পল যোগ করুন।</p>}
        </div>
      )}

      {/* Buyers List */}
      {viewMode === "buyers" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div onClick={() => setViewMode("garments")} className="bg-gray-100 p-4 rounded-xl cursor-pointer hover:bg-gray-200 transition flex items-center justify-center gap-2">
            <ArrowLeft size={18} /> Back
          </div>
          {buyersList.map((b) => (
            <div key={b} onClick={() => { setSelectedBuyer(b); setViewMode("samples"); }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-brand-navy transition flex items-center gap-3">
              <User size={24} className="text-brand-navy" />
              <span className="font-bold text-sm text-brand-navy">{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Samples List */}
      {viewMode === "samples" && (
        <div>
          <button onClick={() => setViewMode("buyers")} className="mb-3 text-sm text-brand-navy flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Back to Buyers</button>
          
          <div className="space-y-3">
            {filteredSamples.map((sample) => (
              <div key={sample.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-sm relative">
                
                <div className="absolute top-3 right-3 flex gap-1">
                  <button onClick={() => handleCopyLink(sample.id)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg" title="Copy Tracking Link">
                    <Share2 size={16} />
                  </button>
                  <button onClick={() => { setEditingSample(sample); setEditSampleData({ styleNo: sample.styleNo, itemName: sample.itemName, buyerName: sample.buyerName, quantity: sample.quantity, description: sample.description || "" }); }} className="text-gray-400 hover:text-brand-navy bg-gray-50 p-1.5 rounded-lg">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDeleteSample(sample.id)} className="text-gray-400 hover:text-red-600 bg-gray-50 p-1.5 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-start mb-3 border-b pb-2 pr-24">
                  <div>
                    <h3 className="font-bold text-brand-navy text-base">{sample.itemName} ({sample.styleNo})</h3>
                    <p className="text-gray-500 text-xs">Qty: {sample.quantity} pcs</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase block mb-1">{sample.currentStatus}</span>
                    <button onClick={() => { setUpdatingSample(sample); setUpdateData({ status: "Sent to Factory", date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), party: "", staffName: "" }); }} className="text-xs text-brand-navy font-medium hover:underline">Update Status</button>
                  </div>
                </div>

                <div className="relative border-l-2 border-gray-200 ml-2 space-y-4">
                  {sample.timeline.map((event: any, index: number) => (
                    <div key={index} className="ml-4 relative">
                      <span className="absolute -left-[27px] top-0 bg-white rounded-full">
                        {event.step.includes("Buyer") ? <UserCheck size={16} className="text-green-600" /> : <Factory size={16} className="text-blue-600" />}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 text-xs">{event.step}</span>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatDateTime(event.date)} • {event.party}</span>
                        {(event.receivedBy || event.handledBy) && (
                          <span className="text-[10px] text-brand-navy flex items-center gap-1 mt-0.5"><User size={10}/> By: {event.receivedBy || event.handledBy}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* এডিট স্যাম্পল মডাল */}
      {editingSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-brand-navy">Edit Sample</h3>
              <button onClick={() => setEditingSample(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            <form onSubmit={handleEditSample} className="text-sm space-y-3">
              <div><label className="block text-xs font-medium mb-1">Style No</label><input required className="w-full border p-1.5 rounded-lg" value={editSampleData.styleNo} onChange={(e) => setEditSampleData({...editSampleData, styleNo: e.target.value})} /></div>
              <div><label className="block text-xs font-medium mb-1">Item Name</label><input required className="w-full border p-1.5 rounded-lg" value={editSampleData.itemName} onChange={(e) => setEditSampleData({...editSampleData, itemName: e.target.value})} /></div>
              <div><label className="block text-xs font-medium mb-1">Buyer Name</label><input required className="w-full border p-1.5 rounded-lg" value={editSampleData.buyerName} onChange={(e) => setEditSampleData({...editSampleData, buyerName: e.target.value})} /></div>
              <div><label className="block text-xs font-medium mb-1">Quantity</label><input required type="number" className="w-full border p-1.5 rounded-lg" value={editSampleData.quantity} onChange={(e) => setEditSampleData({...editSampleData, quantity: e.target.value})} /></div>
              <div><label className="block text-xs font-medium mb-1">Description</label><input className="w-full border p-1.5 rounded-lg" value={editSampleData.description} onChange={(e) => setEditSampleData({...editSampleData, description: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingSample(null)} className="px-3 py-1.5 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* স্ট্যাটাস আপডেট মডাল */}
      {updatingSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="text-base font-bold mb-3 text-brand-navy">Update Journey</h3>
            <form onSubmit={handleUpdateStatus} className="text-sm space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Next Step</label>
                <select className="w-full border p-1.5 rounded-lg text-sm" value={updateData.status} onChange={(e) => setUpdateData({...updateData, status: e.target.value})}>
                  <option value="Sent to Factory">Sent to Factory</option>
                  <option value="Received from Factory">Received from Factory</option>
                  <option value="Submitted to Buyer">Submitted to Buyer</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date & Time</label>
                <input type="datetime-local" className="w-full border p-1.5 rounded-lg text-sm" value={updateData.date} onChange={(e) => setUpdateData({...updateData, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Party (Factory/Buyer)</label>
                <input placeholder="e.g. ABC Garments" className="w-full border p-1.5 rounded-lg text-sm" value={updateData.party} onChange={(e) => setUpdateData({...updateData, party: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Handled By (Staff)</label>
                <select className="w-full border p-1.5 rounded-lg text-sm" value={updateData.staffName} onChange={(e) => setUpdateData({...updateData, staffName: e.target.value})}>
                  <option value="" disabled>-- Select Staff --</option>
                  {staffList.map((staff) => <option key={staff.id} value={staff.email}>{staff.email}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUpdatingSample(null)} className="px-3 py-1.5 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-brand-navy text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
