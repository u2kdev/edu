"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

export default function TenantsPage() {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const router = useRouter();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(debouncedSearch && { q: debouncedSearch }),
        ...(status && { status })
      });
      const res = await fetch(`/api/platform/centers?${query}`);
      if (!res.ok) throw new Error('Failed to fetch centers');
      const json = await res.json();
      setCenters(json.data || []);
      setTotalPages(json.meta?.total_pages || json.meta?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("platform.centers.title")}</h1>
        <Link 
          href="/platform/tenants/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          Add New
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, slug, email..."
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="TRIAL">TRIAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">{error}</div>
      ) : centers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No organizations found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {centers.map((center: any) => (
                <tr key={center.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{center.name}</div>
                    <div className="text-sm text-gray-500">{center.slug}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{center.email}</div>
                    <div className="text-sm text-gray-500">{center.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {center.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/platform/tenants/${center.id}`} className="text-indigo-600 hover:text-indigo-900">
                      View / Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && centers.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
