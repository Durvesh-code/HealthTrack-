import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import api from '../../config/api';
import { useToast } from '../../hooks/useToast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const ViewAppointment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const showToast = (msg, type = 'info') => {
    if (toast[type]) toast[type](msg);
    else toast.info(msg);
  };
  
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [medicines, setMedicines] = useState([{ medicine: '', dosage: '', notes: '', quantity: 1 }]);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [medSuggestions, setMedSuggestions] = useState([]);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch Appointment Details
      const apptRes = await api.get(`/api/doctor/appointment/${id}`);
      const apptData = apptRes.data?.appointment || null;
      setAppointment(apptData);

      // 2. If we have a patient_id, fetch full Patient Profile & History
      if (apptData && apptData.patient_id) {
        const patRes = await api.get(`/api/doctor/patient/${apptData.patient_id}`);
        setPatient(patRes.data?.patient || null);
        setHistory(patRes.data?.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch appointment data:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    // Load accepted pharmacies for this doctor
    api.get('/api/doctor/collaboration/pharmacies')
      .then(r => {
        const stores = r.data.pharmacies || [];
        setPharmacies(stores);
        if (stores.length === 1) setSelectedPharmacy(String(stores[0].pharmacy_id));
      })
      .catch(() => {});
  }, [fetchData]);

  // --- Handlers ---
  const handleComplete = async () => {
    try {
      await api.post(`/api/doctor/appointment/${id}/complete`);
      showToast('Appointment marked as complete.', 'success');
      fetchData();
    } catch {
      showToast(t('common.error') || 'Failed to mark as complete. Try again.', 'error');
    }
  };

  const handleMedChange = (index, field, value) => {
    const updatedMeds = [...medicines];
    updatedMeds[index][field] = value;
    setMedicines(updatedMeds);

    // Autocomplete: when medicine name field changes, search store inventory
    if (field === 'medicine' && selectedPharmacy && value.length >= 2) {
      api.get(`/api/doctor/medicine-suggest?pharmacy_id=${selectedPharmacy}&q=${encodeURIComponent(value)}`)
        .then(r => {
          setMedSuggestions(r.data.medicines || []);
          setActiveSuggestIdx(index);
        })
        .catch(() => setMedSuggestions([]));
    } else if (field === 'medicine') {
      setMedSuggestions([]);
      setActiveSuggestIdx(null);
    }
  };

  const pickSuggestion = (index, item) => {
    const updatedMeds = [...medicines];
    updatedMeds[index].medicine   = item.name;
    updatedMeds[index].medicine_id = item.inventory_id || item.medicine_id || null;
    setMedicines(updatedMeds);
    setMedSuggestions([]);
    setActiveSuggestIdx(null);
  };

  const addRow = () => {
    setMedicines([...medicines, { medicine: '', dosage: '', notes: '', quantity: 1 }]);
  };

  const removeRow = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const submitPrescription = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/doctor/appointment/${id}/prescription`, {
        medicines: medicines.map(m => ({
          medicine:    m.medicine,
          medicine_id: m.medicine_id || null,
          dosage:      m.dosage,
          notes:       m.notes,
          quantity:    m.quantity || 1,
        })),
        pharmacy_id: selectedPharmacy ? parseInt(selectedPharmacy) : null,
      });
      showToast(t('common.success') || 'Prescription saved!', 'success');
      handleComplete();
    } catch (error) {
      showToast(error.response?.data?.message || t('common.error') || 'Could not save prescription.', 'error');
    }
  };

  // --- Helper for Secure Report URLs ---
  const handleReportAction = async (path, action = 'view') => {
    if (!path) return;
    try {
      // Extract filename from legacy paths if necessary
      const filename = path.split('/').pop().split('\\').pop();
      const response = await api.get(`/api/uploads/${filename}`, { responseType: 'blob' });
      
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
      
      if (action === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        window.open(blobUrl, '_blank');
      }
      
      // Cleanup object URL after a short delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      showToast('Failed to retrieve medical report. It may have been deleted or you lack permission.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deep-teal"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-7 text-center">
        <h2 className="text-2xl font-bold text-dark mb-4">Appointment not found.</h2>
        <Link to="/doctor/dashboard" className="text-deep-teal hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const profileImg = patient?.profile_img || appointment?.profile_img;
  const avatarUrl = profileImg 
    ? `${BACKEND_URL}/static/uploads/${profileImg}` 
    : 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png';

  return (
    <div className="p-7 max-w-5xl mx-auto animate-fadeInUp space-y-6">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-border-light">
        <div>
          <h1 className="text-2xl font-bold text-dark mb-1">Appointment Details</h1>
          <p className="text-warm-gray">
            Patient: <strong className="text-dark">{patient?.name || appointment.patient_name}</strong> — ID: <strong>{patient?.patient_id || appointment.patient_id}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-soft-slate text-dark font-medium rounded-lg hover:bg-gray-200 transition">
            ← {t('common.back')}
          </button>
          {appointment.status !== 'Completed' && (
            <button onClick={handleComplete} className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition shadow-sm">
              Mark Complete ✅
            </button>
          )}
        </div>
      </header>

      {/* Patient Profile Card */}
      <section className="bg-white rounded-xl shadow-sm border border-border-light p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0 flex justify-center">
          <img 
            className="w-32 h-32 rounded-xl object-cover border-4 border-soft-slate shadow-sm" 
            src={avatarUrl} 
            alt="Patient" 
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png'; }}
          />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-dark mb-4">{patient?.name || appointment.patient_name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4 text-sm">
            <div><b className="text-warm-gray font-medium">ID:</b> {patient?.patient_id || appointment.patient_id}</div>
            <div><b className="text-warm-gray font-medium">{t('common.email')}:</b> {patient?.email || '—'}</div>
            <div><b className="text-warm-gray font-medium">{t('common.contact')}:</b> {patient?.contact || '—'}</div>
            <div><b className="text-warm-gray font-medium">Gender:</b> {patient?.gender || '—'}</div>
            <div><b className="text-warm-gray font-medium">Age:</b> {patient?.age || '—'}</div>
            <div><b className="text-warm-gray font-medium">Blood Group:</b> {patient?.blood_group || '—'}</div>
            <div><b className="text-warm-gray font-medium">Allergy:</b> {patient?.allergy || 'None'}</div>
            <div><b className="text-warm-gray font-medium">Emergency:</b> {patient?.emergency_contact || '—'}</div>
            <div><b className="text-warm-gray font-medium">Height:</b> {patient?.height_cm || '—'} cm</div>
            <div><b className="text-warm-gray font-medium">Weight:</b> {patient?.weight_kg || '—'} kg</div>
          </div>
        </div>
      </section>

      {/* Current Appointment Report */}
      <section className="bg-white rounded-xl shadow-sm border border-border-light p-6">
        <h3 className="text-lg font-bold text-dark mb-4">Current Appointment — Uploaded Report</h3>
        {appointment.report_path ? (
          <div className="flex items-center gap-4 p-4 bg-soft-slate rounded-lg border border-gray-200">
            <i className="fa fa-file-medical text-3xl text-accent-blue"></i>
            <div className="flex-1">
              <p className="font-medium text-dark">Medical Report Available</p>
              <p className="text-sm text-warm-gray">Uploaded by patient</p>
            </div>
            <button 
              onClick={() => handleReportAction(appointment.report_path, 'view')}
              className="px-4 py-2 bg-white text-deep-teal border border-deep-teal rounded-lg font-medium hover:bg-deep-teal hover:text-white transition"
            >
              📄 {t('common.view')}
            </button>
            <button 
              onClick={() => handleReportAction(appointment.report_path, 'download')}
              className="px-4 py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-600 transition"
            >
              ⬇ Download
            </button>
          </div>
        ) : (
          <p className="text-warm-gray italic">No report uploaded for this appointment.</p>
        )}
      </section>

      {/* Prescription Form (Only show if not completed) */}
      {appointment.status !== 'Completed' && (
        <section className="bg-white rounded-xl shadow-sm border border-border-light p-6 border-t-4 border-t-deep-teal">
          <h3 className="text-lg font-bold text-dark mb-4">📝 Create Prescription</h3>

          {/* Pharmacy Selector */}
          <div className="mb-5 p-4 rounded-xl border border-border-light bg-soft-slate">
            <label className="block text-sm font-bold text-dark mb-2">
              🏥 Select Pharmacy Store
              <span className="ml-1 text-warm-gray font-normal text-xs">(only your accepted collaborations)</span>
            </label>
            {pharmacies.length === 0 ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-600">⚠️</span>
                <p className="text-sm text-amber-700 font-medium">
                  No accepted pharmacy collaborations yet.
                  <a href="/doctor/collaborations" className="ml-1 underline text-deep-teal">View collaboration requests</a>
                </p>
              </div>
            ) : (
              <select
                id="prescription-pharmacy-select"
                value={selectedPharmacy}
                onChange={e => setSelectedPharmacy(e.target.value)}
                className="w-full p-2.5 border border-border-light rounded-lg text-sm bg-white focus:ring-2 focus:ring-deep-teal/30 outline-none"
              >
                <option value="">— Select a pharmacy (optional) —</option>
                {pharmacies.map(ph => (
                  <option key={ph.pharmacy_id} value={ph.pharmacy_id}>
                    {ph.store_name} {ph.address ? `• ${ph.address}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form onSubmit={submitPrescription}>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-light text-warm-gray">
                    <th className="py-2 pr-2 font-medium">Medicine</th>
                    <th className="py-2 px-2 font-medium w-8">Qty</th>
                    <th className="py-2 px-2 font-medium">Dosage / Schedule</th>
                    <th className="py-2 px-2 font-medium">Notes</th>
                    <th className="py-2 pl-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((row, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 relative">
                        <input
                          type="text"
                          value={row.medicine}
                          onChange={(e) => handleMedChange(index, 'medicine', e.target.value)}
                          placeholder={selectedPharmacy ? 'Type to search store medicines...' : 'e.g. Paracetamol 500mg'}
                          className="w-full p-2 border border-border-light rounded focus:ring-2 focus:ring-deep-teal/30 outline-none text-sm"
                          required
                        />
                        {/* Autocomplete dropdown */}
                        {activeSuggestIdx === index && medSuggestions.length > 0 && (
                          <ul className="absolute z-20 left-0 right-0 bg-white border border-border-light rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {medSuggestions.map((s, si) => (
                              <li
                                key={si}
                                onClick={() => pickSuggestion(index, s)}
                                className="px-3 py-2 hover:bg-teal-50 cursor-pointer text-sm flex items-center justify-between"
                              >
                                <span className="font-medium">{s.name}</span>
                                <span className={`text-xs font-semibold ${s.in_stock ? 'text-green-600' : 'text-red-500'}`}>
                                  {s.in_stock ? `✓ ${s.stock_quantity} in stock` : '✗ Out of stock'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2 px-2 w-16">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity || 1}
                          onChange={(e) => handleMedChange(index, 'quantity', e.target.value)}
                          className="w-full p-2 border border-border-light rounded focus:ring-2 focus:ring-deep-teal/30 outline-none text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input 
                          type="text" 
                          value={row.dosage} 
                          onChange={(e) => handleMedChange(index, 'dosage', e.target.value)}
                          placeholder="e.g. 1 tablet twice a day" 
                          className="w-full p-2 border border-border-light rounded focus:ring-2 focus:ring-deep-teal/30 outline-none text-sm"
                          required 
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input 
                          type="text" 
                          value={row.notes} 
                          onChange={(e) => handleMedChange(index, 'notes', e.target.value)}
                          placeholder="Optional notes" 
                          className="w-full p-2 border border-border-light rounded focus:ring-2 focus:ring-deep-teal/30 outline-none text-sm"
                        />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        {medicines.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeRow(index)} 
                            className="w-8 h-8 rounded bg-red-100 text-red-600 hover:bg-red-200 transition font-bold"
                            title="Remove row"
                          >
                            −
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border-light">
              <button 
                type="button" 
                onClick={addRow} 
                className="px-4 py-2 bg-soft-slate text-dark font-medium rounded hover:bg-gray-200 transition w-full sm:w-auto"
              >
                + Add medicine
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 bg-deep-teal text-white font-bold rounded shadow hover:bg-deep-teal-dark transition w-full sm:w-auto"
              >
                Submit Prescription
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Appointment History */}
      <section className="bg-white rounded-xl shadow-sm border border-border-light p-6 overflow-hidden">
        <h3 className="text-lg font-bold text-dark mb-4">Appointment History</h3>
        {history.filter(ap => ap.status !== 'Pending').length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-soft-slate text-dark border-b border-border-light">
                  <th className="py-3 px-4 font-semibold">{t('common.date')}</th>
                  <th className="py-3 px-4 font-semibold">{t('patient.symptoms')}</th>
                  <th className="py-3 px-4 font-semibold">{t('common.status')}</th>
                  <th className="py-3 px-4 font-semibold">Prescription</th>
                  <th className="py-3 px-4 font-semibold">Report</th>
                </tr>
              </thead>
              <tbody>
                {history.filter(ap => ap.status !== 'Pending').map((ap) => (
                  <tr key={ap.appointment_id} className="border-b border-border-light hover:bg-gray-50 transition">
                    <td className="py-3 px-4 text-sm">{ap.appointment_datetime}</td>
                    <td className="py-3 px-4 text-sm text-warm-gray max-w-xs truncate" title={ap.symptoms}>{ap.symptoms || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${ap.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {ap.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {ap.status === 'Completed' ? (
                        <a 
                          href={`${BACKEND_URL}/patient/prescription/download/${ap.appointment_id}`} 
                          className="text-deep-teal hover:underline text-sm font-medium"
                        >
                          📄 {t('common.view')}
                        </a>
                      ) : (
                        <span className="text-warm-gray">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ap.report_path ? (
                        <button 
                          onClick={() => handleReportAction(ap.report_path, 'view')}
                          className="text-accent-blue hover:underline text-sm font-medium"
                        >
                          📁 Report
                        </button>
                      ) : (
                        <span className="text-warm-gray">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-warm-gray italic">No previous appointments found for this patient.</p>
        )}
      </section>

    </div>
  );
};

export default ViewAppointment;