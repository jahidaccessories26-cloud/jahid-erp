"use client";
import { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, Factory, UserCheck, User, ShieldCheck, Phone } from "lucide-react";

export default function TrackSamplePage() {
  const { id } = useParams();
  const [sample, setSample] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  
  // অ্যাকশন স্টেট
  const [actionType, setActionType] = useState<"Approved" | "Rejected" | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerDesignation, setReviewerDesignation] = useState("");
  const [reviewerPhone, setReviewerPhone] = useState(""); // নতুন মোবাইল ফিল্ড
  const [rejectReason, setRejectReason] = useState("");

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    const fetchSample = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "samples", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSample({ id: docSnap.id, ...docSnap.data() });
        } else {
          setMessage("Sample not found!");
        }
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    fetchSample();
  }, [id]);

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sample || !actionType) return;
    
    // তিনটি ফিল্ডই বাধ্যতামূলক চেক করা হলো
    if (!reviewerName || !reviewerDesignation || !reviewerPhone) {
      alert("Please enter your name, designation and mobile number."); return;
    }
    if (actionType === "Rejected" && !rejectReason) {
      alert("Please provide a reason for rejection."); return;
    }

    try {
      const newTimelineEvent = {
        step: actionType,
        date: new Date().toISOString(),
        // নাম, পদবি এবং মোবাইল নম্বর একসাথে সেভ হবে
        party: `${reviewerName} (${reviewerDesignation}) - ${reviewerPhone}`, 
        note: actionType === "Rejected" ? rejectReason : "Approved by Buyer"
      };

      const sampleRef = doc(db, "samples", sample.id);
      await updateDoc(sampleRef, {
        currentStatus: actionType,
        timeline: [...sample.timeline, newTimelineEvent]
      });

      setSample({ ...sample, currentStatus: actionType, timeline: [...sample.timeline, newTimelineEvent] });
      setMessage(`Sample ${actionType} successfully!`);
      setActionType(null);
      setReviewerName(""); setReviewerDesignation(""); setReviewerPhone(""); setRejectReason("");
    } catch (error) { alert("Something went wrong!"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-brand-navy">Loading...</div>;
  if (!sample) return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">{message}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex justify-center items-start pt-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border-t-4 border-brand-navy overflow-hidden">
        
        <div className="bg-brand-navy p-4 text-white text-center">
          <h1 className="text-xl font-bold">Jahid Accessories</h1>
          <p className="text-xs text-gray-300">Sample Tracking Portal</p>
        </div>

        <div className="p-5">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-brand-navy mb-1">{sample.itemName} ({sample.styleNo})</h2>
            <p className="text-sm text-gray-500">Buyer: <strong>{sample.buyerName}</strong></p>
            <p className="text-sm text-gray-500">Quantity: {sample.quantity} pcs</p>
            {sample.description && <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded">{sample.description}</p>}
          </div>

          <div className="text-center mb-6">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold uppercase ${
              sample.currentStatus === "Approved" ? "bg-green-100 text-green-700" : 
              sample.currentStatus === "Rejected" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
            }`}>
              Status: {sample.currentStatus}
            </span>
          </div>

          {message && <p className="text-center text-green-600 font-bold mb-4 bg-green-50 p-2 rounded">{message}</p>}

          {/* অ্যাকশন বাটন */}
          {sample.currentStatus === "Submitted to Buyer" && !actionType && (
            <div className="border-t pt-4 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-200">
              <h3 className="text-center font-bold text-blue-900 mb-1 flex items-center justify-center gap-2">
                <ShieldCheck size={20} /> Action Required
              </h3>
              <p className="text-center text-xs text-blue-700 mb-4">Please review and approve/reject this sample.</p>
              <div className="flex gap-3">
                <button onClick={() => setActionType("Approved")} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Approve
                </button>
                <button onClick={() => setActionType("Rejected")} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 flex items-center justify-center gap-2">
                  <XCircle size={18} /> Reject
                </button>
              </div>
            </div>
          )}

          {/* নাম, পদবি ও মোবাইল ফর্ম */}
          {actionType && (
            <form onSubmit={submitAction} className={`p-4 rounded-lg border mb-6 ${actionType === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="font-bold mb-3 text-gray-800">Confirm {actionType}</h3>
              
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1">Your Name <span className="text-red-500">*</span></label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="e.g. Mr. Karim" />
              </div>
              
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1">Designation <span className="text-red-500">*</span></label>
                <input required className="w-full border p-2 rounded-lg text-sm" value={reviewerDesignation} onChange={(e) => setReviewerDesignation(e.target.value)} placeholder="e.g. Quality Inspector" />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium mb-1">Mobile Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone size={14} className="absolute left-2 top-2.5 text-gray-400" />
                  <input required type="tel" className="w-full border p-2 pl-7 rounded-lg text-sm" value={reviewerPhone} onChange={(e) => setReviewerPhone(e.target.value)} placeholder="e.g. 017XXXXXXXX" />
                </div>
              </div>

              {actionType === "Rejected" && (
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
                  <textarea required className="w-full border p-2 rounded-lg text-sm" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why..."></textarea>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setActionType(null)} className="flex-1 bg-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className={`flex-1 text-white py-2 rounded-lg text-sm font-medium ${actionType === 'Approved' ? 'bg-green-600' : 'bg-red-600'}`}>Confirm {actionType}</button>
              </div>
            </form>
          )}

          {/* টাইমলাইন */}
          <div>
            <h3 className="font-bold text-gray-700 mb-3 border-b pb-1">Sample Journey</h3>
            <div className="relative border-l-2 border-gray-200 ml-2 space-y-4">
              {sample.timeline.map((event: any, index: number) => (
                <div key={index} className="ml-4 relative">
                  <span className="absolute -left-[27px] top-0 bg-white rounded-full">
                    {event.step.includes("Buyer") ? <UserCheck size={16} className="text-green-600" /> : <Factory size={16} className="text-blue-600" />}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800 text-sm">{event.step}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatDateTime(event.date)}</span>
                    {event.party && <span className="text-xs text-gray-600 flex items-center gap-1 mt-0.5"><User size={10}/> {event.party}</span>}
                    {event.note && <span className="text-xs text-gray-600 italic mt-1 bg-gray-50 p-1 rounded">"{event.note}"</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
