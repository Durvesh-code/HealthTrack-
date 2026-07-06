import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const LandingPage = () => {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(0);

  // Carousel effect for hero roles
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Nav scroll effect
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Intersection Observer for scroll animations
  const animRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    animRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const addAnimRef = (el) => {
    if (el && !animRefs.current.includes(el)) {
      animRefs.current.push(el);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <div className="landing-page">
      {/* ===== NAVIGATION ===== */}
      <nav className={`landing-nav ${navScrolled ? 'scrolled' : ''}`}>
        <div className="nav-brand">
          <img
            src="/images/logo.png"
            alt="HealthTrack+"
            onError={(e) => { e.target.src = '/vite.svg'; }}
          />
          <span className="nav-brand-name">HealthTrack+</span>
        </div>

        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          <i className={`fa ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>

        <div className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`}>
          <a href="#portals" onClick={(e) => { e.preventDefault(); scrollToSection('portals'); }}>
            <i className="fa fa-hospital"></i> Portals
          </a>
          <span className="nav-divider"></span>
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>
            <i className="fa fa-bolt"></i> Features
          </a>
          <span className="nav-divider"></span>
          <a href="#tech" onClick={(e) => { e.preventDefault(); scrollToSection('tech'); }}>
            <i className="fa fa-layer-group"></i> Tech Stack
          </a>
          <span className="nav-divider"></span>
          <a href="#architecture" onClick={(e) => { e.preventDefault(); scrollToSection('architecture'); }}>
            <i className="fa fa-sitemap"></i> Architecture
          </a>
          <Link to="/login" className="nav-cta" onClick={() => setMobileOpen(false)}>
            <i className="fa fa-sign-in-alt"></i> Login
          </Link>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="landing-hero">
        <div className="hero-bg"></div>
        <div className="hero-grid"></div>

        <div className="hero-content split-layout">
          <div className="hero-text-side">
            <h1 className="hero-title">
              What if Healthcare{' '}
              <span className="gradient-text">Actually Worked Together?</span>
            </h1>

            <p className="hero-subtitle">
              Patients book appointments, doctors prescribe with live stock checks,
              pharmacies dispense instantly — all on one platform, powered by
              AI and real-time data.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="hero-btn hero-btn-primary">
                <i className="fa fa-sign-in-alt"></i> Login to Dashboard
              </Link>
              <a
                href="#portals"
                className="hero-btn hero-btn-secondary"
                onClick={(e) => { e.preventDefault(); scrollToSection('portals'); }}
              >
                <i className="fa fa-arrow-down"></i> Explore Project
              </a>
            </div>
          </div>

          <div className="hero-visual-side">
            <div className="hero-carousel-container">
              {/* Glowing aura behind active card */}
              <div className={`carousel-aura aura-${activeCard}`}></div>

              {/* Floating ambient particles */}
              <div className="carousel-particles">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>

              {/* Connection Lines Background */}
              <div className="flow-lines">
                <div className={`flow-line ${activeCard === 0 ? 'active' : ''}`}></div>
                <div className={`flow-line ${activeCard === 1 ? 'active' : ''}`}></div>
                <div className={`flow-line ${activeCard === 2 ? 'active' : ''}`}></div>
              </div>

              {/* Patient Card */}
              <div className={`carousel-card patient-theme ${activeCard === 0 ? 'active' : ''} ${activeCard > 0 ? 'prev' : ''}`}>
                <div className="card-shimmer"></div>
                <div className="card-header">
                  <div className="role-icon"><i className="fa fa-user"></i></div>
                  <span className="role-name">Patient Portal</span>
                  <span className="card-live-badge"><span className="pulse-dot"></span>Live</span>
                </div>
                <div className="card-body">
                  <div className="mock-action">
                    <i className="fa fa-calendar-plus"></i>
                    <span>Booking Appointment...</span>
                  </div>
                  <div className="mock-detail">Dr. Sumit Mali • Cardiology</div>
                  <div className="mock-time">Tomorrow, 10:30 AM</div>
                  <div className="card-metrics">
                    <div className="metric">
                      <i className="fa fa-heartbeat"></i>
                      <span>72 bpm</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-walking"></i>
                      <span>8,420</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-calendar-check"></i>
                      <span>3 appts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doctor Card */}
              <div className={`carousel-card doctor-theme ${activeCard === 1 ? 'active' : ''} ${activeCard > 1 ? 'prev' : ''} ${activeCard < 1 ? 'next' : ''}`}>
                <div className="card-shimmer"></div>
                <div className="card-header">
                  <div className="role-icon"><i className="fa fa-user-md"></i></div>
                  <span className="role-name">Doctor Portal</span>
                  <span className="card-live-badge"><span className="pulse-dot"></span>Live</span>
                </div>
                <div className="card-body">
                  <div className="mock-action">
                    <i className="fa fa-file-medical"></i>
                    <span>Writing Prescription...</span>
                  </div>
                  <div className="mock-detail">Amoxicillin 500mg</div>
                  <div className="mock-status success"><i className="fa fa-check-circle"></i> In Stock Nearby</div>
                  <div className="card-metrics">
                    <div className="metric">
                      <i className="fa fa-users"></i>
                      <span>24 patients</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-clock"></i>
                      <span>~12 min</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-star"></i>
                      <span>4.9</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pharmacy Card */}
              <div className={`carousel-card pharmacy-theme ${activeCard === 2 ? 'active' : ''} ${activeCard < 2 ? 'next' : ''}`}>
                <div className="card-shimmer"></div>
                <div className="card-header">
                  <div className="role-icon"><i className="fa fa-pills"></i></div>
                  <span className="role-name">Pharmacy Portal</span>
                  <span className="card-live-badge"><span className="pulse-dot"></span>Live</span>
                </div>
                <div className="card-body">
                  <div className="mock-action">
                    <i className="fa fa-box-open"></i>
                    <span>Dispensing Order...</span>
                  </div>
                  <div className="mock-detail">Duvesh Patil • Pharmacy</div>
                  <div className="mock-time">Auto-deducting inventory</div>
                  <div className="mock-progress">
                    <div className="progress-bar"></div>
                  </div>
                  <div className="card-metrics">
                    <div className="metric">
                      <i className="fa fa-boxes"></i>
                      <span>1,247 items</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-receipt"></i>
                      <span>38 orders</span>
                    </div>
                    <div className="metric">
                      <i className="fa fa-chart-line"></i>
                      <span>+12%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dot Navigation */}
              <div className="carousel-dots">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    className={`carousel-dot ${activeCard === i ? 'active' : ''}`}
                    onClick={() => setActiveCard(i)}
                    aria-label={`Show card ${i + 1}`}
                  >
                    <svg className="dot-progress" viewBox="0 0 24 24">
                      <circle className="dot-track" cx="12" cy="12" r="10" />
                      {activeCard === i && <circle className="dot-fill" cx="12" cy="12" r="10" />}
                    </svg>
                  </button>
                ))}
              </div>

              {/* Data Flow Connector */}
              <div className="data-flow-connector">
                <div className={`flow-node ${activeCard === 0 ? 'active' : ''}`}>
                  <i className="fa fa-user"></i>
                </div>
                <div className={`flow-pipe ${activeCard >= 1 ? 'filled' : ''}`}>
                  <div className="pipe-particle"></div>
                </div>
                <div className={`flow-node ${activeCard === 1 ? 'active' : ''}`}>
                  <i className="fa fa-user-md"></i>
                </div>
                <div className={`flow-pipe ${activeCard >= 2 ? 'filled' : ''}`}>
                  <div className="pipe-particle"></div>
                </div>
                <div className={`flow-node ${activeCard === 2 ? 'active' : ''}`}>
                  <i className="fa fa-pills"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Strip */}
        <div className="hero-feature-strip">
          <div className="strip-item">
            <i className="fa fa-calendar-check"></i> Smart Scheduling
          </div>
          <div className="strip-divider"></div>
          <div className="strip-item">
            <i className="fa fa-prescription-bottle-alt"></i> Live Prescriptions
          </div>
          <div className="strip-divider"></div>
          <div className="strip-item">
            <i className="fa fa-robot"></i> AI Chat Assistant
          </div>
        </div>
      </section>

      {/* ===== PORTALS SECTION ===== */}
      <section id="portals" className="landing-section portals-section">
        <div className="section-container">
          <div className="section-header-centered landing-animate" ref={addAnimRef}>
            <div className="section-label">
              <i className="fa fa-users"></i> Role-Based Access
            </div>
            <h2 className="section-title">Three Portals, One Ecosystem</h2>
            <p className="section-desc">
              Each user role gets a dedicated dashboard tailored to their workflow — all
              connected through real-time data synchronisation.
            </p>
          </div>

          <div className="portals-grid landing-animate-stagger" ref={addAnimRef}>
            {/* Patient */}
            <div className="portal-card patient">
              <div className="portal-icon">
                <i className="fa fa-user"></i>
              </div>
              <h3>Patient Portal</h3>
              <p>
                A smart health dashboard with appointment booking, digital prescriptions,
                wearable data sync, and hospital discovery.
              </p>
              <ul className="portal-features">
                <li><i className="fa fa-check-circle"></i> Smart Dashboard with health history</li>
                <li><i className="fa fa-check-circle"></i> Book appointments with live availability</li>
                <li><i className="fa fa-check-circle"></i> Google Fit wearable integration</li>
                <li><i className="fa fa-check-circle"></i> Digital prescription wallet with QR transfer</li>
                <li><i className="fa fa-check-circle"></i> Nearby hospital finder (50K+ records)</li>
              </ul>
            </div>

            {/* Doctor */}
            <div className="portal-card doctor">
              <div className="portal-icon">
                <i className="fa fa-user-md"></i>
              </div>
              <h3>Doctor Portal</h3>
              <p>
                Complete patient management with calendar scheduling, smart prescribing,
                pharmacy collaboration, and clinical analytics.
              </p>
              <ul className="portal-features">
                <li><i className="fa fa-check-circle"></i> FullCalendar appointment management</li>
                <li><i className="fa fa-check-circle"></i> Smart prescribing with stock verification</li>
                <li><i className="fa fa-check-circle"></i> Patient timeline & health records</li>
                <li><i className="fa fa-check-circle"></i> Pharmacy collaboration network</li>
                <li><i className="fa fa-check-circle"></i> Statistics & performance analytics</li>
              </ul>
            </div>

            {/* Pharmacist */}
            <div className="portal-card pharmacist">
              <div className="portal-icon">
                <i className="fa fa-pills"></i>
              </div>
              <h3>Pharmacy Portal</h3>
              <p>
                Live inventory management, instant prescription dispensing, collaboration
                with doctors, and revenue analytics.
              </p>
              <ul className="portal-features">
                <li><i className="fa fa-check-circle"></i> Real-time inventory management</li>
                <li><i className="fa fa-check-circle"></i> Instant prescription dispense queue</li>
                <li><i className="fa fa-check-circle"></i> Low-stock automated alerts</li>
                <li><i className="fa fa-check-circle"></i> Doctor collaboration management</li>
                <li><i className="fa fa-check-circle"></i> Revenue tracking & sales analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" className="landing-section features-section">
        <div className="section-container">
          <div className="section-header-centered landing-animate" ref={addAnimRef}>
            <div className="section-label">
              <i className="fa fa-sparkles"></i> Key Features
            </div>
            <h2 className="section-title">Packed with Advanced Capabilities</h2>
            <p className="section-desc">
              From AI-powered chat to real-time wearable data — every feature is built to
              deliver a production-grade healthcare experience.
            </p>
          </div>

          <div className="features-grid landing-animate-stagger" ref={addAnimRef}>
            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-robot"></i></div>
              <h4>AI Chat Assistant</h4>
              <p>Role-aware AI agent powered by OpenAI with tool calling, MongoDB memory, and rate limiting.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-calendar-check"></i></div>
              <h4>Smart Scheduling</h4>
              <p>Live availability detection, specialisation filtering, and modal-based booking with FullCalendar integration.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-heartbeat"></i></div>
              <h4>Wearable Sync</h4>
              <p>Google Fit OAuth2 integration pulling heart rate, steps, calories, and sleep data with 30-day trend charts.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-qrcode"></i></div>
              <h4>QR Prescription Transfer</h4>
              <p>Digitally store prescriptions and transfer them to any pharmacy via dynamic QR code scanning.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-map-marked-alt"></i></div>
              <h4>Hospital Finder</h4>
              <p>Google Maps integration with NumPy-vectorized Haversine search across 50,000+ hospital records in ~1-3ms.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><i className="fa fa-language"></i></div>
              <h4>Multi-Language</h4>
              <p>Full i18n support for English, Hindi, and Marathi — making healthcare accessible to regional users.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TECH STACK SECTION ===== */}
      <section id="tech" className="landing-section tech-section">
        <div className="section-container">
          <div className="section-header-centered landing-animate" ref={addAnimRef}>
            <div className="section-label">
              <i className="fa fa-code"></i> Technology
            </div>
            <h2 className="section-title">Built with Modern Tech Stack</h2>
            <p className="section-desc">
              Production-grade technologies carefully selected for performance, scalability,
              and developer experience.
            </p>
          </div>

          <div className="tech-grid landing-animate-stagger" ref={addAnimRef}>
            <div className="tech-card">
              <i className="fa-brands fa-react" style={{ color: '#61dafb' }}></i>
              <h5>React 19</h5>
              <span>Frontend Framework</span>
            </div>
            <div className="tech-card">
              <i className="fa-brands fa-python" style={{ color: '#3776ab' }}></i>
              <h5>Flask</h5>
              <span>Backend API</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-database" style={{ color: '#005c84' }}></i>
              <h5>MySQL</h5>
              <span>Primary Database</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-leaf" style={{ color: '#4ea94b' }}></i>
              <h5>MongoDB</h5>
              <span>NoSQL Storage</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-brain" style={{ color: '#a78bfa' }}></i>
              <h5>OpenAI</h5>
              <span>AI Models</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-bolt" style={{ color: '#646cff' }}></i>
              <h5>Vite</h5>
              <span>Build Tool</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-map" style={{ color: '#4285f4' }}></i>
              <h5>Google Maps</h5>
              <span>Location Services</span>
            </div>
            <div className="tech-card">
              <i className="fa fa-watch" style={{ color: '#14d9c4' }}></i>
              <h5>Google Fit</h5>
              <span>Wearable API</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ARCHITECTURE SECTION ===== */}
      <section id="architecture" className="landing-section arch-section">
        <div className="section-container">
          <div className="section-header-centered landing-animate" ref={addAnimRef}>
            <div className="section-label">
              <i className="fa fa-sitemap"></i> System Design
            </div>
            <h2 className="section-title">System Architecture</h2>
            <p className="section-desc">
              A well-structured tripartite architecture connecting frontend portals to
              backend services, databases, and external integrations.
            </p>
          </div>

          <div className="arch-image-wrapper landing-animate" ref={addAnimRef}>
            <img
              src="/images/system_architecture.png"
              alt="HealthTrack+ System Architecture"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="cta-section">
        <div className="cta-box landing-animate" ref={addAnimRef}>
          <h2 className="cta-title">Ready to Explore?</h2>
          <p className="cta-desc">
            Log in to experience the full HealthTrack+ ecosystem — from patient
            appointments to smart prescriptions and AI-powered health assistance.
          </p>
          <div className="cta-buttons">
            <Link to="/login" className="hero-btn hero-btn-primary">
              <i className="fa fa-sign-in-alt"></i> Login Now
            </Link>
            <Link to="/register/patient" className="hero-btn hero-btn-secondary">
              <i className="fa fa-user-plus"></i> Register as Patient
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img
              src="/images/logo.png"
              alt="HealthTrack+"
              onError={(e) => { e.target.src = '/vite.svg'; }}
            />
            <span>HealthTrack+</span>
          </div>
          <div className="footer-team">
            Made with ❤️ by Team <span>getch();</span>
          </div>
          <div className="footer-text">
            Built for Modern Healthcare
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
