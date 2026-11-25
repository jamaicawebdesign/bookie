import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users,
  BarChart3, 
  Database, 
  Settings, 
  LogOut, 
  Search,
  PieChart as PieChartIcon,
  Upload,
  FileText,
  Receipt,
  DollarSign,
  Target,
  Shield,
  BookOpen,
  ClipboardList,
  BarChart,
  Scale,
  UsersRound,
  Landmark
} from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeRole } from '../lib/permissions';

export type PageId = 'dashboard' | 'analytics' | 'data-sources' | 'settings' | 'visualisation' | 'import' | 'invoices' | 'expenses' | 'budgets' | 'clients' | 'security' | 'team' | 'accounts' | 'ledger' | 'reconciliation' | 'reports' | 'jamaica-compliance' | 'accounts_receivable' | 'accounts_payable';

interface SidebarProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  onLogout: () => void;
  user: any;
}

export function Sidebar({ activePage, onPageChange, onLogout, user }: SidebarProps) {
  const [navSearch, setNavSearch] = useState('');

  const navItems: { icon: any; label: string; id: PageId; keywords?: string }[] = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Users, label: 'Clients', id: 'clients' },
    { icon: FileText, label: 'Invoices', id: 'invoices' },
    { icon: Receipt, label: 'Expenses', id: 'expenses' },
    { icon: DollarSign, label: 'Accounts Receivable', id: 'accounts_receivable' },
    { icon: Receipt, label: 'Accounts Payable', id: 'accounts_payable' },
    { icon: Target, label: 'Budgets', id: 'budgets' },
    { icon: BookOpen, label: 'Chart of Accounts', id: 'accounts' },
    { icon: ClipboardList, label: 'General Ledger', id: 'ledger' },
    { icon: Scale, label: 'Bank Reconciliation', id: 'reconciliation' },
    { icon: BarChart, label: 'Financial Reports', id: 'reports' },
    {
      icon: Landmark,
      label: 'Jamaica Tax & Payroll',
      id: 'jamaica-compliance',
      keywords: 'nis nht heart ed tax education tax paye gct 4a s01 s02 p24 taj statutory',
    },
    { icon: BarChart3, label: 'Analytics', id: 'analytics' },
    { icon: Database, label: 'Data Sources', id: 'data-sources' },
    { icon: Upload, label: 'Data Import', id: 'import' },
    { icon: PieChartIcon, label: 'Visualisation', id: 'visualisation' },
    { icon: UsersRound, label: 'Team & Access', id: 'team' },
    { icon: Shield, label: 'Security', id: 'security' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  const filteredNavItems = navItems.filter((item) => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      Boolean(item.keywords && item.keywords.includes(q))
    );
  });

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col h-full sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 jamaica-gradient rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-500/20">
          I
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tighter text-white leading-none">Island</span>
          <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Bookkeeping</span>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder="Filter menu..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredNavItems.length > 0 ? filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all group",
              activePage === item.id 
                ? "bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-sm" 
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              activePage === item.id ? "bg-brand-500 text-white shadow-sm" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300"
            )}>
              <item.icon size={16} />
            </div>
            {item.label}
            {activePage === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(254,209,0,0.8)]" />}
          </button>
        )) : (
          <p className="px-4 py-3 text-xs text-slate-500 font-medium">No matching pages</p>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-white/5 rounded-2xl border border-white/10">
          <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold overflow-hidden">
            {user?.photo ? (
              <img src={user.photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              (user?.name || 'U').substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">{user?.name || 'User'}</span>
            <span className="text-[10px] text-slate-400 font-semibold truncate">
              {normalizeRole(user?.role)} · {user?.company || 'Workspace'}
            </span>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
