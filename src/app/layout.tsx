"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Package, LogOut, UserPlus, Box, FolderPlus, Store, Building2, ClipboardList, ShoppingCart } from "lucide-react";
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

  return (
    <html lang="en">
      <body className={`${inter.className} bg-brand-light text-gray-800`}>
        {loading ? (
          <div className="flex items-center justify-center h-screen font-bold text-brand-navy">Loading...</div>
        ) : pathname === "/login" ? (
          <>{children}</>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <div className="w-64 bg-brand-navy text-white flex flex-col h-full shadow-lg">
              <div className="p-6 border-b border-brand-silver/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-xl">J</div>
                  <h1 className="text-lg font-bold tracking-wider leading-tight">Jahid<br/>Accessories</h1>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span>
                </Link>
                <Link href="/samples" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <Package size={20} /> <span className="font-medium">Sample Tracking</span>
                </Link>
                <Link href="/categories" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <FolderPlus size={20} /> <span className="font-medium">Categories</span>
                </Link>
                <Link href="/products" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <Box size={20} /> <span className="font-medium">Products</span>
                </Link>
                <Link href="/warehouse" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <Store size={20} /> <span className="font-medium">Warehouse</span>
                </Link>
                <Link href="/shops" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <Building2 size={20} /> <span className="font-medium">Shops</span>
                </Link>
                <Link href="/shop-inventory" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <ClipboardList size={20} /> <span className="font-medium">Shop Inventory</span>
                </Link>
                <Link href="/pos" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <ShoppingCart size={20} /> <span className="font-medium">POS (Sales)</span>
                </Link>
                <Link href="/staff" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <UserPlus size={20} /> <span className="font-medium">Staff</span>
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
          </div>
        )}
      </body>
    </html>
  );
}
