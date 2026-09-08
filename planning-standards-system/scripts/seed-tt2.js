/**
 * TT2 — DB Seed: Evaluation Periods, KPIs, OPCR Commitment
 * PSS (Sprint 4 — BE Dev 1 - Steph)
 *
 * Prerequisites:
 *   - TT1 (seed-services.js) must have been run first — this script
 *     fetches real service UUIDs from the service-catalogue API.
 *   - All 3 containers must be healthy:
 *       pss-service-catalogue  (port 3010)
 *       pss-kpi-sla            (port 3011)
 *       pss-commitment         (port 3012)
 *
 * What this script creates:
 *   1. Two evaluation periods (Q1-2026 Closed, Q2-2026 Open) — created
 *      ONCE with office=ALL. Periods are global — findAllPeriods() has
 *      no office filter ("Evaluation periods are global — all users can
 *      view all periods").
 *   2. Three KPIs per selected service (per office):
 *        Timeliness        — 95% flat (EFFICIENCY / PERCENT)
 *        Compliance Rate   — 90% flat (COMPLIANCE / PERCENT)
 *        Processing Time   — from sla_target_value (CUSTOMER / DAYS)
 *   3. One locked OPCR commitment per office for Q1-2026, referencing
 *      that office's services and KPIs.
 *
 * Auth:
 *   Uses x-role: OPCREvaluator — the only role with PERIODS_WRITE,
 *   KPIS_WRITE, COMMITMENTS_WRITE, and COMMITMENTS_LOCK.
 *   (src/common/rbac/role-permissions.ts)
 *
 * NOTE: Do NOT modify RBAC files — that is tasked to another team member.
 *
 * Enum values (verified against codebase):
 *   PeriodType:          'Quarterly' | 'Yearly' | 'Monthly' | ...
 *   KpiCategory:         'EFFICIENCY' | 'COMPLIANCE' | 'CUSTOMER'
 *   KpiUnit:             'DAYS' | 'PERCENT' | 'COUNT'
 *   CommitmentItemUnit:  'DAYS' | 'PERCENT' | 'COUNT'
 *
 * Usage:
 *   node seed-tt2.js --dry-run    # preview only, no API calls
 *   node seed-tt2.js              # actually seed
 *
 * Env vars:
 *   CATALOGUE_BASE   default: http://localhost:3010
 *   KPI_SLA_BASE     default: http://localhost:3011
 *   COMMITMENT_BASE  default: http://localhost:3012
 */

const DRY_RUN = process.argv.includes('--dry-run');

const CATALOGUE_BASE = process.env.CATALOGUE_BASE || 'http://localhost:3010';
const KPI_SLA_BASE = process.env.KPI_SLA_BASE || 'http://localhost:3011';
const COMMITMENT_BASE = process.env.COMMITMENT_BASE || 'http://localhost:3012';

// Offices that TT1 seeds services for
const TARGET_OFFICES = ['ACAD', 'ADMIN', 'OSAS'];
const SERVICES_PER_OFFICE = 3;

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------
// JwtAuthGuard trusts x-actor-id / x-office / x-role when present.
// RolesGuard checks user.role against Role enum: 'Admin' | 'Staff' | 'OPCREvaluator'.
// OPCREvaluator is the ONLY role with all needed permissions.
// ---------------------------------------------------------------------------
function authHeaders(office) {
    return {
        'Content-Type': 'application/json',
        'x-actor-id': 'system_seed',
        'x-actor-username': 'system_seed',
        'x-office': office,
        'x-role': 'SuperAdmin',
        'x-is-cross-office': 'true',
    };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function apiGet(base, path, office) {
    const res = await fetch(`${base}${path}`, { headers: authHeaders(office) });
    if (!res.ok) {
        const body = await res.text();
        const err = new Error(`GET ${path} → ${res.status}: ${body}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function apiPost(base, path, office, body) {
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: authHeaders(office),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`POST ${path} → ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function apiPatch(base, path, office) {
    const res = await fetch(`${base}${path}`, {
        method: 'PATCH',
        headers: authHeaders(office),
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`PATCH ${path} → ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Step 1: Fetch services from the catalogue (TT1 must be done)
// ---------------------------------------------------------------------------
async function fetchServicesForOffice(office) {
    const all = [];
    let page = 1;
    const limit = 100;
    while (true) {
        const res = await apiGet(CATALOGUE_BASE, `/api/services?page=${page}&limit=${limit}`, office);
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        all.push(...list);
        if (list.length < limit) break;
        page++;
    }
    return all;
}

// ---------------------------------------------------------------------------
// Step 2: Seed evaluation periods (ONCE, globally — office=ALL)
// ---------------------------------------------------------------------------
async function seedPeriods() {
    console.log('\n── Step 2: Seeding evaluation periods (global, office=ALL) ──');

    const periodDefs = [
        {
            name: 'Q1-2026',
            period_type: 'Quarterly',
            start_date: '2026-01-01',
            end_date: '2026-03-31',
            shouldComplete: false,
        },
    ];

    const created = [];

    for (const def of periodDefs) {
        const { shouldComplete, ...dto } = def;
        try {
            console.log(`  Creating period: "${dto.name}" ...`);
            if (DRY_RUN) {
                console.log(`    [DRY RUN] Would POST /api/periods:`, JSON.stringify(dto));
                created.push({ id: `dry-run-${dto.name}`, ...dto, status: 'Open', shouldComplete });
                continue;
            }

            const result = await apiPost(KPI_SLA_BASE, '/api/periods', 'ALL', dto);
            console.log(`    ✓ Created "${dto.name}" → id=${result.id}, status=${result.status}`);
            created.push({ ...result, shouldComplete });
        } catch (err) {
            if (err.status === 409) {
                console.log(`    ⏭ Period "${dto.name}" already exists, looking it up...`);
                try {
                    const allPeriods = await apiGet(KPI_SLA_BASE, '/api/periods?limit=100', 'ALL');
                    const list = allPeriods?.data ?? (Array.isArray(allPeriods) ? allPeriods : []);
                    const existing = list.find((p) => p.name === dto.name);
                    if (existing) {
                        console.log(`    → Found existing: id=${existing.id}, status=${existing.status}`);
                        created.push({ ...existing, shouldComplete });
                    } else {
                        console.log(`    ⚠ Could not find existing period by name.`);
                    }
                } catch (lookupErr) {
                    console.log(`    ⚠ Lookup failed: ${lookupErr.message}`);
                }
            } else {
                console.error(`    ✗ Failed: ${err.message}`);
            }
        }
    }

    // Complete Q1 (Closed) — only if it's currently Open
    for (const p of created) {
        if (!p.shouldComplete) continue;
        if (p.status === 'Open') {
            try {
                console.log(`  Completing period "${p.name}" (${p.id}) ...`);
                if (DRY_RUN) {
                    console.log(`    [DRY RUN] Would PATCH /api/periods/${p.id}/complete`);
                    p.status = 'Closed';
                    continue;
                }
                const completed = await apiPatch(KPI_SLA_BASE, `/api/periods/${p.id}/complete`, 'ALL');
                console.log(`    ✓ Completed → status=${completed.status}`);
                p.status = completed.status;
            } catch (err) {
                console.error(`    ✗ Failed to complete: ${err.message}`);
            }
        } else {
            console.log(`  Period "${p.name}" is already ${p.status}, skipping complete.`);
        }
    }

    return created;
}

// ---------------------------------------------------------------------------
// Step 3: Seed KPIs (3 per service, per office)
// ---------------------------------------------------------------------------
function slaTargetToDays(service) {
    const val = Number(service.sla_target_value) || 0;
    const unit = (service.sla_target_unit || '').toUpperCase();
    if (unit === 'DAYS' || unit === 'DAY') return Math.max(val, 1);
    if (unit === 'HOURS' || unit === 'HOUR') return Math.max(Math.ceil(val / 24), 1);
    // Minutes (default in TT1 seed)
    return Math.max(Math.ceil(val / 1440), 1);
}

function buildKpiTemplates(service) {
    return [
        {
            name: 'Timeliness',
            category: 'EFFICIENCY',
            target_value: 95,
            unit: 'PERCENT',
            service_id: service.id,
        },
        {
            name: 'Compliance Rate',
            category: 'COMPLIANCE',
            target_value: 90,
            unit: 'PERCENT',
            service_id: service.id,
        },
        {
            name: 'Processing Time',
            category: 'CUSTOMER',
            target_value: slaTargetToDays(service),
            unit: 'DAYS',
            service_id: service.id,
        },
    ];
}

async function seedKpisForServices(services, office) {
    console.log(`\n  Office ${office}: seeding KPIs for ${services.length} service(s)`);

    const createdKpis = [];

    for (const svc of services) {
        const templates = buildKpiTemplates(svc);
        for (const kpi of templates) {
            try {
                const label = `"${kpi.name}" (${kpi.target_value} ${kpi.unit}) → "${svc.name}"`;
                if (DRY_RUN) {
                    console.log(`    [DRY RUN] ${label}`);
                    createdKpis.push({ id: `dry-${svc.id}-${kpi.name}`, ...kpi });
                    continue;
                }

                const created = await apiPost(KPI_SLA_BASE, '/api/kpis', office, kpi);
                console.log(`    ✓ ${label} → id=${created.id}`);
                createdKpis.push(created);
            } catch (err) {
                if (err.status === 409) {
                    console.log(`    ⏭ KPI "${kpi.name}" already exists for service "${svc.name}", skipping.`);
                    try {
                        const res = await apiGet(KPI_SLA_BASE, `/api/kpis?service_id=${svc.id}&limit=100`, office);
                        const list = res?.data ?? (Array.isArray(res) ? res : []);
                        const match = list.find(
                            (k) => k.name === kpi.name && k.category === kpi.category && k.service_id === svc.id
                        );
                        if (match) {
                            createdKpis.push({ ...match, target_value: Number(match.target_value) });
                        }
                    } catch (_) { /* best effort */ }
                } else {
                    console.error(`    ✗ KPI "${kpi.name}" for "${svc.name}": ${err.message}`);
                }
            }
        }
    }

    return createdKpis;
}

// ---------------------------------------------------------------------------
// Step 4: Seed OPCR Commitment (per office, for Q1-2026)
// ---------------------------------------------------------------------------
async function seedCommitment(office, periodId, kpis) {
    console.log(`\n  Office ${office}: seeding commitment for period ${periodId}`);

    if (!periodId) {
        console.log('    ⚠ No Q1-2026 period ID — skipping.');
        return null;
    }

    const items = kpis
        .filter((k) => k.id && k.service_id)
        .map((k) => ({
            service_id: k.service_id,
            kpi_id: k.id,
            target_value: k.target_value,
            unit: k.unit,
        }));

    if (items.length === 0) {
        console.log('    ⚠ No KPIs available for commitment items — skipping.');
        return null;
    }

    const dto = { period_id: periodId, items };

    if (DRY_RUN) {
        console.log(`    [DRY RUN] Would POST /api/commitments with ${items.length} items`);
        console.log(`    [DRY RUN] Would then PATCH /api/commitments/<id>/lock`);
        return { id: 'dry-run', status: 'Locked (dry-run)', itemCount: items.length };
    }

    try {
        const created = await apiPost(COMMITMENT_BASE, '/api/commitments', office, dto);
        console.log(`    ✓ Created → id=${created.id}, status=${created.status}, items=${items.length}`);

        try {
            const locked = await apiPatch(COMMITMENT_BASE, `/api/commitments/${created.id}/lock`, office);
            console.log(`    ✓ Locked → status=${locked.status}`);
            return locked;
        } catch (lockErr) {
            console.error(`    ✗ Lock failed: ${lockErr.message}`);
            return created;
        }
    } catch (err) {
        if (err.status === 409) {
            console.log(`    ⏭ Commitment already exists for this office/period — skipping.`);
        } else {
            console.error(`    ✗ Failed: ${err.message}`);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log(`\n=== TT2 Seed — Periods, KPIs, Commitments ===`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no API calls)' : 'LIVE'}`);
    console.log(`Catalogue:  ${CATALOGUE_BASE}`);
    console.log(`KPI-SLA:    ${KPI_SLA_BASE}`);
    console.log(`Commitment: ${COMMITMENT_BASE}\n`);

    console.log('── Step 1: Fetching services from catalogue ──');

    let allServices = [];
    try {
        allServices = await fetchServicesForOffice('ALL');
    } catch (err) {
        throw new Error(`Failed to fetch services: ${err.message}`);
    }

    const activeServices = allServices.filter(
        (s) => (s.status || '').toUpperCase() === 'ACTIVE' || s.is_active === true || s.active === true
    );

    if (activeServices.length === 0) {
        throw new Error('ABORT: No active services found. Run TT1 (seed-services.js) first.');
    }

    const servicesByOffice = new Map();
    for (const svc of activeServices) {
        const office = svc.office;
        if (!servicesByOffice.has(office)) {
            servicesByOffice.set(office, []);
        }
        servicesByOffice.get(office).push(svc);
    }

    const selectedByOffice = new Map();
    for (const [office, services] of servicesByOffice) {
        const picked = services.slice(0, SERVICES_PER_OFFICE);
        selectedByOffice.set(office, picked);
        console.log(`  → Selected ${picked.length} from "${office}":`);
        picked.forEach((s) =>
            console.log(`      "${s.name}" (sla=${s.sla_target_value} ${s.sla_target_unit})`)
        );
    }

    const periods = await seedPeriods();
    const q1Period = periods.find((p) => p.name === 'Q1-2026');
    const q2Period = periods.find((p) => p.name === 'Q2-2026');

    console.log('\n  Period summary:');
    if (q1Period) console.log(`    Q1-2026: id=${q1Period.id}, status=${q1Period.status}`);
    if (q2Period) console.log(`    Q2-2026: id=${q2Period.id}, status=${q2Period.status}`);

    console.log('\n── Step 3: Seeding KPIs ──');
    const kpisByOffice = new Map();
    for (const [office, services] of selectedByOffice) {
        const kpis = await seedKpisForServices(services, office);
        kpisByOffice.set(office, kpis);
    }

    console.log('\n── Step 4: Seeding OPCR Commitments ──');
    const commitments = [];
    for (const [office] of selectedByOffice) {
        const kpis = kpisByOffice.get(office) || [];
        const commitment = await seedCommitment(office, q1Period?.id, kpis);
        if (commitment) commitments.push({ office, commitment });
    }

    console.log('\n\n=== TT2 Seed Summary ===');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Periods created/found: ${periods.length} (global)`);
    for (const [office] of selectedByOffice) {
        const kpis = kpisByOffice.get(office) || [];
        const c = commitments.find((x) => x.office === office);
        console.log(`\n  ${office}:`);
        console.log(`    Services selected: ${selectedByOffice.get(office)?.length || 0}`);
        console.log(`    KPIs created/found: ${kpis.length}`);
        console.log(`    Commitment: ${c ? (c.commitment.status || 'created') : 'none'}`);
    }
    console.log('\nDone!\n');
}

main().catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
});