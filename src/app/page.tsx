import { Package, AlertCircle, CheckCircle } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-brand-navy mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-brand-navy flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Samples</p>
            <h3 className="text-3xl font-bold text-brand-navy">--</h3>
          </div>
          <Package size={40} className="text-brand-navy/20" />
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Pending</p>
            <h3 className="text-3xl font-bold text-red-600">--</h3>
          </div>
          <AlertCircle size={40} className="text-red-500/20" />
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Approved</p>
            <h3 className="text-3xl font-bold text-green-600">--</h3>
          </div>
          <CheckCircle size={40} className="text-green-500/20" />
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        <p>স্যাম্পল ট্র্যাকিং পেজে গিয়ে নতুন স্যাম্পল যোগ করুন।</p>
      </div>
    </div>
  );
}
