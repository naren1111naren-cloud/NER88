import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import govEmblem from '../assets/gov-emblem.png';

/* ─── Slide data ─────────────────────────────────────────── */
const SLIDES = [
  {
    id: 1,
    src: '/hero1.jpg',
    label: 'INFRASTRUCTURE & CONNECTIVITY',
    caption: 'Bridging the mountains — modernising road and bridge networks across 8 states',
  },
  {
    id: 2,
    src: '/hero2.jpg',
    label: 'AI-POWERED COMMAND CENTRE',
    caption: 'Real-time GIS monitoring, route intelligence and predictive logistics operations',
  },
  {
    id: 3,
    src: '/hero3.jpg',
    label: 'ESSENTIAL SUPPLY DELIVERY',
    caption: 'Seamless convoy coordination for last-mile delivery of essential supplies',
  },
];

/* ─── Workflow steps ─────────────────────────────────────── */
/* ─── Workflow steps ─────────────────────────────────────── */
const WORKFLOW = [
  {
    step: '01',
    title: 'Login & Select Role',
    desc: 'Authenticate as Admin, Dispatcher, or Field Officer to access role-specific dashboards and permissions.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad1)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <path d="M44 28C39.5817 28 36 31.5817 36 36V40H33C31.8954 40 31 40.8954 31 42V56C31 57.1046 31.8954 58 33 58H55C56.1046 58 57 57.1046 57 56V42C57 40.8954 56.1046 40 55 40H52V36C52 31.5817 48.4183 28 44 28ZM49.5 40H38.5V36C38.5 32.9624 40.9624 30.5 44 30.5C47.0376 30.5 49.5 32.9624 49.5 36V40Z" fill="#155724"/>
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#155724" />
            <stop offset="1" stopColor="#38a169" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Monitor GIS Network',
    desc: 'Open the Satellite GIS Map to view live district connectivity, bottlenecks, and lifeline corridors.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad2)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <path d="M30 32L44 26L58 32V56L44 62L30 56V32Z" stroke="#0077B6" strokeWidth="3.5" strokeLinejoin="round"/>
        <path d="M44 26V62" stroke="#0077B6" strokeWidth="2.5" strokeDasharray="3 3"/>
        <circle cx="44" cy="42" r="6" fill="#E53E3E" />
        <circle cx="44" cy="42" r="2.5" fill="#ffffff" />
        <defs>
          <linearGradient id="grad2" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0077B6" />
            <stop offset="1" stopColor="#00A859" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Track Fleet & Deliveries',
    desc: 'Monitor real-time vehicle positions, delivery status, and supply chain movement across the region.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad3)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <rect x="27" y="33" width="22" height="16" rx="2" fill="#155724" />
        <path d="M49 38H58L62 44V49H49V38Z" fill="#2F855A" />
        <circle cx="34" cy="53" r="4.5" fill="#2D3748" />
        <circle cx="55" cy="53" r="4.5" fill="#2D3748" />
        <defs>
          <linearGradient id="grad3" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2F855A" />
            <stop offset="1" stopColor="#68D391" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Respond to Alerts',
    desc: 'Receive AI-generated alerts for incidents, weather disruptions, or route blockages and dispatch resources.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad4)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <path d="M44 26L63 58H25L44 26Z" fill="#DD6B20" />
        <path d="M44 38V47" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="44" cy="52" r="2" fill="#ffffff" />
        <defs>
          <linearGradient id="grad4" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#DD6B20" />
            <stop offset="1" stopColor="#F6AD55" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    step: '05',
    title: 'File Field Reports',
    desc: 'Field officers submit geotagged reports directly from mobile; data syncs even in low-network zones.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad5)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <rect x="30" y="27" width="28" height="34" rx="3" fill="#3182CE" />
        <rect x="36" y="24" width="16" height="5" rx="2" fill="#2B6CB0" />
        <line x1="36" y1="36" x2="52" y2="36" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="36" y1="43" x2="48" y2="43" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="36" y1="50" x2="52" y2="50" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
        <defs>
          <linearGradient id="grad5" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3182CE" />
            <stop offset="1" stopColor="#63B3ED" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    step: '06',
    title: 'Analyse & Export',
    desc: 'Generate district-wise analytics, accessibility scores, and export operational summaries for leadership.',
    graphic: (
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        <circle cx="44" cy="44" r="40" fill="url(#grad6)" />
        <circle cx="44" cy="44" r="32" fill="#ffffff" />
        <rect x="30" y="44" width="7" height="14" rx="2" fill="#805AD5" />
        <rect x="41" y="34" width="7" height="24" rx="2" fill="#D69E2E" />
        <rect x="52" y="27" width="7" height="31" rx="2" fill="#319795" />
        <defs>
          <linearGradient id="grad6" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#805AD5" />
            <stop offset="1" stopColor="#B794F4" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

/* ─── Key facts ──────────────────────────────────────────── */
const FACTS = [
  { value: '8', label: 'States Covered' },
  { value: '200+', label: 'Districts Monitored' },
  { value: '15,000+', label: 'km Road Network' },
  { value: '24×7', label: 'Real-Time Monitoring' },
];

/* ─── Inline styles ──────────────────────────────────────── */
const s = {
  root: { fontFamily: "'Noto Sans', 'Inter', 'Segoe UI', sans-serif", background: '#fff', minHeight: '100vh', color: '#1a1a1a' },
  /* Header */
  header: { background: '#fff', borderBottom: '1px solid #dde1e0', padding: '10px 0' },
  headerInner: { maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  emblem: { height: 54, width: 54, objectFit: 'contain' },
  orgBlock: { display: 'flex', flexDirection: 'column' },
  orgSub: { fontSize: 11.5, color: '#666', letterSpacing: 0.2 },
  orgMain: { fontSize: 14.5, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.35, maxWidth: 440 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 18 },
  digitalBadge: { display: 'flex', alignItems: 'center', gap: 8 },
  diCircle: { width: 38, height: 38, borderRadius: '50%', background: 'conic-gradient(#FF6B00 0% 50%, #00A859 50% 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, fontStyle: 'italic', flexShrink: 0 },
  diTitle: { fontWeight: 700, fontSize: 13, color: '#1a1a2e', lineHeight: 1 },
  diSub: { fontSize: 10, color: '#666', marginTop: 2 },
  headerDivider: { width: 1, height: 36, background: '#ddd' },
  loginBtn: { background: '#155724', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 22px', fontWeight: 600, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 },
  /* Nav */
  nav: { background: '#fff', borderBottom: '3px solid #155724' },
  navInner: { maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 },
  navItem: { padding: '11px 18px', fontSize: 13.5, fontWeight: 500, color: '#333', cursor: 'pointer', borderBottom: '3px solid transparent', marginBottom: -3, userSelect: 'none' },
  navActive: { color: '#155724', fontWeight: 700, borderBottom: '3px solid #155724' },
  /* Carousel */
  carousel: { position: 'relative', width: '100%', height: 420, overflow: 'hidden', background: '#111' },
  slide: { position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center' },
  slideOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.05) 100%)' },
  slideLabel: { position: 'absolute', bottom: 80, right: 48, color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: 2, textShadow: '0 2px 12px rgba(0,0,0,0.7)', textAlign: 'right', maxWidth: 420, lineHeight: 1.25, textTransform: 'uppercase' },
  slideCaption: { position: 'absolute', bottom: 44, right: 48, color: 'rgba(255,255,255,0.88)', fontSize: 14, textAlign: 'right', maxWidth: 380, textShadow: '0 1px 6px rgba(0,0,0,0.6)' },
  arrow: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.38)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 18, cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.25s' },
  dotActive: { background: '#fff', width: 24, borderRadius: 4 },
  /* Stats bar */
  statsBar: { background: '#155724', display: 'flex', justifyContent: 'center', gap: 0 },
  statItem: { flex: 1, maxWidth: 240, padding: '18px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' },
  statValue: { fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 },
  statLabel: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 5, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
  /* About section */
  section: { background: '#fff', padding: '52px 0 44px', borderBottom: '1px solid #eee' },
  inner: { maxWidth: 960, margin: '0 auto', padding: '0 32px' },
  tag: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#155724', textTransform: 'uppercase', marginBottom: 10 },
  h2: { fontSize: 25, fontWeight: 800, color: '#1a1a2e', marginBottom: 18, lineHeight: 1.35 },
  h2w: { fontSize: 25, fontWeight: 800, color: '#fff', marginBottom: 18, lineHeight: 1.35 },
  body: { fontSize: 15, color: '#444', lineHeight: 1.78, marginBottom: 14 },
  ctaBtn: { marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#155724', border: '2px solid #155724', borderRadius: 4, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 0.3 },
  /* Workflow */
  wfSection: { background: 'linear-gradient(135deg, #0a2918 0%, #155724 70%, #1a6b2f 100%)', padding: '60px 0 56px' },
  wfGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 36, marginBottom: 40 },
  wfCard: { background: '#ffffff', borderRadius: 12, padding: '32px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  wfIcon: { display: 'flex', justifyContent: 'center', marginBottom: 12 },
  wfStep: { fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#718096', marginBottom: 4, textTransform: 'uppercase' },
  wfTitle: { fontSize: 16, fontWeight: 800, color: '#1a202c', marginTop: 12, marginBottom: 8 },
  wfDesc: { fontSize: 13, color: '#4a5568', lineHeight: 1.65 },
  centerCta: { display: 'flex', justifyContent: 'center', marginTop: 8 },
  enterBtn: { background: '#ffffff', color: '#155724', border: 'none', borderRadius: 6, padding: '14px 44px', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  /* Footer */
  footer: { background: '#111', padding: '20px 0' },
  footerInner: { maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  footerLeft: { display: 'flex', alignItems: 'center' },
  footerRight: { fontSize: 12, color: '#777', display: 'flex', gap: 10, alignItems: 'center' },
  footerSep: { color: '#444' },
};

export function Welcome() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  const goTo = useCallback((idx) => {
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 380);
  }, []);

  useEffect(() => {
    const t = setInterval(() => goTo((prev) => (prev + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [goTo]);

  return (
    <div style={s.root}>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.headerLeft}>
            <img src={govEmblem} alt="Emblem of India" style={{ ...s.emblem, height: 56, width: 56, objectFit: 'contain' }} />
            <div style={s.orgBlock}>
              <span style={s.orgSub}>Government of India</span>
              <span style={s.orgMain}>NER88 — North East Region Intelligent Logistics Platform</span>
            </div>
          </div>
          <div style={s.headerRight}>
            <div style={s.digitalBadge}>
              <div style={s.diCircle}>i</div>
              <div>
                <div style={s.diTitle}>Digital India</div>
                <div style={s.diSub}>Power To Empower</div>
              </div>
            </div>
            <div style={s.headerDivider} />
            <button style={s.loginBtn} onClick={() => navigate('/login')}>Login</button>
          </div>
        </div>
      </header>

      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          {['Home', 'About NER88', 'Features', 'States', 'How To Use', 'Contact'].map((item, i) => (
            <span key={item} style={{ ...s.navItem, ...(i === 0 ? s.navActive : {}) }}>{item}</span>
          ))}
        </div>
      </nav>

      {/* ── HERO CAROUSEL ── */}
      <section style={s.carousel}>
        <div
          style={{
            ...s.slide,
            backgroundImage: `url(${SLIDES[current].src})`,
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.38s ease',
          }}
        >
          <div style={s.slideOverlay} />
          <div style={s.slideLabel}>{SLIDES[current].label}</div>
          <div style={s.slideCaption}>{SLIDES[current].caption}</div>
        </div>
        <button style={{ ...s.arrow, left: 16 }} onClick={() => goTo((current - 1 + SLIDES.length) % SLIDES.length)} aria-label="Prev">&#10094;</button>
        <button style={{ ...s.arrow, right: 16 }} onClick={() => goTo((current + 1) % SLIDES.length)} aria-label="Next">&#10095;</button>
        <div style={s.dots}>
          {SLIDES.map((sl, i) => (
            <button key={sl.id} style={{ ...s.dot, ...(i === current ? s.dotActive : {}) }} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={s.statsBar}>
        {FACTS.map((f, i) => (
          <div key={f.label} style={{ ...s.statItem, ...(i === FACTS.length - 1 ? { borderRight: 'none' } : {}) }}>
            <span style={s.statValue}>{f.value}</span>
            <span style={s.statLabel}>{f.label}</span>
          </div>
        ))}
      </section>

      {/* ── ABOUT NER ── */}
      <section style={s.section}>
        <div style={s.inner}>
          <div style={s.tag}>ABOUT THE REGION</div>
          <h2 style={s.h2}>North Eastern India — A Strategic Frontier</h2>
          <p style={s.body}>
            The North Eastern Region (NER) of India encompasses eight states — Assam, Arunachal Pradesh,
            Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, and Tripura — covering approximately{' '}
            <strong>2,62,179 sq km</strong>. The region's rugged terrain, seasonal flooding, and distributed
            settlements make efficient supply-chain management critical for over <strong>46 million citizens</strong>.
          </p>
          <p style={s.body}>
            NER88 is an AI-powered logistics and connectivity monitoring platform delivering real-time route
            intelligence, GIS-based accessibility monitoring, GPS fleet tracking, and emergency response
            coordination across all eight states — 24 hours a day, 7 days a week.
          </p>
          <button style={s.ctaBtn} onClick={() => navigate('/network')}>
            🗺️&nbsp; Go to GIS Map
          </button>
        </div>
      </section>

      {/* ── WORKFLOW ── */}
      <section style={s.wfSection}>
        <div style={s.inner}>
          <div style={{ ...s.tag, color: 'rgba(255,255,255,0.7)' }}>HOW IT WORKS</div>
          <h2 style={{ ...s.h2w, color: '#ffffff' }}>Using NER88 — Step by Step Workflow</h2>
          <div style={s.wfGrid}>
            {WORKFLOW.map((w) => (
              <div key={w.step} style={s.wfCard}>
                <div style={s.wfIcon}>{w.graphic}</div>
                <div style={s.wfStep}>STEP {w.step}</div>
                <div style={s.wfTitle}>{w.title}</div>
                <div style={s.wfDesc}>{w.desc}</div>
              </div>
            ))}
          </div>
          <div style={s.centerCta}>
            <button style={s.enterBtn} onClick={() => navigate('/login')}>
              Enter Command Centre &nbsp;→
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerLeft}>
            <img src={govEmblem} alt="Emblem of India" style={{ height: 38, width: 38, objectFit: 'contain', opacity: 0.9 }} />
            <div style={{ marginLeft: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#ddd' }}>NER88</div>
              <div style={{ fontSize: 11, color: '#666' }}>Ministry of Development of North Eastern Region</div>
            </div>
          </div>
          <div style={s.footerRight}>
            <span>© 2025 Government of India</span>
            <span style={s.footerSep}>|</span>
            <span>NER88 Logistics Platform</span>
            <span style={s.footerSep}>|</span>
            <span>Built for SIH 2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
