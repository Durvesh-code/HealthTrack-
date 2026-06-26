import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import '../../styles/pharmacy_dashboard.css';

const PharmacyDashboard = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState([]);
  const [graphData, setGraphData] = useState({ medicine_sales: [], sales_by_date: [] });
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const pendingResponse = await api.get('/api/pharmacy/dashboard');
      if (pendingResponse.data?.success) {
        setPending(pendingResponse.data.pending || []);
      }

      const response = await api.get('/api/pharmacy/history');
      if (response.data?.success) {
        setHistory(response.data.history || []);
        setGraphData(response.data.graph_data || { medicine_sales: [], sales_by_date: [] });
      }
    } catch {
      setHistory([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const filteredAndSortedHistory = useMemo(() => {
    let result = [...history];
    if (searchTerm) {
      result = result.filter(item => 
        (item.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.doctor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    result.sort((a, b) => {
      const dateA = new Date(a.date_issued);
      const dateB = new Date(b.date_issued);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [history, searchTerm, sortOrder]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="premium-spinner" />
        <div className="loading-text">Loading Analytics...</div>
      </div>
    );
  }

  // Calculate total dispensed from the graphData
  const totalDispensed = graphData.medicine_sales.reduce((acc, curr) => acc + curr.amount_sold, 0);

  return (
    <div className="pharmacy-dashboard">
      
      {/* Premium Header */}
      <header className="dashboard-header-premium" style={{ padding: '24px 32px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{t('pharmacy.dashboardTitle', 'Pharmacy Dashboard')}</h1>
        </div>
        <div className="header-actions">
          <div className="pharmacist-badge">
            <i className="fa fa-user-circle"></i>
            {user?.pharmacist_name || user?.name || t('common.pharmacist')}
          </div>
          <button onClick={handleLogout} className="btn-premium btn-cancel">
            <i className="fa fa-sign-out"></i> {t('nav.logout')}
          </button>
        </div>
      </header>

      {/* Analytics Section with Glass Cards */}
      <div className="stats-grid">
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--deep-teal)' }}></div>
            Inventory Distribution
          </h3>
          <div style={{ height: 280, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={graphData.medicine_sales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="medicine_name" axisLine={false} tickLine={false} tick={{fill: '#a0aec0', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#a0aec0', fontSize: 12}} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 'bold' }} 
                  itemStyle={{ color: 'var(--deep-teal)' }}
                />
                <Bar dataKey="amount_sold" radius={[4, 4, 0, 0]} name="Units" barSize={32}>
                  {
                    graphData.medicine_sales.map((entry, index) => (
                      <cell key={`cell-${index}`} fill={'url(#colorBar)'} />
                    ))
                  }
                </Bar>
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4fd1c5" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#319795" stopOpacity={1}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }}></div>
            Orders Over Time
          </h3>
          <div style={{ height: 280, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={graphData.sales_by_date} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="sale_date" axisLine={false} tickLine={false} tick={{fill: '#a0aec0', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#a0aec0', fontSize: 12}} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 'bold' }} 
                  itemStyle={{ color: 'var(--accent-blue)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="prescriptions_dispensed" 
                  stroke="var(--accent-blue)" 
                  strokeWidth={3} 
                  dot={{r: 4, strokeWidth: 2, fill: '#fff', stroke: 'var(--accent-blue)'}} 
                  activeDot={{r: 6, fill: 'var(--accent-blue)', stroke: '#fff', strokeWidth: 0}}
                  name="Orders" 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary KPI row embedded between charts and pending prescriptions */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '32px' }}>
        <div className="glass-card stat-premium" style={{ marginBottom: 0 }}>
          <div className="stat-icon-wrapper stat-icon-primary">
            <i className="fa fa-shopping-bag"></i>
          </div>
          <div className="stat-content">
            <p>Total Units Sold</p>
            <h4>{totalDispensed}</h4>
          </div>
        </div>
        <div className="glass-card stat-premium" style={{ marginBottom: 0 }}>
          <div className="stat-icon-wrapper stat-icon-success">
            <i className="fa fa-users"></i>
          </div>
          <div className="stat-content">
            <p>Patients Served</p>
            <h4>{history.length}</h4>
          </div>
        </div>
        <div className="glass-card stat-premium" style={{ marginBottom: 0, position: 'relative', overflow: 'hidden' }}>
          <div className="stat-icon-wrapper stat-icon-warning">
            <i className="fa fa-bell"></i>
          </div>
          <div className="stat-content">
            <p>Pending Orders</p>
            <h4>{pending.length}</h4>
            <button 
              onClick={() => navigate('/pharmacy/dispense')}
              style={{ padding: '6px 14px', marginTop: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              Go to Dispense <i className="fa fa-arrow-right"></i>
            </button>
          </div>
        </div>
        <div className="glass-card stat-premium" style={{ marginBottom: 0 }}>
          <div className="stat-icon-wrapper stat-icon-danger">
            <i className="fa fa-calendar-check"></i>
          </div>
          <div className="stat-content">
            <p>Recent Dispenses</p>
            <h4>{graphData.sales_by_date.length > 0 ? graphData.sales_by_date[graphData.sales_by_date.length - 1].prescriptions_dispensed : 0}</h4>
          </div>
        </div>
      </div>

    {/* Pending Prescriptions Section (Dispense Queue) */}


      {/* History Table Section */}
      <section className="glass-section" style={{ marginTop: '32px' }}>
        <div className="section-header-premium">
          <h2>
            <i className="fa fa-history" style={{ marginRight: '12px', color: 'var(--text-muted)' }}></i>
            Dispensation Log
          </h2>
          <div style={{ position: 'relative', width: '300px' }}>
            <i className="fa fa-search" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
            <input 
              className="premium-input"
              type="text" 
              placeholder="Search patient or doctor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '44px' }}
            />
          </div>
        </div>

        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Order ID</th>
                <th style={{ width: '25%' }}>{t('common.patient')}</th>
                <th style={{ width: '25%' }}>{t('common.doctor')}</th>
                <th style={{ width: '20%', cursor: 'pointer', transition: 'color 0.2s ease' }} 
                    onClick={toggleSort}
                    onMouseEnter={(e) => e.target.style.color = 'var(--deep-teal)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>
                  {t('common.date')} 
                  <i className={`fa fa-sort-${sortOrder === 'desc' ? 'down' : 'up'}`} style={{ marginLeft: '8px' }}></i>
                </th>
                <th style={{ width: '20%', textAlign: 'right' }}>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedHistory.length > 0 ? (
                filteredAndSortedHistory.map((pres) => (
                  <tr key={pres.prescription_id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>#{pres.prescription_id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '12px' }}>
                          {(pres.patient_name || 'U').charAt(0)}
                        </div>
                        <span style={{ fontWeight: '600' }}>{pres.patient_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td><span style={{ color: 'var(--text-muted)' }}>Dr.</span> {pres.doctor_name || 'Unknown'}</td>
                    <td>{new Date(pres.date_issued).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="modern-badge badge-success">
                        <i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>
                        {pres.dispense_status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                      <i className="fa fa-folder-open-o" style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block', opacity: 0.5 }}></i>
                      No dispensation records found
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

export default PharmacyDashboard;