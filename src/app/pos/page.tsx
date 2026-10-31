"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, addDoc, increment, getDoc } from "firebase/firestore";
import { Store, ShoppingCart, DollarSign, Download, Share2, User, MapPin, X, Receipt } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function POSPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("");
  const [userShop, setUserShop] = useState(""); // ম্যানেজারের নিজের দোকান
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  
  const [message, setMessage] = useState("");
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ইউজারের রোল ও দোকান চেক করা
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        const docSnap = await getDoc(doc(db, "users", user.email));
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
          setUserShop(docSnap.data().assignedShop || "");
          // যদি ম্যানেজার হয়, তবে তার দোকান অটো সিলেক্ট হবে
          if (docSnap.data().role === "manager") {
            setSelectedShop(docSnap.data().assignedShop);
          }
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop && userRole === "admin") {
        setSelectedShop(data[0].name); // অ্যাডমিন হলে প্রথম দোকান ডিফল্ট
      }
    });
    return () => unsubShops();
  }, [selectedShop, userRole]);

  useEffect(() => {
    if (!selectedShop) return;
    const qInv = query(collection(db, "shop_inventories"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const allData: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filteredData = allData.filter((item) => item.shop === selectedShop);
      setInventory(filteredData);
    });
    return () => unsubInv();
  }, [selectedShop]);

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const item = inventory.find(i => i.id === e.target.value);
    setSelectedItem(item || null);
    if (item) { setSellPrice(item.sellingPrice); setQuantity(1); }
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!selectedItem || quantity <= 0 || sellPrice <= 0 || !customerName || !customerPhone) {
      setMessage("Error: সব তথ্য সঠিকভাবে পূরণ করুন।"); return;
    }
    if (quantity > selectedItem.stock) {
      setMessage(`Error: এই প্রোডাক্টের স্টক মাত্র ${selectedItem.stock} পিস!`); return;
    }

    try {
      const itemRef = doc(db, "shop_inventories", selectedItem.id);
      await updateDoc(itemRef, { stock: increment(-quantity) });

      const totalAmount = quantity * sellPrice;
      const profit = totalAmount - (quantity * selectedItem.costPrice);

      const saleData = {
        shop: selectedShop, customerName, customerPhone, customerAddress,
        productName: selectedItem.productName, category: selectedItem.category,
        size: selectedItem.size, color: selectedItem.color, quantity: quantity,
        sellPrice: sellPrice, totalAmount: totalAmount, costPrice: selectedItem.costPrice,
        profit: profit, paymentMethod: paymentMethod, date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "sales"), saleData);
      setLastReceipt({ id: docRef.id, ...saleData });
      setShowPreview(true);
      
      setSelectedItem(null); setQuantity(1); setSellPrice(0);
      setCustomerName(""); setCustomerPhone(""); setCustomerAddress("");
    } catch (error) { setMessage("Error: বিক্রি করতে সমস্যা হয়েছে!"); }
  };

  // বাকি PDF, WhatsApp এবং রিটার্ন কোড আগের মতোই থাকবে...
  // (কোড ছোট রাখার জন্য এখানে PDF এবং রিটার্ন JSX অংশ বাদ দেওয়া হলো, 
  // আপনি আপনার আগের POS ফাইলের PDF এবং JSX অংশটা হুবহু এখানে বসিয়ে নিন)
  
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2"><ShoppingCart size={28} /> POS (Sales)</h2>
        
        {/* শুধু অ্যাডমিন দোকান চেঞ্জ করতে পারবে */}
        {userRole === "admin" ? (
          <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
            <Store size={20} className="text-brand-navy" />
            <select className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
              {shops.map((shop) => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2">
            <Store size={20} /> {userShop}
          </div>
        )}
      </div>

      {/* বাকি ফর্ম এবং UI আগের মতোই থাকবে */}
      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy">
        <p className="text-center text-gray-500 py-10">POS ফর্ম এবং ইনভয়েস প্রিভিউ (আপনার আগের কোড থেকে বসিয়ে নিন)</p>
      </div>
    </div>
  );
}
