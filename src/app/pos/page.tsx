"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, addDoc, increment } from "firebase/firestore";
import { Store, ShoppingCart, DollarSign, Download, Share2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function POSPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  const [message, setMessage] = useState("");
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  useEffect(() => {
    const qShops = query(collection(db, "shops"));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setShops(data);
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0].name);
      }
    });
    return () => unsubShops();
  }, [selectedShop]);

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
    const itemId = e.target.value;
    const item = inventory.find(i => i.id === itemId);
    setSelectedItem(item || null);
    if (item) {
      setSellPrice(item.sellingPrice);
      setQuantity(1);
    }
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedItem) {
      setMessage("Error: প্রোডাক্ট সিলেক্ট করুন।");
      return;
    }
    if (quantity <= 0) {
      setMessage("Error: পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }
    if (quantity > selectedItem.stock) {
      setMessage(`Error: এই প্রোডাক্টের স্টক মাত্র ${selectedItem.stock} পিস!`);
      return;
    }
    if (sellPrice <= 0) {
      setMessage("Error: বিক্রির দাম ০ এর বেশি হতে হবে।");
      return;
    }
    if (!customerName || !customerPhone) {
      setMessage("Error: কাস্টমারের নাম এবং মোবাইল নম্বর দিন।");
      return;
    }

    try {
      const itemRef = doc(db, "shop_inventories", selectedItem.id);
      await updateDoc(itemRef, { stock: increment(-quantity) });

      const totalAmount = quantity * sellPrice;
      const totalCost = quantity * selectedItem.costPrice;
      const profit = totalAmount - totalCost;

      const saleData = {
        shop: selectedShop,
        customerName,
        customerPhone,
        productName: selectedItem.productName,
        category: selectedItem.category,
        size: selectedItem.size,
        color: selectedItem.color,
        quantity: quantity,
        sellPrice: sellPrice,
        totalAmount: totalAmount,
        costPrice: selectedItem.costPrice,
        totalCost: totalCost,
        profit: profit,
        paymentMethod: paymentMethod,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "sales"), saleData);
      setLastReceipt({ id: docRef.id, ...saleData });

      setMessage(`Success: ${quantity} পিস বিক্রি হয়েছে! মোট: Tk. ${totalAmount}`);
      setSelectedItem(null);
      setQuantity(1);
      setSellPrice(0);
      setCustomerName("");
      setCustomerPhone("");
      
    } catch (error) {
      console.error(error);
      setMessage("Error: বিক্রি করতে সমস্যা হয়েছে!");
    }
  };

  // নতুন ও প্রফেশনাল PDF জেনারেটর
  const generatePDF = () => {
    if (!lastReceipt) return;
    const doc = new jsPDF();

    // কোম্পানির হেডার
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 45, 92); 
    doc.text("Jahid Accessories", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("M-2 Maya Katra, Sadarghat, Dhaka 1100", 14, 32);
    doc.text("Phone: +880 1701-665861", 14, 37);

    // ইনভয়েস টাইটেল (ডান দিকে)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 45, 92);
    doc.text("INVOICE", 196, 25, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(`Invoice ID: ${lastReceipt.id.slice(0, 8).toUpperCase()}`, 196, 32, { align: "right" });
    doc.text(`Date: ${new Date(lastReceipt.date).toLocaleDateString()}`, 196, 37, { align: "right" });

    // কাস্টমার ইনফো
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 14, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${lastReceipt.customerName}`, 14, 56);
    doc.text(`Mobile: ${lastReceipt.customerPhone}`, 14, 61);

    // টেবিল ডেটা (Tk. ব্যবহার করা হয়েছে)
    const tableData = [
      [
        lastReceipt.productName,
        lastReceipt.size,
        lastReceipt.color,
        lastReceipt.quantity.toString(),
        `Tk. ${lastReceipt.sellPrice}`, 
        `Tk. ${lastReceipt.totalAmount}`
      ]
    ];

    autoTable(doc, {
      startY: 70,
      head: [['Product Name', 'Size', 'Color', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 45, 92], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    // টোটাল সেকশন
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Payment Method: ${lastReceipt.paymentMethod}`, 14, finalY);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: Tk. ${lastReceipt.totalAmount}`, 196, finalY, { align: "right" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Thank you for your business!", 14, finalY + 20);

    // PDF ডাউনলোড
    doc.save(`Invoice_${lastReceipt.id.slice(0, 8)}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!lastReceipt) return;
    
    let phone = lastReceipt.customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '88' + phone;
    } else if (!phone.startsWith('88')) {
      phone = '88' + phone;
    }

    const text = `*Jahid Accessories*\nM-2 Maya Katra, Sadarghat, Dhaka\n\n*Invoice:* ${lastReceipt.id.slice(0, 8).toUpperCase()}\n*Customer:* ${lastReceipt.customerName}\n\n*Product:* ${lastReceipt.productName} (${lastReceipt.size}/${lastReceipt.color})\n*Qty:* ${lastReceipt.quantity} pcs\n*Total:* Tk. ${lastReceipt.totalAmount}\n*Payment:* ${lastReceipt.paymentMethod}\n\nThank you for your business!`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-brand-navy flex items-center gap-2">
          <ShoppingCart size={28} /> POS (Sales)
        </h2>
        
        <div className="flex items-center gap-2 bg-white border p-2 rounded-lg shadow-sm">
          <Store size={20} className="text-brand-navy" />
          <select 
            className="font-medium text-brand-navy outline-none bg-transparent cursor-pointer"
            value={selectedShop} 
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.name}>{shop.name}</option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {lastReceipt && (
        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-600 mb-8">
          <h3 className="text-xl font-bold mb-2 text-green-700">Sale Completed Successfully!</h3>
          <p className="text-gray-600 mb-4">Invoice for {lastReceipt.customerName} (Tk. {lastReceipt.totalAmount})</p>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePDF} className="bg-brand-navy text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-navy/90 flex items-center gap-2">
              <Download size={18} /> Download PDF
            </button>
            <button onClick={shareWhatsApp} className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 flex items-center gap-2">
              <Share2 size={18} /> Share on WhatsApp
            </button>
            <button onClick={() => setLastReceipt(null)} className="text-gray-500 px-4 py-2 hover:bg-gray-100 rounded-lg font-medium">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-brand-navy">
        <h3 className="text-xl font-bold mb-4 text-brand-navy flex items-center gap-2">
          <DollarSign size={22} /> New Sale
        </h3>
        
        <form onSubmit={handleSale} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div>
            <label className="block text-sm font-medium mb-1">Customer Name</label>
            <input required placeholder="Enter customer name" className="w-full border p-2 rounded-lg" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer Mobile</label>
            <input required type="tel" placeholder="e.g. 017XXXXXXXX" className="w-full border p-2 rounded-lg" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <div className="md:col-span-2 border-t pt-4"></div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Select Product from Stock</label>
            <select required className="w-full border p-2 rounded-lg" onChange={handleItemChange} value={selectedItem?.id || ""}>
              <option value="" disabled>-- Select Product --</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.productName} ({item.size} / {item.color}) - Stock: {item.stock} pcs
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input required type="number" min="1" className="w-full border p-2 rounded-lg" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} disabled={!selectedItem} />
            {selectedItem && <p className="text-xs text-gray-500 mt-1">Available: {selectedItem.stock} pcs</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Selling Price (Tk.)</label>
            <input required type="number" min="1" className="w-full border p-2 rounded-lg font-bold text-green-700" value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value))} disabled={!selectedItem} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select className="w-full border p-2 rounded-lg" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Bkash">Bkash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
            </select>
          </div>

          <div className="md:col-span-2 mt-4">
            {selectedItem && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Total Amount:</span>
                  <span className="font-bold">Tk. {quantity * sellPrice}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Estimated Profit:</span>
                  <span className="font-bold">Tk. {(sellPrice - selectedItem.costPrice) * quantity}</span>
                </div>
              </div>
            )}
            
            <button type="submit" disabled={!selectedItem} className="bg-green-600 text-white w-full py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400 transition">
              Complete Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
