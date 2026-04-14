'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const MonthlyRoas = dynamic(() => import('@/components/MonthlyRoas'), { ssr: false });
const PeriodComparison = dynamic(() => import('@/components/PeriodComparison'), { ssr: false });
const KeywordAnalysis = dynamic(() => import('@/components/KeywordAnalysis'), { ssr: false });
const CampaignInsights = dynamic(() => import('@/components/CampaignInsights'), { ssr: false });
const Actions = dynamic(() => import('@/components/Actions'), { ssr: false });

const TABS = [
  { id: 'monthly', label: '📅 Monthly ROAS' },
  { id: 'comparison', label: '🔍 Period Comparison' },
  { id: 'keywords', label: '🎯 Keyword Analysis' },
  { id: 'insights', label: '🚨 Campaign Insights' },
  { id: 'actions', label: '⚡ Action Items' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('monthly');
  const [platform, setPlatform] = useState('instamart');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('platform');
    if (p === 'zepto' || p === 'instamart') {
      setPlatform(p);
    }
  }, []);

  const handleSetPlatform = (p) => {
    setPlatform(p);
    const params = new URLSearchParams(window.location.search);
    params.set('platform', p);
    window.history.replaceState({}, '', '?' + params.toString());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-5 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {platform === 'zepto' ? 'Zepto' : 'Instamart'} Ads Dashboard
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Live data from Google Sheets • Refreshes on page load</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => handleSetPlatform('instamart')}
                className={'px-4 py-1.5 rounded-md text-sm font-semibold transition-all ' + (platform === 'instamart' ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
                Instamart
              </button>
              <button
                onClick={() => handleSetPlatform('zepto')}
                className={'px-4 py-1.5 rounded-md text-sm font-semibold transition-all ' + (platform === 'zepto' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white')}>
                Zepto
              </button>
            </div>
            <div className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
      </div>
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={'px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ' + (activeTab === tab.id ? (platform === 'zepto' ? 'border-purple-600 text-purple-600' : 'border-blue-600 text-blue-600') : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'monthly' && <MonthlyRoas platform={platform} />}
        {activeTab === 'comparison' && <PeriodComparison platform={platform} />}
        {activeTab === 'keywords' && <KeywordAnalysis platform={platform} />}
        {activeTab === 'insights' && <CampaignInsights platform={platform} />}
        {activeTab === 'actions' && <Actions platform={platform} />}
      </div>
    </div>
  );
}
