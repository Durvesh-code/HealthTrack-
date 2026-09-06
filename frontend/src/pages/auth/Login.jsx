import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import "../../styles/login.css";

const Login = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    role: "patient",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userData = await login(formData);

      if (userData && userData.role) {
        const role = userData.role;

        switch (role) {
          case "patient":
            navigate("/patient/dashboard", { replace: true });
            break;
          case "doctor":
            navigate("/doctor/dashboard", { replace: true });
            break;
          case "pharmacist":
            navigate("/pharmacy/dashboard", { replace: true });
            break;
          default:
            navigate("/", { replace: true });
        }
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-container fade-in">
        <div className="login-card">
          <div className="logo-section">
            <img
              src="/images/logo.png"
              alt="HealthTrack+ Logo"
              onError={(e) => {
                e.target.src = "/vite.svg";
              }}
            />
            <h2>
              <span>{t('auth.welcomeTo')}</span> <span>HealthTrack+</span>
            </h2>
            <p className="subtitle">{t('auth.loginToDashboard')}</p>
          </div>

          {error && (
            <div className="flash-container">
              <div className="flash-message danger">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label>{t('auth.role')}</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="patient">{t('common.patient')}</option>
              <option value="doctor">{t('common.doctor')}</option>
              <option value="pharmacist">{t('common.pharmacist')}</option>
            </select>

            <label>{t('auth.emailOrUsername')}</label>
            <input
              type="text"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder={t('auth.emailOrUsername')}
            />

            <label>{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder={t('auth.password')}
            />

            <button
              type="submit"
              className={`login-btn ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </button>
          </form>

          <div className="login-links">
            <p>
              <span>{t('auth.newPatient')}</span>{" "}
              <Link to="/register/patient">{t('auth.registerHere')}</Link>
            </p>
            <p>
              <span>{t('auth.newDoctor')}</span>{" "}
              <Link to="/register/doctor">{t('auth.registerHere')}</Link>
            </p>
            <p>
              <span>{t('auth.newPharmacist')}</span>{" "}
              <Link to="/register/pharmacist">{t('auth.registerHere')}</Link>
            </p>
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center' }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--deep-teal)', fontWeight: '600', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.target.style.opacity = 0.8} onMouseLeave={(e) => e.target.style.opacity = 1}>
                <i className="fa fa-arrow-left"></i> Go to Home Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;