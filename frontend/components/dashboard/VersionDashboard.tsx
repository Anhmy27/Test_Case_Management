"use client";

import React, { useState, useEffect } from "react";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import type { VersionStats, TestPlanStats } from "@/lib/tcmTypes";

const getAuthToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("tcm_token") || "";
};

interface VersionDashboardProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
  onTestPlanClick: (testPlanId: string) => void;
}

const VersionDashboard: React.FC<VersionDashboardProps> = ({
  projectId,
  projectName,
  onBack,
  onTestPlanClick,
}) => {
  const [versions, setVersions] = useState<VersionStats[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VersionStats | null>(
    null,
  );
  const [testPlans, setTestPlans] = useState<TestPlanStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTestPlans, setLoadingTestPlans] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [projectId]);

  const fetchVersions = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:5000/api/dashboard/versions?projectId=${projectId}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        },
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions);
        if (data.versions.length > 0) {
          setSelectedVersion(data.versions[0]);
          fetchTestPlans(data.versions[0]._id);
        }
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestPlans = async (versionId: string) => {
    setLoadingTestPlans(true);
    try {
      const token = getAuthToken();
      const response = await fetch(
        `http://localhost:5000/api/dashboard/test-plans?versionId=${versionId}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        },
      );
      if (response.ok) {
        const data = await response.json();
        setTestPlans(data.testPlans);
      }
    } catch (error) {
      console.error("Error fetching test plans:", error);
    } finally {
      setLoadingTestPlans(false);
    }
  };

  const handleVersionChange = (version: VersionStats) => {
    setSelectedVersion(version);
    fetchTestPlans(version._id);
  };

  const getPassRateColor = (passRate: number) => {
    if (passRate >= 90) return "#22c55e";
    if (passRate >= 80) return "#eab308";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading versions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Projects
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{projectName}</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Version Dashboard</h1>
        <div className="flex items-center space-x-4">
          {selectedVersion && (
            <select
              value={selectedVersion._id}
              onChange={(e) => {
                const version = versions.find((v) => v._id === e.target.value);
                if (version) handleVersionChange(version);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {versions.map((version) => (
                <option key={version._id} value={version._id}>
                  {version.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedVersion && (
        <>
          {/* Version Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">Total Test Plans</p>
              <p className="text-3xl font-bold text-gray-900">
                {selectedVersion.totalTestPlans}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">Total Tests</p>
              <p className="text-3xl font-bold text-gray-900">
                {selectedVersion.totalTests}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
              <p className="text-3xl font-bold text-green-600">
                {selectedVersion.passRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600 mb-1">Progress</p>
              <p className="text-3xl font-bold text-blue-600">
                {selectedVersion.progress.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Test Execution Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Passed</span>
                  <span className="font-semibold text-green-600">
                    {selectedVersion.passCount}
                  </span>
                </div>
                <ProgressBar
                  value={selectedVersion.passCount}
                  max={selectedVersion.totalTests}
                  color="#22c55e"
                  showLabel={false}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-semibold text-red-600">
                    {selectedVersion.failCount}
                  </span>
                </div>
                <ProgressBar
                  value={selectedVersion.failCount}
                  max={selectedVersion.totalTests}
                  color="#ef4444"
                  showLabel={false}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Not Run</span>
                  <span className="font-semibold text-gray-600">
                    {selectedVersion.notRunCount}
                  </span>
                </div>
                <ProgressBar
                  value={selectedVersion.notRunCount}
                  max={selectedVersion.totalTests}
                  color="#9ca3af"
                  showLabel={false}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Pass Rate</span>
                  <span className="font-semibold text-gray-900">
                    {selectedVersion.passRate.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar
                  value={selectedVersion.passRate}
                  color={getPassRateColor(selectedVersion.passRate)}
                  showLabel={false}
                />
              </div>
            </div>
          </div>

          {/* Test Plans List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Test Plans
              </h3>
            </div>
            {loadingTestPlans ? (
              <div className="p-6 text-center text-gray-500">
                Loading test plans...
              </div>
            ) : testPlans.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No test plans found
              </div>
            ) : (
              <div className="divide-y">
                {testPlans.map((testPlan) => (
                  <div
                    key={testPlan._id}
                    onClick={() => onTestPlanClick(testPlan._id)}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          {testPlan.name}
                        </h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {testPlan.owner && (
                            <span>Owner: {testPlan.owner.name}</span>
                          )}
                          {testPlan.assignees &&
                            testPlan.assignees.length > 0 && (
                              <span>
                                Assignees:{" "}
                                {testPlan.assignees
                                  .map((a) => a.name)
                                  .join(", ")}
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">
                            {testPlan.progress.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-600">Progress</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {testPlan.passRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-600">Pass Rate</p>
                        </div>
                        <StatusBadge
                          status={
                            testPlan.status === "running" ? "pass" : "untested"
                          }
                        />
                      </div>
                    </div>
                    {testPlan.lastRunTime && (
                      <div className="mt-2 text-xs text-gray-500">
                        Last run:{" "}
                        {new Date(testPlan.lastRunTime).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VersionDashboard;
