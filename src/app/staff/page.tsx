"use client";
import { useState } from "react";
import { db, firebaseConfig } from "../../lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { UserPlus } from "lucide-react";

export default function StaffPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [message, setMessage] = useState("");

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Loading...");

    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

      await setDoc(doc(db, "users", email), {
        email: email,
        role: role,
        createdAt: new Date().toISOString()
      });

      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      setMessage(`Success! ${email} added as ${role}.`);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-brand-navy mb-6">Staff Management</h2>
      
      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy mb-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserPlus size={20} /> Add New Employee
        </h3>
        
        {message && <p className={`mb-4 font-medium ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>{message}</p>}

        <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Employee Email</label>
            <input type="email" required placeholder="manager@jahid.com" className="w-full border p-2 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" required placeholder="Give a strong password" className="w-full border p-2 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Role</label>
            <select className="w-full border p-2 rounded-lg" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="manager">Manager (Shop/Warehouse)</option>
              <option value="merchandiser">Merchandiser (Sample Tracking)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-2 mt-2">
            <button type="submit" className="bg-brand-navy text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-navy/90">
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
