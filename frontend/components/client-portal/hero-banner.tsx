"use client";

export function HeroBanner() {
  return (
    <section className="client-hero-banner" aria-label="Welcome Banner">
      <div className="client-hero-bg" aria-hidden="true" />
      <div className="client-hero-overlay" aria-hidden="true" />

      {/* Left content block */}
      <div className="client-hero-content">
        <p className="client-hero-kicker">PLAY &nbsp;·&nbsp; WORK &nbsp;·&nbsp; STUDY &nbsp;·&nbsp; CONNECT</p>
        <h2 className="client-hero-title">
          Good Internet.
          <br />
          Greater Moments.
        </h2>
        <p className="client-hero-subtitle">Fast. Reliable. Always for you.</p>
      </div>

      {/* Cursive Handwriting Accent */}
      <div className="client-hero-script-wrapper" aria-hidden="true">
        <span className="client-hero-script">Your</span>
        <span className="client-hero-script-sub">Digital Hangout!</span>
        <div className="client-hero-script-underline" />
      </div>
    </section>
  );
}
