'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
const MonthlyRoas = dynamic(() => import('@/components/MonthlyRoas'), { ssr: false });
const PeriodComparison = dynamic(() => import('@/components/PeriodComparison'), { ssr: false });
const TABS = [{ id: 'monthly', label: '📅 Monthly ROAS' }, { id: 'comparison', label: '🔍 Period Comparison' }];
export default function Home() {
  const [activeTab, setActiveTab] = useState('monthly');
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-5 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Instamart Ads Dashboard</h1>
            <p className="text-gray-400 text-xs mt-0.5">Live data from Google Sheets • Refreshes on page load</p>
          </div>
          <div className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'monthly' && <MonthlyRoas />}
        {activeTab === 'comparison' && <PeriodComparison />}
      </div>
    </div>
  );
}