import React, { useState, useEffect } from 'react';
import {
  UsersRound,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Ban,
  CheckCircle2,
  ArrowRightLeft,
  X,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamMember, WorkspaceInvite, WorkspaceRole } from '../types';
import { dataService } from '../services/dataService';
import { ROLE_DEFINITIONS, WORKSPACE_ROLES, hasPermission, normalizeRole } from '../lib/permissions';
import { cn, formatLocalDate } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

interface TeamManagementPageProps {
  user: any;
  onSwitchUser?: (nextUser: any) => void;
}

const PERMISSION_MATRIX: {
  capability: string;
  roles: Record<WorkspaceRole, boolean>;
}[] = [
  {
    capability: 'View Dashboards, Reports & Reconciliation Status',
    roles: { Owner: true, Accountant: true, Bookkeeper: true, Viewer: true },
  },
  {
    capability: 'Export PDF & CSV Financial Statements',
    roles: { Owner: true, Accountant: true, Bookkeeper: true, Viewer: true },
  },
  {
    capability: 'Create & Edit Clients, Invoices, Expenses & Budgets',
    roles: { Owner: true, Accountant: true, Bookkeeper: true, Viewer: false },
  },
  {
    capability: 'Manage Chart of Accounts, Journal Entries & Data Imports',
    roles: { Owner: true, Accountant: true, Bookkeeper: false, Viewer: false },
  },
  {
    capability: 'Complete Bank Reconciliations & Close Fiscal Periods',
    roles: { Owner: true, Accountant: true, Bookkeeper: false, Viewer: false },
  },
  {
    capability: 'Manage Team Members, Roles & Workspace Invites',
    roles: { Owner: true, Accountant: false, Bookkeeper: false, Viewer: false },
  },
  {
    capability: 'Configure Security Policies & Billing Settings',
    roles: { Owner: true, Accountant: false, Bookkeeper: false, Viewer: false },
  },
];

export function TeamManagementPage({ user, onSwitchUser }: TeamManagementPageProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'Accountant' as WorkspaceRole,
    setPasswordNow: true,
    password: '',
  });
  const [showInvitePassword, setShowInvitePassword] = useState(false);

  const currentRole = normalizeRole(user?.role);
  const canManageTeam = hasPermission(user, 'manage_team');
  const isLocalWorkspace = !user?.authMode || user.authMode === 'local';

  const loadTeamData = () => {
    setMembers(dataService.getTeamMembers());
    setInvites(dataService.getWorkspaceInvites());
  };

  useEffect(() => {
    loadTeamData();
    window.addEventListener('island-data-synced', loadTeamData);
    return () => window.removeEventListener('island-data-synced', loadTeamData);
  }, [user]);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      showNotice(`Invite code: ${code}`, 'success');
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) return;

    const cleanEmail = inviteForm.email.trim();
    const cleanName = inviteForm.name.trim();
    if (!cleanName || !cleanEmail) {
      showNotice('Enter both the team member name and email address.', 'error');
      return;
    }
    if (
      inviteForm.setPasswordNow &&
      (inviteForm.password.length < 8 ||
        !/[A-Z]/.test(inviteForm.password) ||
        !/[0-9]/.test(inviteForm.password))
    ) {
      showNotice(
        'Access password must be at least 8 characters and include an uppercase letter and a number.',
        'error'
      );
      return;
    }

    try {
      const { member, invite } = dataService.inviteTeamMember({
        name: cleanName,
        email: cleanEmail,
        role: inviteForm.role,
        password: inviteForm.setPasswordNow ? inviteForm.password : undefined,
      });
      loadTeamData();
      setIsInviteModalOpen(false);
      setInviteForm({
        name: '',
        email: '',
        role: 'Accountant',
        setPasswordNow: true,
        password: '',
      });
      showNotice(
        member.status === 'Active'
          ? `${member.name} added as ${member.role} and ready to sign in.`
          : `Invitation created for ${member.email} (Code: ${invite.invite_code}).`
      );
    } catch (err: any) {
      showNotice(err?.message || 'Unable to add team member.', 'error');
    }
  };

  const handleRoleChange = (memberId: string, newRole: WorkspaceRole) => {
    try {
      dataService.updateTeamMemberRole(memberId, newRole);
      loadTeamData();
      showNotice(`Updated member role to ${newRole}.`);
    } catch (err: any) {
      showNotice(err?.message || 'Unable to update role.', 'error');
    }
  };

  const handleToggleSuspend = (member: TeamMember) => {
    const nextStatus = member.status === 'Suspended' ? 'Active' : 'Suspended';
    try {
      dataService.updateTeamMemberStatus(member.id, nextStatus);
      loadTeamData();
      showNotice(
        nextStatus === 'Suspended'
          ? `${member.name} has been suspended from workspace access.`
          : `${member.name}'s workspace access has been restored.`
      );
    } catch (err: any) {
      showNotice(err?.message || 'Unable to update member status.', 'error');
    }
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;
    try {
      dataService.removeTeamMember(memberToRemove.id);
      loadTeamData();
      showNotice(`Removed ${memberToRemove.name} from this workspace.`);
    } catch (err: any) {
      showNotice(err?.message || 'Unable to remove team member.', 'error');
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleRevokeInvite = (inviteId: string) => {
    try {
      dataService.revokeInvite(inviteId);
      loadTeamData();
      showNotice('Invitation revoked.');
    } catch (err: any) {
      showNotice(err?.message || 'Unable to revoke invitation.', 'error');
    }
  };

  const handleSwitchMember = (member: TeamMember) => {
    try {
      const nextUser = dataService.switchActiveMember(member.id);
      if (nextUser && onSwitchUser) {
        onSwitchUser(nextUser);
      }
      showNotice(`Switched active session to ${member.name} (${member.role}).`);
    } catch (err: any) {
      showNotice(err?.message || 'Unable to switch active member.', 'error');
    }
  };

  const activeCount = members.filter((m) => m.status === 'Active').length;
  const pendingInvites = invites.filter((inv) => inv.status === 'Pending');

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-600">
              <UsersRound size={22} />
            </div>
            <h2 className="text-3xl font-black text-jamaica-black tracking-tight uppercase">
              Team & Multi-User Access
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Share <span className="font-bold text-slate-800">{user?.company || 'Island Bookkeeping'}</span> books with accountants, bookkeepers, and read-only auditors using role-based permissions.
          </p>
        </div>

        {canManageTeam ? (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 cursor-pointer shrink-0"
          >
            <UserPlus size={16} />
            Invite Team Member
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
            <Lock size={14} />
            View-Only Roster ({currentRole})
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold',
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            )}
          >
            {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/80">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Active Team Members
          </p>
          <p className="text-3xl font-black text-jamaica-black font-mono tabular-nums">
            {activeCount}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Shared ledger access for {user?.company || 'your workspace'}
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-200/80">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Pending Invitations
          </p>
          <p className="text-3xl font-black text-brand-600 font-mono tabular-nums">
            {pendingInvites.length}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            {pendingInvites.length > 0
              ? 'Share invite codes for teammate self-signup'
              : 'All issued invitations accepted or resolved'}
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-200/80">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Your Active Role
          </p>
          <p className="text-2xl font-black text-jamaica-black tracking-tight">
            {ROLE_DEFINITIONS[currentRole].label}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">
            {ROLE_DEFINITIONS[currentRole].summary}
          </p>
        </div>
      </div>

      {/* Team Members Directory */}
      <div className="glass-panel rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-black text-jamaica-black tracking-tight">
              Workspace Members
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Every action taken by any member is attributed individually in the Security Audit Log.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Workspace ID: {dataService.getWorkspaceId()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Access Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const isSelf =
                  user?.email?.toLowerCase() === member.email.toLowerCase();
                const initials = (member.name || member.email || 'U')
                  .trim()
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-600/10 text-brand-700 font-black text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {member.name}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-brand-700">
                                · You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {canManageTeam && !isSelf ? (
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as WorkspaceRole)
                          }
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
                        >
                          {WORKSPACE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-slate-800">
                          {ROLE_DEFINITIONS[member.role]?.label || member.role}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-bold',
                          member.status === 'Active'
                            ? 'text-emerald-700'
                            : member.status === 'Invited'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        )}
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            member.status === 'Active'
                              ? 'bg-emerald-500'
                              : member.status === 'Invited'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          )}
                        />
                        {member.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs font-mono tabular-nums text-slate-500">
                      {formatLocalDate(new Date(member.joined_at))}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {canManageTeam && isLocalWorkspace && !isSelf && member.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchMember(member)}
                            title="Sign in as this member to verify permissions"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft size={13} />
                            Switch User
                          </button>
                        )}
                        {canManageTeam && !isSelf && member.status !== 'Invited' && (
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(member)}
                            title={
                              member.status === 'Suspended'
                                ? 'Restore member access'
                                : 'Suspend member access'
                            }
                            className={cn(
                              'p-2 rounded-lg border transition-colors cursor-pointer',
                              member.status === 'Suspended'
                                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            )}
                          >
                            {member.status === 'Suspended' ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Ban size={14} />
                            )}
                          </button>
                        )}
                        {canManageTeam && !isSelf && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            title="Remove team member"
                            className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workspace Invitations */}
      {invites.length > 0 && (
        <div className="glass-panel rounded-3xl border border-slate-200/80 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-black text-jamaica-black tracking-tight flex items-center gap-2">
              <KeyRound size={18} className="text-brand-600" />
              Workspace Invitations
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Teammates can use an invite code on the Create Account screen to join this shared workspace automatically.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {invite.name} <span className="text-slate-400 font-normal">({invite.email})</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assigned role: <strong className="text-slate-700">{invite.role}</strong> · Status:{' '}
                    <span
                      className={cn(
                        'font-bold',
                        invite.status === 'Pending'
                          ? 'text-amber-700'
                          : invite.status === 'Accepted'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      )}
                    >
                      {invite.status}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <code className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800">
                    {invite.invite_code}
                  </code>
                  {invite.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(invite.invite_code)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedCode === invite.invite_code ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            Copy Code
                          </>
                        )}
                      </button>
                      {canManageTeam && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role & Permission Matrix */}
      <div className="glass-panel rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" />
            <h3 className="text-lg font-black text-jamaica-black tracking-tight">
              Role Permissions Matrix
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Access boundaries enforced across every ledger, transaction, and security control.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">Workspace Capability</th>
                {WORKSPACE_ROLES.map((role) => (
                  <th key={role} className="px-4 py-4 text-center">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.capability} className="hover:bg-slate-50/40">
                  <td className="px-6 py-3.5 text-xs font-semibold text-slate-800">
                    {row.capability}
                  </td>
                  {WORKSPACE_ROLES.map((role) => (
                    <td key={role} className="px-4 py-3.5 text-center">
                      {row.roles[role] ? (
                        <CheckCircle2 size={16} className="inline text-emerald-600" />
                      ) : (
                        <span className="text-xs font-bold text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-jamaica-black uppercase tracking-tight">
                      Add Team Member
                    </h3>
                    <p className="text-xs text-slate-500">
                      Grant role-based access to {user?.company || 'this workspace'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="Marsha Brown"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="marsha@company.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Workspace Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value as WorkspaceRole })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {WORKSPACE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DEFINITIONS[r].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 pt-1">
                    {ROLE_DEFINITIONS[inviteForm.role].summary}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.setPasswordNow}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, setPasswordNow: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Provision direct sign-in password now (Active immediately)
                    </span>
                  </label>

                  {inviteForm.setPasswordNow ? (
                    <div className="relative">
                      <input
                        type={showInvitePassword ? 'text' : 'password'}
                        required
                        value={inviteForm.password}
                        onChange={(e) =>
                          setInviteForm({ ...inviteForm, password: e.target.value })
                        }
                        placeholder="Min 8 chars, 1 uppercase & 1 number"
                        className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInvitePassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showInvitePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      An invite code will be generated so your teammate can register their own password on the Create Account screen.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-brand-500/20 cursor-pointer"
                  >
                    {inviteForm.setPasswordNow ? 'Add Active Member' : 'Generate Invite Code'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={confirmRemoveMember}
        title="Remove Team Member"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.name} (${memberToRemove.email}) from this workspace? They will immediately lose access to these financial records.`
            : ''
        }
        confirmText="Remove Member"
        variant="danger"
      />
    </div>
  );
}
