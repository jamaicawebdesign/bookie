import React, { useState, useEffect } from 'react';
import { Plus, Search, ClipboardList, ChevronDown, ChevronUp, Download, Eye, FileText, Trash2 as TrashIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { JournalEntry, Account, JournalLine } from '../types';
import { formatCurrency, cn, formatLocalDate, sanitizeCsvCell } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

export function LedgerPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Posted' | 'Draft'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedEntries, setExpandedEntries] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const canManageLedger = dataService.can('manage_ledger');

  useEffect(() => {
    fetchData();
    window.addEventListener('island-data-synced', fetchData);
    return () => window.removeEventListener('island-data-synced', fetchData);
  }, []);

  const fetchData = () => {
    setEntries(dataService.getJournalEntries());
    setAccounts(dataService.getAccounts());
  };

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleDeleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageLedger) return;
    setEntryToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!entryToDelete) return;
    dataService.deleteJournalEntry(entryToDelete);
    fetchData();
    setIsDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const filteredEntries = entries.filter(entry => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (entry.description || '').toLowerCase().includes(q) ||
      (entry.id || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || entry.status === statusFilter;
    const matchesDate = (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate);
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;

    const headers = ['Date', 'Reference', 'Description', 'Status', 'Account Code', 'Account Name', 'Debit', 'Credit'];
    const rows: any[] = [];

    filteredEntries.forEach(entry => {
      entry.lines.forEach((line, index) => {
        const account = accounts.find(a => a.id === line.account_id);
        rows.push([
          index === 0 ? entry.date : '',
          index === 0 ? entry.id : '',
          index === 0 ? (entry.description || '') : '',
          index === 0 ? entry.status : '',
          account?.code || '',
          account?.name || '',
          line.debit || 0,
          line.credit || 0
        ]);
      });
      rows.push(['', '', '', '', '', '', '', '']);
    });

    const csvContent = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map(row => row.map(sanitizeCsvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `general_ledger_export_${formatLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search entries..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="All">All Statuses</option>
            <option value="Posted">Posted</option>
            <option value="Draft">Draft</option>
          </select>
          <button 
            onClick={handleExportCSV}
            disabled={filteredEntries.length === 0}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="w-10 px-6 py-4"></th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description & Accounts</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Amount</th>
              <th className="w-20 px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                      <ClipboardList size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No entries found</p>
                      <p className="text-slate-500 text-sm font-medium">Create your first journal entry to see it here.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const isExpanded = expandedEntries.includes(entry.id);
                const totalDebit = entry.lines.reduce((acc, curr) => acc + curr.debit, 0);
                
                const affectedAccounts = entry.lines
                  .map(l => accounts.find(a => a.id === l.account_id)?.name)
                  .filter((v, i, a) => v && a.indexOf(v) === i)
                  .join(', ');

                const debitedAccounts = entry.lines
                  .filter(l => l.debit > 0)
                  .map(l => accounts.find(a => a.id === l.account_id))
                  .filter((v, i, a) => v && a.findIndex(acc => acc?.id === v.id) === i) as Account[];

                const creditedAccounts = entry.lines
                  .filter(l => l.credit > 0)
                  .map(l => accounts.find(a => a.id === l.account_id))
                  .filter((v, i, a) => v && a.findIndex(acc => acc?.id === v.id) === i) as Account[];

                return (
                  <React.Fragment key={entry.id}>
                    <tr 
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors cursor-pointer group",
                        isExpanded && "bg-slate-50/50"
                      )}
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <td className="px-6 py-4">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                          isExpanded ? "bg-brand-600 text-white" : "text-slate-400 group-hover:text-brand-600 group-hover:bg-brand-50"
                        )}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{entry.date}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{entry.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-jamaica-black font-black tracking-tight uppercase">{entry.description}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-xs">
                            {affectedAccounts}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          entry.status === 'Posted' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleExpand(entry.id); }}
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {canManageLedger && (
                            <button 
                              onClick={(e) => handleDeleteEntry(entry.id, e)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Delete Entry"
                            >
                              <TrashIcon size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={7} className="px-0">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-12 py-8 space-y-8">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                                      <FileText size={20} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-black text-jamaica-black uppercase tracking-widest">Journal Entry Details</h4>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference: {entry.id}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Status</p>
                                      <p className={cn(
                                        "text-xs font-black uppercase tracking-widest",
                                        entry.status === 'Posted' ? "text-emerald-600" : "text-amber-600"
                                      )}>{entry.status}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Affected Accounts Summary */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                      <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Accounts Debited</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {debitedAccounts.map((acc, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/50 text-emerald-700 rounded-xl border border-emerald-100 shadow-sm">
                                          <span className="text-[10px] font-black uppercase">{acc.code}</span>
                                          <span className="w-1 h-1 rounded-full bg-emerald-300" />
                                          <span className="text-[10px] font-black uppercase">{acc.name}</span>
                                          <span className="w-1 h-1 rounded-full bg-emerald-300" />
                                          <span className="text-[10px] font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                                        </div>
                                      ))}
                                      {debitedAccounts.length === 0 && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">None</span>}
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                                      <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Accounts Credited</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {creditedAccounts.map((acc, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50/50 text-rose-700 rounded-xl border border-rose-100 shadow-sm">
                                          <span className="text-[10px] font-black uppercase">{acc.code}</span>
                                          <span className="w-1 h-1 rounded-full bg-rose-300" />
                                          <span className="text-[10px] font-black uppercase">{acc.name}</span>
                                          <span className="w-1 h-1 rounded-full bg-rose-300" />
                                          <span className="text-[10px] font-black tabular-nums">{formatCurrency(acc.balance)}</span>
                                        </div>
                                      ))}
                                      {creditedAccounts.length === 0 && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">None</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="border border-slate-200 rounded-[24px] overflow-hidden bg-white shadow-sm">
                                  <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80">
                                      <tr>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Details</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Description</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {entry.lines.map((line) => {
                                        const account = accounts.find(a => a.id === line.account_id);
                                        return (
                                          <tr key={line.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400">
                                                  {account?.code}
                                                </div>
                                                <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-jamaica-black uppercase tracking-tight">{account?.name || 'Unknown Account'}</span>
                                                    <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md uppercase tracking-widest">
                                                      Bal: {formatCurrency(account?.balance || 0)}
                                                    </span>
                                                  </div>
                                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{account?.type}</span>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 font-medium italic">{line.description || 'No line description'}</td>
                                            <td className={cn(
                                              "px-6 py-4 text-right text-xs font-black tabular-nums",
                                              line.debit > 0 ? "text-emerald-600" : "text-slate-400"
                                            )}>
                                              {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                            </td>
                                            <td className={cn(
                                              "px-6 py-4 text-right text-xs font-black tabular-nums",
                                              line.credit > 0 ? "text-rose-600" : "text-slate-400"
                                            )}>
                                              {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50/50">
                                      <tr className="font-black border-t-2 border-slate-100">
                                        <td colSpan={2} className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-400">Total Balanced Amount</td>
                                        <td className="px-6 py-4 text-right text-sm font-black tabular-nums text-emerald-600">{formatCurrency(totalDebit)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-black tabular-nums text-rose-600">{formatCurrency(entry.lines.reduce((acc, curr) => acc + curr.credit, 0))}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setEntryToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry? Deleting a posted entry will automatically reverse its impact on account balances."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void;
  accounts: Account[];
}

export function JournalEntryModal({ isOpen, onClose, onSave, accounts }: JournalEntryModalProps) {
  const [formData, setFormData] = useState<JournalEntry>({
    id: `JE-${Date.now()}`,
    date: formatLocalDate(),
    description: '',
    status: 'Draft',
    lines: [
      { id: '1', account_id: '', debit: 0, credit: 0, description: '' },
      { id: '2', account_id: '', debit: 0, credit: 0, description: '' }
    ]
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setFormData({
        id: `JE-${Date.now()}`,
        date: formatLocalDate(),
        description: '',
        status: 'Draft',
        lines: [
          { id: '1', account_id: '', debit: 0, credit: 0, description: '' },
          { id: '2', account_id: '', debit: 0, credit: 0, description: '' }
        ]
      });
    }
  }, [isOpen]);

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { id: Math.random().toString(36).substr(2, 9), account_id: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeLine = (id: string) => {
    if (formData.lines.length <= 2) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof JournalLine, value: any) => {
    setFormError(null);
    setFormData({
      ...formData,
      lines: formData.lines.map(l => l.id === id ? { ...l, [field]: value } : l)
    });
  };

  const totalDebit = formData.lines.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredit = formData.lines.reduce((acc, curr) => acc + curr.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setFormError('Please provide a journal entry description.');
      return;
    }
    if (formData.lines.some(l => !l.account_id)) {
      setFormError('Please select an account for every journal line.');
      return;
    }
    if (!isBalanced) {
      setFormError('Journal entry must be balanced (Debits = Credits) and greater than zero.');
      return;
    }
    setFormError(null);
    onSave(formData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-2xl font-black text-jamaica-black tracking-tighter uppercase">New Journal Entry</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                <Plus size={24} className="rotate-45 text-slate-400" />
              </button>
            </div>

            <form id="journal-entry-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              {formError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    required
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <input 
                    required
                    type="text" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    placeholder="Entry description..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Lines</h3>
                  <button 
                    type="button"
                    onClick={addLine}
                    className="text-xs font-black text-brand-600 uppercase tracking-widest hover:text-brand-700"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Debit</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Credit</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2">
                            <select 
                              required
                              value={line.account_id}
                              onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                              className="w-full px-2 py-2 bg-transparent border-none text-xs font-bold focus:outline-none uppercase"
                            >
                              <option value="">Select Account</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name} ({formatCurrency(acc.balance)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              value={line.description}
                              onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                              className="w-full px-2 py-2 bg-transparent border-none text-xs focus:outline-none"
                              placeholder="Line description..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              step="0.01"
                              value={line.debit || ''}
                              onChange={(e) => updateLine(line.id, 'debit', Number(e.target.value))}
                              className={cn(
                                "w-full px-2 py-2 bg-transparent border-none text-xs font-bold text-right focus:outline-none",
                                line.debit > 0 ? "text-emerald-600" : "text-slate-400"
                              )}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              step="0.01"
                              value={line.credit || ''}
                              onChange={(e) => updateLine(line.id, 'credit', Number(e.target.value))}
                              className={cn(
                                "w-full px-2 py-2 bg-transparent border-none text-xs font-bold text-right focus:outline-none",
                                line.credit > 0 ? "text-rose-600" : "text-slate-400"
                              )}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-2">
                            <button 
                              type="button"
                              onClick={() => removeLine(line.id)}
                              className="p-1 text-slate-300 hover:text-rose-500 transition-all"
                            >
                              <Plus size={16} className="rotate-45" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50">
                      <tr className="font-black">
                        <td colSpan={2} className="px-4 py-4 text-xs uppercase tracking-widest text-slate-400">Total</td>
                        <td className={cn(
                          "px-4 py-4 text-right text-xs tabular-nums font-black",
                          totalDebit > 0 ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {formatCurrency(totalDebit)}
                        </td>
                        <td className={cn(
                          "px-4 py-4 text-right text-xs tabular-nums font-black",
                          totalCredit > 0 ? "text-rose-600" : "text-slate-400"
                        )}>
                          {formatCurrency(totalCredit)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">
                    Entry is not balanced. Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, status: 'Draft'})}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border",
                      formData.status === 'Draft' ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Draft
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, status: 'Posted'})}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border",
                      formData.status === 'Posted' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Post Entry
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">
                  * Posted entries will update account balances immediately.
                </p>
              </div>
            </form>

            <div className="p-8 border-t border-slate-100 flex gap-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-4 bg-slate-50 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="journal-entry-form"
                disabled={!isBalanced}
                className={cn(
                  "flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg",
                  isBalanced ? "bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                Save Entry
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
