import { DataRecord } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { Inbox, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmationModal } from './ConfirmationModal';
import { dataService } from '../services/dataService';

interface DataGridProps {
  data: DataRecord[];
  onEdit?: (record: DataRecord) => void;
  onDelete?: (id: string) => void;
}

export function DataGrid({ data, onEdit, onDelete }: DataGridProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const isEmpty = !data || data.length === 0;
  const canEdit = dataService.can('manage_transactions');

  const handleDelete = (id: string) => {
    setRecordToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!recordToDelete) return;
    onDelete?.(recordToDelete);
    setIsDeleteConfirmOpen(false);
    setRecordToDelete(null);
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden border-slate-100 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Region</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profit</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isEmpty ? (
              <tr>
                <td colSpan={8} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                      <Inbox size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No transactions found</p>
                      <p className="text-slate-500 text-sm font-medium">There are no transactions to display at this time.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((record) => (
                <tr key={record.id} className="hover:bg-brand-50/40 transition-all group cursor-default border-l-4 border-l-transparent hover:border-l-brand-500">
                  <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{record.id}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600">{record.date}</td>
                  <td className="px-6 py-4 text-sm text-jamaica-black font-black tracking-tight">{record.region}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{record.category}</td>
                  <td className="px-6 py-4 text-sm text-jamaica-black font-black text-right">{formatCurrency(record.revenue)}</td>
                  <td className="px-6 py-4 text-sm text-brand-700 font-black text-right">{formatCurrency(record.profit)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      record.status === 'Completed' ? "bg-brand-50 text-brand-700" :
                      record.status === 'Pending' ? "bg-accent-50 text-accent-700" :
                      "bg-rose-50 text-rose-700"
                    )}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button 
                          onClick={() => onEdit?.(record)}
                          className="p-2.5 bg-white text-brand-600 border border-brand-100 hover:bg-brand-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-brand-500/40 hover:scale-110 active:scale-95"
                          title="Edit Record"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="p-2.5 bg-white text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-rose-500/40 hover:scale-110 active:scale-95"
                          title="Delete Record"
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

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setRecordToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
