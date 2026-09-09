import { getToken, clearToken } from './auth';

const PSS_API_URL = import.meta.env.VITE_API_URL;
if (!PSS_API_URL) {
  console.error('[PSS API Configuration Error] VITE_API_URL is not configured.');
}
const API_BASE = (PSS_API_URL || '').replace(/\/$/, '');

async function request(url, options = {}) {
  if (!API_BASE) {
    throw new Error('VITE_API_URL is not configured. Please check your environment variables.');
  }

  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let endpoint = url.startsWith('/') ? url : `/${url}`;
  if (API_BASE.endsWith('/api') && endpoint.startsWith('/api/')) {
    endpoint = endpoint.replace(/^\/api/, '');
  } else if (!API_BASE.endsWith('/api') && !endpoint.startsWith('/api/')) {
    endpoint = `/api${endpoint}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  try {
    if (response.status === 401 && !url.includes('/auth') && !url.includes('/sync') && !url.includes('/hub-summary') && !url.includes('/planning')) {
      clearToken();
      throw new Error('Your session has expired. Please log in again.');
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error: ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) {
          errorMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
        } else if (errBody?.message) {
          errorMsg = Array.isArray(errBody.message)
            ? errBody.message.join(', ')
            : errBody.message;
        }
      } catch (_) { }
      throw new Error(errorMsg);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  } catch (err) {
    if (!options.silent && !url.includes('/sync') && !url.includes('/hub-summary')) {
      console.error(`API request to ${url} failed.`, err);
    }
    throw err;
  }
}

export const api = {
  // Authentication & ARMS Identity
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getAuthUsers: () => request('/auth/users'),

  // Service Catalogue
  getServices: (params = {}) => {
    const query = new URLSearchParams();
    if (params.classification) query.append('classification', params.classification);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.include_archived !== undefined) query.append('include_archived', params.include_archived);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);

    const queryString = query.toString();
    return request(`/services${queryString ? `?${queryString}` : ''}`);
  },
  getServiceById: (id) => request(`/services/${id}`),
  createService: (data) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getServiceModes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.include_inactive) query.append('include_inactive', 'true');
    const queryString = query.toString();
    return request(`/service-modes${queryString ? `?${queryString}` : ''}`);
  },
  createServiceMode: (data) => request('/service-modes', { method: 'POST', body: JSON.stringify(data) }),
  updateServiceMode: (id, data) => request(`/service-modes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleServiceMode: (id) => request(`/service-modes/${id}/toggle`, { method: 'PATCH' }),
  deleteServiceMode: (id) => request(`/service-modes/${id}`, { method: 'DELETE' }),
  archiveService: (id) => request(`/services/${id}/archive`, { method: 'PATCH' }),
  activateService: (id) => request(`/services/${id}/activate`, { method: 'PATCH' }),
  deactivateService: (id) => request(`/services/${id}/deactivate`, { method: 'PATCH' }),

  // Service Intake Fields
  getIntakeFields: (serviceId) => request(`/services/${serviceId}/intake-fields`),
  createIntakeField: (serviceId, data) => request(`/services/${serviceId}/intake-fields`, { method: 'POST', body: JSON.stringify(data) }),
  updateIntakeField: (serviceId, fieldId, data) => request(`/services/${serviceId}/intake-fields/${fieldId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIntakeField: (serviceId, fieldId) => request(`/services/${serviceId}/intake-fields/${fieldId}`, { method: 'DELETE' }),

  // Service NA Flags
  getNaFlags: (serviceId) => request(`/services/${serviceId}/na-flags`),
  createNaFlag: (serviceId, data) => request(`/services/${serviceId}/na-flags`, { method: 'POST', body: JSON.stringify(data) }),
  deleteNaFlag: (serviceId, flagId) => request(`/services/${serviceId}/na-flags/${flagId}`, { method: 'DELETE' }),

  // KPIs
  getKpis: (params = {}) => {
    const query = new URLSearchParams();
    if (params.service_id) query.append('service_id', params.service_id);
    if (params.category) query.append('category', params.category);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);
    if (params.include_inactive !== undefined) query.append('include_inactive', params.include_inactive);

    const queryString = query.toString();
    return request(`/kpis${queryString ? `?${queryString}` : ''}`);
  },

  createKpi: (data) => request('/kpis', { method: 'POST', body: JSON.stringify(data) }),
  updateKpi: (id, data) => request(`/kpis/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteKpi: (id) => request(`/kpis/${id}`, { method: 'DELETE' }),

  // SLA Rules
  getSlaRules: () => request('/sla-rules'),
  createSlaRule: (data) => request('/sla-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateSlaRule: (id, data) => request(`/sla-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  restoreSlaVersion: (id, versionId) => request(`/sla-rules/${id}/versions/${versionId}/restore`, { method: 'PATCH' }),

  // Holidays
  getHolidays: (params = {}) => {
    const query = new URLSearchParams();
    if (params.month) query.append('month', params.month);
    if (params.year) query.append('year', params.year);
    if (params.type) query.append('type', params.type);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const queryString = query.toString();
    return request(`/holidays${queryString ? `?${queryString}` : ''}`);
  },
  createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id, data) => request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),

  // Evaluation Periods
  getPeriods: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const queryString = query.toString();
    return request(`/periods${queryString ? `?${queryString}` : ''}`);
  },
  createPeriod: (data) => request('/periods', { method: 'POST', body: JSON.stringify(data) }),
  updatePeriod: (id, data) => request(`/periods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  closePeriod: (id) => request(`/periods/${id}/complete`, { method: 'PATCH' }),
  deletePeriod: (id) => request(`/periods/${id}`, { method: 'DELETE' }),

  // Commitments
  getCommitments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.period_id) query.append('period_id', params.period_id);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);

    const queryString = query.toString();
    return request(`/commitments${queryString ? `?${queryString}` : ''}`);
  },
  getCommitmentById: (id) => request(`/commitments/${id}`),
  createCommitment: (data) => request('/commitments', { method: 'POST', body: JSON.stringify(data) }),
  updateCommitment: (id, data) => request(`/commitments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  lockCommitment: (id) => request(`/commitments/${id}/lock`, { method: 'PATCH' }),
  requestRevision: (id, reason) => request(`/commitments/${id}/request-revision`, { method: 'POST', body: JSON.stringify({ reason }) }),
  exportCommitment: (id) => request(`/commitments/${id}/export`),
  logAuditEvent: (data) => request('/audit-events', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard
  getDashboardSummary: (params = {}) => {
    const query = new URLSearchParams();
    if (params.office) {
      const officeMap = {
        'ADMIN': 'Campus Administrative Office',
        'ACAD': 'Campus Academic Office',
        'ACADEME': 'Campus Academic Office',
        'OSAS': 'Campus Student Services and Affairs Office',
        'OVERALL': 'OVERALL',
      };
      const resolved = officeMap[params.office.toUpperCase()] || params.office;
      query.append('office', resolved);
    }
    const queryString = query.toString();
    return request(`/dashboard/summary${queryString ? `?${queryString}` : ''}`);
  },

  // Planning Configuration Hub (PS-P01)
  getPlanningHubSummary: () => request('/planning/hub-summary'),

  // Campus OPCR Tracker (PS-P06)
  getOpcrStatus: (periodId) => request(`/planning/opcr-status?period_id=${encodeURIComponent(periodId)}`),


  // Offices (dynamic integration)
  getOffices: () => request('/offices'),

  // SLA Monitor
  getSlaComputationLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.service_id) query.append('service_id', params.service_id);
    if (params.transaction_id) query.append('transaction_id', params.transaction_id);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_order) query.append('sort_order', params.sort_order);

    const queryString = query.toString();
    return request(`/sla-computation-logs${queryString ? `?${queryString}` : ''}`);
  },
  getServiceUtilization: () => request('/service-utilization'),
  getSyncVersion: async () => {
    try {
      const res = await request('/services?limit=1', { silent: true });
      if (res && res.total !== undefined) {
        return { version: res.total };
      }
    } catch (_) { }
    return { version: 0 };
  },
};
