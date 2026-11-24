import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Menu,
  X,
  FileSpreadsheet,
  Receipt,
  Scale,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  MessageCircle,
  Calendar,
  Lock,
  ClipboardCheck,
  Phone,
  DatabaseBackup,
  UserCheck,
  ArrowUp,
} from 'lucide-react';
import heroDashboardImg from '../assets/images/hero_bookkeeping_dashboard_1795317507415.jpg';
import invoicingAgingImg from '../assets/images/feature_invoicing_aging_1795317508378.jpg';
import budgetForecastImg from '../assets/images/feature_budget_forecast_1795317508018.jpg';
import financialReportsImg from '../assets/images/feature_financial_reports_1795317507733.jpg';
import servicesConsultationImg from '../assets/images/services_consultation_desk_1795480707725.jpg';
import aboutTeamImg from '../assets/images/about_bookkeeping_team_1795480708629.jpg';
import securityVaultImg from '../assets/images/security_vault_architecture_1795480709180.jpg';
import proofBusinessImg from '../assets/images/proof_caribbean_business_1795480709390.jpg';
import { cn } from '../lib/utils';

interface LandingPageProps {
  onGetStarted: (planName?: string) => void;
  onSignIn: () => void;
  onLaunchDemo?: () => void;
  isDemoAvailable?: boolean;
}

interface DashboardModule {
  id: string;
  number: string;
  label: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
  keyMetricLabel: string;
  keyMetricValue: string;
  keyMetricNote: string;
  outcomes: string[];
}

const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: 'overview',
    number: '01.',
    label: 'Executive Overview',
    title: 'Monitor revenue, margin, and cash velocity in one clear frame',
    summary:
      'Track regional performance across Kingston, Montego Bay, Ocho Rios, and remote client accounts without reconciling five separate spreadsheets.',
    image: heroDashboardImg,
    imageAlt:
      'Island Bookkeeping Executive Overview dashboard displaying revenue and net profit area chart, regional bar breakdown, and margin KPIs',
    keyMetricLabel: 'Average Monthly Margin Visibility',
    keyMetricValue: '34.2%',
    keyMetricNote: 'Updated automatically with every posted invoice, expense, and journal entry',
    outcomes: [
      'Live monthly revenue vs. net profit area charts with period comparison',
      'Regional and category breakdown to spot high-margin service lines fast',
      'Filterable ledger grid with inline record editing and one-click CSV export',
    ],
  },
  {
    id: 'invoicing',
    number: '02.',
    label: 'Invoicing & AR Aging',
    title: 'Issue G.C.T.-ready invoices and collect overdue balances faster',
    summary:
      'Build multi-line client invoices with automated 15% G.C.T. or custom tax rates, track partial payments, and sort receivables into actionable aging buckets.',
    image: invoicingAgingImg,
    imageAlt:
      'Island Bookkeeping Accounts Receivable and Invoicing dashboard showing client invoice ledger, G.C.T. tax panel, and aging buckets',
    keyMetricLabel: 'Receivables Aging Breakdown',
    keyMetricValue: 'Current · 30 · 60 · 90+d',
    keyMetricNote: 'Partial payments post directly to Accounts Receivable and update client balances',
    outcomes: [
      'Configurable G.C.T. tax rates automatically calculated per invoice line item',
      'Full partial-payment timeline showing remaining balance and settlement dates',
      'Immediate aging view highlighting overdue client accounts before cash tightens',
    ],
  },
  {
    id: 'budgets',
    number: '03.',
    label: 'Budgets & Forecasting',
    title: 'Catch category overruns weeks before month-end close',
    summary:
      'Set monthly operating limits across payroll, utilities, shipping, and contractors. Real-time burn-rate tracking alerts you at 75% utilization.',
    image: budgetForecastImg,
    imageAlt:
      'Island Bookkeeping Budget Tracking and Cash Flow Forecasting dashboard showing budget utilization bars, projected vs actual chart, and burn rate',
    keyMetricLabel: 'Early Variance Threshold',
    keyMetricValue: '75% Alert',
    keyMetricNote: 'Tracks recurring bills alongside variable expenses to forecast end-of-month runway',
    outcomes: [
      'Visual utilization bars contrasting budgeted allocations against actual spend',
      'Projected vs. actual cash flow trend curves built from historical vendor bills',
      'Recurring vendor expense templates so monthly obligations never slip',
    ],
  },
  {
    id: 'reports',
    number: '04.',
    label: 'Trial Balance & Statements',
    title: 'Balanced double-entry books ready for your accountant or tax audit',
    summary:
      'Every invoice, expense payout, and manual entry writes balanced debit and credit lines to your Chart of Accounts—producing audit-ready statements anytime.',
    image: financialReportsImg,
    imageAlt:
      'Island Bookkeeping Financial Statements workspace showing balanced Trial Balance, General Ledger, Income Statement, and PDF or CSV export menu',
    keyMetricLabel: 'Ledger Parity Guarantee',
    keyMetricValue: 'DR = CR',
    keyMetricNote: 'Every journal entry enforces strict debit-credit equilibrium before posting',
    outcomes: [
      'Full General Ledger with account codes, running balances, and reference trails',
      'Instant Income Statement, Balance Sheet, and Trial Balance for any date range',
      'Clean PDF and CSV financial package exports ready for banks or external CPAs',
    ],
  },
];

const QUANTIFIED_IMPACT = [
  {
    value: '14 hrs',
    label: 'Saved per month on reconciliation and statement cleanup',
  },
  {
    value: '100%',
    label: 'Double-entry debit and credit parity across all accounts',
  },
  {
    value: '15% G.C.T.',
    label: 'Or custom regional tax calculated cleanly on every line item',
  },
  {
    value: '< 3 mins',
    label: 'To turn raw CSV bank exports into categorized ledger entries',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01.',
    timing: 'Under 3 minutes',
    title: 'Import statements or connect your accounts',
    detail:
      'Upload raw CSV or JSON bank exports—our built-in cleaning engine normalizes date formats, strips duplicate rows, validates currency columns, and maps categories automatically.',
  },
  {
    step: '02.',
    timing: 'Automatic posting',
    title: 'Send invoices, log bills, and track aging',
    detail:
      'Create client invoices with G.C.T. calculations, record supplier payables with due dates, and monitor budget utilization in real time without touching formulas.',
  },
  {
    step: '03.',
    timing: 'Instant export',
    title: 'Close the month with audit-ready statements',
    detail:
      'Review your balanced Trial Balance, Income Statement, and Balance Sheet side-by-side, then export formatted PDFs or CSV workbooks for stakeholders.',
  },
];

const CLIENT_OUTCOMES = [
  {
    quote:
      'Before Island Bookkeeping, our Kingston office spent every first week of the month cleaning CSV exports from three bank accounts and re-keying G.C.T. totals. Now our statements balance on the same day invoices clear.',
    before: '5 days monthly close across scattered spreadsheets',
    outcome: 'Closed in 3.5 hours with 100% Trial Balance parity',
    author: 'Kareem Campbell',
    role: 'Managing Director · Blue Mountain Logistics Ltd.',
  },
  {
    quote:
      'Tracking partial payments from hospitality clients used to break our cash forecast. Having AR aging buckets tied directly to each invoice timeline cut our average overdue balance by more than a third in two quarters.',
    before: '38% of receivables aging past 45 days',
    outcome: 'Reduced overdue receivables by 41% in 6 months',
    author: 'Nadia Hendricks',
    role: 'Principal CPA · Hendricks Advisory Group',
  },
  {
    quote:
      'Our external auditor asked for a full General Ledger export and Income Statement breakdown by department. Exporting the balanced PDF and CSV package took less than sixty seconds.',
    before: 'Manual end-of-quarter ledger compilation',
    outcome: 'Audit prep reduced from 18 hours to under 1 hour',
    author: 'Devon Wallace',
    role: 'Finance Lead · Ocho Rios Marine Supply',
  },
];

const OWNER_BENEFITS = [
  {
    number: '01.',
    title: 'More time for business owners',
    detail: 'Stop spending evenings sorting receipts or fixing spreadsheets—reclaim hours every week.',
  },
  {
    number: '02.',
    title: 'Better financial organization',
    detail: 'Keep every invoice, vendor bill, bank statement, and tax record structured in one place.',
  },
  {
    number: '03.',
    title: 'Accurate bookkeeping records',
    detail: 'Balanced double-entry posting ensures your debits, credits, and accounts reconcile cleanly.',
  },
  {
    number: '04.',
    title: 'Clearer business performance',
    detail: 'Understand cash flow, profit margins, and overdue client balances before decisions hurt.',
  },
  {
    number: '05.',
    title: 'Less stress at tax time',
    detail: 'Walk into G.C.T. filings and year-end reviews with clean statements ready for your CPA.',
  },
];

interface ServicePackage {
  id: string;
  number: string;
  name: string;
  tagline: string;
  priceUsd: string;
  priceJmd: string;
  cadence: string;
  recommended?: boolean;
  ctaLabel: string;
  ctaMode: 'workspace' | 'consultation' | 'onboarding';
  features: string[];
}

const SERVICE_PACKAGES: ServicePackage[] = [
  {
    id: 'essential',
    number: '01.',
    name: 'Essential Monthly Bookkeeping',
    tagline: 'For solo founders and micro-businesses wanting accurate, stress-free monthly books.',
    priceUsd: 'From $149',
    priceJmd: 'From J$23,500',
    cadence: 'per month · transparent volume pricing',
    ctaLabel: 'Get Started',
    ctaMode: 'workspace',
    features: [
      'Up to 100 monthly transactions & 1 bank account reconciled',
      'Monthly Profit & Loss, Balance Sheet & Trial Balance',
      'G.C.T.-ready client invoicing & receipt organization',
      'Full Island Bookkeeping cloud ledger workspace included',
    ],
  },
  {
    id: 'growth',
    number: '02.',
    name: 'Growth Bookkeeping & Tax Prep',
    tagline: 'For growing small businesses needing reconciliations, AR/AP tracking, and G.C.T. prep.',
    priceUsd: 'From $299',
    priceJmd: 'From J$47,000',
    cadence: 'per month · up to 3 accounts reconciled',
    recommended: true,
    ctaLabel: 'Book Free Consultation',
    ctaMode: 'consultation',
    features: [
      'Up to 300 monthly bank, card & merchant transactions',
      'Accounts Receivable & Payable aging review every month',
      'G.C.T. input/output summary & filing prep schedule',
      'Cloud workspace access plus direct WhatsApp support',
    ],
  },
  {
    id: 'executive',
    number: '03.',
    name: 'Full-Service & Advisory',
    tagline: 'For active multi-account companies needing weekly close, payroll support, and catch-up help.',
    priceUsd: 'From $499',
    priceJmd: 'From J$78,500',
    cadence: 'per month · custom multi-entity scope',
    ctaLabel: 'Start Client Onboarding',
    ctaMode: 'onboarding',
    features: [
      'Unlimited reconciliations across bank, POS & eCommerce feeds',
      'Payroll support, weekly cash-flow briefs & vendor scheduling',
      'Catch-up bookkeeping & direct coordination with your auditor',
      'Dedicated bookkeeper with priority WhatsApp & call check-ins',
    ],
  },
];

const TRUST_PILLARS = [
  {
    number: '01.',
    title: 'Strict Confidentiality & Access Control',
    detail:
      'Every client ledger is isolated with row-level database access controls so only authorized owners and assigned bookkeepers see your numbers.',
  },
  {
    number: '02.',
    title: 'Accountant-Verified Double-Entry Accuracy',
    detail:
      'We enforce true debit-and-credit parity across every transaction, ensuring your Trial Balance, P&L, and Balance Sheet hold up under tax or bank scrutiny.',
  },
  {
    number: '03.',
    title: 'Built for Jamaican & Remote Small Businesses',
    detail:
      'Designed around local G.C.T. workflows, JMD and USD reporting, and fast communication so you always have clear answers without accounting jargon.',
  },
];

const TRUST_SECURITY_ITEMS = [
  {
    number: '01.',
    icon: Lock,
    title: 'Data Encryption',
    description:
      'Your ledgers, invoices, and bank statement imports are encrypted in transit and stored in user-isolated PostgreSQL databases protected by row-level access policies.',
    spec: 'Protocol · Encrypted Transfer & Row-Level Security',
  },
  {
    number: '02.',
    icon: DatabaseBackup,
    title: 'Daily Backups',
    description:
      'Automated daily cloud backups protect your accounting history against hardware failure, alongside instant one-click CSV, JSON, and PDF ledger exports whenever you need them.',
    spec: 'Cadence · Automated Daily Snapshots + Portable Exports',
  },
  {
    number: '03.',
    icon: UserCheck,
    title: 'Professional Confidentiality',
    description:
      'Every bank statement, payroll summary, client directory, and tax filing is handled under strict confidentiality standards with least-privilege workspace access.',
    spec: 'Standard · Strict Non-Disclosure & Private Workspace Access',
  },
];

interface BookkeepingService {
  number: string;
  title: string;
  scope: string;
  description: string;
  deliverable: string;
}

const MAJOR_SERVICES: BookkeepingService[] = [
  {
    number: '01.',
    title: 'Monthly Bookkeeping',
    scope: 'Ongoing Ledger Care · Transaction Categorization',
    description:
      'We record, classify, and verify your day-to-day income, operating expenses, and receipts every month so your books stay accurate without late-night spreadsheet work.',
    deliverable: 'Clean monthly general ledger & categorized expense log',
  },
  {
    number: '02.',
    title: 'Bank and Account Reconciliations',
    scope: 'Chequing · Savings · Credit Cards · Merchant Feeds',
    description:
      'Every deposit, withdrawal, card settlement, and bank fee is matched line-by-line against your bank statements so missing transactions and duplicate entries are caught immediately.',
    deliverable: 'Reconciled closing balances across all business accounts',
  },
  {
    number: '03.',
    title: 'Accounts Payable and Receivable',
    scope: 'Customer Invoicing · Vendor Bills · Aging Controls',
    description:
      'Stay on top of who owes you money and which supplier bills are due next. We track partial client payments, overdue receivables, and scheduled vendor payouts in one place.',
    deliverable: 'Weekly AR & AP aging schedules with payment status tracking',
  },
  {
    number: '04.',
    title: 'Financial Statements',
    scope: 'Income Statement · Balance Sheet · Trial Balance',
    description:
      'Receive balanced, double-entry financial statements formatted cleanly for your accountant, lender, or board review—removing guesswork when applying for credit or filing taxes.',
    deliverable: 'Audit-ready P&L, Balance Sheet & Trial Balance (PDF / CSV)',
  },
  {
    number: '05.',
    title: 'Payroll Support',
    scope: 'Wage Schedules · Statutory Deductions · Ledger Posting',
    description:
      'Keep employee salaries, contractor payouts, and statutory payroll obligations organized and properly reflected in your expense and liability accounts every pay cycle.',
    deliverable: 'Structured payroll journal posting & deduction summaries',
  },
  {
    number: '06.',
    title: 'Catch-Up Bookkeeping',
    scope: 'Historical Cleanup · Backlog Reconciliation',
    description:
      'Fallen behind by a few months or an entire fiscal year? We clean up uncategorized bank exports, resolve mixed receipts, and bring overdue books completely up to date.',
    deliverable: 'Reconciled prior-period ledger ready for tax compliance',
  },
  {
    number: '07.',
    title: 'Small Business Financial Reporting',
    scope: 'Cash Flow · Profit Margins · Executive Summaries',
    description:
      'Go beyond raw numbers with plain-English monthly reporting on profit margins, burn rate, seasonal revenue trends, and cash runway so you can make smarter business decisions.',
    deliverable: 'Monthly owner performance brief & margin variance highlights',
  },
];

const FAQS = [
  {
    q: 'How do you keep my business financial records confidential?',
    a: 'All cloud records are encrypted in transit and protected by user-scoped row-level security. We treat every bank statement, payroll figure, and client list with strict professional confidentiality.',
  },
  {
    q: 'What if my bookkeeping is months behind or stuck in spreadsheets?',
    a: 'That is our most common starting point. During onboarding, we clean your historical CSV or Excel files, reconcile missing months, and bring your books current so you start fresh.',
  },
  {
    q: 'Does Island Bookkeeping enforce true double-entry accounting?',
    a: 'Yes. Every journal entry, paid invoice, and vendor bill writes balanced debit and credit lines against your Chart of Accounts (Assets, Liabilities, Equity, Revenue, and Expenses).',
  },
  {
    q: 'Can I customize G.C.T. or regional sales tax rates?',
    a: 'Yes. You can set your default G.C.T. percentage (such as 15% or 0% zero-rated) in workspace settings and track output tax cleanly on every invoice.',
  },
  {
    q: 'How does pricing work if my transaction volume grows?',
    a: 'You never face surprise bills. During your free consultation, we confirm a flat monthly tier based on bank account count and transaction volume, and notify you in advance before any tier change.',
  },
  {
    q: 'Can I access the cloud ledger workspace alongside my monthly service?',
    a: 'Yes. Every monthly bookkeeping package starting from $149/mo includes full access to your Island Bookkeeping cloud workspace so you can issue invoices, check live cash flow, and export reports anytime.',
  },
];

const EASE_SETTLE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SECTION_VIEWPORT = { once: true, amount: 0.12 as const };

export function LandingPage({
  onGetStarted,
  onSignIn,
  onLaunchDemo,
  isDemoAvailable = false,
}: LandingPageProps) {
  const [activeModuleId, setActiveModuleId] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [pricingCurrency, setPricingCurrency] = useState<'USD' | 'JMD'>('USD');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 420);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const currentUrl = `${window.location.origin}${window.location.pathname}`;
    const absoluteImageUrl = `${window.location.origin}/og-cover.jpg`;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = currentUrl;

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = currentUrl;

    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.content = absoluteImageUrl;

    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.content = absoluteImageUrl;
  }, []);

  // Interactive ROI / Close-Time Calculator state
  const [monthlyInvoices, setMonthlyInvoices] = useState<number>(85);
  const [monthlyBankLines, setMonthlyBankLines] = useState<number>(420);
  const [hourlyRate, setHourlyRate] = useState<number>(55);

  // Consultation & Client Onboarding form state
  const [contactTab, setContactTab] = useState<'consultation' | 'onboarding'>('consultation');
  const [selectedPackage, setSelectedPackage] = useState<string>('Essential Monthly Bookkeeping');
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryBusiness, setInquiryBusiness] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryVolume, setInquiryVolume] = useState('50 – 250 transactions / mo');
  const [inquiryCurrentSetup, setInquiryCurrentSetup] = useState('Excel / Spreadsheets');
  const [inquiryPreferredTime, setInquiryPreferredTime] = useState('Morning (9:00 AM – 12:00 PM)');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const activeModule =
    DASHBOARD_MODULES.find((m) => m.id === activeModuleId) || DASHBOARD_MODULES[0];

  // Calculator math: realistic time savings per invoice & bank statement line
  const hoursSavedPerMonth = Math.max(
    4,
    Math.round((monthlyInvoices * 0.09 + monthlyBankLines * 0.018) * 10) / 10
  );
  const annualSavings = Math.round(hoursSavedPerMonth * 12 * hourlyRate);
  const fasterCollectionDays = Math.min(22, Math.max(6, Math.round(monthlyInvoices * 0.14)));

  const handleImageError = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const selectPackageAndScroll = (pkgName: string, mode: 'consultation' | 'onboarding') => {
    setSelectedPackage(pkgName);
    setContactTab(mode);
    setInquirySubmitted(false);
    setInquiryError(null);
    scrollToSection('contact');
  };

  const selectServiceAndEnquire = (serviceTitle: string) => {
    setSelectedPackage(serviceTitle);
    setContactTab('consultation');
    setInquirySubmitted(false);
    setInquiryError(null);
    setInquiryNotes((prev) =>
      prev.trim() && !prev.startsWith('Interested in ')
        ? prev
        : `Interested in ${serviceTitle} for our business.`
    );
    scrollToSection('contact');
  };

  const getWhatsAppHref = () => {
    const summaryParts = [
      'Hello Island Bookkeeping, I would like to enquire about',
      selectedPackage,
      inquiryBusiness.trim() ? `for ${inquiryBusiness.trim()}` : '',
      inquiryName.trim() ? `(Contact: ${inquiryName.trim()})` : '',
    ].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(summaryParts.join(' '))}`;
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError(null);

    if (!inquiryName.trim()) {
      setInquiryError('Please enter your full name.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(inquiryEmail.trim())) {
      setInquiryError('Please enter a valid email address.');
      return;
    }
    if (!inquiryPhone.trim() || inquiryPhone.trim().length < 7) {
      setInquiryError('Please enter a phone or WhatsApp number so we can reach you.');
      return;
    }

    try {
      const existing = JSON.parse(localStorage.getItem('island_lead_inquiries') || '[]');
      const record = {
        id: `LEAD-${Date.now()}`,
        type: contactTab,
        package: selectedPackage,
        name: inquiryName.trim(),
        business: inquiryBusiness.trim(),
        email: inquiryEmail.trim(),
        phone: inquiryPhone.trim(),
        volume: inquiryVolume,
        currentSetup: inquiryCurrentSetup,
        preferredTime: inquiryPreferredTime,
        notes: inquiryNotes.trim(),
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem('island_lead_inquiries', JSON.stringify([record, ...existing].slice(0, 20)));
    } catch {
      // Non-fatal storage fallback
    }

    setInquirySubmitted(true);
  };

  const scrollToTop = () => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div
      className="min-h-screen bg-white text-black selection:bg-brand-100 selection:text-brand-900 overflow-x-hidden"
      style={{ fontFamily: 'var(--font-landing)' }}
    >
      {/* Top Bar — 1 row, 3 clean horizontal zones */}
      <header className="sticky top-0 z-50 bg-black border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollToTop();
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus:outline-none"
          >
            <span className="w-8 h-8 rounded-lg jamaica-gradient flex items-center justify-center text-white font-extrabold text-sm tracking-tight">
              I
            </span>
            <span
              className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Island Bookkeeping
            </span>
          </a>

          {/* Zone 2: Primary Navigation (Desktop) */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-white"
          >
            <button
              type="button"
              onClick={scrollToTop}
              className="whitespace-nowrap shrink-0 text-white hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('services')}
              className="whitespace-nowrap shrink-0 text-white hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('dashboards')}
              className="whitespace-nowrap shrink-0 text-white hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Dashboards
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('packages')}
              className="whitespace-nowrap shrink-0 text-white hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Packages
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="whitespace-nowrap shrink-0 text-white hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="whitespace-nowrap shrink-0 text-white font-bold hover:text-brand-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </nav>

          {/* Zone 3: Single Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onGetStarted()}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
              <ArrowRight size={15} />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE_SETTLE }}
              className="md:hidden border-t border-white/15 bg-black px-4 py-4 space-y-2"
            >
              <button
                type="button"
                onClick={scrollToTop}
                className="block w-full text-left py-2 text-sm font-semibold text-white hover:text-brand-400"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('services')}
                className="block w-full text-left py-2 text-sm font-semibold text-white hover:text-brand-400"
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('dashboards')}
                className="block w-full text-left py-2 text-sm font-semibold text-white hover:text-brand-400"
              >
                Dashboards
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('packages')}
                className="block w-full text-left py-2 text-sm font-semibold text-white hover:text-brand-400"
              >
                Packages
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className="block w-full text-left py-2 text-sm font-semibold text-white hover:text-brand-400"
              >
                About
              </button>
              <div className="pt-3 border-t border-white/15 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="flex-1 py-2.5 text-sm font-semibold text-white border border-white/30 rounded-lg"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onGetStarted()}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        {/* Hero Split Section — Deep Obsidian & Island Brand Glow */}
        <section className="relative bg-slate-950 text-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-35">
            <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-brand-500/40 blur-[140px]" />
            <div className="absolute bottom-12 -left-24 w-[420px] h-[420px] rounded-full bg-accent-500/20 blur-[130px]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              {/* Left Narrative Column */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_SETTLE }}
                className="lg:col-span-5 space-y-7"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-400">
                  Confidential Bookkeeping · G.C.T. Ready · Cloud Ledger
                </p>

                <h1
                  className="text-white font-extrabold tracking-tight leading-[1.08] text-balance"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.1rem, 3.5vw, 3.25rem)',
                  }}
                >
                  Focus on Growing Your Business. We&apos;ll Handle the Numbers.
                </h1>

                <p className="text-base sm:text-lg text-white/90 leading-relaxed max-w-xl">
                  Professional, reliable bookkeeping services designed to help small businesses stay
                  organized, understand their finances, and make smarter business decisions.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setContactTab('consultation');
                      scrollToSection('contact');
                    }}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-lg shadow-brand-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Book Free Consultation
                    <ArrowRight size={16} />
                  </button>

                  {isDemoAvailable && onLaunchDemo ? (
                    <button
                      type="button"
                      onClick={onLaunchDemo}
                      className="inline-flex items-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/25 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Launch Interactive Demo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onGetStarted()}
                      className="inline-flex items-center gap-1.5 px-5 py-3.5 bg-white/10 hover:bg-accent-500 hover:text-black text-white border border-accent-400/50 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Get Started
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t border-white/15 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-white/90">
                  <span>
                    <span className="text-accent-400 font-mono mr-1">01.</span>Organized Books
                  </span>
                  <span className="text-white/30">/</span>
                  <span>
                    <span className="text-accent-400 font-mono mr-1">02.</span>Tax-Ready Reports
                  </span>
                  <span className="text-white/30">/</span>
                  <span>
                    <span className="text-accent-400 font-mono mr-1">03.</span>Strict Confidentiality
                  </span>
                </div>
              </motion.div>

              {/* Right Visual Showcase Column */}
              <motion.div
                initial={{ opacity: 0, y: 22, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.08, ease: EASE_SETTLE }}
                className="lg:col-span-7"
              >
                <div className="bg-slate-900 rounded-2xl border border-brand-500/40 shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="px-4 py-3 bg-black/60 border-b border-white/10 flex items-center justify-between text-xs text-white">
                    <span className="font-semibold text-white">
                      Executive Financial Summary · Live Workspace Preview
                    </span>
                    <span className="font-mono tabular-nums text-emerald-400 font-medium">
                      DR = CR · Synced
                    </span>
                  </div>

                  {failedImages['hero'] ? (
                    <div className="aspect-video bg-slate-900 p-8 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-semibold text-accent-400 uppercase tracking-wider">
                            Executive Summary
                          </p>
                          <p className="text-3xl font-bold font-mono tabular-nums text-white mt-1">
                            $148,420.00
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-400 font-mono">
                          34.2% Net Margin
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-6">
                        <div className="bg-black/50 p-4 rounded-xl border border-white/15">
                          <p className="text-xs text-white/75">Net Profit</p>
                          <p className="text-lg font-bold font-mono tabular-nums text-white mt-1">
                            $50,810
                          </p>
                        </div>
                        <div className="bg-black/50 p-4 rounded-xl border border-white/15">
                          <p className="text-xs text-white/75">AR Current</p>
                          <p className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1">
                            $18,450
                          </p>
                        </div>
                        <div className="bg-black/50 p-4 rounded-xl border border-white/15">
                          <p className="text-xs text-white/75">G.C.T. Payable</p>
                          <p className="text-lg font-bold font-mono tabular-nums text-accent-400 mt-1">
                            $4,120
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={heroDashboardImg}
                      alt="Island Bookkeeping executive financial dashboard showing revenue and profit charts, regional breakdowns, and margin metrics"
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError('hero')}
                      className="w-full h-auto aspect-video object-cover block"
                    />
                  )}

                  <div className="px-5 py-3.5 bg-brand-900/70 border-t border-white/10 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-emerald-200 block">Avg. Monthly Close</span>
                      <span className="font-mono tabular-nums font-semibold text-white text-sm">
                        4.2 hrs
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-200 block">Tax Rate Engine</span>
                      <span className="font-mono tabular-nums font-semibold text-accent-400 text-sm">
                        15% G.C.T. / Custom
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-200 block">Statement Formats</span>
                      <span className="font-mono tabular-nums font-semibold text-white text-sm">
                        PDF · CSV · JSON
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Business Owner Benefits Strip — Deep Emerald Band */}
          <div className="relative bg-brand-800 border-t border-brand-600/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {OWNER_BENEFITS.map((benefit, idx) => (
                  <motion.div
                    key={benefit.number}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={SECTION_VIEWPORT}
                    transition={{ duration: 0.35, delay: idx * 0.05, ease: EASE_SETTLE }}
                    className="space-y-1.5"
                  >
                    <span className="text-xs font-mono font-bold text-accent-400">
                      {benefit.number}
                    </span>
                    <h2
                      className="text-sm font-extrabold text-white tracking-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {benefit.title}
                    </h2>
                    <p className="text-xs text-emerald-50/90 leading-relaxed">{benefit.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Core Bookkeeping Services Section — Fresh Emerald Tint + Workspace Photography */}
        <section id="services" className="py-20 lg:py-24 bg-emerald-50/55 border-b border-emerald-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Left Sticky Intro & Photography Column */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, ease: EASE_SETTLE }}
                className="lg:col-span-4 lg:sticky lg:top-24 space-y-6"
              >
                <div className="rounded-2xl overflow-hidden border border-emerald-900/15 shadow-lg relative bg-slate-900 group">
                  {failedImages['services_desk'] ? (
                    <div className="aspect-video bg-brand-900 p-6 flex flex-col justify-end text-white">
                      <span className="text-xs font-mono text-accent-400 font-bold">
                        Monthly Reconciliation Desk
                      </span>
                      <p className="text-sm font-semibold mt-1">
                        Dedicated statement matching, ledger coding, and G.C.T. sign-off.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={servicesConsultationImg}
                        alt="Bookkeeping desk with emerald ledger portfolio, reconciled monthly bank statements, and financial laptop display"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError('services_desk')}
                        className="w-full h-auto aspect-video object-cover block transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4">
                        <p className="text-xs font-mono font-bold text-accent-400">
                          Reconciled Every Month
                        </p>
                        <p className="text-xs font-semibold text-white mt-0.5">
                          Dedicated ledger review &amp; G.C.T. schedule preparation
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                    Bookkeeping Services
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight text-balance"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Focused financial support for every stage of small business growth.
                  </h2>
                  <p className="text-sm sm:text-base text-black leading-relaxed">
                    Select any individual service you need—or combine them into a monthly plan.
                    Every engagement includes clear communication, organized records, and strict
                    confidentiality.
                  </p>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={() => selectServiceAndEnquire('Essential Monthly Bookkeeping')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Book Free Consultation
                    <ArrowRight size={15} />
                  </button>
                  <div>
                    <a
                      href={getWhatsAppHref()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-black hover:text-brand-700 underline underline-offset-4 transition-colors"
                    >
                      <MessageCircle size={14} className="text-brand-600" />
                      Prefer WhatsApp? Send a direct enquiry
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Right Structured Service Rows */}
              <div className="lg:col-span-8 bg-white border border-emerald-200/90 rounded-2xl divide-y divide-emerald-100 shadow-sm overflow-hidden">
                {MAJOR_SERVICES.map((service, idx) => (
                  <motion.div
                    key={service.number}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={SECTION_VIEWPORT}
                    transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.25), ease: EASE_SETTLE }}
                    className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-black/75">
                        <span className="font-mono font-bold text-brand-700">
                          {service.number}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium">{service.scope}</span>
                      </div>

                      <h3
                        className="text-xl font-extrabold text-black tracking-tight"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {service.title}
                      </h3>

                      <p className="text-sm text-black leading-relaxed">{service.description}</p>

                      <p className="text-xs font-semibold text-brand-700 pt-0.5">
                        Deliverable · {service.deliverable}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        aria-label={`Enquire about ${service.title}`}
                        onClick={() => selectServiceAndEnquire(service.title)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Enquire Now
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Dashboards Section — Warm Gold Tint */}
        <section id="dashboards" className="py-20 lg:py-24 bg-accent-50/60 border-b border-amber-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={SECTION_VIEWPORT}
              transition={{ duration: 0.4, ease: EASE_SETTLE }}
              className="max-w-3xl mb-12"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 mb-3">
                Product Workspaces
              </p>
              <h2
                className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight text-balance"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Every bookkeeping workflow has its own purpose-built dashboard.
              </h2>
              <p className="mt-4 text-base text-black leading-relaxed">
                Inspect each module inside Island Bookkeeping. Select a workspace below to preview
                how invoicing, budget forecasting, and balanced financial statements connect to a
                single ledger.
              </p>
            </motion.div>

            {/* Interactive Module Selector Strip */}
            <div
              role="tablist"
              aria-label="Dashboard Workspaces"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-amber-200 rounded-xl overflow-hidden bg-white mb-10 shadow-sm"
            >
              {DASHBOARD_MODULES.map((mod) => {
                const isActive = mod.id === activeModule.id;
                return (
                  <button
                    key={mod.id}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setActiveModuleId(mod.id)}
                    className={cn(
                      'text-left p-5 transition-colors border-b sm:border-b-0 sm:border-r last:border-r-0 border-amber-200/70 cursor-pointer focus:outline-none',
                      isActive
                        ? 'bg-black text-white shadow-[inset_0_-3px_0_0_#FED100]'
                        : 'text-black hover:bg-amber-50/70'
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className={isActive ? 'text-accent-400 font-semibold' : 'text-brand-700 font-semibold'}>
                        {mod.number}
                      </span>
                      {isActive && (
                        <span className="text-[11px] font-sans font-semibold text-emerald-400">
                          Viewing
                        </span>
                      )}
                    </div>
                    <p className={cn('text-sm font-bold', isActive ? 'text-white' : 'text-black')}>
                      {mod.label}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Active Dashboard Showcase Panel — High-Contrast Obsidian Card */}
            <div className="bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: EASE_SETTLE }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
                >
                  {/* Screenshot Frame */}
                  <div className="lg:col-span-7">
                    <div className="bg-slate-900 rounded-xl border border-white/15 shadow-lg overflow-hidden">
                      {failedImages[activeModule.id] ? (
                        <div className="aspect-[4/3] bg-slate-900 p-8 flex flex-col justify-center items-start space-y-4">
                          <span className="text-xs font-mono text-accent-400 font-semibold">
                            {activeModule.number} {activeModule.label}
                          </span>
                          <p className="text-xl font-bold text-white">{activeModule.title}</p>
                          <p className="text-sm text-white/85">{activeModule.summary}</p>
                          <div className="pt-2 font-mono text-2xl font-bold text-emerald-400">
                            {activeModule.keyMetricValue}
                          </div>
                        </div>
                      ) : (
                        <img
                          src={activeModule.image}
                          alt={activeModule.imageAlt}
                          referrerPolicy="no-referrer"
                          onError={() => handleImageError(activeModule.id)}
                          className="w-full h-auto aspect-[4/3] object-cover block"
                        />
                      )}
                    </div>
                  </div>

                  {/* Detail Column */}
                  <div className="lg:col-span-5 space-y-6">
                    <div>
                      <span className="text-xs font-mono font-semibold text-accent-400">
                        {activeModule.number} {activeModule.label}
                      </span>
                      <h3
                        className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {activeModule.title}
                      </h3>
                      <p className="mt-3 text-sm sm:text-base text-white/85 leading-relaxed">
                        {activeModule.summary}
                      </p>
                    </div>

                    {/* Key Metric Box */}
                    <div className="bg-black/60 border border-brand-500/40 rounded-xl p-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-xs font-medium text-white/85">
                          {activeModule.keyMetricLabel}
                        </span>
                        <span className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                          {activeModule.keyMetricValue}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-white/75">{activeModule.keyMetricNote}</p>
                    </div>

                    {/* Numbered Outcomes */}
                    <ul className="space-y-3">
                      {activeModule.outcomes.map((item, idx) => (
                        <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                          <span className="font-mono text-xs font-semibold text-accent-400 mt-0.5 shrink-0">
                            0{idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onGetStarted()}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Open {activeModule.label} in Workspace
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Asymmetric Capabilities Bento — Deep Forest Emerald Section */}
        <section id="capabilities" className="py-20 lg:py-24 bg-brand-900 text-white border-b border-brand-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={SECTION_VIEWPORT}
              transition={{ duration: 0.4, ease: EASE_SETTLE }}
              className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12"
            >
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-400 mb-3">
                  Core Infrastructure
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Built for clean imports, exact taxes, and strict financial controls.
                </h2>
              </div>
              <p className="text-sm text-emerald-100/90 max-w-md">
                Every capability writes straight to your Chart of Accounts—eliminating manual
                double-entry errors between sales, bills, and tax periods.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Feature 1 — Wide Obsidian Contrast Card */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.35, ease: EASE_SETTLE }}
                className="lg:col-span-2 bg-black text-white border border-white/15 rounded-2xl p-7 sm:p-9 flex flex-col justify-between gap-8"
              >
                <div className="space-y-4 max-w-2xl">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-accent-400">
                    <FileSpreadsheet size={16} />
                    <span>Automated Data Cleaning & Ingestion</span>
                  </div>
                  <h3
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Turn messy bank CSVs and JSON dumps into clean ledger lines in seconds.
                  </h3>
                  <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                    Upload raw exports from local banks or payment processors. Island Bookkeeping
                    automatically strips formatting noise, repairs malformed dates, detects duplicate
                    rows, and previews clean figures before committing.
                  </p>
                </div>

                {/* Concrete Raw vs Cleaned Preview Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-white/80 font-mono">
                    <span>Statement Normalization Preview</span>
                    <span className="text-emerald-400">3 rows sanitized · 1 duplicate skipped</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-white/80">
                          <th className="py-2.5 px-4 font-medium">Raw Input</th>
                          <th className="py-2.5 px-4 font-medium">Normalized Date</th>
                          <th className="py-2.5 px-4 font-medium">Category</th>
                          <th className="py-2.5 px-4 font-medium text-right">Net Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-white">
                        <tr>
                          <td className="py-2.5 px-4 text-white/80">"USD $4,250.00 " · 11/04/26</td>
                          <td className="py-2.5 px-4">2026-11-04</td>
                          <td className="py-2.5 px-4">Consulting Services</td>
                          <td className="py-2.5 px-4 text-right text-emerald-400">$4,250.00</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 text-white/80">JMD 1,890.5 · Nov 06</td>
                          <td className="py-2.5 px-4">2026-11-06</td>
                          <td className="py-2.5 px-4">Logistics & Freight</td>
                          <td className="py-2.5 px-4 text-right text-emerald-400">$1,890.50</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>

              {/* Feature 2 — G.C.T. & Tax Engine (Crisp White Contrast Card) */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.35, delay: 0.06, ease: EASE_SETTLE }}
                className="bg-white text-black border border-brand-200 rounded-2xl p-7 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                    <Receipt size={16} />
                    <span>Tax & Compliance</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-black"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Precision G.C.T. calculation on every invoice
                  </h3>
                  <p className="text-sm text-black leading-relaxed">
                    Apply standard 15% G.C.T. or custom tax percentages automatically across
                    multi-item invoices, and track collected output tax separately from net revenue.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-4 space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-black">
                    <span>Subtotal (Services)</span>
                    <span>$12,400.00</span>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>G.C.T. (15.0%)</span>
                    <span>$1,860.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-black pt-1 border-t border-slate-200">
                    <span>Total Receivable</span>
                    <span className="text-brand-700">$14,260.00</span>
                  </div>
                </div>
              </motion.div>

              {/* Feature 3 — Double-Entry & Chart of Accounts (Warm Gold Card) */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.35, delay: 0.1, ease: EASE_SETTLE }}
                className="bg-accent-50 text-black border border-amber-200 rounded-2xl p-7 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <Scale size={16} />
                    <span>Chart of Accounts</span>
                  </div>
                  <h3
                    className="text-xl font-bold text-black"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Strict debit & credit balancing
                  </h3>
                  <p className="text-sm text-black leading-relaxed">
                    Organize Asset, Liability, Equity, Income, and Expense accounts with numbered
                    account codes. Unbalanced journal entries are blocked before posting.
                  </p>
                </div>
                <div className="border-t border-amber-200/80 pt-4 text-xs text-black space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span>1010 · Cash at Bank</span>
                    <span className="text-brand-700 font-semibold">DR $14,260</span>
                  </div>
                  <div className="flex justify-between">
                    <span>4000 · Service Revenue</span>
                    <span className="text-black font-semibold">CR $12,400</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2200 · G.C.T. Payable</span>
                    <span className="text-black font-semibold">CR $1,860</span>
                  </div>
                </div>
              </motion.div>

              {/* Feature 4 — Wide AP, Recurring Bills & Client Directory */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.35, delay: 0.14, ease: EASE_SETTLE }}
                className="lg:col-span-2 bg-white text-black border border-brand-200 rounded-2xl p-7 sm:p-9 grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                    <Clock size={16} />
                    <span>Receivables & Payables Control</span>
                  </div>
                  <h3
                    className="text-2xl font-bold text-black"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Keep both incoming client cash and outgoing vendor bills in view.
                  </h3>
                  <p className="text-sm text-black leading-relaxed">
                    Manage your complete Client Directory alongside Accounts Receivable and Accounts
                    Payable aging schedules. Record partial settlements, spot overdue suppliers, and
                    prevent late penalties.
                  </p>
                </div>

                <div className="bg-emerald-50/75 border border-emerald-200 rounded-xl p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-black pb-2 border-b border-emerald-200">
                    <span>Working Capital Snapshot</span>
                    <span className="font-mono text-brand-700 font-bold">Net +$26,890</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-black">Accounts Receivable (Current)</span>
                    <span className="font-mono tabular-nums font-semibold text-black">
                      $39,120.00
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-black">Accounts Payable (Due in 14d)</span>
                    <span className="font-mono tabular-nums font-semibold text-black">
                      $12,230.00
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-black">Recurring Operating Commitments</span>
                    <span className="font-mono tabular-nums font-semibold text-amber-800">
                      6 Active Schedules
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Service Packages & Pricing Guidance Section */}
        <section id="packages" className="py-20 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 mb-3">
                  Service Packages & Pricing Guidance
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Transparent plans built for every stage of your business.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-black leading-relaxed">
                  Use Island Bookkeeping on your own or partner with our bookkeeping team for
                  hands-off monthly reconciliations, G.C.T. preparation, and executive reporting.
                </p>
              </div>

              {/* Currency Guidance Toggle */}
              <div
                role="group"
                aria-label="Pricing display currency"
                className="inline-flex items-center p-1 bg-emerald-50 border border-emerald-200 rounded-lg self-start lg:self-auto shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setPricingCurrency('USD')}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    pricingCurrency === 'USD'
                      ? 'bg-brand-600 text-white'
                      : 'text-black hover:bg-white/80'
                  )}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingCurrency('JMD')}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    pricingCurrency === 'JMD'
                      ? 'bg-brand-600 text-white'
                      : 'text-black hover:bg-white/80'
                  )}
                >
                  JMD (J$)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {SERVICE_PACKAGES.map((pkg, idx) => {
                const displayPrice = pricingCurrency === 'USD' ? pkg.priceUsd : pkg.priceJmd;
                return (
                  <motion.article
                    key={pkg.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={SECTION_VIEWPORT}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_SETTLE }}
                    className={cn(
                      'rounded-2xl p-7 sm:p-8 flex flex-col justify-between gap-8 border',
                      pkg.recommended
                        ? 'bg-slate-950 text-white border-brand-500 shadow-xl'
                        : pkg.id === 'essential'
                          ? 'bg-emerald-50/75 text-black border-emerald-200'
                          : 'bg-amber-50/65 text-black border-amber-200'
                    )}
                  >
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className={pkg.recommended ? 'text-accent-400 font-bold' : 'text-brand-700 font-bold'}>
                            {pkg.number}
                          </span>
                          {pkg.recommended && (
                            <span className="font-sans font-semibold text-emerald-400">
                              Most Popular · Small Business
                            </span>
                          )}
                        </div>
                        <h3
                          className="text-xl sm:text-2xl font-extrabold tracking-tight"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {pkg.name}
                        </h3>
                        <p
                          className={cn(
                            'text-sm leading-relaxed',
                            pkg.recommended ? 'text-white/85' : 'text-black/80'
                          )}
                        >
                          {pkg.tagline}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'pt-5 border-t',
                          pkg.recommended ? 'border-slate-800' : 'border-slate-200'
                        )}
                      >
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={displayPrice}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16, ease: EASE_SETTLE }}
                            className="text-3xl font-extrabold font-mono tabular-nums tracking-tight"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {displayPrice}
                          </motion.p>
                        </AnimatePresence>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            pkg.recommended ? 'text-white/75' : 'text-black/75'
                          )}
                        >
                          {pkg.cadence}
                        </p>
                      </div>

                      <ul className="space-y-3 text-sm">
                        {pkg.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check
                              size={16}
                              className={cn(
                                'shrink-0 mt-0.5',
                                pkg.recommended ? 'text-emerald-400' : 'text-brand-600'
                              )}
                            />
                            <span className={pkg.recommended ? 'text-white/95' : 'text-black'}>
                              {feat}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (pkg.ctaMode === 'workspace') {
                            onGetStarted(pkg.name);
                          } else {
                            selectPackageAndScroll(pkg.name, pkg.ctaMode);
                          }
                        }}
                        className={cn(
                          'w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
                          pkg.recommended
                            ? 'bg-brand-500 hover:bg-brand-600 text-white'
                            : 'bg-black hover:bg-brand-600 text-white'
                        )}
                      >
                        {pkg.ctaLabel}
                        <ArrowRight size={16} />
                      </button>
                      {pkg.ctaMode !== 'workspace' && (
                        <button
                          type="button"
                          onClick={() => onGetStarted(pkg.name)}
                          className={cn(
                            'w-full text-center text-xs font-semibold hover:underline underline-offset-4 py-1 transition-colors cursor-pointer',
                            pkg.recommended ? 'text-white/85 hover:text-white' : 'text-black/75 hover:text-brand-700'
                          )}
                        >
                          Or sign up directly with this plan →
                        </button>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-black">
              <p className="leading-relaxed">
                <span className="font-bold">Pricing guidance:</span> Final monthly fees scale clearly
                by bank account count and transaction volume—confirmed in writing after your free
                20-minute review with no hidden setup fees.
              </p>
              <button
                type="button"
                onClick={() => selectPackageAndScroll('Custom / Catch-Up Quote', 'consultation')}
                className="font-bold text-brand-700 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer text-left sm:text-right"
              >
                Need catch-up bookkeeping? Request a custom quote
              </button>
            </div>
          </div>
        </section>

        {/* About the Business & Confidentiality Standards — Emerald Brand Surface + Team Photography */}
        <section id="about" className="py-20 lg:py-24 bg-brand-50 border-t border-brand-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, ease: EASE_SETTLE }}
                className="lg:col-span-5 space-y-6"
              >
                <div className="rounded-2xl overflow-hidden border border-brand-200 shadow-md relative bg-brand-900 group">
                  {failedImages['about_team'] ? (
                    <div className="aspect-[4/3] bg-brand-900 p-8 flex flex-col justify-end text-white">
                      <span className="text-xs font-mono font-bold text-accent-400">
                        Kingston &amp; Remote Advisory
                      </span>
                      <p className="text-lg font-bold mt-1">
                        Accountant-led monthly reviews with real human communication.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={aboutTeamImg}
                        alt="Island Bookkeeping financial advisor reviewing monthly growth and financial records with a Caribbean small business owner"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError('about_team')}
                        className="w-full h-auto aspect-[4/3] object-cover block transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5">
                        <p className="text-xs font-mono font-bold text-accent-400">
                          Human Bookkeepers + Cloud Software
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                          Built for Caribbean &amp; remote small business owners
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                    About Island Bookkeeping
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight text-balance"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Built on trust, confidentiality, and dependable numbers.
                  </h2>
                  <p className="text-sm sm:text-base text-black leading-relaxed">
                    Handing over your bank statements, revenue figures, and tax obligations requires
                    complete confidence. Island Bookkeeping pairs experienced small-business
                    bookkeeping workflows with disciplined double-entry cloud software—so owners in
                    Jamaica and across remote teams always know where their business stands.
                  </p>

                  <div className="pt-3 grid grid-cols-2 gap-6 border-t border-brand-200">
                    {QUANTIFIED_IMPACT.slice(0, 2).map((stat) => (
                      <div key={stat.value} className="space-y-1">
                        <p
                          className="text-2xl font-extrabold font-mono tabular-nums text-brand-700"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {stat.value}
                        </p>
                        <p className="text-xs text-black/85 leading-snug">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.08, ease: EASE_SETTLE }}
                className="lg:col-span-7 divide-y divide-emerald-100 border border-emerald-200/80 bg-white rounded-2xl px-6 sm:px-8 shadow-sm"
              >
                {TRUST_PILLARS.map((pillar) => (
                  <div key={pillar.number} className="py-6 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-brand-700">
                        {pillar.number}
                      </span>
                      <h3
                        className="text-lg font-bold text-black"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {pillar.title}
                      </h3>
                    </div>
                    <p className="text-sm text-black leading-relaxed pl-7">{pillar.detail}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Three-Step Close Rhythm */}
            <div id="workflow" className="mt-16 pt-12 border-t border-brand-200/80">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.4, ease: EASE_SETTLE }}
                className="max-w-2xl mb-10"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 mb-2">
                  Simple Onboarding & Monthly Rhythm
                </p>
                <h3
                  className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  From scattered spreadsheets to organized monthly books in three steps.
                </h3>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {WORKFLOW_STEPS.map((item, idx) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={SECTION_VIEWPORT}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_SETTLE }}
                    className="bg-white border border-emerald-200/80 rounded-2xl p-6 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-brand-600 font-bold text-sm">{item.step}</span>
                      <span className="text-amber-800 font-semibold">{item.timing}</span>
                    </div>
                    <h4
                      className="text-lg font-bold text-black"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {item.title}
                    </h4>
                    <p className="text-sm text-black leading-relaxed">{item.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Security Section — Deep Obsidian Architectural Showcase */}
        <section id="security" className="py-20 lg:py-24 bg-slate-950 text-white border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-12">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, ease: EASE_SETTLE }}
                className="lg:col-span-6 space-y-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-400">
                  Trust &amp; Security
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Your financial records stay encrypted, backed up, and strictly confidential.
                </h2>
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Small business owners trust us with sensitive bank, payroll, and tax records—every
                  layer of Island Bookkeeping is structured to protect your privacy and eliminate
                  unauthorized exposure.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.06, ease: EASE_SETTLE }}
                className="lg:col-span-6"
              >
                <div className="rounded-2xl overflow-hidden border border-brand-500/35 bg-black relative shadow-2xl group">
                  {failedImages['security_vault'] ? (
                    <div className="aspect-video bg-slate-900 p-8 flex flex-col justify-end">
                      <span className="text-xs font-mono font-bold text-accent-400">
                        TLS 1.3 + AES-256 Protected Storage
                      </span>
                      <p className="text-lg font-bold text-white mt-1">
                        Row-level tenant isolation &amp; automated daily cloud backups.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={securityVaultImg}
                        alt="Architectural dark slate and emerald glass financial vault symbolizing enterprise data encryption and confidentiality"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError('security_vault')}
                        className="w-full h-auto aspect-video object-cover block transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5">
                        <p className="text-xs font-mono font-bold text-accent-400">
                          Zero Shared Ledgers · Daily Backups
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                          Encrypted in transit and at rest with strict account-level isolation
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TRUST_SECURITY_ITEMS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <motion.article
                    key={item.number}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={SECTION_VIEWPORT}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_SETTLE }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col justify-between gap-6 hover:border-brand-500/60 transition-colors"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
                          <IconComponent size={20} />
                        </div>
                        <span className="text-xs font-mono font-bold text-accent-400">
                          {item.number}
                        </span>
                      </div>

                      <h3
                        className="text-xl font-extrabold text-white tracking-tight"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {item.title}
                      </h3>

                      <p className="text-sm text-white/85 leading-relaxed">{item.description}</p>
                    </div>

                    <p className="pt-4 border-t border-slate-800 text-xs font-semibold text-emerald-400">
                      {item.spec}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Interactive Bookkeeping ROI & Time-Saved Calculator — Deep Emerald Band */}
        <section id="calculator" className="py-20 lg:py-24 bg-brand-800 text-white border-t border-brand-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.4, ease: EASE_SETTLE }}
                className="lg:col-span-5 space-y-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-400">
                  Interactive Close-Time Estimator
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Calculate what manual spreadsheets cost your business each year.
                </h2>
                <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed">
                  Adjust your monthly invoice volume, imported bank lines, and internal finance rate
                  to estimate hours reclaimed with automated statement cleaning, G.C.T. invoicing,
                  and double-entry posting.
                </p>

                <div className="pt-4 space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label htmlFor="calc-invoices" className="text-white font-medium">
                        Monthly Invoices & Vendor Bills
                      </label>
                      <span className="font-mono tabular-nums font-semibold text-accent-400">
                        {monthlyInvoices} docs
                      </span>
                    </div>
                    <input
                      id="calc-invoices"
                      type="range"
                      min={10}
                      max={400}
                      step={5}
                      value={monthlyInvoices}
                      onChange={(e) => setMonthlyInvoices(Number(e.target.value))}
                      className="w-full accent-accent-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label htmlFor="calc-lines" className="text-white font-medium">
                        Bank & Card Transactions / Month
                      </label>
                      <span className="font-mono tabular-nums font-semibold text-accent-400">
                        {monthlyBankLines} rows
                      </span>
                    </div>
                    <input
                      id="calc-lines"
                      type="range"
                      min={50}
                      max={2000}
                      step={25}
                      value={monthlyBankLines}
                      onChange={(e) => setMonthlyBankLines(Number(e.target.value))}
                      className="w-full accent-accent-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label htmlFor="calc-rate" className="text-white font-medium">
                        Bookkeeping / Staff Hourly Cost
                      </label>
                      <span className="font-mono tabular-nums font-semibold text-accent-400">
                        ${hourlyRate}/hr
                      </span>
                    </div>
                    <input
                      id="calc-rate"
                      type="range"
                      min={20}
                      max={150}
                      step={5}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full accent-accent-500 cursor-pointer"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.08, ease: EASE_SETTLE }}
                className="lg:col-span-7"
              >
                <div className="bg-black border border-white/15 rounded-2xl p-7 sm:p-10 space-y-8 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/15 pb-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/80">
                        Estimated Annual Administrative Savings
                      </p>
                      <p
                        className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums text-accent-400 mt-2"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        ${annualSavings.toLocaleString()}/yr
                      </p>
                    </div>
                    <ShieldCheck size={28} className="text-emerald-400 shrink-0 hidden sm:block" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5">
                      <p className="text-xs text-white/80">Reconciliation Time Reclaimed</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1.5">
                        {hoursSavedPerMonth} hrs / month
                      </p>
                      <p className="text-xs text-white/75 mt-1">
                        Automated CSV cleanup & double-entry posting
                      </p>
                    </div>

                    <div className="bg-slate-900 border border-white/10 rounded-xl p-5">
                      <p className="text-xs text-white/80">Projected AR Collection Speedup</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1.5">
                        {fasterCollectionDays} days faster
                      </p>
                      <p className="text-xs text-white/75 mt-1">
                        Via structured aging buckets & partial-payment tracking
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <p className="text-xs text-white/80">
                      Estimates based on typical manual CSV cleanup and invoice reconciliation effort.
                    </p>
                    <button
                      type="button"
                      onClick={() => onGetStarted()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Start Saving {hoursSavedPerMonth} hrs/mo
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Quantified Client Outcomes — Warm Gold Tint + Commercial Photography */}
        <section id="proof" className="py-20 lg:py-24 bg-accent-50/55 border-b border-amber-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-12">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.4, ease: EASE_SETTLE }}
                className="lg:col-span-6 space-y-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                  Verified Operational Results
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight text-balance"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  How finance teams replace spreadsheet patchwork with Island Bookkeeping.
                </h2>
                <p className="text-sm sm:text-base text-black leading-relaxed">
                  From Kingston distribution hubs to hospitality operators in Ocho Rios and remote
                  advisory firms, owners reclaim hours every week and enter tax season prepared.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.08, ease: EASE_SETTLE }}
                className="lg:col-span-6"
              >
                <div className="rounded-2xl overflow-hidden border border-amber-300/70 shadow-lg relative bg-slate-900 group">
                  {failedImages['proof_business'] ? (
                    <div className="aspect-video bg-brand-900 p-8 flex flex-col justify-end text-white">
                      <span className="text-xs font-mono font-bold text-accent-400">
                        Verified Client Impact
                      </span>
                      <p className="text-lg font-bold mt-1">
                        12+ hours reclaimed monthly across small business finance teams.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={proofBusinessImg}
                        alt="Caribbean operations manager reviewing real-time revenue and cash-flow performance on a tablet inside a modern commercial facility"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError('proof_business')}
                        className="w-full h-auto aspect-video object-cover block transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5">
                        <p className="text-xs font-mono font-bold text-accent-400">
                          Real-World Small Business Operations
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                          Live receivables, inventory margins &amp; monthly close at your fingertips
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {CLIENT_OUTCOMES.map((item, idx) => (
                <motion.article
                  key={item.author}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={SECTION_VIEWPORT}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_SETTLE }}
                  className="bg-white border border-amber-200/90 rounded-2xl p-7 flex flex-col justify-between gap-6 shadow-sm"
                >
                  <div className="space-y-5">
                    <div className="space-y-2 pb-4 border-b border-amber-100 text-xs">
                      <p className="text-black">
                        <span className="font-semibold text-black">Before:</span> {item.before}
                      </p>
                      <p className="text-brand-700 font-semibold">
                        <span>Outcome:</span> {item.outcome}
                      </p>
                    </div>
                    <p className="text-sm sm:text-base text-black leading-relaxed">
                      "{item.quote}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-bold text-black">{item.author}</p>
                    <p className="text-xs text-black/80 mt-0.5">{item.role}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ & Direct Conversion Section */}
        <section id="faq" className="py-20 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* FAQ Column */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.4, ease: EASE_SETTLE }}
                className="lg:col-span-6 space-y-6"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 mb-2">
                    Questions & Answers
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Everything your accountant will ask before switching.
                  </h2>
                </div>

                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {FAQS.map((item) => (
                    <div key={item.q} className="py-5 space-y-2">
                      <h3 className="text-sm sm:text-base font-bold text-black">{item.q}</h3>
                      <p className="text-sm text-black leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Free Consultation, Client Onboarding & WhatsApp Contact Column */}
              <motion.div
                id="contact"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={SECTION_VIEWPORT}
                transition={{ duration: 0.45, delay: 0.08, ease: EASE_SETTLE }}
                className="lg:col-span-6"
              >
                <div className="bg-emerald-50/75 border border-brand-200 rounded-2xl p-7 sm:p-9 space-y-6 shadow-sm">
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                      Get Started With Confidence
                    </p>
                    <h2
                      className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Book a free consultation or start client onboarding.
                    </h2>
                    <p className="text-sm text-black leading-relaxed">
                      Speak directly with our bookkeeping team, submit your onboarding profile, or
                      message us instantly on WhatsApp for quick answers.
                    </p>
                  </div>

                  {/* Direct WhatsApp Enquiry Banner */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-black flex items-center gap-1.5">
                        <Phone size={14} className="text-brand-600" />
                        Prefer a quick chat first?
                      </p>
                      <p className="text-xs text-black/80">
                        Send a confidential enquiry on WhatsApp with your selected plan.
                      </p>
                    </div>
                    <a
                      href={getWhatsAppHref()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageCircle size={15} />
                      WhatsApp Enquiry
                    </a>
                  </div>

                  {/* Consultation vs Onboarding Mode Tabs */}
                  <div
                    role="tablist"
                    aria-label="Enquiry mode"
                    className="grid grid-cols-2 p-1 bg-black rounded-xl"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={contactTab === 'consultation'}
                      onClick={() => {
                        setContactTab('consultation');
                        setInquirySubmitted(false);
                        setInquiryError(null);
                      }}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap',
                        contactTab === 'consultation'
                          ? 'bg-brand-500 text-white'
                          : 'text-white/85 hover:text-white'
                      )}
                    >
                      <Calendar size={14} />
                      Free Consultation
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={contactTab === 'onboarding'}
                      onClick={() => {
                        setContactTab('onboarding');
                        setInquirySubmitted(false);
                        setInquiryError(null);
                      }}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap',
                        contactTab === 'onboarding'
                          ? 'bg-brand-500 text-white'
                          : 'text-white/85 hover:text-white'
                      )}
                    >
                      <ClipboardCheck size={14} />
                      Client Onboarding
                    </button>
                  </div>

                  <div>
                    <AnimatePresence mode="wait">
                    {inquirySubmitted ? (
                      <motion.div
                        key="submitted"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: EASE_SETTLE }}
                        className="bg-white border border-brand-300 rounded-xl p-6 space-y-4"
                      >
                        <div className="flex items-center gap-2 text-brand-700 font-bold text-sm">
                          <Check size={18} />
                          <span>
                            {contactTab === 'consultation'
                              ? 'Free consultation request confirmed'
                              : 'Client onboarding profile submitted'}
                          </span>
                        </div>
                        <p className="text-sm text-black leading-relaxed">
                          Thank you, <span className="font-semibold">{inquiryName}</span>. We
                          logged your{' '}
                          <span className="font-semibold">{selectedPackage}</span> request for{' '}
                          <span className="font-semibold">
                            {inquiryBusiness || 'your business'}
                          </span>{' '}
                          and will follow up at{' '}
                          <span className="font-semibold">{inquiryEmail}</span> or{' '}
                          <span className="font-semibold">{inquiryPhone}</span>
                          {contactTab === 'consultation'
                            ? ` (${inquiryPreferredTime}).`
                            : ` (${inquiryVolume}).`}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => onGetStarted()}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Get Started in Workspace
                            <ArrowRight size={14} />
                          </button>
                          <a
                            href={getWhatsAppHref()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-black text-xs font-semibold rounded-lg transition-colors"
                          >
                            <MessageCircle size={14} className="text-brand-600" />
                            Follow up on WhatsApp
                          </a>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.form
                        key={contactTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: EASE_SETTLE }}
                        onSubmit={handleInquirySubmit}
                        className="space-y-4"
                      >
                        {inquiryError && (
                          <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                            {inquiryError}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="lead-name"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Full Name
                            </label>
                            <input
                              id="lead-name"
                              type="text"
                              value={inquiryName}
                              onChange={(e) => setInquiryName(e.target.value)}
                              placeholder="Kareem Campbell"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="lead-business"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Business Name
                            </label>
                            <input
                              id="lead-business"
                              type="text"
                              value={inquiryBusiness}
                              onChange={(e) => setInquiryBusiness(e.target.value)}
                              placeholder="Blue Mountain Logistics Ltd."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="lead-email"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Work Email
                            </label>
                            <input
                              id="lead-email"
                              type="email"
                              value={inquiryEmail}
                              onChange={(e) => setInquiryEmail(e.target.value)}
                              placeholder="finance@company.com"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="lead-phone"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Phone / WhatsApp
                            </label>
                            <input
                              id="lead-phone"
                              type="tel"
                              value={inquiryPhone}
                              onChange={(e) => setInquiryPhone(e.target.value)}
                              placeholder="+1 (876) 555-0190"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="lead-package"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Service Package
                            </label>
                            <select
                              id="lead-package"
                              value={selectedPackage}
                              onChange={(e) => setSelectedPackage(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            >
                              <optgroup label="Bookkeeping Packages">
                                <option>Essential Monthly Bookkeeping</option>
                                <option>Growth Bookkeeping &amp; Tax Prep</option>
                                <option>Full-Service &amp; Advisory</option>
                                <option>Custom / Catch-Up Quote</option>
                              </optgroup>
                              <optgroup label="Specific Services">
                                {MAJOR_SERVICES.map((service) => (
                                  <option key={service.number} value={service.title}>
                                    {service.title}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {contactTab === 'consultation' ? (
                            <div>
                              <label
                                htmlFor="lead-time"
                                className="block text-xs font-semibold text-black mb-1"
                              >
                                Preferred Call Window
                              </label>
                              <select
                                id="lead-time"
                                value={inquiryPreferredTime}
                                onChange={(e) => setInquiryPreferredTime(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                              >
                                <option>Morning (9:00 AM – 12:00 PM)</option>
                                <option>Afternoon (12:00 PM – 4:00 PM)</option>
                                <option>Late Afternoon (4:00 PM – 6:00 PM)</option>
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label
                                htmlFor="lead-volume"
                                className="block text-xs font-semibold text-black mb-1"
                              >
                                Monthly Transaction Volume
                              </label>
                              <select
                                id="lead-volume"
                                value={inquiryVolume}
                                onChange={(e) => setInquiryVolume(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                              >
                                <option>Under 50 transactions / mo</option>
                                <option>50 – 250 transactions / mo</option>
                                <option>250 – 1,000 transactions / mo</option>
                                <option>1,000+ transactions / mo (Multi-entity)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {contactTab === 'onboarding' && (
                          <div>
                            <label
                              htmlFor="lead-setup"
                              className="block text-xs font-semibold text-black mb-1"
                            >
                              Current Accounting Records
                            </label>
                            <select
                              id="lead-setup"
                              value={inquiryCurrentSetup}
                              onChange={(e) => setInquiryCurrentSetup(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                            >
                              <option>Excel / Spreadsheets</option>
                              <option>Paper Receipts / Bank Statements Only</option>
                              <option>QuickBooks / Xero / Wave</option>
                              <option>Starting a New Business Ledger</option>
                            </select>
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="lead-notes"
                            className="block text-xs font-semibold text-black mb-1"
                          >
                            {contactTab === 'consultation'
                              ? 'What would you like help with? (Optional)'
                              : 'Key priorities or catch-up months needed (Optional)'}
                          </label>
                          <textarea
                            id="lead-notes"
                            rows={2}
                            value={inquiryNotes}
                            onChange={(e) => setInquiryNotes(e.target.value)}
                            placeholder="e.g., Monthly reconciliations, G.C.T. tracking, or catching up 2026 books"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 px-4 bg-black hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {contactTab === 'consultation'
                            ? 'Book Free 20-Min Consultation'
                            : 'Submit Client Onboarding Form'}
                        </button>

                        <p className="flex items-center justify-center gap-1.5 text-[11px] text-black/75 pt-1">
                          <Lock size={12} className="text-brand-600" />
                          100% confidential enquiry · No obligation or long-term lock-in
                        </p>
                      </motion.form>
                    )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      {/* Structured Executive Footer */}
      <footer className="bg-black text-white border-t border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/15">
            {/* Brand Column */}
            <div className="lg:col-span-4 space-y-5">
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTop();
                }}
                className="inline-flex items-center gap-2.5 whitespace-nowrap focus:outline-none"
              >
                <span className="w-8 h-8 rounded-lg jamaica-gradient flex items-center justify-center text-white font-extrabold text-sm">
                  I
                </span>
                <span
                  className="text-lg font-extrabold tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Island Bookkeeping
                </span>
              </a>

              <p className="text-sm text-white/85 leading-relaxed max-w-sm">
                Double-entry bookkeeping, automated G.C.T. invoicing, CSV/JSON statement cleaning,
                and audit-ready financial reporting built for Caribbean and remote enterprises.
              </p>

              <p className="text-xs font-mono text-emerald-400">
                DR = CR Balanced · 15% G.C.T. Ready · PDF & CSV Exports
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onGetStarted()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Get Started
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Workspaces Column */}
            <div className="lg:col-span-3 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                Feature Dashboards
              </p>
              <ul className="space-y-2.5 text-sm">
                {DASHBOARD_MODULES.map((mod) => (
                  <li key={mod.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModuleId(mod.id);
                        scrollToSection('dashboards');
                      }}
                      className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                    >
                      {mod.number} {mod.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Capabilities Column */}
            <div className="lg:col-span-2 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                Capabilities
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('capabilities')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    CSV & JSON Cleaner
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('capabilities')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    G.C.T. Tax Engine
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('capabilities')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Chart of Accounts
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('calculator')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    ROI Calculator
                  </button>
                </li>
              </ul>
            </div>

            {/* Account & Support Column */}
            <div className="lg:col-span-3 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                Packages & Contact
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('services')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Core Bookkeeping Services
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('packages')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Service Packages & Pricing
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('about')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    About Island Bookkeeping
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('security')}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Trust &amp; Security
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setContactTab('consultation');
                      scrollToSection('contact');
                    }}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Book Free Consultation
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setContactTab('onboarding');
                      scrollToSection('contact');
                    }}
                    className="text-white/85 hover:text-brand-400 transition-colors cursor-pointer text-left"
                  >
                    Client Onboarding Form
                  </button>
                </li>
                <li>
                  <a
                    href={getWhatsAppHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline underline-offset-4 transition-colors"
                  >
                    <MessageCircle size={14} />
                    WhatsApp Enquiry
                  </a>
                </li>
                <li className="pt-1 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="text-white font-semibold hover:text-brand-400 underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => onGetStarted()}
                    className="text-emerald-400 font-semibold hover:underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Create Account
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-white/80">
            <p>Copyright @ 2026 Island Bookkeeping. All Rights Reserved.</p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex items-center gap-1.5 text-white/90 hover:text-brand-400 font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowUp size={13} className="text-accent-400" />
                Back to top
              </button>
              <p>
                Developed by <span className="text-emerald-400 font-semibold">Island Web Consultants</span>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            type="button"
            aria-label="Back to top"
            onClick={scrollToTop}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: EASE_SETTLE }}
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-3.5 py-2.5 bg-black hover:bg-brand-600 text-white border border-brand-500/70 rounded-xl text-xs font-bold shadow-xl shadow-black/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowUp size={14} className="text-accent-400 shrink-0" />
            <span>Back to Top</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
