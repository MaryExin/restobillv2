import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Edit3, X, ChevronDown, Loader2, 
  AlertCircle, DollarSign, RefreshCw 
} from 'lucide-react';

const COLORS = {
  brand: "#2563eb", 
  brandLighter: "rgba(37, 99, 235, 0.1)",
};

const PricingDashboard = ({ isOpen, onClose }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPricingData();
      triggerBackgroundSync();
    }
  }, [isOpen]);

  const fetchPricingData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost/api/get_pricing.php');
      setProducts(response.data);
      if (response.data.length > 0) {
        if (!selectedService) setSelectedService(response.data[0].service_type);
        if (!activeCategory) setActiveCategory(response.data[0].item_category || 'OTHERS');
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const triggerBackgroundSync = () => {
    setIsSyncing(true);
    axios.get('http://localhost/api/sync_to_web.php').finally(() => setIsSyncing(false));
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setNewPrice(item.srp); 
    setIsModalOpen(true);   
    setShowConfirm(false);  
  };

  const executeUpdate = async () => {
    const userId = localStorage.getItem('user_id') || '0';
    const userEmail = localStorage.getItem('email') || 'system@internal.com';
    const pCode = editingItem?.pricing_code || 'N/A';

    try {
      const response = await axios.post('http://localhost/api/update_pricing.php', {
        inv_code: editingItem.inv_code,
        pricing_code: pCode,
        new_price: parseFloat(newPrice),
        service_type: selectedService,
        user_id: userId,
        user_name: userEmail 
      });

      if (response.data.status === "success") {
        setIsModalOpen(false);
        fetchPricingData();
        triggerBackgroundSync();
      }
    } catch (error) {
      alert("Error: Update failed.");
    }
  };

  if (!isOpen) return null;

  const categories = [...new Set(products.map(p => p.item_category || 'OTHERS'))];
  const serviceTypes = [...new Set(products.map(p => p.service_type))];
  
  const filteredProducts = products.filter(item => 
    item.service_type === selectedService && 
    (item.item_category || 'OTHERS') === activeCategory &&
    item.item_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-sans">
      <div className="flex flex-col w-full h-full max-w-[1200px] max-h-[90vh] bg-[#fcfdfe] rounded-3xl overflow-hidden shadow-2xl border border-slate-100 transition-colors">
        
        {/* HEADER */}
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: COLORS.brandLighter, color: COLORS.brand }}>
                  <DollarSign size={20} strokeWidth={3} />
                </div>
                <h1 className="text-2xl font-black tracking-tight uppercase text-slate-800">Pricing Dashboard</h1>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-10">Local Engine + Cloud Sync Queue</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative min-w-[200px]">
                <label className="text-[8px] font-black text-slate-400 uppercase absolute -top-4 left-1">Service Type</label>
                <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full p-2.5 pl-4 pr-10 text-xs font-black bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700">
                  {serviceTypes.map((type, i) => <option key={i} value={type}>{type}</option>)}
                </select>
                <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400" size={14} />
              </div>

              <div className="relative w-72">
                <Search className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold outline-none text-slate-800" />
              </div>
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500"><X size={24} /></button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 pb-2 overflow-x-auto border-t no-scrollbar border-slate-50">
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => setActiveCategory(cat)}
                style={{ 
                    backgroundColor: activeCategory === cat ? COLORS.brand : 'transparent',
                    color: activeCategory === cat ? 'white' : '#64748b',
                    borderColor: activeCategory === cat ? COLORS.brand : '#f1f5f9'
                }}
                className={`flex-shrink-0 px-5 py-2 rounded-xl text-[11px] transition-all border font-bold hover:bg-slate-50 ${activeCategory === cat ? 'hover:bg-blue-700' : ''}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="flex-1 p-8 overflow-y-auto bg-[#f8fafc]">
          {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin" style={{ color: COLORS.brand }} /></div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((item, idx) => (
                <div key={idx} className="flex flex-col justify-between p-5 transition-all bg-white border shadow-sm border-slate-100 rounded-2xl h-44 group hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="text-[9px] font-black mb-1 uppercase tracking-tighter" style={{ color: COLORS.brand }}>{item.inv_code}</p>
                      <h3 className="text-xs font-bold leading-tight uppercase text-slate-700 line-clamp-2">{item.item_description}</h3>
                    </div>
                    <button onClick={() => openEditModal(item)} className="p-2 transition-all rounded-lg bg-slate-50 text-slate-400 hover:text-white hover:bg-blue-600">
                      <Edit3 size={14} />
                    </button>
                  </div>
                  
                  <div className="flex items-end justify-between pt-3 mt-3 border-t border-slate-50">
                    <div className="text-left">
                      <p className="text-[7px] font-black text-slate-300 uppercase">Cost (40%)</p>
                      <p className="text-[10px] font-medium text-slate-500">
                        ₱{item.cost_per_uom ? Number(item.cost_per_uom).toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-300 uppercase">Active SRP</p>
                      <div className="flex items-start leading-none" style={{ color: COLORS.brand }}>
                        <span className="text-xs mt-0.5 font-bold">₱</span>
                        <span className="text-2xl font-normal tracking-tighter">{Number(item.srp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EDIT MODAL */}
        {isModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-md">
            <div className="w-full max-w-xs bg-white border border-slate-100 shadow-2xl rounded-[2rem] p-8 text-center animate-in zoom-in duration-150">
              {!showConfirm ? (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: COLORS.brand }}>Adjust Price</p>
                  <h2 className="mb-6 text-sm font-black leading-tight uppercase text-slate-800">{editingItem?.item_description}</h2>
                  <div className="relative mb-4">
                    <span className="absolute text-sm font-bold -translate-y-1/2 left-4 top-1/2 text-slate-400">₱</span>
                    <input autoFocus type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full py-3.5 pl-8 pr-4 bg-slate-50 border-none rounded-xl text-lg font-normal text-slate-700 outline-none" />
                  </div>
                  <button onClick={() => setShowConfirm(true)} style={{ backgroundColor: COLORS.brand }}
                    className="w-full py-4 text-xs font-black tracking-widest text-white uppercase transition-transform shadow-lg rounded-xl active:scale-95">Update Price</button>
                  <button onClick={() => setIsModalOpen(false)} className="mt-4 text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600">Cancel</button>
                </>
              ) : (
                <div className="duration-300 animate-in fade-in">
                  <AlertCircle className="mx-auto mb-4" size={36} style={{ color: COLORS.brand }} />
                  <h3 className="mb-1 text-lg font-black tracking-tighter uppercase text-slate-800">Confirm Update</h3>
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button onClick={() => setShowConfirm(false)} className="py-3.5 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase hover:bg-slate-200">Abort</button>
                    <button onClick={executeUpdate} style={{ backgroundColor: COLORS.brand }}
                      className="py-3.5 text-white font-black rounded-xl text-[10px] uppercase shadow-md transition-opacity hover:opacity-90">Confirm</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingDashboard;