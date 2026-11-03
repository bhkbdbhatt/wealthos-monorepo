const features = [
  {
    number: '01',
    title: 'Advisor operating system',
    copy: 'Manage households, review portfolios, track tasks, and turn every client conversation into focused action.',
  },
  {
    number: '02',
    title: 'Investor experience',
    copy: 'Give clients one clear view of holdings, goals, SIPs, statements, and the progress they are building.',
  },
  {
    number: '03',
    title: 'Compliance built in',
    copy: 'Move faster with guided KYC workflows, auditable records, role-based access, and encrypted personal data.',
  },
  {
    number: '04',
    title: 'Growth intelligence',
    copy: 'Segment your book, understand AUM movement, measure adviser performance, and act on retention risks.',
  },
];

const metrics = [
  ['360°', 'client view'],
  ['One', 'connected platform'],
  ['Paise', 'accurate money logic'],
  ['24/7', 'portfolio visibility'],
];

export default function HomePage() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="WealthOS home">
          <span className="brand-mark">W</span>
          <span>WealthOS</span>
        </a>
        <div className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact</a>
        </div>
        <a className="nav-cta" href="#contact">Book a demo</a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Built for modern wealth teams</p>
          <h1>Run wealth. <em>Remarkably well.</em></h1>
          <p className="hero-lede">
            One intelligent platform to acquire, advise, onboard, and retain clients — without stitching together a dozen tools.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#contact">Schedule a walkthrough <span>↗</span></a>
            <a className="text-link" href="#platform">Explore the platform ↓</a>
          </div>
        </div>

        <div className="product-window" aria-label="WealthOS dashboard preview">
          <div className="window-bar">
            <div className="window-dots"><i /><i /><i /></div>
            <span>wealthos / overview</span>
          </div>
          <div className="dashboard">
            <aside>
              <div className="mini-brand">W</div>
              <div className="mini-nav active" />
              <div className="mini-nav" />
              <div className="mini-nav" />
              <div className="mini-nav short" />
            </aside>
            <div className="dashboard-main">
              <div className="dashboard-head">
                <div>
                  <small>GOOD MORNING</small>
                  <strong>Your wealth book</strong>
                </div>
                <div className="avatar">AR</div>
              </div>
              <div className="metric-row">
                <div className="metric-card featured"><small>Total AUM</small><b>₹248.6 Cr</b><span>↑ 12.4%</span></div>
                <div className="metric-card"><small>Active clients</small><b>1,284</b><span>↑ 8.2%</span></div>
                <div className="metric-card"><small>Revenue MTD</small><b>₹18.4 L</b><span>↑ 4.1%</span></div>
              </div>
              <div className="dashboard-grid">
                <div className="chart-card">
                  <div className="card-title"><span>AUM growth</span><small>12 months</small></div>
                  <div className="chart">
                    <svg viewBox="0 0 600 220" role="img" aria-label="AUM growth chart">
                      <defs>
                        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#35d49a" stopOpacity=".35" />
                          <stop offset="100%" stopColor="#35d49a" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path className="area" d="M0 185 C55 175 78 150 125 158 C180 168 188 118 245 126 C300 134 322 86 380 98 C435 108 455 55 510 64 C550 70 574 38 600 28 L600 220 L0 220 Z" />
                      <path className="line" d="M0 185 C55 175 78 150 125 158 C180 168 188 118 245 126 C300 134 322 86 380 98 C435 108 455 55 510 64 C550 70 574 38 600 28" />
                    </svg>
                  </div>
                </div>
                <div className="activity-card">
                  <div className="card-title"><span>Priority actions</span><small>View all</small></div>
                  <div className="activity-row"><b>RK</b><span><strong>Risk profile review</strong><small>Rakesh K.</small></span><i>Today</i></div>
                  <div className="activity-row"><b>SM</b><span><strong>Onboarding complete</strong><small>Sana Mehta</small></span><i>9:30</i></div>
                  <div className="activity-row"><b>VP</b><span><strong>Goal review due</strong><small>Vikram P.</small></span><i>11:00</i></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Platform highlights">
        {metrics.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <section className="platform" id="platform">
        <div className="section-heading">
          <p className="eyebrow">The WealthOS platform</p>
          <h2>Everything wealth teams need.<br /><em>Nothing they don&apos;t.</em></h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <a href="#contact" aria-label={`Learn more about ${feature.title}`}>Learn more <b>→</b></a>
            </article>
          ))}
        </div>
      </section>

      <section className="security" id="security">
        <div className="security-art" aria-hidden="true">
          <div className="orbit orbit-one"><span>INVESTOR</span></div>
          <div className="orbit orbit-two"><span>ADVISOR</span></div>
          <div className="core"><b>W</b><small>SECURE CORE</small></div>
        </div>
        <div className="security-copy">
          <p className="eyebrow">Security by design</p>
          <h2>Trust is the real <em>competitive edge.</em></h2>
          <p>Protect sensitive client information with encrypted personal data, least-privilege controls, and clear audit trails across every workflow.</p>
          <ul>
            <li><b>✓</b> AES-256-GCM PII encryption</li>
            <li><b>✓</b> Role-based access controls</li>
            <li><b>✓</b> UTC audit-friendly records</li>
          </ul>
        </div>
      </section>

      <section className="contact" id="contact">
        <p className="eyebrow">See WealthOS in action</p>
        <h2>Build the wealth business<br /><em>you want to run.</em></h2>
        <p>Tell us about your team, your clients, and the growth you are planning.</p>
        <a className="button button-light" href="mailto:sales@wealthos.example">Book your demo <span>↗</span></a>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark">W</span><span>WealthOS</span></a>
        <p>Wealth management infrastructure for ambitious teams.</p>
        <span>© 2026 WealthOS</span>
      </footer>
    </main>
  );
}
