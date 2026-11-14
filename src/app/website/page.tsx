// @ts-nocheck
"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  Menu, X, Award, Truck, Settings, DollarSign, 
  MapPin, Phone, Mail, Facebook, Linkedin, ArrowRight 
} from "lucide-react";

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const products = [
    { name: "Cotton Tape", desc: "Premium quality cotton tapes for all types of garments.", img: "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?q=80&w=600&auto=format&fit=crop" },
    { name: "Cotton Label", desc: "Durable and vibrant woven labels for branding.", img: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=600&auto=format&fit=crop" },
    { name: "Polestar Canvas", desc: "High-strength canvas tapes for heavy garments.", img: "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?q=80&w=600&auto=format&fit=crop" },
    { name: "Cotton File", desc: "Perfect cotton files for premium finishing.", img: "https://images.unsplash.com/photo-1584589167171-541ce45f1eea?q=80&w=600&auto=format&fit=crop" },
    { name: "Solder Tape", desc: "Reliable solder tapes for industrial use.", img: "https://images.unsplash.com/photo-1590483864801-95e6d25e7c76?q=80&w=600&auto=format&fit=crop" },
    { name: "Bright Tape", desc: "Bright and highly visible tapes for safety.", img: "https://images.unsplash.com/photo-1582298538104-fe2e2cd5e25a?q=80&w=600&auto=format&fit=crop" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ১. নেভিগেশন বার */}
      <nav className="fixed w-full bg-brand-navy text-white z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white text-brand-navy rounded-full flex items-center justify-center font-bold text-xl">J</div>
              <span className="font-bold text-lg tracking-wide">786 JAHID ACCESSORIES</span>
            </div>
            
            {/* ডেস্কটপ মেনু */}
            <div className="hidden md:flex space-x-6 items-center font-medium text-sm">
              <a href="#home" className="hover:text-gray-300 transition">Home</a>
              <a href="#about" className="hover:text-gray-300 transition">About</a>
              <a href="#products" className="hover:text-gray-300 transition">Products</a>
              <a href="#portfolio" className="hover:text-gray-300 transition">Portfolio</a>
              <a href="#contact" className="hover:text-gray-300 transition">Contact</a>
              <Link href="/login" className="bg-white text-brand-navy px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition">
                Login
              </Link>
            </div>

            {/* মোবাইল মেনু বাটন */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* মোবাইল মেনু লিস্ট */}
        {isMenuOpen && (
          <div className="md:hidden bg-brand-navy border-t border-white/10 px-4 pt-2 pb-4 space-y-2">
            <a href="#home" onClick={() => setIsMenuOpen(false)} className="block py-2 hover:text-gray-300">Home</a>
            <a href="#about" onClick={() => setIsMenuOpen(false)} className="block py-2 hover:text-gray-300">About Us</a>
            <a href="#products" onClick={() => setIsMenuOpen(false)} className="block py-2 hover:text-gray-300">Products</a>
            <a href="#portfolio" onClick={() => setIsMenuOpen(false)} className="block py-2 hover:text-gray-300">Portfolio</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)} className="block py-2 hover:text-gray-300">Contact</a>
            <Link href="/login" className="block bg-white text-brand-navy text-center mt-4 px-4 py-2 rounded-lg font-bold">
              Login to App
            </Link>
          </div>
        )}
      </nav>

      {/* ২. হিরো সেকশন */}
      <section id="home" className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 bg-gradient-to-b from-brand-navy to-blue-900 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Premium Garments Accessories for Global Brands
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Supplying high-quality Cotton Tape, Labels, Canvas, and more to top buying houses and garments in Bangladesh. Trusted quality, timely delivery.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="#portfolio" className="bg-white text-brand-navy px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg flex items-center justify-center gap-2">
              View Portfolio <ArrowRight size={20} />
            </a>
            <a href="#contact" className="border-2 border-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-white/10 transition">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* ৩. অ্যাবাউট সেকশন */}
      <section id="about" className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="w-full md:w-1/2">
            <img src="https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=800&auto=format&fit=crop" alt="Factory" className="rounded-xl shadow-lg w-full object-cover h-[300px] md:h-[400px]" />
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-brand-navy mb-4">About 786 Jahid Accessories</h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              With years of experience in the garments industry, 786 Jahid Accessories has become a trusted name in supplying premium accessories. We work closely with top buying houses and garment factories to ensure the best quality materials.
            </p>
            <p className="text-gray-600 mb-6 leading-relaxed">
              From Cotton Tapes to Polestar Canvas, we manufacture and supply a wide range of accessories that meet international standards. Your satisfaction and timely delivery are our top priorities.
            </p>
            <div className="flex gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center flex-1 border border-gray-200">
                <h3 className="text-2xl font-bold text-brand-navy">5+</h3>
                <p className="text-sm text-gray-500">Years Experience</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center flex-1 border border-gray-200">
                <h3 className="text-2xl font-bold text-brand-navy">100+</h3>
                <p className="text-sm text-gray-500">Happy Clients</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ৪. প্রোডাক্ট ক্যাটাগরি */}
      <section id="products" className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-brand-navy mb-2">Our Products</h2>
          <p className="text-gray-600">High-quality accessories for the garments industry.</p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((prod, idx) => (
            <div key={idx} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 group cursor-pointer">
              <div className="h-48 overflow-hidden">
                <img src={prod.img} alt={prod.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-brand-navy mb-2">{prod.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{prod.desc}</p>
                <a href="#contact" className="text-brand-navy font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                  Get Quote <ArrowRight size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ৫. পোর্টফোলিও */}
      <section id="portfolio" className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-brand-navy mb-2">Our Portfolio</h2>
          <p className="text-gray-600">A glimpse of the premium accessories we deliver.</p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div key={item} className="relative group rounded-xl overflow-hidden h-40 md:h-56 shadow-sm cursor-pointer">
              {/* এখানে পরে আপনার নিজের মালের ছবির লিংক বসাবেন */}
              <img src={`https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?q=80&w=400&auto=format&fit=crop&sig=${item}`} alt="Portfolio" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
              <div className="absolute inset-0 bg-brand-navy/60 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                <span className="text-white font-bold border border-white px-4 py-2 rounded-lg">View Product</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ৬. কেন আমাদের বেছে নেবেন */}
      <section className="py-16 px-4 bg-brand-navy text-white text-center">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-12">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center">
              <div className="bg-white/10 p-4 rounded-full mb-4"><Award size={32} className="text-white" /></div>
              <h3 className="font-bold text-lg mb-2">Premium Quality</h3>
              <p className="text-gray-300 text-sm">We never compromise on the quality of our accessories.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/10 p-4 rounded-full mb-4"><Truck size={32} className="text-white" /></div>
              <h3 className="font-bold text-lg mb-2">Timely Delivery</h3>
              <p className="text-gray-300 text-sm">We ensure your orders are delivered exactly on time.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/10 p-4 rounded-full mb-4"><Settings size={32} className="text-white" /></div>
              <h3 className="font-bold text-lg mb-2">Custom Solutions</h3>
              <p className="text-gray-300 text-sm">We provide accessories tailored to your specific needs.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/10 p-4 rounded-full mb-4"><DollarSign size={32} className="text-white" /></div>
              <h3 className="font-bold text-lg mb-2">Competitive Pricing</h3>
              <p className="text-gray-300 text-sm">Best market rates without sacrificing quality.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ৭. ক্লায়েন্ট */}
      <section className="py-12 bg-gray-100 text-center px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-gray-500 font-bold mb-6 uppercase tracking-wider text-sm">Trusted by Top Buying Houses & Garments</p>
          <div className="flex flex-wrap justify-center gap-8 opacity-60 grayscale">
            <h3 className="text-2xl font-black">ZARA</h3>
            <h3 className="text-2xl font-black">H&M</h3>
            <h3 className="text-2xl font-black">BEXIMCO</h3>
            <h3 className="text-2xl font-black">REEDISHA</h3>
            <h3 className="text-2xl font-black">VIYELLATEX</h3>
          </div>
        </div>
      </section>

      {/* ৮. যোগাযোগ */}
      <section id="contact" className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-10">
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-brand-navy mb-6">Get in Touch</h2>
            <p className="text-gray-600 mb-8">Have an inquiry or need a quote? Send us a message and our team will get back to you shortly.</p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="bg-gray-50 p-3 rounded-lg"><MapPin className="text-brand-navy" /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Address</h4>
                  <p className="text-gray-600 text-sm">Mirpur, Dhaka, Bangladesh</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-gray-50 p-3 rounded-lg"><Phone className="text-brand-navy" /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Phone</h4>
                  <p className="text-gray-600 text-sm">+880 17xxxxxxxx</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-gray-50 p-3 rounded-lg"><Mail className="text-brand-navy" /></div>
                <div>
                  <h4 className="font-bold text-gray-800">Email</h4>
                  <p className="text-gray-600 text-sm">info@jahidaccessories.com</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/2 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
                <input type="text" placeholder="John Doe" className="w-full border p-3 rounded-lg outline-none focus:border-brand-navy bg-white" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Your Email</label>
                <input type="email" placeholder="john@example.com" className="w-full border p-3 rounded-lg outline-none focus:border-brand-navy bg-white" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Message</label>
                <textarea rows={4} placeholder="I need a quote for Cotton Tape..." className="w-full border p-3 rounded-lg outline-none focus:border-brand-navy bg-white"></textarea>
              </div>
              <button type="submit" className="w-full bg-brand-navy text-white py-3 rounded-lg font-bold hover:bg-blue-900 transition">Send Message</button>
            </form>
          </div>
        </div>
      </section>

      {/* ৯. ফুটার */}
      <footer className="bg-brand-navy text-white py-8 text-center px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">© {new Date().getFullYear()} 786 Jahid Accessories. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><Facebook size={20} /></a>
            <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><Linkedin size={20} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
