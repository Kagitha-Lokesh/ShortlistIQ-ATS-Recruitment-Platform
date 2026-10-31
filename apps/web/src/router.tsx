import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout.js';
import { CandidateLayout } from './layouts/CandidateLayout.js';
import { HRLayout } from './layouts/HRLayout.js';
import { LandingPage } from './pages/public/LandingPage.js';
import { SignInPage } from './pages/auth/SignInPage.js';
import { SignUpHRPage } from './pages/auth/SignUpHRPage.js';
import { CheckerPage } from './pages/candidate/CheckerPage.js';
import { ResultsPage } from './pages/candidate/ResultsPage.js';
import { SuggestionsPage } from './pages/candidate/SuggestionsPage.js';
import { ExportPage } from './pages/candidate/ExportPage.js';
import { DashboardPage } from './pages/hr/DashboardPage.js';
import { CreateBatchPage } from './pages/hr/CreateBatchPage.js';
import { BatchDetailPage } from './pages/hr/BatchDetailPage.js';
import { SettingsPage } from './pages/hr/SettingsPage.js';
import { ApplyPage } from './pages/public/ApplyPage.js';
import { CandidateDataDeletionPage } from './pages/candidate/CandidateDataDeletionPage.js';
import { PrivacyPolicyPage } from './pages/public/PrivacyPolicyPage.js';
import { TermsOfServicePage } from './pages/public/TermsOfServicePage.js';
import { ComponentShowcasePage } from './pages/dev/ComponentShowcasePage.js';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Application Form Route (Stand-alone, Mobile-First) */}
      <Route path="/apply/:slug" element={<ApplyPage />} />

      {/* Candidate Privacy Erasure Portal (Public) */}
      <Route path="/privacy/delete-data" element={<CandidateDataDeletionPage />} />

      {/* Internal Component & Token Showcase (Dev Only) */}
      <Route path="/dev/showcase" element={<ComponentShowcasePage />} />

      {/* Public Marketing Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup-hr" element={<SignUpHRPage />} />
      </Route>

      {/* Candidate Routes (Login Optional) */}
      <Route element={<CandidateLayout />}>
        <Route path="/checker" element={<CheckerPage />} />
        <Route path="/candidate" element={<Navigate to="/checker" replace />} />
        <Route path="/checks/:id" element={<ResultsPage />} />
        <Route path="/checks/:id/suggestions" element={<SuggestionsPage />} />
        <Route path="/checks/:id/export" element={<ExportPage />} />
      </Route>

      {/* HR Protected Routes */}
      <Route element={<HRLayout />}>
        <Route path="/hr/dashboard" element={<DashboardPage />} />
        <Route path="/hr/batches/new" element={<CreateBatchPage />} />
        <Route path="/hr/batches/:id" element={<BatchDetailPage />} />
        <Route path="/hr/jobs" element={<DashboardPage />} />
        <Route path="/hr/candidates" element={<DashboardPage />} />
        <Route path="/hr/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

