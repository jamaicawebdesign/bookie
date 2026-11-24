import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  Search, 
  Download, 
  CheckCircle2, 
  Clock, 
  Edit2,
  Trash2,
  X,
  Save,
  Tag,
  DollarSign,
  Calendar,
  Repeat,
  AlertTriangle,
  Target,
  Upload,
  CheckSquare,
  FileDown
} from 'lucide-react';
import { Expense, BudgetCategory, Budget } from '../types';
import { cn, formatCurrency, parseLocalDate, formatLocalDate, sanitizeCsvCell } from '../lib/utils';
import { dataService } from '../services/dataService';
import { ConfirmationModal } from './ConfirmationModal';
import { ExpenseImportModal } from './ExpenseImportModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkStatusConfirmOpen, setIsBulkStatusConfirmOpen] = useState(false);
  const [bulkStatusToApply, setBulkStatusToApply] = useState<'Paid' | 'Pending' | 'Overdue' | null>(null);

  const fetchExpenses = () => {
    try {
      const expensesData = dataService.getExpenses();
      const categoriesData = dataService.getCategories();
      const budgetsData = dataService.getBudgets();
      setExpenses(expensesData);
      setCategories(categoriesData);
      setBudgets(budgetsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateUtilization = (category: string) => {
    const budget = budgets.find(b => b.category === category);
    if (!budget) return null;

    const now = new Date();
    const spent = expenses
      .filter(e => {
        if (e.category !== category) return false;
        const expDate = parseLocalDate(e.date);
        if (budget.period === 'Monthly') {
          return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        } else if (budget.period === 'Quarterly') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const expQuarter = Math.floor(expDate.getMonth() / 3);
          return currentQuarter === expQuarter && expDate.getFullYear() === now.getFullYear();
        } else if (budget.period === 'Yearly') {
          return expDate.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);

    const percentage = budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0;
    return {
      spent,
      limit: budget.limit_amount,
      percentage,
      isOver: spent > budget.limit_amount
    };
  };

  const totalBudgeted = budgets.reduce((acc, curr) => acc + curr.limit_amount, 0);
  const totalSpentInBudgets = budgets.reduce((acc, curr) => {
    const util = calculateUtilization(curr.category);
    return acc + (util?.spent || 0);
  }, 0);

  const totalExpensesMTD = expenses
    .filter(e => {
      const expDate = parseLocalDate(e.date);
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    })
    .reduce((acc, curr) => acc + curr.amount, 0);

  useEffect(() => {
    fetchExpenses();
    window.addEventListener('island-data-synced', fetchExpenses);
    return () => window.removeEventListener('island-data-synced', fetchExpenses);
  }, []);

  const handleSave = (expense: Expense) => {
    try {
      dataService.saveExpense(expense);
      fetchExpenses();
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const handleImport = (importedExpenses: Expense[]) => {
    try {
      importedExpenses.forEach(expense => {
        dataService.saveExpense(expense);
      });
      fetchExpenses();
    } catch (error) {
      console.error('Failed to import expenses:', error);
    }
  };

  const canEdit = dataService.can('manage_transactions');

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    setExpenseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!expenseToDelete || !canEdit) return;
    try {
      dataService.deleteExpense(expenseToDelete);
      fetchExpenses();
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const handleBulkStatusUpdate = (status: 'Paid' | 'Pending' | 'Overdue') => {
    if (!canEdit || selectedIds.length === 0) return;
    setBulkStatusToApply(status);
    setIsBulkStatusConfirmOpen(true);
  };

  const confirmBulkStatusUpdate = () => {
    if (!canEdit || !bulkStatusToApply || selectedIds.length === 0) return;
    try {
      dataService.bulkUpdateExpenseStatus(selectedIds, bulkStatusToApply);
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchExpenses();
      setIsBulkStatusConfirmOpen(false);
      setBulkStatusToApply(null);
    } catch (error) {
      console.error('Failed to update expenses status:', error);
    }
  };

  const handleBulkDelete = () => {
    if (!canEdit || selectedIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    try {
      dataService.bulkDeleteExpenses(selectedIds);
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchExpenses();
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      console.error('Failed to delete expenses:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredExpenses = expenses.filter(expense => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (expense.description || '').toLowerCase().includes(q) ||
                         (expense.category || '').toLowerCase().includes(q) ||
                         (expense.id || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || expense.status === statusFilter;
    
    const matchesStartDate = !startDate || expense.date >= startDate;
    const matchesEndDate = !endDate || expense.date <= endDate;
    
    const matchesMinAmount = !minAmount || expense.amount >= parseFloat(minAmount);
    const matchesMaxAmount = !maxAmount || expense.amount <= parseFloat(maxAmount);
    
    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate && matchesMinAmount && matchesMaxAmount;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Category', 'Amount', 'Date', 'Due Date', 'Description', 'Status', 'Is Recurring', 'Frequency', 'Duration (Months)'];
    const csvRows = filteredExpenses.map(e => [
      e.id,
      e.category,
      e.amount,
      e.date,
      e.due_date || '',
      e.description || '',
      e.status,
      e.is_recurring ? 'Yes' : 'No',
      e.frequency || '-',
      e.duration_months || '-'
    ].map(sanitizeCsvCell).join(','));

    const csvContent = [headers.map(sanitizeCsvCell).join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_export_${formatLocalDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = (expense: Expense) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('EXPENSE VOUCHER', 20, 25);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`ID: ${expense.id}`, 140, 25);
    
    // Body
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Category:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(expense.category, 60, 60);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Amount:', 20, 70);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(expense.amount), 60, 70);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 20, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(expense.date, 60, 80);
    
    if (expense.due_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Due Date:', 20, 90);
      doc.setFont('helvetica', 'normal');
      doc.text(expense.due_date, 60, 90);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 20, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(expense.status, 60, 100);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Description:', 20, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(expense.description || 'No description provided', 60, 110, { maxWidth: 130 });
    
    // Recurring info
    if (expense.is_recurring) {
      doc.setFont('helvetica', 'bold');
      doc.text('Recurring:', 20, 130);
      doc.setFont('helvetica', 'normal');
      const recurText = expense.end_date
        ? `${expense.frequency || 'Monthly'} until ${expense.end_date}`
        : `${expense.frequency || 'Monthly'} for ${expense.duration_months || 12} months`;
      doc.text(recurText, 60, 130);
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 280);
    
    doc.save(`expense_${expense.id}.pdf`);
  };

  const handleDownloadMonthlyReport = () => {
    const doc = new jsPDF();
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    
    doc.setFontSize(22);
    doc.text(`Monthly Expense Report: ${monthName} ${year}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Total MTD: ${formatCurrency(totalExpensesMTD)}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 35);
    
    const tableData = filteredExpenses.map(e => [
      e.id,
      e.category,
      formatCurrency(e.amount),
      e.date,
      e.status,
      e.description || '-'
    ]);
    
    autoTable(doc, {
      head: [['ID', 'Category', 'Amount', 'Date', 'Status', 'Description']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });
    
    doc.save(`monthly_report_${monthName}_${year}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Expenses (MTD)</p>
          <h3 className="text-3xl font-black text-jamaica-black tracking-tighter">
            {formatCurrency(totalExpensesMTD)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pending Payments</p>
          <h3 className="text-3xl font-black text-accent-600 tracking-tighter">
            {formatCurrency(expenses.filter(e => e.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0))}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Budget Utilization</p>
          <div className="flex items-end justify-between">
            <h3 className={cn(
              "text-3xl font-black tracking-tighter",
              totalSpentInBudgets > totalBudgeted ? "text-rose-600" : "text-emerald-600"
            )}>
              {totalBudgeted > 0 ? ((totalSpentInBudgets / totalBudgeted) * 100).toFixed(1) : 0}%
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mb-1">OF TOTAL BUDGET</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Top Category</p>
          <h3 className="text-3xl font-black text-jamaica-black tracking-tighter uppercase truncate">
            {expenses.length > 0
              ? Object.entries(
                  expenses.reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + e.amount;
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
              : 'N/A'}
          </h3>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden border-slate-100 shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search expenses or categories..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>
            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 px-4 py-2 bg-brand-50 border border-brand-100 rounded-2xl shadow-sm"
                >
                  <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest border-r border-brand-200 pr-3 mr-1">
                    {selectedIds.length} Selected
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleBulkStatusUpdate('Paid')}
                      className="p-2 text-emerald-600 hover:bg-emerald-100/50 rounded-xl transition-all"
                      title="Mark as Paid"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate('Pending')}
                      className="p-2 text-amber-600 hover:bg-amber-100/50 rounded-xl transition-all"
                      title="Mark as Pending"
                    >
                      <Clock size={18} />
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate('Overdue')}
                      className="p-2 text-rose-600 hover:bg-rose-100/50 rounded-xl transition-all"
                      title="Mark as Overdue"
                    >
                      <AlertTriangle size={18} />
                    </button>
                  </div>
                  <div className="w-px h-4 bg-brand-200 mx-1" />
                  <button 
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm shadow-rose-200"
                  >
                    <Trash2 size={14} />
                    Bulk Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min $</span>
              <input 
                type="number" 
                placeholder="0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-16 text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max $</span>
              <input 
                type="number" 
                placeholder="Any"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-16 text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
            <button 
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds([]);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm",
                isSelectionMode 
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <CheckSquare size={18} />
              {isSelectionMode ? "Exit Selection" : "Select Multiple"}
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import CSV
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button 
              onClick={handleDownloadMonthlyReport}
              className="flex items-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all"
            >
              <FileDown size={18} />
              Monthly PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                {isSelectionMode && (
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isSelectionMode ? 10 : 9} className="px-6 py-20 text-center">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 10 : 9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                        <Receipt size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No expenses found</p>
                        <p className="text-slate-500 text-sm font-medium">Try adjusting your search or filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className={cn(
                    "hover:bg-slate-50/80 transition-colors group",
                    selectedIds.includes(expense.id) && "bg-brand-50/30"
                  )}>
                    {isSelectionMode && (
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(expense.id)}
                          onChange={() => toggleSelect(expense.id)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{expense.id}</td>
                    <td className="px-6 py-4 text-sm text-jamaica-black font-black tracking-tight uppercase">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: categories.find(c => c.name === expense.category)?.color || '#cbd5e1' }} 
                        />
                        {expense.category}
                        {expense.is_recurring && (
                          <Repeat size={12} className="text-brand-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const util = calculateUtilization(expense.category);
                        if (!util) return <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No Budget Set</span>;
                        
                        return (
                          <div className="space-y-1.5 min-w-[120px]">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                              <span className={util.isOver ? "text-rose-600" : "text-brand-600"}>
                                {util.percentage.toFixed(0)}% Used
                              </span>
                              <span className="text-slate-400">{formatCurrency(util.limit)} Limit</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  util.isOver ? "bg-rose-500" : "bg-brand-500"
                                )}
                                style={{ width: `${Math.min(util.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-rose-600 font-black">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{expense.date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{expense.due_date || '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500 max-w-xs truncate">{expense.description}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        expense.status === 'Paid' ? "bg-brand-50 text-brand-700" : 
                        expense.status === 'Overdue' ? "bg-rose-50 text-rose-700" : "bg-accent-50 text-accent-700"
                      )}>
                        {expense.status === 'Paid' ? <CheckCircle2 size={10} /> : 
                         expense.status === 'Overdue' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleDownloadPDF(expense)}
                          className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                          title="Download PDF"
                        >
                          <FileDown size={16} />
                        </button>
                        {canEdit && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingExpense(expense);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }} 
        onSave={handleSave}
        onRefresh={fetchExpenses}
        initialData={editingExpense}
        categories={categories}
        budgets={budgets}
        expenses={expenses}
      />

      <ExpenseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        categories={categories}
      />

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setExpenseToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Bulk Delete Expenses"
        message={`Are you sure you want to delete ${selectedIds.length} expenses? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={isBulkStatusConfirmOpen}
        onClose={() => {
          setIsBulkStatusConfirmOpen(false);
          setBulkStatusToApply(null);
        }}
        onConfirm={confirmBulkStatusUpdate}
        title="Bulk Update Status"
        message={`Are you sure you want to mark ${selectedIds.length} expenses as '${bulkStatusToApply}'?`}
        confirmText="Update Status"
        variant="info"
      />
    </motion.div>
  );
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  onRefresh: () => void;
  initialData?: Expense | null;
  categories: BudgetCategory[];
  budgets: Budget[];
  expenses: Expense[];
}

export function ExpenseModal({ isOpen, onClose, onSave, onRefresh, initialData, categories, budgets, expenses }: ExpenseModalProps) {
  const [formData, setFormData] = useState<Expense>({
    id: `EXP-${Date.now()}`,
    category: '',
    amount: 0,
    date: formatLocalDate(),
    due_date: formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    description: '',
    status: 'Paid',
    is_recurring: false,
    frequency: 'Monthly',
    duration_months: 12,
    end_date: ''
  });

  const [budgetUtil, setBudgetUtil] = useState<{ spent: number; limit: number; percentage: number; isOver: boolean } | null>(null);
  const [isDeleteSeriesConfirmOpen, setIsDeleteSeriesConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...initialData,
          is_recurring: initialData.is_recurring || false,
          frequency: initialData.frequency || 'Monthly',
          duration_months: initialData.duration_months || 12,
          end_date: initialData.end_date || '',
          recurring_id: initialData.recurring_id
        });
      } else {
        setFormData({
          id: `EXP-${Date.now()}`,
          category: categories[0]?.name || '',
          amount: 0,
          date: formatLocalDate(),
          due_date: formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          description: '',
          status: 'Paid',
          is_recurring: false,
          frequency: 'Monthly',
          duration_months: 12,
          end_date: ''
        });
      }
    }
  }, [initialData, isOpen, categories]);

  useEffect(() => {
    const budget = budgets.find(b => b.category === formData.category);
    if (!budget) {
      setBudgetUtil(null);
      return;
    }

    const now = new Date();
    const spent = expenses
      .filter(e => {
        if (e.category !== formData.category) return false;
        if (initialData && e.id === initialData.id) return false;
        const expDate = parseLocalDate(e.date);
        if (budget.period === 'Monthly') {
          return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        } else if (budget.period === 'Quarterly') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const expQuarter = Math.floor(expDate.getMonth() / 3);
          return currentQuarter === expQuarter && expDate.getFullYear() === now.getFullYear();
        } else if (budget.period === 'Yearly') {
          return expDate.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalSpent = spent + formData.amount;
    const percentage = budget.limit_amount > 0 ? (totalSpent / budget.limit_amount) * 100 : 0;
    
    setBudgetUtil({
      spent: totalSpent,
      limit: budget.limit_amount,
      percentage,
      isOver: totalSpent > budget.limit_amount
    });
  }, [formData.category, formData.amount, budgets, expenses, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleDeleteSeries = () => {
    if (formData.recurring_id) {
      setIsDeleteSeriesConfirmOpen(true);
    }
  };

  const confirmDeleteSeries = () => {
    if (formData.recurring_id) {
      try {
        dataService.deleteRecurringSeries(formData.recurring_id);
        onRefresh();
        onClose();
        setIsDeleteSeriesConfirmOpen(false);
      } catch (error) {
        console.error('Failed to delete recurring series:', error);
      }
    }
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
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 jamaica-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">
                    {initialData ? 'Edit Expense' : 'Add Expense'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Record a business expenditure</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Expense ID</label>
                  <input 
                    type="text" 
                    value={formData.id}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number" 
                      required
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date" 
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Due Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date" 
                      value={formData.due_date || ''}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div className="col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-brand-500 shadow-sm">
                        <Repeat size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-jamaica-black uppercase tracking-tight">Recurring Expense</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Automatically create future entries</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_recurring: !formData.is_recurring })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                        formData.is_recurring ? "bg-brand-600" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.is_recurring ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {formData.is_recurring && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200"
                    >
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
                        <select 
                          value={formData.frequency}
                          onChange={(e) => setFormData({...formData, frequency: e.target.value as any})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Duration Type</label>
                        <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, end_date: '' })}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                              !formData.end_date ? "bg-brand-50 text-brand-700" : "text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            Months
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, end_date: formatLocalDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) })}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                              formData.end_date ? "bg-brand-50 text-brand-700" : "text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            End Date
                          </button>
                        </div>
                      </div>

                      {!formData.end_date ? (
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Number of Months</label>
                          <input 
                            type="number" 
                            min="1"
                            max="60"
                            value={formData.duration_months}
                            onChange={(e) => setFormData({...formData, duration_months: Number(e.target.value)})}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                          <input 
                            type="date" 
                            value={formData.end_date}
                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {budgetUtil && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Target size={14} className={budgetUtil.isOver ? "text-rose-500" : "text-brand-500"} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Impact</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        budgetUtil.isOver ? "text-rose-600" : "text-brand-600"
                      )}>
                        {budgetUtil.isOver ? 'Over Budget' : 'Within Budget'}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-500">Total Spent: {formatCurrency(budgetUtil.spent)}</span>
                        <span className="text-slate-500">Limit: {formatCurrency(budgetUtil.limit)}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            budgetUtil.isOver ? "bg-rose-500" : "bg-brand-500"
                          )}
                          style={{ width: `${Math.min(budgetUtil.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">
                        Including this expense, you'll use {budgetUtil.percentage.toFixed(1)}% of your {formData.category} budget.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  rows={3}
                  placeholder="What was this expense for?"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {initialData ? 'Update Expense' : 'Add Expense'}
                  </button>
                </div>
                
                {initialData?.recurring_id && (
                  <button 
                    type="button"
                    onClick={handleDeleteSeries}
                    className="w-full px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={14} />
                    Delete Entire Recurring Series
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={isDeleteSeriesConfirmOpen}
        onClose={() => setIsDeleteSeriesConfirmOpen(false)}
        onConfirm={confirmDeleteSeries}
        title="Delete Recurring Series"
        message="Are you sure you want to delete this entire recurring series? This will remove all future occurrences of this expense."
        confirmText="Delete Series"
        variant="danger"
      />
    </AnimatePresence>
  );
}
