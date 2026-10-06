"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';

const schemaStep1 = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  phone: z.string().min(5, "Phone is required"),
  email: z.string().email("Invalid email"),
  timeZone: z.string().min(1, "Time zone is required"),
});

const schemaStep2 = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "PAUSED", "OVERDUE", "BLOCKED", "CANCELLED"]),
  trialEndsAt: z.string().optional(),
});

const schemaStep3 = z.object({
  directorEmail: z.string().email("Invalid email"),
  directorFullName: z.string().min(2, "Full name is required"),
  directorPhone: z.string().min(5, "Phone is required"),
});

export default function CreateTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', slug: '', phone: '', email: '', timeZone: 'Asia/Tashkent',
    status: 'TRIAL', trialEndsAt: '',
    directorEmail: '', directorFullName: '', directorPhone: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleNext = () => {
    let result;
    if (step === 1) result = schemaStep1.safeParse(formData);
    else if (step === 2) result = schemaStep2.safeParse(formData);
    else if (step === 3) result = schemaStep3.safeParse(formData);
    
    if (result && !result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        if (issue.path[0] !== undefined) {
          formattedErrors[String(issue.path[0])] = issue.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }
    
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/platform/centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create center');
      }
      const data = await res.json();
      const newId = data.center?.id || data.data?.id;
      if (newId) {
        router.push(`/platform/tenants/${newId}`);
      } else {
        router.push('/platform/tenants');
      }
    } catch (error: any) {
      setSubmitError(error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Organization</h1>
        <Link href="/platform/tenants" className="text-blue-600 hover:underline">Cancel</Link>
      </div>

      <div className="mb-8 flex justify-between items-center relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 transform -translate-y-1/2"></div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-4 border-white ${step >= i ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
            {i}
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 1: Center Data</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time Zone</label>
              <select name="timeZone" value={formData.timeZone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                <option value="Asia/Tashkent">Asia/Tashkent</option>
                <option value="Europe/Moscow">Europe/Moscow</option>
              </select>
              {errors.timeZone && <p className="text-red-500 text-xs mt-1">{errors.timeZone}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 2: Status</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
              </select>
            </div>
            {formData.status === 'TRIAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Trial Ends At</label>
                <input type="date" name="trialEndsAt" value={formData.trialEndsAt} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 3: Administrator</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Director Full Name</label>
              <input type="text" name="directorFullName" value={formData.directorFullName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.directorFullName && <p className="text-red-500 text-xs mt-1">{errors.directorFullName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Director Email</label>
              <input type="email" name="directorEmail" value={formData.directorEmail} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.directorEmail && <p className="text-red-500 text-xs mt-1">{errors.directorEmail}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Director Phone</label>
              <input type="text" name="directorPhone" value={formData.directorPhone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
              {errors.directorPhone && <p className="text-red-500 text-xs mt-1">{errors.directorPhone}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 4: Confirm</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong className="text-gray-500 block">Name:</strong> {formData.name}</div>
              <div><strong className="text-gray-500 block">Slug:</strong> {formData.slug}</div>
              <div><strong className="text-gray-500 block">Status:</strong> {formData.status}</div>
              <div><strong className="text-gray-500 block">Director:</strong> {formData.directorFullName} ({formData.directorEmail})</div>
            </div>
            {submitError && <div className="p-3 bg-red-100 text-red-700 rounded-md">{submitError}</div>}
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
          >
            Back
          </button>
          
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50 hover:bg-green-700 flex items-center"
            >
              {isSubmitting ? 'Creating...' : 'Confirm & Create'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
