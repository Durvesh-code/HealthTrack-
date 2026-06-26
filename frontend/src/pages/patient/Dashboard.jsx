import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/dashboard.css';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', emoji: '🌅' };
  if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' };
  return { text: 'Good Evening', emoji: '🌙' };
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const EMPTY_PROFILE = {
  patient_id: '',
  name: '',
  email: '',
  contact: '',
  gender: '',
  age: '',
  blood_group: '',
  allergy: '',
  emergency_contact: '',
  height_cm: '',
  weight_kg: '',
  address: '',
  medical_history: '',
  medications: '',
  profile_img: '',
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_PROFILE);
  const [cancelConfirm, setCancelConfirm] = useState(null); // id to confirm
  
  // Rating & Review State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ appointment_id: null, rating: 5, review_text: '', doctor_name: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const openReviewModal = (appt) => {
    setReviewForm({
      appointment_id: appt.appointment_id,
      rating: 5,
      review_text: '',
      doctor_name: appt.doctor_name || 'Doctor',
    });
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.appointment_id) return;
    setReviewSubmitting(true);
    try {
      await api.post(`/api/patient/appointment/${reviewForm.appointment_id}/review`, {
        rating: reviewForm.rating,
        review_text: reviewForm.review_text,
      });
      showToast('Review submitted successfully!', 'success');
      setReviewModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit review.', 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, appointmentsRes] = await Promise.all([
        api.get('/api/patient/profile'),
        api.get('/api/patient/appointments'),
      ]);
      const nextProfile = profileRes.data?.profile || EMPTY_PROFILE;
      setProfile(nextProfile);
      setEditForm(nextProfile);
      setAppointments(appointmentsRes.data?.appointments || []);
    } catch {
      setProfile((prev) => ({
        ...prev,
        name: user?.patient_name || user?.name || t('common.patient'),
        email: user?.email || '',
      }));
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const filteredAppointments = useMemo(() => {
    if (filter === 'all') return appointments;
    return appointments.filter((a) => (a.status || '').toLowerCase() === filter);
  }, [appointments, filter]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/api/patient/profile', editForm);
      const updated = res.data?.profile || editForm;
      setProfile(updated);
      setEditForm(updated);
      setEditModalOpen(false);
      showToast('Profile updated successfully!', 'success');
    } catch {
      showToast(t('common.error') || 'Update failed. Please try again.', 'error');
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    setCancelConfirm(appointmentId);
  };

  const confirmCancel = async () => {
    const appointmentId = cancelConfirm;
    setCancelConfirm(null);
    try {
      await api.post(`/api/patient/appointment/${appointmentId}/cancel`);
      setAppointments((prev) =>
        prev.map((item) =>
          item.appointment_id === appointmentId ? { ...item, status: 'Cancelled' } : item
        )
      );
      showToast('Appointment cancelled.', 'info');
    } catch {
      showToast(t('common.error') || 'Could not cancel. Please try again.', 'error');
    }
  };

  const profileImageUrl = profile?.profile_img
    ? `${BACKEND_URL}/static/uploads/${profile.profile_img}`
    : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const greeting = getGreeting();
  const totalAppts = appointments.length;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="dashboard-container">

      {/* ── Confirm Cancel Dialog ── */}
      {cancelConfirm && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content fade-in" style={{ maxWidth: 380, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 12 }}>Cancel Appointment?</h3>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn save" onClick={confirmCancel}>Yes, Cancel It</button>
              <button className="btn cancel" onClick={() => setCancelConfirm(null)}>Keep It</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Premium Welcome Header ───────────────────── */}
      <header className="dashboard-header-v2 slide-down">
        <div className="header-v2-left">
          <p className="header-v2-date">{greeting.emoji} {today}</p>
          <h1 className="header-v2-title">
            {greeting.text}, <span>{profile?.name || t('common.patient')}</span>
          </h1>
          <p className="header-v2-sub">Welcome to your patient portal. Manage your health and appointments here.</p>
        </div>
        <div className="header-v2-stats">
          <div className="hstat-pill hstat-total">
            <span className="hstat-num">{totalAppts}</span>
            <span className="hstat-label">Total Appointments</span>
          </div>
          <a href="/patient/book-appointment" className="hstat-link bg-accent-blue border-none shadow-sm hover:bg-blue-600">
            ➕ {t('patient.bookAppointment')}
          </a>
        </div>
      </header>

      {/* ── Rich Patient Profile Card ─────────────────── */}
      <section className="profile-card-v2 zoom-in">
        <div className="pcv2-accent-bar" />
        <div className="pcv2-avatar-wrap">
          <img
            src={profileImageUrl}
            alt="Profile"
            className="pcv2-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png';
            }}
          />
          <span className="pcv2-badge">ID: {profile?.patient_id || '—'}</span>
        </div>
        
        <div className="pcv2-info">
          <h2 className="pcv2-name">{profile?.name || '—'}</h2>
          
          <div className="pcv2-chips">
            {profile?.email && (
              <div className="pcv2-chip" title="Email">
                <span className="pcv2-chip-icon">✉️</span>
                <span>{profile.email}</span>
              </div>
            )}
            {profile?.contact && (
              <div className="pcv2-chip" title="Contact">
                <span className="pcv2-chip-icon">📞</span>
                <span>{profile.contact}</span>
              </div>
            )}
            {profile?.gender && (
              <div className="pcv2-chip" title="Gender">
                <span className="pcv2-chip-icon">👤</span>
                <span>{profile.gender}</span>
              </div>
            )}
            {profile?.age && (
              <div className="pcv2-chip" title="Age">
                <span className="pcv2-chip-icon">⏳</span>
                <span>{profile.age} yrs</span>
              </div>
            )}
            {profile?.blood_group && (
              <div className="pcv2-chip" title="Blood Group">
                <span className="pcv2-chip-icon">🩸</span>
                <span className="font-bold text-red-600">{profile.blood_group}</span>
              </div>
            )}
            {profile?.height_cm && profile?.weight_kg && (
              <div className="pcv2-chip" title="Height & Weight">
                <span className="pcv2-chip-icon">⚖️</span>
                <span>{profile.height_cm}cm / {profile.weight_kg}kg</span>
              </div>
            )}
          </div>
          
          <div className="pcv2-details mt-3 flex flex-wrap gap-2">
            {profile?.allergy && (
              <div className="text-xs bg-orange-50 text-orange-800 border border-orange-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span className="font-bold">⚠️ Allergies:</span> {profile.allergy}
              </div>
            )}
            {profile?.emergency_contact && (
              <div className="text-xs bg-red-50 text-red-800 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span className="font-bold">🆘 Emergency:</span> {profile.emergency_contact}
              </div>
            )}
          </div>
        </div>
        
        <button className="pcv2-edit-btn" onClick={() => setEditModalOpen(true)}>
          ✏️ Edit Profile
        </button>
      </section>

      {editModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content fade-in">
            <span className="close" onClick={() => setEditModalOpen(false)}>
              &times;
            </span>
            <h3>{t('patient.editProfile')}</h3>

            <form onSubmit={handleEditSubmit} className="edit-form">
              <div className="form-grid">
                <label>
                  {t('common.name')}
                  <input type="text" name="name" value={editForm.name || ''} onChange={handleEditChange} />
                </label>
                <label>
                  {t('common.email')}
                  <input type="email" name="email" value={editForm.email || ''} onChange={handleEditChange} />
                </label>
                <label>
                  Gender
                  <input type="text" name="gender" value={editForm.gender || ''} onChange={handleEditChange} />
                </label>
                <label>
                  Age
                  <input type="number" name="age" value={editForm.age || ''} onChange={handleEditChange} />
                </label>
                <label>
                  {t('common.contact')}
                  <input type="text" name="contact" value={editForm.contact || ''} onChange={handleEditChange} />
                </label>
                <label>
                  Address
                  <textarea name="address" value={editForm.address || ''} onChange={handleEditChange} />
                </label>
                <label>
                  {t('patient.bloodGroup')}
                  <input
                    type="text"
                    name="blood_group"
                    value={editForm.blood_group || ''}
                    onChange={handleEditChange}
                  />
                </label>
                <label>
                  {t('patient.allergy')}
                  <textarea name="allergy" value={editForm.allergy || ''} onChange={handleEditChange} />
                </label>
                <label>
                  Medical History
                  <textarea
                    name="medical_history"
                    value={editForm.medical_history || ''}
                    onChange={handleEditChange}
                  />
                </label>
                <label>
                  Medications
                  <textarea name="medications" value={editForm.medications || ''} onChange={handleEditChange} />
                </label>
                <label>
                  {t('patient.emergencyContact')}
                  <input
                    type="text"
                    name="emergency_contact"
                    value={editForm.emergency_contact || ''}
                    onChange={handleEditChange}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn save">
                  <span>{t('common.save')}</span>
                </button>
                <button type="button" className="btn cancel" onClick={() => setEditModalOpen(false)}>
                  <span>{t('common.cancel')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="appointment-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <span>{t('common.all')}</span>
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <span>{t('patient.upcomingAppts')}</span>
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          <span>{t('common.completed')}</span>
        </button>
        <button
          className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('cancelled')}
        >
          <span>{t('common.cancelled')}</span>
        </button>
      </div>

      <section className="appointments-section">
        <h3>{t('nav.appointments')}</h3>
        <table className="appointments-table">
          <thead>
            <tr>
              <th>{t('common.date')} & {t('common.time')}</th>
              <th>{t('common.doctor')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((a) => (
                <tr key={a.appointment_id}>
                  <td data-label="Date">{a.appointment_datetime}</td>
                  <td data-label="Doctor">{a.doctor_name || '-'}</td>
                  <td data-label="Status">
                    <span className={`status ${(a.status || '').toLowerCase()}`}>
                      {a.status === 'Completed' ? t('common.completed') : a.status === 'Cancelled' ? t('common.cancelled') : t('common.pending')}
                    </span>
                  </td>
                  <td data-label="Actions">
                    {a.status === 'Completed' && (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/patient/prescription/${a.appointment_id}`}
                          className="btn small info"
                          style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem' }}
                          title="View Prescription"
                        >
                          👁 See
                        </Link>
                        <a
                          href={`${BACKEND_URL}/patient/prescription/download/${a.appointment_id}`}
                          download={`Prescription_${a.appointment_id}.pdf`}
                          className="btn small primary"
                          style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem' }}
                          title="Download PDF"
                        >
                          ⬇ Dw.
                        </a>
                        {a.review_id ? (
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200"
                            title="You already rated this doctor"
                          >
                            ⭐ {a.review_rating}/5
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReviewModal(a)}
                            className="btn small success"
                            style={{ 
                              borderRadius: '8px', 
                              padding: '6px 12px', 
                              fontSize: '0.8rem', 
                              backgroundColor: '#eab308', 
                              borderColor: '#eab308', 
                              color: '#111827',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ⭐ Rate
                          </button>
                        )}
                      </div>
                    )}
                    {a.status === 'Pending' && (
                      <button className="btn cancel small" onClick={() => handleCancelAppointment(a.appointment_id)}>
                        {t('common.cancel')}
                      </button>
                    )}
                    {a.status === 'Cancelled' && <em>-</em>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">{t('patient.noAppts')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ── Submit Review Modal ── */}
      {reviewModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content fade-in" style={{ maxWidth: 450 }}>
            <span className="close" onClick={() => setReviewModalOpen(false)}>
              &times;
            </span>
            <h3 className="text-xl font-bold mb-2">⭐ Rate & Review Doctor</h3>
            <p className="text-sm text-warm-gray mb-4">
              How was your consultation with <strong className="text-text-primary">Dr. {reviewForm.doctor_name}</strong>? Your feedback helps other patients choose the right doctor.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-warm-gray uppercase mb-1">Rating</label>
                <div className="flex gap-2 text-3xl">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                      className="transition-transform hover:scale-110 cursor-pointer"
                      style={{ 
                        color: star <= reviewForm.rating ? '#eab308' : '#d1d5db',
                        background: 'none',
                        border: 'none',
                        padding: 0
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-warm-gray uppercase mb-1">Review Comments (Optional)</label>
                <textarea
                  placeholder="Share details of your experience (care, waiting time, explanation, etc.)"
                  value={reviewForm.review_text}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, review_text: e.target.value }))}
                  rows="4"
                  className="w-full px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal text-text-primary bg-white transition resize-none text-sm"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-light">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="btn cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="btn save"
                  style={{ backgroundColor: '#eab308', borderColor: '#eab308', color: '#111827', fontWeight: 'bold' }}
                >
                  {reviewSubmitting ? 'Submitting...' : '💾 Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;