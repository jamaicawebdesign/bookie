import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Percent, 
  Download,
  Plus,
  FileText,
  Settings
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Sidebar, PageId } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { DataGrid } from './components/DataGrid';
import { AnalyticsPage } from './components/AnalyticsPage';
import { DataSourcesPage } from './components/DataSourcesPage';
import { SettingsPage } from './components/SettingsPage';
import { SecuritySettingsPage } from './components/SecuritySettingsPage';
import { TeamManagementPage } from './components/TeamManagementPage';
import { AuthPage } from './components/AuthPage';
import { LandingPage } from './components/LandingPage';
import { DataVisualisationPage } from './components/DataVisualisationPage';
import { DataImportPage } from './components/DataImportPage';
import { InvoicesPage, InvoiceModal } from './components/InvoicesPage';
import { ExpensesPage, ExpenseModal } from './components/ExpensesPage';
import { BudgetsPage, BudgetModal } from './components/BudgetsPage';
import { ClientsPage, ClientModal } from './components/ClientsPage';
import { AccountsPage } from './components/AccountsPage';
import { AccountModal } from './components/AccountModal';
import { LedgerPage, JournalEntryModal } from './components/LedgerPage';
import { BankReconciliationPage } from './components/BankReconciliationPage';
import { ReportsPage } from './components/ReportsPage';
import { JamaicaCompliancePage } from './components/JamaicaCompliancePage';
import { AccountsReceivablePage } from './components/AccountsReceivablePage';
import { AccountsPayablePage } from './components/AccountsPayablePage';
import { ExportModal, ExportFilters } from './components/ExportModal';
import { TransactionModal } from './components/TransactionModal';
import { CategoryManagementModal } from './components/CategoryManagementModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { TopBar, SettingsSection } from './components/TopBar';
import { dataService } from './services/dataService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { DataRecord, BudgetCategory, Budget, Expense, Client, Account, JournalEntry } from './types';
import { formatCurrency, parseLocalDate, formatLocalDate, sanitizeCsvCell } from './lib/utils';
import { hasPermission, normalizeRole } from './lib/permissions';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [publicView, setPublicView] = useState<'landing' | 'auth'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [authInitialPlan, setAuthInitialPlan] = useState<string>('Essential Monthly Bookkeeping');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [transactions, setTransactions] = useState<DataRecord[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'data'>('overview');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DataRecord | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [taxRate, setTaxRate] = useState<number>(15);

  const loadAllLocalData = () => {
    fetchTransactions();
    fetchCategories();
    fetchSettings();
    fetchBudgets();
    fetchExpenses();
    fetchClients();
    fetchAccounts();
    fetchJournalEntries();
  };

  useEffect(() => {
    const handleSynced = () => {
      loadAllLocalData();
    };
    window.addEventListener('island-data-synced', handleSynced);

    if (isSupabaseConfigured && supabase) {
      let isMounted = true;

      supabase.auth
        .getSession()
        .then(async ({ data: { session } }) => {
          if (!isMounted) return;
          if (session?.user) {
            try {
              const profile = await dataService.syncFromSupabase(session.user.id, session.user);
              if (isMounted) {
                setUser(profile);
                loadAllLocalData();
              }
            } catch (err) {
              console.error('Failed to sync Supabase data:', err);
            }
          } else {
            const localUser = dataService.getUser();
            if (localUser?.authMode === 'local' && isMounted) {
              setUser(localUser);
              loadAllLocalData();
            }
          }
          if (isMounted) setIsAuthLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          const localUser = dataService.getUser();
          if (localUser?.authMode === 'local') {
            setUser(localUser);
            loadAllLocalData();
          }
          setIsAuthLoading(false);
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          return;
        }
        if (event === 'SIGNED_OUT') {
          dataService.clearSession();
          setIsPasswordRecovery(false);
          setUser(null);
        } else if (!session?.user) {
          const localUser = dataService.getUser();
          if (localUser?.authMode !== 'local') {
            dataService.clearSession();
            setIsPasswordRecovery(false);
            setUser(null);
          }
        } else if (session?.user && dataService.getActiveUserId() !== session.user.id) {
          const profile = await dataService.syncFromSupabase(session.user.id, session.user);
          if (isMounted) {
            setUser(profile);
            loadAllLocalData();
          }
        }
      });

      return () => {
        isMounted = false;
        window.removeEventListener('island-data-synced', handleSynced);
        subscription.unsubscribe();
      };
    } else {
      const savedUser = dataService.getUser();
      if (savedUser) {
        setUser(savedUser);
        loadAllLocalData();
      }

      return () => {
        window.removeEventListener('island-data-synced', handleSynced);
      };
    }
  }, []);

  // Enforce configurable inactivity auto-lock timeout while signed in
  useEffect(() => {
    if (!user) return;
    let timerId: number | null = null;

    const scheduleTimer = () => {
      if (timerId !== null) window.clearTimeout(timerId);
      const timeoutMinutes = Number(dataService.getSecuritySettings()?.sessionTimeout ?? 30);
      if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) return;

      timerId = window.setTimeout(() => {
        dataService.recordAuditLog({
          actor: user?.email || user?.name || 'User',
          category: 'Auth',
          action: 'Session auto-locked',
          details: `Signed out after ${timeoutMinutes} minutes of inactivity`,
          status: 'Info',
        });
        handleLogout();
      }, timeoutMinutes * 60 * 1000);
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((ev) => window.addEventListener(ev, scheduleTimer, { passive: true }));
    window.addEventListener('island-data-synced', scheduleTimer);
    scheduleTimer();

    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, scheduleTimer));
      window.removeEventListener('island-data-synced', scheduleTimer);
    };
  }, [user]);

  const fetchSettings = () => {
    const settings = dataService.getSettings();
    if (settings.tax_rate != null) {
      setTaxRate(Number(settings.tax_rate));
    }
  };

  const fetchCategories = () => {
    const data = dataService.getCategories();
    setCategories(data);
  };

  const fetchBudgets = () => {
    const data = dataService.getBudgets();
    setBudgets(data);
  };

  const fetchExpenses = () => {
    const data = dataService.getExpenses();
    setExpenses(data);
  };

  const fetchClients = () => {
    const data = dataService.getClients();
    setClients(data);
  };

  const fetchAccounts = () => {
    const data = dataService.getAccounts();
    setAccounts(data);
  };

  const fetchJournalEntries = () => {
    const data = dataService.getJournalEntries();
    setJournalEntries(data);
  };

  const fetchTransactions = () => {
    const data = dataService.getTransactions();
    setTransactions(data);
  };

  const handleSaveTransaction = (transaction: DataRecord) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.saveTransaction(transaction);
    fetchTransactions();
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.deleteTransaction(id);
    fetchTransactions();
  };

  const handleSaveInvoice = (invoice: any) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.saveInvoice(invoice);
    setIsInvoiceModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleSaveExpense = (expense: any) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.saveExpense(expense);
    fetchExpenses();
    setIsExpenseModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleSaveBudget = (budget: Budget) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.saveBudget(budget);
    fetchBudgets();
    setIsBudgetModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleSaveClient = (client: Client) => {
    if (!hasPermission(user, 'manage_transactions')) return;
    dataService.saveClient(client);
    fetchClients();
    setIsClientModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleSaveAccount = (account: Account) => {
    if (!hasPermission(user, 'manage_ledger')) return;
    dataService.saveAccount(account);
    fetchAccounts();
    setIsAccountModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleSaveJournalEntry = (entry: JournalEntry) => {
    if (!hasPermission(user, 'manage_ledger')) return;
    dataService.saveJournalEntry(entry);
    fetchJournalEntries();
    setIsJournalModalOpen(false);
    window.dispatchEvent(new CustomEvent('island-data-synced'));
  };

  const handleLogin = (userData: any) => {
    const activeUser = dataService.activateWorkspaceForUser(userData);
    setUser(activeUser);
    loadAllLocalData();
    dataService.recordAuditLog({
      actor: activeUser?.email || activeUser?.name || 'User',
      category: 'Auth',
      action: 'User signed in',
      details: `${activeUser?.authMode === 'local' ? 'Local Workspace' : 'Cloud Session'} · ${normalizeRole(activeUser?.role)}`,
      status: 'Success',
    });
  };

  const handleLaunchDemo = () => {
    handleLogin({
      name: 'Kareem Campbell',
      email: 'finance@bluemountainlogistics.com',
      role: 'Owner',
      company: 'Blue Mountain Logistics Ltd.',
      workspaceId: 'ws-default',
      authMode: 'local',
      photo: '',
    });
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut skipped:', err);
      }
    }
    dataService.clearSession();
    setUser(null);
    setPublicView('landing');
  };

  const exportToCSV = (filters: ExportFilters) => {
    const filteredData = transactions.filter(d => {
      const date = parseLocalDate(d.date);
      const start = filters.startDate ? parseLocalDate(filters.startDate) : null;
      const end = filters.endDate ? parseLocalDate(filters.endDate) : null;
      
      const isWithinDateRange = (!start || date >= start) && (!end || date <= end);
      const isStatusMatch = filters.statuses.includes(d.status);
      
      return isWithinDateRange && isStatusMatch;
    });

    if (filteredData.length === 0) {
      return;
    }

    const headers = ['ID', 'Date', 'Region', 'Category', 'Revenue', 'Cost', 'Profit', 'Customers', 'Status'];
    const rows = filteredData.map(d => [
      d.id,
      d.date,
      d.region,
      d.category,
      d.revenue,
      d.cost,
      d.profit,
      d.customers,
      d.status
    ]);

    const csvContent = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map(row => row.map(sanitizeCsvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `island_bookkeeping_ledger_${formatLocalDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 jamaica-gradient rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg animate-pulse">
            I
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <AuthPage
        initialMode="update-password"
        onPasswordUpdated={() => setIsPasswordRecovery(false)}
        onLogin={handleLogin}
      />
    );
  }

  if (!user) {
    if (publicView === 'auth') {
      return (
        <AuthPage
          initialMode={authInitialMode}
          initialPlan={authInitialPlan}
          onLogin={handleLogin}
          onBackToHome={() => setPublicView('landing')}
        />
      );
    }

    return (
      <LandingPage
        onGetStarted={(planName) => {
          if (planName) {
            setAuthInitialPlan(planName);
          }
          setAuthInitialMode('signup');
          setPublicView('auth');
        }}
        onSignIn={() => {
          setAuthInitialMode('login');
          setPublicView('auth');
        }}
        onLaunchDemo={handleLaunchDemo}
        isDemoAvailable={!isSupabaseConfigured}
      />
    );
  }

  const totalRevenue = transactions.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalProfit = transactions.reduce((acc, curr) => acc + curr.profit, 0);
  const totalCustomers = transactions.reduce((acc, curr) => acc + curr.customers, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const renderContent = () => {
    switch (activePage) {
      case 'analytics':
        return <AnalyticsPage transactions={transactions} />;
      case 'data-sources':
        return <DataSourcesPage />;
      case 'settings':
        return <SettingsPage user={user} onUpdateUser={setUser} initialSection={settingsSection} />;
      case 'team':
        return <TeamManagementPage user={user} onSwitchUser={(nextUser) => handleLogin(nextUser)} />;
      case 'security':
        return <SecuritySettingsPage />;
      case 'visualisation':
        return <DataVisualisationPage transactions={transactions} />;
      case 'import':
        return <DataImportPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'budgets':
        return <BudgetsPage 
          onEdit={(budget) => {
            setEditingBudget(budget);
            setIsBudgetModalOpen(true);
          }} 
        />;
      case 'clients':
        return <ClientsPage 
          onEdit={(client) => {
            setEditingClient(client);
            setIsClientModalOpen(true);
          }} 
        />;
      case 'accounts':
        return <AccountsPage 
          onEdit={(account) => {
            setEditingAccount(account);
            setIsAccountModalOpen(true);
          }} 
        />;
      case 'ledger':
        return <LedgerPage />;
      case 'reconciliation':
        return <BankReconciliationPage />;
      case 'accounts_receivable':
        return <AccountsReceivablePage />;
      case 'accounts_payable':
        return <AccountsPayablePage />;
      case 'reports':
        return <ReportsPage onNavigateToReconciliation={() => setActivePage('reconciliation')} />;
      case 'jamaica-compliance':
        return <JamaicaCompliancePage />;
      default:
        const monthlyData = transactions.reduce((acc: any[], curr) => {
          const month = parseLocalDate(curr.date).toLocaleString('default', { month: 'short' });
          const existing = acc.find(d => d.name === month);
          if (existing) {
            existing.revenue += curr.revenue;
            existing.profit += curr.profit;
          } else {
            acc.push({ name: month, revenue: curr.revenue, profit: curr.profit });
          }
          return acc;
        }, []).sort((a, b) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return months.indexOf(a.name) - months.indexOf(b.name);
        });

        const regionalData = transactions.reduce((acc: any[], curr) => {
          const existing = acc.find(d => d.name === curr.region);
          if (existing) {
            existing.value += curr.revenue;
          } else {
            acc.push({ name: curr.region, value: curr.revenue });
          }
          return acc;
        }, []);

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <StatCard 
                title="Total Revenue" 
                value={totalRevenue} 
                type="currency" 
                trend={0} 
                icon={DollarSign} 
                delay={0.1}
              />
              <StatCard 
                title="Net Profit" 
                value={totalProfit} 
                type="currency" 
                trend={0} 
                icon={TrendingUp} 
                delay={0.2}
              />
              <StatCard 
                title="Total Customers" 
                value={totalCustomers} 
                type="number" 
                trend={0} 
                icon={Users} 
                delay={0.3}
              />
              <StatCard 
                title="Avg. Margin" 
                value={avgMargin} 
                type="percent" 
                trend={0} 
                icon={Percent} 
                delay={0.4}
              />
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'overview' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-400 hover:text-jamaica-black'}`}
              >
                Visual Overview
              </button>
              <button 
                onClick={() => setActiveTab('data')}
                className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'data' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-400 hover:text-jamaica-black'}`}
              >
                Raw Transactions
              </button>
            </div>

            {activeTab === 'overview' ? (
              <div className="space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 glass-panel p-6 rounded-2xl h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-900">Revenue & Profit Trends</h3>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-brand-500" />
                          <span className="text-xs text-slate-500">Revenue</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          <span className="text-xs text-slate-500">Profit</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                      <AreaChart data={monthlyData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => `$${v/1000}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [formatCurrency(value), '']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProf)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="glass-panel p-6 rounded-2xl h-[400px]">
                    <h3 className="font-bold text-slate-900 mb-6">Regional Performance</h3>
                    <ResponsiveContainer width="100%" height="85%">
                      <BarChart data={regionalData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {regionalData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0ea5e9' : '#38bdf8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-jamaica-black tracking-tighter uppercase">Transaction Ledger</h2>
                </div>
                <DataGrid 
                  data={transactions} 
                  onEdit={(record) => {
                    setEditingTransaction(record);
                    setIsTransactionModalOpen(true);
                  }}
                  onDelete={handleDeleteTransaction}
                />
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          activePage={activePage} 
          onPageChange={setActivePage} 
          onLogout={handleLogout} 
          user={user}
        />
        
        <main className="flex-1 p-8 overflow-y-auto">
          <TopBar
            user={user}
            activePage={activePage}
            onUpdateUser={setUser}
            onNavigate={(page, section) => {
              if (section) setSettingsSection(section);
              setActivePage(page);
            }}
            onLogout={handleLogout}
          >
            {activePage === 'dashboard' && (
              <div className="flex gap-2">
                {hasPermission(user, 'manage_transactions') && (
                  <button 
                    onClick={() => {
                      setEditingTransaction(null);
                      setIsTransactionModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                  >
                    <Plus size={16} />
                    New Record
                  </button>
                )}
                <button 
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            )}
            {activePage === 'invoices' && hasPermission(user, 'manage_transactions') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  Create Invoice
                </button>
              </div>
            )}
            {activePage === 'expenses' && hasPermission(user, 'manage_transactions') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  Add Expense
                </button>
              </div>
            )}
            {activePage === 'budgets' && hasPermission(user, 'manage_transactions') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingBudget(null);
                    setIsBudgetModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  New Budget
                </button>
                <button 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <Settings size={16} />
                  Categories
                </button>
              </div>
            )}
            {activePage === 'clients' && hasPermission(user, 'manage_transactions') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingClient(null);
                    setIsClientModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  Add Client
                </button>
              </div>
            )}
            {activePage === 'accounts' && hasPermission(user, 'manage_ledger') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingAccount(null);
                    setIsAccountModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  New Account
                </button>
              </div>
            )}
            {activePage === 'ledger' && hasPermission(user, 'manage_ledger') && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsJournalModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  <Plus size={16} />
                  New Entry
                </button>
              </div>
            )}
            {activePage === 'reports' && (
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest"
                >
                  <FileText size={16} />
                  Print
                </button>
              </div>
            )}
          </TopBar>
          {(normalizeRole(user?.role) === 'Viewer' || normalizeRole(user?.role) === 'Bookkeeper') && (
            <div className="mb-6 px-5 py-3 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-black uppercase tracking-wider text-accent-400">
                  {normalizeRole(user?.role)} Access
                </span>
                <span className="text-slate-300 ml-2">
                  {normalizeRole(user?.role) === 'Viewer'
                    ? 'Read-only access active — financial statements and audit views are enabled; creating or editing entries is restricted.'
                    : 'Operational bookkeeping access active — transactions, clients, invoices, and expenses are enabled; ledger adjustments and team controls require Accountant or Owner access.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('team')}
                className="text-xs font-bold text-brand-400 hover:text-brand-300 whitespace-nowrap cursor-pointer self-start sm:self-auto"
              >
                View Permissions
              </button>
            </div>
          )}
          {renderContent()}

          <ExportModal 
            isOpen={isExportModalOpen} 
            onClose={() => setIsExportModalOpen(false)} 
            onExport={exportToCSV} 
          />

          <TransactionModal
            isOpen={isTransactionModalOpen}
            onClose={() => {
              setIsTransactionModalOpen(false);
              setEditingTransaction(null);
            }}
            onSave={handleSaveTransaction}
            initialData={editingTransaction}
          />

          {/* Quick Action Modals */}
          <InvoiceModal
            isOpen={isInvoiceModalOpen}
            onClose={() => setIsInvoiceModalOpen(false)}
            onSave={handleSaveInvoice}
            defaultTaxRate={taxRate}
          />
          <ExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => setIsExpenseModalOpen(false)}
            onSave={handleSaveExpense}
            onRefresh={() => {}}
            categories={categories}
            budgets={budgets}
            expenses={expenses}
          />
          <BudgetModal
            isOpen={isBudgetModalOpen}
            onClose={() => setIsBudgetModalOpen(false)}
            onSave={handleSaveBudget}
            initialData={editingBudget}
            categories={categories}
          />
          <ClientModal
            isOpen={isClientModalOpen}
            onClose={() => setIsClientModalOpen(false)}
            onSave={handleSaveClient}
            initialData={editingClient}
          />
          <AccountModal
            isOpen={isAccountModalOpen}
            onClose={() => setIsAccountModalOpen(false)}
            onSave={handleSaveAccount}
            initialData={editingAccount}
            accounts={accounts}
          />
          <JournalEntryModal
            isOpen={isJournalModalOpen}
            onClose={() => setIsJournalModalOpen(false)}
            onSave={handleSaveJournalEntry}
            accounts={accounts}
          />
          <CategoryManagementModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            categories={categories}
            onRefresh={fetchCategories}
          />
        </main>
      </div>

      <footer className="w-full bg-white border-t border-slate-200 py-3.5 px-6 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-3 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 jamaica-gradient rounded-lg flex items-center justify-center text-white font-black text-[10px]">
            I
          </div>
          <p className="text-xs font-bold text-black">
            Copyright @ 2026 Island Bookkeeping. All Rights Reserved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-black">
          <button
            type="button"
            onClick={() => setActivePage('reports')}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Financial Reports
          </button>
          <button
            type="button"
            onClick={() => setActivePage('jamaica-compliance')}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Jamaica Tax &amp; Payroll
          </button>
          <button
            type="button"
            onClick={() => setActivePage('accounts')}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Chart of Accounts
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsSection('billing');
              setActivePage('settings');
            }}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Tax & Billing
          </button>
          <button
            type="button"
            onClick={() => setActivePage('security')}
            className="hover:text-brand-600 transition-colors cursor-pointer"
          >
            Security
          </button>
        </div>

        <p className="text-xs font-bold text-black">
          Developed by <span className="text-brand-600">Island Web Consultants</span>
        </p>
      </footer>
    </div>
  );
}
