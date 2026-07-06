import { useMemo, useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Toast } from '../../hooks/useToast';
import { useAuth } from "../../context/AuthContext";
import api from "../../config/api";
import ChatBubble from "../common/ChatBubble";
import "../../styles/dashboard_base.css";
import "../../styles/dashboard.css";
import "../../styles/language_selector.css";
import { useTranslation } from "../../i18n";

const Layout = ({ children }) => {
  const { user, role, logout } = useAuth();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [pendingCollabCount, setPendingCollabCount] = useState(0);

  // Poll pending collaboration count for doctor badge
  useEffect(() => {
    if (role !== 'doctor') return;
    const load = () =>
      api.get('/api/doctor/collaboration/pending-count')
        .then(r => setPendingCollabCount(r.data.count || 0))
        .catch(() => {});
    load();
    const t2 = setInterval(load, 60000);
    return () => clearInterval(t2);
  }, [role]);

  // Map language codes to display names
  const langDisplayNames = {
    en: "English",
    hi: "हिंदी",
    mr: "मराठी",
  };

  const currentLangName = langDisplayNames[currentLanguage] || "English";

  // Map paths to titles (These can also be translated if needed)
  const getTitleFromPath = (path) => {
    if (path.includes("/login")) return t("nav.login");
    if (path.includes("/register")) return "Register";
    if (path.includes("/dashboard")) return t("nav.dashboard");
    if (path.includes("/book-appointment")) return t("patient.bookAppointment");

    if (path.includes("/watch-data")) return t("nav.viewWatchData");
    if (path.includes("/find-hospital")) return t("nav.findHospital");
    if (path.includes("/profile")) return t("nav.profile");
    if (path.includes("/patients")) return t("nav.patientList");
    if (path.includes("/statistics")) return t("nav.statistics");
    if (path.includes("/inventory")) return t("nav.inventory");
    return "HealthTrack+"; // Default title
  };

  const pageTitle = useMemo(
    () => getTitleFromPath(location.pathname),
    [location.pathname, t] // Add t to dependency array so title updates on lang change
  );

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  // IMPORTANT: All labels here must use t() to be translated
  const getNavItems = () => {
    if (!user) {
      return [
        { path: "/login", icon: "fa-sign-in-alt", label: t("nav.login") },
        {
          path: "/register/patient",
          icon: "fa-user-plus",
          label: t("nav.registerPatient"),
        },
        {
          path: "/register/doctor",
          icon: "fa-user-md",
          label: t("nav.registerDoctor"),
        },
        {
          path: "/register/pharmacist",
          icon: "fa-pills",
          label: t("nav.registerPharmacist"),
        },
        {
          path: "/",
          icon: "fa-home",
          label: "Go to Home Page",
        },
      ];
    }

    switch (role) {
      case "patient":
        return [
          {
            path: "/patient/dashboard",
            icon: "fa-user",
            label: t("nav.viewProfile"),
          },
          {
            path: "/patient/book-appointment",
            icon: "fa-calendar",
            label: t("nav.appointments"),
          },

          {
            path: "/patient/watch-data",
            icon: "fa-heartbeat",
            label: t("nav.viewWatchData"),
          },
          {
            path: "/patient/find-hospital",
            icon: "fa-hospital",
            label: t("nav.findHospital"),
          },
        ];
      case "doctor":
        return [
          {
            path: "/doctor/profile",
            icon: "fa-user-md",
            label: t("nav.profile"),
          },
          {
            path: "/doctor/dashboard",
            icon: "fa-calendar-check",
            label: t("nav.appointments"),
          },
          {
            path: "/doctor/patients",
            icon: "fa-users",
            label: t("nav.patientList"),
          },
          {
            path: "/doctor/statistics",
            icon: "fa-chart-line",
            label: t("nav.statistics"),
          },
          {
            path: "/doctor/collaborations",
            icon: "fa-handshake",
            label: "Collaborations",
            badge: pendingCollabCount,
          },
        ];
      case "pharmacist":
        return [
          {
            path: "/pharmacy/dispense",
            icon: "fa-pills",
            label: "Dispense",
          },
          {
            path: "/pharmacy/dashboard",
            icon: "fa-chart-pie",
            label: t("nav.dashboard"),
          },
          {
            path: "/pharmacy/inventory",
            icon: "fa-boxes-stacked",
            label: t("nav.inventory"),
          },
          {
            path: "/pharmacy/collaboration",
            icon: "fa-handshake",
            label: "Collaborations",
          },
        ];
      default:
        return [];
    }
  };

  const getUserName = () => {
    if (!user) return "Guest";
    return (
      user.patient_name ||
      user.doctor_name ||
      user.admin_name ||
      user.pharmacist_name ||
      user.name ||
      "User"
    );
  };

  const getAvatarUrl = () => {
    if (user?.profile_img) {
      return `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'}/static/uploads/${user.profile_img}`;
    }
    switch (role) {
      case "doctor":
        return "https://tse3.mm.bing.net/th/id/OIP.sOWsOOU81OApsLqngmwrzAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3";
      case "admin":
        return "https://www.pngmart.com/files/21/Admin-Profile-Vector-PNG-File.png";
      default:
        return "https://www.pngall.com/wp-content/uploads/5/Profile-Avatar-PNG.png";
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang); // This triggers the global state change in i18n/index.js
    setLanguageOpen(false); // Close dropdown
  };

  return (
    <div className="dashboard-layout">
      {/* Left Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="logo-section">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="site-logo"
            onError={(e) => {
              e.target.src = "/vite.svg";
            }}
          />
          <h2 className="brand-name">HealthTrack+</h2>
        </div>

        <ul>
          {getNavItems().map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={isActive(item.path) ? "active" : ""}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className={`fa ${item.icon}`}></i>
                  <span>{item.label}</span>
                </span>
                {item.badge > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center', lineHeight: '16px', display: 'inline-block' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}

          {user ? (
            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
              >
                <i className="fa fa-sign-out"></i>
                <span>{t("nav.logout")}</span>
              </a>
            </li>
          ) : null}
        </ul>
      </aside>

      {/* Global Toast */}
      <Toast />

      {/* Main Content Area */}
      <div className="main-area">
        {/* Top Navbar */}
        <header className="top-nav">
          <div className="left-section">
            <button onClick={toggleSidebar} className="menu-btn">
              <i className="fa fa-bars"></i>
            </button>
            <h1>{pageTitle}</h1>
          </div>

          {/* Language Selector */}
          <div className={`language-selector ${languageOpen ? "open" : ""}`}>
            <button
              className="language-btn"
              title="Select Language"
              onClick={() => setLanguageOpen(!languageOpen)}
            >
              <i className="fa-solid fa-globe"></i>
              <span className="current-lang">{currentLangName}</span>
              <i className="fa-solid fa-chevron-down dropdown-arrow"></i>
            </button>

            <div className="language-dropdown">
              <div
                className={`language-option ${currentLanguage === "en" ? "active" : ""}`}
                onClick={() => handleLanguageChange("en")}
              >
                <span className="lang-code">EN</span>
                <span className="lang-name">English</span>
              </div>
              <div
                className={`language-option ${currentLanguage === "hi" ? "active" : ""}`}
                onClick={() => handleLanguageChange("hi")}
              >
                <span className="lang-code">HI</span>
                <span className="lang-name">हिंदी</span>
              </div>
              <div
                className={`language-option ${currentLanguage === "mr" ? "active" : ""}`}
                onClick={() => handleLanguageChange("mr")}
              >
                <span className="lang-code">MR</span>
                <span className="lang-name">मराठी</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="search-section">
            <form onSubmit={(e) => e.preventDefault()}>
              <input type="text" placeholder={t("common.search")} name="q" />
              <button type="submit">
                <i className="fa fa-search"></i>
              </button>
            </form>
          </div>

          {/* User Section */}
          <div className="user-section">
            <img src={getAvatarUrl()} className="avatar" alt="User" />
            <span>{getUserName()}</span>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="content-area">{children || <Outlet />}</main>
      </div>
      
      {/* AI Chatbot */}
      <ChatBubble />
    </div>
  );
};

export default Layout;