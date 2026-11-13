// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase"; // ✅ এখানে পাথ ঠিক করা হয়েছে
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Box, Package, Upload, Store, FileText, Users, ShoppingCart, Database, LogOut } from "lucide-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === "/";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        if (user.email === "admin@jahid.com") {
          setUserRole("admin");
          setUserName("Admin");
        } else {
          const docSnap = await getDoc(doc(db, "users", user.email));
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
            setUserName(docSnap.data().name);
          }
        }
      } else {
        if (pathname !== "/login") router.push("/login");
      }
    });
    return () => unsub();
  }, [pathname, router]);

  const navLinks = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Sales", href: "/sales", icon: ShoppingCart },
    { name: "Buyers", href: "/buyer-statement", icon: Users },
    { name: "Samples", href: "/samples", icon: Box },
    { name: "Shop Inventory", href: "/shop-inventory", icon: Package },
    { name: "Warehouse", href: "/warehouse", icon: Store },
    { name: "Products", href: "/products", icon: Database },
    { name: "Categories", href: "/categories", icon: FileText },
    { name: "Bulk Upload", href: "/bulk-upload", icon: Upload },
    { name: "Staff", href: "/staff", icon: Users },
  ];

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex h-screen bg-gray-50">
      {!isHome && (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-navy text-white transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-300`}>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h1 className="text-xl font-bold">Jahid Accessories</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X size={24} /></button>
          </div>
          
          <div className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-140px)]">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.name} href={link.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition ${pathname === link.href ? "bg-white/20 font-bold" : ""}`}>
                  <Icon size={20} /> {link.name}
                </Link>
              );
            })}
          </div>

          <div className="absolute bottom-0 w-full p-4 border-t border-white/10">
            <button onClick={() => auth.signOut().then(() => router.push("/login"))} className="flex items-center gap-2 text-red-300 hover:text-white w-full p-2"><LogOut size={20} /> Logout</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`bg-white shadow-sm p-4 flex items-center justify-between ${isHome ? "hidden md:flex" : "flex"}`}>
          <button onClick={() => setIsSidebarOpen(true)} className={`${isHome ? "md:hidden" : ""}`}><Menu size={24} /></button>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-700">{userName} ({userRole})</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
