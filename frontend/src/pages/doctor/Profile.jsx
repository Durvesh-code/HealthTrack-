import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../hooks/useToast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/* ── small reusable info-row ─────────────────────────── */
const InfoRow = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-light last:border-0">
      <span className="text-xl w-7 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-warm-gray uppercase tracking-wider font-semibold mb-0.5">{label}</p>
        <p className="text-text-primary font-medium leading-snug break-words">{value}</p>
      </div>
    </div>
  );
};

/* ── stat badge ──────────────────────────────────────── */
const StatBadge = ({ value, label, color }) => (
  <div className={`flex flex-col items-center px-5 py-3 rounded-2xl ${color}`}>
    <span className="text-2xl font-bold leading-none">{value ?? '—'}</span>
    <span className="text-xs mt-1 opacity-80 font-medium">{label}</span>
  </div>
);

/* ── format time helper ────────────────────────────── */
const formatTime12Hr = (timeStr) => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const min = minStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  const formattedHour = hour < 10 ? `0${hour}` : hour;
  return `${formattedHour}:${min} ${ampm}`;
};

/* ── group slots helper ────────────────────────────── */
const groupAvailabilitySlots = (slots) => {
  if (!slots || slots.length === 0) return [];
  
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shortDays = {
    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
    'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
  };
  
  const groups = {};
  slots.forEach(slot => {
    const timeKey = `${slot.start_time}-${slot.end_time}`;
    if (!groups[timeKey]) {
      groups[timeKey] = {
        start: slot.start_time,
        end: slot.end_time,
        days: []
      };
    }
    groups[timeKey].days.push(slot.day_of_week);
  });
  
  return Object.values(groups).map(group => {
    const sortedDays = group.days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    const indices = sortedDays.map(d => dayOrder.indexOf(d));
    let isConsecutive = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i-1] + 1) {
        isConsecutive = false;
        break;
      }
    }
    
    let daysLabel = '';
    if (sortedDays.length === 7) {
      daysLabel = 'Everyday';
    } else if (sortedDays.length === 5 && sortedDays[0] === 'Monday' && sortedDays[4] === 'Friday' && isConsecutive) {
      daysLabel = 'Mon - Fri';
    } else if (sortedDays.length === 6 && sortedDays[0] === 'Monday' && sortedDays[5] === 'Saturday' && isConsecutive) {
      daysLabel = 'Mon - Sat';
    } else if (sortedDays.length === 2 && sortedDays[0] === 'Saturday' && sortedDays[1] === 'Sunday') {
      daysLabel = 'Weekends';
    } else if (isConsecutive && sortedDays.length >= 3) {
      daysLabel = `${shortDays[sortedDays[0]]} - ${shortDays[sortedDays[sortedDays.length - 1]]}`;
    } else {
      daysLabel = sortedDays.map(d => shortDays[d]).join(', ');
    }
    
    return {
      daysLabel,
      timeLabel: `${formatTime12Hr(group.start)} - ${formatTime12Hr(group.end)}`
    };
  });
};

/* ── main component ─────────────────────────────────── */
const DoctorProfile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Availability Slots State
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [newSlot, setNewSlot] = useState({ start_time: '09:00', end_time: '12:00' });
  const [selectedDays, setSelectedDays] = useState({
    Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true,
    Saturday: false, Sunday: false
  });

  const fetchAvailability = useCallback(async () => {
    try {
      const response = await api.get('/api/doctor/availability');
      setAvailabilitySlots(response.data.slots || []);
    } catch {
      // Silently handle error
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const handleAddSlot = async () => {
    const days = Object.keys(selectedDays).filter(day => selectedDays[day]);
    if (days.length === 0) {
      showToast('Please select at least one day of the week.', 'error');
      return;
    }
    try {
      await api.post('/api/doctor/availability', {
        day_of_week: days,
        start_time: newSlot.start_time,
        end_time: newSlot.end_time
      });
      showToast('Availability slots added successfully!', 'success');
      fetchAvailability();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not add slots.', 'error');
    }
  };

  const handleDeleteSlot = async (id) => {
    try {
      await api.delete(`/api/doctor/availability/${id}`);
      showToast('Availability slot removed!', 'success');
      fetchAvailability();
    } catch {
      showToast('Could not delete slot.', 'error');
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get('/api/doctor/profile');
      const p = response.data.profile || response.data;
      setProfile({ ...p, hospital: p?.clinic_name || p?.hospital || '' });
    } catch {
      setProfile({
        name: user?.doctor_name || t('common.doctor'),
        email: user?.email || 'doctor@example.com',
        specialization: 'Cardiology',
        contact: '+91 98765 43210',
        hospital: 'Apollo Hospital',
        experience: 10,
        profile_img: null,
        bio: 'Dedicated to providing top-quality care and personalized treatment.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchProfile();
    fetchAvailability();
  }, [fetchProfile, fetchAvailability]);

  const openEditModal = () => { setEditForm({ ...profile }); setEditModalOpen(true); };
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editForm.name,
        specialization: editForm.specialization,
        contact: editForm.contact,
        clinic_name: editForm.hospital,
        bio: editForm.bio,
        qualification: editForm.qualification,
        experience: editForm.experience,
        languages: editForm.languages,
        available_hours: editForm.available_hours,
        fee: editForm.fee,
        license_no: editForm.license_no,
      };
      const response = await api.put('/api/doctor/profile', payload);
      const next = response.data?.profile || editForm;
      setProfile({ ...next, hospital: next.clinic_name || editForm.hospital });
      setEditModalOpen(false);
      showToast(t('common.success') || 'Profile updated!', 'success');
    } catch {
      showToast(t('common.error') || 'Update failed.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray text-sm">Loading profile…</p>
      </div>
    );
  }

  const avatarSrc = profile.profile_img
    ? `${BACKEND_URL}/static/uploads/${profile.profile_img}`
    : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png';

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto animate-fadeInUp space-y-6">

        {/* ── Hero Card ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-md border border-border-light overflow-hidden">

          {/* Cover Banner */}
          <div
            className="h-40 relative"
            style={{
              background: 'linear-gradient(135deg, #0f6b6b 0%, #0a8f8f 55%, #2b9af3 100%)',
            }}
          >
            {/* decorative circles */}
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white opacity-[0.06]" />
            <div className="absolute right-24 top-4 w-20 h-20 rounded-full bg-white opacity-[0.05]" />

            {/* Edit button top-right */}
            <button
              onClick={openEditModal}
              className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white font-semibold text-sm rounded-xl border border-white/30 transition"
            >
              ✏️ Edit Profile
            </button>
          </div>

          {/* Avatar + Name row */}
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-5 -mt-16 mb-6">
              {/* Avatar with ring */}
              <div className="relative flex-shrink-0">
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-soft-slate">
                  <img src={avatarSrc} alt="Doctor" className="w-full h-full object-cover"
                    onError={e => { e.target.onerror = null; e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'; }} />
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
              </div>

              {/* Name + spec + hospital */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-text-primary font-heading">
                  Dr. {profile.name || '—'}
                </h1>
                {profile.specialization && (
                  <span
                    className="inline-block mt-1 px-3 py-1 text-xs font-bold rounded-full text-white"
                    style={{ background: 'linear-gradient(90deg,#0f6b6b,#2b9af3)' }}
                  >
                    {profile.specialization}
                  </span>
                )}
                {profile.hospital && (
                  <p className="mt-1 text-warm-gray text-sm">🏥 {profile.hospital}</p>
                )}
              </div>

              {/* Stat badges */}
              <div className="flex gap-3 flex-wrap justify-center md:justify-end">
                {profile.experience && (
                  <StatBadge
                    value={`${profile.experience}yr`}
                    label="Experience"
                    color="bg-teal-50 text-deep-teal"
                  />
                )}
                {profile.fee && (
                  <StatBadge
                    value={`₹${profile.fee}`}
                    label="Consult Fee"
                    color="bg-blue-50 text-accent-blue"
                  />
                )}
                {profile.license_no && (
                  <StatBadge
                    value="✓"
                    label="Verified"
                    color="bg-green-50 text-green-700"
                  />
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="mb-6 p-4 bg-soft-slate rounded-xl border-l-4 border-deep-teal">
                <p className="text-xs text-warm-gray uppercase tracking-wider font-semibold mb-1">About</p>
                <p className="text-text-primary leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Details Grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Contact & Practice */}
          <div className="bg-white rounded-2xl shadow-md border border-border-light p-6">
            <h2 className="font-bold text-text-primary text-base mb-2 flex items-center gap-2">
              <span className="text-deep-teal">📋</span> Contact & Practice
            </h2>
            <div className="mt-3">
              <InfoRow icon="✉️" label={t('common.email')}   value={profile.email} />
              <InfoRow icon="📞" label={t('common.contact')} value={profile.contact} />
              <InfoRow icon="🏥" label="Hospital / Clinic"  value={profile.hospital} />
              <InfoRow icon="🕐" label="Available Hours"     value={profile.available_hours} />
              <InfoRow icon="📍" label="Clinic Address"      value={profile.clinic_address} />
            </div>
          </div>

          {/* Professional Details */}
          <div className="bg-white rounded-2xl shadow-md border border-border-light p-6">
            <h2 className="font-bold text-text-primary text-base mb-2 flex items-center gap-2">
              <span className="text-deep-teal">🎓</span> Professional Details
            </h2>
            <div className="mt-3">
              <InfoRow icon="🩺" label={t('doctor.specialization')} value={profile.specialization} />
              <InfoRow icon="🎓" label="Qualification"               value={profile.qualification} />
              <InfoRow icon="📅" label={t('doctor.experience')}      value={profile.experience ? `${profile.experience} years` : null} />
              <InfoRow icon="🌐" label="Languages"                    value={profile.languages} />
              <InfoRow icon="🪪" label="License No."                  value={profile.license_no} />
            </div>
          </div>

          {/* Skills */}
          {profile.skills && (
            <div className="bg-white rounded-2xl shadow-md border border-border-light p-6 md:col-span-2">
              <h2 className="font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                <span className="text-deep-teal">⚡</span> Skills & Expertise
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.split(',').map((s, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold bg-soft-slate border border-border-light text-text-primary"
                  >
                    {s.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manage Availability Slots */}
          <div className="bg-white rounded-2xl shadow-md border border-border-light p-6 md:col-span-2">
            <h2 className="font-bold text-text-primary text-base mb-4 flex items-center gap-2">
              <span className="text-deep-teal">📅</span> Manage Availability Slots
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to add slot */}
              <div className="bg-soft-slate/40 p-5 rounded-2xl border border-border-light space-y-4">
                <h3 className="font-semibold text-text-primary text-sm">Add New Time Slot</h3>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-warm-gray uppercase">Days of Week</label>
                    <div className="flex gap-1.5 text-[10px] font-bold text-deep-teal">
                      <button 
                        type="button" 
                        onClick={() => setSelectedDays({
                          Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true,
                          Saturday: false, Sunday: false
                        })}
                        className="hover:underline"
                      >
                        Weekdays
                      </button>
                      <span>•</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedDays({
                          Monday: false, Tuesday: false, Wednesday: false, Thursday: false, Friday: false,
                          Saturday: true, Sunday: true
                        })}
                        className="hover:underline"
                      >
                        Weekends
                      </button>
                      <span>•</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedDays({
                          Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true,
                          Saturday: true, Sunday: true
                        })}
                        className="hover:underline"
                      >
                        All
                      </button>
                      <span>•</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedDays({
                          Monday: false, Tuesday: false, Wednesday: false, Thursday: false, Friday: false,
                          Saturday: false, Sunday: false
                        })}
                        className="hover:underline text-danger"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 bg-white p-3 rounded-lg border border-border-light">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <label key={day} className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={selectedDays[day]}
                          onChange={(e) => setSelectedDays(prev => ({ ...prev, [day]: e.target.checked }))}
                          className="w-4 h-4 rounded text-deep-teal border-border-light focus:ring-deep-teal"
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-warm-gray uppercase mb-1">Start Time</label>
                    <input 
                      type="time"
                      value={newSlot.start_time}
                      onChange={(e) => setNewSlot(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal text-text-primary bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-warm-gray uppercase mb-1">End Time</label>
                    <input 
                      type="time"
                      value={newSlot.end_time}
                      onChange={(e) => setNewSlot(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal text-text-primary bg-white transition"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="w-full py-2.5 bg-deep-teal hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition shadow-sm"
                >
                  ➕ Add Available Slot
                </button>
              </div>

              {/* List of slots */}
              <div className="lg:col-span-2 space-y-4">
                {/* Grouped Schedule Summary */}
                {!slotsLoading && availabilitySlots.length > 0 && (
                  <div className="bg-teal-50/40 border border-teal-100/50 rounded-2xl p-4">
                    <h3 className="font-semibold text-deep-teal text-xs uppercase tracking-wider mb-2">Grouped Schedule Overview</h3>
                    <div className="flex flex-wrap gap-2">
                      {groupAvailabilitySlots(availabilitySlots).map((g, i) => (
                        <div key={i} className="px-3 py-1.5 bg-white border border-teal-200 text-deep-teal font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
                          <span>📅</span>
                          <span>{g.daysLabel}: <strong className="text-text-primary font-bold">{g.timeLabel}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="font-semibold text-text-primary text-sm">Active Available Slots</h3>
                {slotsLoading ? (
                  <p className="text-warm-gray text-xs">Loading slots...</p>
                ) : availabilitySlots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availabilitySlots.map(slot => (
                      <div 
                        key={slot.availability_id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border-light bg-white hover:border-deep-teal transition"
                      >
                        <div>
                          <p className="font-bold text-sm text-text-primary">{slot.day_of_week}</p>
                          <p className="text-xs text-warm-gray">{formatTime12Hr(slot.start_time)} - {formatTime12Hr(slot.end_time)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.availability_id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-danger/10 text-danger font-bold transition"
                          title="Delete slot"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-border-light rounded-2xl">
                    <p className="text-warm-gray text-sm">No availability slots set yet.</p>
                    <p className="text-xs text-warm-gray/60 mt-1">Add slots using the form on the left so patients can book appointments with you.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Modal ───────────────────────────────────── */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Profile">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {[
              { name: 'name',            label: t('common.name'),              type: 'text'   },
              { name: 'specialization',  label: t('doctor.specialization'),    type: 'text'   },
              { name: 'contact',         label: t('common.contact'),           type: 'text'   },
              { name: 'hospital',        label: 'Hospital / Clinic',           type: 'text'   },
              { name: 'qualification',   label: 'Qualification',               type: 'text'   },
              { name: 'experience',      label: t('doctor.experience'),        type: 'number' },
              { name: 'languages',       label: 'Languages',                   type: 'text'   },
              { name: 'available_hours', label: 'Available Hours',             type: 'text'   },
              { name: 'fee',             label: 'Consultation Fee (₹)',        type: 'number' },
              { name: 'license_no',      label: 'License No.',                 type: 'text'   },
            ].map(({ name, label, type }) => (
              <label key={name} className="flex flex-col text-sm font-medium text-warm-gray">
                {label}
                <input
                  type={type}
                  name={name}
                  value={editForm[name] || ''}
                  onChange={handleEditChange}
                  className="mt-1 px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal text-text-primary bg-white transition"
                />
              </label>
            ))}
            <label className="flex flex-col text-sm font-medium text-warm-gray sm:col-span-2">
              Skills <span className="font-normal text-xs">(comma-separated)</span>
              <input
                type="text"
                name="skills"
                value={editForm.skills || ''}
                onChange={handleEditChange}
                placeholder="e.g. ECG, Surgery, Pediatrics"
                className="mt-1 px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal text-text-primary bg-white transition"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-warm-gray sm:col-span-2">
              Bio
              <textarea
                name="bio"
                value={editForm.bio || ''}
                onChange={handleEditChange}
                rows={3}
                className="mt-1 px-3 py-2 border border-border-light rounded-lg outline-none focus:border-deep-teal resize-none text-text-primary bg-white transition"
              />
            </label>
          </div>
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border-light">
            <Button type="button" variant="cancel" onClick={() => setEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="success">
              💾 {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default DoctorProfile;