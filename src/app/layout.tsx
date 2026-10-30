import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Package } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jahid Accessories ERP",
  description: "Garments ERP System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex bg-brand-light text-gray-800 h-screen overflow-hidden`}>
        {/* Sidebar */}
        <div className="w-64 bg-brand-navy text-white flex flex-col h-full shadow-lg">
          <div className="p-6 border-b border-brand-silver/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-brand-navy text-xl">
                J
              </div>
              {/* এখানে নাম পরিবর্তন করা হয়েছে */}
              <h1 className="text-lg font-bold tracking-wider leading-tight"> Jahid<br/>Accessories</h1>
            </div>
            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
              M-2 Maya Katra, Sadarghat,<br />Dhaka 1100<br />
              📞 +880 1701-665861
            </p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link href="/samples" className="flex items-center gap-3 px-4 py-3 hover:bg-brand-silver/20 rounded-lg transition">
              <Package size={20} />
              <span className="font-medium">Sample Tracking</span>
            </Link>
          </nav>

          <div className="p-4 border-t border-brand-silver/30 text-xs text-gray-400 text-center">
            {/* ফুটার পরিবর্তন করা হয়েছে */}
            © 2026 Jahid Accessories
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto h-full">
          {children}
        </main>
      </body>
    </html>
  );
}
