'use client';

import React, { useState } from 'react';
import ProjectDashboard from './ProjectDashboard';
import VersionDashboard from './VersionDashboard';
import TestPlanDetail from './TestPlanDetail';
import type { DashboardLevel } from '@/lib/tcmTypes';

const QADashboard: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState<DashboardLevel>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [selectedTestPlanId, setSelectedTestPlanId] = useState<string>('');
  const [selectedVersionName, setSelectedVersionName] = useState<string>('');

  const handleProjectClick = (projectId: string, projectName?: string) => {
    setSelectedProjectId(projectId);
    if (projectName) setSelectedProjectName(projectName);
    setCurrentLevel('version');
  };

  const handleTestPlanClick = (testPlanId: string) => {
    setSelectedTestPlanId(testPlanId);
    setCurrentLevel('testplan');
  };

  const handleBack = () => {
    if (currentLevel === 'testplan') {
      setCurrentLevel('version');
      setSelectedTestPlanId('');
    } else if (currentLevel === 'version') {
      setCurrentLevel('project');
      setSelectedProjectId('');
      setSelectedProjectName('');
      setSelectedVersionName('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentLevel === 'project' && (
          <ProjectDashboard onProjectClick={handleProjectClick} />
        )}

        {currentLevel === 'version' && selectedProjectId && (
          <VersionDashboard
            projectId={selectedProjectId}
            projectName={selectedProjectName}
            onBack={handleBack}
            onTestPlanClick={handleTestPlanClick}
          />
        )}

        {currentLevel === 'testplan' && selectedTestPlanId && (
          <TestPlanDetail
            testPlanId={selectedTestPlanId}
            projectName={selectedProjectName}
            versionName={selectedVersionName}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default QADashboard;
