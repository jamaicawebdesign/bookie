import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar,
  FileDown
} from 'lucide-react';
import { Client, Invoice } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { dataService } from '../services/dataService';
import { ConfirmationModal } from './ConfirmationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ClientsPage({ onEdit }: { onEdit: (client: Client) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<'All' | 'WithEmail' | 'WithCompany'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);

  const fetchData = () => {
    try {
      const data = dataService.getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('island-data-synced', fetchData);
    return () => window.removeEventListener('island-data-synced', fetchData);
  }, []);

  const handleClientClick = (client: Client) => {
    const invoices = dataService.getInvoices().filter(inv => inv.client_name === client.name);
    setClientInvoices(invoices);
    setSelectedClient(client);
  };

  const canEdit = dataService.can('manage_transactions');

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    setClientToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!clientToDelete) return;
    try {
      dataService.deleteClient(clientToDelete);
      fetchData();
      setIsDeleteConfirmOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const filteredClients = clients.filter(client => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (client.name || '').toLowerCase().includes(q) ||
      (client.company || '').toLowerCase().includes(q) ||
      (client.email || '').toLowerCase().includes(q);
    const matchesFilter =
      clientFilter === 'All' ||
      (clientFilter === 'WithEmail' && Boolean(client.email?.trim())) ||
      (clientFilter === 'WithCompany' && Boolean(client.company?.trim()));
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, company, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
          />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value as any)}
          className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-brand-500/10"
        >
          <option value="All">All Clients</option>
          <option value="WithEmail">With Email</option>
          <option value="WithCompany">With Company</option>
        </select>
      </div>

      {/* Clients Grid/Table */}
      <div className="glass-panel rounded-[2rem] border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Company</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Added</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 border-b border-slate-50">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                        <Users size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No clients found</p>
                        <p className="text-slate-500 text-sm font-medium">Try adjusting your search or add a new client.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => handleClientClick(client)}
                    className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50 last:border-0 cursor-pointer"
                  >
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg shadow-sm">
                          {(client.name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm text-jamaica-black font-black tracking-tight">{client.name}</p>
                          {client.company && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                              <Building2 size={10} />
                              {client.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="space-y-1.5">
                        {client.email && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Mail size={12} className="text-slate-300" />
                            {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Phone size={12} className="text-slate-300" />
                            {client.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      {client.address ? (
                        <div className="flex items-start gap-2 text-xs font-bold text-slate-500 max-w-[200px]">
                          <MapPin size={12} className="text-slate-300 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">Not provided</span>
                      )}
                    </td>
                    <td className="px-6 py-6 text-xs font-bold text-slate-400">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-6 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(client);
                            }}
                            className="p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(client.id);
                            }}
                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                            title="Delete"
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
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setClientToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Client"
        message="Are you sure you want to delete this client? This will also affect any invoices associated with this client."
        confirmText="Delete"
        variant="danger"
      />

      <ClientDetailPanel 
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        client={selectedClient}
        invoices={clientInvoices}
      />
    </motion.div>
  );
}

interface ClientDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  invoices: Invoice[];
}

function ClientDetailPanel({ isOpen, onClose, client, invoices }: ClientDetailPanelProps) {
  if (!client) return null;

  const handleDownloadStatement = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('ACCOUNT STATEMENT', 20, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 145, 25);
    
    // Client Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(client.name, 20, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (client.company) doc.text(client.company, 20, 55);
    if (client.email) doc.text(client.email, 20, 60);
    if (client.phone) doc.text(client.phone, 20, 65);
    if (client.address) doc.text(client.address, 20, 70, { maxWidth: 80 });

    // Summary Box
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount + (inv.tax_amount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => {
      const invTotal = inv.amount + (inv.tax_amount || 0);
      if (inv.status === 'Paid') return sum + invTotal;
      const partialPaid = (inv.payment_history || []).reduce((pSum, p) => pSum + p.amount, 0);
      return sum + Math.min(invTotal, partialPaid);
    }, 0);
    const balanceDue = Math.max(0, totalInvoiced - totalPaid);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, 45, 75, 30, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Statement Summary', 125, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Invoiced:`, 125, 58);
    doc.text(formatCurrency(totalInvoiced), 190, 58, { align: 'right' });
    doc.text(`Total Paid:`, 125, 64);
    doc.text(formatCurrency(totalPaid), 190, 64, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Current Balance:`, 125, 71);
    doc.text(formatCurrency(balanceDue), 190, 71, { align: 'right' });

    // Transaction Table
    const tableData = invoices.map(inv => [
      inv.id,
      inv.date,
      inv.due_date,
      inv.status,
      formatCurrency(inv.amount + (inv.tax_amount || 0))
    ]);

    autoTable(doc, {
      head: [['Invoice ID', 'Date', 'Due Date', 'Status', 'Amount']],
      body: tableData,
      startY: 85,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });
    
    doc.save(`statement_${client.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 jamaica-gradient rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 font-black text-xl">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-jamaica-black uppercase tracking-tight leading-none">
                    {client.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Client Profile</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-slate-400 hover:bg-white rounded-2xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-jamaica-black">
                    <Building2 size={16} className="text-slate-300" />
                    {client.company || 'Not specified'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Since</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-jamaica-black">
                    <Calendar size={16} className="text-slate-300" />
                    {new Date(client.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-jamaica-black">
                    <Mail size={16} className="text-brand-500" />
                    {client.email || 'Not specified'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-jamaica-black">
                    <Phone size={16} className="text-brand-500" />
                    {client.phone || 'Not specified'}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm font-medium text-slate-600">
                  <MapPin size={18} className="text-slate-300 shrink-0 mt-0.5" />
                  {client.address || 'No address provided'}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Notes</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600 min-h-[100px]">
                  {client.notes || 'No notes available for this client.'}
                </div>
              </div>

              {/* Invoices List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Associated Invoices</p>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md">
                    {invoices.length} Total
                  </span>
                </div>
                
                <div className="space-y-3">
                  {invoices.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400">No invoices found for this client.</p>
                    </div>
                  ) : (
                    invoices.map(invoice => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-200 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                            invoice.status === 'Paid' ? "bg-emerald-50 text-emerald-600" :
                            invoice.status === 'Overdue' ? "bg-rose-50 text-rose-600" :
                            "bg-amber-50 text-amber-600"
                          )}>
                            {invoice.status.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-jamaica-black">{invoice.id}</p>
                            <p className="text-[10px] font-bold text-slate-400">{new Date(invoice.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-jamaica-black">{formatCurrency(invoice.amount + (invoice.tax_amount || 0))}</p>
                          <div className={cn(
                            "text-[8px] font-black uppercase tracking-widest mt-0.5",
                            invoice.status === 'Paid' ? "text-emerald-500" :
                            invoice.status === 'Overdue' ? "text-rose-500" :
                            "text-amber-500"
                          )}>
                            {invoice.status}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-slate-100 flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Close
              </button>
              <button 
                onClick={handleDownloadStatement}
                className="flex-[2] px-6 py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2"
              >
                <FileDown size={20} />
                Download Statement
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  initialData?: Client | null;
}

export function ClientModal({ isOpen, onClose, onSave, initialData }: ClientModalProps) {
  const [formData, setFormData] = useState<Client>({
    id: `CLT-${Date.now()}`,
    name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    notes: '',
    created_at: new Date().toISOString()
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: `CLT-${Date.now()}`,
        name: '',
        email: '',
        phone: '',
        address: '',
        company: '',
        notes: '',
        created_at: new Date().toISOString()
      });
    }
  }, [initialData, isOpen]);

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
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 jamaica-gradient rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-jamaica-black uppercase tracking-tight">
                    {initialData ? 'Edit Client' : 'Add New Client'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Customer Information</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-slate-400 hover:bg-white rounded-2xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                  <input 
                    type="text" 
                    value={formData.company || ''}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                    placeholder="e.g. Island Tech"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                    placeholder="+1 (876) ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                <textarea 
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all resize-none"
                  placeholder="Street, City, Parish"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                <textarea 
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all resize-none"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-[2] px-8 py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {initialData ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
