"use client";

import { useEffect, useState } from "react";
import { Users, Building2, CreditCard, TrendingUp, Activity, ServerCrash } from "lucide-react";
import Link from "next/link";

export default function PlatformDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/platform/analytics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch analytics");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Loading analytics...</div>;
  if (error) return <div className="text-rose-400">Error: {error}</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Overview</h1>
        <p className="text-slate-400">Real-time metrics and growth statistics across all SaaS tenants.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Centers</p>
              <h3 className="text-2xl font-bold text-white">{data.centers.total}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-400">{data.centers.active} Active</span>
            <span className="text-amber-400">{data.centers.trial} Trial</span>
            <span className="text-rose-400">{data.centers.blocked} Blocked</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Platform Users</p>
              <h3 className="text-2xl font-bold text-white">{data.users.total}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-blue-400">{data.users.students} Students</span>
            <span className="text-purple-400">{data.users.teachers} Teachers</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Monthly Revenue (MRR)</p>
              <h3 className="text-2xl font-bold text-white">${data.revenue.mrr}</h3>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400">
            ARR: <span className="text-white">${data.revenue.arr}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Active Subscriptions</p>
              <h3 className="text-2xl font-bold text-white">{data.revenue.activeSubscriptions}</h3>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400">
            Across all paid plans
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Plan */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 lg:col-span-1">
          <h3 className="text-lg font-bold text-white mb-4">Revenue by Plan</h3>
          <div className="space-y-4">
            {Object.entries(data.revenue.byPlan).map(([planName, amount]: any) => (
              <div key={planName} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{planName}</span>
                <span className="text-sm font-bold text-white">${amount}</span>
              </div>
            ))}
            {Object.keys(data.revenue.byPlan).length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">No active paid subscriptions</div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-400" />
            Recent Platform Activity
          </h3>
          <div className="space-y-4">
            {data.recentActivity.map((log: any) => (
              <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex flex-shrink-0 items-center justify-center text-xs font-bold text-slate-300">
                  {log.actor.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-white">
                    <span className="font-medium text-brand-300">{log.actor.fullName}</span>{" "}
                    {log.action}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(log.createdAt).toLocaleString()} • {log.resource} ({log.resourceId})
                  </p>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
