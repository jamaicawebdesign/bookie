import {
  EmployeePayrollBreakdown,
  JamaicaTaxYear,
  PayFrequency,
  PayrollEmployee,
  StatutoryCalculationResult,
} from '../types';

export const PAY_FREQUENCY_PERIODS: Record<PayFrequency, number> = {
  Monthly: 12,
  Fortnightly: 26,
  Weekly: 52,
  Annual: 1,
};

export const JAMAICA_STATUTORY_CONFIG: Record<
  JamaicaTaxYear,
  {
    label: string;
    monthlyThreshold: number;
    annualThreshold: number;
    pensionerExtraAnnual: number;
    higherBandAnnualThreshold: number;
    higherBandMonthlyChargeable: number;
    nisAnnualCeiling: number;
    nisMonthlyCeiling: number;
    nisRate: number;
    nhtEmployeeRate: number;
    nhtEmployerRate: number;
    edTaxEmployeeRate: number;
    edTaxEmployerRate: number;
    heartEmployerRate: number;
    gctStandardRate: number;
  }
> = {
  '2025': {
    label: '2025/2026 Fiscal Year (J$1,799,376/yr)',
    monthlyThreshold: 149948,
    annualThreshold: 1799376,
    pensionerExtraAnnual: 250040,
    higherBandAnnualThreshold: 6000000,
    higherBandMonthlyChargeable: 500000,
    nisAnnualCeiling: 5000000,
    nisMonthlyCeiling: 416666.67,
    nisRate: 0.03,
    nhtEmployeeRate: 0.02,
    nhtEmployerRate: 0.03,
    edTaxEmployeeRate: 0.0225,
    edTaxEmployerRate: 0.035,
    heartEmployerRate: 0.03,
    gctStandardRate: 0.15,
  },
  '2026': {
    label: '2026/2027 Fiscal Year (J$1,902,360/yr)',
    monthlyThreshold: 158530,
    annualThreshold: 1902360,
    pensionerExtraAnnual: 250040,
    higherBandAnnualThreshold: 6000000,
    higherBandMonthlyChargeable: 500000,
    nisAnnualCeiling: 5000000,
    nisMonthlyCeiling: 416666.67,
    nisRate: 0.03,
    nhtEmployeeRate: 0.02,
    nhtEmployerRate: 0.03,
    edTaxEmployeeRate: 0.0225,
    edTaxEmployerRate: 0.035,
    heartEmployerRate: 0.03,
    gctStandardRate: 0.15,
  },
};

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function formatJMD(amount: number): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Computes Jamaican statutory payroll deductions (NIS, NHT, Ed Tax, HEART, PAYE)
 * for Monthly, Fortnightly, Weekly, or Annual pay cycles in TAJ statutory order:
 * 1. NIS (3% EE / 3% ER capped at J$5,000,000/yr prorated by pay cycle)
 * 2. Statutory Income = Gross - NIS Employee - Approved Pension
 * 3. NHT (2% EE / 3% ER on full gross)
 * 4. Education Tax (2.25% EE / 3.5% ER on Statutory Income)
 * 5. HEART/NSTA Trust (3% ER on gross unless exempt)
 * 6. PAYE (0% up to prorated threshold, 25% standard band, 30% > J$6M/yr chargeable)
 */
export function calculateStatutoryDeductions(params: {
  grossPay: number;
  taxYear: JamaicaTaxYear;
  payFrequency?: PayFrequency;
  isPensioner65?: boolean;
  heartExempt?: boolean;
  approvedPension?: number;
}): StatutoryCalculationResult {
  const payFrequency: PayFrequency = params.payFrequency || 'Monthly';
  const periodsPerYear = PAY_FREQUENCY_PERIODS[payFrequency];
  const cfg = JAMAICA_STATUTORY_CONFIG[params.taxYear];

  const grossPay = round2(Math.max(0, Number(params.grossPay) || 0));
  const nisPeriodCeiling = round2(cfg.nisAnnualCeiling / periodsPerYear);
  const nisInsurablePay = round2(Math.min(grossPay, nisPeriodCeiling));
  const nisCapped = !params.isPensioner65 && grossPay > nisPeriodCeiling;

  const nisEmployee = params.isPensioner65
    ? 0
    : round2(nisInsurablePay * cfg.nisRate);
  const nisEmployer = params.isPensioner65
    ? 0
    : round2(nisInsurablePay * cfg.nisRate);

  // Approved superannuation / pension cannot exceed Gross - NIS
  const maxPension = Math.max(0, round2(grossPay - nisEmployee));
  const approvedPension = round2(
    Math.min(Math.max(0, Number(params.approvedPension) || 0), maxPension)
  );

  const statutoryIncome = Math.max(
    0,
    round2(grossPay - nisEmployee - approvedPension)
  );

  const nhtEmployee = round2(grossPay * cfg.nhtEmployeeRate);
  const nhtEmployer = round2(grossPay * cfg.nhtEmployerRate);

  const edTaxEmployee = round2(statutoryIncome * cfg.edTaxEmployeeRate);
  const edTaxEmployer = round2(statutoryIncome * cfg.edTaxEmployerRate);

  const heartEmployer = params.heartExempt
    ? 0
    : round2(grossPay * cfg.heartEmployerRate);

  const baseAnnualThreshold =
    cfg.annualThreshold + (params.isPensioner65 ? cfg.pensionerExtraAnnual : 0);
  const payeThreshold = round2(baseAnnualThreshold / periodsPerYear);
  const higherBandThreshold = round2(
    cfg.higherBandAnnualThreshold / periodsPerYear
  );

  const chargeableIncome = Math.max(0, round2(statutoryIncome - payeThreshold));
  const standardSlice = Math.min(chargeableIncome, higherBandThreshold);
  const higherSlice = Math.max(0, round2(chargeableIncome - higherBandThreshold));
  const payeStandard25 = round2(standardSlice * 0.25);
  const payeHigher30 = round2(higherSlice * 0.3);
  const paye = round2(payeStandard25 + payeHigher30);

  const totalEmployeeStatutory = round2(
    nisEmployee + nhtEmployee + edTaxEmployee + paye
  );
  const totalEmployeeDeductions = round2(totalEmployeeStatutory + approvedPension);
  const netPay = round2(Math.max(0, grossPay - totalEmployeeDeductions));
  const totalEmployerContributions = round2(
    nisEmployer + nhtEmployer + edTaxEmployer + heartEmployer
  );
  const totalEmployerCost = round2(grossPay + totalEmployerContributions);
  const totalTajRemittance = round2(
    totalEmployeeStatutory + totalEmployerContributions
  );

  return {
    payFrequency,
    taxYear: params.taxYear,
    periodsPerYear,
    grossPay,
    nisInsurablePay,
    nisCapped,
    nisEmployee,
    nisEmployer,
    approvedPension,
    statutoryIncome,
    nhtEmployee,
    nhtEmployer,
    edTaxEmployee,
    edTaxEmployer,
    heartEmployer,
    payeThreshold,
    chargeableIncome,
    payeStandard25,
    payeHigher30,
    paye,
    totalEmployeeStatutory,
    totalEmployeeDeductions,
    netPay,
    totalEmployerContributions,
    totalEmployerCost,
    totalTajRemittance,
  };
}

export function calculateEmployeeMonthlyPayroll(
  employee: PayrollEmployee,
  taxYear: JamaicaTaxYear,
  heartExempt = false
): EmployeePayrollBreakdown {
  const result = calculateStatutoryDeductions({
    grossPay: employee.monthlyGross,
    taxYear,
    payFrequency: 'Monthly',
    isPensioner65: employee.isPensioner65,
    heartExempt,
    approvedPension: employee.approvedPension || 0,
  });

  return {
    employeeId: employee.id,
    name: employee.name,
    trn: employee.trn,
    nisNumber: employee.nisNumber,
    monthlyGross: result.grossPay,
    approvedPension: result.approvedPension,
    nisEmployee: result.nisEmployee,
    nisEmployer: result.nisEmployer,
    statutoryIncome: result.statutoryIncome,
    nhtEmployee: result.nhtEmployee,
    nhtEmployer: result.nhtEmployer,
    edTaxEmployee: result.edTaxEmployee,
    edTaxEmployer: result.edTaxEmployer,
    heartEmployer: result.heartEmployer,
    paye: result.paye,
    totalEmployeeDeductions: result.totalEmployeeStatutory,
    netPay: result.netPay,
    totalEmployerContributions: result.totalEmployerContributions,
    totalStatutoryRemittance: result.totalTajRemittance,
  };
}

export function getS01DueDate(periodYYYYMM: string): string {
  const [yearStr, monthStr] = periodYYYYMM.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return '';
  // Month is 1-indexed, so new Date(year, month, 14) is the 14th of the following month
  const due = new Date(year, month, 14);
  const day = due.getDay();
  // If 14th falls on weekend, push to next business day
  if (day === 6) due.setDate(16);
  if (day === 0) due.setDate(15);
  const y = due.getFullYear();
  const m = String(due.getMonth() + 1).padStart(2, '0');
  const d = String(due.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getGct4ADueDate(periodYYYYMM: string): string {
  const [yearStr, monthStr] = periodYYYYMM.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return '';
  // Last day of the following month
  const due = new Date(year, month + 1, 0);
  const y = due.getFullYear();
  const m = String(due.getMonth() + 1).padStart(2, '0');
  const d = String(due.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
