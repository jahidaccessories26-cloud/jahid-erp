"use client";
import { useState, useEffect } from "react";
import { db, firebaseConfig } from "../../lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { UserPlus, Edit, Trash2, X } from "lucide-react";

// রোলের লিস্ট
const ROLES = [
  { value: "admin", label: "Admin (Owner)" },
  { value: "manager", label: "Manager (Shop)" },
  { value: "assistant_manager", label: "Assistant Manager" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "merchandiser", label: "Merchandiser (Sample)" },
  { value: "engineer", label: "Engineer" },
  { value: "quality_inspector", label: "Quality Inspector" },
];

export default function StaffPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("manager");
  const [assignedShop, setAssignedShop] = useState("");
  
  const [message, setMessage] = useState("");
  
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editShop, setEditShop] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShops = onSnapshot(collection(db, "shops"), (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !assignedShop) setAssignedShop(data[0].name);
    });
    return () => { unsubUsers(); unsubShops(); };
  }, [assignedShop]);

  // নতুন স্টাফ তৈরি
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Loading...");
    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      await setDoc(doc(db, "users", email), {
        name: name, 
        email: email, 
        role: role, 
        assignedShop: ["manager", "assistant_manager", "warehouse_manager"].includes(role) ? assignedShop : "All",
        createdAt: new Date().toISOString()
      });

      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      
      setMessage(`Success: ${name} added successfully.`);
      setEmail(""); setPassword(""); setName("");
    } catch (error: any) { setMessage(`Error: ${error.message}`); }
  };

  // এডিট
  const handleUpdateRole = async () => {
    if (!editingStaff) return;
    try {
      await updateDoc(doc(db, "users", editingStaff.email), { 
        name: editName,
        role: editRole,
        assignedShop: ["manager", "assistant_manager", "warehouse_manager"].includes(editRole) ? editShop : "All"
      });
      setEditingStaff(null);
    } catch (error) { alert("আপডেট করতে সমস্যা হয়েছে!"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিত এই স্টাফকে ডিলিট করতে চান?")) {
      await deleteDoc(doc(db, "users", id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-brand-navy mb-4">Staff Management</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><UserPlus size={18} /> Add New Employee</h3>
        {message && <p className={`mb-3 text-sm font-medium ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>{message}</p>}

        <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <input required type="text" placeholder="Full Name" className="border p-2 rounded-lg" value={name} onChange={(e) => setName(e.target.value)} />
          <input required type="email" placeholder="Email" className="border p-2 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" className="border p-2 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          
          <select className="border p-2 rounded-lg" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          
          <select className={`border p-2 rounded-lg ${!["manager", "assistant_manager", "warehouse_manager"].includes(role) && 'opacity-50'}`} value={assignedShop} onChange={(e) => setAssignedShop(e.target.value)} disabled={!["manager", "assistant_manager", "warehouse_manager"].includes(role)}>
            {shops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>

          <button type="submit" className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 md:col-span-2">Create Account</button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Shop</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr key={staff.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-brand-navy">{staff.name || "N/A"}</td>
                <td className="px-4 py-3 text-gray-600">{staff.email}</td>
                <td className="px-4 py-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold uppercase">{staff.role}</span></td>
                <td className="px-4 py-3">
                  {["manager", "assistant_manager", "warehouse_manager"].includes(staff.role) ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">{staff.assignedShop || "N/A"}</span> : <span className="text-gray-400 text-xs">N/A</span>}
                </td>
                <td className="px-4 py-3 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingStaff(staff); setEditName(staff.name || ""); setEditRole(staff.role); setEditShop(staff.assignedShop || ""); }} className="text-brand-navy bg-gray-100 p-1.5 rounded-lg"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(staff.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-brand-navy">Edit Staff</h3>
              <button onClick={() => setEditingStaff(null)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <div className="text-sm space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name</label>
                <input className="w-full border p-2 rounded-lg" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select className="w-full border p-2 rounded-lg" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              
              {["manager", "assistant_manager", "warehouse_manager"].includes(editRole) && (
                <div>
                  <label className="block text-xs font-medium mb-1">Assigned Shop/Warehouse</label>
                  <select className="w-full border p-2 rounded-lg" value={editShop} onChange={(e) => setEditShop(e.target.value)}>
                    {shops.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingStaff(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleUpdateRole} className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
