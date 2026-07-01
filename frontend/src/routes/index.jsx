import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuth } from "../context/AuthContext";

// Pages
import Login from "../pages/auth/Login";
import LandingPage from "../pages/LandingPage";
import RegisterPatient from "../pages/auth/RegisterPatient";
import RegisterDoctor from "../pages/auth/RegisterDoctor";
import RegisterPharmacist from "../pages/auth/RegisterPharmacist";

// Dashboards
import PatientDashboard from "../pages/patient/Dashboard";
import DoctorDashboard from "../pages/doctor/Dashboard";
import PharmacyDashboard from "../pages/pharmacy/Dashboard";
import PharmacyInventory from "../pages/pharmacy/Inventory";
import PharmacyDispense from "../pages/pharmacy/Dispense";
import PharmacyCollaboration from "../pages/pharmacy/Collaboration";

// Patient Features
import BookAppointment from "../pages/patient/BookAppointment";
import FindHospital from "../pages/patient/FindHospital";

import WatchData from "../pages/patient/WatchData";
import ViewPrescription from "../pages/patient/ViewPrescription";

// Doctor Features
import PatientList from "../pages/doctor/PatientList";
import ViewAppointment from "../pages/doctor/ViewAppointment";
import ViewPatient from "../pages/doctor/ViewPatient";
import Statistics from "../pages/doctor/Statistics";
import DoctorProfile from "../pages/doctor/Profile";
import DoctorCollaborations from "../pages/doctor/Collaborations";

// Layouts
import Layout from "../components/layout/Layout";

// --- PROTECTED ROUTE WRAPPER ---
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading...
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardMap = {
      patient: '/patient/dashboard',
      doctor: '/doctor/dashboard',
      pharmacist: '/pharmacy/dashboard'
    };
    return <Navigate to={dashboardMap[user.role] || "/login"} replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

ProtectedRoute.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
};

// --- PUBLIC ROUTE WRAPPER ---
const PublicRoute = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes with Layout */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register/patient" element={<RegisterPatient />} />
        <Route path="/register/doctor" element={<RegisterDoctor />} />
        <Route path="/register/pharmacist" element={<RegisterPharmacist />} />
      </Route>

      {/* Landing Page — standalone, no Layout wrapper */}
      <Route path="/" element={<LandingPage />} />

      {/* Patient Routes */}
      <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient/book-appointment" element={<BookAppointment />} />
        <Route path="/patient/find-hospital" element={<FindHospital />} />

        <Route path="/patient/watch-data" element={<WatchData />} />
        <Route path="/patient/prescription/:id" element={<ViewPrescription />} />
      </Route>

      {/* Doctor Routes */}
      <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/patients" element={<PatientList />} />
        
        {/* FIXED: Changed from /doctor/appointments to /doctor/appointment/:id */}
        <Route path="/doctor/appointment/:id" element={<ViewAppointment />} />
        
        <Route path="/doctor/patient/:id" element={<ViewPatient />} />
        <Route path="/doctor/statistics" element={<Statistics />} />
        <Route path="/doctor/profile" element={<DoctorProfile />} />
        <Route path="/doctor/collaborations" element={<DoctorCollaborations />} />
      </Route>

      {/* Pharmacy Routes */}
      <Route element={<ProtectedRoute allowedRoles={["pharmacist"]} />}>
        <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/inventory" element={<PharmacyInventory />} />
        <Route path="/pharmacy/dispense" element={<PharmacyDispense />} />
        <Route path="/pharmacy/collaboration" element={<PharmacyCollaboration />} />
      </Route>

      {/* 404 - Redirect to Login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;