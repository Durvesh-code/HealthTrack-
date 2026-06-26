import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/pharmacy_dashboard.css';

/* ─────────────────────────────────────────────────────────── */
/* Inline Medicine panel shown below a row when expanded        */
/* ─────────────────────────────────────────────────────────── */
const MedicinePanel = ({ prescriptionId, onDispense, status }) => {
  const [medicines, setMedicines] = useState(null); // null = loading
  const [dispensing, setDispensing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/pharmacy/prescription/${prescriptionId}/medicines`)
      .then(r => { if (!cancelled) setMedicines(r.data.medicines || []); })
      .catch(() => { if (!cancelled) setMedicines([]); });
    return () => { cancelled = true; };
  }, [prescriptionId]);

  if (medicines === null) {
    return (
      <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <div className="premium-spinner" style={{ width: 20, height: 20 }} />
        Loading medicines…
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div style={{ padding: '20px 32px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        No medicine details recorded for this prescription.
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(15,107,107,0.03)', borderTop: '1px solid rgba(15,107,107,0.08)', padding: '16px 32px 20px' }}>
      {/* Medicine Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: 'rgba(15,107,107,0.06)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--deep-teal)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Medicine</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--deep-teal)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Dosage</th>
            <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--deep-teal)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Qty</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--deep-teal)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Notes</th>
            <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--deep-teal)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map((m, i) => (
            <tr key={m.detail_id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--dark)', fontSize: '0.9rem' }}>{m.medicine_name}</td>
              <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>{m.dosage || '—'}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--deep-teal)' }}>{m.quantity || 1}</td>
              <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{m.notes || '—'}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                  background: m.item_source === 'StoreSuggestion' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                  color: m.item_source === 'StoreSuggestion' ? '#059669' : '#4f46e5',
                }}>
                  {m.item_source === 'StoreSuggestion' ? 'Inventory' : 'Manual'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dispense button inside panel */}
      {status !== 'Expired' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            id={`btn-dispense-confirm-${prescriptionId}`}
            onClick={async () => {
              setDispensing(true);
              await onDispense(prescriptionId);
              setDispensing(false);
            }}
            disabled={dispensing}
            style={{
              padding: '10px 28px',
              background: dispensing ? 'rgba(15,107,107,0.4)' : 'var(--deep-teal)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontWeight: 800, fontSize: '0.92rem', cursor: dispensing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(15,107,107,0.25)', transition: 'all 0.2s',
            }}
          >
            {dispensing ? (
              <><div className="premium-spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Dispensing…</>
            ) : (
              '💊 Dispense & Deduct Stock'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────── */
/* Main Dispense Page                                          */
/* ─────────────────────────────────────────────────────────── */
const PharmacyDispense = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(null); // prescription_id of open panel

  useEffect(() => { fetchPendingPrescriptions(); }, []);

  const fetchPendingPrescriptions = async () => {
    try {
      const response = await api.get('/api/pharmacy/dashboard');
      setPending(response.data?.pending || []);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (prescriptionId) => {
    try {
      await api.post(`/api/pharmacy/dispense/${prescriptionId}`);
      showToast('✅ Dispensed! Stock has been updated.', 'success');
      setExpanded(null);
      await fetchPendingPrescriptions();
    } catch (err) {
      showToast(err.response?.data?.message || t('common.error') || 'Failed to dispense.', 'error');
    }
  };

  const toggleExpand = (id) => setExpanded(prev => (prev === id ? null : id));

  const filteredPending = useMemo(() => {
    if (!searchTerm) return pending;
    const lower = searchTerm.toLowerCase();
    return pending.filter(p =>
      (p.patient_name || '').toLowerCase().includes(lower) ||
      (p.doctor_name || '').toLowerCase().includes(lower) ||
      p.prescription_id.toString().includes(lower)
    );
  }, [pending, searchTerm]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="premium-spinner" />
        <div className="loading-text">Preparing Orders...</div>
      </div>
    );
  }

  return (
    <div className="pharmacy-dashboard">

      {/* Header */}
      <header className="dashboard-header-premium" style={{ marginBottom: '32px', padding: '32px 40px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '16px', backdropFilter: 'blur(5px)' }}>
            💊 DISPENSE MODULE
          </div>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 12px 0', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {t('nav.dispense', 'Prescription Queue')}
          </h1>
          <p style={{ margin: 0, fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', lineHeight: '1.6' }}>
            Review pending orders, verify medicine details, then dispense — stock updates automatically.
          </p>
        </div>
        <div className="header-actions" style={{ position: 'relative', zIndex: 2 }}>
          <div className="glass-card" style={{ background: 'rgba(255,255,255,0.95)', padding: '16px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending</span>
            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: pending.length > 0 ? 'var(--warning)' : 'var(--success)' }}>{pending.length}</span>
          </div>
        </div>
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', borderRadius: '50%', zIndex: 1, pointerEvents: 'none' }} />
      </header>

      {/* Queue Table */}
      <section className="glass-section" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.03)' }}>
        <div className="section-header-premium" style={{ paddingTop: '24px', paddingLeft: '32px', paddingRight: '32px' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Active Orders</h2>
          <div style={{ position: 'relative', width: '350px' }}>
            <input
              className="premium-input"
              type="text"
              placeholder="Search patient, doctor, or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '16px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px' }}
            />
          </div>
        </div>

        <div className="glass-table-wrap" style={{ margin: '0', borderRadius: '0', border: 'none' }}>
          <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
              <tr>
                <th style={{ width: '10%', padding: '16px 32px' }}>Order ID</th>
                <th style={{ width: '22%', padding: '16px' }}>{t('common.patient')}</th>
                <th style={{ width: '18%', padding: '16px' }}>{t('common.doctor')}</th>
                <th style={{ width: '14%', padding: '16px' }}>{t('common.date')}</th>
                <th style={{ width: '14%', padding: '16px' }}>{t('common.status')}</th>
                <th style={{ width: '22%', padding: '16px 32px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPending.length > 0 ? (
                filteredPending.flatMap((pres) => {
                  const isOpen = expanded === pres.prescription_id;
                  const isExpired = pres.dispense_status === 'Expired';
                  let statusColor = '#d97706', statusBg = 'rgba(245,158,11,0.1)';
                  if (isExpired) { statusColor = '#dc2626'; statusBg = 'rgba(220,38,38,0.08)'; }

                  let expiryNote = null;
                  if (pres.reserved_until) {
                    const rem = new Date(pres.reserved_until) - new Date();
                    expiryNote = rem > 0 ? `⏱ ${Math.floor(rem / 60000)}m left` : (!isExpired ? '⏰ Overdue' : null);
                  }

                  return [
                    // Main row
                    <tr key={pres.prescription_id}
                      style={{ borderBottom: isOpen ? 'none' : '1px solid rgba(0,0,0,0.03)', background: isOpen ? 'rgba(15,107,107,0.02)' : 'transparent', transition: 'all 0.2s' }}
                    >
                      <td style={{ padding: '20px 32px', fontWeight: 'bold', color: 'var(--deep-teal)' }}>
                        #{pres.prescription_id}
                      </td>
                      <td style={{ padding: '20px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#475569', flexShrink: 0 }}>
                            {(pres.patient_name || 'U').charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--dark)' }}>{pres.patient_name || 'Unknown'}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pres.patient_contact || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: 500, color: 'var(--dark)' }}>
                        Dr. {pres.doctor_name || 'Unknown'}
                      </td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {pres.date_issued ? new Date(pres.date_issued).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '20px 16px' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                          {pres.dispense_status || 'Sent'}
                        </span>
                        {expiryNote && (
                          <div style={{ fontSize: '0.72rem', color: isExpired ? '#dc2626' : '#92400e', marginTop: 4, fontWeight: 600 }}>{expiryNote}</div>
                        )}
                      </td>
                      <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* See Medicines toggle */}
                          <button
                            id={`btn-see-medicines-${pres.prescription_id}`}
                            onClick={() => toggleExpand(pres.prescription_id)}
                            style={{
                              padding: '8px 16px',
                              background: isOpen ? 'rgba(15,107,107,0.1)' : 'rgba(0,0,0,0.04)',
                              color: isOpen ? 'var(--deep-teal)' : 'var(--text-muted)',
                              border: `1px solid ${isOpen ? 'rgba(15,107,107,0.2)' : 'rgba(0,0,0,0.08)'}`,
                              borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                            }}
                          >
                            {isOpen ? '▲ Hide' : '💊 See Medicines'}
                          </button>

                          {/* Quick dispense for expired label */}
                          {isExpired && (
                            <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>⛔ Expired</span>
                          )}
                        </div>
                      </td>
                    </tr>,

                    // Expandable medicine panel row
                    isOpen && (
                      <tr key={`panel-${pres.prescription_id}`}
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: 'rgba(15,107,107,0.015)' }}
                      >
                        <td colSpan={6} style={{ padding: 0 }}>
                          <MedicinePanel
                            prescriptionId={pres.prescription_id}
                            status={pres.dispense_status}
                            onDispense={handleDispense}
                          />
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'inset 0 0 0 2px rgba(16,185,129,0.2)' }}>
                        <span style={{ fontSize: '3rem' }}>✅</span>
                      </div>
                      <h3 style={{ fontSize: '1.5rem', color: 'var(--dark)', marginBottom: 8 }}>Queue Empty</h3>
                      <p style={{ fontSize: '1rem', maxWidth: '300px', margin: '0 auto', lineHeight: 1.5 }}>
                        No {searchTerm ? 'matching ' : ''}prescriptions waiting to be dispensed.
                      </p>
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--accent-blue)', fontWeight: 'bold', cursor: 'pointer' }}>
                          Clear Search
                        </button>
                      )}
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

export default PharmacyDispense;
