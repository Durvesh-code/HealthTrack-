import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import '../../styles/doctor_dashboard.css';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', emoji: '🌅' };
  if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' };
  return { text: 'Good Evening', emoji: '🌙' };
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const parseToLocalISO = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr.includes("GMT") || dateStr.includes("UTC") || dateStr.endsWith("Z")) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  } else {
    const isoStr = dateStr.replace(' ', 'T');
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return isoStr;
  }
};

const DoctorDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const calendarRef = useRef(null);
  const [currentView, setCurrentView] = useState('timeGridWeek');

  // Medicines modal state
  const [medsModal, setMedsModal] = useState(null); // { loading, medicines, prescription }

  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, appointmentsRes] = await Promise.all([
        api.get('/api/doctor/profile'),
        api.get('/api/doctor/appointments'),
      ]);
      setProfile(profileRes.data?.profile || null);
      setAppointments(appointmentsRes.data?.appointments || []);
    } catch {
      setProfile({
        name: user?.doctor_name || user?.name || t('common.doctor'),
        email: user?.email || '',
        specialization: '',
        contact: '',
        profile_img: null,
      });
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
    return appointments.filter((a) => (a.status || '').toLowerCase() === filter.toLowerCase());
  }, [appointments, filter]);

  const handleComplete = async (appointmentId) => {
    try {
      await api.post(`/api/doctor/appointment/${appointmentId}/complete`);
      setAppointments((prev) =>
        prev.map((item) =>
          item.appointment_id === appointmentId ? { ...item, status: 'Completed' } : item
        )
      );
      showToast('Appointment marked as completed.', 'success');
    } catch {
      showToast(t('common.error') || 'Action failed. Please try again.', 'error');
    }
  };

  const handleReportAction = async (path) => {
    if (!path) return;
    try {
      const filename = path.split('/').pop().split('\\').pop();
      const response = await api.get(`/api/uploads/${filename}`, { responseType: 'blob' });
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
      window.open(blobUrl, '_blank');
      
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      showToast('Failed to retrieve medical report.', 'error');
    }
  };

  // ── Medicines modal ──────────────────────────────────────
  const openMedsModal = async (apptId) => {
    setMedsModal({ loading: true, medicines: [], prescription: null });
    try {
      const res = await api.get(`/api/doctor/appointment/${apptId}/medicines`);
      setMedsModal({
        loading: false,
        medicines: res.data.medicines || [],
        prescription: res.data.prescription || null,
      });
    } catch {
      setMedsModal({ loading: false, medicines: [], prescription: null });
    }
  };

  const closeMedsModal = () => setMedsModal(null);

  // ── Calendar Event Handlers ──────────────────────────────
  const calendarEvents = useMemo(() => {
    if (currentView === 'dayGridMonth') {
      const statusCounts = {};
      appointments.forEach(appt => {
        const localISO = parseToLocalISO(appt.appointment_datetime);
        if (!localISO) return;
        const datePart = localISO.split('T')[0];
        if (!statusCounts[datePart]) {
          statusCounts[datePart] = { Pending: 0, Completed: 0, Cancelled: 0 };
        }
        const status = appt.status || 'Pending';
        if (statusCounts[datePart][status] !== undefined) {
          statusCounts[datePart][status]++;
        } else {
          statusCounts[datePart]['Pending']++;
        }
      });
      
      const events = [];
      Object.keys(statusCounts).forEach(datePart => {
        const counts = statusCounts[datePart];
        if (counts.Pending > 0) {
          events.push({
            id: `summary-pending-${datePart}`,
            title: counts.Pending === 1 ? '1 Pending' : `${counts.Pending} Pending`,
            start: datePart,
            allDay: true,
            backgroundColor: '#0f6b6b', // Deep teal
            borderColor: '#0f6b6b',
            textColor: '#fff',
            editable: false,
            extendedProps: { isSummary: true, date: datePart, status: 'Pending' }
          });
        }
        if (counts.Completed > 0) {
          events.push({
            id: `summary-completed-${datePart}`,
            title: counts.Completed === 1 ? '1 Completed' : `${counts.Completed} Completed`,
            start: datePart,
            allDay: true,
            backgroundColor: '#10b981', // Green
            borderColor: '#10b981',
            textColor: '#fff',
            editable: false,
            extendedProps: { isSummary: true, date: datePart, status: 'Completed' }
          });
        }
        if (counts.Cancelled > 0) {
          events.push({
            id: `summary-cancelled-${datePart}`,
            title: counts.Cancelled === 1 ? '1 Cancelled' : `${counts.Cancelled} Cancelled`,
            start: datePart,
            allDay: true,
            backgroundColor: '#ef4444', // Red
            borderColor: '#ef4444',
            textColor: '#fff',
            editable: false,
            extendedProps: { isSummary: true, date: datePart, status: 'Cancelled' }
          });
        }
      });
      return events;
    } else {
      return appointments
        .map(appt => {
          const localISO = parseToLocalISO(appt.appointment_datetime);
          if (!localISO) return null;
          
          const start = new Date(localISO);
          const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutes duration
          
          const endYear = end.getFullYear();
          const endMonth = String(end.getMonth() + 1).padStart(2, '0');
          const endDate = String(end.getDate()).padStart(2, '0');
          const endHours = String(end.getHours()).padStart(2, '0');
          const endMinutes = String(end.getMinutes()).padStart(2, '0');
          const endSeconds = String(end.getSeconds()).padStart(2, '0');
          const endLocalISO = `${endYear}-${endMonth}-${endDate}T${endHours}:${endMinutes}:${endSeconds}`;

          let color = '#0f6b6b'; // pending gets deep teal
          if (appt.status === 'Completed') color = '#10b981'; // green
          if (appt.status === 'Cancelled') color = '#ef4444'; // red

          return {
            id: String(appt.appointment_id),
            title: `${appt.patient_name || 'Patient'} - ${appt.symptoms || 'Consultation'}`,
            start: localISO,
            end: endLocalISO,
            backgroundColor: color,
            borderColor: color,
            editable: appt.status === 'Pending',
            startEditable: appt.status === 'Pending',
            durationEditable: false,
            extendedProps: { isSummary: false }
          };
        })
        .filter(evt => evt !== null);
    }
  }, [appointments, currentView]);

  const renderEventContent = (eventInfo) => {
    const { event } = eventInfo;
    
    if (event.extendedProps.isSummary) {
      return (
        <div style={{
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.78rem',
          fontWeight: 'bold',
          backgroundColor: event.backgroundColor || '#0f6b6b',
          color: '#fff',
          width: '100%',
          boxSizing: 'border-box',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {event.title}
        </div>
      );
    }
    
    // For detailed events in Week/Day views
    const timeText = eventInfo.timeText; // e.g. "14:00 - 14:30"
    
    return (
      <div style={{
        padding: '6px 8px',
        fontSize: '0.8rem',
        lineHeight: '1.3',
        backgroundColor: event.backgroundColor || '#0f6b6b',
        color: '#fff',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: '6px'
      }}>
        <div style={{ fontWeight: '800', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          👤 {event.title.split(' - ')[0]}
        </div>
        <div style={{ opacity: 0.9, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.72rem', marginTop: '2px' }}>
          💬 {event.title.split(' - ')[1] || 'Consultation'}
        </div>
        <div style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🕒</span>
          <span>{timeText}</span>
        </div>
      </div>
    );
  };

  const handleEventDrop = async (info) => {
    const appointmentId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;
    
    // Format to YYYY-MM-DD HH:MM:SS in local timezone
    const yyyy = newStart.getFullYear();
    const mm = String(newStart.getMonth() + 1).padStart(2, '0');
    const dd = String(newStart.getDate()).padStart(2, '0');
    const hh = String(newStart.getHours()).padStart(2, '0');
    const min = String(newStart.getMinutes()).padStart(2, '0');
    const ss = String(newStart.getSeconds()).padStart(2, '0');
    const formattedDatetime = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    try {
      await api.put(`/api/doctor/appointment/${appointmentId}/reschedule`, {
        appointment_datetime: formattedDatetime
      });
      showToast('Appointment rescheduled successfully!', 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Rescheduling failed.', 'error');
      info.revert();
    }
  };

  const handleEventClick = (info) => {
    if (info.event.extendedProps.isSummary) {
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.changeView('timeGridDay', info.event.extendedProps.date);
      }
    } else {
      navigate(`/doctor/appointment/${info.event.id}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const greeting    = getGreeting();
  const totalAppts   = appointments.length;
  const pendingAppts = appointments.filter(a => (a.status || '').toLowerCase() === 'pending').length;
  const doneAppts    = appointments.filter(a => (a.status || '').toLowerCase() === 'completed').length;
  const today        = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="doctor-dashboard fade-in">

        {/* ── Welcome Header ─────────────────────────── */}
        <header className="dashboard-header-v2 slide-down">
          <div className="header-v2-left">
            <p className="header-v2-date">{greeting.emoji} {today}</p>
            <h1 className="header-v2-title">
              {greeting.text}, <span>Dr. {profile?.name || t('common.doctor')}</span>
            </h1>
            <p className="header-v2-sub">{t('doctor.dashboardTitle') || "Here's your practice overview for today."}</p>
          </div>
          <div className="header-v2-stats">
            <div className="hstat-pill hstat-total">
              <span className="hstat-num">{totalAppts}</span>
              <span className="hstat-label">Total</span>
            </div>
            <div className="hstat-pill hstat-pending">
              <span className="hstat-num">{pendingAppts}</span>
              <span className="hstat-label">Pending</span>
            </div>
            <div className="hstat-pill hstat-done">
              <span className="hstat-num">{doneAppts}</span>
              <span className="hstat-label">Completed</span>
            </div>
            <Link to="/doctor/statistics" className="hstat-link">📊 Analytics →</Link>
          </div>
        </header>

        {/* ── Profile Card ─────────────────────────────── */}
        <section className="profile-card-v2 zoom-in">
          <div className="pcv2-accent-bar" />
          <div className="pcv2-avatar-wrap">
            <img
              src={
                profile?.profile_img
                  ? `${BACKEND_URL}/static/uploads/${profile.profile_img}`
                  : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'
              }
              alt="Doctor Profile"
              className="pcv2-avatar"
              onError={e => { e.target.onerror = null; e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'; }}
            />
            {profile?.specialization && (
              <span className="pcv2-badge">{profile.specialization}</span>
            )}
          </div>
          <div className="pcv2-info">
            <h2 className="pcv2-name">Dr. {profile?.name || '—'}</h2>
            <div className="pcv2-chips">
              {profile?.email && (
                <div className="pcv2-chip">
                  <span className="pcv2-chip-icon">✉️</span>
                  <span>{profile.email}</span>
                </div>
              )}
              {profile?.contact && (
                <div className="pcv2-chip">
                  <span className="pcv2-chip-icon">📞</span>
                  <span>{profile.contact}</span>
                </div>
              )}
              {profile?.clinic_name && (
                <div className="pcv2-chip">
                  <span className="pcv2-chip-icon">🏥</span>
                  <span>{profile.clinic_name}</span>
                </div>
              )}
              {profile?.available_hours && (
                <div className="pcv2-chip">
                  <span className="pcv2-chip-icon">🕐</span>
                  <span>{profile.available_hours}</span>
                </div>
              )}
            </div>
          </div>
          <Link to="/doctor/profile" className="pcv2-edit-btn">✏️ Edit Profile</Link>
        </section>

        {/* ── Filter Tabs ───────────────────────────────── */}
        <div className="tabs slide-up">
          <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            {t('common.all')}
          </button>
          <button className={`tab-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            {t('common.pending')}
          </button>
          <button className={`tab-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            {t('common.completed')}
          </button>
          <button className={`tab-btn ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>
            {t('common.cancelled')}
          </button>
        </div>

        {/* ── Appointments Section ───────────────────────── */}
        <section className="appointments-section fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ margin: 0 }}><span>{t('nav.appointments')}</span></h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: viewMode === 'list' ? '#0f6b6b' : '#fff',
                  color: viewMode === 'list' ? '#fff' : '#1e293b',
                  border: '1px solid ' + (viewMode === 'list' ? '#0f6b6b' : '#cbd5e1')
                }}
              >
                📋 List View
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('calendar')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: viewMode === 'calendar' ? '#0f6b6b' : '#fff',
                  color: viewMode === 'calendar' ? '#fff' : '#1e293b',
                  border: '1px solid ' + (viewMode === 'calendar' ? '#0f6b6b' : '#cbd5e1')
                }}
              >
                📅 Calendar View
              </button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <div style={{ backgroundColor: '#fff', padding: 20, borderRadius: 20, border: '1px solid #e2e8f0', color: '#1e293b' }}>
              <style>{`
                .fc .fc-timegrid-slot {
                  height: 64px !important;
                }
                .fc-timegrid-event {
                  border-radius: 8px !important;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                  border: none !important;
                }
                .fc-v-event {
                  background-color: transparent !important;
                  border: none !important;
                }
                .fc-event-main {
                  padding: 0 !important;
                }
              `}</style>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={calendarEvents}
                editable={true}
                eventDrop={handleEventDrop}
                eventClick={handleEventClick}
                datesSet={(dateInfo) => {
                  setCurrentView(dateInfo.view.type);
                }}
                eventContent={renderEventContent}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                scrollTime="08:00:00"
                slotEventOverlap={false}
                height="auto"
              />
            </div>
          ) : (
            <table className="appointments-table" id="appointmentTable">
              <thead>
                <tr id="tableHeader">
                  <th>{t('common.patient')}</th>
                  <th>{t('common.date')} &amp; {t('common.time')}</th>
                  <th>{t('patient.symptoms')}</th>
                  <th>{t('common.status')}</th>
                  <th id="reportHeader">Report</th>
                  <th id="actionHeader">{t('common.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map((appt) => (
                    <tr key={appt.appointment_id} className={`appt-row ${(appt.status || '').toLowerCase()}`}>
                      <td>{appt.patient_name || '-'}</td>
                      <td>{appt.appointment_datetime || '-'}</td>
                      <td>{appt.symptoms || '-'}</td>
                      <td>
                        <span className={`status ${(appt.status || '').toLowerCase()}`}>
                          {appt.status === 'Completed'
                            ? t('common.completed')
                            : appt.status === 'Cancelled'
                            ? t('common.cancelled')
                            : t('common.pending')}
                        </span>
                      </td>
                      <td className="report-cell">
                        {appt.report_path ? (
                          <button
                            onClick={() => handleReportAction(appt.report_path)}
                            className="btn small info"
                          >
                            {t('common.view')}
                          </button>
                        ) : (
                          <span className="text-muted">No Report</span>
                        )}
                      </td>
                      <td className="action-cell">
                        {appt.status === 'Pending' ? (
                          <div className="action-btn-group">
                            <Link
                              to={`/doctor/appointment/${appt.appointment_id}`}
                              className="btn small primary"
                              title="View full appointment details"
                            >
                              👁 {t('common.view')}
                            </Link>
                            <button
                              onClick={() => handleComplete(appt.appointment_id)}
                              className="btn small success"
                              title="Mark this appointment as completed"
                            >
                              ✅ {t('doctor.completeAppt')}
                            </button>
                          </div>
                        ) : appt.status === 'Completed' ? (
                          <button
                            id={`btn-see-medicines-${appt.appointment_id}`}
                            onClick={() => openMedsModal(appt.appointment_id)}
                            className="btn small info"
                            title="View prescribed medicines"
                          >
                            💊 View Medicines
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>
                      {t('patient.noAppts')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── Medicines Modal (portal-style fixed overlay) ─────── */}
      {medsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.22)', width: '100%', maxWidth: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>💊 Prescribed Medicines</h2>
                {medsModal.prescription && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Patient: <strong>{medsModal.prescription.patient_name}</strong>
                    &nbsp;·&nbsp;By: <strong>Dr. {medsModal.prescription.doctor_name}</strong>
                    &nbsp;·&nbsp;
                    {medsModal.prescription.date_issued
                      ? new Date(medsModal.prescription.date_issued).toLocaleDateString('en-IN')
                      : ''}
                  </p>
                )}
              </div>
              <button
                onClick={closeMedsModal}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
              {medsModal.loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
              ) : medsModal.medicines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontStyle: 'italic' }}>
                  No medicine details recorded for this prescription.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['#', 'Medicine', 'Dosage', 'Qty', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medsModal.medicines.map((m, i) => (
                      <tr key={m.detail_id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>{i + 1}</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#1e293b' }}>{m.medicine_name}</td>
                        <td style={{ padding: '12px', color: '#475569', fontSize: '0.88rem' }}>{m.dosage || '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#0f6b6b' }}>{m.quantity || 1}</td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '0.85rem' }}>{m.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
              <button
                onClick={closeMedsModal}
                style={{ padding: '9px 24px', background: '#0f6b6b', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DoctorDashboard;