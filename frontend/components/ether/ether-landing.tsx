"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  Coffee,
  Computer,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Printer,
  RefreshCw,
  Users,
  Wifi,
  X,
  VolumeX,
} from "lucide-react";

/* ─── Legal documents ─── */
const LEGAL_DOCS: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Data Privacy Act of 2012 (RA 10173)",
        body: "INTERNET CAFE respects your privacy and is committed to protecting your personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations. This policy explains how we collect, use, store, and protect your information when you use our facilities and services."
      },
      {
        heading: "Information We Collect",
        body: "We collect information necessary to provide and improve our services: (1) Account registration data including name, contact details, email address, and government-issued ID when required for verification. (2) Session and billing records including time of use, assigned station, payment method, and transaction amounts. (3) Technical data including device identifiers, IP addresses, MAC addresses, and network usage logs for session management and security purposes. (4) Communication records when you contact our support team."
      },
      {
        heading: "How We Use Your Information",
        body: "Your data is used solely for: managing your account and sessions; processing payments and generating receipts; ensuring network security and compliance with facility rules; improving our services and customer experience; complying with legal obligations including law enforcement requests under proper legal process; and sending service-related notifications with your consent."
      },
      {
        heading: "Data Storage and Security",
        body: "All personal data is stored securely using industry-standard encryption and access controls. Session logs and transaction records are retained for a minimum of five (5) years as required by Philippine tax and business regulations. We implement physical, technical, and organizational security measures including access-controlled premises, encrypted storage, secure authentication, and regular security audits."
      },
      {
        heading: "Your Rights",
        body: "Under RA 10173, you have the right to: access and obtain copies of your personal data; correct inaccurate or incomplete data; object to processing of your data in certain circumstances; request erasure of your data when legally permissible; and file a complaint with the National Privacy Commission (NPC) if you believe your privacy rights have been violated."
      },
      {
        heading: "Data Sharing",
        body: "We do not sell or rent your personal data to third parties. We may share data with: law enforcement agencies upon presentation of a valid court order or subpoena; payment processors to complete transactions; service providers who assist in operating our facilities under strict confidentiality agreements; and regulatory authorities as required by law."
      },
      {
        heading: "Contact",
        body: "For privacy-related inquiries or to exercise your data rights, contact our Data Protection Officer at privacy@internetcafe.ph or visit our facility during operating hours."
      }
    ]
  },
  terms: {
    title: "Terms and Conditions",
    sections: [
      {
        heading: "Acceptance of Terms",
        body: "By registering for an account, entering our premises, or using any service provided by INTERNET CAFE, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services. We reserve the right to update these terms at any time; continued use constitutes acceptance of the revised terms."
      },
      {
        heading: "Acceptable Use Policy",
        body: "All users must adhere to the following acceptable use guidelines: (a) Do not access, transmit, or distribute illegal, offensive, or harmful content including but not limited to copyrighted material without authorization, malware, or content that violates Philippine law. (b) Do not attempt to bypass network security measures, access restricted systems, or interfere with other users sessions. (c) Do not use our network for spam, phishing, unauthorized port scanning, or any activity that degrades network performance for other users. (d) Do not share your account credentials with others; each session is tied to a registered account."
      },
      {
        heading: "Session and Billing Terms",
        body: "Hourly rates are billed in minimum increments as specified at the time of booking. Session time begins upon successful client authentication at the assigned station and ends when the user logs out or the session is terminated by staff. Unused prepaid time is non-refundable and non-transferable between accounts unless explicitly stated in writing. Rates are subject to change with reasonable notice posted at the facility and on our website."
      },
      {
        heading: "Facility Rules",
        body: "Users must comply with all posted facility rules and staff instructions. Users are responsible for their personal belongings; INTERNET CAFE is not liable for lost, stolen, or damaged items. Smoking, vaping, and illegal substances are strictly prohibited. Minors must be accompanied by a responsible adult at all times."
      },
      {
        heading: "Limitation of Liability",
        body: "INTERNET CAFE shall not be liable for any indirect, incidental, special, or consequential damages arising from the use or inability to use our services. Our total liability shall not exceed the amount paid by you for the specific service giving rise to the claim."
      },
      {
        heading: "Termination",
        body: "We reserve the right to terminate or suspend any account, session, or access to our facilities without prior notice if we determine that a user has violated these terms, engaged in illegal activity, or disrupted the safe and orderly operation of our business. Upon termination, outstanding balances must be settled within 24 hours."
      }
    ]
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      {
        heading: "What Are Cookies",
        body: "Cookies are small text files stored on your device when you visit our website. They help us improve your browsing experience, remember your preferences, and understand how our website is used."
      },
      {
        heading: "Essential Cookies",
        body: "These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and accessibility. You cannot opt out of these cookies as the website cannot function without them."
      },
      {
        heading: "Analytics Cookies",
        body: "We may use privacy-focused analytics tools that do not use cookies or set persistent identifiers. These tools help us understand page visits and user behavior without collecting personally identifiable information. No third-party advertising cookies are used on this website."
      },
      {
        heading: "Managing Cookies",
        body: "Most web browsers allow you to control cookies through their settings. You can set your browser to refuse all cookies or to alert you when a cookie is being sent. However, disabling essential cookies may affect the functionality of our website."
      },
      {
        heading: "Updates to This Policy",
        body: "We may update this Cookie Policy from time to time. The updated version will be posted on this page with a revised effective date. We encourage you to review this policy periodically."
      }
    ]
  },
  refund: {
    title: "Refund Policy",
    sections: [
      {
        heading: "General Policy",
        body: "INTERNET CAFE strives to provide reliable and high-quality services. However, we understand that circumstances may arise requiring refund consideration. This policy outlines our approach to refunds and credits for unused services."
      },
      {
        heading: "Unused Prepaid Time",
        body: "Prepaid session time is non-refundable once activated, as time-based sessions are consumed in real-time. However, if a system malfunction or technical issue on our part prevents you from using purchased time, we may issue a credit or extension to your account at our discretion."
      },
      {
        heading: "Room Booking Cancellations",
        body: "Private room and discussion room bookings may be cancelled with at least 24 hours notice for a full refund or credit. Cancellations made less than 24 hours before the scheduled booking may be subject to a 50% cancellation fee. No-shows are non-refundable."
      },
      {
        heading: "System Downtime Compensation",
        body: "In the event of extended system downtime affecting your active session, we will compensate affected users by extending their session time proportionally to the downtime duration or issuing a credit to their account for future use."
      },
      {
        heading: "Dispute Resolution",
        body: "If you have a billing dispute or service concern, please speak with a manager on duty during operating hours. Unresolved disputes may be escalated to our management team for review."
      },
      {
        heading: "Contact for Refunds",
        body: "To request a refund or credit, contact us at billing@internetcafe.ph or visit our facility during operating hours with your receipt or account details. Refund requests are typically reviewed within 3-5 business days."
      }
    ]
  }
};

/* ─── Cookie consent hook ─── */
function useCookieConsent() {
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ether-cookie-consent") as "accepted" | "rejected" | null;
      if (stored) {
        setConsent(stored);
      } else {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  const saveConsent = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem("ether-cookie-consent", value);
    } catch {
      // ignore storage errors
    }
    setConsent(value);
    setShowBanner(false);
    setShowPrefs(false);
  };

  return { consent, showBanner, showPrefs, setShowPrefs, saveConsent };
}

/* ─── Data constants ─── */
const WORKSPACE_STATS = [
  { label: "Stations", value: "24", icon: Computer },
  { label: "Speed", value: "1 Gbps", icon: Wifi },
  { label: "Private Rooms", value: "3+", icon: Users },
];

const BENEFITS = [
  { icon: Wifi, title: "Fast & Reliable", desc: "Unlimited high-speed Wi-Fi for uninterrupted work." },
  { icon: VolumeX, title: "Quiet Workspaces", desc: "A peaceful environment designed for deep focus." },
  { icon: Coffee, title: "Coffee Included", desc: "Premium coffee and drinks to fuel your productivity." },
];

const SERVICES = [
  { icon: Wifi, title: "High-Speed Wi-Fi", desc: "Symmetric gigabit fiber with no device limits per user." },
  { icon: Coffee, title: "Premium Coffee", desc: "Ethically sourced beans, precision-brewed by our baristas." },
  { icon: Printer, title: "Print & Scan", desc: "On-site printing and scanning for documents and photos." },
  { icon: Monitor, title: "Comfortable Stations", desc: "Ergonomic chairs, wide monitors, ambient lighting." },
  { icon: Users, title: "Private Rooms", desc: "Sound-treated rooms with whiteboards and conferencing displays." },
];

const FEATURED_RATES = [
  { price: "50", period: "/hr", name: "Casual Stay", desc: "For quick tasks and browsing.", featured: false, badge: null },
  { price: "180", period: "/day", name: "Essential Day", desc: "For focused all-day work.", featured: true, badge: "MOST POPULAR" },
  { price: "1,500", period: "", name: "Discussion Room (1–5 pax)", desc: "Private workspace for teams.", featured: false, badge: null },
];

/* ─── Main Component ─── */
export function EtherLanding({ onShowAuth }: { onShowAuth: () => void }) {
  const { showBanner, showPrefs, setShowPrefs, saveConsent } = useCookieConsent();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const legalLinks = [
    { label: "Privacy Policy", docKey: "privacy" },
    { label: "Terms & Conditions", docKey: "terms" },
    { label: "Cookie Policy", docKey: "cookies" },
    { label: "Refund Policy", docKey: "refund" },
  ];

  return (
    <main className="lp-root">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ─── NAVBAR ─── */}
      <header className={`lp-nav-wrap${scrolled ? " lp-nav-scrolled" : ""}`} role="banner">
        <nav className="lp-nav" aria-label="Main navigation">
          <a href="#" className="lp-brand" aria-label="INTERNET CAFE home">
            <span className="lp-brand-mark" aria-hidden="true">I</span>
            <span className="lp-brand-text">INTERNET CAFE</span>
          </a>
          <div className="lp-nav-links">
            <a href="#">Home</a>
            <a href="#rates">Rates</a>
            <a href="#rooms">Rooms</a>
            <a href="#services">Services</a>
          </div>
          <div className="lp-nav-actions">
            <button className="lp-portal-btn" onClick={() => onShowAuth()} aria-label="Open portal login">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              PORTAL LOGIN
            </button>
            <button className="lp-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} aria-expanded={mobileMenuOpen}>
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="#" onClick={() => setMobileMenuOpen(false)}>Home</a>
            <a href="#rates" onClick={() => setMobileMenuOpen(false)}>Rates</a>
            <a href="#rooms" onClick={() => setMobileMenuOpen(false)}>Rooms</a>
            <a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a>
            <button className="lp-portal-btn lp-portal-btn--mobile" onClick={() => { setMobileMenuOpen(false); onShowAuth(); }}>
              PORTAL LOGIN
            </button>
          </div>
        )}
      </header>

      <div id="main-content">

        {/* ─── HERO ─── */}
        <section
          className="lp-hero"
          style={{ backgroundImage: "url('/images/dashboard/hero-cafe.jpg')" }}
          aria-labelledby="hero-heading"
        >
          <div className="lp-hero-overlay" aria-hidden="true" />
          <div className="lp-hero-inner">
            <div className="lp-hero-content">
              <p className="lp-hero-kicker">WORK • STUDY • CREATE • BELONG</p>
              <h1 id="hero-heading" className="lp-hero-h1">
                A sanctuary for<br />
                <em className="lp-hero-em">deep work</em><br />
                and coffee.
              </h1>
              <p className="lp-hero-desc">
                Premium connectivity, specialty roasts, and quiet corners designed for students and professionals who value focus.
              </p>
              <div className="lp-hero-ctas">
                <button className="lp-btn-primary" onClick={() => onShowAuth()}>
                  Book a Room <ArrowRight size={16} aria-hidden="true" />
                </button>
                <a href="#rates" className="lp-btn-outline">View Passes</a>
              </div>
            </div>
            <div className="lp-hero-panel" aria-label="Workspace overview">
              <div className="lp-panel-header">
                <span className="lp-panel-dot" aria-hidden="true" />
                <span className="lp-panel-dot" aria-hidden="true" />
                <span className="lp-panel-dot" aria-hidden="true" />
                <span className="lp-panel-title">WORKSPACE OVERVIEW</span>
              </div>
              <div className="lp-panel-stats">
                {WORKSPACE_STATS.map((stat) => (
                  <div key={stat.label} className="lp-stat-card">
                    <div className="lp-stat-icon" aria-hidden="true">
                      <stat.icon size={18} />
                    </div>
                    <p className="lp-stat-label">{stat.label}</p>
                    <p className="lp-stat-value">{stat.value}</p>
                  </div>
                ))}
              </div>
              <p className="lp-panel-script" aria-hidden="true">Good Ideas<br />Better Coffee</p>
            </div>
          </div>
        </section>

        {/* ─── BENEFITS ─── */}
        <section className="lp-benefits" aria-label="Key benefits">
          <div className="lp-benefits-inner">
            {BENEFITS.map((b, i) => (
              <div key={b.title} className="lp-benefit-item">
                <div className="lp-benefit-icon" aria-hidden="true">
                  <b.icon size={20} />
                </div>
                <div className="lp-benefit-text">
                  <h3 className="lp-benefit-title">{b.title}</h3>
                  <p className="lp-benefit-desc">{b.desc}</p>
                </div>
                {i < BENEFITS.length - 1 && <div className="lp-benefit-sep" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>

        {/* ─── OUR SPACES ─── */}
        <section id="rooms" className="lp-section" aria-labelledby="spaces-heading">
          <div className="lp-section-inner">
            <div className="lp-section-head">
              <span className="lp-eyebrow" aria-hidden="true">OUR SPACES</span>
              <h2 id="spaces-heading" className="lp-section-h2">Work the way you want.</h2>
              <p className="lp-section-sub">
                From individual nooks to private rooms, INTERNET CAFE gives you the space to focus, collaborate, and do more.
              </p>
            </div>
            <div className="lp-spaces-grid">
              <div
                className="lp-space-card"
                style={{ backgroundImage: "url('/images/dashboard/gaming-setup.jpg')" }}
                role="region"
                aria-label="Individual Workstations"
              >
                <div className="lp-space-overlay" aria-hidden="true" />
                <div className="lp-space-content">
                  <span className="lp-space-tag">INDIVIDUAL WORKSTATIONS</span>
                  <p className="lp-space-desc">Quiet personal spaces built for focused work.</p>
                  <button className="lp-space-link" onClick={() => onShowAuth()}>
                    Explore Stations <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div
                className="lp-space-card"
                style={{ backgroundImage: "url('/images/dashboard/discussion-room.jpg')" }}
                role="region"
                aria-label="Discussion Rooms"
              >
                <div className="lp-space-overlay" aria-hidden="true" />
                <div className="lp-space-content">
                  <span className="lp-space-tag">DISCUSSION ROOMS</span>
                  <p className="lp-space-desc">Private rooms for teams, meetings and study.</p>
                  <button className="lp-space-link" onClick={() => onShowAuth()}>
                    Explore Rooms <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURED PRICING ─── */}
        <section id="rates" className="lp-section lp-section--alt" aria-labelledby="pricing-heading">
          <div className="lp-section-inner">
            <div className="lp-pricing-head">
              <div>
                <span className="lp-eyebrow" aria-hidden="true">WORK AT YOUR PACE</span>
                <h2 id="pricing-heading" className="lp-section-h2">Simple pricing for serious work.</h2>
                <p className="lp-section-sub">Choose the plan that fits your workflow. All plans include unlimited high-speed Wi-Fi.</p>
              </div>
              <button className="lp-view-all" onClick={() => onShowAuth()}>
                View All Rates <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="lp-pricing-grid">
              {FEATURED_RATES.map((rate) => (
                <div key={rate.name} className={`lp-rate-card${rate.featured ? " lp-rate-card--featured" : ""}`}>
                  {rate.badge && <span className="lp-rate-badge">{rate.badge}</span>}
                  <div className="lp-rate-price">
                    <span className="lp-rate-currency">₱</span>
                    <span className="lp-rate-amount">{rate.price}</span>
                    {rate.period && <span className="lp-rate-period">{rate.period}</span>}
                  </div>
                  <p className="lp-rate-name">{rate.name}</p>
                  <p className="lp-rate-desc">{rate.desc}</p>
                  <button className={`lp-rate-cta${rate.featured ? " lp-rate-cta--featured" : ""}`} onClick={() => onShowAuth()} aria-label={`Book ${rate.name}`}>
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SERVICES ─── */}
        <section id="services" className="lp-section" aria-labelledby="services-heading">
          <div className="lp-section-inner">
            <div className="lp-section-head lp-section-head--center">
              <span className="lp-eyebrow" aria-hidden="true">MORE THAN A WORKSPACE</span>
              <h2 id="services-heading" className="lp-section-h2">Everything within reach.</h2>
              <p className="lp-section-sub">Essential services to make your stay comfortable and productive.</p>
            </div>
            <div className="lp-services-list">
              {SERVICES.map((svc, i) => (
                <div key={svc.title} className="lp-service-item">
                  <div className="lp-service-icon" aria-hidden="true">
                    <svc.icon size={20} />
                  </div>
                  <div className="lp-service-text">
                    <h3 className="lp-service-title">{svc.title}</h3>
                    <p className="lp-service-desc">{svc.desc}</p>
                  </div>
                  {i < SERVICES.length - 1 && <div className="lp-service-sep" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="lp-cta" aria-labelledby="cta-heading">
          <div className="lp-cta-inner">
            <div className="lp-cta-text">
              <span className="lp-cta-kicker" aria-hidden="true">YOUR NEXT PRODUCTIVE DAY</span>
              <h2 id="cta-heading" className="lp-cta-h2">Your desk is ready.</h2>
              <p className="lp-cta-desc">Focus, connect, and get things done at INTERNET CAFE.</p>
              <div className="lp-cta-actions">
                <button className="lp-btn-cta-primary" onClick={() => onShowAuth()}>
                  Book a Room <ArrowRight size={16} aria-hidden="true" />
                </button>
                <a href="#rates" className="lp-btn-cta-outline">View Rates</a>
              </div>
            </div>
            <div className="lp-cta-image-wrap" aria-hidden="true">
              <img
                src="/images/dashboard/coffee-latte-art.jpg"
                alt="Specialty coffee at INTERNET CAFE"
                className="lp-cta-image"
              />
              <div className="lp-cta-image-overlay" />
              <p className="lp-cta-script">Good Work<br />Tastes Better</p>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="lp-footer" role="contentinfo">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand-col">
              <div className="lp-footer-brand">
                <span className="lp-footer-brand-mark" aria-hidden="true">I</span>
                <span>INTERNET CAFE</span>
              </div>
              <p className="lp-footer-slogan">A sanctuary for deep work and coffee.</p>
              <p className="lp-footer-tagline">Work • Study • Create • Belong</p>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Navigate</h4>
              <ul className="lp-footer-links">
                <li><a href="#">Home</a></li>
                <li><a href="#rates">Rates</a></li>
                <li><a href="#rooms">Rooms</a></li>
                <li><a href="#services">Services</a></li>
                <li>
                  <button className="lp-footer-portal-link" onClick={() => onShowAuth()}>
                    Portal Login
                  </button>
                </li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Legal</h4>
              <ul className="lp-footer-links">
                {legalLinks.map((link) => (
                  <li key={link.docKey}>
                    <button className="lp-footer-legal-btn" onClick={() => setActiveDoc(link.docKey)}>
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Opening Hours</h4>
              <p className="lp-footer-hours">Mon – Sun</p>
              <p className="lp-footer-hours lp-footer-hours--time">8:00 AM – 10:00 PM</p>
              <div className="lp-footer-contact">
                <a href="mailto:hello@internetcafe.ph" className="lp-footer-contact-link">
                  <Mail size={13} aria-hidden="true" /> hello@internetcafe.ph
                </a>
                <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="lp-footer-contact-link">
                  <MapPin size={13} aria-hidden="true" /> Manila, Philippines
                </a>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 INTERNET CAFE. All rights reserved.</span>
            <span className="lp-footer-tagline-sm">Work • Study • Create • Belong</span>
          </div>
        </footer>
      </div>

      {/* ─── Cookie Banner ─── */}
      {showBanner && (
        <aside className="cookie-banner" role="dialog" aria-labelledby="cookie-heading" aria-modal="true">
          <p id="cookie-heading">
            We use essential cookies for site functionality. We do not use third-party advertising cookies.{" "}
            <button
              onClick={() => setShowPrefs(true)}
              style={{ background: "none", border: "none", color: "var(--gold-light)", textDecoration: "underline", cursor: "pointer", fontSize: 14, padding: 0, display: "inline" }}
            >
              Manage preferences
            </button>
          </p>
          <div className="cookie-actions">
            <button className="cookie-btn" onClick={() => saveConsent("rejected")}>Reject Non-Essential</button>
            <button className="cookie-btn primary" onClick={() => saveConsent("accepted")}>Accept All</button>
          </div>
        </aside>
      )}

      {/* ─── Cookie Preferences Modal ─── */}
      {showPrefs && (
        <div className="legal-overlay" onClick={() => setShowPrefs(false)} role="dialog" aria-labelledby="cookie-prefs-heading" aria-modal="true">
          <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2 id="cookie-prefs-heading">Cookie Preferences</h2>
              <button onClick={() => setShowPrefs(false)} className="icon-button" aria-label="Close cookie preferences" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="legal-body">
              <h3>Essential Cookies</h3>
              <p>These cookies are required for the website to function and cannot be disabled.</p>
              <h3>Analytics Cookies</h3>
              <p>We use privacy-focused analytics that do not store personally identifiable information.</p>
              <h3>Your Choice</h3>
              <p>You may accept or reject non-essential cookies. Your preference will be saved for future visits.</p>
            </div>
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => saveConsent("rejected")} style={{ background: "var(--cream-3)", color: "var(--ink)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Reject</button>
              <button onClick={() => saveConsent("accepted")} style={{ background: "var(--olive)", color: "var(--cream)", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Legal Document Modal ─── */}
      {activeDoc && (
        <div className="legal-overlay" onClick={() => setActiveDoc(null)} role="dialog" aria-labelledby={`legal-heading-${activeDoc}`} aria-modal="true">
          <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2 id={`legal-heading-${activeDoc}`}>{LEGAL_DOCS[activeDoc]?.title}</h2>
              <button onClick={() => setActiveDoc(null)} className="icon-button" aria-label={`Close ${LEGAL_DOCS[activeDoc]?.title}`} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="legal-body">
              {LEGAL_DOCS[activeDoc]?.sections.map((section, i) => (
                <div key={i}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setActiveDoc(null)} style={{ background: "var(--olive)", color: "var(--cream)", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
