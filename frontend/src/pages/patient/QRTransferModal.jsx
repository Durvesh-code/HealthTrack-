import { useEffect, useState, useRef } from 'react';
import api from '../../config/api';

/**
 * QRTransferModal
 * Fetches a short-lived transfer token and renders it as a QR code.
 * The patient shows this QR to the new pharmacy. The pharmacist scans it
 * and the new store gains access (old store is auto-cancelled by backend).
 *
 * Props:
 *  - prescriptionId: string
 *  - onClose(): close the modal
 *  - onTransferred(): called when transfer succeeds (refreshes parent)
 */
const QRTransferModal = ({ prescriptionId, onClose, onTransferred }) => {
  const [token, setToken] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await api.get(`/api/patient/prescription/${prescriptionId}/qr`);
        const { token: t, expires_in } = res.data;
        setToken(t);
        setExpiresIn(expires_in);
        setCountdown(expires_in);
        // Generate QR using a free public API (no JS lib needed)
        const encoded = encodeURIComponent(t);
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to generate QR code.');
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [prescriptionId]);

  // Countdown timer
  useEffect(() => {
    if (!countdown) return;
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [countdown]);

  const mins = countdown ? Math.floor(countdown / 60) : 0;
  const secs = countdown ? countdown % 60 : 0;
  const isExpired = countdown === 0;

  const copyToken = () => {
    if (token) navigator.clipboard.writeText(token);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-light">
          <div>
            <h2 className="text-xl font-bold text-text-primary">📱 Transfer via QR</h2>
            <p className="text-xs text-warm-gray mt-0.5">Show this code to the new pharmacy</p>
          </div>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-text-primary w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6 text-center">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-10 h-10 rounded-full border-4 border-deep-teal border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm py-6">{error}</p>
          ) : isExpired ? (
            <div className="py-6">
              <p className="text-red-500 font-bold text-lg mb-2">QR Code Expired</p>
              <p className="text-warm-gray text-sm">Reload this modal to get a fresh code.</p>
            </div>
          ) : (
            <>
              {/* QR Image */}
              <div className="inline-block p-3 border-2 border-border-light rounded-xl shadow-sm mb-4">
                <img
                  src={qrUrl}
                  alt="Transfer QR Code"
                  className="w-48 h-48 rounded"
                />
              </div>

              {/* Countdown */}
              <div className={`text-lg font-bold mb-4 ${countdown <= 60 ? 'text-red-500' : 'text-amber-600'}`}>
                ⏱ Expires in {mins}:{secs.toString().padStart(2, '0')}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm text-blue-800 mb-4">
                <p className="font-semibold mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to the new pharmacy store</li>
                  <li>Ask the pharmacist to scan this QR code</li>
                  <li>The old pharmacy will lose access automatically</li>
                  <li>The new pharmacy will see your prescription immediately</li>
                </ol>
              </div>

              {/* Copy token as fallback */}
              <button
                id="btn-copy-transfer-token"
                onClick={copyToken}
                className="w-full py-2 border border-border-light rounded-lg text-sm text-warm-gray hover:text-deep-teal hover:border-deep-teal transition font-medium"
              >
                📋 Copy token (manual entry fallback)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRTransferModal;
