import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Edit2,
  X,
  BookCheck,
  Calculator,
  Receipt,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  EmployeePayrollBreakdown,
  GctReturnRecord,
  JamaicaComplianceProfile,
  JamaicaComplianceState,
  JamaicaTaxYear,
  PayFrequency,
  PayrollEmployee,
  PayrollRunRecord,
} from '../types';
import { dataService } from '../services/dataService';
import {
  calculateEmployeeMonthlyPayroll,
  calculateStatutoryDeductions,
  formatJMD,
  getGct4ADueDate,
  getS01DueDate,
  JAMAICA_STATUTORY_CONFIG,
  PAY_FREQUENCY_PERIODS,
} from '../lib/jamaicaTax';
import { cn, formatLocalDate, sanitizeCsvCell } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

type ComplianceTab = 'statutory-calc' | 'payroll' | 's01' | 's02' | 'gct-4a';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getCurrentMonthYYYYMM(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export const JamaicaCompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ComplianceTab>('statutory-calc');
  const [compliance, setCompliance] = useState<JamaicaComplianceState>(() =>
    dataService.getJamaicaCompliance()
  );
  const [profileDraft, setProfileDraft] = useState<JamaicaComplianceProfile>(
    () => dataService.getJamaicaCompliance().profile
  );
  const [canManageLedger, setCanManageLedger] = useState<boolean>(() =>
    dataService.can('manage_ledger')
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Interactive NIS / NHT / HEART / Ed Tax / PAYE Calculator state
  const [calcGross, setCalcGross] = useState<number>(250000);
  const [calcFrequency, setCalcFrequency] = useState<PayFrequency>('Monthly');
  const [calcTaxYear, setCalcTaxYear] = useState<JamaicaTaxYear>(
    () => dataService.getJamaicaCompliance().profile.taxYear || '2026'
  );
  const [calcPension, setCalcPension] = useState<number>(0);
  const [calcPensioner65, setCalcPensioner65] = useState<boolean>(false);
  const [calcHeartExempt, setCalcHeartExempt] = useState<boolean>(
    () => dataService.getJamaicaCompliance().profile.heartExempt || false
  );

  // GCT Form 4A state
  const [gctPeriod, setGctPeriod] = useState<string>(getCurrentMonthYYYYMM);
  const [gctDraft, setGctDraft] = useState<GctReturnRecord | null>(null);

  // Payroll state
  const [payrollPeriod, setPayrollPeriod] = useState<string>(getCurrentMonthYYYYMM);
  const [payDate, setPayDate] = useState<string>(() => formatLocalDate());
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null);
  const [payslipEmployee, setPayslipEmployee] = useState<PayrollEmployee | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);

  // S01 / S02 state
  const [selectedS01RunId, setSelectedS01RunId] = useState<string>('');
  const [s02Year, setS02Year] = useState<JamaicaTaxYear>(
    () => dataService.getJamaicaCompliance().profile.taxYear || '2026'
  );

  const calcResult = useMemo(
    () =>
      calculateStatutoryDeductions({
        grossPay: calcGross,
        taxYear: calcTaxYear,
        payFrequency: calcFrequency,
        approvedPension: calcPension,
        isPensioner65: calcPensioner65,
        heartExempt: calcHeartExempt,
      }),
    [calcGross, calcTaxYear, calcFrequency, calcPension, calcPensioner65, calcHeartExempt]
  );

  const reloadData = () => {
    const fresh = dataService.getJamaicaCompliance();
    setCompliance(fresh);
    setProfileDraft(fresh.profile);
    setCanManageLedger(dataService.can('manage_ledger'));
  };

  useEffect(() => {
    const onSync = () => reloadData();
    window.addEventListener('island-data-synced', onSync);
    return () => window.removeEventListener('island-data-synced', onSync);
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Compute default GCT Form 4A values from invoices and expenses for period
  const computeGctFromBooks = (period: string): GctReturnRecord => {
    const invoices = dataService
      .getInvoices()
      .filter((inv) => inv.date && inv.date.startsWith(period));
    const expenses = dataService
      .getExpenses()
      .filter((exp) => exp.date && exp.date.startsWith(period));

    const standardRatedSales = round2(
      invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
    );
    const outputTax = round2(
      invoices.reduce((sum, inv) => {
        const rate = inv.tax_rate != null ? Number(inv.tax_rate) : 15;
        const tax =
          inv.tax_amount != null
            ? Number(inv.tax_amount)
            : Number(inv.amount || 0) * (rate / 100);
        return sum + tax;
      }, 0)
    );

    const taxablePurchases = round2(
      expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
    );
    const inputTax = round2(taxablePurchases * 0.15);

    // Check prior month for negative net GCT (credit carry-forward)
    const [yStr, mStr] = period.split('-');
    let creditBroughtForward = 0;
    const yr = Number(yStr);
    const mo = Number(mStr);
    if (yr && mo) {
      const prevDate = new Date(yr, mo - 2, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(
        prevDate.getMonth() + 1
      ).padStart(2, '0')}`;
      const prevReturn = compliance.gctReturns.find((g) => g.period === prevPeriod);
      if (prevReturn && prevReturn.netGctPayable < 0) {
        creditBroughtForward = round2(Math.abs(prevReturn.netGctPayable));
      }
    }

    const netGctPayable = round2(outputTax - inputTax - creditBroughtForward);
    return {
      id: `GCT4A-${period}`,
      period,
      dueDate: getGct4ADueDate(period),
      standardRatedSales,
      zeroRatedSales: 0,
      exemptSupplies: 0,
      outputTax,
      taxablePurchases,
      inputTax,
      creditBroughtForward,
      netGctPayable,
      status: 'Draft',
    };
  };

  useEffect(() => {
    const existing = compliance.gctReturns.find((g) => g.period === gctPeriod);
    if (existing) {
      setGctDraft(existing);
    } else {
      setGctDraft(computeGctFromBooks(gctPeriod));
    }
  }, [gctPeriod, compliance.gctReturns]);

  useEffect(() => {
    if (compliance.payrollRuns.length > 0) {
      const exists = compliance.payrollRuns.some((r) => r.id === selectedS01RunId);
      if (!exists) {
        setSelectedS01RunId(compliance.payrollRuns[0].id);
      }
    } else {
      setSelectedS01RunId('');
    }
  }, [compliance.payrollRuns, selectedS01RunId]);

  const periodInvoiceCount = useMemo(
    () =>
      dataService
        .getInvoices()
        .filter((i) => i.date && i.date.startsWith(gctPeriod)).length,
    [gctPeriod, compliance]
  );

  const periodExpenseCount = useMemo(
    () =>
      dataService
        .getExpenses()
        .filter((e) => e.date && e.date.startsWith(gctPeriod)).length,
    [gctPeriod, compliance]
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = dataService.saveJamaicaComplianceProfile(profileDraft);
      setCompliance(next);
      setS02Year(next.profile.taxYear);
      showNotice('success', 'TAJ registration profile saved.');
    } catch (err: any) {
      showNotice('error', err.message || 'Unable to save TAJ profile.');
    }
  };

  const updateGctField = (
    field: keyof Pick<
      GctReturnRecord,
      | 'standardRatedSales'
      | 'zeroRatedSales'
      | 'exemptSupplies'
      | 'outputTax'
      | 'taxablePurchases'
      | 'inputTax'
      | 'creditBroughtForward'
    >,
    rawValue: string
  ) => {
    if (!gctDraft) return;
    const val = Math.max(0, parseFloat(rawValue) || 0);
    const next: GctReturnRecord = { ...gctDraft, [field]: val };
    if (field === 'standardRatedSales') {
      next.outputTax = round2(val * 0.15);
    }
    if (field === 'taxablePurchases') {
      next.inputTax = round2(val * 0.15);
    }
    next.netGctPayable = round2(
      next.outputTax - next.inputTax - next.creditBroughtForward
    );
    setGctDraft(next);
  };

  const handlePersistGctReturn = (statusOverride?: GctReturnRecord['status']) => {
    if (!gctDraft) return;
    try {
      const payload: GctReturnRecord = {
        ...gctDraft,
        status: statusOverride || gctDraft.status,
        filedAt:
          statusOverride && statusOverride !== 'Draft'
            ? new Date().toISOString()
            : gctDraft.filedAt,
      };
      const next = dataService.saveGctReturn(payload);
      setCompliance(next);
      setGctDraft(payload);
      showNotice(
        'success',
        `GCT Form 4A for ${payload.period} saved (${payload.status}).`
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to save GCT Form 4A.');
    }
  };

  const handleExportGctPdf = () => {
    if (!gctDraft) return;
    const doc = new jsPDF();
    const user = dataService.getUser();
    doc.setFontSize(16);
    doc.text('TAJ General Consumption Tax - Form 4A', 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Taxpayer: ${user?.company || 'Workspace Business'} | TRN: ${
        profileDraft.trn || 'N/A'
      } | GCT Reg #: ${profileDraft.gctNumber || 'N/A'}`,
      14,
      26
    );
    doc.text(
      `Return Period: ${gctDraft.period} | Filing Deadline: ${gctDraft.dueDate} | Status: ${gctDraft.status}`,
      14,
      32
    );

    const totalSupplies = round2(
      gctDraft.standardRatedSales + gctDraft.zeroRatedSales + gctDraft.exemptSupplies
    );

    autoTable(doc, {
      startY: 40,
      head: [['TAJ Box', 'Line Description', 'Amount (JMD)']],
      body: [
        ['Box 1', 'Standard-Rated Supplies (15%)', formatJMD(gctDraft.standardRatedSales)],
        ['Box 2', 'Zero-Rated Supplies (0%)', formatJMD(gctDraft.zeroRatedSales)],
        ['Box 3', 'Exempt Supplies', formatJMD(gctDraft.exemptSupplies)],
        ['Box 4', 'Total Supplies (Box 1 + 2 + 3)', formatJMD(totalSupplies)],
        ['Box 5', 'Total Output Tax Payable', formatJMD(gctDraft.outputTax)],
        ['Box 6', 'Taxable Purchases & Expenses', formatJMD(gctDraft.taxablePurchases)],
        ['Box 7', 'Total Input Tax Credit Claimable', formatJMD(gctDraft.inputTax)],
        ['Box 8', 'GCT Credit Brought Forward', formatJMD(gctDraft.creditBroughtForward)],
        [
          'Box 9',
          gctDraft.netGctPayable >= 0
            ? 'Net GCT Payable to TAJ'
            : 'Excess Credit Carried Forward / Refundable',
          formatJMD(gctDraft.netGctPayable),
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 73] },
    });

    doc.save(`TAJ_GCT_Form_4A_${gctDraft.period}.pdf`);
  };

  const handleExportGctCsv = () => {
    if (!gctDraft) return;
    const totalSupplies = round2(
      gctDraft.standardRatedSales + gctDraft.zeroRatedSales + gctDraft.exemptSupplies
    );
    const headers = ['Box', 'Description', 'Period', 'Status', 'Amount_JMD'];
    const rows = [
      ['Box 1', 'Standard-Rated Supplies (15%)', gctDraft.period, gctDraft.status, gctDraft.standardRatedSales.toFixed(2)],
      ['Box 2', 'Zero-Rated Supplies', gctDraft.period, gctDraft.status, gctDraft.zeroRatedSales.toFixed(2)],
      ['Box 3', 'Exempt Supplies', gctDraft.period, gctDraft.status, gctDraft.exemptSupplies.toFixed(2)],
      ['Box 4', 'Total Supplies', gctDraft.period, gctDraft.status, totalSupplies.toFixed(2)],
      ['Box 5', 'Total Output Tax', gctDraft.period, gctDraft.status, gctDraft.outputTax.toFixed(2)],
      ['Box 6', 'Taxable Purchases', gctDraft.period, gctDraft.status, gctDraft.taxablePurchases.toFixed(2)],
      ['Box 7', 'Total Input Tax Credit', gctDraft.period, gctDraft.status, gctDraft.inputTax.toFixed(2)],
      ['Box 8', 'Credit Brought Forward', gctDraft.period, gctDraft.status, gctDraft.creditBroughtForward.toFixed(2)],
      ['Box 9', 'Net GCT Payable / (Credit)', gctDraft.period, gctDraft.status, gctDraft.netGctPayable.toFixed(2)],
    ];
    const csv = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n');
    downloadCsv(csv, `TAJ_GCT_Form_4A_${gctDraft.period}.csv`);
  };

  // Live Payroll Calculation for all Active employees
  const activeEmployees = useMemo(
    () => compliance.employees.filter((e) => e.status === 'Active'),
    [compliance.employees]
  );

  const liveBreakdowns: EmployeePayrollBreakdown[] = useMemo(
    () =>
      activeEmployees.map((emp) =>
        calculateEmployeeMonthlyPayroll(
          emp,
          profileDraft.taxYear,
          profileDraft.heartExempt
        )
      ),
    [activeEmployees, profileDraft.taxYear, profileDraft.heartExempt]
  );

  const liveTotals = useMemo(() => {
    const sum = (fn: (b: EmployeePayrollBreakdown) => number) =>
      round2(liveBreakdowns.reduce((acc, b) => acc + fn(b), 0));
    return {
      grossPay: sum((b) => b.monthlyGross),
      nisEmployee: sum((b) => b.nisEmployee),
      nisEmployer: sum((b) => b.nisEmployer),
      nhtEmployee: sum((b) => b.nhtEmployee),
      nhtEmployer: sum((b) => b.nhtEmployer),
      edTaxEmployee: sum((b) => b.edTaxEmployee),
      edTaxEmployer: sum((b) => b.edTaxEmployer),
      heartEmployer: sum((b) => b.heartEmployer),
      paye: sum((b) => b.paye),
      netPay: sum((b) => b.netPay),
      totalEmployerContributions: sum((b) => b.totalEmployerContributions),
      totalS01Remittance: sum((b) => b.totalStatutoryRemittance),
    };
  }, [liveBreakdowns]);

  const handleGeneratePayrollRun = () => {
    if (liveBreakdowns.length === 0) {
      showNotice('error', 'Add at least one Active employee before generating a payroll run.');
      return;
    }
    try {
      const existing = compliance.payrollRuns.find((r) => r.period === payrollPeriod);
      const run: PayrollRunRecord = {
        id: existing?.id || `PR-${payrollPeriod}`,
        period: payrollPeriod,
        payDate,
        dueDate: getS01DueDate(payrollPeriod),
        taxYear: profileDraft.taxYear,
        employees: liveBreakdowns,
        totals: liveTotals,
        status: existing?.status || 'Draft',
        journalEntryId: existing?.journalEntryId,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      const next = dataService.savePayrollRun(run);
      setCompliance(next);
      setSelectedS01RunId(run.id);
      showNotice(
        'success',
        `Payroll & S01 return generated for ${payrollPeriod} (${liveBreakdowns.length} employees).`
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Unable to generate payroll run.');
    }
  };

  const handlePostPayrollToLedger = (runId: string) => {
    try {
      const je = dataService.postPayrollRunToLedger(runId);
      reloadData();
      showNotice('success', `Posted balanced Journal Entry ${je.id} to General Ledger.`);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to post payroll to ledger.');
    }
  };

  const handleUpdateS01Status = (
    run: PayrollRunRecord,
    status: PayrollRunRecord['status']
  ) => {
    try {
      const next = dataService.savePayrollRun({ ...run, status });
      setCompliance(next);
      showNotice('success', `S01 Return for ${run.period} marked ${status}.`);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to update S01 status.');
    }
  };

  const selectedS01Run = useMemo(
    () => compliance.payrollRuns.find((r) => r.id === selectedS01RunId) || null,
    [compliance.payrollRuns, selectedS01RunId]
  );

  const handleExportS01Pdf = (run: PayrollRunRecord) => {
    const doc = new jsPDF();
    const user = dataService.getUser();
    doc.setFontSize(16);
    doc.text('TAJ Form S01 - Monthly Employer Statutory Remittance', 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Employer: ${user?.company || 'Workspace Business'} | TRN: ${
        profileDraft.trn || 'N/A'
      } | NIS #: ${profileDraft.nisNumber || 'N/A'} | NHT #: ${
        profileDraft.nhtNumber || 'N/A'
      }`,
      14,
      26
    );
    doc.text(
      `Period: ${run.period} | Due Date: ${run.dueDate} | Tax Year: ${run.taxYear} | Status: ${run.status}`,
      14,
      32
    );

    const t = run.totals;
    autoTable(doc, {
      startY: 40,
      head: [['Statutory Fund', 'Employee (JMD)', 'Employer (JMD)', 'Total Payable (JMD)']],
      body: [
        ['NIS (3% EE / 3% ER)', formatJMD(t.nisEmployee), formatJMD(t.nisEmployer), formatJMD(t.nisEmployee + t.nisEmployer)],
        ['NHT (2% EE / 3% ER)', formatJMD(t.nhtEmployee), formatJMD(t.nhtEmployer), formatJMD(t.nhtEmployee + t.nhtEmployer)],
        ['Education Tax (2.25% EE / 3.5% ER)', formatJMD(t.edTaxEmployee), formatJMD(t.edTaxEmployer), formatJMD(t.edTaxEmployee + t.edTaxEmployer)],
        ['HEART / NSTA Trust (3% ER)', formatJMD(0), formatJMD(t.heartEmployer), formatJMD(t.heartEmployer)],
        ['Income Tax (PAYE)', formatJMD(t.paye), formatJMD(0), formatJMD(t.paye)],
        [
          'TOTAL S01 REMITTANCE',
          formatJMD(t.nisEmployee + t.nhtEmployee + t.edTaxEmployee + t.paye),
          formatJMD(t.totalEmployerContributions),
          formatJMD(t.totalS01Remittance),
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 73] },
    });

    doc.save(`TAJ_S01_Return_${run.period}.pdf`);
  };

  const handleExportS01Csv = (run: PayrollRunRecord) => {
    const t = run.totals;
    const headers = ['Period', 'Due_Date', 'Status', 'Statutory_Fund', 'Employee_JMD', 'Employer_JMD', 'Total_Payable_JMD'];
    const rows = [
      [run.period, run.dueDate, run.status, 'NIS', t.nisEmployee.toFixed(2), t.nisEmployer.toFixed(2), (t.nisEmployee + t.nisEmployer).toFixed(2)],
      [run.period, run.dueDate, run.status, 'NHT', t.nhtEmployee.toFixed(2), t.nhtEmployer.toFixed(2), (t.nhtEmployee + t.nhtEmployer).toFixed(2)],
      [run.period, run.dueDate, run.status, 'Education Tax', t.edTaxEmployee.toFixed(2), t.edTaxEmployer.toFixed(2), (t.edTaxEmployee + t.edTaxEmployer).toFixed(2)],
      [run.period, run.dueDate, run.status, 'HEART/NSTA Trust', '0.00', t.heartEmployer.toFixed(2), t.heartEmployer.toFixed(2)],
      [run.period, run.dueDate, run.status, 'PAYE', t.paye.toFixed(2), '0.00', t.paye.toFixed(2)],
      [run.period, run.dueDate, run.status, 'TOTAL S01', (t.nisEmployee + t.nhtEmployee + t.edTaxEmployee + t.paye).toFixed(2), t.totalEmployerContributions.toFixed(2), t.totalS01Remittance.toFixed(2)],
    ];
    const csv = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n');
    downloadCsv(csv, `TAJ_S01_Return_${run.period}.csv`);
  };

  // S02 Annual Aggregation
  const s02Runs = useMemo(
    () =>
      compliance.payrollRuns
        .filter((r) => r.period.startsWith(`${s02Year}-`))
        .sort((a, b) => a.period.localeCompare(b.period)),
    [compliance.payrollRuns, s02Year]
  );

  const s02AnnualTotals = useMemo(() => {
    const sum = (fn: (r: PayrollRunRecord) => number) =>
      round2(s02Runs.reduce((acc, r) => acc + fn(r), 0));
    return {
      grossPay: sum((r) => r.totals.grossPay),
      nisTotal: sum((r) => r.totals.nisEmployee + r.totals.nisEmployer),
      nhtTotal: sum((r) => r.totals.nhtEmployee + r.totals.nhtEmployer),
      edTaxTotal: sum((r) => r.totals.edTaxEmployee + r.totals.edTaxEmployer),
      heartTotal: sum((r) => r.totals.heartEmployer),
      payeTotal: sum((r) => r.totals.paye),
      s02Total: sum((r) => r.totals.totalS01Remittance),
      netPayTotal: sum((r) => r.totals.netPay),
    };
  }, [s02Runs]);

  const p24EmployeeSummaries = useMemo(() => {
    const byEmp = new Map<
      string,
      {
        employeeId: string;
        name: string;
        trn: string;
        nisNumber: string;
        months: number;
        gross: number;
        nisEE: number;
        nhtEE: number;
        edTaxEE: number;
        paye: number;
        netPay: number;
      }
    >();

    s02Runs.forEach((run) => {
      run.employees.forEach((emp) => {
        const prev = byEmp.get(emp.employeeId) || {
          employeeId: emp.employeeId,
          name: emp.name,
          trn: emp.trn,
          nisNumber: emp.nisNumber,
          months: 0,
          gross: 0,
          nisEE: 0,
          nhtEE: 0,
          edTaxEE: 0,
          paye: 0,
          netPay: 0,
        };
        prev.months += 1;
        prev.gross = round2(prev.gross + emp.monthlyGross);
        prev.nisEE = round2(prev.nisEE + emp.nisEmployee);
        prev.nhtEE = round2(prev.nhtEE + emp.nhtEmployee);
        prev.edTaxEE = round2(prev.edTaxEE + emp.edTaxEmployee);
        prev.paye = round2(prev.paye + emp.paye);
        prev.netPay = round2(prev.netPay + emp.netPay);
        byEmp.set(emp.employeeId, prev);
      });
    });
    return Array.from(byEmp.values());
  }, [s02Runs]);

  const handleExportS02Pdf = () => {
    const doc = new jsPDF();
    const user = dataService.getUser();
    doc.setFontSize(16);
    doc.text(`TAJ Form S02 - Employer Annual Return (${s02Year})`, 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Employer: ${user?.company || 'Workspace Business'} | TRN: ${
        profileDraft.trn || 'N/A'
      } | NIS #: ${profileDraft.nisNumber || 'N/A'}`,
      14,
      26
    );

    autoTable(doc, {
      startY: 34,
      head: [['Month', 'Gross Pay', 'NIS', 'NHT', 'EdTax', 'HEART', 'PAYE', 'S01 Total', 'Status']],
      body: s02Runs.map((r) => [
        r.period,
        formatJMD(r.totals.grossPay),
        formatJMD(r.totals.nisEmployee + r.totals.nisEmployer),
        formatJMD(r.totals.nhtEmployee + r.totals.nhtEmployer),
        formatJMD(r.totals.edTaxEmployee + r.totals.edTaxEmployer),
        formatJMD(r.totals.heartEmployer),
        formatJMD(r.totals.paye),
        formatJMD(r.totals.totalS01Remittance),
        r.status,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 73] },
      styles: { fontSize: 8 },
    });

    const afterFirstY = (doc as any).lastAutoTable?.finalY || 90;
    doc.setFontSize(12);
    doc.text(`P24 Employee Annual Emoluments Summary (${s02Year})`, 14, afterFirstY + 12);

    autoTable(doc, {
      startY: afterFirstY + 18,
      head: [['Employee', 'TRN', 'Periods', 'Annual Gross', 'NIS EE', 'NHT EE', 'EdTax EE', 'PAYE', 'Annual Net']],
      body: p24EmployeeSummaries.map((e) => [
        e.name,
        e.trn || 'N/A',
        String(e.months),
        formatJMD(e.gross),
        formatJMD(e.nisEE),
        formatJMD(e.nhtEE),
        formatJMD(e.edTaxEE),
        formatJMD(e.paye),
        formatJMD(e.netPay),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    doc.save(`TAJ_S02_Annual_Return_${s02Year}.pdf`);
  };

  const handleExportS02Csv = () => {
    const headers = ['Employee', 'TRN', 'NIS_Number', 'Tax_Year', 'Months', 'Annual_Gross_JMD', 'NIS_EE_JMD', 'NHT_EE_JMD', 'EdTax_EE_JMD', 'PAYE_JMD', 'Annual_Net_JMD'];
    const rows = p24EmployeeSummaries.map((e) => [
      e.name,
      e.trn || '',
      e.nisNumber || '',
      s02Year,
      String(e.months),
      e.gross.toFixed(2),
      e.nisEE.toFixed(2),
      e.nhtEE.toFixed(2),
      e.edTaxEE.toFixed(2),
      e.paye.toFixed(2),
      e.netPay.toFixed(2),
    ]);
    const csv = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n');
    downloadCsv(csv, `TAJ_S02_P24_Summary_${s02Year}.csv`);
  };

  const handleExportCalcPdf = () => {
    const doc = new jsPDF();
    const user = dataService.getUser();
    doc.setFontSize(16);
    doc.text('Jamaica Statutory Payroll Breakdown (NIS, NHT, HEART, Ed Tax & PAYE)', 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Organization: ${user?.company || 'Workspace Business'} | Tax Year: ${calcTaxYear} | Frequency: ${calcFrequency}`,
      14,
      26
    );
    doc.text(
      `Gross Pay: ${formatJMD(calcResult.grossPay)} | Net Take-Home: ${formatJMD(calcResult.netPay)} | Total TAJ Remittance: ${formatJMD(calcResult.totalTajRemittance)}`,
      14,
      32
    );

    autoTable(doc, {
      startY: 40,
      head: [['Statutory Item', 'Basis / Rate', 'Employee (JMD)', 'Employer (JMD)', 'Total TAJ (JMD)']],
      body: [
        [
          'NIS (National Insurance Scheme)',
          calcResult.nisCapped ? '3% EE / 3% ER (Capped at J$5M/yr)' : '3% EE / 3% ER',
          formatJMD(calcResult.nisEmployee),
          formatJMD(calcResult.nisEmployer),
          formatJMD(calcResult.nisEmployee + calcResult.nisEmployer),
        ],
        [
          'NHT (National Housing Trust)',
          '2% EE / 3% ER on Gross',
          formatJMD(calcResult.nhtEmployee),
          formatJMD(calcResult.nhtEmployer),
          formatJMD(calcResult.nhtEmployee + calcResult.nhtEmployer),
        ],
        [
          'Education Tax (Ed Tax)',
          '2.25% EE / 3.5% ER on Statutory Income',
          formatJMD(calcResult.edTaxEmployee),
          formatJMD(calcResult.edTaxEmployer),
          formatJMD(calcResult.edTaxEmployee + calcResult.edTaxEmployer),
        ],
        [
          'HEART / NSTA Trust',
          calcHeartExempt ? 'Exempt' : '3% ER on Gross Wage Bill',
          formatJMD(0),
          formatJMD(calcResult.heartEmployer),
          formatJMD(calcResult.heartEmployer),
        ],
        [
          'PAYE (Income Tax)',
          `0% <= ${formatJMD(calcResult.payeThreshold)} | 25% / 30%`,
          formatJMD(calcResult.paye),
          formatJMD(0),
          formatJMD(calcResult.paye),
        ],
        [
          'TOTAL STATUTORY',
          `${calcFrequency} Cycle`,
          formatJMD(calcResult.totalEmployeeStatutory),
          formatJMD(calcResult.totalEmployerContributions),
          formatJMD(calcResult.totalTajRemittance),
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 73] },
    });

    doc.save(`Jamaica_Statutory_Breakdown_${calcFrequency}_${calcTaxYear}.pdf`);
  };

  const handleExportCalcCsv = () => {
    const headers = ['Frequency', 'Tax_Year', 'Fund', 'Employee_JMD', 'Employer_JMD', 'Total_TAJ_JMD'];
    const rows = [
      [calcFrequency, calcTaxYear, 'NIS', calcResult.nisEmployee.toFixed(2), calcResult.nisEmployer.toFixed(2), (calcResult.nisEmployee + calcResult.nisEmployer).toFixed(2)],
      [calcFrequency, calcTaxYear, 'NHT', calcResult.nhtEmployee.toFixed(2), calcResult.nhtEmployer.toFixed(2), (calcResult.nhtEmployee + calcResult.nhtEmployer).toFixed(2)],
      [calcFrequency, calcTaxYear, 'Education Tax', calcResult.edTaxEmployee.toFixed(2), calcResult.edTaxEmployer.toFixed(2), (calcResult.edTaxEmployee + calcResult.edTaxEmployer).toFixed(2)],
      [calcFrequency, calcTaxYear, 'HEART/NSTA Trust', '0.00', calcResult.heartEmployer.toFixed(2), calcResult.heartEmployer.toFixed(2)],
      [calcFrequency, calcTaxYear, 'PAYE', calcResult.paye.toFixed(2), '0.00', calcResult.paye.toFixed(2)],
      [calcFrequency, calcTaxYear, 'Gross Pay', calcResult.grossPay.toFixed(2), '', ''],
      [calcFrequency, calcTaxYear, 'Net Take-Home Pay', calcResult.netPay.toFixed(2), '', ''],
    ];
    const csv = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n');
    downloadCsv(csv, `Jamaica_Statutory_Breakdown_${calcFrequency}_${calcTaxYear}.csv`);
  };

  const handleAddCalculatedToRoster = () => {
    const periods = PAY_FREQUENCY_PERIODS[calcFrequency];
    const normalizedMonthlyGross = round2((calcGross * periods) / 12);
    const normalizedMonthlyPension = round2((calcPension * periods) / 12);
    setEditingEmployee({
      id: '',
      name: '',
      trn: '',
      nisNumber: '',
      position: '',
      monthlyGross: normalizedMonthlyGross,
      approvedPension: normalizedMonthlyPension,
      payFrequency: calcFrequency,
      isPensioner65: calcPensioner65,
      status: 'Active',
    });
    setIsEmployeeModalOpen(true);
  };

  const activeTaxConfig = JAMAICA_STATUTORY_CONFIG[profileDraft.taxYear];

  return (
    <div className="space-y-6">
      {!canManageLedger && (
        <div className="px-5 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
          <Lock size={16} className="text-amber-600 shrink-0" />
          <span>
            Read-only compliance view. Only <strong>Owner</strong> or{' '}
            <strong>Accountant</strong> roles can modify TAJ registration details, run
            payroll, post statutory liabilities, or mark returns filed.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={cn(
            'px-5 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between',
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* TAJ Registration & Tax Year Bar */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
              <Landmark size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Tax Administration Jamaica (TAJ) Compliance Profile
              </h2>
              <p className="text-xs text-slate-600">
                Active PAYE Threshold: <span className="font-mono font-bold text-slate-900">{formatJMD(activeTaxConfig.annualThreshold)}/yr</span> ({formatJMD(activeTaxConfig.monthlyThreshold)}/mo) · NIS Ceiling <span className="font-mono font-bold text-slate-900">{formatJMD(activeTaxConfig.nisAnnualCeiling)}/yr</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profileDraft.heartExempt}
                disabled={!canManageLedger}
                onChange={(e) =>
                  setProfileDraft({ ...profileDraft, heartExempt: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              HEART/NSTA Exempt
            </label>
            {canManageLedger && (
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Save size={14} />
                Save Profile
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Taxpayer Reg # (TRN)
            </label>
            <input
              type="text"
              value={profileDraft.trn}
              disabled={!canManageLedger}
              placeholder="e.g. 000-123-456"
              onChange={(e) =>
                setProfileDraft({ ...profileDraft, trn: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              GCT Registration #
            </label>
            <input
              type="text"
              value={profileDraft.gctNumber}
              disabled={!canManageLedger}
              placeholder="e.g. 100-456-789"
              onChange={(e) =>
                setProfileDraft({ ...profileDraft, gctNumber: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              NIS Employer #
            </label>
            <input
              type="text"
              value={profileDraft.nisNumber}
              disabled={!canManageLedger}
              placeholder="e.g. NIS-88412"
              onChange={(e) =>
                setProfileDraft({ ...profileDraft, nisNumber: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              NHT Employer #
            </label>
            <input
              type="text"
              value={profileDraft.nhtNumber}
              disabled={!canManageLedger}
              placeholder="e.g. NHT-33109"
              onChange={(e) =>
                setProfileDraft({ ...profileDraft, nhtNumber: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Statutory Tax Year
            </label>
            <select
              value={profileDraft.taxYear}
              disabled={!canManageLedger}
              onChange={(e) =>
                setProfileDraft({
                  ...profileDraft,
                  taxYear: e.target.value as JamaicaTaxYear,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            >
              <option value="2026">2026 (J$1,902,360/yr)</option>
              <option value="2025">2025 (J$1,799,376/yr)</option>
            </select>
          </div>
        </div>
      </form>

      {/* Module Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'statutory-calc', label: 'NIS, NHT, HEART, Ed Tax & PAYE', icon: Calculator },
            { id: 'payroll', label: 'Payroll Roster & Runs', icon: Users },
            { id: 's01', label: 'S01 Monthly Return', icon: Calendar },
            { id: 's02', label: 'S02 Annual Return (P24)', icon: Building2 },
            { id: 'gct-4a', label: 'GCT Form 4A', icon: FileText },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap shrink-0',
                active
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 0: INTERACTIVE NIS, NHT, HEART, ED TAX & PAYE CALCULATOR */}
      {activeTab === 'statutory-calc' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Jamaica Statutory Payroll Engine — NIS, NHT, HEART, Ed Tax &amp; PAYE
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Compute employee withholdings, employer contributions, and net take-home pay across Monthly, Fortnightly, Weekly, or Annual pay cycles.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCalcPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download size={14} />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportCalcCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  Export CSV
                </button>
                {canManageLedger && (
                  <button
                    type="button"
                    onClick={handleAddCalculatedToRoster}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus size={14} />
                    Add to Payroll Roster
                  </button>
                )}
              </div>
            </div>

            {/* Calculator Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Gross Emoluments (JMD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="100"
                  value={calcGross}
                  onChange={(e) =>
                    setCalcGross(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono tabular-nums text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay Frequency
                </label>
                <select
                  value={calcFrequency}
                  onChange={(e) => setCalcFrequency(e.target.value as PayFrequency)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Monthly">Monthly (12 / yr)</option>
                  <option value="Fortnightly">Fortnightly (26 / yr)</option>
                  <option value="Weekly">Weekly (52 / yr)</option>
                  <option value="Annual">Annual (1 / yr)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  TAJ Tax Year
                </label>
                <select
                  value={calcTaxYear}
                  onChange={(e) => setCalcTaxYear(e.target.value as JamaicaTaxYear)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="2026">2026 (J$1,902,360/yr)</option>
                  <option value="2025">2025 (J$1,799,376/yr)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Approved Pension (JMD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="100"
                  value={calcPension}
                  onChange={(e) =>
                    setCalcPension(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono tabular-nums text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calcPensioner65}
                  onChange={(e) => setCalcPensioner65(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600"
                />
                Age 65+ / Pensioner Relief (NIS exempt + J$250,040/yr extra threshold)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calcHeartExempt}
                  onChange={(e) => setCalcHeartExempt(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600"
                />
                HEART/NSTA Exempt Employer (Wage bill below exemption threshold)
              </label>
            </div>

            {/* 5 Statutory Fund Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                  1. NIS
                </div>
                <p className="text-xs text-slate-500">
                  3% EE / 3% ER {calcResult.nisCapped ? '· Capped at J$5M/yr' : '· Insurable pay'}
                </p>
                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.nisEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employer</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.nisEmployer)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                  2. NHT
                </div>
                <p className="text-xs text-slate-500">
                  2% EE / 3% ER · Full gross
                </p>
                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.nhtEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employer</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.nhtEmployer)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                  3. HEART / NSTA
                </div>
                <p className="text-xs text-slate-500">
                  {calcHeartExempt ? 'Exempt · 0% ER' : '0% EE / 3% ER · Gross bill'}
                </p>
                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee</span>
                    <span className="font-bold text-slate-400">{formatJMD(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employer</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.heartEmployer)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                  4. Education Tax
                </div>
                <p className="text-xs text-slate-500">
                  2.25% EE / 3.5% ER · Statutory Inc.
                </p>
                <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.edTaxEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employer</span>
                    <span className="font-bold text-slate-900">{formatJMD(calcResult.edTaxEmployer)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                  5. PAYE (Income Tax)
                </div>
                <p className="text-xs text-emerald-800">
                  25% / 30% above {formatJMD(calcResult.payeThreshold)}
                </p>
                <div className="pt-2 border-t border-emerald-200/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-emerald-800">Employee</span>
                    <span className="font-black text-emerald-950">{formatJMD(calcResult.paye)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-800">Employer</span>
                    <span className="font-bold text-emerald-700">{formatJMD(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step TAJ Formula Waterfall */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">TAJ Calculation Step</th>
                    <th className="py-3 px-4">Statutory Rule</th>
                    <th className="py-3 px-4 text-right">Amount ({calcFrequency} JMD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-900">Gross Emoluments</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">Base taxable salary &amp; allowances</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatJMD(calcResult.grossPay)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-800">Less: Employee NIS (3%)</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {calcPensioner65
                        ? 'Exempt (Age 65+ / Pensioner)'
                        : `3% of ${formatJMD(calcResult.nisInsurablePay)} insurable wage`}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700">
                      -{formatJMD(calcResult.nisEmployee)}
                    </td>
                  </tr>
                  {calcResult.approvedPension > 0 && (
                    <tr>
                      <td className="py-2.5 px-4 text-slate-800">Less: Approved Pension</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        Deductible before Education Tax &amp; PAYE
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700">
                        -{formatJMD(calcResult.approvedPension)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/70">
                    <td className="py-2.5 px-4 font-bold text-slate-900">Statutory Income</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      Base for Education Tax (2.25% EE / 3.5% ER) and PAYE
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatJMD(calcResult.statutoryIncome)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-800">Less: Tax-Free PAYE Threshold</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {calcTaxYear} TAJ threshold ÷ {calcResult.periodsPerYear} periods
                      {calcPensioner65 ? ' (includes Age 65+ relief)' : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatJMD(calcResult.payeThreshold)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">Chargeable Income for PAYE</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      25% ({formatJMD(calcResult.payeStandard25)}) + 30% ({formatJMD(calcResult.payeHigher30)})
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatJMD(calcResult.chargeableIncome)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-800">Total Employee Deductions</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      NIS ({formatJMD(calcResult.nisEmployee)}) + NHT ({formatJMD(calcResult.nhtEmployee)}) + EdTax ({formatJMD(calcResult.edTaxEmployee)}) + PAYE ({formatJMD(calcResult.paye)})
                      {calcResult.approvedPension > 0 ? ` + Pension (${formatJMD(calcResult.approvedPension)})` : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-rose-700">
                      -{formatJMD(calcResult.totalEmployeeDeductions)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50">
                    <td className="py-3 px-4 font-black text-emerald-950">Net Take-Home Pay</td>
                    <td className="py-3 px-4 text-xs text-emerald-800">Paid to employee</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-base text-emerald-950">
                      {formatJMD(calcResult.netPay)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-800">Employer Statutory Contributions</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      NIS 3% + NHT 3% + EdTax 3.5% + HEART {calcHeartExempt ? '0%' : '3%'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatJMD(calcResult.totalEmployerContributions)}
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="py-3.5 px-4 font-black">Total TAJ Statutory Remittance (S01)</td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      Total Cost to Employer: {formatJMD(calcResult.totalEmployerCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-black text-base">
                      {formatJMD(calcResult.totalTajRemittance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: GCT FORM 4A */}
      {activeTab === 'gct-4a' && gctDraft && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    GCT Form 4A — Monthly Return Schedule
                  </h3>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border',
                      gctDraft.status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : gctDraft.status === 'Filed'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    )}
                  >
                    {gctDraft.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Auto-populated from {periodInvoiceCount} invoice(s) and{' '}
                  {periodExpenseCount} expense(s) in {gctPeriod} · Filing due{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {gctDraft.dueDate}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={gctPeriod}
                  onChange={(e) => setGctPeriod(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setGctDraft(computeGctFromBooks(gctPeriod))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  Sync Books
                </button>
                <button
                  type="button"
                  onClick={handleExportGctPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportGctCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  CSV
                </button>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Box 5 · Output GCT (15%)
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(gctDraft.outputTax)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Box 7 · Input GCT Credit
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(gctDraft.inputTax)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Box 8 · Credit B/F
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(gctDraft.creditBroughtForward)}
                </p>
              </div>
              <div
                className={cn(
                  'p-4 rounded-xl border',
                  gctDraft.netGctPayable >= 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-sky-50 border-sky-200'
                )}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Box 9 · {gctDraft.netGctPayable >= 0 ? 'Net GCT Payable' : 'Credit C/F'}
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(Math.abs(gctDraft.netGctPayable))}
                </p>
              </div>
            </div>

            {/* Official Box 1-9 Schedule Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 w-24">TAJ Box</th>
                    <th className="py-3 px-4">Return Line Description</th>
                    <th className="py-3 px-4 text-right w-64">Amount (JMD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 1</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Standard-Rated Supplies (Taxable Sales @ 15%)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.standardRatedSales}
                        onChange={(e) =>
                          updateGctField('standardRatedSales', e.target.value)
                        }
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 2</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Zero-Rated Supplies (Exports & Zero-Rated Goods)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.zeroRatedSales}
                        onChange={(e) => updateGctField('zeroRatedSales', e.target.value)}
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 3</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Exempt Supplies
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.exemptSupplies}
                        onChange={(e) => updateGctField('exemptSupplies', e.target.value)}
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 4</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      Total Supplies (Box 1 + Box 2 + Box 3)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-black text-slate-900">
                      {formatJMD(
                        gctDraft.standardRatedSales +
                          gctDraft.zeroRatedSales +
                          gctDraft.exemptSupplies
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 5</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Output Tax Charged (15% of Standard-Rated Supplies)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.outputTax}
                        onChange={(e) => updateGctField('outputTax', e.target.value)}
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 6</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Taxable Purchases & Business Expenses (Pre-GCT Base)
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.taxablePurchases}
                        onChange={(e) =>
                          updateGctField('taxablePurchases', e.target.value)
                        }
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 7</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Input Tax Credit Claimable on Qualifying Purchases
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.inputTax}
                        onChange={(e) => updateGctField('inputTax', e.target.value)}
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">Box 8</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Prior Period Credit Brought Forward
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!canManageLedger}
                        value={gctDraft.creditBroughtForward}
                        onChange={(e) =>
                          updateGctField('creditBroughtForward', e.target.value)
                        }
                        className="w-48 text-right px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono tabular-nums text-sm font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="py-3.5 px-4 font-mono font-bold">Box 9</td>
                    <td className="py-3.5 px-4 font-black">
                      {gctDraft.netGctPayable >= 0
                        ? 'Net GCT Payable to TAJ (Box 5 - Box 7 - Box 8)'
                        : 'Net Excess Credit Carried Forward'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-black text-base">
                      {formatJMD(gctDraft.netGctPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {canManageLedger && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handlePersistGctReturn('Draft')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <Save size={14} />
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handlePersistGctReturn('Filed')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  Mark Filed on eTAJ
                </button>
                <button
                  type="button"
                  onClick={() => handlePersistGctReturn('Paid')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  Mark Paid
                </button>
              </div>
            )}
          </div>

          {compliance.gctReturns.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-4">
                Saved GCT Form 4A Filings
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Deadline</th>
                      <th className="py-2.5 px-3 text-right">Output GCT</th>
                      <th className="py-2.5 px-3 text-right">Input GCT</th>
                      <th className="py-2.5 px-3 text-right">Net Payable</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compliance.gctReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {ret.period}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {ret.dueDate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatJMD(ret.outputTax)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatJMD(ret.inputTax)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatJMD(ret.netGctPayable)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">
                          {ret.status}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setGctPeriod(ret.period)}
                            className="text-brand-600 hover:underline font-bold cursor-pointer"
                          >
                            Load
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYROLL & NIS/NHT */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Controls Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Employee Payroll & Statutory Calculator (NIS · NHT · EdTax · HEART · PAYE)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Uses {profileDraft.taxYear} TAJ statutory thresholds and J$5M annual NIS insurable cap.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Period</span>
                  <input
                    type="month"
                    value={payrollPeriod}
                    onChange={(e) => setPayrollPeriod(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Pay Date</span>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                {canManageLedger && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmployee(null);
                        setIsEmployeeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <Plus size={14} />
                      Add Employee
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePayrollRun}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      Generate Monthly Run & S01
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Monthly Live Preview KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Active Employees
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {activeEmployees.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Monthly Gross Pay
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(liveTotals.grossPay)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Net Payroll Due Staff
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(liveTotals.netPay)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Employer Statutory
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(liveTotals.totalEmployerContributions)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Total S01 Payable
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-emerald-950 mt-1">
                  {formatJMD(liveTotals.totalS01Remittance)}
                </p>
              </div>
            </div>

            {/* Roster Table */}
            {compliance.employees.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Users className="mx-auto text-slate-400 mb-3" size={28} />
                <p className="text-sm font-bold text-slate-800">
                  No employees on payroll roster yet
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Add staff members with their TRN, NIS number, and monthly gross salary to calculate NIS, NHT, Education Tax, HEART/NSTA, and PAYE automatically.
                </p>
                {canManageLedger && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEmployee(null);
                      setIsEmployeeModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 cursor-pointer"
                  >
                    <Plus size={14} />
                    Add First Employee
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">TRN / NIS</th>
                      <th className="py-3 px-3 text-right">Monthly Gross</th>
                      <th className="py-3 px-3 text-right">NIS (EE/ER)</th>
                      <th className="py-3 px-3 text-right">NHT (EE/ER)</th>
                      <th className="py-3 px-3 text-right">EdTax (EE/ER)</th>
                      <th className="py-3 px-3 text-right">HEART (ER)</th>
                      <th className="py-3 px-3 text-right">PAYE</th>
                      <th className="py-3 px-3 text-right">Net Pay</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compliance.employees.map((emp) => {
                      const calc = calculateEmployeeMonthlyPayroll(
                        emp,
                        profileDraft.taxYear,
                        profileDraft.heartExempt
                      );
                      return (
                        <tr
                          key={emp.id}
                          className={cn(
                            'hover:bg-slate-50',
                            emp.status === 'Inactive' && 'opacity-50'
                          )}
                        >
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{emp.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {emp.position || 'Staff'} · {emp.status}
                              {emp.isPensioner65 ? ' · 65+ Relief' : ''}
                            </p>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            <div>TRN: {emp.trn || '—'}</div>
                            <div>NIS: {emp.nisNumber || '—'}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatJMD(calc.monthlyGross)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            <div>{formatJMD(calc.nisEmployee)}</div>
                            <div className="text-[10px] text-slate-500">
                              ER: {formatJMD(calc.nisEmployer)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            <div>{formatJMD(calc.nhtEmployee)}</div>
                            <div className="text-[10px] text-slate-500">
                              ER: {formatJMD(calc.nhtEmployer)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            <div>{formatJMD(calc.edTaxEmployee)}</div>
                            <div className="text-[10px] text-slate-500">
                              ER: {formatJMD(calc.edTaxEmployer)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {formatJMD(calc.heartEmployer)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatJMD(calc.paye)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-black text-emerald-700">
                            {formatJMD(calc.netPay)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPayslipEmployee(emp)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
                                aria-label={`View payslip for ${emp.name}`}
                              >
                                <Receipt size={12} />
                                Payslip
                              </button>
                              {canManageLedger && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEmployee(emp);
                                      setIsEmployeeModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 cursor-pointer"
                                    aria-label={`Edit ${emp.name}`}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteEmployeeId(emp.id)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    aria-label={`Remove ${emp.name}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Saved Payroll Runs & GL Posting */}
          {compliance.payrollRuns.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-4">
                Generated Payroll Runs & General Ledger Posting
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">S01 Due Date</th>
                      <th className="py-2.5 px-3">Staff</th>
                      <th className="py-2.5 px-3 text-right">Gross Pay</th>
                      <th className="py-2.5 px-3 text-right">Net Pay</th>
                      <th className="py-2.5 px-3 text-right">S01 Total</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compliance.payrollRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {run.period}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {run.dueDate}
                        </td>
                        <td className="py-3 px-3">{run.employees.length}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {formatJMD(run.totals.grossPay)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {formatJMD(run.totals.netPay)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatJMD(run.totals.totalS01Remittance)}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">
                          {run.status}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedS01RunId(run.id);
                                setActiveTab('s01');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                            >
                              View S01
                            </button>
                            {run.journalEntryId ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-bold">
                                <BookCheck size={12} />
                                {run.journalEntryId}
                              </span>
                            ) : (
                              canManageLedger && (
                                <button
                                  type="button"
                                  onClick={() => handlePostPayrollToLedger(run.id)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                                >
                                  Post to GL
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: S01 MONTHLY STATUTORY RETURN */}
      {activeTab === 's01' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Form S01 — Monthly Employer Statutory Remittance
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Combined TAJ return for NIS, NHT, Education Tax, HEART/NSTA Trust, and PAYE · Due on the 14th of the following month.
              </p>
            </div>

            {compliance.payrollRuns.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedS01RunId}
                  onChange={(e) => setSelectedS01RunId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                >
                  {compliance.payrollRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.period} ({run.status})
                    </option>
                  ))}
                </select>
                {selectedS01Run && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExportS01Pdf(selectedS01Run)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportS01Csv(selectedS01Run)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} />
                      CSV
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!selectedS01Run ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Calendar className="mx-auto text-slate-400 mb-3" size={28} />
              <p className="text-sm font-bold text-slate-800">
                No monthly S01 payroll run generated yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Go to <strong>Payroll &amp; NIS/NHT</strong>, add employees, and click{' '}
                <strong>Generate Monthly Run &amp; S01</strong>.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('payroll')}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Open Payroll &amp; NIS/NHT
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Return Period
                  </p>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">
                    {selectedS01Run.period}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    TAJ Due Date (14th)
                  </p>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">
                    {selectedS01Run.dueDate}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Gross Emoluments
                  </p>
                  <p className="text-lg font-black font-mono tabular-nums text-slate-900 mt-1">
                    {formatJMD(selectedS01Run.totals.grossPay)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Total S01 Remittance Due
                  </p>
                  <p className="text-lg font-black font-mono tabular-nums text-emerald-950 mt-1">
                    {formatJMD(selectedS01Run.totals.totalS01Remittance)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4">Statutory Fund</th>
                      <th className="py-3 px-4">Contribution Basis</th>
                      <th className="py-3 px-4 text-right">Employee Share</th>
                      <th className="py-3 px-4 text-right">Employer Share</th>
                      <th className="py-3 px-4 text-right">Total Payable (JMD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        National Insurance Scheme (NIS)
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        3% EE / 3% ER (Capped at J$416,666.67/mo)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.nisEmployee)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.nisEmployer)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatJMD(
                          selectedS01Run.totals.nisEmployee +
                            selectedS01Run.totals.nisEmployer
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        National Housing Trust (NHT)
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        2% EE / 3% ER on Gross Emoluments
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.nhtEmployee)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.nhtEmployer)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatJMD(
                          selectedS01Run.totals.nhtEmployee +
                            selectedS01Run.totals.nhtEmployer
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        Education Tax (EdTax)
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        2.25% EE / 3.5% ER on Statutory Income (Gross - NIS)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.edTaxEmployee)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.edTaxEmployer)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatJMD(
                          selectedS01Run.totals.edTaxEmployee +
                            selectedS01Run.totals.edTaxEmployer
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        HEART / NSTA Trust
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        3% Employer Contribution on Total Wage Bill
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                        {formatJMD(0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.heartEmployer)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatJMD(selectedS01Run.totals.heartEmployer)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        Income Tax (PAYE)
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        25% / 30% above {selectedS01Run.taxYear} TAJ threshold
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatJMD(selectedS01Run.totals.paye)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                        {formatJMD(0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatJMD(selectedS01Run.totals.paye)}
                      </td>
                    </tr>
                    <tr className="bg-slate-900 text-white">
                      <td className="py-3.5 px-4 font-black" colSpan={2}>
                        TOTAL S01 STATUTORY REMITTANCE ({selectedS01Run.status})
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                        {formatJMD(
                          selectedS01Run.totals.nisEmployee +
                            selectedS01Run.totals.nhtEmployee +
                            selectedS01Run.totals.edTaxEmployee +
                            selectedS01Run.totals.paye
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                        {formatJMD(selectedS01Run.totals.totalEmployerContributions)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-black text-base">
                        {formatJMD(selectedS01Run.totals.totalS01Remittance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {canManageLedger && (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateS01Status(selectedS01Run, 'Filed S01')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    Mark Filed S01
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateS01Status(selectedS01Run, 'Remitted')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    Mark Remitted to TAJ
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4: S02 ANNUAL RETURN & P24 EMPLOYEE SUMMARY */}
      {activeTab === 's02' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Form S02 — Annual Employer Return &amp; P24 Employee Certificates
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Reconciles all monthly S01 payroll filings for calendar year {s02Year} (Due March 31 of following year).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={s02Year}
                  onChange={(e) => setS02Year(e.target.value as JamaicaTaxYear)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-900"
                >
                  <option value="2026">2026 Return</option>
                  <option value="2025">2025 Return</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportS02Pdf}
                  disabled={s02Runs.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  <Download size={14} />
                  Export S02 PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportS02Csv}
                  disabled={p24EmployeeSummaries.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  Export P24 CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Annual Gross Emoluments
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(s02AnnualTotals.grossPay)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Annual NIS + NHT
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(s02AnnualTotals.nisTotal + s02AnnualTotals.nhtTotal)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Annual PAYE + EdTax + HEART
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                  {formatJMD(
                    s02AnnualTotals.payeTotal +
                      s02AnnualTotals.edTaxTotal +
                      s02AnnualTotals.heartTotal
                  )}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Total S02 Annual Statutory
                </p>
                <p className="text-xl font-black font-mono tabular-nums text-emerald-950 mt-1">
                  {formatJMD(s02AnnualTotals.s02Total)}
                </p>
              </div>
            </div>

            {s02Runs.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-500">
                No payroll runs recorded for calendar year {s02Year}. Generate monthly payroll runs under Payroll &amp; NIS/NHT to populate S02 and P24 schedules.
              </div>
            ) : (
              <>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">
                    Monthly S01 Reconciliation Schedule ({s02Year})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3 text-right">Gross</th>
                          <th className="py-2.5 px-3 text-right">NIS</th>
                          <th className="py-2.5 px-3 text-right">NHT</th>
                          <th className="py-2.5 px-3 text-right">EdTax</th>
                          <th className="py-2.5 px-3 text-right">HEART</th>
                          <th className="py-2.5 px-3 text-right">PAYE</th>
                          <th className="py-2.5 px-3 text-right">Total S01</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {s02Runs.map((run) => (
                          <tr key={run.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {run.period}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.grossPay)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.nisEmployee + run.totals.nisEmployer)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.nhtEmployee + run.totals.nhtEmployer)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.edTaxEmployee + run.totals.edTaxEmployer)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.heartEmployer)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(run.totals.paye)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {formatJMD(run.totals.totalS01Remittance)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-700">
                              {run.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">
                    P24 Employee Annual Certificate Summary ({s02Year})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">TRN / NIS</th>
                          <th className="py-2.5 px-3 text-right">Runs</th>
                          <th className="py-2.5 px-3 text-right">Annual Gross</th>
                          <th className="py-2.5 px-3 text-right">NIS (EE)</th>
                          <th className="py-2.5 px-3 text-right">NHT (EE)</th>
                          <th className="py-2.5 px-3 text-right">EdTax (EE)</th>
                          <th className="py-2.5 px-3 text-right">PAYE</th>
                          <th className="py-2.5 px-3 text-right">Annual Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {p24EmployeeSummaries.map((emp) => (
                          <tr key={emp.employeeId}>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {emp.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {emp.trn || '—'} / {emp.nisNumber || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {emp.months}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                              {formatJMD(emp.gross)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(emp.nisEE)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(emp.nhtEE)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatJMD(emp.edTaxEE)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                              {formatJMD(emp.paye)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-black text-emerald-700">
                              {formatJMD(emp.netPay)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {isEmployeeModalOpen && (
        <PayrollEmployeeModal
          initialData={editingEmployee}
          taxYear={profileDraft.taxYear}
          heartExempt={profileDraft.heartExempt}
          onClose={() => {
            setIsEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={(emp) => {
            try {
              const next = dataService.savePayrollEmployee(emp);
              setCompliance(next);
              setIsEmployeeModalOpen(false);
              setEditingEmployee(null);
              showNotice('success', `Saved ${emp.name} to payroll roster.`);
            } catch (err: any) {
              showNotice('error', err.message || 'Unable to save employee.');
            }
          }}
        />
      )}

      {/* Employee Statutory Payslip Modal */}
      {payslipEmployee && (
        <EmployeePayslipModal
          employee={payslipEmployee}
          period={payrollPeriod}
          taxYear={profileDraft.taxYear}
          heartExempt={profileDraft.heartExempt}
          profile={profileDraft}
          onClose={() => setPayslipEmployee(null)}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteEmployeeId)}
        onClose={() => setDeleteEmployeeId(null)}
        onConfirm={() => {
          if (!deleteEmployeeId) return;
          try {
            const next = dataService.deletePayrollEmployee(deleteEmployeeId);
            setCompliance(next);
            showNotice('success', 'Employee removed from payroll roster.');
          } catch (err: any) {
            showNotice('error', err.message || 'Unable to remove employee.');
          } finally {
            setDeleteEmployeeId(null);
          }
        }}
        title="Remove Employee"
        message="Remove this employee from future monthly payroll runs? Previously generated S01 and S02 historical runs will remain intact."
        confirmText="Remove Employee"
        variant="danger"
      />
    </div>
  );
};

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface EmployeeModalProps {
  initialData: PayrollEmployee | null;
  taxYear: JamaicaTaxYear;
  heartExempt: boolean;
  onClose: () => void;
  onSave: (employee: PayrollEmployee) => void;
}

const PayrollEmployeeModal: React.FC<EmployeeModalProps> = ({
  initialData,
  taxYear,
  heartExempt,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<PayrollEmployee>(
    initialData || {
      id: '',
      name: '',
      trn: '',
      nisNumber: '',
      position: '',
      monthlyGross: 250000,
      approvedPension: 0,
      isPensioner65: false,
      status: 'Active',
    }
  );

  const preview = useMemo(
    () => calculateEmployeeMonthlyPayroll(form, taxYear, heartExempt),
    [form, taxYear, heartExempt]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">
            {initialData?.id ? 'Edit Payroll Employee' : 'Add Payroll Employee'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Danielle Brown"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Position / Role
              </label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. Operations Manager"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Employee TRN
              </label>
              <input
                type="text"
                value={form.trn}
                onChange={(e) => setForm({ ...form, trn: e.target.value })}
                placeholder="000-000-000"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                NIS Number
              </label>
              <input
                type="text"
                value={form.nisNumber}
                onChange={(e) => setForm({ ...form, nisNumber: e.target.value })}
                placeholder="A-123456"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Monthly Gross Salary (JMD) *
              </label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={form.monthlyGross}
                onChange={(e) =>
                  setForm({
                    ...form,
                    monthlyGross: Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Approved Pension (JMD/mo)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.approvedPension || 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    approvedPension: Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Employment Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as 'Active' | 'Inactive',
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.isPensioner65}
              onChange={(e) =>
                setForm({ ...form, isPensioner65: e.target.checked })
              }
              className="w-4 h-4 rounded border-slate-300 text-brand-600"
            />
            Age 65+ / Pensioner Relief (NIS exempt + J$250,040/yr extra PAYE relief)
          </label>

          {/* Live Statutory Preview Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <p className="font-black uppercase tracking-wider text-slate-600 text-[11px]">
              Live {taxYear} Monthly Statutory Preview
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono tabular-nums">
              <div>NIS EE: {formatJMD(preview.nisEmployee)}</div>
              <div>NHT EE: {formatJMD(preview.nhtEmployee)}</div>
              <div>EdTax EE: {formatJMD(preview.edTaxEmployee)}</div>
              <div>PAYE: {formatJMD(preview.paye)}</div>
              <div>HEART ER: {formatJMD(preview.heartEmployer)}</div>
              <div className="font-black text-emerald-700">
                Net: {formatJMD(preview.netPay)}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white cursor-pointer"
            >
              Save Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EmployeePayslipModalProps {
  employee: PayrollEmployee;
  period: string;
  taxYear: JamaicaTaxYear;
  heartExempt: boolean;
  profile: JamaicaComplianceProfile;
  onClose: () => void;
}

const EmployeePayslipModal: React.FC<EmployeePayslipModalProps> = ({
  employee,
  period,
  taxYear,
  heartExempt,
  profile,
  onClose,
}) => {
  const result = useMemo(
    () =>
      calculateStatutoryDeductions({
        grossPay: employee.monthlyGross,
        taxYear,
        payFrequency: 'Monthly',
        approvedPension: employee.approvedPension || 0,
        isPensioner65: employee.isPensioner65,
        heartExempt,
      }),
    [employee, taxYear, heartExempt]
  );

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const user = dataService.getUser();
    doc.setFontSize(16);
    doc.text('Employee Statutory Payslip (Jamaica TAJ)', 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Employer: ${user?.company || 'Workspace Business'} | TRN: ${
        profile.trn || 'N/A'
      } | NIS #: ${profile.nisNumber || 'N/A'}`,
      14,
      26
    );
    doc.text(
      `Employee: ${employee.name} (${employee.position || 'Staff'}) | TRN: ${
        employee.trn || 'N/A'
      } | NIS #: ${employee.nisNumber || 'N/A'}`,
      14,
      32
    );
    doc.text(`Pay Period: ${period} | Tax Year: ${taxYear}`, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [['Description', 'Employee (JMD)', 'Employer (JMD)']],
      body: [
        ['Gross Monthly Emoluments', formatJMD(result.grossPay), '—'],
        ['NIS (3% EE / 3% ER)', formatJMD(result.nisEmployee), formatJMD(result.nisEmployer)],
        ['NHT (2% EE / 3% ER)', formatJMD(result.nhtEmployee), formatJMD(result.nhtEmployer)],
        ['Education Tax (2.25% EE / 3.5% ER)', formatJMD(result.edTaxEmployee), formatJMD(result.edTaxEmployer)],
        ['HEART / NSTA Trust (3% ER)', '—', formatJMD(result.heartEmployer)],
        ['PAYE (Income Tax)', formatJMD(result.paye), '—'],
        ...(result.approvedPension > 0
          ? [['Approved Pension Deduction', formatJMD(result.approvedPension), '—']]
          : []),
        ['Net Pay Disbursed', formatJMD(result.netPay), '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 119, 73] },
    });

    doc.save(`Payslip_${employee.name.replace(/\s+/g, '_')}_${period}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Statutory Payslip — {employee.name}
            </h3>
            <p className="text-xs text-slate-500">
              Period {period} · TRN {employee.trn || 'N/A'} · NIS {employee.nisNumber || 'N/A'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3">Statutory Item</th>
                  <th className="py-2.5 px-3 text-right">Employee (JMD)</th>
                  <th className="py-2.5 px-3 text-right">Employer (JMD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                <tr>
                  <td className="py-2.5 px-3 font-sans font-bold text-slate-900">Gross Salary</td>
                  <td className="py-2.5 px-3 text-right font-bold">{formatJMD(result.grossPay)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-700">NIS (3% EE / 3% ER)</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">-{formatJMD(result.nisEmployee)}</td>
                  <td className="py-2.5 px-3 text-right">{formatJMD(result.nisEmployer)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-700">NHT (2% EE / 3% ER)</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">-{formatJMD(result.nhtEmployee)}</td>
                  <td className="py-2.5 px-3 text-right">{formatJMD(result.nhtEmployer)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-700">Education Tax (2.25% / 3.5%)</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">-{formatJMD(result.edTaxEmployee)}</td>
                  <td className="py-2.5 px-3 text-right">{formatJMD(result.edTaxEmployer)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-700">HEART / NSTA (3% ER)</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                  <td className="py-2.5 px-3 text-right">{formatJMD(result.heartEmployer)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-700">PAYE (Income Tax)</td>
                  <td className="py-2.5 px-3 text-right text-rose-700">-{formatJMD(result.paye)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                </tr>
                {result.approvedPension > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 font-sans text-slate-700">Approved Pension</td>
                    <td className="py-2.5 px-3 text-right text-rose-700">-{formatJMD(result.approvedPension)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                  </tr>
                )}
                <tr className="bg-emerald-50 font-black text-emerald-950">
                  <td className="py-3 px-3 font-sans">Net Take-Home Pay</td>
                  <td className="py-3 px-3 text-right">{formatJMD(result.netPay)}</td>
                  <td className="py-3 px-3 text-right text-emerald-800">{formatJMD(result.totalEmployerContributions)} ER</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white cursor-pointer"
            >
              <Download size={14} />
              Download Payslip PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
