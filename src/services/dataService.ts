import {
  DataRecord,
  BudgetCategory,
  Invoice,
  Expense,
  Client,
  Budget,
  Account,
  JournalEntry,
  AppNotification,
  JournalLine,
} from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { parseLocalDate, formatLocalDate } from "../lib/utils";

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const STORAGE_KEYS = {
  TRANSACTIONS: "island_transactions",
  CATEGORIES: "island_categories",
  INVOICES: "island_invoices",
  EXPENSES: "island_expenses",
  CLIENTS: "island_clients",
  SETTINGS: "island_settings",
  USER: "island_user",
  BUDGETS: "island_budgets",
  SECURITY: "island_security_settings",
  ACCOUNTS: "island_accounts",
  JOURNAL_ENTRIES: "island_journal_entries",
  NOTIFICATIONS: "island_notifications",
  ECOMMERCE_SOURCES: "island_ecommerce_sources",
  SYNC_LOGS: "island_sync_logs",
};

export interface EcommerceSource {
  id: string;
  name: string;
  type: "Shopify" | "WooCommerce";
  status: "connected" | "warning" | "disconnected";
  lastSync: string;
  orders: string;
  url?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface SyncLog {
  id: string;
  sourceId: string;
  timestamp: string;
  status: "success" | "error";
  message: string;
  details: string;
}

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "1", code: "1000", name: "Cash", type: "Asset", balance: 50000, description: "Main operating cash account", notes: "Reconcile daily" },
  { id: "2", code: "1100", name: "Accounts Receivable", type: "Asset", balance: 12000, description: "Money owed by customers", notes: "Follow up on invoices > 30 days" },
  { id: "3", code: "1200", name: "Inventory", type: "Asset", balance: 8000, description: "Products held for sale", notes: "Quarterly physical count required" },
  { id: "4", code: "2000", name: "Accounts Payable", type: "Liability", balance: 5000, description: "Money owed to suppliers", notes: "Pay within terms to avoid interest" },
  { id: "5", code: "2100", name: "Credit Card", type: "Liability", balance: 2500, description: "Business credit card balance", notes: "Auto-pay set for 15th of month" },
  { id: "6", code: "3000", name: "Owner Equity", type: "Equity", balance: 60000, description: "Owner's investment in the business", notes: "Initial capital contribution" },
  { id: "7", code: "4000", name: "Sales Revenue", type: "Revenue", balance: 15000, description: "Income from product sales", notes: "Includes online and in-store sales" },
  { id: "8", code: "5000", name: "Cost of Goods Sold", type: "Expense", balance: 7500, description: "Direct costs of products sold", notes: "Calculated monthly" },
  { id: "9", code: "5100", name: "Rent Expense", type: "Expense", balance: 2000, description: "Monthly office rent", notes: "Due on 1st of each month" },
  { id: "10", code: "5200", name: "Utilities Expense", type: "Expense", balance: 500, description: "Electricity, water, and internet", notes: "Includes office and warehouse" },
  { id: "11", code: "5300", name: "Marketing Expense", type: "Expense", balance: 1500, description: "Advertising and promotion costs", notes: "Social media and local ads" },
];

const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "1", name: "Marketing", color: "#0ea5e9", description: "Advertising and promotion" },
  { id: "2", name: "Operations", color: "#10b981", description: "Daily business operations" },
  { id: "3", name: "Payroll", color: "#f59e0b", description: "Employee salaries and benefits" },
  { id: "4", name: "Software", color: "#6366f1", description: "SaaS and tool subscriptions" },
  { id: "5", name: "Travel", color: "#ec4899", description: "Business trips and transport" },
];

const DEFAULT_SECURITY_SETTINGS = () => ({
  twoFactorEnabled: false,
  loginAlerts: true,
  sessionTimeout: 30,
  lastPasswordChange: new Date().toISOString(),
  activeSessions: [
    { id: "1", device: "Current Browser", location: "Kingston, Jamaica", lastActive: new Date().toISOString(), current: true },
  ],
  loginHistory: [
    { id: "1", date: new Date().toISOString(), status: "Success", ip: "Current Session", device: "Web App" },
  ],
});

let activeUserId: string | null = null;

function dispatchDataSynced() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("island-data-synced"));
  }
}

function runCloudSync(task: (client: NonNullable<typeof supabase>, userId: string) => Promise<void>) {
  if (!isSupabaseConfigured || !supabase || !activeUserId) return;
  const client = supabase;
  const uid = activeUserId;
  task(client, uid).catch((err) => {
    console.error("Supabase sync error:", err);
  });
}

export const dataService = {
  setActiveUserId: (userId: string | null) => {
    activeUserId = userId;
  },

  getActiveUserId: () => activeUserId,

  clearSession: () => {
    activeUserId = null;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },

  syncFromSupabase: async (
    userId: string,
    authUser?: { email?: string; user_metadata?: { name?: string; full_name?: string; company?: string } }
  ): Promise<any> => {
    if (!isSupabaseConfigured || !supabase) {
      return dataService.getUser();
    }

    activeUserId = userId;

    const [
      profileRes,
      transactionsRes,
      categoriesRes,
      budgetsRes,
      invoicesRes,
      expensesRes,
      clientsRes,
      accountsRes,
      journalRes,
      settingsRes,
      notificationsRes,
      sourcesRes,
      logsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("budget_categories").select("*").eq("user_id", userId),
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase.from("invoices").select("*").eq("user_id", userId),
      supabase.from("expenses").select("*").eq("user_id", userId),
      supabase.from("clients").select("*").eq("user_id", userId),
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("journal_entries").select("*").eq("user_id", userId),
      supabase.from("app_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("notifications").select("*").eq("user_id", userId),
      supabase.from("ecommerce_sources").select("*").eq("user_id", userId),
      supabase.from("sync_logs").select("*").eq("user_id", userId),
    ]);

    // 1. Profile
    const fallbackName =
      authUser?.user_metadata?.name ||
      authUser?.user_metadata?.full_name ||
      authUser?.email?.split("@")[0] ||
      "Business Owner";
    const fallbackCompany = authUser?.user_metadata?.company || "Island Bookkeeping";

    let userProfile = profileRes.data
      ? {
          id: profileRes.data.id,
          name: profileRes.data.name || fallbackName,
          email: profileRes.data.email || authUser?.email || "",
          role: profileRes.data.role || "Business Owner",
          company: profileRes.data.company || fallbackCompany,
          photo: profileRes.data.photo || "",
        }
      : {
          id: userId,
          name: fallbackName,
          email: authUser?.email || "",
          role: "Business Owner",
          company: fallbackCompany,
          photo: "",
        };

    if (!profileRes.data && !profileRes.error) {
      await supabase.from("profiles").upsert({
        id: userId,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        company: userProfile.company,
        photo: userProfile.photo,
      });
    }
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userProfile));

    // 2. Transactions
    if (!transactionsRes.error && transactionsRes.data) {
      const mapped: DataRecord[] = transactionsRes.data.map((r: any) => ({
        id: r.id,
        date: r.date,
        region: r.region,
        category: r.category,
        revenue: Number(r.revenue || 0),
        cost: Number(r.cost || 0),
        profit: Number(r.profit || 0),
        customers: Number(r.customers || 0),
        status: r.status,
      }));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(mapped));
    }

    // 3. Categories (seed defaults if empty)
    if (!categoriesRes.error && categoriesRes.data) {
      if (categoriesRes.data.length === 0) {
        await supabase.from("budget_categories").upsert(
          DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))
        );
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      } else {
        const mapped: BudgetCategory[] = categoriesRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || undefined,
          color: c.color || undefined,
        }));
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(mapped));
      }
    }

    // 4. Budgets
    if (!budgetsRes.error && budgetsRes.data) {
      const mapped: Budget[] = budgetsRes.data.map((b: any) => ({
        id: b.id,
        category: b.category,
        limit_amount: Number(b.limit_amount || 0),
        period: b.period,
      }));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(mapped));
    }

    // 5. Invoices
    if (!invoicesRes.error && invoicesRes.data) {
      const mapped: Invoice[] = invoicesRes.data.map((i: any) => ({
        id: i.id,
        client_name: i.client_name,
        amount: Number(i.amount || 0),
        tax_rate: i.tax_rate != null ? Number(i.tax_rate) : undefined,
        tax_amount: i.tax_amount != null ? Number(i.tax_amount) : undefined,
        date: i.date,
        due_date: i.due_date,
        status: i.status,
        description: i.description || undefined,
        line_items: Array.isArray(i.line_items) ? i.line_items : [],
        payment_history: Array.isArray(i.payment_history) ? i.payment_history : [],
      }));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(mapped));
    }

    // 6. Expenses
    if (!expensesRes.error && expensesRes.data) {
      const mapped: Expense[] = expensesRes.data.map((e: any) => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount || 0),
        date: e.date,
        due_date: e.due_date || undefined,
        description: e.description || undefined,
        status: e.status,
        is_recurring: Boolean(e.is_recurring),
        frequency: e.frequency || undefined,
        duration_months: e.duration_months != null ? Number(e.duration_months) : undefined,
        end_date: e.end_date || undefined,
        recurring_id: e.recurring_id || undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(mapped));
    }

    // 7. Clients
    if (!clientsRes.error && clientsRes.data) {
      const mapped: Client[] = clientsRes.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || undefined,
        phone: c.phone || undefined,
        address: c.address || undefined,
        company: c.company || undefined,
        notes: c.notes || undefined,
        created_at: c.created_at,
      }));
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(mapped));
    }

    // 8. Accounts (seed defaults if empty)
    if (!accountsRes.error && accountsRes.data) {
      if (accountsRes.data.length === 0) {
        await supabase.from("accounts").upsert(
          DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: userId }))
        );
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
      } else {
        const mapped: Account[] = accountsRes.data.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          description: a.description || undefined,
          notes: a.notes || undefined,
          balance: Number(a.balance || 0),
        }));
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(mapped));
      }
    }

    // 9. Journal Entries
    if (!journalRes.error && journalRes.data) {
      const mapped: JournalEntry[] = journalRes.data.map((j: any) => ({
        id: j.id,
        date: j.date,
        description: j.description,
        status: j.status,
        lines: Array.isArray(j.lines) ? j.lines : [],
      }));
      localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify(mapped));
    }

    // 10. Settings & Security
    if (!settingsRes.error) {
      if (settingsRes.data) {
        localStorage.setItem(
          STORAGE_KEYS.SETTINGS,
          JSON.stringify({
            tax_rate: Number(settingsRes.data.tax_rate ?? 15),
            currency: settingsRes.data.currency || "USD",
            invoice_prefix: settingsRes.data.invoice_prefix || "INV-",
          })
        );
        if (settingsRes.data.security_settings) {
          localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(settingsRes.data.security_settings));
        }
      } else {
        const defaultSec = DEFAULT_SECURITY_SETTINGS();
        await supabase.from("app_settings").upsert({
          user_id: userId,
          tax_rate: 15,
          currency: "USD",
          invoice_prefix: "INV-",
          security_settings: defaultSec,
        });
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ tax_rate: 15, currency: "USD", invoice_prefix: "INV-" }));
        localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(defaultSec));
      }
    }

    // 11. Notifications
    if (!notificationsRes.error && notificationsRes.data) {
      if (notificationsRes.data.length === 0) {
        const initial = dataService.generateInitialNotifications();
        if (initial.length > 0) {
          await supabase.from("notifications").upsert(
            initial.map((n) => ({
              id: n.id,
              user_id: userId,
              title: n.title,
              message: n.message,
              type: n.type,
              date: n.date,
              is_read: n.isRead,
              link: n.link || null,
            }))
          );
        }
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initial));
      } else {
        const mapped: AppNotification[] = notificationsRes.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          date: n.date,
          isRead: Boolean(n.is_read),
          link: n.link || undefined,
        }));
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mapped));
      }
    }

    // 12. eCommerce Sources
    if (!sourcesRes.error && sourcesRes.data) {
      const mapped: EcommerceSource[] = sourcesRes.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        lastSync: s.last_sync,
        orders: s.orders,
        url: s.url || undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.ECOMMERCE_SOURCES, JSON.stringify(mapped));
    }

    // 13. Sync Logs
    if (!logsRes.error && logsRes.data) {
      const mapped: SyncLog[] = logsRes.data.map((l: any) => ({
        id: l.id,
        sourceId: l.source_id,
        timestamp: l.timestamp,
        status: l.status,
        message: l.message,
        details: l.details,
      }));
      localStorage.setItem(STORAGE_KEYS.SYNC_LOGS, JSON.stringify(mapped));
    }

    dispatchDataSynced();
    return userProfile;
  },

  getTransactions: (): DataRecord[] => {
    return safeParseJSON<DataRecord[]>(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS), []);
  },

  saveTransaction: (transaction: DataRecord): void => {
    const transactions = dataService.getTransactions();
    const record: DataRecord = {
      ...transaction,
      id: transaction.id || Math.random().toString(36).substr(2, 9),
    };
    const index = transactions.findIndex((t) => t.id === record.id);
    if (index > -1) {
      transactions[index] = record;
    } else {
      transactions.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));

    runCloudSync(async (client, userId) => {
      const { error } = await client.from("transactions").upsert({
        id: record.id,
        user_id: userId,
        date: record.date,
        region: record.region,
        category: record.category,
        revenue: Number(record.revenue || 0),
        cost: Number(record.cost || 0),
        profit: Number(record.profit || 0),
        customers: Number(record.customers || 0),
        status: record.status,
      });
      if (error) throw error;
    });
  },

  deleteTransaction: (id: string): void => {
    const transactions = dataService.getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      const { error } = await client.from("transactions").delete().eq("user_id", userId).eq("id", id);
      if (error) throw error;
    });
  },

  getCategories: (): BudgetCategory[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return safeParseJSON<BudgetCategory[]>(data, DEFAULT_CATEGORIES);
  },

  saveCategory: (category: BudgetCategory): void => {
    const categories = dataService.getCategories();
    const record: BudgetCategory = {
      ...category,
      id: category.id || Math.random().toString(36).substr(2, 9),
    };
    const index = categories.findIndex((c) => c.id === record.id);
    if (index > -1) {
      categories[index] = record;
    } else {
      categories.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

    runCloudSync(async (client, userId) => {
      await client.from("budget_categories").upsert({
        id: record.id,
        user_id: userId,
        name: record.name,
        description: record.description || null,
        color: record.color || null,
      });
    });
  },

  deleteCategory: (id: string): void => {
    const categories = dataService.getCategories();
    const filtered = categories.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("budget_categories").delete().eq("user_id", userId).eq("id", id);
    });
  },

  getBudgets: (): Budget[] => {
    return safeParseJSON<Budget[]>(localStorage.getItem(STORAGE_KEYS.BUDGETS), []);
  },

  saveBudget: (budget: Budget): void => {
    const budgets = dataService.getBudgets();
    const record: Budget = {
      ...budget,
      id: budget.id || Math.random().toString(36).substr(2, 9),
    };
    const index = budgets.findIndex((b) => b.id === record.id);
    if (index > -1) {
      budgets[index] = record;
    } else {
      budgets.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));

    runCloudSync(async (client, userId) => {
      await client.from("budgets").upsert({
        id: record.id,
        user_id: userId,
        category: record.category,
        limit_amount: record.limit_amount,
        period: record.period,
      });
    });
  },

  deleteBudget: (id: string): void => {
    const budgets = dataService.getBudgets();
    const filtered = budgets.filter((b) => b.id !== id);
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("budgets").delete().eq("user_id", userId).eq("id", id);
    });
  },

  getInvoices: (): Invoice[] => {
    return safeParseJSON<Invoice[]>(localStorage.getItem(STORAGE_KEYS.INVOICES), []);
  },

  saveInvoice: (invoice: Invoice): void => {
    const invoices = dataService.getInvoices();
    const record: Invoice = {
      ...invoice,
      id: invoice.id || Math.random().toString(36).substr(2, 9),
    };
    const index = invoices.findIndex((i) => i.id === record.id);
    if (index > -1) {
      invoices[index] = record;
    } else {
      invoices.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));

    runCloudSync(async (client, userId) => {
      await client.from("invoices").upsert({
        id: record.id,
        user_id: userId,
        client_name: record.client_name,
        amount: record.amount,
        tax_rate: record.tax_rate ?? null,
        tax_amount: record.tax_amount ?? null,
        date: record.date,
        due_date: record.due_date,
        status: record.status,
        description: record.description ?? null,
        line_items: record.line_items ?? [],
        payment_history: record.payment_history ?? [],
      });
    });
  },

  deleteInvoice: (id: string): void => {
    const invoices = dataService.getInvoices();
    const filtered = invoices.filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("invoices").delete().eq("user_id", userId).eq("id", id);
    });
  },

  bulkUpdateInvoiceStatus: (ids: string[], status: "Paid" | "Unpaid" | "Overdue"): void => {
    const invoices = dataService.getInvoices();
    const updated = invoices.map((i) => (ids.includes(i.id) ? { ...i, status } : i));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));

    runCloudSync(async (client, userId) => {
      await client.from("invoices").update({ status }).eq("user_id", userId).in("id", ids);
    });
  },

  bulkDeleteInvoices: (ids: string[]): void => {
    const invoices = dataService.getInvoices();
    const filtered = invoices.filter((i) => !ids.includes(i.id));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("invoices").delete().eq("user_id", userId).in("id", ids);
    });
  },

  getExpenses: (): Expense[] => {
    return safeParseJSON<Expense[]>(localStorage.getItem(STORAGE_KEYS.EXPENSES), []);
  },

  saveExpense: (expense: Expense): void => {
    const expenses = dataService.getExpenses();
    const index = expenses.findIndex((e) => e.id === expense.id);
    const oldExpense = index > -1 ? expenses[index] : null;

    const updatedExpense: Expense = { ...expense };
    if (!updatedExpense.id) {
      updatedExpense.id = `EXP-${Math.random().toString(36).substr(2, 9)}`;
    }

    const deletedIds: string[] = [];
    const generatedExpenses: Expense[] = [];

    if (updatedExpense.is_recurring) {
      const settingsChanged =
        oldExpense &&
        (oldExpense.frequency !== updatedExpense.frequency ||
          oldExpense.duration_months !== updatedExpense.duration_months ||
          oldExpense.end_date !== updatedExpense.end_date ||
          !oldExpense.is_recurring);

      if (!oldExpense || settingsChanged) {
        if (oldExpense?.recurring_id) {
          const today = parseLocalDate(formatLocalDate());
          const kept: Expense[] = [];
          for (const e of expenses) {
            const shouldKeep =
              e.recurring_id !== oldExpense.recurring_id ||
              parseLocalDate(e.date) <= today ||
              e.id === updatedExpense.id;
            if (shouldKeep) kept.push(e);
            else deletedIds.push(e.id);
          }
          expenses.length = 0;
          expenses.push(...kept);
        }

        if (!updatedExpense.recurring_id) {
          updatedExpense.recurring_id = `REC-${Math.random().toString(36).substr(2, 9)}`;
        }

        const futureExpenses = dataService.generateFutureExpenses(updatedExpense);
        generatedExpenses.push(...futureExpenses);
        expenses.push(...futureExpenses);
      }
    } else if (oldExpense?.is_recurring) {
      const today = parseLocalDate(formatLocalDate());
      const kept: Expense[] = [];
      for (const e of expenses) {
        const shouldKeep =
          e.recurring_id !== oldExpense.recurring_id ||
          parseLocalDate(e.date) <= today ||
          e.id === updatedExpense.id;
        if (shouldKeep) kept.push(e);
        else deletedIds.push(e.id);
      }
      expenses.length = 0;
      expenses.push(...kept);
      updatedExpense.recurring_id = undefined;
    }

    const updatedIdx = expenses.findIndex((e) => e.id === updatedExpense.id);
    if (updatedIdx > -1) {
      expenses[updatedIdx] = updatedExpense;
    } else {
      expenses.push(updatedExpense);
    }

    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));

    const toUpsert = [updatedExpense, ...generatedExpenses];
    runCloudSync(async (client, userId) => {
      if (deletedIds.length > 0) {
        await client.from("expenses").delete().eq("user_id", userId).in("id", deletedIds);
      }
      await client.from("expenses").upsert(
        toUpsert.map((e) => ({
          id: e.id,
          user_id: userId,
          category: e.category,
          amount: e.amount,
          date: e.date,
          due_date: e.due_date ?? null,
          description: e.description ?? null,
          status: e.status,
          is_recurring: Boolean(e.is_recurring),
          frequency: e.frequency ?? null,
          duration_months: e.duration_months ?? null,
          end_date: e.end_date ?? null,
          recurring_id: e.recurring_id ?? null,
        }))
      );
    });
  },

  generateFutureExpenses: (baseExpense: Expense): Expense[] => {
    const futureExpenses: Expense[] = [];
    const startDate = parseLocalDate(baseExpense.date);
    if (Number.isNaN(startDate.getTime())) return futureExpenses;

    const frequency = baseExpense.frequency || "Monthly";
    let occurrences = 0;
    let endDate: Date;

    if (baseExpense.end_date) {
      endDate = parseLocalDate(baseExpense.end_date);
    } else if (baseExpense.duration_months) {
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + baseExpense.duration_months, startDate.getDate());
    } else {
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 12, startDate.getDate());
    }

    if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return futureExpenses;
    }

    const dueOffsetDays = baseExpense.due_date
      ? Math.round((parseLocalDate(baseExpense.due_date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const incrementDate = (date: Date, freq: string) => {
      if (freq === "Daily") {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      }
      if (freq === "Weekly") {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
      }
      if (freq === "Yearly") {
        return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
      }
      // Monthly (default): clamp to last day of target month
      const targetMonth = date.getMonth() + 1;
      const next = new Date(date.getFullYear(), targetMonth, date.getDate());
      if (next.getMonth() !== targetMonth % 12) {
        return new Date(date.getFullYear(), targetMonth + 1, 0);
      }
      return next;
    };

    let currentDate = incrementDate(startDate, frequency);

    while (currentDate <= endDate) {
      const dueDateObj =
        dueOffsetDays !== null && !Number.isNaN(dueOffsetDays)
          ? new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + dueOffsetDays)
          : null;

      futureExpenses.push({
        ...baseExpense,
        id: `EXP-REC-${Math.random().toString(36).substr(2, 9)}`,
        date: formatLocalDate(currentDate),
        due_date: dueDateObj ? formatLocalDate(dueDateObj) : undefined,
        status: "Pending",
        is_recurring: false,
        recurring_id: baseExpense.recurring_id,
      });

      currentDate = incrementDate(currentDate, frequency);
      occurrences++;

      if (occurrences > 1825) break;
    }

    return futureExpenses;
  },

  deleteRecurringSeries: (recurringId: string): void => {
    const expenses = dataService.getExpenses();
    const filtered = expenses.filter((e) => e.recurring_id !== recurringId);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("expenses").delete().eq("user_id", userId).eq("recurring_id", recurringId);
    });
  },

  deleteExpense: (id: string): void => {
    const expenses = dataService.getExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("expenses").delete().eq("user_id", userId).eq("id", id);
    });
  },

  bulkUpdateExpenseStatus: (ids: string[], status: "Paid" | "Pending" | "Overdue"): void => {
    const expenses = dataService.getExpenses();
    const updated = expenses.map((e) => (ids.includes(e.id) ? { ...e, status } : e));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));

    runCloudSync(async (client, userId) => {
      await client.from("expenses").update({ status }).eq("user_id", userId).in("id", ids);
    });
  },

  bulkDeleteExpenses: (ids: string[]): void => {
    const expenses = dataService.getExpenses();
    const filtered = expenses.filter((e) => !ids.includes(e.id));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("expenses").delete().eq("user_id", userId).in("id", ids);
    });
  },

  getClients: (): Client[] => {
    return safeParseJSON<Client[]>(localStorage.getItem(STORAGE_KEYS.CLIENTS), []);
  },

  saveClient: (client: Client): void => {
    const clients = dataService.getClients();
    const record: Client = {
      ...client,
      id: client.id || Math.random().toString(36).substr(2, 9),
      created_at: client.created_at || new Date().toISOString(),
    };
    const index = clients.findIndex((c) => c.id === record.id);
    if (index > -1) {
      clients[index] = record;
    } else {
      clients.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));

    runCloudSync(async (clientDb, userId) => {
      await clientDb.from("clients").upsert({
        id: record.id,
        user_id: userId,
        name: record.name,
        email: record.email ?? null,
        phone: record.phone ?? null,
        address: record.address ?? null,
        company: record.company ?? null,
        notes: record.notes ?? null,
        created_at: record.created_at,
      });
    });
  },

  deleteClient: (id: string): void => {
    const clients = dataService.getClients();
    const filtered = clients.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(filtered));

    runCloudSync(async (clientDb, userId) => {
      await clientDb.from("clients").delete().eq("user_id", userId).eq("id", id);
    });
  },

  getSettings: () => {
    const defaults = {
      tax_rate: 15,
      currency: "USD",
      invoice_prefix: "INV-",
      notifications: {
        emailAlerts: true,
        pushNotifications: false,
        weeklyReports: true,
        securityAlerts: true,
      },
    };
    const parsed = safeParseJSON<any>(localStorage.getItem(STORAGE_KEYS.SETTINGS), {});
    return {
      ...defaults,
      ...parsed,
      notifications: {
        ...defaults.notifications,
        ...(parsed?.notifications || {}),
      },
    };
  },

  saveSettings: (settings: any) => {
    const current = dataService.getSettings();
    const merged = {
      ...current,
      ...settings,
      notifications: {
        ...current.notifications,
        ...(settings?.notifications || {}),
      },
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    dispatchDataSynced();

    const securitySettings = dataService.getSecuritySettings();
    runCloudSync(async (client, userId) => {
      await client.from("app_settings").upsert({
        user_id: userId,
        tax_rate: Number(merged.tax_rate ?? 15),
        currency: merged.currency || "USD",
        invoice_prefix: merged.invoice_prefix || "INV-",
        security_settings: securitySettings,
        updated_at: new Date().toISOString(),
      });
    });
  },

  getSecuritySettings: () => {
    return safeParseJSON<any>(localStorage.getItem(STORAGE_KEYS.SECURITY), DEFAULT_SECURITY_SETTINGS());
  },

  saveSecuritySettings: (settings: any) => {
    localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(settings));
    dispatchDataSynced();

    const currentSettings = dataService.getSettings();
    runCloudSync(async (client, userId) => {
      await client.from("app_settings").upsert({
        user_id: userId,
        tax_rate: Number(currentSettings.tax_rate ?? 15),
        currency: currentSettings.currency || "USD",
        invoice_prefix: currentSettings.invoice_prefix || "INV-",
        security_settings: settings,
        updated_at: new Date().toISOString(),
      });
    });
  },

  getUser: () => {
    return safeParseJSON<any>(localStorage.getItem(STORAGE_KEYS.USER), null);
  },

  saveUser: (user: any) => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.USER);
      return null;
    }
    const existing = dataService.getUser() || {};
    const merged = { ...existing, ...user };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(merged));
    dispatchDataSynced();

    runCloudSync(async (client, userId) => {
      await client.from("profiles").upsert({
        id: userId,
        name: merged.name || "",
        email: merged.email || "",
        role: merged.role || "Business Owner",
        company: merged.company || "",
        photo: merged.photo || "",
        updated_at: new Date().toISOString(),
      });
    });
    return merged;
  },

  getUsers: (): any[] => {
    return safeParseJSON<any[]>(localStorage.getItem("island_users"), []);
  },

  saveUsers: (users: any[]): void => {
    localStorage.setItem("island_users", JSON.stringify(users));
  },

  getNextInvoiceNumber: (): string => {
    const invoices = dataService.getInvoices();
    const prefix = dataService.getSettings().invoice_prefix || "INV-";
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escapedPrefix}(\\d+)$`, "i");
    const invNumbers = invoices
      .map((i) => {
        const match = regex.exec(i.id) || /^INV-(\d+)$/i.exec(i.id);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null && !Number.isNaN(n));

    if (invNumbers.length === 0) return `${prefix}1001`;
    const maxNumber = Math.max(...invNumbers);
    return `${prefix}${maxNumber + 1}`;
  },

  getAccounts: (): Account[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    return safeParseJSON<Account[]>(data, DEFAULT_ACCOUNTS);
  },

  saveAccount: (account: Account): void => {
    const accounts = dataService.getAccounts();
    const record: Account = {
      ...account,
      id: account.id || Math.random().toString(36).substr(2, 9),
    };
    const index = accounts.findIndex((a) => a.id === record.id);
    if (index > -1) {
      accounts[index] = record;
    } else {
      accounts.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));

    runCloudSync(async (client, userId) => {
      await client.from("accounts").upsert({
        id: record.id,
        user_id: userId,
        code: record.code,
        name: record.name,
        type: record.type,
        description: record.description ?? null,
        notes: record.notes ?? null,
        balance: record.balance,
      });
    });
  },

  deleteAccount: (id: string): void => {
    const accounts = dataService.getAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("accounts").delete().eq("user_id", userId).eq("id", id);
    });
  },

  getJournalEntries: (): JournalEntry[] => {
    return safeParseJSON<JournalEntry[]>(localStorage.getItem(STORAGE_KEYS.JOURNAL_ENTRIES), []);
  },

  saveJournalEntry: (entry: JournalEntry): void => {
    const entries = dataService.getJournalEntries();
    const record: JournalEntry = {
      ...entry,
      id: entry.id || Math.random().toString(36).substr(2, 9),
    };
    const index = entries.findIndex((e) => e.id === record.id);
    const oldEntry = index > -1 ? entries[index] : null;
    const accounts = dataService.getAccounts();

    if (oldEntry && oldEntry.status === "Posted") {
      oldEntry.lines.forEach((line) => {
        const account = accounts.find((a) => a.id === line.account_id);
        if (account) {
          if (account.type === "Asset" || account.type === "Expense") {
            account.balance -= line.debit - line.credit;
          } else {
            account.balance -= line.credit - line.debit;
          }
        }
      });
    }

    if (record.status === "Posted") {
      record.lines.forEach((line) => {
        const account = accounts.find((a) => a.id === line.account_id);
        if (account) {
          if (account.type === "Asset" || account.type === "Expense") {
            account.balance += line.debit - line.credit;
          } else {
            account.balance += line.credit - line.debit;
          }
        }
      });
    }

    if (index > -1) {
      entries[index] = record;
    } else {
      entries.push(record);
    }

    localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify(entries));
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));

    runCloudSync(async (client, userId) => {
      await client.from("journal_entries").upsert({
        id: record.id,
        user_id: userId,
        date: record.date,
        description: record.description,
        status: record.status,
        lines: record.lines,
      });
      await client.from("accounts").upsert(
        accounts.map((a) => ({
          id: a.id,
          user_id: userId,
          code: a.code,
          name: a.name,
          type: a.type,
          description: a.description ?? null,
          notes: a.notes ?? null,
          balance: a.balance,
        }))
      );
    });
  },

  deleteJournalEntry: (id: string): void => {
    const entries = dataService.getJournalEntries();
    const entryToDelete = entries.find((e) => e.id === id);
    let accountsToSync: Account[] | null = null;

    if (entryToDelete && entryToDelete.status === "Posted") {
      const accounts = dataService.getAccounts();
      entryToDelete.lines.forEach((line) => {
        const account = accounts.find((a) => a.id === line.account_id);
        if (account) {
          if (account.type === "Asset" || account.type === "Expense") {
            account.balance -= line.debit - line.credit;
          } else {
            account.balance -= line.credit - line.debit;
          }
        }
      });
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      accountsToSync = accounts;
    }

    const filtered = entries.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("journal_entries").delete().eq("user_id", userId).eq("id", id);
      if (accountsToSync) {
        await client.from("accounts").upsert(
          accountsToSync.map((a) => ({
            id: a.id,
            user_id: userId,
            code: a.code,
            name: a.name,
            type: a.type,
            description: a.description ?? null,
            notes: a.notes ?? null,
            balance: a.balance,
          }))
        );
      }
    });
  },

  closePeriod: (periodName: string): JournalEntry | null => {
    const accounts = dataService.getAccounts();
    const revenueAccounts = accounts.filter((a) => a.type === "Revenue" && a.balance !== 0);
    const expenseAccounts = accounts.filter((a) => a.type === "Expense" && a.balance !== 0);

    if (revenueAccounts.length === 0 && expenseAccounts.length === 0) {
      return null;
    }

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalExpense = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpense;

    const equityAccount =
      accounts.find((a) => a.name.toLowerCase().includes("retained earnings")) ||
      accounts.find((a) => a.type === "Equity");

    if (!equityAccount) {
      return null;
    }

    const journalLines: JournalLine[] = [];

    revenueAccounts.forEach((acc) => {
      journalLines.push({
        id: Math.random().toString(36).substr(2, 9),
        account_id: acc.id,
        debit: acc.balance,
        credit: 0,
        description: `Closing ${acc.name} for ${periodName}`,
      });
    });

    expenseAccounts.forEach((acc) => {
      journalLines.push({
        id: Math.random().toString(36).substr(2, 9),
        account_id: acc.id,
        debit: 0,
        credit: acc.balance,
        description: `Closing ${acc.name} for ${periodName}`,
      });
    });

    if (netIncome !== 0) {
      journalLines.push({
        id: Math.random().toString(36).substr(2, 9),
        account_id: equityAccount.id,
        debit: netIncome < 0 ? Math.abs(netIncome) : 0,
        credit: netIncome > 0 ? netIncome : 0,
        description: `Transfer Net ${netIncome >= 0 ? "Income" : "Loss"} to ${equityAccount.name}`,
      });
    }

    const closingEntry: JournalEntry = {
      id: `CLOSE-${Date.now()}`,
      date: formatLocalDate(),
      description: `Closing Journal Entry - ${periodName}`,
      status: "Posted",
      lines: journalLines,
    };

    dataService.saveJournalEntry(closingEntry);
    return closingEntry;
  },

  getNotifications: (): AppNotification[] => {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!data) {
      const initial = dataService.generateInitialNotifications();
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initial));
      return initial;
    }
    return safeParseJSON<AppNotification[]>(data, []);
  },

  saveNotification: (notification: AppNotification): void => {
    const notifications = dataService.getNotifications();
    const record: AppNotification = {
      ...notification,
      id: notification.id || Math.random().toString(36).substr(2, 9),
    };
    const index = notifications.findIndex((n) => n.id === record.id);
    if (index > -1) {
      notifications[index] = record;
    } else {
      notifications.unshift(record);
    }
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));

    runCloudSync(async (client, userId) => {
      await client.from("notifications").upsert({
        id: record.id,
        user_id: userId,
        title: record.title,
        message: record.message,
        type: record.type,
        date: record.date,
        is_read: record.isRead,
        link: record.link ?? null,
      });
    });
  },

  markNotificationAsRead: (id: string): void => {
    const notifications = dataService.getNotifications();
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));

    runCloudSync(async (client, userId) => {
      await client.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("id", id);
    });
  },

  markAllNotificationsAsRead: (): void => {
    const notifications = dataService.getNotifications();
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));

    runCloudSync(async (client, userId) => {
      await client.from("notifications").update({ is_read: true }).eq("user_id", userId);
    });
  },

  deleteNotification: (id: string): void => {
    const notifications = dataService.getNotifications();
    const filtered = notifications.filter((n) => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(filtered));

    runCloudSync(async (client, userId) => {
      await client.from("notifications").delete().eq("user_id", userId).eq("id", id);
    });
  },

  generateInitialNotifications: (): AppNotification[] => {
    const notifications: AppNotification[] = [];
    const now = new Date();

    const invoices = dataService.getInvoices();
    const overdueInvoices = invoices.filter((i) => i.status === "Overdue");
    if (overdueInvoices.length > 0) {
      notifications.push({
        id: "init-1",
        title: "Overdue Invoices",
        message: `You have ${overdueInvoices.length} overdue invoices that need attention.`,
        type: "error",
        date: now.toISOString(),
        isRead: false,
        link: "/invoices",
      });
    }

    const budgets = dataService.getBudgets();
    const expenses = dataService.getExpenses();

    budgets.forEach((budget) => {
      const categoryExpenses = expenses.filter((e) => e.category === budget.category);
      const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);

      if (totalSpent > budget.limit_amount) {
        notifications.push({
          id: `budget-overrun-${budget.id}`,
          title: "Budget Overrun",
          message: `Your budget for ${budget.category} has exceeded its limit.`,
          type: "warning",
          date: now.toISOString(),
          isRead: false,
          link: "/budgets",
        });
      } else if (totalSpent > budget.limit_amount * 0.8) {
        notifications.push({
          id: `budget-warning-${budget.id}`,
          title: "Budget Warning",
          message: `You have used over 80% of your ${budget.category} budget.`,
          type: "info",
          date: now.toISOString(),
          isRead: false,
          link: "/budgets",
        });
      }
    });

    if (notifications.length === 0) {
      notifications.push({
        id: "welcome",
        title: "Welcome to Island Bookkeeping",
        message: "Start by adding your first invoice or expense to track your business finances.",
        type: "success",
        date: now.toISOString(),
        isRead: false,
      });
    }

    return notifications;
  },

  getEcommerceSources: (defaults: EcommerceSource[]): EcommerceSource[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ECOMMERCE_SOURCES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.ECOMMERCE_SOURCES, JSON.stringify(defaults));
      return defaults;
    }
    return safeParseJSON<EcommerceSource[]>(data, defaults);
  },

  saveEcommerceSources: (sources: EcommerceSource[]): void => {
    localStorage.setItem(STORAGE_KEYS.ECOMMERCE_SOURCES, JSON.stringify(sources));
    runCloudSync(async (client, userId) => {
      const { data: existing } = await client
        .from("ecommerce_sources")
        .select("id")
        .eq("user_id", userId);
      const currentIds = new Set(sources.map((s) => s.id));
      const removedIds = (existing || []).map((e: any) => e.id).filter((id: string) => !currentIds.has(id));
      if (removedIds.length > 0) {
        await client.from("ecommerce_sources").delete().eq("user_id", userId).in("id", removedIds);
      }
      if (sources.length > 0) {
        await client.from("ecommerce_sources").upsert(
          sources.map((s) => ({
            id: s.id,
            user_id: userId,
            name: s.name,
            type: s.type,
            status: s.status,
            last_sync: s.lastSync,
            orders: s.orders,
            url: s.url ?? null,
          }))
        );
      }
    });
  },

  getSyncLogs: (): SyncLog[] => {
    return safeParseJSON<SyncLog[]>(localStorage.getItem(STORAGE_KEYS.SYNC_LOGS), []);
  },

  saveSyncLog: (log: SyncLog): SyncLog[] => {
    const updated = [log, ...dataService.getSyncLogs()].slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.SYNC_LOGS, JSON.stringify(updated));
    runCloudSync(async (client, userId) => {
      await client.from("sync_logs").upsert({
        id: log.id,
        user_id: userId,
        source_id: log.sourceId,
        timestamp: log.timestamp,
        status: log.status,
        message: log.message,
        details: log.details,
      });
    });
    return updated;
  },
};
