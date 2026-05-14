'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import ExecutionHistory from './ExecutionHistory';
import type { TestPlanDetail, TestCaseInsight } from '@/lib/tcmTypes';

interface TestPlanDetailProps {
  testPlanId: string;
  projectName: string;
  versionName: string;
  onBack: () => void;
}

const TestPlanDetail: React.FC<TestPlanDetailProps> = ({
  testPlanId,
  projectName,
  versionName,
  onBack,
}) => {
  const [data, setData] = useState<TestPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'stillFailing' | 'failedThenPassed' | 'flakyTests' | 'notRun'>('overview');

  useEffect(() => {
    fetchTestPlanDetail();
  }, [testPlanId]);

  const fetchTestPlanDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/dashboard/test-plans/${testPlanId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const detail = await response.json();
        setData(detail);
      }
    } catch (error) {
      console.error('Error fetching test plan detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPassRateColor = (passRate: number) => {
    if (passRate >= 90) return '#22c55e';
    if (passRate >= 80) return '#eab308';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading test plan details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const chartData = data.runHistory.map((run, index) => ({
    name: `Run ${index + 1}`,
    pass: run.passCount,
    fail: run.failCount,
    blocked: run.blockedCount,
    notRun: run.notRunCount,
  }));

  const InsightSection: React.FC<{ title: string; cases: TestCaseInsight[]; color: string }> = ({ title, cases, color }) => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b" style={{ backgroundColor: color }}>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-white opacity-90">{cases.length} test cases</p>
      </div>
      {cases.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No test cases in this category</div>
      ) : (
        <div className="divide-y max-h-96 overflow-y-auto">
          {cases.map((testCase) => (
            <div key={testCase.testCaseId} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{testCase.caseKey}: {testCase.title}</p>
                  <div className="flex items-center space-x-3 mt-2 text-sm text-gray-600">
                    <span>Priority: {testCase.priority}</span>
                    <span>Fails: {testCase.failCount}</span>
                  </div>
                  <div className="mt-2">
                    <ExecutionHistory history={testCase.executionHistory} />
                  </div>
                </div>
                <div className="ml-4">
                  <StatusBadge status={testCase.currentStatus} />
                </div>
              </div>
              {testCase.lastTester && (
                <div className="mt-2 text-xs text-gray-500">
                  Last tested by: {testCase.lastTester.name} at {new Date(testCase.lastRunTime!).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
          Projects
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{projectName}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{versionName}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{data.testPlanName}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{data.testPlanName}</h1>
        <p className="text-gray-600">{data.project} - {data.version}</p>
      </div>

      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Total Tests</p>
          <p className="text-3xl font-bold text-gray-900">{data.summary.totalTests}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Pass</p>
          <p className="text-3xl font-bold text-green-600">{data.summary.passCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Fail</p>
          <p className="text-3xl font-bold text-red-600">{data.summary.failCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Not Run</p>
          <p className="text-3xl font-bold text-gray-600">{data.summary.notRunCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
          <p className="text-3xl font-bold text-green-600">{data.summary.passRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600 mb-1">Progress</p>
          <p className="text-3xl font-bold text-blue-600">{data.summary.progress.toFixed(1)}%</p>
        </div>
      </div>

      {/* Run Trend Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Run Trend</h3>
        {data.runHistory.length === 0 ? (
          <p className="text-gray-500">No run history available</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pass" stroke="#22c55e" name="Pass" />
              <Line type="monotone" dataKey="fail" stroke="#ef4444" name="Fail" />
              <Line type="monotone" dataKey="blocked" stroke="#f97316" name="Blocked" />
              <Line type="monotone" dataKey="notRun" stroke="#9ca3af" name="Not Run" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { key: 'overview', label: 'Overview', count: data.testCases.length },
              { key: 'stillFailing', label: 'Still Failing', count: data.insights.stillFailing.length },
              { key: 'failedThenPassed', label: 'Failed Then Passed', count: data.insights.failedThenPassed.length },
              { key: 'flakyTests', label: 'Flaky Tests', count: data.insights.flakyTests.length },
              { key: 'notRun', label: 'Not Run', count: data.insights.notRun.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab.label} <span className="ml-1 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InsightSection title="Still Failing" cases={data.insights.stillFailing} color="#ef4444" />
                <InsightSection title="Failed Then Passed" cases={data.insights.failedThenPassed} color="#22c55e" />
                <InsightSection title="Flaky Tests" cases={data.insights.flakyTests} color="#eab308" />
                <InsightSection title="Not Run" cases={data.insights.notRun} color="#9ca3af" />
              </div>
            </div>
          )}

          {activeTab === 'stillFailing' && (
            <InsightSection title="Still Failing" cases={data.insights.stillFailing} color="#ef4444" />
          )}

          {activeTab === 'failedThenPassed' && (
            <InsightSection title="Failed Then Passed" cases={data.insights.failedThenPassed} color="#22c55e" />
          )}

          {activeTab === 'flakyTests' && (
            <InsightSection title="Flaky Tests" cases={data.insights.flakyTests} color="#eab308" />
          )}

          {activeTab === 'notRun' && (
            <InsightSection title="Not Run" cases={data.insights.notRun} color="#9ca3af" />
          )}
        </div>
      </div>

      {/* Test Case Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">All Test Cases</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Case</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Execution History</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fail Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Tester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.testCases.map((testCase) => (
                <tr key={testCase.testCaseId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{testCase.caseKey}</div>
                    <div className="text-sm text-gray-500">{testCase.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      testCase.priority === 'high' ? 'bg-red-100 text-red-800' :
                      testCase.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {testCase.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={testCase.currentStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ExecutionHistory history={testCase.executionHistory} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {testCase.failCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {testCase.lastTester?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {testCase.lastRunTime ? new Date(testCase.lastRunTime).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TestPlanDetail;
