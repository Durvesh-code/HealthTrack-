import { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';
import '../../styles/pharmacy_dashboard.css';

/**
 * Pharmacy Collaboration Page
 * - Shows all collaboration requests sent to doctors (any status)
 * - "Request Collaboration" opens doctor list — store is linked at registration
 * - "Cancel" button hard-deletes a collaboration
 */
const PharmacyCollaboration = () => {
  const [collabs, setCollabs]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [doctors, setDoctors]           = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [requesting, setRequesting]     = useState(null);
  const [breaking, setBreaking]         = useState(null);
  const [msg, setMsg]                   = useState(null);

  // ─── Fetch existing collaborations ────────────────────────────────────────
  const fetchCollabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/pharmacy/collaborations');
      setCollabs(res.data.collaborations || []);
    } catch {
      setCollabs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDoctors = async () => {
    try {
      const res = await api.get('/api/doctor/list');
      setDoctors(res.data.doctors || []);
    } catch {
      setDoctors([]);
    }
  };

  useEffect(() => { fetchCollabs(); }, [fetchCollabs]);

  // ─── Open doctor selection modal ──────────────────────────────────────────
  const openModal = () => {
    setShowModal(true);
    setDoctorSearch('');
    loadDoctors();
  };

  // ─── Send collaboration request ───────────────────────────────────────────
  const sendRequest = async (doctor_id) => {
    setRequesting(doctor_id);
    try {
      await api.post('/api/pharmacy/collaboration/request', { doctor_id });
      setMsg({ type: 'success', text: '✅ Request sent successfully!' });
      setShowModal(false);
      fetchCollabs();
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.response?.data?.message || 'Failed to send request'}` });
    } finally {
      setRequesting(null);
    }
  };

  // ─── Break / cancel collaboration ─────────────────────────────────────────
  const breakCollaboration = async (collab_id) => {
    if (!window.confirm('Are you sure you want to cancel this collaboration?')) return;
    setBreaking(collab_id);
    try {
      const res = await api.delete(`/api/pharmacy/collaboration/${collab_id}`);
      setMsg({ type: 'success', text: `✅ ${res.data.message}` });
      fetchCollabs();
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.response?.data?.message || 'Failed to cancel collaboration'}` });
    } finally {
      setBreaking(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const filteredDoctors = doctorSearch.trim()
    ? doctors.filter(d =>
        d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
        (d.specialization || '').toLowerCase().includes(doctorSearch.toLowerCase())
      )
    : doctors;

  const statusColor = {
    Pending:  { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
    Accepted: { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
    Rejected: { bg: 'rgba(239,68,68,0.08)',  color: '#dc2626' },
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="pharmacy-dashboard">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="dashboard-header-premium" style={{ marginBottom: 32, padding: '32px 40px', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: 1, marginBottom: 16, backdropFilter: 'blur(5px)' }}>
            🤝 COLLABORATION MODULE
          </div>
          <h1 style={{ fontSize: '2.2rem', margin: '0 0 10px 0' }}>Doctor Collaborations</h1>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '1.05rem' }}>
            Request and manage collaborations with doctors. Accepted doctors can reference your store inventory when prescribing.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, marginTop: 20 }}>
          <button
            id="btn-request-collaboration"
            onClick={openModal}
            style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.95)', color: 'var(--deep-teal)', borderRadius: 14, fontWeight: 800, fontSize: '0.95rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}
          >
            + Request Collaboration
          </button>
        </div>
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', borderRadius: '50%', zIndex: 1, pointerEvents: 'none' }} />
      </header>

      {/* ── Flash Message ───────────────────────────────────────────────── */}
      {msg && (
        <div style={{ marginBottom: 20, padding: '14px 20px', borderRadius: 12, background: msg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'success' ? '#a7f3d0' : '#fca5a5'}`, color: msg.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.6 }}>&times;</button>
        </div>
      )}

      {/* ── Collaboration Table ─────────────────────────────────────────── */}
      <section className="glass-section" style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.03)' }}>
        <div className="section-header-premium" style={{ paddingTop: 24, paddingLeft: 32, paddingRight: 32 }}>
          <h2 style={{ fontSize: '1.3rem' }}>
            Sent Requests
            <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ({collabs.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div className="premium-spinner" />
          </div>
        ) : collabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🤝</div>
            <h3 style={{ color: 'var(--dark)' }}>No collaborations yet</h3>
            <p>Click &quot;Request Collaboration&quot; to invite a doctor to partner with your store.</p>
          </div>
        ) : (
          <div className="glass-table-wrap" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
            <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                <tr>
                  <th style={{ padding: '16px 32px', width: '30%' }}>Doctor</th>
                  <th style={{ padding: '16px' }}>Specialization</th>
                  <th style={{ padding: '16px' }}>Requested</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {collabs.map((c) => {
                  const sc = statusColor[c.status] || statusColor.Pending;
                  return (
                    <tr key={c.collab_id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '20px 32px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--dark)' }}>Dr. {c.doctor_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.doctor_email}</div>
                      </td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-muted)' }}>{c.specialization || '—'}</td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {c.requested_at ? new Date(c.requested_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'center' }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'center' }}>
                        <button
                          id={`btn-cancel-collab-${c.collab_id}`}
                          onClick={() => breakCollaboration(c.collab_id)}
                          disabled={breaking === c.collab_id}
                          style={{
                            padding: '6px 16px',
                            background: 'rgba(239,68,68,0.08)',
                            color: '#dc2626',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 10,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: breaking === c.collab_id ? 'not-allowed' : 'pointer',
                            opacity: breaking === c.collab_id ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={e => { if (breaking !== c.collab_id) e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                        >
                          {breaking === c.collab_id ? '...' : 'Cancel'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Doctor Selection Modal ──────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--dark)' }}>Select a Doctor</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Send a collaboration request to the selected doctor</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>&times;</button>
            </div>

            {/* Search */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <input
                id="doctor-search-input"
                type="text"
                placeholder="Search by name or specialization..."
                value={doctorSearch}
                onChange={e => setDoctorSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Doctor List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 20px' }}>
              {filteredDoctors.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>No doctors found</p>
              ) : (
                filteredDoctors.map(d => (
                  <div key={d.doctor_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--deep-teal)', fontSize: 16, flexShrink: 0 }}>
                        {(d.name || 'D').charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--dark)' }}>Dr. {d.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.specialization || 'General'}</div>
                        {d.clinic_name && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.clinic_name}</div>}
                      </div>
                    </div>
                    <button
                      id={`request-doctor-${d.doctor_id}`}
                      onClick={() => sendRequest(d.doctor_id)}
                      disabled={requesting === d.doctor_id}
                      style={{ padding: '8px 18px', background: 'var(--deep-teal)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: requesting === d.doctor_id ? 0.6 : 1, transition: 'all 0.2s', flexShrink: 0 }}
                    >
                      {requesting === d.doctor_id ? '...' : 'Request'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyCollaboration;
