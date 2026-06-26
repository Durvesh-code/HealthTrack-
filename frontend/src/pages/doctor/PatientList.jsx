import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import api from '../../config/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/* ── Blood group colour map ─────────────────────────── */
const BG_COLORS = {
  'A+': 'bg-red-100 text-red-700',
  'A-': 'bg-red-200 text-red-800',
  'B+': 'bg-orange-100 text-orange-700',
  'B-': 'bg-orange-200 text-orange-800',
  'AB+': 'bg-purple-100 text-purple-700',
  'AB-': 'bg-purple-200 text-purple-800',
  'O+': 'bg-blue-100 text-blue-700',
  'O-': 'bg-blue-200 text-blue-800',
};

/* ── Gender accent ───────────────────────────────────── */
const genderAccent = (g = '') => {
  const s = g.toLowerCase();
  if (s === 'female') return 'from-pink-400 to-rose-500';
  if (s === 'male')   return 'from-blue-400 to-cyan-500';
  return 'from-teal-400 to-emerald-500';
};

/* ── Initials fallback ──────────────────────────────── */
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ── Format date ────────────────────────────────────── */
const fmtDate = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d) ? dt : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* ── Patient Card ───────────────────────────────────── */
const PatientCard = ({ patient }) => {
  const avatarUrl = patient.profile_img
    ? `${BACKEND_URL}/static/uploads/${patient.profile_img}`
    : null;
  const accentClass = genderAccent(patient.gender);

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">

      {/* Top gradient strip */}
      <div className={`h-2 bg-gradient-to-r ${accentClass}`} />

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1 gap-4">

        {/* Avatar + Name row */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={patient.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-border-light shadow-sm"
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            {/* Fallback initials div (always present, hidden when img loads) */}
            <div
              className={`w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl bg-gradient-to-br ${accentClass} shadow-sm ${avatarUrl ? 'hidden' : 'flex'}`}
            >
              {initials(patient.name)}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-text-primary text-base leading-tight truncate">{patient.name}</h3>
            <p className="text-warm-gray text-sm mt-0.5">
              {patient.gender || '—'}{patient.age ? <> &bull; <strong>{patient.age}</strong> yrs</> : null}
            </p>
            {patient.blood_group && (
              <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${BG_COLORS[patient.blood_group] || 'bg-gray-100 text-gray-700'}`}>
                🩸 {patient.blood_group}
              </span>
            )}
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-2 text-sm">
          {patient.email && (
            <div className="flex items-center gap-2 text-warm-gray">
              <span className="text-base">✉️</span>
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          {patient.contact && (
            <div className="flex items-center gap-2 text-warm-gray">
              <span className="text-base">📞</span>
              <span>{patient.contact}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-warm-gray">
            <span className="text-base">📅</span>
            <span>Last visit: <strong className="text-text-primary">{fmtDate(patient.last_appointment)}</strong></span>
          </div>
          {(patient.condition || patient.chronic_diseases) && (
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">🏷️</span>
              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                {patient.condition || patient.chronic_diseases}
              </span>
            </div>
          )}
        </div>

        {/* View Details button */}
        <div className="mt-auto pt-3 border-t border-border-light">
          <Link
            to={`/doctor/patient/${patient.patient_id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
            style={{ background: 'linear-gradient(90deg,#0f6b6b,#2b9af3)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            👁 View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ── Main page ───────────────────────────────────────── */
const PatientList = () => {
  const { t } = useTranslation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    api.get('/api/doctor/patients')
      .then(r => setPatients(r.data.patients || r.data || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = patients;
    if (genderFilter !== 'all') {
      list = list.filter(p => (p.gender || '').toLowerCase() === genderFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.condition || p.chronic_diseases || '').toLowerCase().includes(q) ||
        (p.blood_group || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [patients, searchTerm, genderFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray text-sm">Loading patients…</p>
      </div>
    );
  }

  const males   = patients.filter(p => (p.gender || '').toLowerCase() === 'male').length;
  const females = patients.filter(p => (p.gender || '').toLowerCase() === 'female').length;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fadeInUp">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            👥 {t('doctor.myPatients')}
          </h1>
          <p className="text-warm-gray text-sm mt-1">
            Showing <strong className="text-text-primary">{filtered.length}</strong> of{' '}
            <strong className="text-text-primary">{patients.length}</strong> patients
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-soft-slate border border-border-light rounded-full text-sm font-semibold text-text-primary">
            🧑‍ {males} Male
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-soft-slate border border-border-light rounded-full text-sm font-semibold text-text-primary">
            👩 {females} Female
          </span>
        </div>
      </div>

      {/* ── Search + Filter bar ──────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray text-lg">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, condition…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-light focus:border-deep-teal focus:ring-2 focus:ring-deep-teal/20 outline-none transition-all text-sm text-text-primary bg-white"
          />
        </div>

        {/* Gender filter */}
        <div className="flex gap-2">
          {['all', 'male', 'female'].map(g => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all capitalize
                ${genderFilter === g
                  ? 'bg-deep-teal text-white border-deep-teal shadow-sm'
                  : 'bg-white text-warm-gray border-border-light hover:border-deep-teal hover:text-deep-teal'
                }`}
            >
              {g === 'all' ? '👥 All' : g === 'male' ? '🧑 Male' : '👩 Female'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Patient Grid ─────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(patient => (
            <PatientCard key={patient.patient_id} patient={patient} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No patients found</h3>
          <p className="text-warm-gray text-sm">
            {searchTerm ? `No results for "${searchTerm}"` : 'No patients are linked to your account yet.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 px-4 py-2 text-sm text-deep-teal border border-deep-teal rounded-lg hover:bg-deep-teal hover:text-white transition"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientList;