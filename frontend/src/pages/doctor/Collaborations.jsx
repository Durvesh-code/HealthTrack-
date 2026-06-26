import { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';

/**
 * Doctor Collaborations Page
 * - Shows pending requests prominently (Accept / Reject)
 * - Shows Accepted and Rejected history below
 */

const statusStyle = {
  Pending:  { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', badgeBg: 'rgba(245,158,11,0.1)' },
  Accepted: { bg: '#f0fdf4', border: '#bbf7d0', badge: '#059669', badgeBg: 'rgba(16,185,129,0.1)' },
  Rejected: { bg: '#fff5f5', border: '#fecaca', badge: '#dc2626', badgeBg: 'rgba(239,68,68,0.08)' },
};

const DoctorCollaborations = () => {
  const [collabs, setCollabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchCollabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctor/collaborations');
      setCollabs(res.data.collaborations || []);
    } catch {
      setCollabs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCollabs(); }, [fetchCollabs]);

  const respond = async (collab_id, status) => {
    setResponding(`${collab_id}-${status}`);
    try {
      await api.post(`/api/doctor/collaboration/${collab_id}/respond`, { status });
      setMsg({ type: status === 'Accepted' ? 'success' : 'error', text: status === 'Accepted' ? '✅ Collaboration accepted!' : '❌ Request rejected.' });
      fetchCollabs();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to respond' });
    } finally {
      setResponding(null);
    }
  };

  const pending  = collabs.filter(c => c.status === 'Pending');
  const accepted = collabs.filter(c => c.status === 'Accepted');
  const rejected = collabs.filter(c => c.status === 'Rejected');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray">Loading collaboration requests...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fadeInUp">

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black text-text-primary mb-2">🤝 Pharmacy Collaborations</h1>
        <p className="text-warm-gray">Pharmacy stores can request collaboration with you. Accepted stores will be available in your prescription form for medicine suggestions.</p>
      </div>

      {/* Flash */}
      {msg && (
        <div className={`mb-5 px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-between ${msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100 text-xl">&times;</button>
        </div>
      )}

      {/* Pending Section */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          ⏳ Pending Requests
          {pending.length > 0 && (
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">{pending.length}</span>
          )}
        </h2>

        {pending.length === 0 ? (
          <div className="p-8 text-center bg-soft-slate rounded-2xl border border-border-light">
            <p className="text-warm-gray italic">No pending requests right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(c => (
              <div key={c.collab_id} style={{ background: statusStyle.Pending.bg, border: `1px solid ${statusStyle.Pending.border}` }} className="rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-700 font-black text-lg flex-shrink-0">
                    🏥
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-lg">{c.store_name}</p>
                    {c.store_address && <p className="text-warm-gray text-sm">{c.store_address}</p>}
                    {c.store_contact && <p className="text-warm-gray text-xs">{c.store_contact}</p>}
                    <span className="mt-1 inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">{c.store_type}</span>
                    <p className="text-xs text-warm-gray mt-1">Requested: {new Date(c.requested_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button
                    id={`accept-${c.collab_id}`}
                    onClick={() => respond(c.collab_id, 'Accepted')}
                    disabled={!!responding}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {responding === `${c.collab_id}-Accepted` ? '...' : '✓ Accept'}
                  </button>
                  <button
                    id={`reject-${c.collab_id}`}
                    onClick={() => respond(c.collab_id, 'Rejected')}
                    disabled={!!responding}
                    className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition disabled:opacity-60"
                  >
                    {responding === `${c.collab_id}-Rejected` ? '...' : '✕ Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Accepted Section */}
      {accepted.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            ✅ Active Collaborations
            <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{accepted.length}</span>
          </h2>
          <div className="space-y-3">
            {accepted.map(c => (
              <div key={c.collab_id} style={{ background: statusStyle.Accepted.bg, border: `1px solid ${statusStyle.Accepted.border}` }} className="rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-text-primary">{c.store_name}</p>
                  {c.store_address && <p className="text-warm-gray text-xs">{c.store_address}</p>}
                </div>
                <span style={{ background: statusStyle.Accepted.badgeBg, color: statusStyle.Accepted.badge }} className="px-3 py-1 rounded-full text-xs font-bold">Accepted</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rejected Section */}
      {rejected.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            ❌ Rejected Requests
            <span className="px-2.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{rejected.length}</span>
          </h2>
          <div className="space-y-3">
            {rejected.map(c => (
              <div key={c.collab_id} style={{ background: statusStyle.Rejected.bg, border: `1px solid ${statusStyle.Rejected.border}` }} className="rounded-xl p-4 flex items-center justify-between opacity-70">
                <div>
                  <p className="font-bold text-text-primary">{c.store_name}</p>
                  {c.responded_at && <p className="text-warm-gray text-xs">Rejected on {new Date(c.responded_at).toLocaleDateString('en-IN')}</p>}
                </div>
                <span style={{ background: statusStyle.Rejected.badgeBg, color: statusStyle.Rejected.badge }} className="px-3 py-1 rounded-full text-xs font-bold">Rejected</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State for All Statuses */}
      {collabs.length === 0 && (
        <div className="text-center py-20">
          <div className="text-7xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">No collaboration requests</h2>
          <p className="text-warm-gray">When pharmacy stores send you collaboration requests, they will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default DoctorCollaborations;
