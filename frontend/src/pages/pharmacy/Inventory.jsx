import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/pharmacy_dashboard.css';

const PharmacyInventory = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [lowStock, setLowStock] = useState([]); 
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    stock_quantity: '',
    price_per_unit: '',
    expiry_date: '',
    manufacturer: '',
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await api.get('/api/pharmacy/dashboard');
      setInventory(response.data?.inventory || []);
      setLowStock(response.data?.low_stock || []);
    } catch {
      setInventory([]);
      setLowStock([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/pharmacy/add-medicine', {
        ...newMedicine,
        stock_quantity: Number(newMedicine.stock_quantity),
        price_per_unit: Number(newMedicine.price_per_unit),
      });
      setNewMedicine({
        name: '',
        stock_quantity: '',
        price_per_unit: '',
        expiry_date: '',
        manufacturer: '',
      });
      setShowAddForm(false);
      showToast('Medicine added to inventory!', 'success');
      await fetchInventory();
    } catch (error) {
      showToast(error.response?.data?.message || t('common.error') || 'Failed to add medicine.', 'error');
    }
  };

  const handleUpdateStock = async (e, medicineId) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const quantity = Number(form.get('quantity'));

    try {
      await api.post(`/api/pharmacy/update-stock/${medicineId}`, { quantity });
      showToast('Stock updated successfully!', 'success');
      await fetchInventory();
      e.currentTarget.reset();
    } catch (error) {
      showToast(error.response?.data?.message || t('common.error') || 'Failed to update stock.', 'error');
    }
  };

  const handleRemoveMedicine = async (medicineId) => {
    if (!window.confirm("Are you sure you want to delete this medicine from inventory?")) return;
    try {
      await api.delete(`/api/pharmacy/remove-medicine/${medicineId}`);
      showToast('Medicine removed successfully!', 'success');
      await fetchInventory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to remove medicine.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="premium-spinner" />
        <div className="loading-text">Loading Inventory...</div>
      </div>
    );
  }

  return (
    <div className="pharmacy-dashboard">
      
      {/* Premium Header */}
      <header className="dashboard-header-premium">
        <div>
          <p className="subtitle" style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', opacity: 0.8 }}>Pharmacy Operations</p>
          <h1>{t('nav.inventory', 'Inventory Management')}</h1>
          <p className="subtitle" style={{ marginTop: '12px', fontSize: '1.1rem', maxWidth: '600px', lineHeight: '1.5' }}>
            {t('Manage your medicine stock efficiently, update quantities, and track critical low-stock items.')}
          </p>
        </div>
        <div className="header-actions">
          <div className="pharmacist-badge" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <i className="fa fa-boxes"></i>
            {inventory.length} Items Indexed
          </div>
        </div>
      </header>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div className="alert-banner">
          <i className="fa fa-exclamation-triangle" style={{ fontSize: '1.5rem', color: '#991b1b', marginTop: '4px' }}></i>
          <div>
            <h3>Critical: Low Stock Detected</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#7f1d1d' }}>The following items have less than 10 units remaining. Restock immediately.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {lowStock.map((med) => (
                <span key={med.medicine_id} className="alert-pill">
                  {med.name}
                  <span style={{ background: '#fecaca', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{med.stock_quantity} left</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Section */}
      <section className="glass-section">
        <div className="section-header-premium">
          <h2>
            <i className="fa fa-clipboard-list" style={{ marginRight: '12px', color: 'var(--deep-teal)' }}></i>
            {t('pharmacy.inventoryStatus', 'Stock Database')}
          </h2>
          <button 
            className="btn-premium btn-primary" 
            onClick={() => setShowAddForm((prev) => !prev)}
            style={{ padding: '12px 24px', borderRadius: '12px' }}
          >
            <i className={`fa ${showAddForm ? 'fa-times' : 'fa-plus'}`}></i> 
            {showAddForm ? 'Cancel' : t('pharmacy.addMedicine', 'Add New Medicine')}
          </button>
        </div>

        {/* Add Medicine Glass Form */}
        {showAddForm && (
          <div className="premium-form-container">
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: 'var(--dark)' }}>
              <i className="fa fa-pills" style={{ marginRight: '8px', color: 'var(--accent-blue)' }}></i> Medicine Details
            </h3>
            <form onSubmit={handleAddMedicine}>
              <div className="form-row">
                <input
                  type="text"
                  name="name"
                  className="premium-input"
                  placeholder={t('pharmacy.medicineName')}
                  value={newMedicine.name}
                  onChange={(e) => setNewMedicine((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  type="number"
                  name="stock_quantity"
                  className="premium-input"
                  placeholder={t('pharmacy.stockQty')}
                  min="1"
                  value={newMedicine.stock_quantity}
                  onChange={(e) => setNewMedicine((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  name="price_per_unit"
                  className="premium-input"
                  placeholder={t('pharmacy.priceUnit')}
                  value={newMedicine.price_per_unit}
                  onChange={(e) => setNewMedicine((prev) => ({ ...prev, price_per_unit: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row">
                <input
                  type="date"
                  name="expiry_date"
                  className="premium-input"
                  value={newMedicine.expiry_date}
                  onChange={(e) => setNewMedicine((prev) => ({ ...prev, expiry_date: e.target.value }))}
                />
                <input
                  type="text"
                  name="manufacturer"
                  className="premium-input"
                  placeholder="Manufacturer"
                  value={newMedicine.manufacturer}
                  onChange={(e) => setNewMedicine((prev) => ({ ...prev, manufacturer: e.target.value }))}
                />
                <button type="submit" className="btn-premium btn-success" style={{ padding: '14px 32px' }}>
                  <i className="fa fa-save"></i> Save Medicine
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Glass Table */}
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>ID</th>
                <th style={{ width: '25%' }}>{t('pharmacy.medicineName')}</th>
                <th style={{ width: '12%' }}>Units</th>
                <th style={{ width: '15%' }}>Price/Unit</th>
                <th style={{ width: '15%' }}>{t('pharmacy.expiryDate')}</th>
                <th style={{ width: '15%' }}>Add Stock</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length > 0 ? (
                inventory.map((med) => (
                  <tr key={med.medicine_id} className={med.stock_quantity < 10 ? 'low-stock' : ''}>
                    <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>#{med.medicine_id}</td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--dark)' }}>{med.name}</span>
                    </td>
                    <td>
                      <span
                        className={`modern-badge ${
                          med.stock_quantity < 10 ? 'badge-danger' : med.stock_quantity < 25 ? 'badge-warning' : 'badge-success'
                        }`}
                      >
                        {med.stock_quantity}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontWeight: '500' }}>
                      ${med.price_per_unit ? Number(med.price_per_unit).toFixed(2) : '-'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{med.expiry_date || '-'}</td>
                    <td>
                      <form onSubmit={(e) => handleUpdateStock(e, med.medicine_id)} className="inline-update-form">
                        <input type="number" name="quantity" placeholder="+Qty" min="1" required />
                        <button type="submit" className="inline-update-btn">
                          <i className="fa fa-plus"></i>
                        </button>
                      </form>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => handleRemoveMedicine(med.medicine_id)} 
                        className="btn-premium btn-outline"
                        style={{ padding: '6px 12px', fontSize: '0.85rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                      >
                        <i className="fa fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                      <i className="fa fa-box-open" style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block', opacity: 0.5 }}></i>
                      No medicines in inventory.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PharmacyInventory;
