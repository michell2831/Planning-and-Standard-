import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import FloatingICSA from "./components/FloatingICSA";
import Dashboard from "./pages/Dashboard";
import ServiceCatalogue from "./pages/ServiceCatalogue";
import KPIStandards from "./pages/KPIStandards";
import SLAConfiguration from "./pages/SLAConfiguration";
import HolidayCalendar from "./pages/HolidayCalendar";
import EvaluationPeriods from "./pages/EvaluationPeriods";
import OPCRCommitments from "./pages/OPCRCommitments";
import PlanningHub from "./pages/PlanningHub";
import ServiceModes from "./pages/ServiceModes";
import CampusOpcrTracker from "./pages/CampusOpcrTracker";
import { isAuthenticated, PREDEFINED_MOCK_USERS, encodeMockToken } from "./services/auth";
import { useAppStore } from "./store/useAppStore";

const ARMS_URL = import.meta.env.VITE_ARMS_URL || 'http://localhost:5173';

const ROLE_COLORS = {
    'Staff': { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    'Office Head': { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
    'Campus Director / Evaluator': { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
    'Campus Director': { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
    'OPCR Evaluator': { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    'Planning Officer': { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
    'Super Admin': { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
};

const OFFICE_COLORS = {
    'ACAD': { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    'OSAS': { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    'ADMIN': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
    'ALL': { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
};

function DevBypassScreen() {
    const { loginAsMockUser } = useAppStore();
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    const handleLoginAs = (user) => {
        // Store the default landing page based on ARMS role before reloading
        // Default landing page per role (per Module Access Matrix)
        const ROLE_DEFAULT_PAGE = {
            'SUPER_ADMIN': 'dashboard',        // /admin/dashboard — full overview
            'PLANNING_OFFICER': 'planningHub', // /planning/hub — primary workspace for Planning Officer
            'SUBSYSTEM_ADMIN': 'dashboard',        // /dashboard — office overview
            'STAFF': 'serviceCatalogue', // /services — only accessible module
            'OPCR_EVALUATOR': 'opcrCommitments',  // /campus-opcr — only job is to review
            'CAMPUS_DIRECTOR': 'dashboard',       // /dashboard — campus-wide overview (AC9)
        };
        const defaultPage = ROLE_DEFAULT_PAGE[user.armsRole] || 'dashboard';
        localStorage.setItem('pss_default_page', defaultPage);
        loginAsMockUser(user);
    };

    const groupedOffices = ['ACAD', 'OSAS', 'ADMIN', 'Cross-Office'];

    const officeFullNames = {
        'ACAD': 'Academic Affairs Office',
        'OSAS': 'Student Affairs Office (OSAS)',
        'ADMIN': 'Administration Office',
        'Cross-Office': 'Cross-Office Access',
    };

    const getOfficeColors = (office) => {
        switch (office) {
            case 'ACAD':
                return { color: 'var(--acad)', soft: 'var(--acad-soft)' };
            case 'OSAS':
                return { color: 'var(--osas)', soft: 'var(--osas-soft)' };
            case 'ADMIN':
                return { color: 'var(--admin)', soft: 'var(--admin-soft)' };
            default:
                return { color: 'var(--accent)', soft: 'var(--accent-soft)' };
        }
    };

    const getFilteredUsers = (officeKey) => {
        return PREDEFINED_MOCK_USERS.filter((user) => {
            const matchesOffice = (officeKey === 'Cross-Office' ? user.office === 'ALL' : user.office === officeKey);
            if (!matchesOffice) return false;

            const q = searchQuery.trim().toLowerCase();
            if (!q) return true;

            const haystack = `${user.displayName} @${user.username} ${user.roleLabel} ${officeFullNames[officeKey] || officeKey}`.toLowerCase();
            return haystack.includes(q);
        });
    };

    return (
        <div className="bypass-bg">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

                .bypass-bg {
                    --bg: #F8FAFC;
                    --surface: #FFFFFF;
                    --ink: #0F172A;
                    --ink-muted: #475569;
                    --ink-faint: #94A3B8;
                    --line: #E2E8F0;
                    --accent: #580000;
                    --accent-soft: #FBF0F0;
                    --accent-deep: #3D0000;

                    --acad: #3955C9;
                    --acad-soft: #E9ECFB;
                    --osas: #128A63;
                    --osas-soft: #DFF5EC;
                    --admin: #A8790F;
                    --admin-soft: #FBF0D8;

                    --shadow-rest: 0 2px 8px rgba(18, 21, 28, 0.04), 0 1px 2px rgba(18, 21, 28, 0.02);
                    --shadow-hover: 0 12px 28px rgba(18, 21, 28, 0.09), 0 4px 10px rgba(18, 21, 28, 0.04);

                    min-height: 100vh;
                    min-height: 100dvh;
                    overflow-x: hidden;
                    box-sizing: border-box;
                    width: 100%;
                    background:
                        radial-gradient(circle at 1px 1px, rgba(18,21,28,0.05) 1px, transparent 0) 0 0/22px 22px,
                        var(--bg);
                    color: var(--ink);
                    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
                    -webkit-font-smoothing: antialiased;
                    padding: 36px 14px 140px;
                }

                .bypass-bg *, .bypass-bg *::before, .bypass-bg *::after {
                    box-sizing: border-box;
                }

                .mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; }

                .wrap {
                    max-width: 880px;
                    width: 100%;
                    margin: 0 auto;
                }

                .header {
                    text-align: center;
                    margin-bottom: 32px;
                }

                .eyebrow {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border-radius: var(--radius-full);
                    background: var(--accent-soft);
                    color: var(--accent-deep);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    margin-bottom: 18px;
                }
                .eyebrow::before {
                    content: '';
                    width: 6px; height: 6px; border-radius: 50%;
                    background: var(--accent);
                    flex-shrink: 0;
                }

                .bypass-title {
                    font-size: clamp(24px, 5vw, 42px);
                    font-weight: 800;
                    letter-spacing: -0.025em;
                    line-height: 1.1;
                    margin: 0 0 12px;
                    color: var(--ink);
                }
                
                .subcopy {
                    font-size: clamp(13px, 3.5vw, 16px);
                    color: var(--ink-muted);
                    max-width: 440px;
                    margin: 0 auto;
                    line-height: 1.5;
                }

                .search-row {
                    max-width: 480px;
                    width: 100%;
                    margin: 24px auto 0;
                    position: relative;
                }
                .search-row::before {
                    content: '>';
                    position: absolute;
                    left: 14px; top: 50%; transform: translateY(-50%);
                    color: var(--ink-faint);
                    font-weight: 700;
                    font-size: 13px;
                }
                #search {
                    width: 100%;
                    padding: 11px 14px 11px 32px;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--line);
                    background: var(--surface);
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    color: var(--ink);
                    outline: none;
                    box-shadow: var(--shadow-rest);
                    transition: border-color .15s ease, box-shadow .15s ease;
                }
                #search::placeholder { color: var(--ink-faint); }
                #search:focus {
                    border-color: var(--ink);
                    box-shadow: var(--shadow-hover);
                }

                .panel {
                    background: var(--surface);
                    border: 1px solid var(--line);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-md);
                    padding: clamp(16px, 4vw, 36px);
                    margin-top: 24px;
                    width: 100%;
                }

                .panel-head {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .panel-head .rule {
                    flex: 1; height: 1px; background: var(--line);
                }
                .panel-head .tag {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: var(--ink-faint);
                    display: flex; align-items: center; gap: 6px;
                    white-space: nowrap;
                }

                .info-box {
                    border: 1px dashed var(--line);
                    border-radius: var(--radius-md);
                    padding: 12px 14px;
                    font-size: 12px;
                    line-height: 1.5;
                    color: var(--ink-muted);
                    background: #FBFBFC;
                    margin-bottom: 24px;
                    text-align: left;
                }
                .info-box b { color: var(--ink); font-weight: 600; }

                .office {
                    margin-bottom: 24px;
                    text-align: left;
                    width: 100%;
                }
                .office:last-child { margin-bottom: 8px; }

                .office-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--ink-faint);
                    margin-bottom: 10px;
                }
                .office-label .dot {
                    width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0;
                }
                .office-label .count {
                    margin-left: auto;
                    font-weight: 500;
                    color: var(--ink-faint);
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                }

                .cards {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    width: 100%;
                }

                .card {
                    position: relative;
                    text-align: left;
                    background: var(--surface);
                    border: 1px solid var(--line);
                    border-left: 3px solid var(--office-color, var(--ink-faint));
                    border-radius: var(--radius-lg);
                    padding: 14px 12px 12px;
                    cursor: pointer;
                    box-shadow: var(--shadow-rest);
                    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
                    font: inherit;
                    color: inherit;
                    display: flex;
                    flex-direction: column;
                    justifyContent: space-between;
                    width: 100%;
                    min-width: 0;
                    outline: none;
                    overflow: hidden;
                }
                .card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                }
                .card:focus-visible {
                    outline: 2px solid var(--ink);
                    outline-offset: 2px;
                }
                .card.selected {
                    box-shadow: var(--shadow-hover);
                    border-color: var(--office-color, var(--ink));
                }
                .card.selected::after {
                    content: '✓';
                    position: absolute;
                    top: 10px; right: 10px;
                    width: 18px; height: 18px;
                    border-radius: 50%;
                    background: var(--office-color, var(--ink));
                    color: #fff;
                    font-size: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 700;
                }

                .card-top {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 10px;
                    min-width: 0;
                    width: 100%;
                }

                .avatar {
                    width: 36px; height: 36px;
                    border-radius: var(--radius-md);
                    background: var(--office-soft, #EEF0F3);
                    color: var(--office-color, var(--ink-muted));
                    display: flex; align-items: center; justify-content: center;
                    font-family: 'JetBrains Mono', monospace;
                    font-weight: 700;
                    font-size: 12px;
                    flex-shrink: 0;
                    transition: background 0.15s ease, color 0.15s ease;
                }

                .name-block {
                    min-width: 0;
                    flex: 1;
                    overflow: hidden;
                }

                .name-block .name {
                    font-size: 13.5px;
                    font-weight: 700;
                    color: var(--ink);
                    line-height: 1.25;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .name-block .handle {
                    font-size: 11px;
                    color: var(--ink-faint);
                    font-family: 'JetBrains Mono', monospace;
                    margin-top: 1px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .badges {
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    margin-bottom: 6px;
                    min-width: 0;
                }
                .badge {
                    font-size: 9.5px;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    padding: 3px 6px;
                    border-radius: var(--radius-full);
                    font-family: 'JetBrains Mono', monospace;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }
                .badge.role-staff { background: #EEF0F3; color: #4B5563; }
                .badge.role-head { background: var(--office-soft, #EEF0F3); color: var(--office-color, var(--ink-muted)); }
                .badge.role-dept { background: #F3F4F6; color: #6B7280; }
                .badge.role-planner { background: #EFF6FF; color: #1D4ED8; }
                .badge.role-superadmin { background: #FEF3C7; color: #92400E; }

                .token-line {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 9.5px;
                    color: var(--ink-faint);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-height: 0;
                    opacity: 0;
                    transition: max-height .18s ease, opacity .18s ease, margin-top .18s ease;
                    text-align: left;
                    width: 100%;
                }
                .card:hover .token-line, .card.selected .token-line {
                    max-height: 16px;
                    opacity: 1;
                    margin-top: 2px;
                }
                .token-line::before { content: 'token '; color: var(--ink-faint); opacity: .6; }

                .continue-bar {
                    position: fixed;
                    left: 0; right: 0; bottom: 0;
                    display: flex;
                    justify-content: center;
                    padding: 16px 20px;
                    pointer-events: none;
                    z-index: 100;
                }
                .continue-bar .inner {
                    pointer-events: auto;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--ink);
                    color: #fff;
                    border-radius: var(--radius-lg);
                    padding: 10px 12px 10px 16px;
                    box-shadow: 0 14px 32px rgba(18,21,28,0.28);
                    transform: translateY(120%);
                    opacity: 0;
                    transition: transform .22s ease, opacity .22s ease;
                    max-width: 90vw;
                }
                .continue-bar .inner.show {
                    transform: translateY(0);
                    opacity: 1;
                }
                .continue-bar .label {
                    font-size: 12px;
                    font-family: 'JetBrains Mono', monospace;
                    color: #C7CBD3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .continue-bar .label b { color: #fff; font-weight: 600; }
                .continue-bar button {
                    background: var(--accent);
                    color: #fff;
                    border: none;
                    border-radius: var(--radius-md);
                    padding: 8px 14px;
                    font-size: 12.5px;
                    font-weight: 700;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background .15s ease;
                    flex-shrink: 0;
                }
                .continue-bar button:hover { background: var(--accent-deep); }

                @media (max-width: 600px) {
                    .bypass-bg { padding: 24px 10px 130px; }
                    .panel { padding: 16px 10px 14px; border-radius: 12px; }
                    .cards { gap: 6px; }
                    .card { padding: 10px 8px 8px; border-left-width: 2.5px; }
                    .card-top { gap: 6px; margin-bottom: 6px; }
                    .avatar { width: 30px; height: 30px; font-size: 10.5px; border-radius: 6px; }
                    .name-block .name { font-size: 12px; }
                    .name-block .handle { font-size: 9.5px; }
                    .badges { gap: 3px; margin-bottom: 4px; }
                    .badge { font-size: 8.5px; padding: 2px 4px; }
                    .card.selected::after { top: 6px; right: 6px; width: 15px; height: 15px; font-size: 9px; }
                }
            `}} />

            <div className="wrap">
                {/* Header */}
                <div className="header">
                    <span className="eyebrow mono">PSS — Planning &amp; Standards System</span>
                    <h1 className="bypass-title">Session not found</h1>
                    <p className="subcopy">Select a mock user below to simulate a session.</p>

                    <div className="search-row">
                        <input
                            id="search"
                            className="mono"
                            type="text"
                            placeholder="search by name, handle, or office..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Panel */}
                <div className="panel">
                    <div className="panel-head">
                        <div className="rule"></div>
                        <div className="tag mono">⚙ Developer bypass</div>
                        <div className="rule"></div>
                    </div>

                    <div className="info-box mono">
                        Select a mock user to simulate that user's session. <b>Tokens are base64-encoded</b> and decoded dynamically — no backend redeploy needed.
                    </div>

                    <div id="officeList">
                        {groupedOffices.map((officeKey) => {
                            const filteredUsers = getFilteredUsers(officeKey);
                            if (filteredUsers.length === 0) return null;

                            const officeColors = getOfficeColors(officeKey);

                            return (
                                <div key={officeKey} className="office" data-office={officeKey.toLowerCase()}>
                                    <div className="office-label">
                                        <span className="dot" style={{ background: officeColors.color }}></span>
                                        {officeFullNames[officeKey] || officeKey}
                                        <span className="count mono">{filteredUsers.length}</span>
                                    </div>

                                    <div className="cards">
                                        {filteredUsers.map((user) => {
                                            const isSelected = selectedUser?.id === user.id;
                                            const token = encodeMockToken({
                                                userId: user.id,
                                                username: user.username,
                                                displayName: user.displayName,
                                                armsRole: user.armsRole,
                                                office: user.office,
                                                isCrossOffice: user.isCrossOffice,
                                            });

                                            return (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    className={`card ${isSelected ? 'selected' : ''}`}
                                                    style={{
                                                        '--office-color': officeColors.color,
                                                        '--office-soft': officeColors.soft,
                                                    }}
                                                    onClick={() => setSelectedUser(user)}
                                                >
                                                    <div className="card-top">
                                                        <div className="avatar">
                                                            {user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                        </div>
                                                        <div className="name-block">
                                                            <div className="name">{user.displayName}</div>
                                                            <div className="handle">@{user.username}</div>
                                                        </div>
                                                    </div>

                                                    <div className="badges">
                                                        {user.roleLabel === 'Staff' && <span className="badge role-staff">Staff</span>}
                                                        {user.roleLabel === 'Office Head' && <span className="badge role-head">Office Head</span>}
                                                        {user.roleLabel === 'Campus Director / Evaluator' && <span className="badge role-head">Director</span>}
                                                        {user.roleLabel === 'Planning Officer' && <span className="badge role-planner">Planning Officer</span>}
                                                        {user.roleLabel === 'Super Admin' && <span className="badge role-superadmin">Super Admin</span>}
                                                        <span className="badge role-dept">{user.office}</span>
                                                    </div>

                                                    <div className="token-line">{token}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sticky Continue Bar */}
            <div className="continue-bar">
                <div className={`inner ${selectedUser ? 'show' : ''}`} id="bar">
                    <span className="label mono" id="barLabel">
                        Continue as <b>{selectedUser ? selectedUser.displayName : '—'}</b>
                    </span>
                    <button id="continueBtn" type="button" onClick={() => handleLoginAs(selectedUser)}>
                        Continue →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    // Read default page set by Developer Bypass role-redirect, then clear it
    const initialPage = (() => {
        const saved = localStorage.getItem('pss_default_page');
        if (saved) {
            localStorage.removeItem('pss_default_page');
            if (window.location.pathname !== '/') {
                window.history.replaceState(null, '', '/');
            }
            return saved;
        }
        if (window.location.pathname === '/planning/hub') {
            return 'planningHub';
        }
        if (window.location.pathname === '/planning/opcr-tracker') {
            return 'opcrTracker';
        }
        return 'dashboard';
    })();
    const [active, setActive] = useState(initialPage);
    const { sidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen, permissions } = useAppStore();

    useEffect(() => {
        const handlePopState = () => {
            if (window.location.pathname === '/planning/hub') {
                setActive('planningHub');
            } else if (window.location.pathname === '/planning/opcr-tracker') {
                setActive('opcrTracker');
            } else if (window.location.pathname === '/' || window.location.pathname === '') {
                setActive('dashboard');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    if (!isAuthenticated()) {
        return <DevBypassScreen />;
    }

    // Users without commitment sidebar access (e.g. Staff, Planning Officer) redirect appropriately
    const safeActive = (active === 'opcrCommitments' && !permissions.canSeeCommitmentsInSidebar)
        ? (permissions.canSeePlanningHub ? 'planningHub' : 'dashboard')
        : active;

    const handleNavigate = (pageKey) => {
        // Block navigation to opcrCommitments if not allowed in sidebar
        if (pageKey === 'opcrCommitments' && !permissions.canSeeCommitmentsInSidebar) return;
        if (pageKey === 'planningHub') {
            if (window.location.pathname !== '/planning/hub') {
                window.history.pushState(null, '', '/planning/hub');
            }
        } else if (pageKey === 'opcrTracker') {
            if (window.location.pathname !== '/planning/opcr-tracker') {
                window.history.pushState(null, '', '/planning/opcr-tracker');
            }
        } else if (window.location.pathname === '/planning/hub' || window.location.pathname === '/planning/opcr-tracker') {
            window.history.pushState(null, '', '/');
        }
        setActive(pageKey);
        setSidebarMobileOpen(false);
    };

    const PAGES = {
        planningHub: <PlanningHub onNavigate={handleNavigate} />,
        opcrTracker: <CampusOpcrTracker onNavigate={handleNavigate} />,
        dashboard: <Dashboard />,
        serviceCatalogue: <ServiceCatalogue />,
        kpiStandards: <KPIStandards />,
        slaConfiguration: <SLAConfiguration />,
        holidayCalendar: <HolidayCalendar />,
        evaluationPeriods: <EvaluationPeriods />,
        serviceModes: <ServiceModes />,
        opcrCommitments: permissions.canViewCommitments ? <OPCRCommitments /> : <Dashboard />,
    };

    return (
        <div className="lib-page" style={{ height: "100vh", overflow: "hidden", display: "flex", width: "100vw" }}>
            <style dangerouslySetInnerHTML={{
                __html: `
        .main-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          height: 100vh;
          overflow: hidden;
          min-width: 0;
        }
        @media (max-width: 960px) {
          .main-container {
            margin-left: 0 !important;
          }
        }
      `}} />
            <Sidebar
                active={safeActive}
                setActive={handleNavigate}
                isOpen={sidebarMobileOpen}
                onClose={() => setSidebarMobileOpen(false)}
            />
            <div
                className="main-container"
                style={{
                    marginLeft: sidebarCollapsed ? '64px' : '256px',
                    transition: 'margin-left 0.3s ease-in-out'
                }}
            >
                <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
                    {PAGES[safeActive] || PAGES.dashboard}
                </div>
            </div>
            <FloatingICSA activePage={safeActive} />
        </div>
    );
}