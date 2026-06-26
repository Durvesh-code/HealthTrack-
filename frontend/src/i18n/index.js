import { useState, useEffect } from 'react';
import { useCallback } from 'react';
// Comprehensive Translation Dictionary
const translations = {
    en: {
        // --- Common ---
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
        'common.search': 'Search...',
        'common.loading': 'Loading...',
        'common.success': 'Success',
        'common.error': 'Error',
        'common.action': 'Action',
        'common.view': 'View',
        'common.status': 'Status',
        'common.date': 'Date',
        'common.time': 'Time',
        'common.back': 'Back',
        'common.all': 'All',
        'common.completed': 'Completed',
        'common.pending': 'Pending',
        'common.cancelled': 'Cancelled',
        'common.patient': 'Patient',
        'common.doctor': 'Doctor',
        'common.pharmacist': 'Pharmacist',
        'common.admin': 'Admin',
        'common.name': 'Name',
        'common.email': 'Email',
        'common.contact': 'Contact Number',

        // --- Navigation ---
        'nav.dashboard': 'Dashboard',
        'nav.viewProfile': 'View Profile',
        'nav.profile': 'Profile',
        'nav.appointments': 'Appointments',
        'nav.patientList': 'Patient List',
        'nav.statistics': 'Statistics',
        'nav.predictDisease': 'Predict Disease',
        'nav.viewWatchData': 'Health Data',
        'nav.findHospital': 'Find Hospital',
        'nav.inventory': 'Inventory',
        'nav.logout': 'Logout',
        'nav.login': 'Login',
        'nav.registerPatient': 'Register Patient',
        'nav.registerDoctor': 'Register Doctor',
        'nav.registerPharmacist': 'Register Pharmacist',

        // --- Auth & Login ---
        'auth.welcomeTo': 'Welcome to',
        'auth.loginToDashboard': 'Login to access your dashboard 🩺',
        'auth.role': 'Role',
        'auth.emailOrUsername': 'Email or Username',
        'auth.password': 'Password',
        'auth.loginBtn': 'Login',
        'auth.newPatient': 'New Patient?',
        'auth.newDoctor': 'New Doctor?',
        'auth.newPharmacist': 'New Pharmacist?',
        'auth.registerHere': 'Register here',
        'auth.createAccount': 'Create Account',
        'auth.alreadyHaveAccount': 'Already have an account?',

        // --- Patient Features ---
        'patient.welcome': 'Welcome',
        'patient.id': 'Patient ID',
        'patient.bloodGroup': 'Blood Group',
        'patient.allergy': 'Allergies',
        'patient.emergencyContact': 'Emergency Contact',
        'patient.height': 'Height (cm)',
        'patient.weight': 'Weight (kg)',
        'patient.editProfile': 'Edit Profile',
        'patient.upcomingAppts': 'Upcoming Appointments',
        'patient.noAppts': 'No upcoming appointments found.',
        
        // Book Appointment
        'patient.bookAppointment': 'Book New Appointment',
        'patient.selectDoctor': 'Select Doctor',
        'patient.symptoms': 'Symptoms / Reason for visit',
        'patient.uploadReport': 'Upload Medical Report (Optional)',
        'patient.bookNowBtn': 'Book Appointment Now',

        // Predict Disease
        'patient.predictTitle': 'AI Disease Prediction',
        'patient.describeSymptoms': 'Describe your symptoms in detail...',
        'patient.analyzeBtn': 'Analyze Symptoms',
        'patient.predictionResult': 'Prediction Result',
        'patient.confidence': 'Confidence Level',
        'patient.recommendations': 'Recommendations',

        // Find Hospital
        'patient.findHospitalTitle': 'Find Nearby Hospitals',
        'patient.searchHospitalName': 'Search by hospital name...',
        'patient.useLocation': 'Use My Location',
        'patient.directions': 'Get Directions',

        // Watch Data
        'patient.watchDataTitle': 'Health Data Sync',
        'patient.connectFit': 'Connect Google Fit',
        'patient.refreshData': 'Refresh Data',
        'patient.heartRate': 'Heart Rate',
        'patient.steps': 'Steps',
        'patient.calories': 'Calories Burned',

        // --- Doctor Features ---
        'doctor.dashboardTitle': 'Doctor Dashboard',
        'doctor.todaysAppts': 'Today\'s Appointments',
        'doctor.totalPatients': 'Total Patients',
        'doctor.completeAppt': 'Mark Complete',
        
        // Doctor Profile
        'doctor.specialization': 'Specialization',
        'doctor.experience': 'Experience (Years)',
        'doctor.fee': 'Consultation Fee (₹)',
        'doctor.clinicAddress': 'Clinic Address',
        'doctor.qualification': 'Qualification',

        // Patient List & View
        'doctor.myPatients': 'My Patients',
        'doctor.age': 'Age',
        'doctor.gender': 'Gender',
        'doctor.medicalHistory': 'Medical History',
        'doctor.prescribeMed': 'Prescribe Medication',
        'doctor.notes': 'Doctor Notes',

        // --- Pharmacy Features ---
        'pharmacy.dashboardTitle': 'Pharmacy Dashboard',
        'pharmacy.pendingPrescriptions': 'Pending Prescriptions',
        'pharmacy.inventoryStatus': 'Inventory Status',
        'pharmacy.lowStock': 'Low Stock Alerts',
        'pharmacy.dispense': 'Dispense',
        'pharmacy.addMedicine': 'Add New Medicine',
        'pharmacy.medicineName': 'Medicine Name',
        'pharmacy.stockQty': 'Stock Quantity',
        'pharmacy.priceUnit': 'Price per Unit (₹)',
        'pharmacy.expiryDate': 'Expiry Date',
    },
    
    hi: {
        // --- Common ---
        'common.save': 'सहेजें',
        'common.cancel': 'रद्द करें',
        'common.edit': 'संपादित करें',
        'common.delete': 'हटाएं',
        'common.search': 'खोजें...',
        'common.loading': 'लोड हो रहा है...',
        'common.success': 'सफल',
        'common.error': 'त्रुटि',
        'common.action': 'कार्रवाई',
        'common.view': 'देखें',
        'common.status': 'स्थिति',
        'common.date': 'तारीख',
        'common.time': 'समय',
        'common.back': 'पीछे',
        'common.all': 'सभी',
        'common.completed': 'पूर्ण',
        'common.pending': 'लंबित',
        'common.cancelled': 'रद्द',
        'common.patient': 'मरीज',
        'common.doctor': 'डॉक्टर',
        'common.pharmacist': 'फार्मासिस्ट',
        'common.admin': 'व्यवस्थापक',
        'common.name': 'नाम',
        'common.email': 'ईमेल',
        'common.contact': 'संपर्क नंबर',

        // --- Navigation ---
        'nav.dashboard': 'डैशबोर्ड',
        'nav.viewProfile': 'प्रोफ़ाइल देखें',
        'nav.profile': 'प्रोफ़ाइल',
        'nav.appointments': 'अपॉइंटमेंट',
        'nav.patientList': 'मरीजों की सूची',
        'nav.statistics': 'आंकड़े',
        'nav.predictDisease': 'रोग की भविष्यवाणी',
        'nav.viewWatchData': 'स्वास्थ्य डेटा',
        'nav.findHospital': 'अस्पताल खोजें',
        'nav.inventory': 'इन्वेंटरी',
        'nav.logout': 'लॉग आउट',
        'nav.login': 'लॉगिन',
        'nav.registerPatient': 'मरीज रजिस्टर करें',
        'nav.registerDoctor': 'डॉक्टर रजिस्टर करें',
        'nav.registerPharmacist': 'फार्मासिस्ट रजिस्टर करें',

        // --- Auth & Login ---
        'auth.welcomeTo': 'में आपका स्वागत है',
        'auth.loginToDashboard': 'अपने डैशबोर्ड तक पहुंचने के लिए लॉगिन करें 🩺',
        'auth.role': 'भूमिका',
        'auth.emailOrUsername': 'ईमेल या उपयोगकर्ता नाम',
        'auth.password': 'पासवर्ड',
        'auth.loginBtn': 'लॉगिन',
        'auth.newPatient': 'नए मरीज?',
        'auth.newDoctor': 'नए डॉक्टर?',
        'auth.newPharmacist': 'नए फार्मासिस्ट?',
        'auth.registerHere': 'यहां पंजीकरण करें',
        'auth.createAccount': 'खाता बनाएं',
        'auth.alreadyHaveAccount': 'क्या आपके पास पहले से खाता है?',

        // --- Patient Features ---
        'patient.welcome': 'स्वागत है',
        'patient.id': 'मरीज आईडी',
        'patient.bloodGroup': 'रक्त समूह',
        'patient.allergy': 'एलर्जी',
        'patient.emergencyContact': 'आपातकालीन संपर्क',
        'patient.height': 'ऊंचाई (सेमी)',
        'patient.weight': 'वजन (किग्रा)',
        'patient.editProfile': 'प्रोफ़ाइल संपादित करें',
        'patient.upcomingAppts': 'आगामी अपॉइंटमेंट',
        'patient.noAppts': 'कोई आगामी अपॉइंटमेंट नहीं मिला।',
        
        // Book Appointment
        'patient.bookAppointment': 'नया अपॉइंटमेंट बुक करें',
        'patient.selectDoctor': 'डॉक्टर चुनें',
        'patient.symptoms': 'लक्षण / यात्रा का कारण',
        'patient.uploadReport': 'मेडिकल रिपोर्ट अपलोड करें (वैकल्पिक)',
        'patient.bookNowBtn': 'अभी अपॉइंटमेंट बुक करें',

        // Predict Disease
        'patient.predictTitle': 'एआई रोग की भविष्यवाणी',
        'patient.describeSymptoms': 'अपने लक्षणों का विस्तार से वर्णन करें...',
        'patient.analyzeBtn': 'लक्षणों का विश्लेषण करें',
        'patient.predictionResult': 'भविष्यवाणी का परिणाम',
        'patient.confidence': 'आत्मविश्वास का स्तर',
        'patient.recommendations': 'सिफारिशें',

        // Find Hospital
        'patient.findHospitalTitle': 'आसपास के अस्पताल खोजें',
        'patient.searchHospitalName': 'अस्पताल के नाम से खोजें...',
        'patient.useLocation': 'मेरे स्थान का उपयोग करें',
        'patient.directions': 'दिशा-निर्देश प्राप्त करें',

        // Watch Data
        'patient.watchDataTitle': 'स्वास्थ्य डेटा सिंक',
        'patient.connectFit': 'Google Fit कनेक्ट करें',
        'patient.refreshData': 'डेटा रीफ्रेश करें',
        'patient.heartRate': 'हृदय गति',
        'patient.steps': 'कदम',
        'patient.calories': 'कैलोरी बर्न',

        // --- Doctor Features ---
        'doctor.dashboardTitle': 'डॉक्टर डैशबोर्ड',
        'doctor.todaysAppts': 'आज के अपॉइंटमेंट',
        'doctor.totalPatients': 'कुल मरीज',
        'doctor.completeAppt': 'पूर्ण चिह्नित करें',
        
        // Doctor Profile
        'doctor.specialization': 'विशेषज्ञता',
        'doctor.experience': 'अनुभव (वर्ष)',
        'doctor.fee': 'परामर्श शुल्क (₹)',
        'doctor.clinicAddress': 'क्लिनिक का पता',
        'doctor.qualification': 'योग्यता',

        // Patient List & View
        'doctor.myPatients': 'मेरे मरीज',
        'doctor.age': 'आयु',
        'doctor.gender': 'लिंग',
        'doctor.medicalHistory': 'चिकित्सा इतिहास',
        'doctor.prescribeMed': 'दवा लिखें',
        'doctor.notes': 'डॉक्टर के नोट्स',

        // --- Pharmacy Features ---
        'pharmacy.dashboardTitle': 'फार्मेसी डैशबोर्ड',
        'pharmacy.pendingPrescriptions': 'लंबित नुस्खे',
        'pharmacy.inventoryStatus': 'इन्वेंटरी स्थिति',
        'pharmacy.lowStock': 'कम स्टॉक अलर्ट',
        'pharmacy.dispense': 'दवा दें',
        'pharmacy.addMedicine': 'नई दवा जोड़ें',
        'pharmacy.medicineName': 'दवा का नाम',
        'pharmacy.stockQty': 'स्टॉक मात्रा',
        'pharmacy.priceUnit': 'मूल्य प्रति यूनिट (₹)',
        'pharmacy.expiryDate': 'समाप्ति तिथि',
    },

    mr: {
        // --- Common ---
        'common.save': 'जतन करा',
        'common.cancel': 'रद्द करा',
        'common.edit': 'संपादित करा',
        'common.delete': 'हटवा',
        'common.search': 'शोधा...',
        'common.loading': 'लोड होत आहे...',
        'common.success': 'यशस्वी',
        'common.error': 'त्रुटी',
        'common.action': 'कृती',
        'common.view': 'पहा',
        'common.status': 'स्थिती',
        'common.date': 'तारीख',
        'common.time': 'वेळ',
        'common.back': 'मागे',
        'common.all': 'सर्व',
        'common.completed': 'पूर्ण',
        'common.pending': 'प्रलंबित',
        'common.cancelled': 'रद्द',
        'common.patient': 'रुग्ण',
        'common.doctor': 'डॉक्टर',
        'common.pharmacist': 'फार्मासिस्ट',
        'common.admin': 'प्रशासक',
        'common.name': 'नाव',
        'common.email': 'ईमेल',
        'common.contact': 'संपर्क क्रमांक',

        // --- Navigation ---
        'nav.dashboard': 'डॅशबोर्ड',
        'nav.viewProfile': 'प्रोफाइल पहा',
        'nav.profile': 'प्रोफाइल',
        'nav.appointments': 'भेटी',
        'nav.patientList': 'रुग्णांची यादी',
        'nav.statistics': 'आकडेवारी',
        'nav.predictDisease': 'रोगाचा अंदाज',
        'nav.viewWatchData': 'आरोग्य डेटा',
        'nav.findHospital': 'हॉस्पिटल शोधा',
        'nav.inventory': 'इन्व्हेंटरी',
        'nav.logout': 'बाहेर पडा',
        'nav.login': 'लॉगिन',
        'nav.registerPatient': 'रुग्ण नोंदणी करा',
        'nav.registerDoctor': 'डॉक्टर नोंदणी करा',
        'nav.registerPharmacist': 'फार्मासिस्ट नोंदणी करा',

        // --- Auth & Login ---
        'auth.welcomeTo': 'मध्ये आपले स्वागत आहे',
        'auth.loginToDashboard': 'तुमच्या डॅशबोर्डवर प्रवेश करण्यासाठी लॉगिन करा 🩺',
        'auth.role': 'भूमिका',
        'auth.emailOrUsername': 'ईमेल किंवा वापरकर्तानाव',
        'auth.password': 'पासवर्ड',
        'auth.loginBtn': 'लॉगिन',
        'auth.newPatient': 'नवीन रुग्ण?',
        'auth.newDoctor': 'नवीन डॉक्टर?',
        'auth.newPharmacist': 'नवीन फार्मासिस्ट?',
        'auth.registerHere': 'येथे नोंदणी करा',
        'auth.createAccount': 'खाते तयार करा',
        'auth.alreadyHaveAccount': 'तुमचे आधीपासून खाते आहे का?',

        // --- Patient Features ---
        'patient.welcome': 'स्वागत आहे',
        'patient.id': 'रुग्ण आयडी',
        'patient.bloodGroup': 'रक्त गट',
        'patient.allergy': 'अॅलर्जी',
        'patient.emergencyContact': 'आपत्कालीन संपर्क',
        'patient.height': 'उंची (सेमी)',
        'patient.weight': 'वजन (किलो)',
        'patient.editProfile': 'प्रोफाइल संपादित करा',
        'patient.upcomingAppts': 'आगामी भेटी',
        'patient.noAppts': 'कोणत्याही आगामी भेटी नाहीत.',
        
        // Book Appointment
        'patient.bookAppointment': 'नवीन भेट बुक करा',
        'patient.selectDoctor': 'डॉक्टर निवडा',
        'patient.symptoms': 'लक्षणे / भेटीचे कारण',
        'patient.uploadReport': 'वैद्यकीय अहवाल अपलोड करा (पर्यायी)',
        'patient.bookNowBtn': 'आता भेट बुक करा',

        // Predict Disease
        'patient.predictTitle': 'एआय रोगाचा अंदाज',
        'patient.describeSymptoms': 'तुमच्या लक्षणांचे सविस्तर वर्णन करा...',
        'patient.analyzeBtn': 'लक्षणांचे विश्लेषण करा',
        'patient.predictionResult': 'अंदाजाचा निकाल',
        'patient.confidence': 'आत्मविश्वासाची पातळी',
        'patient.recommendations': 'शिफारसी',

        // Find Hospital
        'patient.findHospitalTitle': 'जवळपासची रुग्णालये शोधा',
        'patient.searchHospitalName': 'रुग्णालयाच्या नावाने शोधा...',
        'patient.useLocation': 'माझे स्थान वापरा',
        'patient.directions': 'दिशा मिळवा',

        // Watch Data
        'patient.watchDataTitle': 'आरोग्य डेटा सिंक',
        'patient.connectFit': 'Google Fit कनेक्ट करा',
        'patient.refreshData': 'डेटा रिफ्रेश करा',
        'patient.heartRate': 'हृदयगती',
        'patient.steps': 'पावले',
        'patient.calories': 'कॅलरीज जळल्या',

        // --- Doctor Features ---
        'doctor.dashboardTitle': 'डॉक्टर डॅशबोर्ड',
        'doctor.todaysAppts': 'आजच्या भेटी',
        'doctor.totalPatients': 'एकूण रुग्ण',
        'doctor.completeAppt': 'पूर्ण चिन्हांकित करा',
        
        // Doctor Profile
        'doctor.specialization': 'विशेषज्ञता',
        'doctor.experience': 'अनुभव (वर्षे)',
        'doctor.fee': 'सल्ला फी (₹)',
        'doctor.clinicAddress': 'क्लिनिकचा पत्ता',
        'doctor.qualification': 'पात्रता',

        // Patient List & View
        'doctor.myPatients': 'माझे रुग्ण',
        'doctor.age': 'वय',
        'doctor.gender': 'लिंग',
        'doctor.medicalHistory': 'वैद्यकीय इतिहास',
        'doctor.prescribeMed': 'औषध लिहून द्या',
        'doctor.notes': 'डॉक्टरांच्या नोंदी',

        // --- Pharmacy Features ---
        'pharmacy.dashboardTitle': 'फार्मेसी डॅशबोर्ड',
        'pharmacy.pendingPrescriptions': 'प्रलंबित प्रिस्क्रिप्शन',
        'pharmacy.inventoryStatus': 'इन्व्हेंटरी स्थिती',
        'pharmacy.lowStock': 'कमी स्टॉक अलर्ट',
        'pharmacy.dispense': 'औषध द्या',
        'pharmacy.addMedicine': 'नवीन औषध जोडा',
        'pharmacy.medicineName': 'औषधाचे नाव',
        'pharmacy.stockQty': 'स्टॉक प्रमाण',
        'pharmacy.priceUnit': 'प्रति युनिट किंमत (₹)',
        'pharmacy.expiryDate': 'कालबाह्यता तारीख',
    }
};

// Global state listener for language changes
let listeners = [];
let currentLang = localStorage.getItem('language') || 'en';

export const setLanguage = (lang) => {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('language', lang);
        // Notify all components that use the hook to re-render
        listeners.forEach(listener => listener(lang));
    }
};

export const getLanguage = () => currentLang;

// Static translation function (for non-React files or outside component scope)
export const t = (key) => {
    return translations[currentLang]?.[key] || translations.en[key] || key;
};

// React Hook to trigger re-renders when language changes
export const useTranslation = () => {
    const [lang, setLangState] = useState(currentLang);

    useEffect(() => {
        listeners.push(setLangState);
        return () => {
            listeners = listeners.filter(l => l !== setLangState);
        };
    }, []);

    // FIX: Wrap 't' in useCallback so it doesn't cause infinite loops!
    const t = useCallback((key) => {
        return translations[lang]?.[key] || translations.en?.[key] || key;
    }, [lang]);

    return {
        t,
        currentLanguage: lang,
        setLanguage
    };
};