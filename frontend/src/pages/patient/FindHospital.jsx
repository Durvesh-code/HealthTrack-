import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from '@react-google-maps/api';
import api from '../../config/api';
import '../../styles/find_hospital.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const MAIN_MAP_STYLE = { width: '100%', height: '100%' };
const MINI_MAP_STYLE = { width: '100%', height: '100%' };
const MODAL_MAP_STYLE = { width: '100%', height: '500px' };
const ICON_BLUE = { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' };
const ICON_RED = { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' };
const MAP_LIBS = ['places'];
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 10000 };
const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  zoomControl: true,
};
const MINI_MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
};
const MODAL_MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

const HospitalMarker = memo(({ hospital, index, activeInfoWindow, setActiveInfoWindow, icon }) => {
  if (!hospital.lat || !hospital.lon) return null;

  const pos = useMemo(
    () => ({ lat: Number(hospital.lat), lng: Number(hospital.lon) }),
    [hospital.lat, hospital.lon]
  );

  return (
    <Marker position={pos} icon={icon} onClick={() => setActiveInfoWindow(index)}>
      {activeInfoWindow === index && (
        <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
          <div className="gmap-info-window">
            <strong>{hospital.name || 'Hospital'}</strong>
            <p>{hospital.address || '-'}</p>
          </div>
        </InfoWindow>
      )}
    </Marker>
  );
});
HospitalMarker.displayName = 'HospitalMarker';

const RESET_STATE = {
  openMiniMaps: {},
  activeInfoWindow: null,
  activeModalInfoWindow: null,
  activeMiniInfoWindow: {},
};

const FindHospital = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');
  const [hideAllMaps, setHideAllMaps] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [openMiniMaps, setOpenMiniMaps] = useState({});
  const [listening, setListening] = useState(false);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [activeModalInfoWindow, setActiveModalInfoWindow] = useState(null);
  const [activeMiniInfoWindow, setActiveMiniInfoWindow] = useState({});

  const recognitionRef = useRef(null);
  const mainMapRef = useRef(null);
  const modalMapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBS,
  });

  const hasResults = hospitals.length > 0;

  const resetSearchState = useCallback(() => {
    setOpenMiniMaps(RESET_STATE.openMiniMaps);
    setActiveInfoWindow(RESET_STATE.activeInfoWindow);
    setActiveModalInfoWindow(RESET_STATE.activeModalInfoWindow);
    setActiveMiniInfoWindow(RESET_STATE.activeMiniInfoWindow);
    setError('');
  }, []);

  const searchByQuery = useCallback(
    async (value) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        setError('Enter a location to search.');
        return;
      }

      setLoading(true);
      resetSearchState();

      try {
        const response = await api.post('/api/patient/hospitals', { query: trimmed });
        const next = response.data?.hospitals || [];
        setHospitals(next);

        if (next[0]?.lat && next[0]?.lon) {
          setCenter({ lat: Number(next[0].lat), lng: Number(next[0].lon) });
        }
      } catch (err) {
        setHospitals([]);
        setError(err.response?.data?.error || err.response?.data?.message || 'Search failed.');
      } finally {
        setLoading(false);
      }
    },
    [resetSearchState]
  );

  const searchByGps = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLoading(true);
    resetSearchState();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setCenter({ lat, lng: lon });

        try {
          const response = await api.post('/api/patient/hospitals', { lat, lon });
          setHospitals(response.data?.hospitals || []);
        } catch (err) {
          setHospitals([]);
          setError(err.response?.data?.error || 'Failed to fetch nearby hospitals.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Unable to get your location. Please allow location access.');
      },
      GPS_OPTIONS
    );
  }, [resetSearchState]);

  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice search is not supported in this browser.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {
        /* ignore */
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      setQuery(spoken);
      if (spoken) searchByQuery(spoken);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [searchByQuery]);

  const toggleMiniMap = useCallback((index) => {
    setOpenMiniMaps((prev) => ({ ...prev, [index]: !prev[index] }));
    setActiveMiniInfoWindow((prev) => ({ ...prev, [index]: null }));
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActiveModalInfoWindow(null);
  }, []);

  const toggleHideAllMaps = useCallback(() => setHideAllMaps((p) => !p), []);
  const openModal = useCallback(() => setModalOpen(true), []);

  const validHospitals = useMemo(() => {
    return hospitals.filter(
      (h) => Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lon))
    );
  }, [hospitals]);

  const mainMapCenter = useMemo(() => {
    if (!hasResults) return DEFAULT_CENTER;
    if (!validHospitals.length) return center;

    const avgLat =
      validHospitals.reduce((sum, h) => sum + Number(h.lat), 0) / validHospitals.length;
    const avgLng =
      validHospitals.reduce((sum, h) => sum + Number(h.lon), 0) / validHospitals.length;

    return { lat: avgLat, lng: avgLng };
  }, [hasResults, validHospitals, center]);

  const fitBoundsToHospitals = useCallback((mapInstance) => {
    if (!mapInstance || !window.google?.maps) return;
    if (!validHospitals.length) return;

    if (validHospitals.length === 1) {
      mapInstance.setCenter({
        lat: Number(validHospitals[0].lat),
        lng: Number(validHospitals[0].lon),
      });
      mapInstance.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    validHospitals.forEach((h) => {
      bounds.extend({
        lat: Number(h.lat),
        lng: Number(h.lon),
      });
    });

    mapInstance.fitBounds(bounds, 40);
  }, [validHospitals]);

  useEffect(() => {
    if (!isLoaded || !mainMapRef.current) return;

    const timer = setTimeout(() => {
      fitBoundsToHospitals(mainMapRef.current);
    }, 100);

    return () => clearTimeout(timer);
  }, [hospitals, isLoaded, fitBoundsToHospitals]);

  useEffect(() => {
    if (!modalOpen || !isLoaded || !modalMapRef.current) return;

    const timer = setTimeout(() => {
      fitBoundsToHospitals(modalMapRef.current);
      if (window.google?.maps) {
        window.google.maps.event.trigger(modalMapRef.current, 'resize');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [modalOpen, hospitals, isLoaded, fitBoundsToHospitals]);

  const resultsLabel = useMemo(() => {
    if (!hasResults) return '';
    return `${hospitals.length} hospital${hospitals.length > 1 ? 's' : ''} found`;
  }, [hospitals, hasResults]);

  if (loadError) {
    return (
      <div className="find-hospital-container">
        <div className="error-message">Failed to load Google Maps. Please check your API key.</div>
      </div>
    );
  }

  return (
    <div className="find-hospital-container">
      <div className="header">
        <h1><i className="fa-solid fa-hospital-user" /> Find Nearby Hospitals</h1>
        <p className="subtitle">Search by city, or use GPS to view nearby hospitals.</p>
      </div>

      <div className="search-section">
        <div className="search-input-container">
          <i className="fa-solid fa-location-dot search-icon" />
          <input
            type="text"
            id="location-input"
            placeholder="Enter a location or use voice search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchByQuery(query);
            }}
          />
          <button
            id="clear-input"
            className={`clear-input-btn ${query ? 'show' : ''}`}
            title="Clear"
            onClick={() => setQuery('')}
            type="button"
          >
            <i className="fa-solid fa-times" />
          </button>
        </div>

        <button id="search-btn" className="btn ram search-btn" onClick={() => searchByQuery(query)} type="button">
          <i className="fa-solid fa-magnifying-glass" /> Search
        </button>

        <button id="gps-btn" className="btn gps-btn ram2" onClick={searchByGps} type="button">
          <i className="fa-solid fa-location-crosshairs" /> Use My Location
        </button>

        <button
          id="voice-search-btn"
          className={`btn voice-btn ram3 ${listening ? 'voice-listening' : ''}`}
          title="Voice Search"
          onClick={startVoiceSearch}
          type="button"
        >
          <i className="fa-solid fa-microphone" /> {listening ? 'Listening…' : 'Voice'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className={`loading-container ${loading ? 'active' : ''}`} id="loading-container">
        <div className="loading-spinner" />
        <p>Searching for hospitals...</p>
      </div>

      <div className={`results-header ${hasResults ? 'visible' : ''}`} id="results-header">
        <div className="results-count" id="results-count">{resultsLabel}</div>
        <div className="action-buttons">
          <button
            id="toggle-all-btn"
            className="btn toggle-all-btn"
            onClick={toggleHideAllMaps}
            type="button"
          >
            <i className={`fa-solid ${hideAllMaps ? 'fa-eye' : 'fa-eye-slash'}`} />
            {hideAllMaps ? ' Show All Maps' : ' Hide All Maps'}
          </button>

          <button
            id="show-all-map-btn"
            className="btn show-all-map-btn"
            onClick={openModal}
            type="button"
            disabled={!hasResults}
          >
            <i className="fa-solid fa-map" /> Show All Hospitals
          </button>
        </div>
      </div>

      <div id="main-map-container" className="main-map-container">
        <div id="main-map" className="main-map">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAIN_MAP_STYLE}
              center={mainMapCenter}
              zoom={hasResults ? 11 : 5}
              onLoad={(map) => {
                mainMapRef.current = map;
                fitBoundsToHospitals(map);
              }}
              options={MAP_OPTIONS}
            >
              {hospitals.map((hospital, index) => (
                <HospitalMarker
                  key={`main-${index}`}
                  hospital={hospital}
                  index={index}
                  activeInfoWindow={activeInfoWindow}
                  setActiveInfoWindow={setActiveInfoWindow}
                  icon={ICON_BLUE}
                />
              ))}
            </GoogleMap>
          ) : (
            <div className="map-loading-placeholder">
              <div className="loading-spinner" />
              <p>Loading map...</p>
            </div>
          )}
        </div>
        <div className="map-overlay">
          <span>Interactive Map – click markers for details</span>
        </div>
      </div>

      <div id="results-container" className="results-section">
        {!hasResults && !loading ? (
          <div className="welcome-state">
            <i className="fa-solid fa-hospital" />
            <h3>Find Hospitals Near You</h3>
            <p>Enter a location above or use current location to find nearby hospitals.</p>
          </div>
        ) : (
          <ul>
            {hospitals.map((hospital, index) => {
              const open = !hideAllMaps && !!openMiniMaps[index];
              const hasCoords = Number.isFinite(Number(hospital.lat)) && Number.isFinite(Number(hospital.lon));
              const miniCenter = hasCoords
                ? { lat: Number(hospital.lat), lng: Number(hospital.lon) }
                : null;

              return (
                <li key={`${hospital.name || 'hospital'}-${index}`}>
                  <div className="result-info">
                    <h3>{hospital.name || 'Hospital'}</h3>
                    <p><strong>Distance:</strong> {hospital.distance ? `${Number(hospital.distance).toFixed(2)} km` : '-'}</p>
                    <p><strong>Address:</strong> {hospital.address || '-'}</p>
                    <p><strong>Phone:</strong> {hospital.phone || '-'}</p>

                    <div className="result-actions">
                      {hasCoords && (
                        <button
                          type="button"
                          className="toggle-map-btn"
                          onClick={() => toggleMiniMap(index)}
                        >
                          <i className={`fa-solid ${open ? 'fa-eye-slash' : 'fa-map-location-dot'}`} />
                          {open ? ' Hide Map' : ' Show Map'}
                        </button>
                      )}

                      <a
                        className="directions-link"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          `${hospital.lat},${hospital.lon}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <i className="fa-solid fa-route" /> Directions
                      </a>
                    </div>
                  </div>

                  <div className={`mini-map-container ${open ? '' : 'hide-map'}`}>
                    <div className="mini-map">
                      {open && isLoaded && miniCenter && (
                        <GoogleMap
                          mapContainerStyle={MINI_MAP_STYLE}
                          center={miniCenter}
                          zoom={14}
                          options={MINI_MAP_OPTIONS}
                        >
                          <Marker
                            position={miniCenter}
                            icon={ICON_RED}
                            onClick={() =>
                              setActiveMiniInfoWindow((prev) => ({
                                ...prev,
                                [index]: prev[index] === index ? null : index,
                              }))
                            }
                          >
                            {activeMiniInfoWindow[index] === index && (
                              <InfoWindow
                                onCloseClick={() =>
                                  setActiveMiniInfoWindow((prev) => ({ ...prev, [index]: null }))
                                }
                              >
                                <div className="gmap-info-window">
                                  <strong>{hospital.name || 'Hospital'}</strong>
                                  <p>{hospital.address || '-'}</p>
                                </div>
                              </InfoWindow>
                            )}
                          </Marker>
                        </GoogleMap>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div id="map-modal" className="map-modal" style={{ display: 'block' }}>
          <div className="map-modal-content">
            <div className="modal-header">
              <h2><i className="fa-solid fa-map-location-dot" /> All Nearby Hospitals</h2>
              <span
                className="close-modal"
                onClick={closeModal}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && closeModal()}
              >
                &times;
              </span>
            </div>

            <div id="modal-map" className="modal-map">
              {isLoaded && (
                <GoogleMap
                  mapContainerStyle={MODAL_MAP_STYLE}
                  center={mainMapCenter}
                  zoom={11}
                  onLoad={(map) => {
                    modalMapRef.current = map;
                    fitBoundsToHospitals(map);
                    window.google?.maps?.event?.trigger(map, 'resize');
                  }}
                  options={MODAL_MAP_OPTIONS}
                >
                  {hospitals.map((hospital, index) => (
                    <HospitalMarker
                      key={`modal-${index}`}
                      hospital={hospital}
                      index={index}
                      activeInfoWindow={activeModalInfoWindow}
                      setActiveInfoWindow={setActiveModalInfoWindow}
                      icon={ICON_BLUE}
                    />
                  ))}
                </GoogleMap>
              )}
            </div>

            <div className="modal-footer">
              <p><i className="fa-solid fa-circle-info" /> Click on hospital markers for details</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindHospital;