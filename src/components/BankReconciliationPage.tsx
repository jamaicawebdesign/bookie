import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import {
  Scale,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Download,
  Trash2,
  Wand2,
  FileSpreadsheet,
  History,
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  Lock,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import {
  Account,
  BankStatementLine,
  Expense,
  Invoice,
  JournalEntry,
  ReconciliationRecord,
} from '../types';
import { cn, formatCurrency, formatLocalDate, parseLocalDate, sanitizeCsvCell } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

type ReconcileTab = 'register' | 'statement' | 'history';
type RegisterSourceFilter = 'all' | 'journal' | 'cashflow';
type RegisterTypeFilter = 'all' | 'Deposit' | 'Withdrawal';

interface BookRegisterItem {
  id: string;
  date: string;
  source: 'Journal Entry' | 'Paid Invoice' | 'Paid Expense';
  reference: string;
  description: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  alreadyReconciledId?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeStatementDate(raw: string): string {
  const trimmed = (raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    let year: number;
    let month: number;
    let day: number;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (month > 12 && day <= 12) {
        const tmp = month;
        month = day;
        day = tmp;
      }
    } else {
      return formatLocalDate();
    }
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalDate(parsed);
    }
  }
  return formatLocalDate();
}

function parseNumericAmount(raw?: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementDate, setStatementDate] = useState<string>(formatLocalDate());
  const [beginningBalanceInput, setBeginningBalanceInput] = useState<string>('0.00');
  const [statementEndingInput, setStatementEndingInput] = useState<string>('0.00');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ReconcileTab>('register');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<RegisterSourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<RegisterTypeFilter>('all');
  const [hidePreviouslyReconciled, setHidePreviouslyReconciled] = useState<boolean>(true);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Manual bank statement line modal state
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [manualLineDate, setManualLineDate] = useState(formatLocalDate());
  const [manualLineDesc, setManualLineDesc] = useState('');
  const [manualLineRef, setManualLineRef] = useState('');
  const [manualLineType, setManualLineType] = useState<'Deposit' | 'Withdrawal'>('Withdrawal');
  const [manualLineAmount, setManualLineAmount] = useState('');

  // Adjusting journal entry modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingStatementLineId, setAdjustingStatementLineId] = useState<string | null>(null);
  const [adjustDate, setAdjustDate] = useState(formatLocalDate());
  const [adjustDescription, setAdjustDescription] = useState('Bank Service Charge');
  const [adjustDirection, setAdjustDirection] = useState<'Withdrawal' | 'Deposit'>('Withdrawal');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustOffsetAccountId, setAdjustOffsetAccountId] = useState('');

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'reconciliation' | 'line'; id: string } | null>(null);

  const loadWorkspaceData = useCallback(() => {
    const allAccounts = dataService.getAccounts();
    setAccounts(allAccounts);
    setJournalEntries(dataService.getJournalEntries());
    setInvoices(dataService.getInvoices());
    setExpenses(dataService.getExpenses());
    setStatementLines(dataService.getBankStatementLines());
    setReconciliations(dataService.getReconciliations());

    setSelectedAccountId((prev) => {
      if (prev && allAccounts.some((a) => a.id === prev)) return prev;
      const primaryCash =
        allAccounts.find((a) => a.type === 'Asset' && (a.code === '1000' || a.code === '1010')) ||
        allAccounts.find((a) => a.type === 'Asset') ||
        allAccounts[0];
      return primaryCash?.id || '';
    });
  }, []);

  useEffect(() => {
    loadWorkspaceData();
    window.addEventListener('island-data-synced', loadWorkspaceData);
    return () => window.removeEventListener('island-data-synced', loadWorkspaceData);
  }, [loadWorkspaceData]);

  const assetAccounts = useMemo(() => {
    const assets = accounts.filter((a) => a.type === 'Asset');
    return assets.length > 0 ? assets : accounts;
  }, [accounts]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || assetAccounts[0] || null,
    [accounts, assetAccounts, selectedAccountId]
  );

  const primaryCashAccountId = useMemo(() => {
    const cash =
      accounts.find((a) => a.type === 'Asset' && (a.code === '1000' || a.code === '1010')) ||
      accounts.find((a) => a.type === 'Asset');
    return cash?.id || '';
  }, [accounts]);

  const offsetAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== selectedAccount?.id);
  }, [accounts, selectedAccount]);

  useEffect(() => {
    if (!adjustOffsetAccountId && offsetAccounts.length > 0) {
      const expenseAcc =
        offsetAccounts.find((a) => a.type === 'Expense') || offsetAccounts[0];
      setAdjustOffsetAccountId(expenseAcc?.id || '');
    }
  }, [offsetAccounts, adjustOffsetAccountId]);

  // Seed beginning & ending defaults when switching bank accounts (unless loading a draft)
  useEffect(() => {
    if (!selectedAccount || activeDraftId) return;
    const completedForAccount = reconciliations
      .filter((r) => r.account_id === selectedAccount.id && r.status === 'Completed')
      .sort((a, b) => b.statement_date.localeCompare(a.statement_date));

    if (completedForAccount.length > 0) {
      setBeginningBalanceInput(completedForAccount[0].statement_ending_balance.toFixed(2));
    } else {
      setBeginningBalanceInput(selectedAccount.balance.toFixed(2));
    }
    setStatementEndingInput(selectedAccount.balance.toFixed(2));
    setClearedIds(new Set());
  }, [selectedAccount?.id]);

  // Map of book item IDs already reconciled in Completed reconciliations for this account
  const previouslyReconciledMap = useMemo(() => {
    const map = new Map<string, string>();
    reconciliations
      .filter((r) => r.account_id === selectedAccount?.id && r.status === 'Completed')
      .forEach((rec) => {
        rec.cleared_item_ids.forEach((itemId) => {
          map.set(itemId, rec.id);
        });
      });
    return map;
  }, [reconciliations, selectedAccount]);

  // Build unified book register for the selected bank/cash account
  const bookItems: BookRegisterItem[] = useMemo(() => {
    if (!selectedAccount) return [];
    const items: BookRegisterItem[] = [];

    // 1. Posted Journal Entries hitting selectedAccount.id
    journalEntries
      .filter((entry) => entry.status === 'Posted')
      .forEach((entry) => {
        entry.lines.forEach((line) => {
          if (line.account_id === selectedAccount.id && (line.debit > 0 || line.credit > 0)) {
            const isDeposit = line.debit >= line.credit;
            const amt = isDeposit ? line.debit - line.credit : line.credit - line.debit;
            if (amt > 0) {
              const itemId = `JE:${entry.id}:${line.id}`;
              items.push({
                id: itemId,
                date: entry.date,
                source: 'Journal Entry',
                reference: entry.id,
                description: line.description || entry.description || 'Journal entry',
                type: isDeposit ? 'Deposit' : 'Withdrawal',
                amount: amt,
                alreadyReconciledId: previouslyReconciledMap.get(itemId),
              });
            }
          }
        });
      });

    // 2. For primary cash/bank account, include Paid Invoices & Paid Expenses directly
    if (selectedAccount.id === primaryCashAccountId) {
      invoices
        .filter((inv) => inv.status === 'Paid')
        .forEach((inv) => {
          const itemId = `INV:${inv.id}`;
          items.push({
            id: itemId,
            date: inv.date,
            source: 'Paid Invoice',
            reference: inv.id,
            description: `${inv.client_name}${inv.description ? ` — ${inv.description}` : ''}`,
            type: 'Deposit',
            amount: Number(inv.amount || 0),
            alreadyReconciledId: previouslyReconciledMap.get(itemId),
          });
        });

      expenses
        .filter((exp) => exp.status === 'Paid')
        .forEach((exp) => {
          const itemId = `EXP:${exp.id}`;
          items.push({
            id: itemId,
            date: exp.date,
            source: 'Paid Expense',
            reference: exp.id,
            description: `${exp.category}${exp.description ? ` — ${exp.description}` : ''}`,
            type: 'Withdrawal',
            amount: Number(exp.amount || 0),
            alreadyReconciledId: previouslyReconciledMap.get(itemId),
          });
        });
    }

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [
    selectedAccount,
    primaryCashAccountId,
    journalEntries,
    invoices,
    expenses,
    previouslyReconciledMap,
  ]);

  const accountStatementLines = useMemo(() => {
    if (!selectedAccount) return [];
    return statementLines
      .filter((line) => line.account_id === selectedAccount.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [statementLines, selectedAccount]);

  const matchedBookMap = useMemo(() => {
    const map = new Map<string, BankStatementLine>();
    accountStatementLines.forEach((line) => {
      if (line.matched_book_id) {
        map.set(line.matched_book_id, line);
      }
    });
    return map;
  }, [accountStatementLines]);

  const filteredBookItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookItems.filter((item) => {
      if (hidePreviouslyReconciled && item.alreadyReconciledId) return false;
      if (sourceFilter === 'journal' && item.source !== 'Journal Entry') return false;
      if (sourceFilter === 'cashflow' && item.source === 'Journal Entry') return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (q) {
        const matches =
          item.description.toLowerCase().includes(q) ||
          item.reference.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [bookItems, hidePreviouslyReconciled, sourceFilter, typeFilter, searchTerm]);

  // Live Reconciliation Math
  const beginningBalance = parseFloat(beginningBalanceInput) || 0;
  const statementEndingBalance = parseFloat(statementEndingInput) || 0;

  const { clearedDeposits, clearedWithdrawals, clearedCount } = useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    let count = 0;
    bookItems.forEach((item) => {
      if (clearedIds.has(item.id) && !item.alreadyReconciledId) {
        count++;
        if (item.type === 'Deposit') deposits += item.amount;
        else withdrawals += item.amount;
      }
    });
    return { clearedDeposits: deposits, clearedWithdrawals: withdrawals, clearedCount: count };
  }, [bookItems, clearedIds]);

  const clearedBookBalance = beginningBalance + clearedDeposits - clearedWithdrawals;
  const difference = statementEndingBalance - clearedBookBalance;
  const isBalanced = Math.abs(difference) < 0.01;

  const toggleClearItem = (id: string) => {
    setClearedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setClearedIds((prev) => {
      const next = new Set(prev);
      filteredBookItems.forEach((item) => {
        if (!item.alreadyReconciledId) next.add(item.id);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setClearedIds(new Set());
  };

  // Auto-match imported bank statement lines against unreconciled book items
  const handleAutoMatch = () => {
    if (!selectedAccount) return;
    const unreconciledBooks = bookItems.filter((b) => !b.alreadyReconciledId);
    const usedBookIds = new Set<string>();
    let matchCount = 0;

    const updatedLines = statementLines.map((line) => {
      if (line.account_id !== selectedAccount.id || line.reconciliation_id) return line;
      if (line.status === 'Adjusted') return line;

      const lineDate = parseLocalDate(line.date).getTime();
      const targetAmount = Math.abs(line.amount);

      const candidate = unreconciledBooks.find((book) => {
        if (usedBookIds.has(book.id)) return false;
        if (book.type !== line.type) return false;
        if (Math.abs(book.amount - targetAmount) > 0.01) return false;
        const bookDate = parseLocalDate(book.date).getTime();
        const daysDiff = Math.abs(lineDate - bookDate) / (1000 * 60 * 60 * 24);
        return Number.isNaN(daysDiff) || daysDiff <= 7;
      });

      if (candidate) {
        usedBookIds.add(candidate.id);
        matchCount++;
        return {
          ...line,
          status: 'Matched' as const,
          matched_book_id: candidate.id,
        };
      }
      return line;
    });

    dataService.saveBankStatementLines(updatedLines);
    if (usedBookIds.size > 0) {
      setClearedIds((prev) => {
        const next = new Set(prev);
        usedBookIds.forEach((id) => next.add(id));
        return next;
      });
    }

    setFeedback({
      type: matchCount > 0 ? 'success' : 'info',
      message:
        matchCount > 0
          ? `Matched and cleared ${matchCount} bank statement ${matchCount === 1 ? 'line' : 'lines'} against your book register.`
          : 'No new matching transactions found within ±7 days and exact amount.',
    });
  };

  // CSV Dropzone handler for Bank Statement Import
  const onDropCSV = useCallback(
    (acceptedFiles: File[]) => {
      if (!selectedAccount || acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      const reader = new FileReader();

      reader.onload = () => {
        const text = String(reader.result || '');
        const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (rawLines.length < 2) {
          setFeedback({
            type: 'error',
            message: 'CSV file must include a header row and at least one statement transaction.',
          });
          return;
        }

        const headers = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes('date'));
        const descIdx = headers.findIndex(
          (h) => h.includes('desc') || h.includes('memo') || h.includes('payee') || h.includes('narrative')
        );
        const refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('check'));
        const amountIdx = headers.findIndex((h) => h === 'amount' || h.includes('net'));
        const debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal'));
        const creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit'));

        const imported: BankStatementLine[] = [];
        for (let i = 1; i < rawLines.length; i++) {
          const cols = parseCSVLine(rawLines[i]);
          if (cols.every((c) => !c)) continue;

          const dateVal = normalizeStatementDate(dateIdx >= 0 ? cols[dateIdx] : cols[0]);
          const descVal = (descIdx >= 0 ? cols[descIdx] : cols[1]) || 'Bank statement transaction';
          const refVal = refIdx >= 0 ? cols[refIdx] : '';

          let signedAmount = 0;
          if (amountIdx >= 0) {
            signedAmount = parseNumericAmount(cols[amountIdx]);
          } else if (debitIdx >= 0 || creditIdx >= 0) {
            const debitAmt = Math.abs(parseNumericAmount(debitIdx >= 0 ? cols[debitIdx] : '0'));
            const creditAmt = Math.abs(parseNumericAmount(creditIdx >= 0 ? cols[creditIdx] : '0'));
            signedAmount = creditAmt - debitAmt;
          } else {
            signedAmount = parseNumericAmount(cols[2]);
          }

          if (signedAmount === 0) continue;

          imported.push({
            id: `BSL-${Date.now()}-${i}`,
            account_id: selectedAccount.id,
            date: dateVal,
            description: descVal,
            reference: refVal || undefined,
            amount: Math.abs(signedAmount),
            type: signedAmount >= 0 ? 'Deposit' : 'Withdrawal',
            status: 'Unmatched',
          });
        }

        if (imported.length === 0) {
          setFeedback({
            type: 'error',
            message: 'No valid transaction amounts were detected in the uploaded CSV.',
          });
          return;
        }

        dataService.addBankStatementLines(imported);
        setActiveTab('statement');
        setFeedback({
          type: 'success',
          message: `Imported ${imported.length} bank statement ${imported.length === 1 ? 'line' : 'lines'} for ${selectedAccount.name}. Run Auto-Match to clear matching book entries.`,
        });
      };

      reader.readAsText(file);
    },
    [selectedAccount]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCSV,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    multiple: false,
  });

  const handleLoadSampleStatement = () => {
    if (!selectedAccount) return;
    const unreconciled = bookItems.filter((b) => !b.alreadyReconciledId).slice(0, 6);
    const sampleLines: BankStatementLine[] = unreconciled.map((item, idx) => ({
      id: `BSL-SAMPLE-${Date.now()}-${idx}`,
      account_id: selectedAccount.id,
      date: item.date,
      description: item.description,
      reference: item.reference,
      amount: item.amount,
      type: item.type,
      status: 'Unmatched',
    }));

    // Add a realistic bank service fee line so the adjustment workflow can be tried directly
    sampleLines.push({
      id: `BSL-FEE-${Date.now()}`,
      account_id: selectedAccount.id,
      date: statementDate,
      description: 'Monthly Bank Service & Wire Maintenance Fee',
      reference: 'BNK-FEE',
      amount: 18.5,
      type: 'Withdrawal',
      status: 'Unmatched',
    });

    dataService.addBankStatementLines(sampleLines);
    setActiveTab('statement');
    setFeedback({
      type: 'info',
      message: `Loaded ${sampleLines.length} sample bank statement lines (including an $18.50 bank service fee to test adjusting entries).`,
    });
  };

  const handleDownloadTemplate = () => {
    const csv = [
      'Date,Description,Reference,Amount',
      `${formatLocalDate()},Client Retainer Deposit,WIRE-1042,1250.00`,
      `${formatLocalDate()},Office Internet & Fiber,AUTOPAY-88,-115.00`,
      `${formatLocalDate()},Monthly Bank Maintenance Fee,FEE-01,-18.50`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'island_bank_statement_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddManualLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const amt = parseFloat(manualLineAmount);
    if (!manualLineDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Enter a description and a positive transaction amount.' });
      return;
    }

    const line: BankStatementLine = {
      id: `BSL-MAN-${Date.now()}`,
      account_id: selectedAccount.id,
      date: manualLineDate,
      description: manualLineDesc.trim(),
      reference: manualLineRef.trim() || undefined,
      amount: amt,
      type: manualLineType,
      status: 'Unmatched',
    };

    dataService.addBankStatementLines([line]);
    setManualLineDesc('');
    setManualLineRef('');
    setManualLineAmount('');
    setIsAddLineOpen(false);
    setFeedback({ type: 'success', message: 'Added statement line to workspace.' });
  };

  const openAdjustModalForVariance = () => {
    const absDiff = Math.abs(difference);
    setAdjustingStatementLineId(null);
    setAdjustDate(statementDate);
    setAdjustDirection(difference < 0 ? 'Withdrawal' : 'Deposit');
    setAdjustAmount(absDiff.toFixed(2));
    setAdjustDescription(
      difference < 0 ? 'Bank Service Fee / Unrecorded Charge' : 'Bank Interest Earned / Deposit Adjustment'
    );
    setIsAdjustModalOpen(true);
  };

  const openAdjustModalForLine = (line: BankStatementLine) => {
    setAdjustingStatementLineId(line.id);
    setAdjustDate(line.date);
    setAdjustDirection(line.type);
    setAdjustAmount(line.amount.toFixed(2));
    setAdjustDescription(line.description);
    setIsAdjustModalOpen(true);
  };

  const handlePostAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !adjustOffsetAccountId) return;
    const amt = parseFloat(adjustAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Adjustment amount must be greater than $0.00.' });
      return;
    }

    const entryId = `ADJ-${Date.now()}`;
    const cashLineId = `LINE-CASH-${Date.now()}`;
    const offsetLineId = `LINE-OFF-${Date.now() + 1}`;

    if (!dataService.can('manage_ledger')) {
      setFeedback({ type: 'error', message: 'Only Owners and Accountants can post reconciliation adjustments.' });
      return;
    }

    const entry: JournalEntry = {
      id: entryId,
      date: adjustDate,
      description: `Reconciliation Adjustment: ${adjustDescription.trim()}`,
      status: 'Posted',
      lines: [
        {
          id: cashLineId,
          account_id: selectedAccount.id,
          debit: adjustDirection === 'Deposit' ? amt : 0,
          credit: adjustDirection === 'Withdrawal' ? amt : 0,
          description: adjustDescription.trim(),
        },
        {
          id: offsetLineId,
          account_id: adjustOffsetAccountId,
          debit: adjustDirection === 'Withdrawal' ? amt : 0,
          credit: adjustDirection === 'Deposit' ? amt : 0,
          description: adjustDescription.trim(),
        },
      ],
    };

    dataService.saveJournalEntry(entry);

    const newBookItemId = `JE:${entryId}:${cashLineId}`;
    setClearedIds((prev) => {
      const next = new Set(prev);
      next.add(newBookItemId);
      return next;
    });

    if (adjustingStatementLineId) {
      const updatedLines = statementLines.map((l) =>
        l.id === adjustingStatementLineId
          ? { ...l, status: 'Adjusted' as const, matched_book_id: newBookItemId }
          : l
      );
      dataService.saveBankStatementLines(updatedLines);
    }

    setIsAdjustModalOpen(false);
    setAdjustingStatementLineId(null);
    loadWorkspaceData();
    setFeedback({
      type: 'success',
      message: `Posted balanced journal entry (${entryId}) for ${formatCurrency(amt)} and cleared it in your register.`,
    });
  };

  const handleSaveReconciliation = (status: 'Draft' | 'Completed') => {
    if (!dataService.can('manage_ledger')) {
      setFeedback({ type: 'error', message: 'Only Owners and Accountants can save or complete bank reconciliations.' });
      return;
    }
    if (!selectedAccount) return;
    if (status === 'Completed' && !isBalanced) {
      setFeedback({
        type: 'error',
        message: `Difference must be $0.00 before completing reconciliation (current difference: ${formatCurrency(difference)}). Clear matching transactions or post an adjustment.`,
      });
      return;
    }

    const matchedLineIds = accountStatementLines
      .filter((l) => !l.reconciliation_id && (l.status === 'Matched' || l.status === 'Adjusted'))
      .map((l) => l.id);

    const record: ReconciliationRecord = {
      id: activeDraftId || `REC-${Date.now()}`,
      account_id: selectedAccount.id,
      account_name: `${selectedAccount.code} · ${selectedAccount.name}`,
      statement_date: statementDate,
      beginning_balance: beginningBalance,
      statement_ending_balance: statementEndingBalance,
      cleared_book_balance: clearedBookBalance,
      difference,
      cleared_count: clearedCount,
      cleared_item_ids: Array.from(clearedIds),
      statement_line_ids: matchedLineIds,
      status,
      notes: reconciliationNotes.trim() || undefined,
      completed_at: new Date().toISOString(),
    };

    dataService.saveReconciliation(record);

    if (status === 'Completed') {
      setActiveDraftId(null);
      setClearedIds(new Set());
      setBeginningBalanceInput(statementEndingBalance.toFixed(2));
      setReconciliationNotes('');
      setActiveTab('history');
      setFeedback({
        type: 'success',
        message: `Reconciliation completed and locked for ${selectedAccount.name} as of ${statementDate}.`,
      });
    } else {
      setActiveDraftId(record.id);
      setFeedback({
        type: 'info',
        message: 'Reconciliation draft saved. You can resume it anytime from Reconciliation History.',
      });
    }
  };

  const handleResumeDraft = (record: ReconciliationRecord) => {
    setSelectedAccountId(record.account_id);
    setActiveDraftId(record.id);
    setStatementDate(record.statement_date);
    setBeginningBalanceInput(record.beginning_balance.toFixed(2));
    setStatementEndingInput(record.statement_ending_balance.toFixed(2));
    setClearedIds(new Set(record.cleared_item_ids));
    setReconciliationNotes(record.notes || '');
    setActiveTab('register');
    setFeedback({
      type: 'info',
      message: `Loaded draft reconciliation (${record.statement_date}) for ${record.account_name}.`,
    });
  };

  const handleExportReconciliationCSV = (record: ReconciliationRecord) => {
    const rows = [
      ['Reconciliation ID', record.id],
      ['Account', record.account_name],
      ['Statement Date', record.statement_date],
      ['Status', record.status],
      ['Beginning Balance', record.beginning_balance.toFixed(2)],
      ['Statement Ending Balance', record.statement_ending_balance.toFixed(2)],
      ['Cleared Book Balance', record.cleared_book_balance.toFixed(2)],
      ['Difference', record.difference.toFixed(2)],
      ['Cleared Items Count', String(record.cleared_count)],
      ['Notes', record.notes || ''],
    ];
    const csv = rows.map((r) => r.map(sanitizeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation_${record.statement_date}_${record.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'reconciliation') {
      dataService.deleteReconciliation(deleteTarget.id);
      setFeedback({ type: 'info', message: 'Reconciliation record removed and linked items reopened.' });
    } else {
      dataService.deleteBankStatementLine(deleteTarget.id);
      setFeedback({ type: 'info', message: 'Bank statement line removed.' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {!dataService.can('manage_ledger') && (
        <div className="px-5 py-3.5 rounded-2xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-900">
          Read-only reconciliation view: Only Owners and Accountants can clear items, post adjustments, or lock completed statements.
        </div>
      )}
      {/* Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border text-sm font-semibold',
              feedback.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-900',
              feedback.type === 'error' && 'bg-rose-50 border-rose-200 text-rose-900',
              feedback.type === 'info' && 'bg-slate-100 border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle
                  size={18}
                  className={cn(
                    'shrink-0',
                    feedback.type === 'error' ? 'text-rose-600' : 'text-brand-600'
                  )}
                />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statement Configuration Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Bank Statement Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a bank or cash account, enter your statement closing balance, and clear matching transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleLoadSampleStatement}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet size={15} />
              Load Sample Statement
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('statement')}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload size={15} />
              Import Bank CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Bank / Cash Account
            </label>
            <select
              value={selectedAccount?.id || ''}
              onChange={(e) => {
                setActiveDraftId(null);
                setSelectedAccountId(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {assetAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} · {acc.name} ({formatCurrency(acc.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Statement Ending Date
            </label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Beginning Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={beginningBalanceInput}
              onChange={(e) => setBeginningBalanceInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                Statement Ending Balance
              </label>
              {selectedAccount && (
                <button
                  type="button"
                  onClick={() => setStatementEndingInput(clearedBookBalance.toFixed(2))}
                  className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer"
                >
                  Match Cleared
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={statementEndingInput}
              onChange={(e) => setStatementEndingInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </section>

      {/* Live 4-Column Reconciliation Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500">Statement Ending Balance</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(statementEndingBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">As of {statementDate}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500">Cleared Book Balance</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(clearedBookBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Begin {formatCurrency(beginningBalance)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500">Cleared Activity ({clearedCount} items)</p>
          <p className="mt-2 text-lg font-bold font-mono tabular-nums text-emerald-700">
            +{formatCurrency(clearedDeposits)}
          </p>
          <p className="text-sm font-semibold font-mono tabular-nums text-rose-700">
            -{formatCurrency(clearedWithdrawals)}
          </p>
        </div>

        <div
          className={cn(
            'rounded-2xl p-5 border',
            isBalanced
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          )}
        >
          <div className="flex items-center justify-between">
            <p
              className={cn(
                'text-xs font-semibold',
                isBalanced ? 'text-emerald-800' : 'text-amber-900'
              )}
            >
              Reconciliation Difference
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-bold',
                isBalanced ? 'text-emerald-700' : 'text-amber-800'
              )}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 size={14} />
                  Balanced
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  Out of Balance
                </>
              )}
            </span>
          </div>
          <p
            className={cn(
              'mt-2 text-2xl font-bold font-mono tabular-nums',
              isBalanced ? 'text-emerald-700' : 'text-amber-900'
            )}
          >
            {formatCurrency(difference)}
          </p>
          {!isBalanced && (
            <button
              type="button"
              onClick={openAdjustModalForVariance}
              className="mt-1 text-xs font-bold text-amber-900 underline underline-offset-4 hover:text-black cursor-pointer"
            >
              Post adjusting entry for {formatCurrency(Math.abs(difference))}
            </button>
          )}
        </div>
      </section>

      {/* Segmented Workspace Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Scale size={14} />
            Reconcile Register ({filteredBookItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'statement'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <FileSpreadsheet size={14} />
            Bank Statement Lines ({accountStatementLines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <History size={14} />
            Reconciliation History ({reconciliations.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoMatch}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wand2 size={14} className="text-brand-600" />
            Auto-Match Statement
          </button>
          <button
            type="button"
            onClick={() => {
              setAdjustingStatementLineId(null);
              setAdjustDate(statementDate);
              setAdjustDirection('Withdrawal');
              setAdjustAmount('');
              setAdjustDescription('Bank Service Charge');
              setIsAdjustModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} className="text-brand-600" />
            Adjusting Entry
          </button>
        </div>
      </div>

      {/* TAB 1: RECONCILE REGISTER */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Register Filter Controls */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search description, reference, or source..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(['all', 'Deposit', 'Withdrawal'] as RegisterTypeFilter[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                      typeFilter === t
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {t === 'all' ? 'All Types' : t === 'Deposit' ? 'Deposits' : 'Withdrawals'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    { id: 'all', label: 'All Sources' },
                    { id: 'journal', label: 'Journal Ledger' },
                    { id: 'cashflow', label: 'Invoices & Expenses' },
                  ] as { id: RegisterSourceFilter; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSourceFilter(s.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                      sourceFilter === s.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hidePreviouslyReconciled}
                  onChange={(e) => setHidePreviouslyReconciled(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Hide locked items
              </label>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                Uncheck All
              </button>
            </div>
          </div>

          {/* Register Data Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {filteredBookItems.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <Scale size={32} className="mx-auto text-slate-400" />
                <h3 className="text-base font-bold text-slate-900">
                  No unreconciled transactions match your filters
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Record paid invoices, expenses, or posted journal entries for this account, or import a bank statement CSV to post bank adjustments.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('statement')}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Import Bank Statement
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 w-12 text-center">Clear</th>
                      <th className="py-3 px-4 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Source</th>
                      <th className="py-3 px-4">Description & Reference</th>
                      <th className="py-3 px-4 whitespace-nowrap">Statement Match</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Withdrawal</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredBookItems.map((item) => {
                      const isLocked = Boolean(item.alreadyReconciledId);
                      const isChecked = isLocked || clearedIds.has(item.id);
                      const matchedStmt = matchedBookMap.get(item.id);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => !isLocked && toggleClearItem(item.id)}
                          className={cn(
                            'transition-colors',
                            isLocked
                              ? 'bg-slate-50/70 text-slate-400'
                              : isChecked
                                ? 'bg-emerald-50/50 hover:bg-emerald-50/80 cursor-pointer'
                                : 'hover:bg-slate-50 cursor-pointer'
                          )}
                        >
                          <td
                            className="py-2.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isLocked ? (
                              <span
                                title="Reconciled in a locked period"
                                className="inline-flex items-center justify-center text-slate-400"
                              >
                                <Lock size={14} />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleClearItem(item.id)}
                                aria-label={`Clear ${item.description}`}
                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-slate-700">
                            {item.date}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                            {item.source}
                          </td>
                          <td className="py-2.5 px-4 max-w-md">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.description}
                            </p>
                            <p className="text-xs font-mono text-slate-500 truncate">
                              Ref: {item.reference}
                            </p>
                          </td>
                          <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                            {isLocked ? (
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                <Lock size={12} />
                                Locked
                              </span>
                            ) : matchedStmt ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <Check size={13} />
                                Matched ({matchedStmt.date})
                              </span>
                            ) : isChecked ? (
                              <span className="text-brand-700 font-semibold">Cleared manually</span>
                            ) : (
                              <span className="text-slate-400">Open</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-rose-700 font-semibold">
                            {item.type === 'Withdrawal' ? formatCurrency(item.amount) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-emerald-700 font-semibold">
                            {item.type === 'Deposit' ? formatCurrency(item.amount) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Complete Reconciliation Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Reconciliation Notes (optional)
              </label>
              <input
                type="text"
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                placeholder="e.g., Reconciled November bank statement · Two uncleared checks outstanding"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-5">
              <button
                type="button"
                onClick={() => handleSaveReconciliation('Draft')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save size={15} />
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveReconciliation('Completed')}
                disabled={!isBalanced}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap',
                  isBalanced
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                )}
              >
                <CheckCircle2 size={15} />
                Finish Reconciliation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BANK STATEMENT IMPORT & MATCHING */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              {...getRootProps()}
              className={cn(
                'lg:col-span-2 bg-white border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center',
                isDragActive
                  ? 'border-brand-500 bg-brand-50/40'
                  : 'border-slate-300 hover:border-brand-400'
              )}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                <Upload size={22} />
              </div>
              <p className="text-sm font-bold text-slate-900">
                {isDragActive
                  ? 'Drop your bank CSV file here'
                  : 'Drag & drop your bank statement CSV, or click to browse'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Supports single Amount columns (+/-) or separate Debit / Credit columns with Date, Description, and Reference.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Statement Tools</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add individual bank lines manually, download a CSV template, or auto-match lines against your register.
                </p>
              </div>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddLineOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  Add Bank Statement Line
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Download CSV Template
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Imported Statement Lines — {selectedAccount?.name || 'Account'}
                </h3>
                <p className="text-xs text-slate-500">
                  Unmatched bank charges or interest can be posted directly as balanced journal entries.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoMatch}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wand2 size={14} />
                Run Auto-Match
              </button>
            </div>

            {accountStatementLines.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <FileSpreadsheet size={30} className="mx-auto text-slate-400" />
                <p className="text-sm font-bold text-slate-900">No bank statement lines uploaded yet</p>
                <p className="text-xs text-slate-500">
                  Upload a bank CSV above or click &ldquo;Load Sample Statement&rdquo; to preview automatic statement matching.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 whitespace-nowrap">Type</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Amount</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {accountStatementLines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-slate-700">
                          {line.date}
                        </td>
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-slate-900">{line.description}</p>
                          {line.reference && (
                            <p className="text-xs font-mono text-slate-500">Ref: {line.reference}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-xs font-semibold">
                          {line.type === 'Deposit' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <ArrowDownLeft size={13} />
                              Deposit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700">
                              <ArrowUpRight size={13} />
                              Withdrawal
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-xs font-semibold">
                          {line.status === 'Matched' && (
                            <span className="text-emerald-700">Matched to register</span>
                          )}
                          {line.status === 'Adjusted' && (
                            <span className="text-brand-700">Adjusted via journal</span>
                          )}
                          {line.status === 'Unmatched' && (
                            <span className="text-amber-700">Unmatched</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {line.type === 'Withdrawal' ? '-' : '+'}
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {line.status === 'Unmatched' && (
                              <button
                                type="button"
                                onClick={() => openAdjustModalForLine(line)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Record Adjustment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: 'line', id: line.id })}
                              aria-label="Delete statement line"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RECONCILIATION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {reconciliations.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-3">
              <History size={32} className="mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-slate-900">No saved reconciliations yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Save a reconciliation draft or finish balancing a bank statement to build a permanent audit trail.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 whitespace-nowrap">Statement Date</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Beginning</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Statement Ending</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Cleared</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reconciliations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-slate-700">
                        {rec.statement_date}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{rec.account_name}</p>
                        {rec.notes && (
                          <p className="text-xs text-slate-500 truncate max-w-xs">{rec.notes}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCurrency(rec.beginning_balance)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(rec.statement_ending_balance)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {rec.cleared_count} items
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                        {rec.status === 'Completed' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 size={13} />
                            Completed
                          </span>
                        ) : (
                          <span className="text-amber-700">Draft</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {rec.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleResumeDraft(rec)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Resume
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportReconciliationCSV(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download size={12} />
                            CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'reconciliation', id: rec.id })}
                            aria-label="Delete reconciliation record"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Bank Statement Line Modal */}
      <AnimatePresence>
        {isAddLineOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddLineOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Add Bank Statement Line</h3>
                <button
                  type="button"
                  onClick={() => setIsAddLineOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddManualLine} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={manualLineDate}
                      onChange={(e) => setManualLineDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                    <select
                      value={manualLineType}
                      onChange={(e) => setManualLineType(e.target.value as 'Deposit' | 'Withdrawal')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                    >
                      <option value="Withdrawal">Withdrawal</option>
                      <option value="Deposit">Deposit</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={manualLineDesc}
                    onChange={(e) => setManualLineDesc(e.target.value)}
                    placeholder="e.g., Monthly Bank Service Fee"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={manualLineAmount}
                      onChange={(e) => setManualLineAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Reference (optional)
                    </label>
                    <input
                      type="text"
                      value={manualLineRef}
                      onChange={(e) => setManualLineRef(e.target.value)}
                      placeholder="CHK-201"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddLineOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 cursor-pointer"
                  >
                    Add Line
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adjusting Journal Entry Modal */}
      <AnimatePresence>
        {isAdjustModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdjustModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Record Adjusting Journal Entry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Posts a balanced double-entry adjustment to {selectedAccount?.name} and marks it cleared.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handlePostAdjustment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Posting Date
                    </label>
                    <input
                      type="date"
                      value={adjustDate}
                      onChange={(e) => setAdjustDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cash Impact
                    </label>
                    <select
                      value={adjustDirection}
                      onChange={(e) =>
                        setAdjustDirection(e.target.value as 'Withdrawal' | 'Deposit')
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                    >
                      <option value="Withdrawal">Withdrawal (Credit Bank)</option>
                      <option value="Deposit">Deposit (Debit Bank)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Offset Account (Expense / Income / Equity)
                  </label>
                  <select
                    value={adjustOffsetAccountId}
                    onChange={(e) => setAdjustOffsetAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    {offsetAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} · {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={adjustDescription}
                      onChange={(e) => setAdjustDescription(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 cursor-pointer"
                  >
                    Post & Clear Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={
          deleteTarget?.kind === 'reconciliation'
            ? 'Delete Reconciliation Record'
            : 'Delete Statement Line'
        }
        message={
          deleteTarget?.kind === 'reconciliation'
            ? 'Removing this reconciliation will unlock its transactions so they can be reconciled again.'
            : 'Remove this imported bank statement line from your workspace?'
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
