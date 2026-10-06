"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TenantDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('overview');
  
  // Forms state
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', timeZone: '' });
  const [directorEmail, setDirectorEmail] = useState('');
  const [suspendForm, setSuspendForm] = useState({ action: 'pause', reason: '' });
  
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchCenter = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/centers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch center details');
      const json = await res.json();
      const center = json.data || json.center || json;
      setData(center);
      setEditForm({
        name: center.name || '',
        phone: center.phone || '',
        email: center.email || '',
        timeZone: center.timeZone || ''
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCenter();
  }, [fetchCenter]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Update failed');
      showMessage('success', 'Center updated successfully');
      fetchCenter();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleDirectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/platform/centers/${id}/director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: directorEmail })
      });
      if (!res.ok) throw new Error('Failed to change director');
      showMessage('success', 'Director changed successfully');
      setDirectorEmail('');
      fetchCenter();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suspendForm.reason.length < 5 || suspendForm.reason.length > 500) {
      showMessage('error', 'Reason must be between 5 and 500 characters');
      return;
    }
    try {
      const res = await fetch(`/api/platform/centers/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suspendForm)
      });
      if (!res.ok) throw new Error('Failed to update status');
      showMessage('success', `Status updated to ${suspendForm.action}`);
      setSuspendForm({ action: 'pause', reason: '' });
      fetchCenter();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!data) return <div className="p-6 text-center">Not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-gray-500">Slug: {data.slug} | Status: <span className="font-semibold text-blue-600">{data.status}</span></p>
        </div>
        <Link href="/platform/tenants" className="text-blue-600 hover:underline">
          &larr; Back to List
        </Link>
      </div>

      {actionMessage && (
        <div className={`mb-4 p-3 rounded ${actionMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {actionMessage.text}
        </div>
      )}

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'edit', 'director', 'suspend'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium border-b pb-2 mb-4">Details</h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>Email:</strong> {data.email}</li>
                  <li><strong>Phone:</strong> {data.phone}</li>
                  <li><strong>Time Zone:</strong> {data.timeZone}</li>
                  <li><strong>Created At:</strong> {new Date(data.createdAt).toLocaleDateString()}</li>
                  {data.trialEndsAt && <li><strong>Trial Ends At:</strong> {new Date(data.trialEndsAt).toLocaleDateString()}</li>}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium border-b pb-2 mb-4">Director</h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>Name:</strong> {data.director?.fullName || 'N/A'}</li>
                  <li><strong>Email:</strong> {data.director?.email || 'N/A'}</li>
                  <li><strong>Phone:</strong> {data.director?.phone || 'N/A'}</li>
                </ul>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Audit Logs (Last 20)</h3>
              {data.auditLogs && data.auditLogs.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.auditLogs.map((log: any, idx: number) => (
                    <li key={idx} className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold">{log.action}</span> - {new Date(log.createdAt).toLocaleString()}
                      <p className="text-gray-600 mt-1">{log.details}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No logs available.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'edit' && (
          <form onSubmit={handleEditSubmit} className="max-w-md space-y-4">
            <h3 className="text-lg font-medium mb-4">Edit Center Details</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time Zone</label>
              <input type="text" value={editForm.timeZone} onChange={e => setEditForm({...editForm, timeZone: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Save Changes</button>
          </form>
        )}

        {activeTab === 'director' && (
          <form onSubmit={handleDirectorSubmit} className="max-w-md space-y-4">
            <h3 className="text-lg font-medium mb-4">Change Director</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Director Email</label>
              <input type="email" value={directorEmail} onChange={e => setDirectorEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md p-2" required />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Assign New Director</button>
          </form>
        )}

        {activeTab === 'suspend' && (
          <form onSubmit={handleSuspendSubmit} className="max-w-md space-y-4">
            <h3 className="text-lg font-medium mb-4">Update Status</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <select value={suspendForm.action} onChange={e => setSuspendForm({...suspendForm, action: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                <option value="pause">Pause</option>
                <option value="block">Block</option>
                <option value="resume">Resume</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reason (5-500 chars)</label>
              <textarea 
                value={suspendForm.reason} 
                onChange={e => setSuspendForm({...suspendForm, reason: e.target.value})} 
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 h-24" 
                required minLength={5} maxLength={500} 
              />
            </div>
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Apply Status Update</button>
          </form>
        )}
      </div>
    </div>
  );
}
