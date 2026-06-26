import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import api from '../../config/api';

const ViewPatient = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchPatient = useCallback(async () => {
    try {
      const response = await api.get(`/api/doctor/patient/${id}`);
      setPatient(response.data?.patient || null);
      setHistory(response.data?.history || []);
    } catch {
      setPatient(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  if (loading) {
    return (
      <div className="p-7">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-7">
      <h2 className="text-2xl font-bold mb-4">Patient Details</h2>
      {patient ? (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-border-light mb-6">
          <p>
            <b>{t('common.name')}:</b> {patient.name || '-'}
          </p>
          <p>
            <b>{t('common.email')}:</b> {patient.email || '-'}
          </p>
          <p>
            <b>{t('common.contact')}:</b> {patient.contact || '-'}
          </p>
          <p>
            <b>Gender:</b> {patient.gender || '-'}
          </p>
          <p>
            <b>Age:</b> {patient.age || '-'}
          </p>
        </div>
      ) : (
        <p className="text-warm-gray mb-6">Patient not found.</p>
      )}

      <h3 className="text-xl font-semibold mb-3">Appointment History</h3>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-border-light">
        {history.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">{t('common.date')}</th>
                <th className="text-left py-2">{t('patient.symptoms')}</th>
                <th className="text-left py-2">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.appointment_id}>
                  <td className="py-2">{item.appointment_datetime || '-'}</td>
                  <td className="py-2">{item.symptoms || '-'}</td>
                  <td className="py-2">{item.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-warm-gray">No history available.</p>
        )}
      </div>
    </div>
  );
};

export default ViewPatient;