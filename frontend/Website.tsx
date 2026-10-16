import React, { useEffect, useState } from 'react';
import { Icon, Badge, Overlay } from './components/ui';
import { actors, names, type Payment, type Audit, type suppliers } from './model';
import { money, dateLabel } from './workspace';
import harbor from './assets/harbor-hero.png';
import warehouse from './assets/warehouse.png';
import team from './assets/team.png';

type Props = {
  payments: Payment[];
  audit: Audit[];
  suppliers: typeof suppliers;
  onNavigate: (page: string) => void;
  onCreate: () => void;
  onOpenPayment: (id: string) => void;
};
const capabilities = [
  { name: 'Supplier payments', short: 'Payments', icon: 'payments', headline: <>Business moves.<br />Your payments<br /><em>should too.</em></>, detail: 'Bring every invoice, approval and settlement into one clear flow.', page: 'Payments', title: 'A clear start for every payment.', body: 'Choose an approved supplier, add the invoice, set the amount and due date. Review the details before the request enters the approval queue.', action: 'Explore payments' },
  { name: 'Approval controls', short: 'Approvals', icon: 'shield', headline: <>The right payment.<br />The right people.<br /><em>Every time.</em></>, detail: 'Keep decisions deliberate with distinct approvers and clear spending rules.', page: 'Policy & recipients', title: 'Decisions with the right checks.', body: 'One approval for payments up to 5,000 mUSD. Two distinct approvers above it. An auditor can inspect the record without changing a payment decision.', action: 'View payment rules' },
  { name: 'Controlled settlement', short: 'Settlement', icon: 'wallet', headline: <>Move funds.<br />Keep control.<br /><em>Stay informed.</em></>, detail: 'Follow the transaction from approved request to confirmed settlement.', page: 'Payments', title: 'One instruction. One settlement.', body: 'A stable payment ID follows each request. Due dates and daily limits are checked before execution, and a retry cannot release the same payment twice.', action: 'Open settlement queue' },
  { name: 'Reconciliation', short: 'Reconciliation', icon: 'reconcile', headline: <>Close the loop.<br />Know what moved.<br /><em>With confidence.</em></>, detail: 'Match payment records with settlement evidence and bring exceptions into view.', page: 'Reconciliation', title: 'The record should match reality.', body: 'Compare amounts, recipients and settlement references. Flag differences and recover a confirmed payment after an interrupted response, without sending it again.', action: 'Try reconciliation' },
];
const cases = [
  { n: '01', title: 'The invoice that arrived twice.', tag: 'Duplicate prevention', description: 'Submit the same payment request twice. See how the original request is returned and a second transfer is prevented.', icon: 'copy', page: 'Demo lab' },
  { n: '02', title: 'The approval that wasn’t allowed.', tag: 'Separation of duties', description: 'Try approving as an auditor. The workflow denies the action and records the attempt in the activity history.', icon: 'shield', page: 'Demo lab' },
  { n: '03', title: 'The response that never arrived.', tag: 'Recovery & reconciliation', description: 'Interrupt a settlement response, then recover the original confirmation without paying the supplier again.', icon: 'reconcile', page: 'Demo lab' },
];
const steps = [
  { title: 'Request', text: 'The creator records an approved supplier, invoice, amount and due date.', icon: 'payments' },
  { title: 'Approve', text: 'The right number of distinct approvers reviews the request before any funds move.', icon: 'shield' },
  { title: 'Settle', text: 'The system checks the due date, daily limit and payment ID before releasing mock tokens.', icon: 'wallet' },
  { title: 'Reconcile', text: 'Accounting records are checked against settlement evidence. Differences are flagged.', icon: 'reconcile' },
];
const faqs = [
  ['Does this move real money?', 'No. This website is an interactive demonstration using synthetic suppliers and mock currency (mUSD). No real funds, bank accounts or live wallets are connected.'],
  ['What can I try in the workspace?', 'Create an invoice payment, switch demo roles, approve or reject a request, execute a mock settlement, search the payment history and run reconciliation. Workspace tools include the overview, policies and reliability demonstrations.'],
  ['What happens if a payment response is interrupted?', 'A missing response is treated as an unknown outcome. Reconciliation checks the existing settlement and recovers its confirmation. The payment ID remains the same, preventing duplicate execution.'],
  ['Is there a real backend in the project?', 'The source project includes Spring Boot, PostgreSQL and Solidity contracts for a local Ethereum development network. This hosted website runs the browser simulation; the backend can be run locally using the project setup instructions.'],
  ['Who can approve a payment?', 'The demo has two distinct approvers, Morgan and Jordan. Alex creates requests; Sam is the auditor. Requests above 5,000 mUSD require both approvers. The role switcher demonstrates permissions and is not authentication.'],
];

const heroMessages = [
  { lines: ['Business moves.', 'Your payments'], endings: ['should too.', 'keep pace.', 'move forward.'] },
  { lines: ['The right payment.', 'The right people.'], endings: ['Every time.', 'Every step.', 'Every decision.'] },
  { lines: ['Move funds.', 'Keep control.'], endings: ['Stay informed.', 'Stay connected.', 'Stay in control.'] },
  { lines: ['Close the loop.', 'Know what moved.'], endings: ['With confidence.', 'With clarity.', 'With certainty.'] },
];

function HeroHeadline({ slide }: { slide: number }) {
  const message = heroMessages[slide];
  const [frame, setFrame] = useState({ phrase: 0, count: 0, deleting: false });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    motion(); visibility();
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const phrase = message.endings[frame.phrase];
  useEffect(() => {
    if (reduced || paused || !visible) return;
    const complete = frame.count === phrase.length;
    const delay = frame.deleting ? (frame.count === 0 ? 450 : 35) : complete ? 2400 : frame.count === 0 ? 450 : 75;
    const timer = window.setTimeout(() => setFrame(previous => {
      if (previous.deleting) return previous.count === 0
        ? { phrase: (previous.phrase + 1) % message.endings.length, count: 0, deleting: false }
        : { ...previous, count: previous.count - 1 };
      return complete ? { ...previous, deleting: true } : { ...previous, count: previous.count + 1 };
    }), delay);
    return () => window.clearTimeout(timer);
  }, [frame, phrase, message, reduced, paused, visible]);
  return <>
    <style>{`
      .hero-typed { display: grid; position: relative; }
      .hero-typed > span { grid-area: 1 / 1; min-width: 0; padding-right: .16em; }
      .hero-typed-reserve { visibility: hidden; pointer-events: none; }
      .hero-typed-copy { align-self: start; }
      .hero-typed-cursor { display: inline-block; width: .025em; height: .76em; margin-left: .055em; vertical-align: -.025em; background: currentColor; box-shadow: 0 0 16px #ffb36b55; animation: hero-caret 1s step-end infinite; }
      .hero-typing-control { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 6px 10px; border: 1px solid #ffffff30; border-radius: 20px; background: #07142255; color: #d2d7e0; font-size: 10px; letter-spacing: .5px; cursor: pointer; }
      .hero-typing-control:hover { color: #ffb36b; border-color: #ffb36b88; }
      .hero-typing-control:focus-visible { outline: 2px solid #ffb36b; outline-offset: 4px; }
      .hero-typed[data-paused="true"] .hero-typed-cursor { animation: none; opacity: .55; }
      @keyframes hero-caret { 50% { opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .hero-typed-cursor, .hero-typing-control { display: none; } }
    `}</style>
    <h1 aria-label={[...message.lines, message.endings[0]].join(' ')}>
      <span aria-hidden="true">{message.lines[0]}<br />{message.lines[1]}<br />
        <em className="hero-typed" data-paused={paused || reduced}>
          {message.endings.map(ending => <span key={ending} className="hero-typed-reserve">{ending}</span>)}
          <span className="hero-typed-copy">{reduced ? message.endings[0] : phrase.slice(0, frame.count)}{!reduced && <i className="hero-typed-cursor" />}</span>
        </em>
      </span>
    </h1>
    {!reduced && <button className="hero-typing-control" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume headline animation' : 'Pause headline animation'}><span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>{paused ? 'Resume animation' : 'Pause animation'}</button>}
  </>;
}

export function Website({ payments, audit, suppliers, onNavigate, onCreate, onOpenPayment }: Props) {
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const [tracker, setTracker] = useState(false);
  const [capability, setCapability] = useState(0);
  const [journey, setJourney] = useState(0);
  const [network, setNetwork] = useState('Suppliers');
  const [caseIndex, setCaseIndex] = useState<number | null>(null);
  const [amount, setAmount] = useState('6400');
  const current = capabilities[slide];
  const section = (id: string) => {
    setMenu(false);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  return <>
    <div id="workspace" className="public-site"><a className="skip-link" href="#site-content">Skip to content</a>
      <header className="site-header">
        <a className="site-brand" href="#home" aria-label="TreasuryFlow home"><span className="site-mark"><Icon name="reconcile" size={25} /></span>TreasuryFlow<span className="wordmark-period">.</span></a>
        <nav className="site-nav" aria-label="Website navigation">
          <button onClick={() => section('capabilities')}>Capabilities</button>
          <button onClick={() => section('how-it-works')}>How it works</button>
          <button onClick={() => section('stories')}>In practice</button>
        </nav>
        <div className="site-header-actions"><a className="site-workspace-link live-entry" href="/app">Sign in <Arrow /></a><button className="site-workspace-link" onClick={() => onNavigate('Payments')}>Explore demo <Arrow /></button><button className="site-menu-toggle" aria-label="Open website menu" onClick={() => setMenu(true)}><Icon name="menu" size={21} /></button></div>
      </header>
      <main id="site-content" className="site-main">
        <section id="home" className="site-hero" aria-label="TreasuryFlow introduction" style={{ backgroundImage: `linear-gradient(90deg, rgba(4,14,27,.66), rgba(4,14,27,.08)), linear-gradient(0deg, rgba(4,14,27,.94), transparent 65%), url(${harbor})` }}>
          <div className="hero-content" key={slide}>
            <p className="hero-eyebrow"><span /> CORPORATE PAYMENTS, CONNECTED.</p>
            <HeroHeadline key={slide} slide={slide} />
            <p className="hero-description">{current.detail}</p>
            <div className="hero-actions"><button className="site-button mint" onClick={onCreate}>Create a payment <Arrow /></button><button className="site-button ghost" onClick={() => setTracker(true)}>Track a payment <Icon name="search" size={16} /></button></div>
          </div>
          <div className="hero-bottom">
            <div className="hero-carousel-meta"><span><b>{String(slide + 1).padStart(2, '0')}</b> / 04</span><span className="hero-rule" /><div className="hero-arrows"><button aria-label="Previous capability" onClick={() => setSlide((slide + 3) % 4)}><span className="left-arrow"><Arrow /></span></button><button aria-label="Next capability" onClick={() => setSlide((slide + 1) % 4)}><Arrow /></button></div></div>
            <div className="hero-capabilities" aria-label="Featured capabilities">{capabilities.map((c, i) => <button key={c.short} className={slide === i ? 'hero-capability active' : 'hero-capability'} aria-pressed={slide === i} onClick={() => setSlide(i)}><span className="hero-card-icon"><Icon name={c.icon} size={22} /></span><span><small>0{i + 1}</small><b>{c.name}</b></span><Arrow /></button>)}</div>
            <div className="hero-disclosure"><span>Interactive demo · synthetic suppliers · mock currency</span><button onClick={() => section('introduction')}>Discover TreasuryFlow <span className="down-arrow"><Arrow /></span></button></div>
          </div>
        </section>
        <section id="introduction" className="site-introduction site-section">
          <div className="section-kicker"><span className="section-number">01 /</span> A CLEARER WAY TO PAY</div>
          <div className="intro-grid"><figure className="intro-photo"><img src={team} alt="Colleagues reviewing documents together beside a laptop" loading="lazy" width="1672" height="941" /><figcaption>Better decisions start with a shared view.</figcaption></figure><div><h2>Less chasing.<br />More <span className="sage-text">clarity.</span></h2><p className="intro-description">A payment is more than a transfer. It’s an invoice, a decision, a deadline and a record. TreasuryFlow brings them together, so your team always knows what happens next.</p><button className="text-link" onClick={() => onNavigate('Payments')}>Meet your workspace <Arrow /></button></div></div>
          <div className="principle-strip"><span><Icon name="shield" size={18} /> Clear approval rules</span><span><Icon name="payments" size={18} /> One payment, one record</span><span><Icon name="reconcile" size={18} /> Settlement you can check</span><span><Icon name="clock" size={18} /> Every decision recorded</span></div>
        </section>
        <section id="capabilities" className="site-capability-section site-section">
          <div className="section-top"><div><div className="section-kicker"><span className="section-number">02 /</span> BUILT AROUND YOUR WORK</div><h2>Every payment.<br />Handled end to end.</h2></div><p>Four connected capabilities.<br />One straightforward workflow.</p></div>
          <div className="capabilities-layout"><div className="capability-accordion">{capabilities.map((c, i) => <div className={'capability-row ' + (capability === i ? 'expanded' : '')} key={c.name}><button aria-expanded={capability === i} aria-controls={'capability-detail-' + i} onClick={() => setCapability(i)}><span>0{i + 1}</span><h3>{c.name}</h3><span className="expand-indicator">{capability === i ? '−' : '+'}</span></button><div id={'capability-detail-' + i} hidden={capability !== i}><p>{c.body}</p><button className="text-link" onClick={() => onNavigate(c.page)}>{c.action}<Arrow /></button></div></div>)}</div>
            <div className="capability-preview" aria-live="polite"><span className="preview-label">A CLOSER LOOK / 0{capability + 1}</span>{capability === 0 ? <><div className="preview-document"><span className="document-icon"><Icon name="payments" size={28} /></span><span>PAYMENT REQUEST</span><h3>Good details.<br />A better start.</h3><dl><div><dt>Supplier</dt><dd>{suppliers[0]?.name}</dd></div><div><dt>Invoice</dt><dd>INV-2026-084</dd></div><div><dt>Amount</dt><dd>12,800.00 mUSD</dd></div><div><dt>Next step</dt><dd>Second approval</dd></div></dl><small>Illustrative request from the seeded demo.</small></div></> : capability === 1 ? <div className="approval-explorer"><Icon name="shield" size={38} /><h3>The right level<br />of oversight.</h3><label>Try a payment amount <span>mUSD</span><input aria-label="Explore approval amount" type="number" min="1" max="25000" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="approval-result">{Number(amount) > 0 && Number(amount) <= 25000 ? <><strong>{Number(amount) > 5000 ? '02' : '01'}</strong><span>{Number(amount) > 5000 ? 'distinct approvals required' : 'approval required'}</span></> : <p>Enter an amount between 1 and 25,000.</p>}</div><small>Interactive policy preview · no payment is created.</small></div> : capability === 2 ? <div className="settlement-preview"><Icon name="wallet" size={36} /><h3>Progress you<br />can follow.</h3><ul><li><span>01</span> Request approved <Icon name="check" size={16} /></li><li><span>02</span> Due date & limit checked <Icon name="check" size={16} /></li><li><span>03</span> Settlement confirmed <Icon name="check" size={16} /></li></ul><p>A confirmed event completes the record. A missing response triggers a status check.</p></div> : <div className="reconcile-preview"><Icon name="reconcile" size={36} /><h3>Close the books.<br />Keep the evidence.</h3><div className="compare-record"><span>Payment record</span><b>6,400.00 mUSD</b></div><div className="compare-line"><Icon name="check" size={22} /> Match amount & recipient</div><div className="compare-record"><span>Settlement event</span><b>6,400.00 mUSD</b></div><small>Illustrative match. Open Reconciliation to check the current demo records.</small></div>}</div></div>
        </section>
        <section id="how-it-works" className="journey-section site-section">
          <div className="section-top"><div><div className="section-kicker"><span className="section-number">03 /</span> CONNECTED FROM START TO FINISH</div><h2>Four steps.<br />Nothing lost between them.</h2></div><button className="site-button outline-dark" onClick={onCreate}>Try the workflow <Arrow /></button></div>
          <div className="journey-tabs" role="tablist" aria-label="Payment lifecycle">{steps.map((s, i) => <button id={'journey-tab-' + i} key={s.title} role="tab" aria-selected={journey === i} aria-controls="journey-panel" tabIndex={journey === i ? 0 : -1} onClick={() => setJourney(i)} onKeyDown={e => { if (['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (journey + (e.key === 'ArrowRight' ? 1 : 3)) % 4; setJourney(next); document.getElementById('journey-tab-' + next)?.focus(); } }}><span>0{i + 1}</span><b>{s.title}</b><Arrow /></button>)}</div>
          <div id="journey-panel" className="journey-panel" role="tabpanel" aria-labelledby={'journey-tab-' + journey}><Icon name={steps[journey].icon} size={38} /><p>{steps[journey].text}</p><span className="journey-context">{journey === 0 ? 'Creator → approvers' : journey === 1 ? 'Approvers → execution' : journey === 2 ? 'Execution → confirmation' : 'Confirmation → accounting'}</span></div>
        </section>
        <section className="network-section site-section" id="network"><div className="network-copy"><div className="section-kicker"><span className="section-number">04 /</span> EVERY HANDOFF CONNECTED</div><h2>Your suppliers.<br />Your team.<br /><span className="sage-text">A shared view.</span></h2><p>Approved recipients and defined roles keep the workflow clear. Everyone works from the same payment record.</p><div className="network-toggle" aria-label="Explore the demo network">{['Suppliers', 'Team'].map(v => <button key={v} aria-pressed={network === v} onClick={() => setNetwork(v)}>{v}</button>)}</div><small>Synthetic demo network · no live bank connections.</small></div><div className="network-visual"><img className="network-photo" src={warehouse} alt="Sunlit warehouse with blue and orange shelving" loading="lazy" width="1774" height="887" /><div className="network-hub"><span className="site-mark"><Icon name="reconcile" size={28} /></span><b>TreasuryFlow</b><small>Shared payment workspace</small></div><div className={'network-nodes ' + (network === 'Team' ? 'team-nodes' : '')}>{network === 'Suppliers' ? suppliers.map(s => <div key={s.id} className="network-node"><span className="network-node-symbol">{s.name[0]}</span><div><b>{s.name}</b><small>{s.category}</small></div><span className="node-check"><Icon name="check" size={14} /></span></div>) : actors.map(a => <div key={a} className="network-node"><span className="network-node-symbol"><Icon name="user" size={19} /></span><div><b>{names[a].split(' · ')[0]}</b><small>{names[a].split(' · ')[1]}</small></div></div>)}</div><button className="text-link" onClick={() => onNavigate('Policy & recipients')}>View roles & recipient rules <Arrow /></button></div></section>
        <section id="stories" className="stories-section site-section"><div className="section-top"><div><div className="section-kicker"><span className="section-number">05 /</span> RELIABILITY IN PRACTICE</div><h2>Built for the<br />unexpected.</h2></div><p>Three demo scenarios.<br />Real checks in the application logic.</p></div><div className="stories-grid">{cases.map((c,i) => <button className="story-card" key={c.n} onClick={() => setCaseIndex(i)}><div className={'story-art art-' + i}><img src={[harbor,team,warehouse][i]} alt={["Container harbor at blue hour","Finance colleagues reviewing a payment record","Organized warehouse ready for supplier deliveries"][i]} loading="lazy" width="1672" height="941" /><Icon name={c.icon} size={32} /><span>{c.n}</span></div><div className="story-content"><small>{c.tag}</small><h3>{c.title}</h3><p>{c.description}</p><span className="story-link">Explore scenario <Arrow /></span></div></button>)}</div></section>
        <section className="tools-section site-section"><span className="section-kicker">ALREADY IN THE FLOW?</span><h2>Your next move,<br /><em>one click away.</em></h2><div><button className="site-button mint" onClick={() => setTracker(true)}>Track a payment <Icon name="search" size={17} /></button><button className="site-button ghost" onClick={() => onNavigate('Payments')}>Open workspace <Arrow /></button></div></section>
        <section className="faq-section site-section" id="questions"><div><div className="section-kicker">A FEW USEFUL ANSWERS</div><h2>Clear from<br />the outset.</h2></div><div className="faq-list">{faqs.map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
        <section className="site-closing site-section"><a className="site-button dark" href="/app" style={{marginBottom:24}}>Start your company workspace <Arrow /></a><p>LESS FRICTION. MORE VISIBILITY.</p><h2>Let’s move your<br />business <em>forward.</em></h2><button className="site-button dark" onClick={() => onNavigate('Payments')}>Explore the demo workspace <Arrow /></button></section>
      </main>
      <footer className="site-footer"><div className="footer-top"><div><a className="site-brand" href="#home"><span className="site-mark"><Icon name="reconcile" size={24} /></span>TreasuryFlow.</a><p>Programmable corporate payments.<br />A clear path from invoice to settlement.</p></div><div className="footer-links"><div><b>EXPLORE</b><button onClick={() => section('capabilities')}>Capabilities</button><button onClick={() => section('how-it-works')}>How it works</button><button onClick={() => section('stories')}>Reliability demos</button></div><div><b>WORKSPACE</b><button onClick={() => onNavigate('Payments')}>Payments</button><button onClick={() => onNavigate('Reconciliation')}>Reconciliation</button><button onClick={() => onNavigate('Activity')}>Activity</button></div><div><b>GOOD TO KNOW</b><button onClick={() => section('questions')}>Questions & answers</button><button onClick={() => onNavigate('Policy & recipients')}>Payment policies</button><button onClick={() => setTracker(true)}>Track a payment</button></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} TreasuryFlow · Educational project</span><span>Simulated payments · No real funds · AI-generated editorial imagery</span></div></footer>
    </div>
    {menu && <div className="public-menu"><Overlay title="Explore TreasuryFlow" onClose={() => setMenu(false)} wide><div className="menu-links">{[['Capabilities','capabilities'],['How it works','how-it-works'],['The network','network'],['In practice','stories'],['Questions','questions']].map(([label,id],i) => <button key={id} onClick={() => section(id)}><small>0{i + 1}</small>{label}<Arrow /></button>)}</div><div className="menu-bottom"><span>Everything connected.<br />Every payment clear.</span><button className="site-button mint" onClick={() => { setMenu(false); onNavigate('Payments'); }}>Open workspace <Arrow /></button></div></Overlay></div>}
    {tracker && <PaymentTracker payments={payments} audit={audit} suppliers={suppliers} onClose={() => setTracker(false)} onOpen={id => { setTracker(false); onOpenPayment(id); }} />}
    {caseIndex !== null && <div className="site-modal"><Overlay title="Reliability scenario" onClose={() => setCaseIndex(null)}><span className="case-modal-number">{cases[caseIndex].n}</span><h2>{cases[caseIndex].title}</h2><p>{cases[caseIndex].description}</p><div className="case-explanation"><Icon name="lab" size={22} /><p>The Demo lab runs these checks using the same payment logic as the normal workflow. You can inspect the resulting records in Activity and Reconciliation.</p></div><button className="site-button dark" onClick={() => { setCaseIndex(null); onNavigate('Demo lab'); }}>Open reliability demo <Arrow /></button></Overlay></div>}
  </>;
}

export function Arrow() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>; }

export function PaymentTracker({ payments, audit, suppliers, onClose, onOpen }: { payments: Payment[]; audit: Audit[]; suppliers: typeof import('./model').suppliers; onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const normalized = query.trim().toLowerCase();
  const matches = searched && normalized ? payments.filter(p => p.invoice.toLowerCase().includes(normalized) || p.id.toLowerCase() === normalized || p.txHash?.toLowerCase() === normalized) : [];
  return <div className="site-modal tracker-modal"><Overlay title="Track a payment" onClose={onClose} wide><h2>Know where it stands.</h2><p>Find a payment by invoice reference, payment ID or settlement reference.</p><form className="tracking-form" onSubmit={e => { e.preventDefault(); setSearched(true); }}><label htmlFor="tracking-query">Invoice or payment reference</label><div><input id="tracking-query" value={query} onChange={e => { setQuery(e.target.value); setSearched(false); }} placeholder="e.g. INV-2026-084" required /><button className="site-button dark" type="submit">Track <Arrow /></button></div></form><div className="tracking-example">Try a demo invoice: {payments.slice(0,2).map(p => <button key={p.id} onClick={() => { setQuery(p.invoice); setSearched(true); }}>{p.invoice}</button>)}</div><div aria-live="polite">{searched && !matches.length && <div className="tracking-empty"><Icon name="search" size={25} /><h3>No matching payment</h3><p>Check the reference and try again. Only records in this demo workspace can be tracked.</p></div>}{matches.map(p => { const events = audit.filter(a => a.payment_id === p.id).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id-b.id); return <article className="tracking-result" key={p.id}><div className="tracking-result-head"><span><b>{suppliers.find(s => s.id.toLowerCase() === p.recipient.toLowerCase())?.name || 'Approved supplier'}</b><small>{p.invoice}</small></span><Badge status={p.status} /></div><strong>{money(p.amount)} <small>mUSD</small></strong><div className="tracking-progress">{['Requested','Approved','Confirmed'].map((s,i) => <span key={s} className={i === 0 || (i === 1 && p.approvals.length >= p.required) || (i === 2 && p.status === 'SETTLED' && p.txHash) ? 'complete' : ''}><i /><small>{s}</small></span>)}</div><p>Due {dateLabel(p.dueDate)} · {p.approvals.length} of {p.required} approvals</p>{p.status === 'EXECUTING' && <p className="tracking-warning">Confirmation is unknown. Check the existing transaction in Reconciliation before another attempt.</p>}<p className="tracking-latest">Latest: {events.at(-1)?.detail || 'Request recorded.'}</p><button className="text-link" onClick={() => onOpen(p.id)}>View payment details <Arrow /></button></article>; })}</div><small className="tracker-disclosure">Demo tracking only. These are simulated payment records.</small></Overlay></div>;
}
