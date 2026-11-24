import { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, BookOpen } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Account, AccountType } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

interface AccountWithActivity extends Account {
  debits: number;
  credits: number;
}

export function AccountsPage({ onEdit }: { onEdit: (account: Account) => void }) {
  const [accounts, setAccounts] = useState<AccountWithActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AccountType | 'All'>('All');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const canManageLedger = dataService.can('manage_ledger');

  useEffect(() => {
    fetchAccounts();
    window.addEventListener('island-data-synced', fetchAccounts);
    return () => window.removeEventListener('island-data-synced', fetchAccounts);
  }, []);

  const fetchAccounts = () => {
    const allAccounts = dataService.getAccounts();
    const allEntries = dataService.getJournalEntries().filter(e => e.status === 'Posted');
    
    const debitsMap: Record<string, number> = {};
    const creditsMap: Record<string, number> = {};
    
    allEntries.forEach(entry => {
      entry.lines.forEach(line => {
        debitsMap[line.account_id] = (debitsMap[line.account_id] || 0) + line.debit;
        creditsMap[line.account_id] = (creditsMap[line.account_id] || 0) + line.credit;
      });
    });
    
    const accountsWithActivity = allAccounts.map(account => ({
      ...account,
      debits: debitsMap[account.id] || 0,
      credits: creditsMap[account.id] || 0
    }));
    
    setAccounts(accountsWithActivity as AccountWithActivity[]);
  };

  const handleDeleteClick = (id: string) => {
    setAccountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      dataService.deleteAccount(accountToDelete);
      fetchAccounts();
      setIsDeleteModalOpen(false);
      setAccountToDelete(null);
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      account.code.includes(searchTerm) ||
      (account.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (account.notes?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'All' || account.type === filterType;
    return matchesSearch && matchesType;
  });

  const totals = accounts.reduce((acc, curr) => {
    if (curr.type === 'Asset') acc.assets += curr.balance;
    if (curr.type === 'Liability') acc.liabilities += curr.balance;
    if (curr.type === 'Equity') acc.equity += curr.balance;
    if (curr.type === 'Revenue') acc.revenue += curr.balance;
    if (curr.type === 'Expense') acc.expenses += curr.balance;
    return acc;
  }, { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0 });

  const netIncome = totals.revenue - totals.expenses;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Assets</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
            {formatCurrency(totals.assets)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Liabilities</p>
          <h3 className="text-3xl font-black text-rose-600 tracking-tighter">
            {formatCurrency(totals.liabilities)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Equity</p>
          <h3 className="text-3xl font-black text-brand-600 tracking-tighter">
            {formatCurrency(totals.equity)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Income (YTD)</p>
          <h3 className={cn(
            "text-3xl font-black tracking-tighter",
            netIncome >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {formatCurrency(netIncome)}
          </h3>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or code..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none min-w-[150px]"
          >
            <option value="All">All Types</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Name</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debits</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credits</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                      <BookOpen size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No accounts found</p>
                      <p className="text-slate-500 text-sm font-medium">Try adjusting your search or filters.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{account.code}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-jamaica-black font-black tracking-tight uppercase">{account.name}</span>
                      {account.description && <span className="text-[10px] text-slate-400 font-medium">{account.description}</span>}
                      {account.notes && <span className="text-[9px] text-brand-400 font-bold italic mt-0.5">Note: {account.notes}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      account.type === 'Asset' && "bg-emerald-50 text-emerald-600",
                      account.type === 'Liability' && "bg-rose-50 text-rose-600",
                      account.type === 'Equity' && "bg-brand-50 text-brand-600",
                      account.type === 'Revenue' && "bg-indigo-50 text-indigo-600",
                      account.type === 'Expense' && "bg-amber-50 text-amber-600"
                    )}>
                      {account.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-bold text-emerald-600 tabular-nums">
                      {formatCurrency(account.debits)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-bold text-rose-600 tabular-nums">
                      {formatCurrency(account.credits)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "text-sm font-black tabular-nums",
                      account.balance < 0 ? "text-rose-600" : "text-jamaica-black"
                    )}>
                      {formatCurrency(account.balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canManageLedger ? (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onEdit(account)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(account.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">Read-only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredAccounts.length > 0 && (
            <tfoot className="bg-slate-50/50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Totals</td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-black text-emerald-600 tabular-nums">
                    {formatCurrency(filteredAccounts.reduce((sum, a) => sum + a.debits, 0))}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-black text-rose-600 tabular-nums">
                    {formatCurrency(filteredAccounts.reduce((sum, a) => sum + a.credits, 0))}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={cn(
                    "text-sm font-black tabular-nums",
                    filteredAccounts.reduce((sum, a) => sum + a.balance, 0) < 0 ? "text-rose-600" : "text-jamaica-black"
                  )}>
                    {formatCurrency(filteredAccounts.reduce((sum, a) => sum + a.balance, 0))}
                  </span>
                </td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Account"
        message="Are you sure you want to delete this account? This action cannot be undone and may affect your financial reports."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
