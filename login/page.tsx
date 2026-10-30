"use client";
import { useState } from "react";
import { auth } from "../../lib/firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      setError("লগইন ব্যর্থ! ইমেইল বা পাসওয়ার্ড ভুল।");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-light">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border-t-4 border-brand-navy">
        <h2 className="text-2xl font-bold text-brand-navy mb-6 text-center">Jahid Accessories Login</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" required className="w-full border p-2 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" required className="w-full border p-2 rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-brand-navy text-white py-2 rounded-lg font-medium hover:bg-brand-navy/90">Login</button>
        </form>
      </div>
    </div>
  );
}
