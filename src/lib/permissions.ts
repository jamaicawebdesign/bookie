import { WorkspacePermission, WorkspaceRole } from '../types';

export interface RoleDefinition {
  role: WorkspaceRole;
  label: string;
  summary: string;
  permissions: WorkspacePermission[];
}

export const ROLE_DEFINITIONS: Record<WorkspaceRole, RoleDefinition> = {
  Owner: {
    role: 'Owner',
    label: 'Owner (Admin)',
    summary: 'Full access to financial books, team permissions, billing, and security controls.',
    permissions: [
      'view_financials',
      'manage_transactions',
      'manage_ledger',
      'export_reports',
      'manage_security',
      'manage_team',
      'manage_billing',
    ],
  },
  Accountant: {
    role: 'Accountant',
    label: 'Accountant',
    summary: 'Full bookkeeping access including Chart of Accounts, General Ledger, Reconciliation, and Reports.',
    permissions: [
      'view_financials',
      'manage_transactions',
      'manage_ledger',
      'export_reports',
    ],
  },
  Bookkeeper: {
    role: 'Bookkeeper',
    label: 'Bookkeeper (Staff)',
    summary: 'Day-to-day operational access for clients, invoices, expenses, budgets, and transactions.',
    permissions: [
      'view_financials',
      'manage_transactions',
      'export_reports',
    ],
  },
  Viewer: {
    role: 'Viewer',
    label: 'Viewer (Read-Only)',
    summary: 'Read-only visibility across dashboards, ledgers, reconciliation status, and reports.',
    permissions: [
      'view_financials',
      'export_reports',
    ],
  },
};

export const WORKSPACE_ROLES: WorkspaceRole[] = ['Owner', 'Accountant', 'Bookkeeper', 'Viewer'];

export function normalizeRole(rawRole?: string | null): WorkspaceRole {
  const normalized = (rawRole || '').trim().toLowerCase();
  if (!normalized || normalized.includes('owner') || normalized.includes('admin') || normalized.includes('founder')) {
    return 'Owner';
  }
  if (normalized.includes('accountant') || normalized.includes('cpa') || normalized.includes('controller')) {
    return 'Accountant';
  }
  if (normalized.includes('viewer') || normalized.includes('auditor') || normalized.includes('read')) {
    return 'Viewer';
  }
  if (normalized.includes('bookkeeper') || normalized.includes('staff') || normalized.includes('manager') || normalized.includes('editor')) {
    return 'Bookkeeper';
  }
  return 'Owner';
}

export function getRolePermissions(role?: string | null): WorkspacePermission[] {
  const canonical = normalizeRole(role);
  return ROLE_DEFINITIONS[canonical].permissions;
}

export function hasPermission(
  userOrRole: { role?: string | null } | string | null | undefined,
  permission: WorkspacePermission
): boolean {
  const roleStr = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return getRolePermissions(roleStr).includes(permission);
}
