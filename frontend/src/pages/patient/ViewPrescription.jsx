import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import SelectPharmacyModal from './SelectPharmacyModal';
import QRTransferModal from './QRTransferModal';

// Status badge styling
const statusBadge = (status) => {
  const map = {
    Created:     'bg-gray-100 text-gray-600 border-gray-200',
    Sent:        'bg-blue-50 text-blue-700 border-blue-200',
    Dispensed:   'bg-green-50 text-green-700 border-green-200',
    Expired:     'bg-red-50 text-red-600 border-red-200',
    Cancelled:   'bg-yellow-50 text-yellow-700 border-yellow-200',
    Transferred: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return `px-3 py-1 rounded-full text-xs font-bold border ${map[status] || 'bg-gray-100 text-gray-600'}`;
};

const PatientViewPrescription = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSelectPharmacy, setShowSelectPharmacy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const fetchPrescription = useCallback(async () => {
    try {
      const res = await api.get(`/api/patient/prescription/${id}`);
      setPrescription(res.data.prescription);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load prescription');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPrescription(); }, [fetchPrescription]);

  const onPharmacySelected = async (pharmacy_id, isChange = false) => {
    try {
      const endpoint = isChange
        ? `/api/patient/prescription/${id}/change-pharmacy`
        : `/api/patient/prescription/${id}/select-pharmacy`;
      await api.post(endpoint, { pharmacy_id });
      setActionMsg('✅ Pharmacy selected successfully!');
      setShowSelectPharmacy(false);
      fetchPrescription(); // refresh to show new status
    } catch (err) {
      setActionMsg(`❌ ${err.response?.data?.message || 'Failed to update pharmacy.'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
        <p className="text-warm-gray">Loading prescription details...</p>
      </div>
    );
  }

  if (error || !prescription || prescription.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fadeInUp">
        <div className="text-6xl mb-4">📄</div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Prescription Not Found</h2>
        <p className="text-warm-gray mb-6">{error || 'No prescription data found for this appointment.'}</p>
        <button
          onClick={() => navigate('/patient/dashboard')}
          className="px-6 py-2.5 bg-deep-teal text-white rounded-xl font-semibold shadow-sm hover:bg-teal-700 transition"
        >
          &larr; Back to Dashboard
        </button>
      </div>
    );
  }

  const record  = prescription[0];
  const status  = record.dispense_status || 'Created';
  const dateStr = record.date_issued
    ? new Date(record.date_issued).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN');

  const canSelectPharmacy = status === 'Created';
  const canChangePharmacy = ['Sent', 'Cancelled', 'Transferred'].includes(status);
  const canTransferViaQR  = status === 'Sent';
  const isExpired         = status === 'Expired';
  const isDispensed       = status === 'Dispensed';

  // Expiry countdown
  let expiryLabel = null;
  if (status === 'Sent' && record.reserved_until) {
    const remaining = new Date(record.reserved_until) - new Date();
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000);
      expiryLabel = `⏱ Expires in ${mins} min`;
    } else {
      expiryLabel = '⏰ Expired';
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fadeInUp">

      {/* Action Message */}
      {actionMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl border bg-blue-50 border-blue-200 text-blue-800 text-sm font-medium flex items-center justify-between">
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="text-blue-400 hover:text-blue-700 ml-4">&times;</button>
        </div>
      )}

      {/* ── Actions Bar ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button
          onClick={() => navigate('/patient/dashboard')}
          className="flex items-center gap-2 text-warm-gray hover:text-deep-teal transition font-semibold"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pharmacy action buttons */}
          {canSelectPharmacy && (
            <button
              onClick={() => setShowSelectPharmacy(true)}
              id="btn-select-pharmacy"
              className="px-4 py-2 bg-deep-teal text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-sm"
            >
              🏥 Select Pharmacy
            </button>
          )}
          {canChangePharmacy && (
            <button
              onClick={() => setShowSelectPharmacy(true)}
              id="btn-change-pharmacy"
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition shadow-sm"
            >
              🔄 Change Pharmacy
            </button>
          )}
          {canTransferViaQR && (
            <button
              onClick={() => setShowQR(true)}
              id="btn-qr-transfer"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition shadow-sm"
            >
              📱 Transfer via QR
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-soft-slate border border-border-light rounded-lg text-sm font-bold text-text-primary hover:border-deep-teal transition"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* ── Pharmacy Status Card ── */}
      <div className="mb-6 p-4 bg-soft-slate rounded-xl border border-border-light flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-warm-gray mb-1">Pharmacy</p>
          <p className="font-semibold text-text-primary">
            {record.pharmacy_name || <span className="text-warm-gray italic">Not selected yet</span>}
          </p>
          {record.pharmacy_address && (
            <p className="text-xs text-warm-gray mt-0.5">{record.pharmacy_address}</p>
          )}
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <span id={`status-badge-${id}`} className={statusBadge(status)}>{status}</span>
          {expiryLabel && (
            <span className={`text-xs font-semibold ${isExpired ? 'text-red-500' : 'text-amber-600'}`}>
              {expiryLabel}
            </span>
          )}
        </div>
      </div>

      {/* Expired / Dispensed notice */}
      {isExpired && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
          ⏰ This prescription has <strong>expired</strong> and can no longer be dispensed. Please consult your doctor for a new prescription.
        </div>
      )}
      {isDispensed && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-semibold">
          ✅ This prescription has been <strong>dispensed</strong> by {record.pharmacy_name || 'the pharmacy'}.
        </div>
      )}

      {/* ── Prescription Paper Sheet ── */}
      <div className="bg-white rounded-2xl border border-border-light shadow-md overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
        <div className="bg-gradient-to-r from-[#0f6b6b] to-[#2b9af3] h-3 w-full" />
        <div className="p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-border-light pb-6 mb-6 gap-6">
            <div>
              <h1 className="text-3xl font-heading font-black text-text-primary mb-1">HEALTHTRACK+ HEALTHCARE</h1>
              <p className="text-warm-gray text-sm">Advanced Digital Health Services &amp; Diagnostics</p>
            </div>
            <div className="md:text-right">
              <h2 className="text-xl font-bold text-text-primary">Dr. {record.doctor_name || 'Generic Physician'}</h2>
              <p className="text-warm-gray text-sm mb-1">{record.doctor_specialization || 'General Practice'}</p>
              <p className="text-xs text-warm-gray inline-block px-2 py-1 bg-soft-slate rounded border border-border-light">Reg: MH-2025-MED</p>
            </div>
          </div>

          <div className="bg-soft-slate border border-border-light rounded-xl p-5 mb-8 flex flex-col md:flex-row gap-6 md:gap-12">
            <div className="flex-1">
              <p className="text-xs font-bold text-warm-gray mb-1 uppercase tracking-wider">Patient Name</p>
              <p className="text-lg font-bold text-text-primary">{record.patient_name || '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-warm-gray mb-1 uppercase tracking-wider">Age / Gender</p>
              <p className="font-semibold text-text-primary">{record.patient_age || '—'} / {record.patient_gender || '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-warm-gray mb-1 uppercase tracking-wider">Date Issued</p>
              <p className="font-semibold text-text-primary">{dateStr}</p>
            </div>
          </div>

          <div className="text-5xl font-serif italic text-deep-teal opacity-90 mb-6">Rx</div>

          {prescription[0].medicine_name ? (
            <div className="overflow-x-auto mb-10 border border-border-light rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8fafc] border-b border-border-light">
                  <tr>
                    <th className="py-3 px-4 font-bold text-sm text-text-primary w-1/3">Medicine</th>
                    <th className="py-3 px-4 font-bold text-sm text-text-primary">Qty</th>
                    <th className="py-3 px-4 font-bold text-sm text-text-primary w-1/4">Dosage</th>
                    <th className="py-3 px-4 font-bold text-sm text-text-primary">Instructions</th>
                    <th className="py-3 px-4 font-bold text-sm text-text-primary">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light/50">
                  {prescription.map((item, idx) => (
                    <tr key={idx} className="hover:bg-soft-slate/50 transition">
                      <td className="py-4 px-4 font-semibold text-text-primary">{item.medicine_name}</td>
                      <td className="py-4 px-4 text-warm-gray">{item.quantity || 1}</td>
                      <td className="py-4 px-4 text-warm-gray font-medium">{item.dosage}</td>
                      <td className="py-4 px-4 text-warm-gray text-sm">{item.notes || '—'}</td>
                      <td className="py-4 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.item_source === 'StoreSuggestion' ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.item_source === 'StoreSuggestion' ? '🏥 Store' : '✏️ Manual'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center bg-soft-slate rounded-xl border border-dashed border-border-light mb-10">
              <p className="text-warm-gray italic">No specific medications prescribed during this visit.</p>
            </div>
          )}

          <div className="border-t border-border-light pt-6 mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-xs text-warm-gray max-w-sm text-center md:text-left">
              <p>This document is digitally generated and is valid for medical purposes.</p>
              <p className="mt-1">HealthTrack+ Healthcare | Emergency: 108</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b-2 border-dashed border-warm-gray pb-8 w-full mb-2"></div>
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider">Doctor's Signature</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSelectPharmacy && (
        <SelectPharmacyModal
          prescriptionId={id}
          isChange={!canSelectPharmacy}
          onSelect={onPharmacySelected}
          onClose={() => setShowSelectPharmacy(false)}
        />
      )}
      {showQR && (
        <QRTransferModal
          prescriptionId={id}
          onClose={() => setShowQR(false)}
          onTransferred={() => { setShowQR(false); fetchPrescription(); }}
        />
      )}
    </div>
  );
};

export default PatientViewPrescription;
