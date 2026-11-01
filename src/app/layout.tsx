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
        if (currentUser.email === "admin@jahid.com") {
          setRole("admin");
        } else {
          try {
            const docSnap = await getDoc(doc(db, "users", currentUser.email));
            if (docSnap.exists()) {
              setRole(docSnap.data().role || "manager");
            } else {
              setRole("manager");
            }
          } catch (error) {
            setRole("manager");
          }
        }
      }
      
      setLoading(false);
      
      // ✅ এখানে চেক করা হয়েছে: যদি পেজটি '/track' না হয় এবং ইউজার লগইন না থাকে, তবেই লগইন পেজে পাঠাবে।
      if (!currentUser && pathname !== "/login" && !pathname.startsWith("/track")) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navLinks = [
    { name: "Dashboard", href: "/", icon: <LayoutDashboard size={18} />, roles: ["admin", "manager", "assistant_manager", "warehouse_manager", "merchandiser", "engineer", "quality_inspector"] },
    { name: "Sample Tracking", href: "/samples", icon: <Package size={18} />, roles: ["admin", "manager", "assistant_manager", "merchandiser", "quality_inspector"] },
    { name: "Categories", href: "/categories", icon: <FolderPlus size={18} />, roles: ["admin", "manager"] },
    { name: "Products", href: "/products", icon: <Box size={18} />, roles: ["admin", "manager"] },
    { name: "Warehouse", href: "/warehouse", icon: <Store size={18} />, roles: ["admin", "warehouse_manager"] },
    { name: "Shops", href: "/shops", icon: <Building2 size={18} />, roles: ["admin"] },
    { name: "Shop Inventory", href: "/shop-inventory", icon: <ClipboardList size={18} />, roles: ["admin", "manager", "assistant_manager"] },
    { name: "POS (Sales)", href: "/pos", icon: <ShoppingCart size={18} />, roles: ["admin", "manager", "assistant_manager"] },
    { name: "Sales History", href: "/sales", icon: <History size={18} />, roles: ["admin", "manager", "assistant_manager"] },
    { name: "Corporate Orders", href: "/orders", icon: <ShoppingBag size={18} />, roles: ["admin", "manager", "assistant_manager", "merchandiser"] },
    { name: "Stock Logs", href: "/stock-logs", icon: <History size={18} />, roles: ["admin", "warehouse_manager"] },
    { name: "Staff", href: "/staff", icon: <UserPlus size={18} />, roles: ["admin", "manager"] },
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
        ) : 
        // ✅ বায়ার লিংকে ঢুকলে সাইডবার বা লগইন চেক ছাড়া সরাসরি পেজ দেখাবে
        pathname === "/login" || pathname.startsWith("/track") ? (
          <>{children}</>
        ) : (
          <div className="flex h-screen overflow-hidden">
            
            {/* মোবাইল টপ বার */}
            <div className="md:hidden fixed top-0 w-full bg-brand-navy text-white flex justify-between items-center px-4 py-3 z-50 shadow-md">
              <div className="flex items-center gap-2 font-bold text-base">
                <div className="w-7 h-7 bg-white text-brand-navy rounded-full flex items-center justify-center text-sm">J</div>
                Jahid Accessories
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>

            {/* ওভারলে */}
            {isMobileMenuOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden" 
                onClick={() => setIsMobileMenuOpen(false)}
              ></div>
            )}

            {/* সাইডবার */}
            <div className={`fixed md:static inset-y-0 left-0 z-40 w-60 bg-brand-navy text-white flex flex-col h-full shadow-lg transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} pt-14 md:pt-0`}>
              <div className="hidden md:block p-5 border-b border-brand-silver/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-lg">J</div>
                  <h1 className="text-base font-bold tracking-wider leading-tight">Jahid<br/>Accessories</h1>
                </div>
                <p className="text-[10px] text-gray-300 mt-1 leading-tight">M-2 Maya Katra, Sadarghat,<br />Dhaka 1100</p>
              </div>

              <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
                {navLinks.map((link) => (
                  link.roles.includes(role) && (
                    <Link key={link.href} href={link.href} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-brand-silver/20 rounded-lg transition">
                      {link.icon} <span className="font-medium">{link.name}</span>
                    </Link>
                  )
                ))}
              </nav>

              <div className="p-3 border-t border-brand-silver/30">
                <p className="text-[11px] text-gray-300 mb-1 truncate">{user?.email}</p>
                <p className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded inline-block mb-2 uppercase">{role}</p>
                <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-300 hover:text-white">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>

            {/* মেইন কন্টেন্ট */}
            <main className="flex-1 overflow-y-auto h-full pt-14 md:pt-0">
              <div className="p-4 md:p-6 pb-20">
                {children}
              </div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
