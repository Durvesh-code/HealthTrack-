import { useEffect, useState } from 'react';
import api from '../../config/api';

/**
 * SelectPharmacyModal
 * Shows a list of pharmacy stores for the patient to choose from.
 * Props:
 *  - prescriptionId: string
 *  - isChange: bool  (true = "Change Pharmacy" flow)
 *  - onSelect(pharmacy_id, isChange): called with selected store
 *  - onClose(): close the modal
 */
const SelectPharmacyModal = ({ prescriptionId, isChange, onSelect, onClose }) => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'collaborator' | 'all'
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/api/pharmacy/stores?type=${filter}`);
        setStores(res.data.stores || []);
      } catch (err) {
        setError('Failed to load pharmacy stores.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  const handleSelect = async (pharmacy_id) => {
    setSelecting(pharmacy_id);
    await onSelect(pharmacy_id, isChange);
    setSelecting(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-light">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {isChange ? '🔄 Change Pharmacy' : '🏥 Select Pharmacy'}
            </h2>
            <p className="text-xs text-warm-gray mt-0.5">Only one pharmacy can be active at a time</p>
          </div>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-text-primary w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-xl"
          >
            &times;
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => setFilter('collaborator')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
              filter === 'collaborator'
                ? 'bg-deep-teal text-white border-deep-teal'
                : 'bg-white text-warm-gray border-border-light hover:border-deep-teal'
            }`}
          >
            ⭐ Collaborator
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
              filter === 'all'
                ? 'bg-deep-teal text-white border-deep-teal'
                : 'bg-white text-warm-gray border-border-light hover:border-deep-teal'
            }`}
          >
            🗂 All Stores
          </button>
        </div>

        {/* Store List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm py-4 text-center">{error}</p>
          ) : stores.length === 0 ? (
            <p className="text-warm-gray text-sm py-4 text-center italic">No stores available.</p>
          ) : (
            stores.map((store) => (
              <div
                key={store.pharmacy_id}
                className="flex items-center justify-between p-4 rounded-xl border border-border-light hover:border-deep-teal hover:bg-teal-50/30 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary truncate">{store.store_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      store.store_type === 'Collaborator'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {store.store_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      store.status === 'Active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {store.status}
                    </span>
                  </div>
                  {store.address && (
                    <p className="text-xs text-warm-gray mt-1 truncate">{store.address}</p>
                  )}
                  {store.contact && (
                    <p className="text-xs text-warm-gray">{store.contact}</p>
                  )}
                </div>
                <button
                  id={`select-store-${store.pharmacy_id}`}
                  onClick={() => handleSelect(store.pharmacy_id)}
                  disabled={selecting === store.pharmacy_id || store.status !== 'Active'}
                  className="ml-3 px-4 py-2 bg-deep-teal text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {selecting === store.pharmacy_id ? '...' : 'Select'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectPharmacyModal;
