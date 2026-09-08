import { create } from "zustand";
import { api } from "../services/api";
import {
    authProvider,
    getUserRoleFromToken,
    decodeCurrentUser,
    encodeMockToken,
    PREDEFINED_MOCK_USERS,
    ROLE_DEFAULT_PAGE,
} from "../services/auth";
import { getPermissions } from "../services/permissions";

// Helper functions for SLA target formatting
const formatSlaTarget = (s) => {
    if (!s.sla_target_value) return "—";
    if (s.sla_target_unit === 'Days') return `${s.sla_target_value}d`;
    if (s.sla_target_unit === 'Minutes') {
        const total = s.sla_target_value;
        const d = Math.floor(total / 1440);
        const h = Math.floor((total % 1440) / 60);
        const m = Math.round(total % 60);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || parts.length === 0) parts.push(`${m}m`);
        return parts.join(" ");
    }
    return `${s.sla_target_value} ${s.sla_target_unit}`;
};

const determineReferral = (s, storedReferrals) => {
    const defaultReferral = (() => {
        if (s.name.toLowerCase().includes('clearance') || s.name.toLowerCase().includes('proposal') || s.name.toLowerCase().includes('grades')) {
            return 'without';
        } else if (s.name.toLowerCase().includes('card') || s.name.toLowerCase().includes('accreditation') || s.name.toLowerCase().includes('grase')) {
            return 'with';
        } else {
            const charCodeSum = s.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return charCodeSum % 3 === 0 ? 'with' : charCodeSum % 3 === 1 ? 'without' : 'n/a';
        }
    })();
    return storedReferrals[s.id] || storedReferrals[s.name] || defaultReferral;
};

// Map Holiday helper functions
const mapHolidayTypeToFrontend = (t) => {
    switch (t) {
        case "REGULAR": return "National";
        case "SPECIAL_NON_WORKING": return "Local";
        case "COMPANY": return "Campus";
        default: return "National";
    }
};

const mapHolidayTypeToBackend = (t) => {
    switch (t) {
        case "National": return "REGULAR";
        case "Local": return "SPECIAL_NON_WORKING";
        case "Campus": return "COMPANY";
        default: return "REGULAR";
    }
};

// Map Period helper functions
const mapPeriodTypeToFrontend = (t) => {
    switch (t) {
        case "Quarterly": return "Quarterly";
        case "Semester": return "Semestral";
        case "SEMI_ANNUAL": return "Semestral";
        case "BI_ANNUAL": return "Bi-Annual";
        case "Yearly":
        case "Annual": return "Annual";
        default: return "Semestral";
    }
};

const mapPeriodTypeToBackend = (t) => {
    switch (t) {
        case "Quarterly": return "Quarterly";
        case "Semestral": return "Semester";
        case "Bi-Annual": return "BI_ANNUAL";
        case "Annual": return "Yearly";
        default: return "Semester";
    }
};

const mapPeriodStatusToFrontend = (s) => {
    return s === "Open" ? "Active" : "Closed";
};

// Local Storage & Mock Fallback Defaults
const getCached = (key, fallback) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch {
        return fallback;
    }
};

const setCached = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn(`[useAppStore] Failed to cache ${key}:`, e);
    }
};

const DEFAULT_SERVICE_MODES = [
    { id: 'sm-1', name: 'Walk-in', description: 'In-person transactions at campus offices', is_active: true, created_at: new Date().toISOString() },
    { id: 'sm-2', name: 'Online', description: 'Services delivered through digital portals or email', is_active: true, created_at: new Date().toISOString() },
    { id: 'sm-3', name: 'Courier', description: 'Delivery or submission via postal/courier services', is_active: true, created_at: new Date().toISOString() },
    { id: 'sm-4', name: 'Hybrid', description: 'Combination of online submission and physical pickup', is_active: true, created_at: new Date().toISOString() },
];

const DEFAULT_SERVICES = [
    {
        id: 'svc-1',
        name: 'Issuance of Transcript of Records (TOR)',
        classification: 'Complex',
        slaTarget: '3d',
        sla: '3d',
        sla_target_value: 3,
        sla_target_unit: 'Days',
        responsibleUnit: 'Academic Office',
        responsible_unit: 'Academic Office',
        active: true,
        status: 'ACTIVE',
        naFlags: [],
        naFlag: false,
        archived: false,
        withReferral: 'without',
        lastUpdated: '03/01/26 09:30',
        intakeDocuments: 'Duly Accomplished Clearance Form\nOfficial Receipt of Payment\n1x1 ID Picture',
        stepsTimeline: 'Step 1: Document Verification\nStep 2: Payment Verification\nStep 3: Printing & Signatures\nStep 4: Release',
        processing_steps: ['Step 1: Document Verification', 'Step 2: Payment Verification', 'Step 3: Printing & Signatures', 'Step 4: Release'],
        expectedOutput: 'Official Transcript of Records',
        modes: [{ id: 'sm-1', name: 'Walk-in' }, { id: 'sm-2', name: 'Online' }],
        mode_ids: ['sm-1', 'sm-2'],
    },
    {
        id: 'svc-2',
        name: 'Application for Graduation & Academic Evaluation',
        classification: 'Highly Technical',
        slaTarget: '7d',
        sla: '7d',
        sla_target_value: 7,
        sla_target_unit: 'Days',
        responsibleUnit: 'Academic Office',
        responsible_unit: 'Academic Office',
        active: true,
        status: 'ACTIVE',
        naFlags: [],
        naFlag: false,
        archived: false,
        withReferral: 'with',
        lastUpdated: '03/02/26 14:15',
        intakeDocuments: 'Curriculum Checklist\nBirth Certificate (PSA)\nCertificate of Candidacy',
        stepsTimeline: 'Step 1: Course Audit\nStep 2: Department Endorsement\nStep 3: Dean Approval\nStep 4: Final Conferment List',
        processing_steps: ['Step 1: Course Audit', 'Step 2: Department Endorsement', 'Step 3: Dean Approval', 'Step 4: Final Conferment List'],
        expectedOutput: 'Graduation Clearance Certificate',
        modes: [{ id: 'sm-1', name: 'Walk-in' }, { id: 'sm-2', name: 'Online' }],
        mode_ids: ['sm-1', 'sm-2'],
    },
    {
        id: 'svc-3',
        name: 'Issuance of Certificate of Good Moral Character',
        classification: 'Simple',
        slaTarget: '1d',
        sla: '1d',
        sla_target_value: 1,
        sla_target_unit: 'Days',
        responsibleUnit: 'OSAS',
        responsible_unit: 'OSAS',
        active: true,
        status: 'ACTIVE',
        naFlags: [],
        naFlag: false,
        archived: false,
        withReferral: 'without',
        lastUpdated: '03/03/26 11:00',
        intakeDocuments: 'Student ID\nAffidavit of No Disciplinary Record\nReceipt',
        stepsTimeline: 'Step 1: Student Record Check\nStep 2: Director Sign-off\nStep 3: Release',
        processing_steps: ['Step 1: Student Record Check', 'Step 2: Director Sign-off', 'Step 3: Release'],
        expectedOutput: 'Certificate of Good Moral Character',
        modes: [{ id: 'sm-1', name: 'Walk-in' }, { id: 'sm-2', name: 'Online' }],
        mode_ids: ['sm-1', 'sm-2'],
    },
    {
        id: 'svc-4',
        name: 'Student Organization Accreditation & Renewal',
        classification: 'Complex',
        slaTarget: '5d',
        sla: '5d',
        sla_target_value: 5,
        sla_target_unit: 'Days',
        responsibleUnit: 'OSAS',
        responsible_unit: 'OSAS',
        active: true,
        status: 'ACTIVE',
        naFlags: [],
        naFlag: false,
        archived: false,
        withReferral: 'with',
        lastUpdated: '03/04/26 16:45',
        intakeDocuments: 'Constitution and By-Laws\nRoster of Officers & Members\nCalendar of Activities\nFaculty Adviser Endorsement',
        stepsTimeline: 'Step 1: OSAS Evaluation\nStep 2: Campus Director Endorsement\nStep 3: Issuance of Certificate',
        processing_steps: ['Step 1: OSAS Evaluation', 'Step 2: Campus Director Endorsement', 'Step 3: Issuance of Certificate'],
        expectedOutput: 'Certificate of Accreditation',
        modes: [{ id: 'sm-1', name: 'Walk-in' }],
        mode_ids: ['sm-1'],
    },
    {
        id: 'svc-5',
        name: 'Campus Facility and Equipment Reservation',
        classification: 'Simple',
        slaTarget: '2d',
        sla: '2d',
        sla_target_value: 2,
        sla_target_unit: 'Days',
        responsibleUnit: 'Administrative Office',
        responsible_unit: 'Administrative Office',
        active: true,
        status: 'ACTIVE',
        naFlags: [],
        naFlag: false,
        archived: false,
        withReferral: 'without',
        lastUpdated: '03/05/26 10:20',
        intakeDocuments: 'Facility Request Form\nActivity Proposal\nSafety Clearance',
        stepsTimeline: 'Step 1: Availability Check\nStep 2: Administrative Head Approval\nStep 3: Security Notification',
        processing_steps: ['Step 1: Availability Check', 'Step 2: Administrative Head Approval', 'Step 3: Security Notification'],
        expectedOutput: 'Approved Facility Reservation Slip',
        modes: [{ id: 'sm-1', name: 'Walk-in' }, { id: 'sm-2', name: 'Online' }],
        mode_ids: ['sm-1', 'sm-2'],
    },
];

const DEFAULT_KPIS = [
    {
        id: 'kpi-1',
        title: 'SLA Compliance Rate',
        name: 'SLA Compliance Rate',
        category: 'Timeliness',
        target_value: '95',
        unit: '%',
        office: 'Academic Office',
        active: true,
        is_active: true,
        description: 'Percentage of student requests completed within prescribed SLA.'
    },
    {
        id: 'kpi-2',
        title: 'Citizen Satisfaction Index (CSAT)',
        name: 'Citizen Satisfaction Index (CSAT)',
        category: 'Quality',
        target_value: '4.5',
        unit: ' Mins',
        office: 'OSAS',
        active: true,
        is_active: true,
        description: 'Average feedback score from client satisfaction surveys.'
    },
    {
        id: 'kpi-3',
        title: 'Process Turnaround Efficiency',
        name: 'Process Turnaround Efficiency',
        category: 'Efficiency',
        target_value: '90',
        unit: '%',
        office: 'Administrative Office',
        active: true,
        is_active: true,
        description: 'Efficiency rating on resource utilization and bottleneck reduction.'
    }
];

const DEFAULT_HOLIDAYS = [
    { id: 'hol-1', name: "New Year's Day", date: '2026-01-01', type: 'National', is_recurring: true },
    { id: 'hol-2', name: 'Araw ng Kagitingan', date: '2026-04-09', type: 'National', is_recurring: true },
    { id: 'hol-3', name: 'Labor Day', date: '2026-05-01', type: 'National', is_recurring: true },
    { id: 'hol-4', name: 'Independence Day', date: '2026-06-12', type: 'National', is_recurring: true },
    { id: 'hol-5', name: 'PUP Caloocan Founding Day', date: '2026-07-15', type: 'Campus', is_recurring: true },
    { id: 'hol-6', name: 'National Heroes Day', date: '2026-08-31', type: 'National', is_recurring: true },
    { id: 'hol-7', name: 'Bonifacio Day', date: '2026-11-30', type: 'National', is_recurring: true },
    { id: 'hol-8', name: 'Christmas Day', date: '2026-12-25', type: 'National', is_recurring: true },
    { id: 'hol-9', name: 'Rizal Day', date: '2026-12-30', type: 'National', is_recurring: true },
];

const DEFAULT_PERIODS = [
    {
        id: 'per-1',
        name: '1st Semester A.Y. 2025-2026',
        period_type: 'Semester',
        type: 'Semestral',
        start_date: '2025-09-01',
        end_date: '2026-01-31',
        status: 'Active',
    },
    {
        id: 'per-2',
        name: '2nd Semester A.Y. 2025-2026',
        period_type: 'Semester',
        type: 'Semestral',
        start_date: '2026-02-15',
        end_date: '2026-06-30',
        status: 'Queued',
    },
    {
        id: 'per-3',
        name: 'Midyear Term 2025',
        period_type: 'Quarterly',
        type: 'Quarterly',
        start_date: '2025-07-01',
        end_date: '2025-08-15',
        status: 'Closed',
    }
];

const DEFAULT_COMMITMENTS = [
    {
        id: 'comm-1',
        title: 'Academic Office OPCR 2025-2026',
        office: 'Academic Office',
        period_id: 'per-1',
        period_name: '1st Semester A.Y. 2025-2026',
        status: 'LOCKED',
        rating: 4.85,
        submitted_by: 'mock_academic_head',
        created_at: '2025-09-10T08:00:00.000Z'
    },
    {
        id: 'comm-2',
        title: 'OSAS OPCR Commitment 2025-2026',
        office: 'OSAS',
        period_id: 'per-1',
        period_name: '1st Semester A.Y. 2025-2026',
        status: 'DRAFT',
        rating: null,
        submitted_by: 'mock_osas_head',
        created_at: '2025-09-12T09:30:00.000Z'
    },
    {
        id: 'comm-3',
        title: 'Administrative Office OPCR 2025-2026',
        office: 'Administrative Office',
        period_id: 'per-1',
        period_name: '1st Semester A.Y. 2025-2026',
        status: 'REVISION_REQUESTED',
        rating: null,
        submitted_by: 'mock_admin_head',
        created_at: '2025-09-14T11:00:00.000Z'
    }
];

// Derive initial user state from TemporaryAuthProvider
const _initialUser = authProvider.getCurrentUser();
const _initialRole = _initialUser?.role || 'Staff';
const _initialPermissions = getPermissions(_initialUser);

export const useAppStore = create((set, get) => ({
    // State Slices
    services: getCached('pss_services', DEFAULT_SERVICES),
    kpis: getCached('pss_kpis', DEFAULT_KPIS),
    periods: getCached('pss_periods', DEFAULT_PERIODS),
    holidays: getCached('pss_holidays', DEFAULT_HOLIDAYS),
    slaRules: getCached('pss_sla_rules', []),
    commitments: getCached('pss_commitments', DEFAULT_COMMITMENTS),
    serviceModes: getCached('pss_service_modes', DEFAULT_SERVICE_MODES),
    activeCommitment: null,
    userRole: _initialRole,
    // Active user session decoded from the stored token
    currentUser: _initialUser,
    activeUser: _initialUser,
    // Derived permissions from the active user
    permissions: _initialPermissions,

    // Loading States
    loadingServices: false,
    loadingKpis: false,
    loadingPeriods: false,
    loadingHolidays: false,
    loadingSlaRules: false,
    loadingCommitments: false,
    loadingServiceModes: false,

    lastSyncVersion: 0,

    // Services CRUD Actions
    fetchServices: async (silent = false) => {
        if (!silent && get().services.length === 0) set({ loadingServices: true });
        try {
            const res = await api.getServices({ limit: 100, include_archived: true });
            const servicesArray = Array.isArray(res) ? res : (res?.data || []);
            const storedReferrals = JSON.parse(localStorage.getItem('service_referrals') || '{}');

            const formatted = servicesArray.map(s => {
                const formattedSla = formatSlaTarget(s);
                let referral;
                if (s.with_referral) {
                    const referralMap = { 'With': 'with', 'Without': 'without', 'N/A': 'n/a' };
                    referral = referralMap[s.with_referral] || s.with_referral;
                } else {
                    referral = determineReferral(s, storedReferrals);
                }

                return {
                    ...s,
                    id: s.id,
                    name: s.name,
                    classification: s.classification,
                    slaTarget: formattedSla,
                    sla: formattedSla,
                    responsibleUnit: s.responsible_unit,
                    active: s.status === 'ACTIVE' || s.is_active === true || s.active === true || s.status === 'Active',
                    naFlags: Array.isArray(s.na_flags) ? s.na_flags : [],
                    naFlag: Array.isArray(s.na_flags) && s.na_flags.length > 0,
                    archived: s.archived || s.status === 'ARCHIVED' || s.status === 'Archived',
                    withReferral: referral,
                    lastUpdated: s.updated_at ? (() => {
                        const d = new Date(s.updated_at);
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const yy = String(d.getFullYear()).slice(-2);
                        const h = String(d.getHours()).padStart(2, '0');
                        const m = String(d.getMinutes()).padStart(2, '0');
                        return `${mm}/${dd}/${yy} ${h}:${m}`;
                    })() : '—',
                    intakeDocuments: s.required_documents ? s.required_documents.join("\n") : '',
                    stepsTimeline: s.processing_steps ? s.processing_steps.join("\n") : '',
                    processing_steps: Array.isArray(s.processing_steps) ? s.processing_steps : [],
                    expectedOutput: s.expected_output || '',
                    modes: Array.isArray(s.modes) ? s.modes : [],
                    mode_ids: Array.isArray(s.modes) ? s.modes.map(m => m.id) : (s.mode_ids || []),
                };
            });

            if (formatted.length > 0) {
                set({ services: formatted, loadingServices: false });
                setCached('pss_services', formatted);
            } else {
                set({ loadingServices: false });
            }
        } catch (err) {
            console.error('[useAppStore] fetchServices API unavailable, using cached/mock:', err);
            const cached = getCached('pss_services', DEFAULT_SERVICES);
            set({ services: cached, loadingServices: false });
        }
    },

    createService: async (payload) => {
        try {
            const res = await api.createService(payload);
            await get().fetchServices(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createService failed:', err);
            throw new Error(err?.message || 'Failed to save service. Please try again.');
        }
    },

    updateService: async (id, payload) => {
        try {
            const res = await api.updateService(id, payload);
            await get().fetchServices(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateService failed:', err);
            throw new Error(err?.message || 'Failed to update service. Please try again.');
        }
    },

    activateService: async (id) => {
        try {
            let res;
            try {
                res = await api.activateService(id);
            } catch {
                res = await api.updateService(id, { status: 'ACTIVE', is_active: true, archived: false });
            }
            await get().fetchServices(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] activateService failed:', err);
            throw new Error(err?.message || 'Failed to activate service. Please try again.');
        }
    },

    deactivateService: async (id) => {
        try {
            let res;
            try {
                res = await api.deactivateService(id);
            } catch {
                res = await api.updateService(id, { status: 'INACTIVE', is_active: false });
            }
            await get().fetchServices(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] deactivateService failed:', err);
            throw new Error(err?.message || 'Failed to deactivate service. Please try again.');
        }
    },

    archiveService: async (id) => {
        try {
            const res = await api.archiveService(id);
            await get().fetchServices(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] archiveService failed:', err);
            throw new Error(err?.message || 'Failed to archive service. Please try again.');
        }
    },

    // Intake Fields Custom Save Callback (updates store locally)
    updateServiceIntakeFieldsLocal: (updatedSvc) => {
        set(state => {
            const updated = state.services.map(s => s.id === updatedSvc.id ? { ...s, ...updatedSvc, isNew: false } : s);
            setCached('pss_services', updated);
            return { services: updated };
        });
    },

    // KPIs CRUD Actions
    fetchKpis: async (silent = false) => {
        if (!silent && get().kpis.length === 0) set({ loadingKpis: true });
        try {
            const res = await api.getKpis({ limit: 100, include_inactive: true });
            const kpisArray = res?.data || [];

            const formatted = kpisArray.map(k => {
                const val = Number(k.target_value !== undefined ? k.target_value : (k.target ? parseFloat(k.target) : 100));
                const rawUnit = (k.unit || "").trim().toUpperCase();
                let unit = k.unit || " Mins";
                if (rawUnit === "PERCENT" || rawUnit === "%") unit = "%";
                else if (rawUnit === "DAYS" || rawUnit === "DAY") unit = val === 1 ? " Day" : " Days";
                else if (rawUnit === "HOURS" || rawUnit === "HOUR") unit = val === 1 ? " Hour" : " Hours";
                else if (rawUnit === "MINUTES" || rawUnit === "MIN" || rawUnit === "MINUTE" || rawUnit === "COUNT" || rawUnit === "MINS") unit = val === 1 ? " Min" : " Mins";

                const rawCat = (k.category || "").toUpperCase();
                let category = "Efficiency";
                if (rawCat === "COMPLIANCE" || rawCat === "TIMELINESS") category = "Timeliness";
                else if (rawCat === "CUSTOMER" || rawCat === "QUALITY") category = "Quality";
                else if (rawCat === "EFFICIENCY") category = "Efficiency";
                else if (k.category) category = k.category;

                const name = k.name || k.title || k.metric || "KPI Target";

                return {
                    ...k,
                    id: k.id,
                    name,
                    title: name,
                    category,
                    target_value: val,
                    unit,
                    service_id: k.service_id,
                    active: k.is_active !== false && k.active !== false
                };
            });

            if (formatted.length > 0) {
                set({ kpis: formatted, loadingKpis: false });
                setCached('pss_kpis', formatted);
            } else {
                set({ loadingKpis: false });
            }
        } catch (err) {
            console.warn('[useAppStore] fetchKpis API unavailable, using cached/mock:', err?.message);
            const cached = getCached('pss_kpis', DEFAULT_KPIS);
            set({ kpis: cached, loadingKpis: false });
        }
    },

    createKpi: async (payload) => {
        try {
            const res = await api.createKpi(payload);
            await get().fetchKpis(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createKpi failed:', err);
            throw new Error(err?.message || 'Failed to save KPI. Please try again.');
        }
    },

    updateKpi: async (id, payload) => {
        try {
            const res = await api.updateKpi(id, payload);
            await get().fetchKpis(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateKpi failed:', err);
            throw new Error(err?.message || 'Failed to update KPI. Please try again.');
        }
    },

    deleteKpi: async (id) => {
        try {
            const res = await api.deleteKpi(id);
            await get().fetchKpis(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] deleteKpi failed:', err);
            throw new Error(err?.message || 'Failed to delete KPI. Please try again.');
        }
    },

    // SLA Rules CRUD Actions
    fetchSlaRules: async (silent = false) => {
        if (!silent && get().slaRules.length === 0) set({ loadingSlaRules: true });
        try {
            const res = await api.getSlaRules();
            set({ slaRules: res || [], loadingSlaRules: false });
            setCached('pss_sla_rules', res || []);
            return res;
        } catch (err) {
            console.warn('[useAppStore] fetchSlaRules API unavailable, using cached:', err?.message);
            const cached = getCached('pss_sla_rules', []);
            set({ slaRules: cached, loadingSlaRules: false });
            return cached;
        }
    },

    updateSlaRule: async (id, payload) => {
        try {
            const res = await api.updateSlaRule(id, payload);
            await get().fetchSlaRules(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateSlaRule failed:', err);
            throw new Error(err?.message || 'Failed to update SLA rule. Please try again.');
        }
    },

    createSlaRule: async (payload) => {
        try {
            const res = await api.createSlaRule(payload);
            await get().fetchSlaRules(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createSlaRule failed:', err);
            throw new Error(err?.message || 'Failed to save SLA rule. Please try again.');
        }
    },

    restoreSlaVersion: async (id, versionId) => {
        try {
            const res = await api.restoreSlaVersion(id, versionId);
            await get().fetchSlaRules(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] restoreSlaVersion failed:', err);
            throw new Error(err?.message || 'Failed to restore SLA version. Please try again.');
        }
    },

    // Holidays CRUD Actions
    fetchHolidays: async (params = {}, silent = false) => {
        if (!silent && get().holidays.length === 0) set({ loadingHolidays: true });
        try {
            const res = await api.getHolidays({ limit: 100, ...params });
            const holidaysArray = res?.data || [];
            const displayYear = params.year || new Date().getFullYear();

            const formatted = holidaysArray.map(h => {
                let dateVal = "";
                if (h.month !== undefined && h.day !== undefined && h.month !== null && h.day !== null) {
                    const y = h.year ?? displayYear;
                    const mm = String(h.month).padStart(2, '0');
                    const dd = String(h.day).padStart(2, '0');
                    dateVal = `${y}-${mm}-${dd}`;
                } else if (h.holiday_date) {
                    dateVal = h.holiday_date.split('T')[0];
                } else if (h.date) {
                    dateVal = h.date.split('T')[0];
                } else {
                    dateVal = `${displayYear}-01-01`;
                }

                return {
                    ...h,
                    id: h.id,
                    name: h.name,
                    date: dateVal,
                    type: mapHolidayTypeToFrontend(h.type),
                    is_recurring: h.is_recurring
                };
            });

            if (formatted.length > 0) {
                set({ holidays: formatted, loadingHolidays: false });
                setCached('pss_holidays', formatted);
            } else {
                set({ loadingHolidays: false });
            }
        } catch (err) {
            console.warn('[useAppStore] fetchHolidays API unavailable, using cached/mock:', err?.message);
            const cached = getCached('pss_holidays', DEFAULT_HOLIDAYS);
            set({ holidays: cached, loadingHolidays: false });
        }
    },

    createHoliday: async (payload) => {
        try {
            const res = await api.createHoliday(payload);
            await get().fetchHolidays({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createHoliday failed:', err);
            throw new Error(err?.message || 'Failed to save holiday. Please try again.');
        }
    },

    updateHoliday: async (id, payload) => {
        try {
            const res = await api.updateHoliday(id, payload);
            await get().fetchHolidays({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateHoliday failed:', err);
            throw new Error(err?.message || 'Failed to update holiday. Please try again.');
        }
    },

    deleteHoliday: async (id) => {
        try {
            const res = await api.deleteHoliday(id);
            await get().fetchHolidays({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] deleteHoliday failed:', err);
            throw new Error(err?.message || 'Failed to delete holiday. Please try again.');
        }
    },

    // Evaluation Periods CRUD Actions
    fetchPeriods: async (silent = false) => {
        if (!silent && get().periods.length === 0) set({ loadingPeriods: true });
        try {
            const res = await api.getPeriods({ limit: 100 });
            const periodsArray = res?.data || [];

            const formatted = periodsArray.map(p => ({
                id: p.id,
                name: p.name,
                type: mapPeriodTypeToFrontend(p.period_type || p.type),
                period_type: p.period_type || p.type || 'Semester',
                start_date: p.start_date,
                end_date: p.end_date,
                status: mapPeriodStatusToFrontend(p.status),
                ...p
            }));

            const sorted = formatted.sort((a, b) => {
                const getPriority = (status) => {
                    if (status === "Open" || status === "Active") return 1;
                    if (status === "Queued") return 2;
                    return 3;
                };
                const priorityA = getPriority(a.status);
                const priorityB = getPriority(b.status);
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                if (a.status === "Queued") {
                    return new Date(a.start_date) - new Date(b.start_date);
                }
                return new Date(b.start_date) - new Date(a.start_date);
            });

            if (sorted.length > 0) {
                set({ periods: sorted, loadingPeriods: false });
                setCached('pss_periods', sorted);
            } else {
                set({ loadingPeriods: false });
            }
        } catch (err) {
            console.warn('[useAppStore] fetchPeriods API unavailable, using cached/mock:', err?.message);
            const cached = getCached('pss_periods', DEFAULT_PERIODS);
            set({ periods: cached, loadingPeriods: false });
        }
    },

    createPeriod: async (payload) => {
        try {
            const res = await api.createPeriod(payload);
            await get().fetchPeriods(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createPeriod failed:', err);
            throw new Error(err?.message || 'Failed to save evaluation period. Please try again.');
        }
    },

    updatePeriod: async (id, payload) => {
        try {
            const res = await api.updatePeriod(id, payload);
            await get().fetchPeriods(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updatePeriod failed:', err);
            throw new Error(err?.message || 'Failed to update evaluation period. Please try again.');
        }
    },

    closePeriod: async (id) => {
        try {
            const res = await api.closePeriod(id);
            await get().fetchPeriods(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] closePeriod failed:', err);
            throw new Error(err?.message || 'Failed to close evaluation period. Please try again.');
        }
    },

    deletePeriod: async (id) => {
        try {
            const res = await api.deletePeriod(id);
            await get().fetchPeriods(true);
            return res;
        } catch (err) {
            console.error('[useAppStore] deletePeriod failed:', err);
            throw new Error(err?.message || 'Failed to delete evaluation period. Please try again.');
        }
    },

    // Commitments Actions
    fetchCommitments: async (params = {}, silent = false) => {
        if (!silent && get().commitments.length === 0) set({ loadingCommitments: true });
        try {
            const res = await api.getCommitments({ limit: 100, ...params });
            const data = res?.data || [];
            if (data.length > 0) {
                set({ commitments: data, loadingCommitments: false });
                setCached('pss_commitments', data);
            } else {
                set({ loadingCommitments: false });
            }
        } catch (err) {
            console.warn('[useAppStore] fetchCommitments API unavailable, using cached/mock:', err?.message);
            const cached = getCached('pss_commitments', DEFAULT_COMMITMENTS);
            set({ commitments: cached, loadingCommitments: false });
        }
    },

    fetchCommitmentById: async (id) => {
        set({ loadingCommitments: true });
        try {
            const res = await api.getCommitmentById(id);
            set({ activeCommitment: res, loadingCommitments: false });
            return res;
        } catch (err) {
            console.warn('[useAppStore] fetchCommitmentById falling back to local commitment:', err?.message);
            const cached = getCached('pss_commitments', DEFAULT_COMMITMENTS);
            const found = cached.find(c => c.id === id) || cached[0];
            set({ activeCommitment: found, loadingCommitments: false });
            return found;
        }
    },

    createCommitmentDraft: async (payload) => {
        try {
            const res = await api.createCommitment(payload);
            set({ activeCommitment: res });
            await get().fetchCommitments({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createCommitmentDraft failed:', err);
            throw new Error(err?.message || 'Failed to create commitment. Please try again.');
        }
    },

    updateCommitmentDraft: async (id, payload) => {
        try {
            const res = await api.updateCommitment(id, payload);
            set({ activeCommitment: res });
            await get().fetchCommitments({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateCommitmentDraft failed:', err);
            throw new Error(err?.message || 'Failed to update commitment. Please try again.');
        }
    },

    lockCommitment: async (id) => {
        try {
            const res = await api.lockCommitment(id);
            set({ activeCommitment: res });
            await get().fetchCommitments({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] lockCommitment failed:', err);
            throw new Error(err?.message || 'Failed to lock commitment. Please try again.');
        }
    },

    requestRevision: async (id, reason) => {
        try {
            const res = await api.requestRevision(id, reason);
            await get().fetchCommitments({}, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] requestRevision failed:', err);
            throw new Error(err?.message || 'Failed to request revision. Please try again.');
        }
    },

    clearActiveCommitment: () => set({ activeCommitment: null }),

    sidebarCollapsed: localStorage.getItem('PSS_SIDEBAR_COLLAPSED') === 'true',
    setSidebarCollapsed: (collapsed) => {
        localStorage.setItem('PSS_SIDEBAR_COLLAPSED', collapsed);
        set({ sidebarCollapsed: collapsed });
    },

    sidebarMobileOpen: false,
    setSidebarMobileOpen: (open) => {
        set({ sidebarMobileOpen: open });
    },

    checkAndSyncFromCloud: async () => {
        if (!get().currentUser) return;
        try {
            const syncInfo = await api.getSyncVersion();
            const cloudVersion = syncInfo?.version || 0;
            if (cloudVersion > 0) {
                if (get().lastSyncVersion === 0) {
                    set({ lastSyncVersion: cloudVersion });
                    await Promise.all([
                        get().fetchServiceModes(true, true),
                        get().fetchServices(true),
                        get().fetchKpis(true),
                        get().fetchPeriods(true),
                        get().fetchHolidays({}, true),
                        get().fetchCommitments({}, true),
                    ]);
                } else if (cloudVersion !== get().lastSyncVersion) {
                    set({ lastSyncVersion: cloudVersion });
                    await Promise.all([
                        get().fetchServiceModes(true, true),
                        get().fetchServices(true),
                        get().fetchKpis(true),
                        get().fetchPeriods(true),
                        get().fetchHolidays({}, true),
                        get().fetchCommitments({}, true),
                    ]);
                }
            }
        } catch {
            // silent catch - network poll
        }
    },

    // Service Modes CRUD Actions
    fetchServiceModes: async (includeInactive = false, silent = false) => {
        if (!silent && get().serviceModes.length === 0) set({ loadingServiceModes: true });
        try {
            const res = await api.getServiceModes(includeInactive ? { include_inactive: true } : {});
            const modesArray = Array.isArray(res) ? res : (res?.data || []);
            if (modesArray.length > 0) {
                set({ serviceModes: modesArray, loadingServiceModes: false });
                setCached('pss_service_modes', modesArray);
            } else {
                const cached = getCached('pss_service_modes', DEFAULT_SERVICE_MODES);
                set({ serviceModes: cached, loadingServiceModes: false });
            }
        } catch (err) {
            console.warn('[useAppStore] fetchServiceModes API unavailable, using cached/mock:', err?.message);
            const cached = getCached('pss_service_modes', DEFAULT_SERVICE_MODES);
            set({ serviceModes: cached, loadingServiceModes: false });
        }
    },

    createServiceMode: async (payload) => {
        try {
            const res = await api.createServiceMode(payload);
            await get().fetchServiceModes(true, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] createServiceMode failed:', err);
            throw new Error(err?.message || 'Failed to save service mode. Please try again.');
        }
    },

    updateServiceMode: async (id, payload) => {
        try {
            const res = await api.updateServiceMode(id, payload);
            await get().fetchServiceModes(true, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] updateServiceMode failed:', err);
            throw new Error(err?.message || 'Failed to update service mode. Please try again.');
        }
    },

    toggleServiceMode: async (id) => {
        try {
            const res = await api.toggleServiceMode(id);
            await get().fetchServiceModes(true, true);
            return res;
        } catch (err) {
            console.error('[useAppStore] toggleServiceMode failed:', err);
            throw new Error(err?.message || 'Failed to toggle service mode status. Please try again.');
        }
    },

    /**
     * Authenticate using TemporaryAuthProvider (9 predefined authorized users).
     * ZERO external network calls to undeployed ARMS auth service.
     */
    login: (usernameOrUser) => {
        try {
            const authResult = authProvider.login(usernameOrUser);
            const user = authProvider.getCurrentUser();
            const role = user?.role || 'Staff';
            const permissions = getPermissions(user);
            set({
                currentUser: user,
                activeUser: user,
                userRole: role,
                permissions: permissions,
            });
            window.location.reload();
            return authResult;
        } catch (err) {
            console.error('[useAppStore] login failed:', err);
            throw err;
        }
    },

    loginWithArms: async (username) => {
        return get().login(username);
    },

    loginAsMockUser: (mockUser) => {
        return get().login(mockUser);
    },

    logout: () => {
        authProvider.logout();
        set({
            currentUser: null,
            activeUser: null,
            userRole: null,
            permissions: getPermissions(null),
        });
        window.location.href = '/';
    },

    setUserRole: (role) => {
        const userMap = {
            'Staff': PREDEFINED_MOCK_USERS.find(u => u.armsRole === 'STAFF' && u.office === 'ACAD'),
            'OPCREvaluator': PREDEFINED_MOCK_USERS.find(u => u.armsRole === 'CAMPUS_DIRECTOR'),
            'Admin': PREDEFINED_MOCK_USERS.find(u => u.armsRole === 'SUBSYSTEM_ADMIN' && u.office === 'ACAD'),
        };
        const mockUser = userMap[role] || userMap['Staff'];
        if (mockUser) {
            get().login(mockUser);
        }
    },
}));