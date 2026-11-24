import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Plus, 
  Search, 
  Filter, 
  Edit2,
  Trash2,
  X,
  Save,
  Tag,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Settings,
  TrendingUp,
  LineChart as LineChartIcon
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Budget, Expense, BudgetCategory } from '../types';
import { cn, formatCurrency, parseLocalDate, formatLocalDate } from '../lib/utils';
import { dataService } from '../services/dataService';
import { CategoryManagementModal } from './CategoryManagementModal';
import { ConfirmationModal } from './ConfirmationModal';

export function BudgetsPage({ onEdit }: { onEdit: (budget: Budget) => void }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [selectedBudgetForDetails, setSelectedBudgetForDetails] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForecast, setShowForecast] = useState(false);

  const fetchData = async () => {
    try {
      const budgetsData = dataService.getBudgets();
      const expensesData = dataService.getExpenses();
      const categoriesData = dataService.getCategories();
      setBudgets(budgetsData);
      setExpenses(expensesData);
      setCategories(categoriesData);
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

  const handleSave = async (budget: Budget) => {
    try {
      dataService.saveBudget(budget);
      fetchData();
    } catch (error) {
      console.error('Failed to save budget:', error);
    }
  };

  const canEdit = dataService.can('manage_transactions');

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    setBudgetToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!budgetToDelete) return;
    try {
      dataService.deleteBudget(budgetToDelete);
      fetchData();
      setIsDeleteModalOpen(false);
      setBudgetToDelete(null);
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  };

  const calculateProgress = (category: string, limit: number, period: string) => {
    const now = new Date();
    const spent = expenses
      .filter(e => {
        if (e.category !== category) return false;
        const expDate = parseLocalDate(e.date);
        if (period === 'Monthly') {
          return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        } else if (period === 'Quarterly') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const expQuarter = Math.floor(expDate.getMonth() / 3);
          return currentQuarter === expQuarter && expDate.getFullYear() === now.getFullYear();
        } else if (period === 'Yearly') {
          return expDate.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const remaining = limit - spent;
    
    // Calculate days remaining and daily average
    let daysInPeriod = 30;
    let dayOfPeriod = now.getDate();
    
    if (period === 'Monthly') {
      daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      dayOfPeriod = now.getDate();
    } else if (period === 'Quarterly') {
      daysInPeriod = 90;
      const startMonth = Math.floor(now.getMonth() / 3) * 3;
      const startDate = new Date(now.getFullYear(), startMonth, 1);
      dayOfPeriod = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (period === 'Yearly') {
      daysInPeriod = 365;
      const startDate = new Date(now.getFullYear(), 0, 1);
      dayOfPeriod = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const daysRemaining = Math.max(0, daysInPeriod - dayOfPeriod);
    const dailyAverage = dayOfPeriod > 0 ? spent / dayOfPeriod : 0;
    const projectedSpent = dailyAverage * daysInPeriod;
    const projectedPercentage = limit > 0 ? (projectedSpent / limit) * 100 : 0;
    const isProjectedOver = projectedSpent > limit;
    const dailyAllowance = daysRemaining > 0 ? Math.max(0, remaining / daysRemaining) : 0;
    
    // Calculate projected overrun date
    const daysUntilLimit = dailyAverage > 0 && remaining > 0 ? Math.floor(remaining / dailyAverage) : 0;
    const overrunDate = new Date();
    overrunDate.setDate(now.getDate() + daysUntilLimit);

    return { 
      spent, 
      percentage: Math.min(percentage, 100), 
      isOver: spent > limit,
      isWarning: percentage > 80 && spent <= limit,
      remaining,
      actualPercentage: percentage,
      projectedPercentage,
      daysRemaining,
      dailyAverage,
      projectedSpent,
      isProjectedOver,
      dailyAllowance,
      daysUntilLimit,
      overrunDate: overrunDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  const totalBudgeted = budgets.reduce((acc, curr) => acc + curr.limit_amount, 0);
  const totalSpent = budgets.reduce((acc, curr) => {
    const { spent } = calculateProgress(curr.category, curr.limit_amount, curr.period);
    return acc + spent;
  }, 0);

  const totalProjectedSpent = budgets.reduce((acc, curr) => {
    const { projectedSpent } = calculateProgress(curr.category, curr.limit_amount, curr.period);
    return acc + projectedSpent;
  }, 0);

  const isOverallProjectedOver = totalProjectedSpent > totalBudgeted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Budgeted</p>
          <h3 className="text-3xl font-black text-jamaica-black tracking-tighter">
            {formatCurrency(totalBudgeted)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Spent</p>
          <h3 className="text-3xl font-black text-brand-600 tracking-tighter">
            {formatCurrency(totalSpent)}
          </h3>
        </div>
        <div className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Overall Utilization</p>
          <h3 className={cn(
            "text-3xl font-black tracking-tighter",
            totalSpent > totalBudgeted ? "text-rose-600" : "text-emerald-600"
          )}>
            {totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(1) : 0}%
          </h3>
        </div>
        <div className={cn(
          "glass-panel p-6 rounded-3xl border shadow-sm relative overflow-hidden",
          isOverallProjectedOver ? "border-rose-100 bg-rose-50/20" : "border-slate-100"
        )}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Projected Total</p>
              <h3 className={cn(
                "text-3xl font-black tracking-tighter",
                isOverallProjectedOver ? "text-rose-600" : "text-brand-600"
              )}>
                {formatCurrency(totalProjectedSpent)}
              </h3>
            </div>
            <div className={cn(
              "p-2 rounded-xl",
              isOverallProjectedOver ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-brand-50 text-brand-600"
            )}>
              <TrendingUp size={20} />
            </div>
          </div>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest mt-2",
            isOverallProjectedOver ? "text-rose-500" : "text-slate-400"
          )}>
            {isOverallProjectedOver ? 'Potential Overrun' : 'Within Budget Trend'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass-panel p-6 rounded-3xl border-slate-100 shadow-sm animate-pulse">
              <div className="h-4 w-24 bg-slate-100 rounded mb-4" />
              <div className="h-8 w-32 bg-slate-200 rounded mb-6" />
              <div className="h-2 w-full bg-slate-100 rounded" />
            </div>
          ))
        ) : budgets.length === 0 ? (
          <div className="col-span-full glass-panel p-20 rounded-3xl border-slate-100 shadow-sm text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                <Target size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-jamaica-black font-black uppercase tracking-tight text-lg">No budgets set</p>
                <p className="text-slate-500 text-sm font-medium">Start by setting a spending limit for a category.</p>
              </div>
            </div>
          </div>
        ) : (
          budgets.map((budget) => {
              const { 
                spent, 
                percentage, 
                isOver, 
                isWarning, 
                remaining, 
                actualPercentage,
                projectedPercentage,
                daysRemaining,
                dailyAverage,
                projectedSpent,
                isProjectedOver,
                dailyAllowance,
                daysUntilLimit,
                overrunDate
              } = calculateProgress(budget.category, budget.limit_amount, budget.period);
            const categoryColor = categories.find(c => c.name === budget.category)?.color || '#009B3A';
            
            return (
              <motion.div 
                key={budget.id} 
                layoutId={budget.id}
                onClick={() => setSelectedBudgetForDetails(budget)}
                className={cn(
                  "glass-panel p-6 rounded-3xl border shadow-sm group relative overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-brand-500/5 transition-all",
                  isOver ? "border-rose-200 bg-rose-50/10" : isWarning ? "border-amber-200 bg-amber-50/10" : "border-slate-100"
                )}
              >
                {isOver && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
                )}
                {isWarning && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }} />
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {budget.category}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-jamaica-black tracking-tighter mt-2">
                      {formatCurrency(budget.limit_amount)}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{budget.period} Limit</p>
                  </div>
                    {canEdit && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(budget);
                          }}
                          className="p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(budget.id);
                          }}
                          className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spent</p>
                      <p className="text-sm font-black text-slate-700">{formatCurrency(spent)}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {isOver ? 'Over' : 'Remaining'}
                      </p>
                      <p className={cn(
                        "text-sm font-black",
                        isOver ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {formatCurrency(Math.abs(remaining))}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                      {/* 80% Warning Marker */}
                      <div className="absolute left-[80%] top-0 bottom-0 w-px bg-slate-300 z-10" />
                      
                      {/* Forecast Indicator (Ghost Bar) */}
                      {(isProjectedOver || showForecast) && (
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(projectedPercentage, 100)}%` }}
                          className={cn(
                            "absolute inset-0 z-0",
                            isProjectedOver ? "bg-rose-200/50" : "bg-emerald-200/50"
                          )}
                        />
                      )}
                      
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${showForecast ? Math.min(projectedPercentage, 100) : percentage}%` }}
                        className={cn(
                          "h-full rounded-full transition-all relative z-10",
                          (showForecast ? isProjectedOver : isOver) ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" : 
                          (showForecast ? projectedPercentage > 80 : isWarning) ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" : 
                          "bg-emerald-500"
                        )}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {showForecast ? (
                          isProjectedOver ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase tracking-widest animate-pulse">
                              <AlertTriangle size={12} />
                              Overrun Expected
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              <CheckCircle2 size={12} />
                              Forecast: Safe
                            </div>
                          )
                        ) : (
                          isOver ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase tracking-widest animate-pulse">
                              <AlertTriangle size={12} />
                              Limit Exceeded
                            </div>
                          ) : isWarning ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                              <AlertTriangle size={12} />
                              Approaching Limit
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              <CheckCircle2 size={12} />
                              On Track
                            </div>
                          )
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "text-[10px] font-black tracking-tight",
                          showForecast ? (isProjectedOver ? "text-rose-600" : "text-emerald-600") : (isOver ? "text-rose-600" : isWarning ? "text-amber-600" : "text-emerald-600")
                        )}>
                          {showForecast ? `Projected: ${projectedPercentage.toFixed(1)}%` : `Actual: ${actualPercentage.toFixed(1)}%`}
                        </span>
                        {!showForecast && (
                          <span className={cn(
                            "text-[8px] font-black tracking-tight uppercase",
                            isProjectedOver ? "text-rose-500" : "text-slate-400"
                          )}>
                            Forecast: {projectedPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown Section */}
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Daily Average</p>
                      <p className="text-xs font-bold text-slate-700">{formatCurrency(dailyAverage)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Allowance</p>
                      <p className={cn(
                        "text-xs font-bold",
                        dailyAllowance < dailyAverage ? "text-amber-600" : "text-emerald-600"
                      )}>{formatCurrency(dailyAllowance)}/day</p>
                    </div>
                    <div className="col-span-2 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Projected Total</p>
                        <div className="flex items-center gap-1">
                          <TrendingUp size={10} className={isProjectedOver ? "text-rose-500" : "text-emerald-500"} />
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest",
                            isProjectedOver ? "text-rose-500" : "text-emerald-500"
                          )}>
                            {isProjectedOver ? `Overrun on ${overrunDate}` : 'Safe Trend'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className={cn(
                          "text-lg font-black tracking-tight",
                          isProjectedOver ? "text-rose-600" : "text-jamaica-black"
                        )}>
                          {formatCurrency(projectedSpent)}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {daysRemaining} days left
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onRefresh={fetchData}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setBudgetToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This will remove the spending limit for this category, but will not delete your actual expenses."
        confirmText="Delete"
        variant="danger"
      />

      <BudgetDetailsModal
        budget={selectedBudgetForDetails}
        expenses={expenses}
        categories={categories}
        onClose={() => setSelectedBudgetForDetails(null)}
      />

      {/* Categories Section */}
      <section className="mt-16 pt-16 border-t border-slate-100">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-black text-jamaica-black tracking-tight uppercase">Budget Categories</h2>
            <p className="text-slate-500 text-sm font-medium">Define and customize your spending categories</p>
          </div>
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <Settings size={18} />
            Manage All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.slice(0, 4).map(cat => (
            <div key={cat.id} className="glass-panel p-4 rounded-2xl border-slate-100 flex items-center gap-4 group hover:border-brand-200 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                <Tag size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-jamaica-black uppercase tracking-tight truncate">{cat.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{cat.description || 'No description'}</p>
              </div>
            </div>
          ))}
          {categories.length > 4 && (
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="glass-panel p-4 rounded-2xl border-slate-100 flex items-center justify-center gap-2 text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all border-dashed"
            >
              <Plus size={18} />
              <span className="text-xs font-black uppercase tracking-widest">+{categories.length - 4} More</span>
            </button>
          )}
          {categories.length === 0 && (
             <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="col-span-full glass-panel p-8 rounded-2xl border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all border-dashed"
            >
              <Tag size={24} />
              <span className="text-xs font-black uppercase tracking-widest">Add your first category</span>
            </button>
          )}
        </div>
      </section>
    </motion.div>
  );
}

interface BudgetDetailsModalProps {
  budget: Budget | null;
  expenses: Expense[];
  onClose: () => void;
}

function BudgetDetailsModal({ budget, expenses, onClose, categories }: BudgetDetailsModalProps & { categories: BudgetCategory[] }) {
  if (!budget) return null;

  const categoryColor = categories.find(c => c.name === budget.category)?.color || '#009B3A';
  const now = new Date();
  const filteredExpenses = expenses
    .filter(e => {
      if (e.category !== budget.category) return false;
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
    .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

  const spent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const remaining = budget.limit_amount - spent;
  const actualPercentage = budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0;
  const percentage = Math.min(actualPercentage, 100);
  const isOver = spent > budget.limit_amount;
  const isWarning = actualPercentage > 80 && spent <= budget.limit_amount;

  // Calculate forecast data
  const daysInPeriod = budget.period === 'Monthly' ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 
                      budget.period === 'Quarterly' ? 90 : 365;
  
  let dayOfPeriod = now.getDate();
  if (budget.period === 'Quarterly') {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const startDate = new Date(now.getFullYear(), startMonth, 1);
    dayOfPeriod = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } else if (budget.period === 'Yearly') {
    const startDate = new Date(now.getFullYear(), 0, 1);
    dayOfPeriod = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const dailyAverage = dayOfPeriod > 0 ? spent / dayOfPeriod : 0;
  const projectedSpent = dailyAverage * daysInPeriod;
  const isProjectedOver = projectedSpent > budget.limit_amount;
  const daysRemaining = Math.max(0, daysInPeriod - dayOfPeriod);
  const dailyAllowance = daysRemaining > 0 ? Math.max(0, remaining / daysRemaining) : 0;

  // Calculate projected overrun date
  const daysUntilLimit = dailyAverage > 0 && remaining > 0 ? Math.floor(remaining / dailyAverage) : 0;
  const overrunDate = new Date();
  overrunDate.setDate(now.getDate() + daysUntilLimit);
  const formattedOverrunDate = overrunDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Prepare chart data using timezone-safe YYYY-MM-DD comparisons
  const chartData = Array.from({ length: dayOfPeriod }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (dayOfPeriod - 1 - i));
    const dayStr = formatLocalDate(date);
    
    const cumulativeSpent = filteredExpenses
      .filter(e => e.date <= dayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      day: i + 1,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spent: cumulativeSpent,
      limit: budget.limit_amount
    };
  });

  // Add forecast point
  const forecastData = [
    ...chartData,
    {
      day: daysInPeriod,
      date: 'End of Period',
      forecast: projectedSpent,
      limit: budget.limit_amount
    }
  ];

  return (
    <AnimatePresence>
      {budget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            layoutId={budget.id}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
                  isOver ? "bg-rose-500 shadow-rose-500/20" : "bg-brand-600 shadow-brand-500/20"
                )}>
                  <Target size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }} />
                    <h3 className="text-xl font-black text-jamaica-black uppercase tracking-tight">
                      {budget.category} Budget
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{budget.period} Overview</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-white rounded-xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget Limit</p>
                  <p className="text-xl font-black text-jamaica-black">{formatCurrency(budget.limit_amount)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
                  <p className={cn("text-xl font-black", isOver ? "text-rose-600" : "text-brand-600")}>
                    {formatCurrency(spent)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {isOver ? 'Over Budget' : 'Remaining'}
                  </p>
                  <p className={cn("text-xl font-black", isOver ? "text-rose-600" : "text-emerald-600")}>
                    {formatCurrency(Math.abs(remaining))}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Allowance</p>
                  <p className={cn(
                    "text-xl font-black",
                    dailyAllowance < dailyAverage ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(dailyAllowance)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Utilization</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual: {actualPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-rose-300" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forecast: {(budget.limit_amount > 0 ? (projectedSpent / budget.limit_amount) * 100 : 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                    {/* Forecast Bar */}
                    {isProjectedOver && (
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(budget.limit_amount > 0 ? (projectedSpent / budget.limit_amount) * 100 : 0, 100)}%` }}
                        className="absolute inset-0 bg-rose-200/50 z-0"
                      />
                    )}
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className={cn(
                      "h-full rounded-full transition-all relative z-10",
                      isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                    )}
                  />
                </div>
              </div>

              {/* Forecast Analysis Chart */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChartIcon size={18} className="text-brand-600" />
                    <h4 className="font-black text-jamaica-black uppercase tracking-tight text-sm">Spending Trend & Forecast</h4>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    isProjectedOver ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {isProjectedOver ? `Overrun on ${formattedOverrunDate}` : 'Safe Trend'}
                  </div>
                </div>
                
                <div className="h-64 w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData}>
                      <defs>
                        <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#009B3A" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#009B3A" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#94A3B8' }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#94A3B8' }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="spent" 
                        stroke="#009B3A" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSpent)" 
                        name="Actual Spent"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="forecast" 
                        stroke="#F43F5E" 
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        fillOpacity={1} 
                        fill="url(#colorForecast)" 
                        name="Projected"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="limit" 
                        stroke="#94A3B8" 
                        strokeWidth={1} 
                        strokeDasharray="3 3" 
                        dot={false}
                        name="Budget Limit"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Burn Rate</p>
                    <p className="text-lg font-black text-jamaica-black">{formatCurrency(dailyAverage)}</p>
                    <p className="text-[8px] text-slate-400 font-medium mt-1">Average spending per day</p>
                  </div>
                  <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Projected Total</p>
                    <p className={cn("text-lg font-black", isProjectedOver ? "text-rose-600" : "text-emerald-600")}>
                      {formatCurrency(projectedSpent)}
                    </p>
                    <p className="text-[8px] text-slate-400 font-medium mt-1">
                      {isProjectedOver ? `Predicted overrun on ${formattedOverrunDate}` : 'Within budget limits'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-jamaica-black uppercase tracking-tight text-sm">Recent Transactions</h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {filteredExpenses.length} Total
                  </span>
                </div>
                
                <div className="space-y-2">
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No transactions found</p>
                    </div>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all">
                            <TrendingDown size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-jamaica-black">{expense.description}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{expense.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-jamaica-black">{formatCurrency(expense.amount)}</p>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                            expense.status === 'Paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {expense.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-jamaica-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: Budget) => void;
  initialData?: Budget | null;
  categories: BudgetCategory[];
}


export function BudgetModal({ isOpen, onClose, onSave, initialData, categories }: BudgetModalProps) {
  const [formData, setFormData] = useState<Budget>({
    id: `BUD-${Date.now()}`,
    category: '',
    limit_amount: 0,
    period: 'Monthly'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: `BUD-${Date.now()}`,
        category: categories[0]?.name || '',
        limit_amount: 0,
        period: 'Monthly'
      });
    }
  }, [initialData, isOpen, categories]);

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
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 jamaica-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="font-black text-jamaica-black uppercase tracking-tight">
                    {initialData ? 'Edit Budget' : 'Set Budget'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Control your category spending</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Limit Amount ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={formData.limit_amount}
                    onChange={(e) => setFormData({...formData, limit_amount: Number(e.target.value)})}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Period</label>
                <select 
                  value={formData.period}
                  onChange={(e) => setFormData({...formData, period: e.target.value as any})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>
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
                  {initialData ? 'Update' : 'Set Budget'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
