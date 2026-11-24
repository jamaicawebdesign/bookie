import {
  EmployeePayrollBreakdown,
  JamaicaTaxYear,
  PayrollEmployee,
} from '../types';

export const JAMAICA_STATUTORY_CONFIG: Record<
  JamaicaTaxYear,
  {
    label: string;
    monthlyThreshold: number;
    annualThreshold: number;
    pensionerExtraAnnual: number;
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
 * Computes monthly Jamaican statutory payroll deductions in TAJ order:
 * 1. NIS (3% EE / 3% ER capped at J$416,666.67 monthly insurable ceiling)
 * 2. Statutory Income = Gross - NIS Employee
 * 3. NHT (2% EE / 3% ER on full gross)
 * 4. Education Tax (2.25% EE / 3.5% ER on Statutory Income)
 * 5. HEART/NSTA Trust (3% ER on gross unless exempt)
 * 6. PAYE (0% up to threshold, 25% next J$500k/mo chargeable, 30% above)
 */
export function calculateEmployeeMonthlyPayroll(
  employee: PayrollEmployee,
  taxYear: JamaicaTaxYear,
  heartExempt = false
): EmployeePayrollBreakdown {
  const cfg = JAMAICA_STATUTORY_CONFIG[taxYear];
  const gross = Math.max(0, Number(employee.monthlyGross) || 0);

  const nisInsurable = Math.min(gross, cfg.nisMonthlyCeiling);
  const nisEmployee = employee.isPensioner65 ? 0 : round2(nisInsurable * cfg.nisRate);
  const nisEmployer = employee.isPensioner65 ? 0 : round2(nisInsurable * cfg.nisRate);

  const statutoryIncome = Math.max(0, round2(gross - nisEmployee));

  const nhtEmployee = round2(gross * cfg.nhtEmployeeRate);
  const nhtEmployer = round2(gross * cfg.nhtEmployerRate);

  const edTaxEmployee = round2(statutoryIncome * cfg.edTaxEmployeeRate);
  const edTaxEmployer = round2(statutoryIncome * cfg.edTaxEmployerRate);

  const heartEmployer = heartExempt ? 0 : round2(gross * cfg.heartEmployerRate);

  const pensionerMonthlyRelief = employee.isPensioner65
    ? cfg.pensionerExtraAnnual / 12
    : 0;
  const effectiveThreshold = cfg.monthlyThreshold + pensionerMonthlyRelief;
  const chargeableIncome = Math.max(0, statutoryIncome - effectiveThreshold);

  let paye = 0;
  if (chargeableIncome > 0) {
    const standardSlice = Math.min(chargeableIncome, cfg.higherBandMonthlyChargeable);
    const higherSlice = Math.max(0, chargeableIncome - cfg.higherBandMonthlyChargeable);
    paye = round2(standardSlice * 0.25 + higherSlice * 0.3);
  }

  const totalEmployeeDeductions = round2(
    nisEmployee + nhtEmployee + edTaxEmployee + paye
  );
  const netPay = round2(Math.max(0, gross - totalEmployeeDeductions));
  const totalEmployerContributions = round2(
    nisEmployer + nhtEmployer + edTaxEmployer + heartEmployer
  );
  const totalStatutoryRemittance = round2(
    totalEmployeeDeductions + totalEmployerContributions
  );

  return {
    employeeId: employee.id,
    name: employee.name,
    trn: employee.trn,
    nisNumber: employee.nisNumber,
    monthlyGross: round2(gross),
    nisEmployee,
    nisEmployer,
    statutoryIncome,
    nhtEmployee,
    nhtEmployer,
    edTaxEmployee,
    edTaxEmployer,
    heartEmployer,
    paye,
    totalEmployeeDeductions,
    netPay,
    totalEmployerContributions,
    totalStatutoryRemittance,
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
