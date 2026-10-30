"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Package, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>;

  if (pathname === "/login") {
    return <html lang="en"><body className={inter.className}>{children}</body></html>;
  }

  return (
    <html lang="en">
      <body className={`${inter.className} flex bg-brand-light text-gray-800 h-screen overflow-hidden`}>
        <div className="w-64 bg-brand-navy text-white flex flex-col h-full shadow-lg">
          <div className="p-6 border-b border-brand-silver/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-xl">J</div>
              <h1 className="text-lg font-bold tracking-wider leading-tight">Jahid<br/>Accessories</h1>
            </div>
            <p className="text-xs text-gray-300 mt-2 leading-relaxed">M-2 Maya Katra, Sadarghat,<br />Dhaka 1100</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
              <LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span>
            </Link>
            <Link href="/samples" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
              <Package size={20} /> <span className="font-medium">Sample Tracking</span>
            </Link>
          </nav>

          <div className="p-4 border-t border-brand-silver/30">
            <p className="text-xs text-gray-300 mb-2">{user?.email}</p>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
        <main className="flex-1 p-8 overflow-y-auto h-full">{children}</main>
      </body>
    </html>
  );
}
