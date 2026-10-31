"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Package, LogOut, UserPlus, Box, FolderPlus, Store, Building2, ClipboardList, ShoppingCart, Menu, X, ShoppingBag, History } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("manager");
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Service Worker রেজিস্টার (PWA-র জন্য)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration failed: ', err);
      });
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        // ফায়ারবেস থেকে ইউজারের রোল চেক করা
        const docSnap = await getDoc(doc(db, "users", currentUser.email));
        if (docSnap.exists()) setRole(docSnap.data().role);
      }
      
      setLoading(false);
      if (!currentUser && pathname !== "/login") router.push("/login");
    });
    return () => unsubscribe();
  }, [pathname, router]);

  // পেজ পরিবর্তন হলে মোবাইল মেনু বন্ধ হবে
  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // সাইডবারের মেনু (রোল অনুযায়ী লুকানো/দেখানো হবে)
  const navLinks = [
    { name: "Dashboard", href: "/", icon: <LayoutDashboard size={20} />, roles: ["admin", "manager", "merchandiser"] },
    { name: "Sample Tracking", href: "/samples", icon: <Package size={20} />, roles: ["admin", "merchandiser"] },
    { name: "Categories", href: "/categories", icon: <FolderPlus size={20} />, roles: ["admin"] },
    { name: "Products", href: "/products", icon: <Box size={20} />, roles: ["admin"] },
    { name: "Warehouse", href: "/warehouse", icon: <Store size={20} />, roles: ["admin"] },
    { name: "Shops", href: "/shops", icon: <Building2 size={20} />, roles: ["admin"] },
    { name: "Shop Inventory", href: "/shop-inventory", icon: <ClipboardList size={20} />, roles: ["admin", "manager"] },
    { name: "POS (Sales)", href: "/pos", icon: <ShoppingCart size={20} />, roles: ["admin", "manager"] },
    { name: "Sales History", href: "/sales", icon: <History size={20} />, roles: ["admin", "manager"] },
    { name: "Corporate Orders", href: "/orders", icon: <ShoppingBag size={20} />, roles: ["admin", "manager"] },
    { name: "Stock Logs", href: "/stock-logs", icon: <History size={20} />, roles: ["admin"] },
    { name: "Staff", href: "/staff", icon: <UserPlus size={20} />, roles: ["admin"] },
  ];

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1F2D5C" />
      </head>
      <body className={`${inter.className} bg-brand-light text-gray-800`}>
        {loading ? (
          <div className="flex items-center justify-center h-screen font-bold text-brand-navy text-xl">Loading...</div>
        ) : pathname === "/login" ? (
          <>{children}</>
        ) : (
          <div className="flex h-screen overflow-hidden">
            
            {/* মোবাইল টপ বার */}
            <div className="md:hidden fixed top-0 w-full bg-brand-navy text-white flex justify-between items-center p-4 z-50 shadow-md">
              <div className="flex items-center gap-2 font-bold text-lg">
                <div className="w-8 h-8 bg-white text-brand-navy rounded-full flex items-center justify-center">J</div>
                Jahid Accessories
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>

            {/* সাইডবার */}
            <div className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-brand-navy text-white flex flex-col h-full shadow-lg transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} pt-16 md:pt-0`}>
              <div className="hidden md:block p-6 border-b border-brand-silver/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-xl">J</div>
                  <h1 className="text-lg font-bold tracking-wider leading-tight">Jahid<br/>Accessories</h1>
                </div>
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">M-2 Maya Katra, Sadarghat,<br />Dhaka 1100</p>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navLinks.map((link) => (
                  link.roles.includes(role) && (
                    <Link key={link.href} href={link.href} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
                      {link.icon} <span className="font-medium">{link.name}</span>
                    </Link>
                  )
                ))}
              </nav>

              <div className="p-4 border-t border-brand-silver/30">
                <p className="text-xs text-gray-300 mb-1 truncate">{user?.email}</p>
                <p className="text-[10px] bg-white/10 px-2 py-0.5 rounded inline-block mb-2 uppercase">{role}</p>
                <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>

            {/* মেইন কন্টেন্ট */}
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
