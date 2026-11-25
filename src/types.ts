export interface DataRecord {
  id: string;
  date: string;
  region: 'North' | 'South' | 'East' | 'West';
  category: 'Enterprise' | 'SME' | 'Consumer';
  revenue: number;
  cost: number;
  profit: number;
  customers: number;
  status: 'Completed' | 'Pending' | 'Flagged';
}

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  totalCustomers: number;
  avgMargin: number;
  revenueGrowth: number;
  profitGrowth: number;
}

export interface Invoice {
  id: string;
  client_name: string;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  date: string;
  due_date: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  description?: string;
  line_items?: LineItem[];
  payment_history?: Payment[];
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax_amount?: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  due_date?: string;
  description?: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  is_recurring?: boolean;
  frequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  duration_months?: number;
  end_date?: string;
  recurring_id?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  period: 'Monthly' | 'Quarterly' | 'Yearly';
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  notes?: string;
  created_at: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  notes?: string;
  balance: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  status: 'Draft' | 'Posted';
  lines: JournalLine[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  date: string;
  isRead: boolean;
  link?: string;
}

export interface JournalLine {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface BankStatementLine {
  id: string;
  account_id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  type: 'Deposit' | 'Withdrawal';
  status: 'Unmatched' | 'Matched' | 'Adjusted';
  matched_book_id?: string;
  reconciliation_id?: string;
}

export interface ReconciliationRecord {
  id: string;
  account_id: string;
  account_name: string;
  statement_date: string;
  beginning_balance: number;
  statement_ending_balance: number;
  cleared_book_balance: number;
  difference: number;
  cleared_count: number;
  cleared_item_ids: string[];
  statement_line_ids: string[];
  status: 'Completed' | 'Draft';
  notes?: string;
  completed_at: string;
}

export type AuditLogCategory = 'Auth' | 'Transaction' | 'Ledger' | 'Reconciliation' | 'Security' | 'Team';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  category: AuditLogCategory;
  action: string;
  details: string;
  reference?: string;
  status: 'Success' | 'Warning' | 'Info';
}

export type WorkspaceRole = 'Owner' | 'Accountant' | 'Bookkeeper' | 'Viewer';

export type WorkspacePermission =
  | 'view_financials'
  | 'manage_transactions'
  | 'manage_ledger'
  | 'export_reports'
  | 'manage_security'
  | 'manage_team'
  | 'manage_billing';

export interface TeamMember {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: 'Active' | 'Invited' | 'Suspended';
  joined_at: string;
  last_active?: string;
  invited_by?: string;
  photo?: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  invite_code: string;
  status: 'Pending' | 'Accepted' | 'Revoked';
  created_at: string;
  created_by: string;
}

export type JamaicaTaxYear = '2025' | '2026';

export type PayFrequency = 'Monthly' | 'Fortnightly' | 'Weekly' | 'Annual';

export interface StatutoryCalculationResult {
  payFrequency: PayFrequency;
  taxYear: JamaicaTaxYear;
  periodsPerYear: number;
  grossPay: number;
  nisInsurablePay: number;
  nisCapped: boolean;
  nisEmployee: number;
  nisEmployer: number;
  approvedPension: number;
  statutoryIncome: number;
  nhtEmployee: number;
  nhtEmployer: number;
  edTaxEmployee: number;
  edTaxEmployer: number;
  heartEmployer: number;
  payeThreshold: number;
  chargeableIncome: number;
  payeStandard25: number;
  payeHigher30: number;
  paye: number;
  totalEmployeeStatutory: number;
  totalEmployeeDeductions: number;
  netPay: number;
  totalEmployerContributions: number;
  totalEmployerCost: number;
  totalTajRemittance: number;
}

export interface JamaicaComplianceProfile {
  trn: string;
  nisNumber: string;
  nhtNumber: string;
  gctNumber: string;
  taxYear: JamaicaTaxYear;
  heartExempt: boolean;
}

export interface PayrollEmployee {
  id: string;
  name: string;
  trn: string;
  nisNumber: string;
  position: string;
  monthlyGross: number;
  approvedPension?: number;
  payFrequency?: PayFrequency;
  isPensioner65: boolean;
  status: 'Active' | 'Inactive';
}

export interface EmployeePayrollBreakdown {
  employeeId: string;
  name: string;
  trn: string;
  nisNumber: string;
  monthlyGross: number;
  approvedPension?: number;
  nisEmployee: number;
  nisEmployer: number;
  statutoryIncome: number;
  nhtEmployee: number;
  nhtEmployer: number;
  edTaxEmployee: number;
  edTaxEmployer: number;
  heartEmployer: number;
  paye: number;
  totalEmployeeDeductions: number;
  netPay: number;
  totalEmployerContributions: number;
  totalStatutoryRemittance: number;
}

export interface PayrollRunRecord {
  id: string;
  period: string; // YYYY-MM
  payDate: string;
  dueDate: string; // 14th of following month
  taxYear: JamaicaTaxYear;
  employees: EmployeePayrollBreakdown[];
  totals: {
    grossPay: number;
    nisEmployee: number;
    nisEmployer: number;
    nhtEmployee: number;
    nhtEmployer: number;
    edTaxEmployee: number;
    edTaxEmployer: number;
    heartEmployer: number;
    paye: number;
    netPay: number;
    totalEmployerContributions: number;
    totalS01Remittance: number;
  };
  status: 'Draft' | 'Filed S01' | 'Remitted';
  journalEntryId?: string;
  createdAt: string;
}

export interface GctReturnRecord {
  id: string;
  period: string; // YYYY-MM
  dueDate: string;
  standardRatedSales: number;
  zeroRatedSales: number;
  exemptSupplies: number;
  outputTax: number;
  taxablePurchases: number;
  inputTax: number;
  creditBroughtForward: number;
  netGctPayable: number;
  status: 'Draft' | 'Filed' | 'Paid';
  filedAt?: string;
  notes?: string;
}

export interface JamaicaComplianceState {
  profile: JamaicaComplianceProfile;
  employees: PayrollEmployee[];
  payrollRuns: PayrollRunRecord[];
  gctReturns: GctReturnRecord[];
}

