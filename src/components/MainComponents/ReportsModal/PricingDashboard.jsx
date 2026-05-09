import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Edit3, X, ChevronDown, Loader2, Camera,
  AlertCircle, Image as ImageIcon, Type, Tag, ShoppingBag, Plus, RefreshCw, CheckCircle2
} from 'lucide-react';

const COLORS = {
  brand: "#2563eb",
  brandLighter: "rgba(37, 99, 235, 0.05)",
  brandShadow: "rgba(37, 99, 235, 0.2)",
};

const PricingDashboard = ({ isOpen, onClose }) => {
  const apiHost = "http://localhost"; 
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [enablePictures, setEnablePictures] = useState(true);

  // Success Notification
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Add Product State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    inv_code: '', item_name: '', item_category: '', unit_of_measure: 'PC',
    srp: '', vatable: 'Yes', isDiscountable: 'Yes', target_sales_type: '' 
  });

  // Edit Price State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) fetchPricingData();
  }, [isOpen]);

  const fetchPricingData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiHost}/api/get_pricing.php`);
      setProducts(response.data);
      if (response.data.length > 0) {
        if (!selectedService) setSelectedService(response.data[0].service_type || 'DINE-IN');
        if (!activeCategory) setActiveCategory(response.data[0].item_category || 'OTHERS');
      }
    } catch (error) { console.error("Fetch Error:", error); } finally { setLoading(false); }
  };

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Image Upload Logic
  const handleImageUpload = async (e, itemName) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('item_name', itemName);
    formData.append('action', 'upload_image');
    try {
      const response = await axios.post(`${apiHost}/api/pricing_engine.php`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.status === "success") {
        fetchPricingData(); 
        triggerSuccess("Product image updated!");
      }
    } catch (error) { alert("Upload failed."); }
  };

  const generateInvCode = () => {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
    setNewProduct(prev => ({ ...prev, inv_code: `BD-${randomDigits}` }));
  };

  const handleOpenAddModal = () => {
    generateInvCode();
    setNewProduct(prev => ({ ...prev, target_sales_type: selectedService, item_category: categories[0] || '' }));
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setNewPrice(item.srp);
    setShowConfirm(false);
    setIsModalOpen(true);
  };

  const handleAddProduct = async () => {
    const userId = localStorage.getItem('user_id') || '0';
    try {
      const response = await axios.post(`${apiHost}/api/pricing_engine.php`, {
        action: 'add', ...newProduct, user_id: userId
      });
      if (response.data.status === "success") {
        setIsAddModalOpen(false);
        fetchPricingData();
        triggerSuccess("New product added successfully!");
      }
    } catch (error) { alert("Error adding product."); }
  };

  const executeUpdate = async () => {
    const userId = localStorage.getItem('user_id') || '0';
    try {
      const response = await axios.post(`${apiHost}/api/pricing_engine.php`, {
        action: 'update', inv_code: editingItem.inv_code, new_price: parseFloat(newPrice),
        service_type: selectedService, user_id: userId
      });
      if (response.data.status === "success") {
        setIsModalOpen(false);
        fetchPricingData();
        triggerSuccess("Price updated successfully!");
      }
    } catch (error) { alert("Update failed."); }
  };

  if (!isOpen) return null;

  const categories = [...new Set(products.map(p => p.item_category || 'OTHERS'))];
  const serviceTypes = [...new Set(products.map(p => p.service_type))].filter(Boolean);
  const uomList = ["PC", "BOX", "KILO", "PACK", "BOTTLE"];
  
  const filteredProducts = products.filter(item => 
    item.service_type === selectedService && (item.item_category || 'OTHERS') === activeCategory &&
    item.item_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 font-sans overflow-hidden text-slate-700">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col w-full h-full max-w-[1200px] max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
        >
          {/* HEADER */}
          <div className="p-6 border-b border-slate-50">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: COLORS.brandLighter, color: COLORS.brand }}><Tag size={18} /></div>
                <div>
                  <h1 className="text-lg font-black tracking-tight uppercase">Pricing Engine</h1>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Terminal: <span style={{ color: COLORS.brand }}>{selectedService}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleOpenAddModal} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
                  <Plus size={16}/><span className="text-[11px] font-black uppercase">New Product</span>
                </button>
                <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[11px] font-black outline-none">
                  {serviceTypes.map((type, i) => <option key={i} value={type}>{type}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-300" size={14} />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="py-2.5 pl-9 pr-4 bg-slate-50 rounded-xl border text-[11px] font-bold outline-none w-48 focus:w-64 transition-all" />
                </div>
                <button onClick={onClose} className="p-2 transition-colors text-slate-300 hover:text-rose-500"><X size={20} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat, idx) => (
                <button key={idx} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${activeCategory === cat ? "bg-blue-600 border-blue-600 text-white shadow-md scale-105" : "bg-white text-slate-400 border-slate-100"}`}>{cat}</button>
              ))}
            </div>
          </div>

          {/* GRID */}
          <div className="flex-1 p-8 overflow-y-auto bg-[#fcfdfe] no-scrollbar">
            {loading ? (
              <div className="flex justify-center mt-20"><Loader2 className="text-blue-600 animate-spin" size={32} /></div>
            ) : (
              <div className={`grid gap-5 ${enablePictures ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1'}`}>
                {filteredProducts.map((item, idx) => (
                  <motion.div layout key={idx} className="relative flex flex-col overflow-hidden rounded-[2.2rem] border border-slate-100 bg-white shadow-sm group">
                    {enablePictures && (
                      <div className="relative w-full overflow-hidden aspect-square bg-slate-50">
                        <img 
                          src={`${apiHost}/item_pictures/${item.item_description}.jpg?t=${new Date().getTime()}`} 
                          className="object-cover w-full h-full transition-transform group-hover:scale-105"
                          onError={(e) => { e.target.src = `${apiHost}/item_pictures/default.jpg`; }} 
                        />
                      </div>
                    )}
                    <div className="flex flex-col justify-between flex-1 p-5">
                      <div>
                        <p className="text-[8px] font-black uppercase text-blue-600">{item.inv_code}</p>
                        <h3 className="text-[11px] font-black text-slate-700 leading-tight uppercase line-clamp-2">{item.item_description}</h3>
                      </div>
                      <div className="flex items-end justify-between mt-4">
                        <p className="text-[18px] font-black text-blue-600">₱{Number(item.srp).toLocaleString()}</p>
                        <div className="flex items-center gap-2">
                          <label className="p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer shadow-sm border border-blue-100">
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, item.item_description)} />
                            <Camera size={14} strokeWidth={2.5} />
                          </label>
                          <button onClick={() => openEditModal(item)} className="p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm border border-blue-100">
                            <Edit3 size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* SUCCESS TOAST */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-10 z-[10000000] flex items-center gap-4 px-8 py-5 bg-white border border-blue-100 rounded-3xl shadow-2xl left-1/2 -translate-x-1/2"
          >
            <CheckCircle2 className="text-blue-600" size={24} />
            <p className="text-[13px] font-bold text-slate-700">{successMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD PRODUCT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-[450px] bg-white rounded-[2.5rem] p-10 shadow-2xl border border-white max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <h2 className="mb-8 text-xs font-black uppercase text-slate-700 tracking-[0.2em] flex items-center gap-2">
                <Plus size={16} className="text-blue-600" /> New Inventory Entry
              </h2>
              <div className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Product ID</label>
                    <div className="relative mt-1">
                      <input type="text" readOnly value={newProduct.inv_code} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black text-blue-600 border border-slate-100" />
                      <button onClick={generateInvCode} className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-300 hover:text-blue-500"><RefreshCw size={14}/></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Sales Mode</label>
                    <select value={newProduct.target_sales_type} onChange={(e) => setNewProduct({...newProduct, target_sales_type: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100 outline-none">
                       {serviceTypes.map((type, i) => <option key={i} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Product Name</label>
                  <input type="text" value={newProduct.item_name} onChange={(e) => setNewProduct({...newProduct, item_name: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-bold border border-slate-100 outline-none" placeholder="Enter name..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Category</label>
                    <select value={newProduct.item_category} onChange={(e) => setNewProduct({...newProduct, item_category: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100 uppercase">
                       {categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">UOM</label>
                    <select value={newProduct.unit_of_measure} onChange={(e) => setNewProduct({...newProduct, unit_of_measure: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100">
                       {uomList.map((u, i) => <option key={i} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Selling Price (SRP)</label>
                  <input type="number" value={newProduct.srp} onChange={(e) => setNewProduct({...newProduct, srp: e.target.value})} className="w-full px-4 py-3 mt-1 text-lg font-black text-blue-600 border outline-none bg-slate-50 rounded-xl" placeholder="0.00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Vatable</label>
                    <select value={newProduct.vatable} onChange={(e) => setNewProduct({...newProduct, vatable: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100">
                       <option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase">Discountable</label>
                    <select value={newProduct.isDiscountable} onChange={(e) => setNewProduct({...newProduct, isDiscountable: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-black border border-slate-100">
                       <option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-10">
                <button onClick={() => setIsAddModalOpen(false)} className="py-4 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-[1.2rem]">Abort</button>
                <button onClick={handleAddProduct} className="py-4 text-white text-[10px] font-black uppercase rounded-[1.2rem] bg-blue-600 shadow-lg shadow-blue-600/20">Save Entry</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT PRICE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-[300px] bg-white rounded-[2.5rem] p-10 shadow-2xl text-center border border-white"
            >
              {!showConfirm ? (
                <>
                  <div className="flex items-center justify-center mx-auto mb-4 w-14 h-14 rounded-2xl" style={{ backgroundColor: COLORS.brandLighter, color: COLORS.brand }}><Edit3 size={24} /></div>
                  <p className="text-[10px] font-black uppercase text-blue-600 mb-2">{selectedService}</p>
                  <h2 className="mb-8 text-xs font-black leading-snug uppercase text-slate-700 line-clamp-2">{editingItem?.item_description}</h2>
                  <div className="relative mb-8 group">
                    <span className="absolute text-xl font-black -translate-y-1/2 left-5 top-1/2 text-slate-300">₱</span>
                    <input autoFocus type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full py-5 pl-10 pr-6 text-3xl font-black transition-all border-2 outline-none bg-slate-50 border-slate-50 rounded-2xl text-slate-800 focus:border-blue-500 focus:bg-white" />
                  </div>
                  <button onClick={() => setShowConfirm(true)} className="w-full py-4 text-white text-[11px] font-black uppercase rounded-2xl shadow-lg bg-blue-600">Update Price</button>
                  <button onClick={() => setIsModalOpen(false)} className="mt-4 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                </>
              ) : (
                <div className="py-2">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 text-blue-600 rounded-full bg-blue-50"><AlertCircle size={32} /></div>
                  <h3 className="mb-2 text-lg font-black tracking-tight uppercase text-slate-800">Confirm Change?</h3>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button onClick={() => setShowConfirm(false)} className="py-4 bg-slate-100 text-slate-500 text-[10px] font-black rounded-xl uppercase">No</button>
                    <button onClick={executeUpdate} className="py-4 text-white text-[10px] font-black rounded-xl uppercase bg-blue-600 shadow-lg shadow-blue-600/20">Confirm</button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PricingDashboard;