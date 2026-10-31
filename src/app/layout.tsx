"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Package, LogOut, UserPlus, Box, FolderPlus, Store, Building2, ClipboardList, ShoppingCart, Menu, X, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <html lang="en">
      <body className={`${inter.className} bg-brand-light text-gray-800`}>
        {loading ? (
          <div className="flex items-center justify-center h-screen font-bold text-brand-navy text-xl">Loading...</div>
        ) : pathname === "/login" ? (
          <>{children}</>
        ) : (
          <div className="flex h-screen overflow-hidden">
            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 w-full bg-brand-navy text-white flex justify-between items-center p-4 z-50 shadow-md">
              <div className="flex items-center gap-2 font-bold text-lg">
                <div className="w-8 h-8 bg-white text-brand-navy rounded-full flex items-center justify-center">J</div>
                Jahid Accessories
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>

            {/* Sidebar */}
            <div className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-brand-navy text-white flex flex-col h-full shadow-lg transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} pt-16 md:pt-0`}>
              <div className="hidden md:block p-6 border-b border-brand-silver/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-xl">J</div>
                  <h1 className="text-lg font-bold tracking-wider leading-tight">Jahid<br/>Accessories</h1>
                </div>
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">M-2 Maya Katra, Sadarghat,<br />Dhaka 1100</p>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
                <Link href="/sales" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <ShoppingCart size={20} /> <span className="font-medium">Sales History</span>
                </Link>
                <Link href="/orders" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <ShoppingBag size={20} /> <span className="font-medium">Corporate Orders</span>
                </Link>
                <Link href="/staff" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                  <UserPlus size={20} /> <span className="font-medium">Staff</span>
                </Link>
              </nav>

              <div className="p-4 border-t border-brand-silver/30">
                <p className="text-xs text-gray-300 mb-2 truncate">{user?.email}</p>
                <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-full pt-16 md:pt-0">
              <div className="p-4 md:p-8">
                {children}
              </div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
