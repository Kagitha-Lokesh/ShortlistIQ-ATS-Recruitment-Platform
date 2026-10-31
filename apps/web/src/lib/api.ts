import { ApiErrorResponse, ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';
import { ResumeScoreBreakdown } from '@shortlistiq/engine';

const TOKEN_KEY = 'shortlistiq_auth_token';
const ANON_TOKEN_KEY = 'shortlistiq_anon_token';

export class ApiError extends Error {
  public code: string;
  public details?: unknown;
  public requestId?: string;

  constructor(code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

const memoryStore = new Map<string, string>();

export const tokenStorage = {
  get: (): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(TOKEN_KEY);
      }
    } catch {
      // Ignored
    }
    return memoryStore.get(TOKEN_KEY) || null;
  },
  set: (token: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } catch {
      // Ignored
    }
    memoryStore.set(TOKEN_KEY, token);
  },
  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Ignored
    }
    memoryStore.delete(TOKEN_KEY);
  }
};

export const anonTokenStorage = {
  get: (): string => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let token = window.localStorage.getItem(ANON_TOKEN_KEY);
        if (!token) {
          token = 'anon-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
          window.localStorage.setItem(ANON_TOKEN_KEY, token);
        }
        return token;
      }
    } catch {
      // Ignored
    }
    let memToken = memoryStore.get(ANON_TOKEN_KEY);
    if (!memToken) {
      memToken = 'anon-' + Math.random().toString(36).substring(2, 11);
      memoryStore.set(ANON_TOKEN_KEY, memToken);
    }
    return memToken;
  },
  set: (token: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ANON_TOKEN_KEY, token);
      }
    } catch {
      // Ignored
    }
    memoryStore.set(ANON_TOKEN_KEY, token);
  }
};

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = false, headers = {}, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    ...(headers as Record<string, string>)
  };

  // If body is NOT FormData, default to application/json
  if (!(rest.body instanceof FormData) && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // Always attach anonymous token for guest session continuity
  const anonToken = anonTokenStorage.get();
  if (anonToken && !requestHeaders['x-anon-token']) {
    requestHeaders['x-anon-token'] = anonToken;
  }

  const token = tokenStorage.get();
  if (token && requiresAuth) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      ...rest
    });

    // Check if API returned an updated anon token header
    const returnedAnonToken = response.headers.get('x-anon-token');
    if (returnedAnonToken) {
      anonTokenStorage.set(returnedAnonToken);
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorData = data as ApiErrorResponse | null;
      if (errorData?.error) {
        throw new ApiError(
          errorData.error.code,
          errorData.error.message,
          errorData.error.details,
          (errorData.error as { requestId?: string }).requestId
        );
      }
      throw new ApiError(
        'HTTP_ERROR',
        `Request failed with status ${response.status}`,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Unable to connect to the server. Please check your connection.'
    );
  }
}

export interface CandidateCheckData {
  id: string;
  jobTitle: string;
  company: string | null;
  scoreBefore: number;
  scoreAfter: number | null;
  breakdown: ResumeScoreBreakdown;
  status: string;
  createdAt: string;
  jdText?: string;
  resumeText?: string;
  suggestions?: SuggestionItem[];
}

export interface SuggestionItem {
  id: string;
  checkId: string;
  section: string;
  originalText: string;
  proposedText: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  finalText: string | null;
  createdAt: string;
}

export const checksApi = {
  async createCheck(formData: FormData): Promise<{ success: boolean; data: CandidateCheckData }> {
    return apiClient<{ success: boolean; data: CandidateCheckData }>('/api/v1/checks', {
      method: 'POST',
      body: formData
    });
  },

  async getCheck(id: string): Promise<{ success: boolean; data: CandidateCheckData }> {
    return apiClient<{ success: boolean; data: CandidateCheckData }>(`/api/v1/checks/${id}`, {
      method: 'GET'
    });
  },

  async getUserChecks(): Promise<{ success: boolean; data: CandidateCheckData[] }> {
    return apiClient<{ success: boolean; data: CandidateCheckData[] }>('/api/v1/checks', {
      method: 'GET',
      requiresAuth: true
    });
  },

  async getSuggestions(checkId: string): Promise<{ success: boolean; data: SuggestionItem[] }> {
    return apiClient<{ success: boolean; data: SuggestionItem[] }>(`/api/v1/checks/${checkId}/suggestions`, {
      method: 'POST'
    });
  },

  async updateSuggestion(
    checkId: string,
    suggestionId: string,
    data: { status?: 'accepted' | 'rejected' | 'edited'; finalText?: string; projectedScore?: number }
  ): Promise<{ success: boolean; data: SuggestionItem }> {
    return apiClient<{ success: boolean; data: SuggestionItem }>(
      `/api/v1/checks/${checkId}/suggestions/${suggestionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      }
    );
  },

  async getResumeData(checkId: string): Promise<{
    success: boolean;
    data: {
      resumeData: ResumeData;
      isConfident: boolean;
      missingFields: string[];
    };
  }> {
    return apiClient(`/api/v1/checks/${checkId}/resume-data`, {
      method: 'GET'
    });
  },

  async verifyAndExportPdf(
    checkId: string,
    payload: { resumeData: ResumeData; options: TemplateThemeOptions }
  ): Promise<{
    success: boolean;
    data: {
      verification: {
        extractable: boolean;
        pageCount: number;
        characterCount: number;
        sectionsDetected: string[];
        reParsedScore: number;
      };
      base64: string;
    };
  }> {
    return apiClient(`/api/v1/checks/${checkId}/export/pdf`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async downloadPdf(
    checkId: string,
    payload: { resumeData: ResumeData; options: TemplateThemeOptions },
    filename = 'Resume.pdf'
  ): Promise<void> {
    const res = await fetch(`/api/v1/checks/${checkId}/export/pdf?download=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': anonTokenStorage.get()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('Failed to download PDF resume');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async downloadDocx(
    checkId: string,
    payload: { resumeData: ResumeData; options: TemplateThemeOptions },
    filename = 'Resume.docx'
  ): Promise<void> {
    const res = await fetch(`/api/v1/checks/${checkId}/export/docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anon-token': anonTokenStorage.get()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error('Failed to download DOCX resume');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Phase 6 HR Batches & Candidates API Client Methods
  async getDashboard(): Promise<{
    stats: {
      activeBatches: number;
      resumesProcessed: number;
      shortlistedThisMonth: number;
      emailsSent: number;
    };
    recentBatches: Array<{
      id: string;
      name: string;
      jobTitle: string;
      status: 'draft' | 'active' | 'closed' | 'archived';
      cutoff: number;
      createdAt: string;
      candidateCounts: {
        total: number;
        scored: number;
        pending: number;
        processing: number;
        failed: number;
        shortlisted: number;
      };
    }>;
  }> {
    const res = await apiClient<{ success: boolean; data: any }>('/api/v1/hr/dashboard', {
      requiresAuth: true
    });
    return res.data;
  },

  async getBatch(id: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(`/api/v1/batches/${id}`, {
      requiresAuth: true
    });
    return res.data;
  },

  async createBatch(payload: {
    name: string;
    jobTitle: string;
    jdText: string;
    criteria?: any;
    cutoff?: number;
    status?: 'draft' | 'active';
  }): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>('/api/v1/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return res.data;
  },

  async updateBatch(id: string, payload: any): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(`/api/v1/batches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true
    });
    return res.data;
  },

  async getCandidates(batchId: string, filters?: { status?: string; decision?: string }): Promise<any[]> {
    let url = `/api/v1/batches/${batchId}/candidates`;
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.decision) params.append('decision', filters.decision);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await apiClient<{ success: boolean; data: any[] }>(url, {
      requiresAuth: true
    });
    return res.data;
  },

  async uploadCandidateChunk(batchId: string, files: File[]): Promise<any[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const res = await apiClient<{ success: boolean; data: any[] }>(
      `/api/v1/batches/${batchId}/candidates/upload`,
      {
        method: 'POST',
        body: formData,
        requiresAuth: true
      }
    );
    return res.data;
  },

  async retryFailed(batchId: string): Promise<{ retriedCount: number }> {
    const res = await apiClient<{ success: boolean; retriedCount: number }>(
      `/api/v1/batches/${batchId}/candidates/retry`,
      {
        method: 'POST',
        requiresAuth: true
      }
    );
    return res;
  },

  async updateCandidate(
    batchId: string,
    candidateId: string,
    payload: { email?: string; fullName?: string; phone?: string; notes?: string; formAnswers?: any }
  ): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      `/api/v1/batches/${batchId}/candidates/${candidateId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
        requiresAuth: true
      }
    );
    return res.data;
  },

  // Phase 7: Criteria Builder & Review Dashboard Methods
  async suggestCriteria(batchId: string): Promise<any[]> {
    const res = await apiClient<{ success: boolean; data: any[] }>(
      `/api/v1/batches/${batchId}/criteria/suggest`,
      {
        method: 'POST',
        requiresAuth: true
      }
    );
    return res.data;
  },

  async previewCriteria(batchId: string, payload: {
    criteria: any[];
    cutoff?: number;
    alwaysRequireAllMustHaves?: boolean;
  }): Promise<any[]> {
    const res = await apiClient<{ success: boolean; data: any[] }>(
      `/api/v1/batches/${batchId}/criteria/preview`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async saveCriteria(batchId: string, payload: {
    criteria: any[];
    cutoff: number;
    alwaysRequireAllMustHaves: boolean;
  }): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any; enqueuedCount: number }>(
      `/api/v1/batches/${batchId}/criteria`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        requiresAuth: true
      }
    );
    return res;
  },

  async bulkUpdateDecisions(
    batchId: string,
    candidateIds: string[],
    decision: 'shortlisted' | 'unshortlisted' | 'needs_review'
  ): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any[]; updatedCount: number }>(
      `/api/v1/batches/${batchId}/candidates/bulk-decision`,
      {
        method: 'POST',
        body: JSON.stringify({ candidateIds, decision }),
        requiresAuth: true
      }
    );
    return res;
  },

  async getResumePdfUrl(batchId: string, candidateId: string): Promise<string> {
    const res = await apiClient<{ success: boolean; data: { signedUrl: string; expiresAt: string } }>(
      `/api/v1/batches/${batchId}/candidates/${candidateId}/resume-url`,
      {
        method: 'GET',
        requiresAuth: true
      }
    );
    return res.data.signedUrl;
  },

  async downloadBatchCsv(batchId: string, filename = 'candidates.csv'): Promise<void> {
    const token = tokenStorage.get();
    const res = await fetch(`/api/v1/batches/${batchId}/export/csv`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!res.ok) {
      throw new Error('Failed to export candidates CSV');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Phase 8: Application Forms & Public Submissions Methods
  async getBatchForms(batchId: string): Promise<any[]> {
    const res = await apiClient<{ success: boolean; data: any[] }>(
      `/api/v1/forms/batch/${batchId}`,
      {
        method: 'GET',
        requiresAuth: true
      }
    );
    return res.data;
  },

  async createForm(data: {
    batchId: string;
    title: string;
    slug: string;
    schema: any;
    knockoutRules?: any[];
    isPublished?: boolean;
  }): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      '/api/v1/forms',
      {
        method: 'POST',
        body: JSON.stringify(data),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async getForm(id: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      `/api/v1/forms/${id}`,
      {
        method: 'GET',
        requiresAuth: true
      }
    );
    return res.data;
  },

  async updateForm(id: string, data: any): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      `/api/v1/forms/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async toggleFormPublished(id: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      `/api/v1/forms/${id}/toggle-publish`,
      {
        method: 'POST',
        requiresAuth: true
      }
    );
    return res.data;
  },

  async deleteForm(id: string): Promise<void> {
    await apiClient<{ success: boolean }>(
      `/api/v1/forms/${id}`,
      {
        method: 'DELETE',
        requiresAuth: true
      }
    );
  },

  async getPublicForm(slug: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(
      `/api/v1/forms/public/${slug}`,
      {
        method: 'GET'
      }
    );
    return res.data;
  },

  async submitPublicApplication(slug: string, formData: FormData): Promise<any> {
    const res = await fetch(`/api/v1/forms/public/${slug}/submit`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const err = data?.error;
      throw new Error(err?.message || 'Failed to submit application. Please check your inputs and try again.');
    }

    return data;
  },

  // Phase 9: Email
  async getEmailAccounts(): Promise<EmailAccount[]> {
    const res = await apiClient<{ success: boolean; data: EmailAccount[] }>(
      '/api/v1/email/accounts',
      { method: 'GET', requiresAuth: true }
    );
    return res.data;
  },

  async getOAuthConnectUrl(provider: 'gmail' | 'outlook'): Promise<{ url: string }> {
    const res = await apiClient<{ success: boolean; data: { url: string } }>(
      `/api/v1/email/oauth/connect/${provider}`,
      { method: 'GET', requiresAuth: true }
    );
    return res.data;
  },

  async connectMockEmail(provider: 'gmail' | 'outlook', address: string): Promise<EmailAccount> {
    const res = await apiClient<{ success: boolean; data: EmailAccount }>(
      '/api/v1/email/mock-connect',
      {
        method: 'POST',
        body: JSON.stringify({ provider, address }),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async disconnectEmailAccount(id: string): Promise<void> {
    await apiClient<{ success: boolean; message: string }>(
      `/api/v1/email/accounts/${id}`,
      { method: 'DELETE', requiresAuth: true }
    );
  },

  async getBatchTemplates(batchId: string): Promise<EmailTemplatesResponse> {
    const res = await apiClient<{ success: boolean; data: EmailTemplatesResponse }>(
      `/api/v1/email/batches/${batchId}/templates`,
      { method: 'GET', requiresAuth: true }
    );
    return res.data;
  },

  async updateBatchTemplates(
    batchId: string,
    data: {
      shortlisted?: { subject: string; bodyHtml: string };
      unshortlisted?: { subject: string; bodyHtml: string };
    }
  ): Promise<EmailTemplatesResponse> {
    const res = await apiClient<{ success: boolean; data: EmailTemplatesResponse }>(
      `/api/v1/email/batches/${batchId}/templates`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async sendTestEmail(
    batchId: string,
    kind: 'shortlisted' | 'unshortlisted'
  ): Promise<{ recipient: string; subject: string; previewHtml: string }> {
    const res = await apiClient<{
      success: boolean;
      data: { recipient: string; subject: string; previewHtml: string };
    }>(`/api/v1/email/batches/${batchId}/test`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
      requiresAuth: true
    });
    return res.data;
  },

  async finalizeBatch(
    batchId: string,
    confirmation: string
  ): Promise<FinalizeBatchResult> {
    const res = await apiClient<{ success: boolean; data: FinalizeBatchResult }>(
      `/api/v1/email/batches/${batchId}/finalize`,
      {
        method: 'POST',
        body: JSON.stringify({ confirmation }),
        requiresAuth: true
      }
    );
    return res.data;
  },

  async getBatchEmailSends(batchId: string): Promise<EmailBatchSendsResponse> {
    const res = await apiClient<{ success: boolean; data: EmailBatchSendsResponse }>(
      `/api/v1/email/batches/${batchId}/sends`,
      { method: 'GET', requiresAuth: true }
    );
    return res.data;
  },

  async retryFailedEmailSends(batchId: string): Promise<{ retriedCount: number }> {
    const res = await apiClient<{ success: boolean; data: { retriedCount: number } }>(
      `/api/v1/email/batches/${batchId}/retry`,
      {
        method: 'POST',
        requiresAuth: true
      }
    );
    return res.data;
  },

  // Phase 10: Privacy and Data Lifecycle
  async requestDeletion(email: string): Promise<{ success: boolean; message: string; emailHash: string }> {
    return apiClient('/api/v1/privacy/deletion-request', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async verifyDeletion(email: string, code: string): Promise<{
    success: boolean;
    message: string;
    data: { recordsDeleted: number; filesDeleted: number };
  }> {
    return apiClient('/api/v1/privacy/verify-deletion', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  },

  async deleteCheck(id: string): Promise<void> {
    await apiClient(`/api/v1/checks/${id}`, {
      method: 'DELETE',
      requiresAuth: true
    });
  },

  async deleteSelfCandidateData(): Promise<{ success: boolean; message: string }> {
    return apiClient('/api/v1/checks/self/data', {
      method: 'DELETE',
      requiresAuth: true
    });
  },

  async deleteBatch(id: string): Promise<{
    success: boolean;
    message: string;
    data: { batchId: string; candidateCount: number; filesDeleted: number };
  }> {
    return apiClient(`/api/v1/batches/${id}`, {
      method: 'DELETE',
      requiresAuth: true
    });
  },

  async getOrgSettings(): Promise<{ id: string; name: string; retentionDays: number; createdAt: string }> {
    const res = await apiClient<{
      success: boolean;
      data: { id: string; name: string; retentionDays: number; createdAt: string };
    }>('/api/v1/org/settings', {
      method: 'GET',
      requiresAuth: true
    });
    return res.data;
  },

  async updateOrgSettings(data: { name?: string; retentionDays?: number }): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>('/api/v1/org/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
      requiresAuth: true
    });
    return res.data;
  },

  async getOrgPrivacyActivity(): Promise<Array<{ id: string; action: string; entity: string; createdAt: string; meta: any }>> {
    const res = await apiClient<{
      success: boolean;
      data: Array<{ id: string; action: string; entity: string; createdAt: string; meta: any }>;
    }>('/api/v1/org/privacy-activity', {
      method: 'GET',
      requiresAuth: true
    });
    return res.data;
  },

  async runDataLifecycleCleanup(): Promise<{
    deletedCandidates: number;
    deletedChecks: number;
    deletedFiles: number;
  }> {
    const res = await apiClient<{
      success: boolean;
      data: { deletedCandidates: number; deletedChecks: number; deletedFiles: number };
    }>('/api/v1/privacy/run-lifecycle-cleanup', {
      method: 'POST',
      requiresAuth: true
    });
    return res.data;
  }
};

export interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook';
  address: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateItem {
  id: string;
  batchId: string;
  kind: 'shortlisted' | 'unshortlisted';
  subject: string;
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplatesResponse {
  shortlisted: EmailTemplateItem;
  unshortlisted: EmailTemplateItem;
}

export interface EmailSendItem {
  id: string;
  batchId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  isManualEmail?: boolean;
  kind: 'shortlisted' | 'unshortlisted';
  status: 'queued' | 'sent' | 'failed' | 'bounced';
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailBatchStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  shortlisted: number;
  unshortlisted: number;
}

export interface EmailBatchSendsResponse {
  batch: {
    id: string;
    name: string;
    status: string;
    finalizedAt: string | null;
  };
  connectedSender: EmailAccount | null;
  stats: EmailBatchStats;
  sends: EmailSendItem[];
}

export interface FinalizeBatchResult {
  batchId: string;
  status: string;
  queuedCount: number;
  candidateCounts: {
    shortlisted: number;
    unshortlisted: number;
    needsReview: number;
    total: number;
  };
}

export const shortlistApi = checksApi;
