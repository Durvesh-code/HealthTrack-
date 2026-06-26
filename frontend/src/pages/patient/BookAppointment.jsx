import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const initialForm = {
  date: '',
  time: '',
  symptoms: '',
  report: null,
};

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

const BookAppointment = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Unified modal state: null (closed), or specific doctor object
  const [modalMode, setModalMode] = useState(null); // 'info' | 'book' | null
  const [activeDoctor, setActiveDoctor] = useState(null);
  
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doctor Availability States
  const [doctorAvailability, setDoctorAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Doctor Review States
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/api/patient/doctors');
      setDoctors(response.data?.doctors || []);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return doctors;
    return doctors.filter((doc) => {
      const name = (doc.name || '').toLowerCase();
      const specialization = (doc.specialization || '').toLowerCase();
      const clinic = (doc.clinic_name || '').toLowerCase();
      return name.includes(query) || specialization.includes(query) || clinic.includes(query);
    });
  }, [doctors, searchTerm]);

  const openModal = async (doctor, mode) => {
    setActiveDoctor(doctor);
    setModalMode(mode);
    setFormData(initialForm);
    setDoctorAvailability([]);
    setReviews([]);
    
    if (mode === 'book' || mode === 'info') {
      setAvailabilityLoading(true);
      try {
        const response = await api.get(`/api/patient/doctor/${doctor.doctor_id}/availability`);
        setDoctorAvailability(response.data.slots || []);
      } catch {
        setDoctorAvailability([]);
      } finally {
        setAvailabilityLoading(false);
      }
    }
    
    if (mode === 'info') {
      setReviewsLoading(true);
      try {
        const response = await api.get(`/api/patient/doctor/${doctor.doctor_id}/reviews`);
        setReviews(response.data.reviews || []);
      } catch {
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setTimeout(() => {
      setActiveDoctor(null);
      setFormData(initialForm);
      setDoctorAvailability([]);
      setReviews([]);
    }, 200); // Wait for exit animation
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'report') {
      setFormData((prev) => ({ ...prev, report: files?.[0] || null }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getDayName = (dateStr) => {
    if (!dateStr) return '';
    // To avoid timezone shift issues on Date parse
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    return '';
  };

  const isTimeSlotValid = useMemo(() => {
    if (!formData.date || !formData.time || doctorAvailability.length === 0) return true;
    const day = getDayName(formData.date);
    const time = formData.time; // "HH:MM"
    
    return doctorAvailability.some(slot => {
      if (slot.day_of_week !== day) return false;
      return time >= slot.start_time && time <= slot.end_time;
    });
  }, [formData.date, formData.time, doctorAvailability]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeDoctor) return;
    
    if (doctorAvailability.length > 0 && !isTimeSlotValid) {
      showToast('Selected date/time is outside the doctor\'s availability.', 'error');
      return;
    }
    
    setIsSubmitting(true);
    const payload = new FormData();
    payload.append('doctor_id', activeDoctor.doctor_id);
    payload.append('date', formData.date);
    payload.append('time', formData.time);
    payload.append('symptoms', formData.symptoms);
    if (formData.report) payload.append('report', formData.report); 
    
    try {
      await api.post('/api/patient/book-appointment', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast(t('common.success') || 'Appointment booked successfully!', 'success');
      closeModal();
    } catch (error) {
      showToast(error.response?.data?.message || t('common.error') || 'Booking failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray text-sm">Loading available doctors...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fadeInUp">

      {/* ── Premium Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 slide-down px-2">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-2 flex items-center gap-3">
            <span className="bg-soft-slate p-2.5 rounded-xl border border-border-light text-deep-teal shadow-sm">
              <i className="fa fa-stethoscope text-xl leading-none" />
            </span>
            {t('patient.bookAppointment') || 'Book Appointment'}
          </h1>
          <p className="text-warm-gray max-w-xl">
            Browse our network of top medical professionals, review their expertise, and instantly schedule your consultation.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 flex-shrink-0">
          <i className="fa fa-search absolute left-4 top-1/2 -translate-y-1/2 text-warm-gray" />
          <input
            type="text"
            placeholder="Search by doctor, clinic, or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light focus:border-deep-teal focus:ring-2 focus:ring-deep-teal/20 outline-none transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      {/* ── Doctor Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDoctors.length > 0 ? (
          filteredDoctors.map((d) => (
            <div 
              key={d.doctor_id} 
              className="bg-white rounded-2xl border border-border-light shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col group"
            >
              {/* Doctor Accent Strip */}
              <div className="h-1.5 bg-gradient-to-r from-deep-teal to-accent-blue w-full" />
              
              <div className="p-6 flex flex-col items-center text-center flex-1">
                {/* Avatar */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-deep-teal rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity duration-300" />
                  <img
                    src={d.profile_img ? `${BACKEND_URL}/static/uploads/${d.profile_img}` : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'}
                    alt={d.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow bg-soft-slate relative z-10"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'; }}
                  />
                  {/* Fake online indicator */}
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full z-20" />
                </div>

                {/* Info */}
                <h3 className="text-lg font-bold text-text-primary mb-1">Dr. {d.name}</h3>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-deep-teal font-semibold text-sm px-3 py-1 bg-teal-50 rounded-full inline-block">
                    {d.specialization || 'General'}
                  </span>
                  {d.total_reviews > 0 ? (
                    <span className="text-xs font-bold text-amber-500 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-0.5" title={`${parseFloat(d.average_rating).toFixed(1)} out of 5 stars based on ${d.total_reviews} reviews`}>
                      ★ {parseFloat(d.average_rating).toFixed(1)} ({d.total_reviews})
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-warm-gray bg-soft-slate border border-border-light px-2 py-1 rounded-full flex items-center gap-0.5" title="No reviews yet">
                      ★ 0.0 (0)
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-warm-gray text-sm mb-6 max-w-full">
                  <i className="fa fa-building opacity-70" />
                  <span className="truncate">{d.clinic_name || 'HealthTrack+ Center'}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto w-full grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => openModal(d, 'info')}
                    className="py-2.5 px-3 rounded-xl font-semibold text-sm bg-soft-slate text-text-primary border border-border-light hover:border-deep-teal hover:text-deep-teal transition-colors"
                  >
                    View Info
                  </button>
                  <button 
                    onClick={() => openModal(d, 'book')}
                    className="py-2.5 px-3 rounded-xl font-semibold text-sm text-white bg-deep-teal shadow hover:bg-teal-700 transition-colors"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center text-center bg-white rounded-2xl border border-border-light border-dashed">
            <div className="text-5xl mb-4 opacity-50">👩‍⚕️</div>
            <h3 className="text-lg font-bold text-text-primary mb-2">No doctors found</h3>
            <p className="text-warm-gray">We couldn't find any doctors matching "{searchTerm}".</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 text-deep-teal font-semibold hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* ── Unified Overlay Modal ── */}
      {modalMode && activeDoctor && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm animate-fadeIn"
          onClick={closeModal}
        >
          
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md md:max-w-xl overflow-hidden animate-zoomIn border border-border-light relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="bg-soft-slate px-6 py-4 flex items-center justify-between border-b border-border-light sticky top-0 z-10">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {modalMode === 'book' ? '📅 Schedule Appointment' : 'ℹ️ Doctor Profile'}
              </h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-border-light text-warm-gray hover:text-danger transition-colors"
              >
                <i className="fa fa-times text-lg" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 md:p-8 overflow-y-auto">
              
              {/* Doctor Mini Profile (Shared) */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border-light">
                <img
                  src={activeDoctor.profile_img ? `${BACKEND_URL}/static/uploads/${activeDoctor.profile_img}` : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'}
                  alt={activeDoctor.name}
                  className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-border-light"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'; }}
                />
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Dr. {activeDoctor.name}</h3>
                  <p className="text-deep-teal font-semibold text-sm">{activeDoctor.specialization}</p>
                  <p className="text-warm-gray text-sm mt-0.5">{activeDoctor.experience} Years Exp.</p>
                </div>
              </div>

              {/* MODE: INFO */}
              {modalMode === 'info' && (
                <div className="space-y-4">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h4 className="font-bold text-text-primary mb-2 text-sm uppercase tracking-wider">About</h4>
                    <p className="text-text-primary text-sm leading-relaxed whitespace-pre-line">
                      {activeDoctor.bio || 'This doctor has not provided a bio.'}
                    </p>
                  </div>
                  
                  {/* Reviews Section */}
                  <div className="bg-soft-slate/40 p-4 rounded-xl border border-border-light mt-4">
                    <h4 className="font-bold text-text-primary mb-3 text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <span>⭐</span> Patient Reviews ({reviews.length})
                    </h4>
                    {reviewsLoading ? (
                      <p className="text-warm-gray text-xs animate-pulse">Loading reviews...</p>
                    ) : reviews.length > 0 ? (
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {reviews.map((r) => (
                          <div key={r.review_id} className="p-3 bg-white rounded-lg border border-border-light shadow-sm text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-text-primary">{r.patient_name || 'Patient'}</span>
                              <span className="text-amber-500 font-bold">
                                {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                              </span>
                            </div>
                            <p className="text-warm-gray italic leading-relaxed">
                              "{r.review_text || 'No comment left.'}"
                            </p>
                            <span className="text-[10px] text-warm-gray/60 block mt-1">
                              Reviewed on {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-warm-gray text-xs italic">No reviews yet for this doctor.</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-soft-slate rounded-xl border border-border-light">
                      <p className="text-xs font-bold text-warm-gray uppercase tracking-wider mb-1">Clinic</p>
                      <p className="text-sm font-semibold text-text-primary">{activeDoctor.clinic_name || 'N/A'}</p>
                      <p className="text-xs text-warm-gray mt-1">{activeDoctor.address || ''}</p>
                    </div>
                    <div className="p-4 bg-soft-slate rounded-xl border border-border-light">
                      <p className="text-xs font-bold text-warm-gray uppercase tracking-wider mb-1">Consultation Fee</p>
                      <p className="text-lg font-bold text-deep-teal">
                        ${activeDoctor.fee || '150'}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setModalMode('book')}
                    className="w-full mt-6 py-3 bg-deep-teal text-white rounded-xl font-bold shadow-sm hover:bg-teal-700 transition"
                  >
                    Proceed to Booking
                  </button>
                </div>
              )}

              {/* MODE: BOOKING */}
              {modalMode === 'book' && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Doctor Availability Slots display */}
                  <div className="bg-teal-50/45 p-4 rounded-xl border border-teal-100/50">
                    <h4 className="font-bold text-deep-teal mb-2 text-xs uppercase tracking-wider">🏥 Weekly Schedule / Available Hours</h4>
                    {availabilityLoading ? (
                      <p className="text-warm-gray text-xs animate-pulse">Loading availability schedule...</p>
                    ) : doctorAvailability.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {groupAvailabilitySlots(doctorAvailability).map((g, i) => (
                          <span 
                            key={i}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-deep-teal border border-teal-100"
                          >
                            {g.daysLabel}: {g.timeLabel}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-warm-gray text-xs">This doctor hasn't set any specific availability hours yet.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-text-primary mb-1.5">Date</label>
                      <input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleFormChange} 
                        required 
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2.5 rounded-xl border border-border-light focus:border-deep-teal focus:ring-1 focus:ring-deep-teal outline-none transition text-sm text-text-primary bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-text-primary mb-1.5">Time</label>
                      <input 
                        type="time" 
                        name="time" 
                        value={formData.time} 
                        onChange={handleFormChange} 
                        required 
                        className="w-full px-4 py-2.5 rounded-xl border border-border-light focus:border-deep-teal focus:ring-1 focus:ring-deep-teal outline-none transition text-sm text-text-primary bg-white"
                      />
                    </div>
                  </div>

                  {formData.date && formData.time && doctorAvailability.length > 0 && !isTimeSlotValid && (
                    <div className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5 animate-fadeIn">
                      ⚠️ Selected time falls outside the doctor's weekly available slots ({getDayName(formData.date)}).
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1.5">Reason for Visit / Symptoms</label>
                    <textarea
                      name="symptoms"
                      rows="3"
                      placeholder="Please briefly describe your symptoms or reason for consulting..."
                      value={formData.symptoms}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-border-light focus:border-deep-teal focus:ring-1 focus:ring-deep-teal outline-none transition text-sm text-text-primary bg-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1.5">Optional File / Report</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        name="report" 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        onChange={handleFormChange}
                        className="w-full px-4 py-2 text-sm text-warm-gray file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-teal-50 file:text-deep-teal hover:file:bg-teal-100 transition cursor-pointer border border-border-light border-dashed rounded-xl bg-soft-slate/50"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border-light flex gap-3">
                    <button 
                      type="button" 
                      onClick={closeModal}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-text-primary bg-soft-slate hover:bg-border-light transition border border-border-light"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-deep-teal hover:bg-teal-700 transition shadow flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <><i className="fa fa-circle-notch fa-spin" /> Booking...</>
                      ) : (
                        <><i className="fa fa-calendar-check" /> Confirm Appointment</>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BookAppointment;