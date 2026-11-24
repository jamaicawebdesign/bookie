import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Calendar, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, Scale, ArrowRight } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Account, Invoice, Expense, Budget, JournalEntry, BankStatementLine, ReconciliationRecord } from '../types';
import { formatCurrency, cn, formatLocalDate, sanitizeCsvCell } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportExportModal, ReportExportFilters } from './ReportExportModal';

type ReportType = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'accounts-receivable' | 'accounts-payable' | 'budget-vs-actual' | 'bank-reconciliation-status';

interface UnreconciledTxItem {
  id: string;
  accountId: string;
  accountLabel: string;
  date: string;
  source: 'Journal Entry' | 'Paid Invoice' | 'Paid Expense';
  reference: string;
  description: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  inDraft: boolean;
}

const getInvoiceRemaining = (inv: Invoice) => {
  if (inv.status === 'Paid') return 0;
  const paid = (inv.payment_history || []).reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, inv.amount + (inv.tax_amount || 0) - paid);
};

export function ReportsPage({ onNavigateToReconciliation }: { onNavigateToReconciliation?: () => void }) {
  const [activeReport, setActiveReport] = useState<ReportType>('trial-balance');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<JournalEntry[]>([]);
  const [allPaidInvoices, setAllPaidInvoices] = useState<Invoice[]>([]);
  const [allPaidExpenses, setAllPaidExpenses] = useState<Expense[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [syncTick, setSyncTick] = useState(0);
  const [dateRange, setDateRange] = useState({ 
    start: formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), 
    end: formatLocalDate() 
  });

  const today = formatLocalDate();

  useEffect(() => {
    const onSync = () => setSyncTick(t => t + 1);
    window.addEventListener('island-data-synced', onSync);
    return () => window.removeEventListener('island-data-synced', onSync);
  }, []);

  useEffect(() => {
    const allAccounts = dataService.getAccounts();
    const journalEntries = dataService.getJournalEntries();
    
    // Calculate period balances
    const periodAccounts = allAccounts.map(account => {
      const periodEntries = journalEntries.filter(entry => {
        const entryDate = entry.date;
        return entry.status === 'Posted' && 
               (!dateRange.start || entryDate >= dateRange.start) && 
               (!dateRange.end || entryDate <= dateRange.end);
      });

      let periodBalance = 0;
      periodEntries.forEach(entry => {
        entry.lines.forEach(line => {
          if (line.account_id === account.id) {
            if (account.type === 'Asset' || account.type === 'Expense') {
              periodBalance += (line.debit - line.credit);
            } else {
              periodBalance += (line.credit - line.debit);
            }
          }
        });
      });

      // For Balance Sheet accounts (Asset, Liability, Equity), we usually want the cumulative balance up to the end date
      // For Income Statement accounts (Revenue, Expense), we want the activity within the period
      if (['Asset', 'Liability', 'Equity'].includes(account.type)) {
        const cumulativeEntries = journalEntries.filter(entry => {
          return entry.status === 'Posted' && (!dateRange.end || entry.date <= dateRange.end);
        });
        
        let cumulativeBalance = 0; // In a real app, this would start from opening balances
        // For mock purposes, we'll use the account's current balance as a base if no entries exist, 
        // but ideally we calculate from all history.
        // Let's assume the 'balance' in the account object is the current total.
        // To get balance at 'end date', we take current balance and subtract entries AFTER end date.
        const entriesAfterEnd = journalEntries.filter(entry => entry.status === 'Posted' && dateRange.end && entry.date > dateRange.end);
        let adjustment = 0;
        entriesAfterEnd.forEach(entry => {
          entry.lines.forEach(line => {
            if (line.account_id === account.id) {
              if (account.type === 'Asset' || account.type === 'Expense') {
                adjustment += (line.debit - line.credit);
              } else {
                adjustment += (line.credit - line.debit);
              }
            }
          });
        });
        return { ...account, balance: account.balance - adjustment };
      }

      return { ...account, balance: periodBalance };
    });

    setAccounts(periodAccounts);
    
    // Filter invoices by date and status
    const filteredInvoices = dataService.getInvoices().filter(i => {
      const dateMatch = (!dateRange.start || i.date >= dateRange.start) && (!dateRange.end || i.date <= dateRange.end);
      const isOverdue = i.status === 'Overdue' || (i.status !== 'Paid' && i.due_date < today);
      const statusMatch = statusFilter === 'All' || 
                          i.status === statusFilter || 
                          (statusFilter === 'Overdue' && isOverdue) ||
                          (statusFilter === 'Unpaid' && i.status === 'Unpaid');
      return dateMatch && statusMatch;
    });
    setInvoices(filteredInvoices);

    // Filter expenses by date and status
    const filteredExpenses = dataService.getExpenses().filter(e => {
      const dateMatch = (!dateRange.start || e.date >= dateRange.start) && (!dateRange.end || e.date <= dateRange.end);
      const isOverdue = e.status === 'Overdue' || (e.status !== 'Paid' && e.due_date && e.due_date < today);
      const statusMatch = statusFilter === 'All' || 
                          e.status === statusFilter || 
                          (statusFilter === 'Overdue' && isOverdue) ||
                          (statusFilter === 'Unpaid' && e.status === 'Pending'); // Map Unpaid filter to Pending for expenses
      return dateMatch && statusMatch;
    });
    setExpenses(filteredExpenses);
    
    setBudgets(dataService.getBudgets());
    setAllJournalEntries(journalEntries);
    setAllPaidInvoices(dataService.getInvoices().filter(i => i.status === 'Paid'));
    setAllPaidExpenses(dataService.getExpenses().filter(e => e.status === 'Paid'));
    setReconciliations(dataService.getReconciliations());
    setStatementLines(dataService.getBankStatementLines());
  }, [dateRange, statusFilter, syncTick]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const title = activeReport.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    let tableData: any[] = [];
    let tableHeaders: string[] = [];

    if (activeReport === 'trial-balance') {
      tableHeaders = ['Code', 'Account Name', 'Debit', 'Credit'];
      let totalDebit = 0;
      let totalCredit = 0;
      tableData = accounts.map(acc => {
        const isDebit = acc.type === 'Asset' || acc.type === 'Expense';
        const debit = isDebit ? Math.max(0, acc.balance) : Math.max(0, -acc.balance);
        const credit = isDebit ? Math.max(0, -acc.balance) : Math.max(0, acc.balance);
        totalDebit += debit;
        totalCredit += credit;
        return [
          acc.code,
          acc.name,
          debit > 0 ? formatCurrency(debit) : '',
          credit > 0 ? formatCurrency(credit) : ''
        ];
      });
      tableData.push(['', 'TOTAL', formatCurrency(totalDebit), formatCurrency(totalCredit)]);
    } else if (activeReport === 'income-statement') {
      tableHeaders = ['Category', 'Account Name', 'Amount'];
      const revenue = accounts.filter(a => a.type === 'Revenue' && a.balance !== 0);
      const cogs = accounts.filter(a => (a.name.toLowerCase().includes('cost of goods sold') || a.code.startsWith('50')) && a.balance !== 0);
      const otherExpenses = accounts.filter(a => a.type === 'Expense' && !cogs.find(c => c.id === a.id) && a.balance !== 0);
      
      const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
      const totalCogs = cogs.reduce((s, a) => s + a.balance, 0);
      const grossProfit = totalRevenue - totalCogs;
      const totalOtherExpenses = otherExpenses.reduce((s, a) => s + a.balance, 0);
      const netIncome = grossProfit - totalOtherExpenses;

      revenue.forEach(acc => tableData.push(['Revenue', acc.name, formatCurrency(acc.balance)]));
      tableData.push(['', 'TOTAL REVENUE', formatCurrency(totalRevenue)]);
      tableData.push(['', '', '']); // Spacer
      
      if (cogs.length > 0) {
        cogs.forEach(acc => tableData.push(['COGS', acc.name, formatCurrency(acc.balance)]));
        tableData.push(['', 'TOTAL COGS', formatCurrency(totalCogs)]);
        tableData.push(['', 'GROSS PROFIT', formatCurrency(grossProfit)]);
        tableData.push(['', '', '']); // Spacer
      }
      
      otherExpenses.forEach(acc => tableData.push(['Operating Expense', acc.name, formatCurrency(acc.balance)]));
      tableData.push(['', 'TOTAL OPERATING EXPENSES', formatCurrency(totalOtherExpenses)]);
      tableData.push(['', '', '']); // Spacer
      
      tableData.push(['', 'NET INCOME', formatCurrency(netIncome)]);
    } else if (activeReport === 'accounts-receivable') {
      tableHeaders = ['Invoice ID', 'Client', 'Due Date', 'Status', 'Amount Due'];
      tableData = invoices.map(i => [i.id, i.client_name, i.due_date, i.status, formatCurrency(getInvoiceRemaining(i))]);
    } else if (activeReport === 'accounts-payable') {
      tableHeaders = ['Category', 'Description', 'Due Date', 'Status', 'Amount', 'Recurring'];
      tableData = expenses.map(e => [
        e.category, 
        e.description || '-', 
        e.due_date || '-', 
        e.status, 
        formatCurrency(e.amount),
        e.is_recurring
          ? (e.end_date ? `${e.frequency || 'Monthly'} (to ${e.end_date})` : `${e.frequency || 'Monthly'} (${e.duration_months || 12}m)`)
          : 'No'
      ]);
    } else if (activeReport === 'balance-sheet') {
      tableHeaders = ['Category', 'Account Name', 'Balance'];
      const assets = accounts.filter(a => a.type === 'Asset');
      const liabilities = accounts.filter(a => a.type === 'Liability');
      const equity = accounts.filter(a => a.type === 'Equity');

      assets.forEach(acc => tableData.push(['Asset', acc.name, formatCurrency(acc.balance)]));
      liabilities.forEach(acc => tableData.push(['Liability', acc.name, formatCurrency(acc.balance)]));
      equity.forEach(acc => tableData.push(['Equity', acc.name, formatCurrency(acc.balance)]));
    } else if (activeReport === 'budget-vs-actual') {
      tableHeaders = ['Category', 'Budget', 'Actual', 'Remaining', 'Utilization (%)'];
      const categories = Array.from(new Set(budgets.map(b => b.category)));
      tableData = categories.map(cat => {
        const budget = budgets.filter(b => b.category === cat).reduce((sum, b) => sum + b.limit_amount, 0);
        const actual = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
        const remaining = budget - actual;
        const utilization = budget > 0 ? (actual / budget) * 100 : 0;
        return [cat, formatCurrency(budget), formatCurrency(actual), formatCurrency(remaining), `${utilization.toFixed(1)}%`];
      });
    } else if (activeReport === 'bank-reconciliation-status') {
      tableHeaders = ['Account', 'Date', 'Source', 'Reference', 'Description', 'Type', 'Amount', 'Status'];
      const summaryRows = buildAccountReconciliationSummaries({
        accounts,
        journalEntries: allJournalEntries,
        paidInvoices: allPaidInvoices,
        paidExpenses: allPaidExpenses,
        reconciliations,
        statementLines,
        dateRange,
      });
      summaryRows.forEach((accSummary) => {
        if (accSummary.unreconciledItems.length === 0) {
          tableData.push([
            `${accSummary.account.code} ${accSummary.account.name}`,
            accSummary.lastReconciledDate || '-',
            'Summary',
            '-',
            'All transactions reconciled for period',
            '-',
            formatCurrency(0),
            'Reconciled',
          ]);
        } else {
          accSummary.unreconciledItems.forEach((item) => {
            tableData.push([
              `${accSummary.account.code} ${accSummary.account.name}`,
              item.date,
              item.source,
              item.reference,
              item.description,
              item.type,
              formatCurrency(item.amount),
              item.inDraft ? 'In Draft' : 'Unreconciled',
            ]);
          });
        }
      });
    }

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`${activeReport}_${formatLocalDate()}.pdf`);
  };

  const handleExportCSV = (filters: ReportExportFilters) => {
    const { startDate, endDate, status: exportStatus } = filters;
    
    // Get all data
    const allAccounts = dataService.getAccounts();
    const journalEntries = dataService.getJournalEntries();
    const allInvoices = dataService.getInvoices();
    const allExpenses = dataService.getExpenses();
    const allBudgets = dataService.getBudgets();

    // Filter accounts for the export period
    const exportAccounts = allAccounts.map(account => {
      const periodEntries = journalEntries.filter(entry => {
        const entryDate = entry.date;
        return entry.status === 'Posted' && 
               (!startDate || entryDate >= startDate) && 
               (!endDate || entryDate <= endDate);
      });

      let periodBalance = 0;
      periodEntries.forEach(entry => {
        entry.lines.forEach(line => {
          if (line.account_id === account.id) {
            if (account.type === 'Asset' || account.type === 'Expense') {
              periodBalance += (line.debit - line.credit);
            } else {
              periodBalance += (line.credit - line.debit);
            }
          }
        });
      });

      if (['Asset', 'Liability', 'Equity'].includes(account.type)) {
        const entriesAfterEnd = journalEntries.filter(entry => entry.status === 'Posted' && endDate && entry.date > endDate);
        let adjustment = 0;
        entriesAfterEnd.forEach(entry => {
          entry.lines.forEach(line => {
            if (line.account_id === account.id) {
              if (account.type === 'Asset' || account.type === 'Expense') {
                adjustment += (line.debit - line.credit);
              } else {
                adjustment += (line.credit - line.debit);
              }
            }
          });
        });
        return { ...account, balance: account.balance - adjustment };
      }

      return { ...account, balance: periodBalance };
    });

    // Filter invoices
    const exportInvoices = allInvoices.filter(i => {
      const dateMatch = (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate);
      const isOverdue = i.status === 'Overdue' || (i.status !== 'Paid' && i.due_date < today);
      const statusMatch = exportStatus === 'All' || 
                          i.status === exportStatus || 
                          (exportStatus === 'Overdue' && isOverdue) ||
                          (exportStatus === 'Unpaid' && i.status === 'Unpaid');
      return dateMatch && statusMatch;
    });

    // Filter expenses
    const exportExpenses = allExpenses.filter(e => {
      const dateMatch = (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate);
      const isOverdue = e.status === 'Overdue' || (e.status !== 'Paid' && e.due_date && e.due_date < today);
      const statusMatch = exportStatus === 'All' || 
                          e.status === exportStatus || 
                          (exportStatus === 'Overdue' && isOverdue) ||
                          (exportStatus === 'Unpaid' && e.status === 'Pending');
      return dateMatch && statusMatch;
    });

    let headers: string[] = [];
    let rows: any[] = [];

    if (activeReport === 'trial-balance') {
      headers = ['Code', 'Account Name', 'Debit', 'Credit'];
      rows = exportAccounts.map(acc => {
        const isDebit = acc.type === 'Asset' || acc.type === 'Expense';
        const debit = isDebit ? Math.max(0, acc.balance) : Math.max(0, -acc.balance);
        const credit = isDebit ? Math.max(0, -acc.balance) : Math.max(0, acc.balance);
        return [acc.code, acc.name, debit, credit];
      });
    } else if (activeReport === 'income-statement') {
      headers = ['Category', 'Account Name', 'Amount'];
      const revenue = exportAccounts.filter(a => a.type === 'Revenue' && a.balance !== 0);
      const cogs = exportAccounts.filter(a => (a.name.toLowerCase().includes('cost of goods sold') || a.code.startsWith('50')) && a.balance !== 0);
      const otherExpenses = exportAccounts.filter(a => a.type === 'Expense' && !cogs.find(c => c.id === a.id) && a.balance !== 0);
      
      revenue.forEach(acc => rows.push(['Revenue', acc.name, acc.balance]));
      cogs.forEach(acc => rows.push(['COGS', acc.name, acc.balance]));
      otherExpenses.forEach(acc => rows.push(['Operating Expense', acc.name, acc.balance]));
      
      const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
      const totalCogs = cogs.reduce((s, a) => s + a.balance, 0);
      const totalOtherExpenses = otherExpenses.reduce((s, a) => s + a.balance, 0);
      
      rows.push(['SUMMARY', 'Total Revenue', totalRevenue]);
      rows.push(['SUMMARY', 'Total COGS', totalCogs]);
      rows.push(['SUMMARY', 'Gross Profit', totalRevenue - totalCogs]);
      rows.push(['SUMMARY', 'Total Operating Expenses', totalOtherExpenses]);
      rows.push(['SUMMARY', 'Net Income', totalRevenue - totalCogs - totalOtherExpenses]);
    } else if (activeReport === 'accounts-receivable') {
      headers = ['Invoice ID', 'Client', 'Due Date', 'Status', 'Remaining Balance'];
      rows = exportInvoices.map(i => [i.id, i.client_name, i.due_date, i.status, getInvoiceRemaining(i)]);
    } else if (activeReport === 'accounts-payable') {
      headers = ['Category', 'Description', 'Due Date', 'Status', 'Amount', 'Is Recurring', 'Frequency', 'Duration (Months)'];
      rows = exportExpenses.map(e => [e.category, e.description || '', e.due_date || '', e.status, e.amount, e.is_recurring ? 'Yes' : 'No', e.frequency || '-', e.duration_months || '-']);
    } else if (activeReport === 'balance-sheet') {
      headers = ['Type', 'Account Name', 'Balance'];
      exportAccounts.filter(a => ['Asset', 'Liability', 'Equity'].includes(a.type)).forEach(acc => rows.push([acc.type, acc.name, acc.balance]));
    } else if (activeReport === 'budget-vs-actual') {
      headers = ['Category', 'Budget', 'Actual', 'Remaining', 'Utilization (%)'];
      const categories = Array.from(new Set(allBudgets.map(b => b.category)));
      rows = categories.map(cat => {
        const budget = allBudgets.filter(b => b.category === cat).reduce((sum, b) => sum + b.limit_amount, 0);
        const actual = exportExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
        const remaining = budget - actual;
        const utilization = budget > 0 ? (actual / budget) * 100 : 0;
        return [cat, budget, actual, remaining, utilization.toFixed(1)];
      });
    } else if (activeReport === 'bank-reconciliation-status') {
      headers = ['Account Code', 'Account Name', 'Date', 'Source', 'Reference', 'Description', 'Type', 'Amount', 'Reconciliation State'];
      const summaryRows = buildAccountReconciliationSummaries({
        accounts: exportAccounts,
        journalEntries,
        paidInvoices: allInvoices.filter(i => i.status === 'Paid'),
        paidExpenses: allExpenses.filter(e => e.status === 'Paid'),
        reconciliations: dataService.getReconciliations(),
        statementLines: dataService.getBankStatementLines(),
        dateRange: { start: startDate, end: endDate },
      });
      summaryRows.forEach((accSummary) => {
        accSummary.unreconciledItems.forEach((item) => {
          rows.push([
            accSummary.account.code,
            accSummary.account.name,
            item.date,
            item.source,
            item.reference,
            item.description,
            item.type,
            item.amount,
            item.inDraft ? 'In Draft' : 'Unreconciled',
          ]);
        });
      });
    }

    const csvContent = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map(row => row.map(sanitizeCsvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeReport}_export_${formatLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'trial-balance':
        return <TrialBalance accounts={accounts} journalEntries={allJournalEntries} dateRange={dateRange} />;
      case 'balance-sheet':
        return <BalanceSheet accounts={accounts} dateRange={dateRange} />;
      case 'income-statement':
        return <IncomeStatement accounts={accounts} dateRange={dateRange} />;
      case 'accounts-receivable':
        return <AccountsReceivable invoices={invoices} today={today} />;
      case 'accounts-payable':
        return <AccountsPayable expenses={expenses} today={today} />;
      case 'budget-vs-actual':
        return <BudgetVsActual budgets={budgets} expenses={expenses} dateRange={dateRange} />;
      case 'bank-reconciliation-status':
        return (
          <BankReconciliationStatusReport
            accounts={accounts}
            journalEntries={allJournalEntries}
            paidInvoices={allPaidInvoices}
            paidExpenses={allPaidExpenses}
            reconciliations={reconciliations}
            statementLines={statementLines}
            dateRange={dateRange}
            onNavigateToReconciliation={onNavigateToReconciliation}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveReport('trial-balance')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'trial-balance' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Trial Balance
          </button>
          <button 
            onClick={() => setActiveReport('balance-sheet')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'balance-sheet' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Balance Sheet
          </button>
          <button 
            onClick={() => setActiveReport('income-statement')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'income-statement' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Income Statement
          </button>
          <button 
            onClick={() => setActiveReport('accounts-receivable')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'accounts-receivable' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Accounts Receivable
          </button>
          <button 
            onClick={() => setActiveReport('accounts-payable')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'accounts-payable' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Accounts Payable
          </button>
          <button 
            onClick={() => setActiveReport('budget-vs-actual')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'budget-vs-actual' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Budget vs Actual
          </button>
          <button 
            onClick={() => setActiveReport('bank-reconciliation-status')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeReport === 'bank-reconciliation-status' ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Bank Reconciliation Status
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={18} />
            Export CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
          >
            <Download size={18} />
            Download PDF
          </button>

          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 px-3">
              <Clock size={14} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</span>
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer pr-2"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid/Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 px-3">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period:</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none"
              />
              <span className="text-slate-300">to</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-10 rounded-[32px] border border-slate-200 shadow-sm min-h-[600px]">
        {renderReport()}
      </div>

      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportCSV}
        currentDateRange={dateRange}
        currentStatus={statusFilter}
        reportType={activeReport}
      />
    </div>
  );
}

function BudgetVsActual({ budgets, expenses, dateRange }: { budgets: Budget[], expenses: Expense[], dateRange: { start: string, end: string } }) {
  const categories = Array.from(new Set([...budgets.map(b => b.category), ...expenses.map(e => e.category)]));
  
  const reportData = categories.map(cat => {
    const budget = budgets.filter(b => b.category === cat).reduce((sum, b) => sum + b.limit_amount, 0);
    const actual = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    const remaining = budget - actual;
    const utilization = budget > 0 ? (actual / budget) * 100 : 0;
    
    return {
      category: cat,
      budget,
      actual,
      remaining,
      utilization
    };
  }).sort((a, b) => b.actual - a.actual);

  const totalBudget = reportData.reduce((sum, d) => sum + d.budget, 0);
  const totalActual = reportData.reduce((sum, d) => sum + d.actual, 0);
  const totalRemaining = totalBudget - totalActual;
  const totalUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Budget vs. Actual Spending</h2>
        <p className="text-slate-400 text-sm font-medium">For the period {dateRange.start} to {dateRange.end}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Budget</p>
          <p className="text-3xl font-black text-jamaica-black tracking-tighter">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100">
          <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Total Actual</p>
          <p className="text-3xl font-black text-brand-600 tracking-tighter">{formatCurrency(totalActual)}</p>
        </div>
        <div className={cn(
          "p-6 rounded-3xl border",
          totalRemaining >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
        )}>
          <p className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-1",
            totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>Total Remaining</p>
          <p className={cn(
            "text-3xl font-black tracking-tighter",
            totalRemaining >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Category Breakdown</h3>
        <div className="border border-slate-100 rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Budget</th>
                <th className="px-6 py-4 text-right">Actual</th>
                <th className="px-6 py-4 text-right">Remaining</th>
                <th className="px-6 py-4 text-center w-48">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">No budget or expense data found.</td>
                </tr>
              ) : (
                reportData.map(data => (
                  <tr key={data.category} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-jamaica-black uppercase tracking-tight">{data.category}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-500 tabular-nums">
                      {formatCurrency(data.budget)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-jamaica-black tabular-nums">
                      {formatCurrency(data.actual)}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right text-sm font-bold tabular-nums",
                      data.remaining >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatCurrency(data.remaining)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                          <span className={cn(
                            data.utilization > 100 ? "text-rose-600" : "text-slate-400"
                          )}>{data.utilization.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(data.utilization, 100)}%` }}
                            className={cn(
                              "h-full rounded-full",
                              data.utilization > 100 ? "bg-rose-500" : 
                              data.utilization > 85 ? "bg-amber-500" : "bg-brand-500"
                            )}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {reportData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/50 border-t-2 border-slate-900 font-black">
                  <td className="px-6 py-4 text-xs uppercase tracking-widest text-jamaica-black">Total</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums">{formatCurrency(totalBudget)}</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums">{formatCurrency(totalActual)}</td>
                  <td className={cn(
                    "px-6 py-4 text-right text-sm tabular-nums",
                    totalRemaining >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>{formatCurrency(totalRemaining)}</td>
                  <td className="px-6 py-4 text-center text-xs uppercase tracking-widest">
                    {totalUtilization.toFixed(1)}% Utilized
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function TrialBalance({
  accounts,
  journalEntries,
  dateRange,
}: {
  accounts: Account[];
  journalEntries: JournalEntry[];
  dateRange: { start: string; end: string };
}) {
  // For Trial Balance integrity, compute cumulative Revenue & Expense up to dateRange.end
  // alongside cumulative Asset, Liability, and Equity balances.
  const cumulativeAccounts = accounts.map((acc) => {
    if (acc.type !== 'Revenue' && acc.type !== 'Expense') return acc;
    const allPostedBeforeOrOnEnd = journalEntries.filter(
      (e) => e.status === 'Posted' && (!dateRange.end || e.date <= dateRange.end)
    );
    const allPostedAfterEnd = journalEntries.filter(
      (e) => e.status === 'Posted' && dateRange.end && e.date > dateRange.end
    );
    const fullAccount = dataService.getAccounts().find((a) => a.id === acc.id);
    if (!fullAccount) return acc;

    let afterAdjustment = 0;
    allPostedAfterEnd.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.account_id === acc.id) {
          afterAdjustment +=
            acc.type === 'Expense' ? line.debit - line.credit : line.credit - line.debit;
        }
      });
    });

    if (allPostedBeforeOrOnEnd.length === 0 && afterAdjustment === 0) {
      return { ...acc, balance: fullAccount.balance };
    }
    return { ...acc, balance: fullAccount.balance - afterAdjustment };
  });

  const sortedAccounts = [...cumulativeAccounts].sort((a, b) => a.code.localeCompare(b.code));

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = sortedAccounts.map((account) => {
    const isDebit = account.type === 'Asset' || account.type === 'Expense';
    const debit = isDebit ? Math.max(0, account.balance) : Math.max(0, -account.balance);
    const credit = isDebit ? Math.max(0, -account.balance) : Math.max(0, account.balance);
    totalDebit += debit;
    totalCredit += credit;
    return { account, debit, credit };
  });

  const variance = totalDebit - totalCredit;
  const isBalanced = Math.abs(variance) < 0.01;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Trial Balance</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Cumulative balances as of {dateRange.end}</p>
        </div>

        <div
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold',
            isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          )}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-600" />
              Double-Entry Verified · Debits Equal Credits
            </>
          ) : (
            <>
              <AlertCircle size={15} className="text-amber-700" />
              Out of Balance by {formatCurrency(Math.abs(variance))}
            </>
          )}
        </div>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-4 text-xs font-black text-jamaica-black uppercase tracking-widest">Account</th>
            <th className="py-4 text-xs font-black text-jamaica-black uppercase tracking-widest text-right w-40">Debit</th>
            <th className="py-4 text-xs font-black text-jamaica-black uppercase tracking-widest text-right w-40">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ account, debit, credit }) => {
            if (debit === 0 && credit === 0) return null;

            return (
              <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400">{account.code}</span>
                    <span className="text-sm font-black text-jamaica-black uppercase tracking-tight">{account.name}</span>
                  </div>
                </td>
                <td className="py-4 text-right text-sm font-bold font-mono tabular-nums">
                  {debit > 0 ? formatCurrency(debit) : '-'}
                </td>
                <td className="py-4 text-right text-sm font-bold font-mono tabular-nums">
                  {credit > 0 ? formatCurrency(credit) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-900 font-black">
            <td className="py-6 text-sm uppercase tracking-widest text-jamaica-black">Total</td>
            <td className="py-6 text-right text-sm font-mono tabular-nums border-b-4 border-double border-slate-900">
              {formatCurrency(totalDebit)}
            </td>
            <td className="py-6 text-right text-sm font-mono tabular-nums border-b-4 border-double border-slate-900">
              {formatCurrency(totalCredit)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BalanceSheet({ accounts, dateRange }: { accounts: Account[]; dateRange: { start: string; end: string } }) {
  const assets = accounts.filter(a => a.type === 'Asset');
  const liabilities = accounts.filter(a => a.type === 'Liability');
  const equity = accounts.filter(a => a.type === 'Equity');
  const totalRevenue = accounts.filter(a => a.type === 'Revenue').reduce((s, a) => s + a.balance, 0);
  const totalExpenses = accounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);
  const currentPeriodNetIncome = totalRevenue - totalExpenses;

  const totalAssets = assets.reduce((acc, curr) => acc + curr.balance, 0);
  const totalLiabilities = liabilities.reduce((acc, curr) => acc + curr.balance, 0);
  const totalEquity = equity.reduce((acc, curr) => acc + curr.balance, 0) + currentPeriodNetIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const equationDifference = totalAssets - totalLiabilitiesAndEquity;
  const isBalanced = Math.abs(equationDifference) < 0.01;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Balance Sheet</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">As of {dateRange.end}</p>
        </div>

        <div
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold',
            isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          )}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-600" />
              Accounting Equation Balanced (Assets = L + E)
            </>
          ) : (
            <>
              <AlertCircle size={15} className="text-amber-700" />
              Equation Variance: {formatCurrency(Math.abs(equationDifference))}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Assets */}
        <div className="space-y-6">
          <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Assets</h3>
          <div className="space-y-4">
            {assets.map(acc => (
              <div key={acc.id} className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600 uppercase">{acc.name}</span>
                <span className="text-sm font-black font-mono tabular-nums">{formatCurrency(acc.balance)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-black">
            <span className="text-sm uppercase tracking-widest">Total Assets</span>
            <span className="text-sm font-mono tabular-nums border-b-2 border-slate-900">{formatCurrency(totalAssets)}</span>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="space-y-10">
          <div className="space-y-6">
            <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Liabilities</h3>
            <div className="space-y-4">
              {liabilities.map(acc => (
                <div key={acc.id} className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 uppercase">{acc.name}</span>
                  <span className="text-sm font-black font-mono tabular-nums">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-black">
              <span className="text-sm uppercase tracking-widest">Total Liabilities</span>
              <span className="text-sm font-mono tabular-nums">{formatCurrency(totalLiabilities)}</span>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Equity</h3>
            <div className="space-y-4">
              {equity.map(acc => (
                <div key={acc.id} className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 uppercase">{acc.name}</span>
                  <span className="text-sm font-black font-mono tabular-nums">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600 uppercase">Current Period Net Income</span>
                <span className={cn('text-sm font-black font-mono tabular-nums', currentPeriodNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                  {formatCurrency(currentPeriodNetIncome)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-black">
              <span className="text-sm uppercase tracking-widest text-slate-500">Total Equity</span>
              <span className="text-sm font-mono tabular-nums">{formatCurrency(totalEquity)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t-2 border-slate-900 font-black bg-slate-50 p-4 rounded-2xl">
            <span className="text-sm uppercase tracking-widest">Total Liabilities & Equity</span>
            <span className="text-sm font-mono tabular-nums border-b-2 border-slate-900">{formatCurrency(totalLiabilitiesAndEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomeStatement({ accounts, dateRange }: { accounts: Account[], dateRange: { start: string, end: string } }) {
  const revenue = accounts.filter(a => a.type === 'Revenue' && a.balance !== 0);
  const cogs = accounts.filter(a => (a.name.toLowerCase().includes('cost of goods sold') || a.code.startsWith('50')) && a.balance !== 0);
  const otherExpenses = accounts.filter(a => a.type === 'Expense' && !cogs.find(c => c.id === a.id) && a.balance !== 0);

  const totalRevenue = revenue.reduce((acc, curr) => acc + curr.balance, 0);
  const totalCogs = cogs.reduce((acc, curr) => acc + curr.balance, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalOtherExpenses = otherExpenses.reduce((acc, curr) => acc + curr.balance, 0);
  const netIncome = grossProfit - totalOtherExpenses;
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  if (revenue.length === 0 && cogs.length === 0 && otherExpenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
          <FileText size={32} />
        </div>
        <div>
          <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight">No Activity Found</h3>
          <p className="text-slate-400 text-sm font-medium">There are no revenue or expense transactions for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Income Statement</h2>
        <p className="text-slate-400 text-sm font-medium">For the period {dateRange.start} to {dateRange.end}</p>
      </div>

      <div className="space-y-10">
        {/* Revenue */}
        {revenue.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Revenue</h3>
            <div className="space-y-4">
              {revenue.map(acc => (
                <div key={acc.id} className="flex justify-between items-center group">
                  <span className="text-sm font-bold text-slate-600 uppercase group-hover:text-brand-600 transition-colors">{acc.name}</span>
                  <span className="text-sm font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-black">
              <span className="text-sm uppercase tracking-widest">Total Revenue</span>
              <span className="text-sm tabular-nums">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        )}

        {/* COGS & Gross Profit */}
        {cogs.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Cost of Goods Sold</h3>
            <div className="space-y-4">
              {cogs.map(acc => (
                <div key={acc.id} className="flex justify-between items-center group">
                  <span className="text-sm font-bold text-slate-600 uppercase group-hover:text-rose-600 transition-colors">{acc.name}</span>
                  <span className="text-sm font-black tabular-nums">({formatCurrency(acc.balance)})</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900 font-black bg-slate-50 p-4 rounded-2xl">
              <span className="text-sm uppercase tracking-widest">Gross Profit</span>
              <span className="text-sm tabular-nums">{formatCurrency(grossProfit)}</span>
            </div>
          </div>
        )}

        {/* Operating Expenses */}
        {otherExpenses.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-jamaica-black uppercase tracking-tight border-b-2 border-slate-900 pb-2">Operating Expenses</h3>
            <div className="space-y-4">
              {otherExpenses.map(acc => (
                <div key={acc.id} className="flex justify-between items-center group">
                  <span className="text-sm font-bold text-slate-600 uppercase group-hover:text-rose-600 transition-colors">{acc.name}</span>
                  <span className="text-sm font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 font-black">
              <span className="text-sm uppercase tracking-widest text-slate-400">Total Operating Expenses</span>
              <span className="text-sm tabular-nums">({formatCurrency(totalOtherExpenses)})</span>
            </div>
          </div>
        )}

        {/* Net Income */}
        <div className={cn(
          "flex justify-between items-center pt-8 border-t-4 border-double border-slate-900 font-black p-6 rounded-[32px] shadow-sm",
          netIncome >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
        )}>
          <div className="flex flex-col">
            <span className="text-xl uppercase tracking-tighter">Net Income</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest opacity-60">Profit / (Loss)</span>
              <span className="text-[10px] px-2 py-0.5 bg-white/50 rounded-full font-bold">
                Margin: {profitMargin.toFixed(1)}%
              </span>
            </div>
          </div>
          <span className="text-2xl tabular-nums">{formatCurrency(netIncome)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountsReceivable({ invoices, today }: { invoices: Invoice[], today: string }) {
  const unpaidInvoices = invoices.filter(i => i.status !== 'Paid');
  const totalOutstanding = unpaidInvoices.reduce((acc, curr) => acc + getInvoiceRemaining(curr), 0);
  const overdueInvoices = unpaidInvoices.filter(i => i.status === 'Overdue' || i.due_date < today);
  const totalOverdue = overdueInvoices.reduce((acc, curr) => acc + getInvoiceRemaining(curr), 0);

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Accounts Receivable</h2>
        <p className="text-slate-400 text-sm font-medium">Outstanding payments from clients</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
          <p className="text-3xl font-black text-jamaica-black tracking-tighter">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Overdue</p>
          <p className="text-3xl font-black text-rose-600 tracking-tighter">{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Invoices</h3>
        <div className="border border-slate-100 rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">No invoices found for the selected filters.</td>
                </tr>
              ) : (
                invoices.map(invoice => {
                  const isOverdue = invoice.status === 'Overdue' || (invoice.status !== 'Paid' && invoice.due_date < today);
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{invoice.id}</td>
                      <td className="px-6 py-4 text-sm font-black text-jamaica-black uppercase tracking-tight">{invoice.client_name}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">{invoice.due_date}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          invoice.status === 'Paid' ? "bg-emerald-50 text-emerald-600" :
                          isOverdue ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {isOverdue && invoice.status !== 'Paid' ? 'Overdue' : invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums">
                        {formatCurrency(invoice.status === 'Paid' ? invoice.amount + (invoice.tax_amount || 0) : getInvoiceRemaining(invoice))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {invoices.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/50 border-t-2 border-slate-900 font-black">
                  <td colSpan={4} className="px-6 py-4 text-xs uppercase tracking-widest text-jamaica-black">Total</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums border-b-4 border-double border-slate-900">
                    {formatCurrency(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function AccountsPayable({ expenses, today }: { expenses: Expense[], today: string }) {
  const totalOutstanding = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const overdueExpenses = expenses.filter(e => e.status === 'Overdue' || (e.status !== 'Paid' && e.due_date && e.due_date < today));
  const totalOverdue = overdueExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">Accounts Payable</h2>
        <p className="text-slate-400 text-sm font-medium">Money owed to suppliers and vendors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
          <p className="text-3xl font-black text-jamaica-black tracking-tighter">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Overdue</p>
          <p className="text-3xl font-black text-rose-600 tracking-tighter">{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bills</h3>
        <div className="border border-slate-100 rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-center">Recurring</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">No bills found for the selected filters.</td>
                </tr>
              ) : (
                expenses.map(expense => {
                  const isOverdue = expense.status === 'Overdue' || (expense.status !== 'Paid' && expense.due_date && expense.due_date < today);
                  return (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-jamaica-black uppercase tracking-tight">{expense.description || 'No description'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">{expense.due_date || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {expense.is_recurring ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-tighter">{expense.frequency}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{expense.duration_months}m</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          expense.status === 'Paid' ? "bg-emerald-50 text-emerald-600" :
                          isOverdue ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {isOverdue && expense.status !== 'Paid' ? 'Overdue' : expense.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums">
                        {formatCurrency(expense.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/50 border-t-2 border-slate-900 font-black">
                  <td colSpan={5} className="px-6 py-4 text-xs uppercase tracking-widest text-jamaica-black">Total</td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums border-b-4 border-double border-slate-900">
                    {formatCurrency(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

interface AccountReconciliationSummary {
  account: Account;
  lastReconciledDate: string | null;
  lastReconciledBalance: number | null;
  hasDraft: boolean;
  unreconciledItems: UnreconciledTxItem[];
  unreconciledDeposits: number;
  unreconciledWithdrawals: number;
  netUnreconciled: number;
  unmatchedStatementLines: BankStatementLine[];
}

function buildAccountReconciliationSummaries({
  accounts,
  journalEntries,
  paidInvoices,
  paidExpenses,
  reconciliations,
  statementLines,
  dateRange,
}: {
  accounts: Account[];
  journalEntries: JournalEntry[];
  paidInvoices: Invoice[];
  paidExpenses: Expense[];
  reconciliations: ReconciliationRecord[];
  statementLines: BankStatementLine[];
  dateRange: { start: string; end: string };
}): AccountReconciliationSummary[] {
  const assetAccounts = accounts.filter((a) => a.type === 'Asset');
  const targetAccounts = assetAccounts.length > 0 ? assetAccounts : accounts;
  const primaryCashId =
    (
      targetAccounts.find((a) => a.code === '1000' || a.code === '1010') ||
      targetAccounts[0]
    )?.id || '';

  return targetAccounts.map((account) => {
    const accountReconciliations = reconciliations.filter((r) => r.account_id === account.id);
    const completedRecs = accountReconciliations
      .filter((r) => r.status === 'Completed')
      .sort((a, b) => b.statement_date.localeCompare(a.statement_date));
    const draftRecs = accountReconciliations.filter((r) => r.status === 'Draft');

    const lockedIds = new Set<string>();
    completedRecs.forEach((rec) => rec.cleared_item_ids.forEach((id) => lockedIds.add(id)));

    const draftClearedIds = new Set<string>();
    draftRecs.forEach((rec) => rec.cleared_item_ids.forEach((id) => draftClearedIds.add(id)));

    const unreconciledItems: UnreconciledTxItem[] = [];

    journalEntries
      .filter(
        (entry) =>
          entry.status === 'Posted' &&
          (!dateRange.start || entry.date >= dateRange.start) &&
          (!dateRange.end || entry.date <= dateRange.end)
      )
      .forEach((entry) => {
        entry.lines.forEach((line) => {
          if (line.account_id === account.id && (line.debit > 0 || line.credit > 0)) {
            const itemId = `JE:${entry.id}:${line.id}`;
            if (lockedIds.has(itemId)) return;
            const isDeposit = line.debit >= line.credit;
            const amt = isDeposit ? line.debit - line.credit : line.credit - line.debit;
            if (amt > 0) {
              unreconciledItems.push({
                id: itemId,
                accountId: account.id,
                accountLabel: `${account.code} · ${account.name}`,
                date: entry.date,
                source: 'Journal Entry',
                reference: entry.id,
                description: line.description || entry.description || 'Journal entry',
                type: isDeposit ? 'Deposit' : 'Withdrawal',
                amount: amt,
                inDraft: draftClearedIds.has(itemId),
              });
            }
          }
        });
      });

    if (account.id === primaryCashId) {
      paidInvoices
        .filter(
          (inv) =>
            (!dateRange.start || inv.date >= dateRange.start) &&
            (!dateRange.end || inv.date <= dateRange.end)
        )
        .forEach((inv) => {
          const itemId = `INV:${inv.id}`;
          if (lockedIds.has(itemId)) return;
          unreconciledItems.push({
            id: itemId,
            accountId: account.id,
            accountLabel: `${account.code} · ${account.name}`,
            date: inv.date,
            source: 'Paid Invoice',
            reference: inv.id,
            description: `${inv.client_name}${inv.description ? ` — ${inv.description}` : ''}`,
            type: 'Deposit',
            amount: Number(inv.amount || 0),
            inDraft: draftClearedIds.has(itemId),
          });
        });

      paidExpenses
        .filter(
          (exp) =>
            (!dateRange.start || exp.date >= dateRange.start) &&
            (!dateRange.end || exp.date <= dateRange.end)
        )
        .forEach((exp) => {
          const itemId = `EXP:${exp.id}`;
          if (lockedIds.has(itemId)) return;
          unreconciledItems.push({
            id: itemId,
            accountId: account.id,
            accountLabel: `${account.code} · ${account.name}`,
            date: exp.date,
            source: 'Paid Expense',
            reference: exp.id,
            description: `${exp.category}${exp.description ? ` — ${exp.description}` : ''}`,
            type: 'Withdrawal',
            amount: Number(exp.amount || 0),
            inDraft: draftClearedIds.has(itemId),
          });
        });
    }

    unreconciledItems.sort((a, b) => b.date.localeCompare(a.date));

    const unreconciledDeposits = unreconciledItems
      .filter((i) => i.type === 'Deposit')
      .reduce((sum, i) => sum + i.amount, 0);
    const unreconciledWithdrawals = unreconciledItems
      .filter((i) => i.type === 'Withdrawal')
      .reduce((sum, i) => sum + i.amount, 0);

    const unmatchedStatementLines = statementLines.filter(
      (line) =>
        line.account_id === account.id &&
        line.status === 'Unmatched' &&
        !line.reconciliation_id &&
        (!dateRange.start || line.date >= dateRange.start) &&
        (!dateRange.end || line.date <= dateRange.end)
    );

    return {
      account,
      lastReconciledDate: completedRecs[0]?.statement_date || null,
      lastReconciledBalance: completedRecs[0]?.statement_ending_balance ?? null,
      hasDraft: draftRecs.length > 0,
      unreconciledItems,
      unreconciledDeposits,
      unreconciledWithdrawals,
      netUnreconciled: unreconciledDeposits - unreconciledWithdrawals,
      unmatchedStatementLines,
    };
  });
}

export function BankReconciliationStatusReport({
  accounts,
  journalEntries,
  paidInvoices,
  paidExpenses,
  reconciliations,
  statementLines,
  dateRange,
  onNavigateToReconciliation,
}: {
  accounts: Account[];
  journalEntries: JournalEntry[];
  paidInvoices: Invoice[];
  paidExpenses: Expense[];
  reconciliations: ReconciliationRecord[];
  statementLines: BankStatementLine[];
  dateRange: { start: string; end: string };
  onNavigateToReconciliation?: () => void;
}) {
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');

  const summaries = buildAccountReconciliationSummaries({
    accounts,
    journalEntries,
    paidInvoices,
    paidExpenses,
    reconciliations,
    statementLines,
    dateRange,
  });

  const visibleSummaries =
    selectedAccountFilter === 'all'
      ? summaries
      : summaries.filter((s) => s.account.id === selectedAccountFilter);

  const totalUnreconciledCount = summaries.reduce((sum, s) => sum + s.unreconciledItems.length, 0);
  const totalUnreconciledDeposits = summaries.reduce((sum, s) => sum + s.unreconciledDeposits, 0);
  const totalUnreconciledWithdrawals = summaries.reduce((sum, s) => sum + s.unreconciledWithdrawals, 0);
  const totalUnmatchedBankLines = summaries.reduce(
    (sum, s) => sum + s.unmatchedStatementLines.length,
    0
  );
  const accountsNeedingAttention = summaries.filter(
    (s) => s.unreconciledItems.length > 0 || s.unmatchedStatementLines.length > 0
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-jamaica-black uppercase tracking-tighter">
            Bank Reconciliation Status
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Unreconciled book transactions and unmatched statement lines per account for {dateRange.start} to {dateRange.end}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedAccountFilter}
            onChange={(e) => setSelectedAccountFilter(e.target.value)}
            aria-label="Filter by account"
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">All Asset / Bank Accounts ({summaries.length})</option>
            {summaries.map((s) => (
              <option key={s.account.id} value={s.account.id}>
                {s.account.code} · {s.account.name} ({s.unreconciledItems.length} open)
              </option>
            ))}
          </select>

          {onNavigateToReconciliation && (
            <button
              type="button"
              onClick={onNavigateToReconciliation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Scale size={14} />
              Open Bank Reconciliation
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Accounts Needing Action</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {accountsNeedingAttention} / {summaries.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totalUnmatchedBankLines} unmatched statement lines
          </p>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Unreconciled Transactions</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {totalUnreconciledCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Open book items in selected period</p>
        </div>

        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-800">Unreconciled Deposits</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatCurrency(totalUnreconciledDeposits)}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">Cash inflows awaiting clearing</p>
        </div>

        <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200">
          <p className="text-xs font-semibold text-rose-800">Unreconciled Withdrawals</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatCurrency(totalUnreconciledWithdrawals)}
          </p>
          <p className="mt-1 text-xs text-rose-800/80">Outflows & expenses awaiting clearing</p>
        </div>
      </div>

      {/* Per-Account Sections */}
      {visibleSummaries.length === 0 ? (
        <div className="py-14 px-6 text-center border border-slate-200 rounded-2xl space-y-2">
          <Scale size={30} className="mx-auto text-slate-400" />
          <p className="text-base font-bold text-slate-900">No Asset or Bank accounts found</p>
          <p className="text-sm text-slate-500">
            Add a bank or cash account in Chart of Accounts to monitor monthly reconciliation readiness.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSummaries.map((summary) => {
            const isClean =
              summary.unreconciledItems.length === 0 &&
              summary.unmatchedStatementLines.length === 0;

            return (
              <section
                key={summary.account.id}
                className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
              >
                {/* Account Header Bar */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {summary.account.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {summary.account.name}
                      </h3>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-bold',
                          isClean ? 'text-emerald-700' : 'text-amber-700'
                        )}
                      >
                        {isClean ? (
                          <>
                            <CheckCircle2 size={14} />
                            Balanced for Period
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} />
                            {summary.unreconciledItems.length} Unreconciled
                            {summary.unmatchedStatementLines.length > 0
                              ? ` · ${summary.unmatchedStatementLines.length} Unmatched Bank Lines`
                              : ''}
                          </>
                        )}
                      </span>
                      {summary.hasDraft && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-brand-700">
                            Draft in Progress
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      Book Balance:{' '}
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {formatCurrency(summary.account.balance)}
                      </span>
                      {' · '}
                      {summary.lastReconciledDate
                        ? `Last reconciled ${summary.lastReconciledDate} (${formatCurrency(summary.lastReconciledBalance || 0)})`
                        : 'No completed reconciliations recorded yet'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-500 font-sans">Open Inflows: </span>
                      <span className="font-bold text-emerald-700">
                        +{formatCurrency(summary.unreconciledDeposits)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans">Open Outflows: </span>
                      <span className="font-bold text-rose-700">
                        -{formatCurrency(summary.unreconciledWithdrawals)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans">Net Open: </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(summary.netUnreconciled)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Unreconciled Transactions Table */}
                {summary.unreconciledItems.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-slate-500">
                    No unreconciled book transactions in this period for {summary.account.name}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 px-6 whitespace-nowrap">Date</th>
                          <th className="py-2.5 px-4 whitespace-nowrap">Source</th>
                          <th className="py-2.5 px-4">Description & Reference</th>
                          <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                          <th className="py-2.5 px-4 text-right whitespace-nowrap">Withdrawal</th>
                          <th className="py-2.5 px-6 text-right whitespace-nowrap">Deposit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {summary.unreconciledItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-6 font-mono text-xs tabular-nums whitespace-nowrap text-slate-700">
                              {item.date}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                              {item.source}
                            </td>
                            <td className="py-2.5 px-4">
                              <p className="font-semibold text-slate-900">{item.description}</p>
                              <p className="text-xs font-mono text-slate-500">Ref: {item.reference}</p>
                            </td>
                            <td className="py-2.5 px-4 text-xs font-semibold whitespace-nowrap">
                              {item.inDraft ? (
                                <span className="text-brand-700">Cleared in Draft</span>
                              ) : (
                                <span className="text-amber-700">Needs Clearing</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums font-semibold text-rose-700 whitespace-nowrap">
                              {item.type === 'Withdrawal' ? formatCurrency(item.amount) : '—'}
                            </td>
                            <td className="py-2.5 px-6 text-right font-mono text-xs tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                              {item.type === 'Deposit' ? formatCurrency(item.amount) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Unmatched Bank Statement Lines if present */}
                {summary.unmatchedStatementLines.length > 0 && (
                  <div className="border-t border-amber-200 bg-amber-50/40 px-6 py-4 space-y-2">
                    <p className="text-xs font-bold text-amber-900">
                      Unmatched Bank Statement Lines ({summary.unmatchedStatementLines.length}) — Missing from Books
                    </p>
                    <div className="divide-y divide-amber-200/60">
                      {summary.unmatchedStatementLines.map((line) => (
                        <div
                          key={line.id}
                          className="py-1.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono tabular-nums text-amber-900 shrink-0">
                              {line.date}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {line.description}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-amber-900 shrink-0">
                            {line.type === 'Withdrawal' ? '-' : '+'}
                            {formatCurrency(line.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

