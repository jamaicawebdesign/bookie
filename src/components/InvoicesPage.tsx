import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Save,
  User,
  DollarSign,
  Calendar,
  Eye,
  CreditCard,
  History,
  List,
  CheckSquare
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '../types';
import { cn, formatCurrency, formatLocalDate, sanitizeCsvCell } from '../lib/utils';
import { dataService } from '../services/dataService';
import { ConfirmationModal } from './ConfirmationModal';

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [taxRate, setTaxRate] = useState<number>(15);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const today = formatLocalDate();

  const fetchData = () => {
    try {
      const invoicesData = dataService.getInvoices();
      const settingsData = dataService.getSettings();
      
      setInvoices(invoicesData);
      if (settingsData.tax_rate) {
        setTaxRate(Number(settingsData.tax_rate));
      }

      // Update selected invoice if it's currently open
      setSelectedInvoice(prev => {
        if (!prev) return null;
        return invoicesData.find(inv => inv.id === prev.id) || prev;
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('island-data-synced', fetchData);
    return () => window.removeEventListener('island-data-synced', fetchData);
  }, []);

  const handleSave = (invoice: Invoice) => {
    try {
      dataService.saveInvoice(invoice);
      fetchData();
    } catch (error) {
      console.error('Failed to save invoice:', error);
    }
  };

  const canEdit = dataService.can('manage_transactions');

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    setInvoiceToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!invoiceToDelete || !canEdit) return;
    try {
      dataService.deleteInvoice(invoiceToDelete);
      fetchData();
      setIsDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    if (!canEdit) return;
    try {
      const updatedInvoice = { ...invoice, status: 'Paid' as const };
      dataService.saveInvoice(updatedInvoice);
      fetchData();
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
    }
  };

  const handleBulkStatusUpdate = (status: 'Paid' | 'Unpaid' | 'Overdue') => {
    if (!canEdit || selectedIds.length === 0) return;
    try {
      dataService.bulkUpdateInvoiceStatus(selectedIds, status);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error('Failed to update invoices status:', error);
    }
  };

  const handleBulkDelete = () => {
    if (!canEdit || selectedIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDownloadPDF = () => {
    if (selectedIds.length === 0) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));

    selectedInvoices.forEach((invoice, index) => {
      if (index > 0) doc.addPage();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text('INVOICE', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Invoice ID: ${invoice.id}`, 14, 30);
      doc.text(`Date: ${invoice.date}`, 14, 35);
      doc.text(`Due Date: ${invoice.due_date}`, 14, 40);
      
      // Client Info
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text('BILL TO:', 14, 55);
      doc.setFontSize(14);
      doc.text(invoice.client_name, 14, 62);
      
      // Line Items Table
      const items = invoice.line_items || [];
      const tableData = items.length > 0
        ? items.map(item => [
            item.description,
            item.quantity.toString(),
            formatCurrency(item.rate),
            formatCurrency(item.tax_amount || 0),
            formatCurrency(item.amount)
          ])
        : [[
            invoice.description || 'Services Rendered',
            '1',
            formatCurrency(invoice.amount),
            formatCurrency(invoice.tax_amount || 0),
            formatCurrency(invoice.amount + (invoice.tax_amount || 0))
          ]];
      
      autoTable(doc, {
        startY: 75,
        head: [['Description', 'Qty', 'Rate', 'Tax', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255] },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      });
      
      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Subtotal:', pageWidth - 60, finalY);
      doc.text(formatCurrency(invoice.amount), pageWidth - 14, finalY, { align: 'right' });
      
      if (invoice.tax_amount) {
        doc.text(`Tax (${invoice.tax_rate}%):`, pageWidth - 60, finalY + 7);
        doc.text(formatCurrency(invoice.tax_amount), pageWidth - 14, finalY + 7, { align: 'right' });
      }
      
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text('Total:', pageWidth - 60, finalY + 17);
      doc.text(formatCurrency(invoice.amount + (invoice.tax_amount || 0)), pageWidth - 14, finalY + 17, { align: 'right' });
      
      // Status Badge
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      const statusColor = invoice.status === 'Paid' ? [16, 185, 129] : invoice.status === 'Unpaid' ? [245, 158, 11] : [239, 68, 68];
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(14, finalY + 5, 30, 8, 2, 2, 'F');
      doc.text(invoice.status.toUpperCase(), 29, finalY + 10.5, { align: 'center' });
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', pageWidth / 2, 285, { align: 'center' });
      doc.text(`Page ${index + 1} of ${selectedInvoices.length}`, pageWidth - 14, 285, { align: 'right' });
    });

    doc.save(`bulk_invoices_${formatLocalDate()}.pdf`);
  };

  const confirmBulkDelete = () => {
    try {
      dataService.bulkDeleteInvoices(selectedIds);
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchData();
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      console.error('Failed to delete invoices:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (invoice.client_name || '').toLowerCase().includes(q) || 
                         (invoice.id || '').toLowerCase().includes(q);
    const isOverdue = invoice.status !== 'Paid' && invoice.due_date < today;
    const effectiveStatus = isOverdue ? 'Overdue' : invoice.status;
    const matchesStatus = statusFilter === 'All' || effectiveStatus === statusFilter;
    const matchesDate = (!startDate || invoice.date >= startDate) && 
                       (!endDate || invoice.date <= endDate);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;

    const headers = ['Invoice ID', 'Client', 'Subtotal', 'Tax Rate (%)', 'Tax Amount', 'Total', 'Date', 'Due Date', 'Status', 'Description'];
    const rows = filteredInvoices.map(i => [
      i.id,
      i.client_name || '',
      i.amount,
      i.tax_rate || 0,
      i.tax_amount || 0,
      i.amount + (i.tax_amount || 0),
      i.date,
      i.due_date,
      i.status,
      i.description || ''
    ]);

    const csvContent = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map(row => row.map(sanitizeCsvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `invoices_export_${formatLocalDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentMonth = today.substring(0, 7); // YYYY-MM
  
  const invoiceStats = invoices.reduce((acc, curr) => {
    const totalAmount = curr.amount + (curr.tax_amount || 0);
    const paidFromHistory = (curr.payment_history || []).reduce((sum, p) => sum + p.amount, 0);
    const remainingDue = Math.max(0, totalAmount - paidFromHistory);
    const isPaid = curr.status === 'Paid';
    const isThisMonth = curr.date.startsWith(currentMonth);
    const paidInHistoryThisMonth = (curr.payment_history || [])
      .filter(p => p.date.startsWith(currentMonth))
      .reduce((sum, p) => sum + p.amount, 0);
    
    acc.totalInvoiced += totalAmount;
    acc.totalTax += (curr.tax_amount || 0);
    
    if (isPaid) {
      acc.totalPaid += totalAmount;
      if (paidInHistoryThisMonth > 0) {
        acc.paidThisMonth += paidInHistoryThisMonth;
      } else if (isThisMonth) {
        acc.paidThisMonth += totalAmount;
      }
    } else {
      acc.totalPaid += paidFromHistory;
      acc.paidThisMonth += paidInHistoryThisMonth;
      acc.totalOutstanding += remainingDue;
      if (curr.status === 'Overdue' || curr.due_date < today) {
        acc.totalOverdue += remainingDue;
      }
    }
    return acc;
  }, { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, totalOverdue: 0, totalTax: 0, paidThisMonth: 0 });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Outstanding</p>
          <h3 className="text-3xl font-black text-jamaica-black tracking-tighter">
            {formatCurrency(invoiceStats.totalOutstanding)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Paid This Month</p>
          <h3 className="text-3xl font-black text-brand-600 tracking-tighter">
            {formatCurrency(invoiceStats.paidThisMonth)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Tax Collected</p>
          <h3 className="text-3xl font-black text-indigo-600 tracking-tighter">
            {formatCurrency(invoiceStats.totalTax)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Overdue Invoices</p>
          <h3 className="text-3xl font-black text-rose-600 tracking-tighter">
            {invoices.filter(i => i.status !== 'Paid' && i.due_date < today).length}
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
                placeholder="Search invoices or clients..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 px-4 py-2 bg-brand-50 border border-brand-100 rounded-2xl mr-2 shadow-sm"
                >
                  <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest border-r border-brand-200 pr-3 mr-1">
                    {selectedIds.length} Selected
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleBulkStatusUpdate('Paid')}
                      className="p-2 text-emerald-600 hover:bg-emerald-100/50 rounded-xl transition-all"
                      title="Update status to Paid"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate('Unpaid')}
                      className="p-2 text-amber-600 hover:bg-amber-100/50 rounded-xl transition-all"
                      title="Mark as Unpaid"
                    >
                      <Clock size={18} />
                    </button>
                    <button 
                      onClick={() => handleBulkStatusUpdate('Overdue')}
                      className="p-2 text-rose-600 hover:bg-rose-100/50 rounded-xl transition-all"
                      title="Mark as Overdue"
                    >
                      <AlertCircle size={18} />
                    </button>
                  </div>
                  <div className="w-px h-4 bg-brand-200 mx-1" />
                  <button 
                    onClick={handleBulkDownloadPDF}
                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm shadow-brand-200"
                    title="Download Selected as PDF"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
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
            <button 
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds([]);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                isSelectionMode 
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <CheckSquare size={16} />
              {isSelectionMode ? "Exit Selection" : "Select Multiple"}
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border rounded-2xl text-sm font-bold transition-all shadow-sm",
                showFilters ? "bg-brand-50 border-brand-200 text-brand-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter size={18} />
              Filter
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50/50 border-b border-slate-100"
            >
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                {isSelectionMode && (
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
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
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 10 : 9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                        <FileText size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No invoices found</p>
                        <p className="text-slate-500 text-sm font-medium">Try adjusting your filters or search query.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className={cn(
                    "hover:bg-slate-50/80 transition-colors group",
                    selectedIds.includes(invoice.id) && "bg-brand-50/30"
                  )}>
                    {isSelectionMode && (
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(invoice.id)}
                          onChange={() => toggleSelect(invoice.id)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{invoice.id}</td>
                    <td className="px-6 py-4 text-sm text-jamaica-black font-black tracking-tight">{invoice.client_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-bold">{formatCurrency(invoice.amount)}</td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-medium">{formatCurrency(invoice.tax_amount || 0)}</td>
                    <td className="px-6 py-4 text-sm text-jamaica-black font-black">{formatCurrency(invoice.amount + (invoice.tax_amount || 0))}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{invoice.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-sm font-bold",
                          invoice.status !== 'Paid' && invoice.due_date < today ? "text-rose-600" : "text-slate-500"
                        )}>
                          {invoice.due_date}
                        </span>
                        {invoice.status !== 'Paid' && invoice.due_date < today && (
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter flex items-center gap-0.5">
                            <AlertCircle size={10} />
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const isOverdue = invoice.status !== 'Paid' && invoice.due_date < today;
                        const status = isOverdue ? 'Overdue' : invoice.status;
                        return (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                            status === 'Paid' ? "bg-brand-50 text-brand-700" :
                            status === 'Unpaid' ? "bg-accent-50 text-accent-700" :
                            "bg-rose-50 text-rose-700"
                          )}>
                            {status === 'Paid' && <CheckCircle2 size={10} />}
                            {status === 'Unpaid' && <Clock size={10} />}
                            {status === 'Overdue' && <AlertCircle size={10} />}
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:bg-slate-50 hover:text-jamaica-black rounded-xl transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {canEdit && invoice.status !== 'Paid' && (
                          <button 
                            onClick={() => handleMarkAsPaid(invoice)}
                            className="p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
                            title="Update status to Paid"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingInvoice(invoice);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(invoice.id)}
                              className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                              title="Delete"
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

      <InvoiceModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingInvoice(null);
        }} 
        onSave={handleSave}
        initialData={editingInvoice}
        defaultTaxRate={taxRate}
      />

      <InvoiceDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onEdit={(invoice) => {
          setEditingInvoice(invoice);
          setIsModalOpen(true);
        }}
        onUpdate={fetchData}
      />

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Bulk Delete Invoices"
        message={`Are you sure you want to delete ${selectedIds.length} invoices? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />
    </motion.div>
  );
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Invoice) => void;
  initialData?: Invoice | null;
  defaultTaxRate: number;
}

export function InvoiceDetailsModal({ isOpen, onClose, invoice, onEdit, onUpdate }: { isOpen: boolean; onClose: () => void; invoice: Invoice | null; onEdit: (invoice: Invoice) => void; onUpdate?: () => void }) {
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    date: formatLocalDate(),
    amount: 0,
    method: 'Bank Transfer',
    note: ''
  });

  if (!invoice) return null;

  const totalAmount = invoice.amount + (invoice.tax_amount || 0);
  const totalPaid = (invoice.payment_history || []).reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = Math.max(0, totalAmount - totalPaid);
  const todayStr = formatLocalDate();
  const displayStatus = invoice.status !== 'Paid' && invoice.due_date < todayStr ? 'Overdue' : invoice.status;

  const handleAddPayment = () => {
    if (newPayment.amount <= 0) return;

    const payment = {
      ...newPayment,
      id: Math.random().toString(36).substr(2, 9)
    };

    const updatedHistory = [...(invoice.payment_history || []), payment];
    const newTotalPaid = updatedHistory.reduce((sum, p) => sum + p.amount, 0);
    
    const updatedInvoice: Invoice = {
      ...invoice,
      payment_history: updatedHistory,
      status: newTotalPaid >= totalAmount ? 'Paid' : invoice.status
    };

    dataService.saveInvoice(updatedInvoice);
    setIsAddingPayment(false);
    setNewPayment({
      date: formatLocalDate(),
      amount: 0,
      method: 'Bank Transfer',
      note: ''
    });
    
    if (onUpdate) onUpdate();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('INVOICE', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Invoice ID: ${invoice.id}`, 14, 30);
    doc.text(`Date: ${invoice.date}`, 14, 35);
    doc.text(`Due Date: ${invoice.due_date}`, 14, 40);
    
    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('BILL TO:', 14, 55);
    doc.setFontSize(14);
    doc.text(invoice.client_name, 14, 62);
    
    // Line Items Table
    const items = invoice.line_items || [];
    const tableData = items.length > 0
      ? items.map(item => [
          item.description,
          item.quantity.toString(),
          formatCurrency(item.rate),
          formatCurrency(item.tax_amount || 0),
          formatCurrency(item.amount)
        ])
      : [[
          invoice.description || 'Services Rendered',
          '1',
          formatCurrency(invoice.amount),
          formatCurrency(invoice.tax_amount || 0),
          formatCurrency(invoice.amount + (invoice.tax_amount || 0))
        ]];
    
    autoTable(doc, {
      startY: 75,
      head: [['Description', 'Qty', 'Rate', 'Tax', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });
    
    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Subtotal:', pageWidth - 60, finalY);
    doc.text(formatCurrency(invoice.amount), pageWidth - 14, finalY, { align: 'right' });
    
    if (invoice.tax_amount) {
      doc.text(`Tax (${invoice.tax_rate}%):`, pageWidth - 60, finalY + 7);
      doc.text(formatCurrency(invoice.tax_amount), pageWidth - 14, finalY + 7, { align: 'right' });
    }
    
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('Total:', pageWidth - 60, finalY + 17);
    doc.text(formatCurrency(invoice.amount + (invoice.tax_amount || 0)), pageWidth - 14, finalY + 17, { align: 'right' });
    
    // Status Badge
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    const statusColor = invoice.status === 'Paid' ? [16, 185, 129] : invoice.status === 'Unpaid' ? [245, 158, 11] : [239, 68, 68];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(14, finalY + 5, 30, 8, 2, 2, 'F');
    doc.text(invoice.status.toUpperCase(), 29, finalY + 10.5, { align: 'center' });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your business!', pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`invoice_${invoice.id}.pdf`);
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
            className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 jamaica-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">
                    Invoice Details
                  </h3>
                  <p className="text-xs text-slate-500 font-mono font-bold">{invoice.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  displayStatus === 'Paid' ? "bg-brand-50 text-brand-700" :
                  displayStatus === 'Unpaid' ? "bg-accent-50 text-accent-700" :
                  "bg-rose-50 text-rose-700"
                )}>
                  {displayStatus}
                </span>
                <button 
                  onClick={() => {
                    onEdit(invoice);
                    onClose();
                  }}
                  className="p-2 text-slate-400 hover:bg-white hover:text-brand-600 rounded-lg transition-all shadow-sm"
                  title="Edit Invoice"
                >
                  <Edit2 size={20} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:bg-white rounded-lg transition-all shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</p>
                  <p className="text-sm font-black text-jamaica-black">{invoice.client_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-sm font-black text-jamaica-black">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Balance</p>
                  <p className={cn(
                    "text-sm font-black",
                    remainingBalance <= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {formatCurrency(remainingBalance)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Date</p>
                  <p className="text-sm font-bold text-slate-600">{invoice.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</p>
                  <p className="text-sm font-bold text-slate-600">{invoice.due_date}</p>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-jamaica-black">
                  <List size={18} className="text-brand-500" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Line Items</h4>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-center">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Tax</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invoice.line_items && invoice.line_items.length > 0 ? (
                        invoice.line_items.map((item) => (
                          <tr key={item.id} className="text-sm">
                            <td className="px-4 py-3 font-bold text-slate-700">{item.description}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.rate)}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.tax_amount || 0)}</td>
                            <td className="px-4 py-3 text-right font-black text-jamaica-black">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic text-xs">
                            No line items recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {invoice.line_items && invoice.line_items.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50/50">
                          <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</td>
                          <td className="px-4 py-3 text-right font-black text-brand-600">{formatCurrency(invoice.amount)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Payment History */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-jamaica-black">
                  <div className="flex items-center gap-2">
                    <History size={18} className="text-accent-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Payment History</h4>
                  </div>
                  {remainingBalance > 0 && !isAddingPayment && (
                    <button 
                      onClick={() => {
                        setNewPayment(prev => ({ ...prev, amount: remainingBalance }));
                        setIsAddingPayment(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all"
                    >
                      <Plus size={12} />
                      Record Payment
                    </button>
                  )}
                </div>

                {isAddingPayment && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-50 rounded-2xl border border-brand-100 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                        <input 
                          type="date"
                          value={newPayment.date}
                          onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
                        <input 
                          type="number"
                          value={newPayment.amount}
                          onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</label>
                        <select 
                          value={newPayment.method}
                          onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        >
                          <option>Bank Transfer</option>
                          <option>Cash</option>
                          <option>Check</option>
                          <option>Credit Card</option>
                          <option>Online Payment</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note</label>
                        <input 
                          type="text"
                          placeholder="Optional note"
                          value={newPayment.note}
                          onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setIsAddingPayment(false)}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleAddPayment}
                        className="px-4 py-2 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                      >
                        Save Payment
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {invoice.payment_history && invoice.payment_history.length > 0 ? (
                    invoice.payment_history.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                            <CreditCard size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-jamaica-black">{payment.method}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{payment.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600">+{formatCurrency(payment.amount)}</p>
                          {payment.note && <p className="text-[10px] text-slate-400 italic">{payment.note}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-xs text-slate-400 font-medium">No payments recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                Close
              </button>
              <button 
                onClick={handleDownloadPDF}
                className="px-6 py-3 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 flex items-center gap-2"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export function InvoiceModal({ isOpen, onClose, onSave, initialData, defaultTaxRate }: InvoiceModalProps) {
  const [formData, setFormData] = useState<Invoice>({
    id: '',
    client_name: '',
    amount: 0,
    tax_rate: defaultTaxRate,
    tax_amount: 0,
    date: formatLocalDate(),
    due_date: formatLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    status: 'Unpaid',
    description: '',
    line_items: [],
    payment_history: []
  });

  const fetchNextInvoiceNumber = () => {
    try {
      const nextNumber = dataService.getNextInvoiceNumber();
      setFormData(prev => ({ ...prev, id: nextNumber }));
    } catch (error) {
      console.error('Failed to fetch next invoice number:', error);
      setFormData(prev => ({ ...prev, id: `INV-${Date.now()}` }));
    }
  };

  useEffect(() => {
    if (initialData) {
      const rate = initialData.tax_rate ?? defaultTaxRate;
      const lineItems = (initialData.line_items || []).map(item => ({
        ...item,
        tax_amount: item.tax_amount ?? calculateTax(item.amount, rate)
      }));
      setFormData({
        ...initialData,
        tax_rate: rate,
        tax_amount: initialData.tax_amount ?? calculateTax(initialData.amount, rate),
        line_items: lineItems,
        payment_history: initialData.payment_history || []
      });
    } else if (isOpen) {
      setFormData({
        id: '',
        client_name: '',
        amount: 0,
        tax_rate: defaultTaxRate,
        tax_amount: 0,
        date: formatLocalDate(),
        due_date: formatLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        status: 'Unpaid',
        description: '',
        line_items: [],
        payment_history: []
      });
      fetchNextInvoiceNumber();
    }
  }, [initialData, isOpen, defaultTaxRate]);

  const calculateTax = (amount: number, rate: number) => {
    return (amount * rate) / 100;
  };

  const handleAmountChange = (val: number) => {
    const tax = calculateTax(val, formData.tax_rate || 0);
    setFormData({ ...formData, amount: val, tax_amount: tax });
  };

  const handleTaxRateChange = (rate: number) => {
    const newLineItems = (formData.line_items || []).map(item => ({
      ...item,
      tax_amount: calculateTax(item.amount, rate)
    }));
    const newSubtotal = newLineItems.length > 0 
      ? newLineItems.reduce((acc, curr) => acc + curr.amount, 0)
      : formData.amount;
    const newTax = calculateTax(newSubtotal, rate);
    setFormData({ ...formData, tax_rate: rate, tax_amount: newTax, line_items: newLineItems, amount: newSubtotal });
  };

  const addLineItem = () => {
    const newItem = {
      id: `LI-${Date.now()}`,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      tax_amount: 0
    };
    const newLineItems = [...(formData.line_items || []), newItem];
    const newSubtotal = newLineItems.reduce((acc, curr) => acc + curr.amount, 0);
    const newTax = calculateTax(newSubtotal, formData.tax_rate || 0);
    setFormData({ 
      ...formData, 
      line_items: newLineItems, 
      amount: newSubtotal,
      tax_amount: newTax
    });
  };

  const removeLineItem = (id: string) => {
    const newLineItems = (formData.line_items || []).filter(item => item.id !== id);
    const newSubtotal = newLineItems.reduce((acc, curr) => acc + curr.amount, 0);
    const newTax = calculateTax(newSubtotal, formData.tax_rate || 0);
    setFormData({ 
      ...formData, 
      line_items: newLineItems, 
      amount: newSubtotal,
      tax_amount: newTax
    });
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    const newLineItems = (formData.line_items || []).map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          updatedItem.tax_amount = calculateTax(updatedItem.amount, formData.tax_rate || 0);
        }
        return updatedItem;
      }
      return item;
    });
    const newSubtotal = newLineItems.reduce((acc, curr) => acc + curr.amount, 0);
    const newTax = calculateTax(newSubtotal, formData.tax_rate || 0);
    setFormData({ 
      ...formData, 
      line_items: newLineItems, 
      amount: newSubtotal,
      tax_amount: newTax
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 jamaica-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">
                    {initialData ? 'Edit Invoice' : 'New Invoice'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Create a professional bill for your client</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Invoice ID</label>
                  <input 
                    type="text" 
                    value={formData.id}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Client Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Kingston Tech Ltd"
                      value={formData.client_name}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Subtotal (Amount)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => handleAmountChange(Number(e.target.value))}
                      disabled={(formData.line_items || []).length > 0}
                      className={cn(
                        "w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all",
                        (formData.line_items || []).length > 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white"
                      )}
                    />
                  </div>
                  {(formData.line_items || []).length > 0 && (
                    <p className="text-[10px] text-slate-400 font-medium ml-1 italic">Calculated from line items</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tax Rate (%)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</div>
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="0.1"
                      value={formData.tax_rate}
                      onChange={(e) => handleTaxRateChange(Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tax Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number" 
                      disabled
                      value={formData.tax_amount?.toFixed(2)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-500 cursor-not-allowed"
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
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Issue Date</label>
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
                      required
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Line Items</label>
                  <button 
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all"
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {(formData.line_items || []).map((item, index) => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item #{index + 1}</span>
                        <button 
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-4 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                          <input 
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                            placeholder="Service description"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty</label>
                          <input 
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate</label>
                          <input 
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateLineItem(item.id, 'rate', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tax</label>
                          <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-500">
                            {formatCurrency(item.tax_amount || 0)}
                          </div>
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                          <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-jamaica-black">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(formData.line_items || []).length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                      <p className="text-xs text-slate-400 font-medium">No line items added yet. Click "Add Item" to start.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</p>
                  <p className="text-sm font-bold text-slate-600">{formatCurrency(formData.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax Amount</p>
                  <p className="text-sm font-bold text-slate-600">{formatCurrency(formData.tax_amount || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total (incl. tax)</p>
                  <p className="text-lg font-black text-brand-600">{formatCurrency(formData.amount + (formData.tax_amount || 0))}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  rows={3}
                  placeholder="Describe the services provided..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex gap-4">
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
                  {initialData ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
