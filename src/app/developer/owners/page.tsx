"use client";

import { useEffect, useState } from "react";
import { Users, ShieldAlert, Check, Plus } from "lucide-react";

export default function PlatformOwnersPage() {
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/developer/platform-owners")
      .then((res) => res.json())
      .then((json) => setOwners(json.owners || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-400" />
            Platform Administrators
          </h1>
          <p className="text-zinc-500 mt-1">Manage global system administrators and developers</p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" />
          Add Administrator
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="py-3 px-4 font-normal">EMAIL</th>
                <th className="py-3 px-4 font-normal">NAME</th>
                <th className="py-3 px-4 font-normal">ROLE</th>
                <th className="py-3 px-4 font-normal">STATUS</th>
                <th className="py-3 px-4 font-normal">CREATED</th>
                <th className="py-3 px-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600">
                    Fetching administrators...
                  </td>
                </tr>
              ) : (
                owners.map((owner) => (
                  <tr key={owner.id} className="hover:bg-zinc-800/30 text-zinc-300">
                    <td className="py-3 px-4 text-emerald-400">{owner.email}</td>
                    <td className="py-3 px-4 text-zinc-100">{owner.fullName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        owner.platformRole === "DEVELOPER" ? "bg-purple-500/20 text-purple-400" :
                        owner.platformRole === "SUPERADMIN" ? "bg-red-500/20 text-red-400" :
                        "bg-zinc-700 text-zinc-300"
                      }`}>
                        {owner.platformRole}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {owner.isActive ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <Check className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-400 text-xs">
                          <ShieldAlert className="w-3 h-3" /> SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">
                      {new Date(owner.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-zinc-500 hover:text-emerald-400 transition-colors text-xs">
                        Configure
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
