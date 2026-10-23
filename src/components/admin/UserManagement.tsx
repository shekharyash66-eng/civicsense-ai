import React, { useEffect, useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { User, UserRole } from '../../types/civic';
import { Users, Shield, Building, Mail, Phone, Calendar, Loader2, Check, AlertCircle } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { fetchUsers, updateUserRole, departments, currentUser } = useCivic();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setErrorMsg('Failed to fetch user accounts. Please verify your administrator authorization.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (targetUser: User, newRole: UserRole, departmentId?: string) => {
    setSavingUserId(targetUser.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await updateUserRole(targetUser.id, newRole, departmentId);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccessMsg(`Successfully updated role for ${updated.full_name} to ${updated.role}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Role update failed');
    } finally {
      setSavingUserId(null);
    }
  };

  if (currentUser?.role !== 'Administrator') {
    return (
      <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-900">Access Restricted</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">
          User management and role authorization requires verified Administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold mb-1">
            <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Authorized User & Persona Directory</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Role-Based Access Control & User Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage user profiles, assign department officers, and grant administrator credentials.
          </p>
        </div>

        <button
          onClick={loadUsers}
          disabled={loading}
          className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-2xs self-start sm:self-auto"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
          <span>Refresh Directory</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600 dark:text-teal-400 mx-auto" />
            <div>Loading user accounts from database...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
            No registered users found in the connected database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User Profile</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Department Mapping</th>
                  <th className="px-4 py-3">Registered Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-teal-900 text-teal-400 flex items-center justify-center font-bold text-xs">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{u.full_name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span>{u.email}</span>
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u, e.target.value as UserRole, u.department_id)
                        }
                        disabled={savingUserId === u.id}
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="Citizen">Citizen</option>
                        <option value="Department Officer">Department Officer</option>
                        <option value="Administrator">Administrator</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      {u.role === 'Department Officer' ? (
                        <select
                          value={u.department_id || ''}
                          onChange={(e) => handleRoleChange(u, u.role, e.target.value)}
                          disabled={savingUserId === u.id}
                          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Select Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">N/A (Global Access)</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {savingUserId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400 ml-auto" />
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
