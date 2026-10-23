import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { Department } from '../../types/civic';
import { Building2, Phone, Mail, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const DepartmentManagement: React.FC = () => {
  const { departments, complaints } = useCivic();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Municipal Departments
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Designated civic authorities, category jurisdiction, SLA turnaround commitments, and dispatch contacts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {departments.map((dept) => {
          const deptComplaints = complaints.filter((c) => c.assigned_department_id === dept.id);
          const active = deptComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
          const resolved = deptComplaints.filter((c) => c.status === 'Resolved').length;

          return (
            <div
              key={dept.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4 text-xs"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-sm">{dept.name}</h2>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Supervisor: {dept.head_officer}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-semibold text-[10px]">
                  Active Board
                </span>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{dept.description}</p>

              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Domain Jurisdiction:</span>
                <div className="flex flex-wrap gap-1">
                  {dept.category_specialty.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] border border-slate-200 dark:border-slate-700"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">{dept.contact_email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span>{dept.contact_phone}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>SLA Commitment: <strong>{dept.sla_target_hours}h</strong></span>
                </div>
                <div className="space-x-2 font-mono">
                  <span>Active: <strong className="text-amber-600 dark:text-amber-400">{active}</strong></span>
                  <span>·</span>
                  <span>Resolved: <strong className="text-emerald-600 dark:text-emerald-400">{resolved}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
