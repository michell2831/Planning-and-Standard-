#!/usr/bin/env node
/**
 * Universal Database Seeder Runner (TT1 + TT2)
 *
 * Runs seed-services.js (TT1) followed by seed-tt2.js (TT2) against
 * any local or deployed Railway environment.
 *
 * Usage:
 *   # Target deployed Railway public URL / Gateway URL:
 *   node scripts/seed-all.js https://your-gateway.up.railway.app
 *
 *   # Or against local services (default ports 3010, 3011, 3012):
 *   node scripts/seed-all.js
 *
 *   # Dry run:
 *   node scripts/seed-all.js --dry-run
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const urlArg = args.find((a) => a.startsWith('http://') || a.startsWith('https://'));

const DEFAULT_CATALOGUE = urlArg || process.env.API_BASE || process.env.CATALOGUE_BASE || 'http://localhost:3010';
const DEFAULT_KPI_SLA = urlArg || process.env.KPI_SLA_BASE || 'http://localhost:3011';
const DEFAULT_COMMITMENT = urlArg || process.env.COMMITMENT_BASE || 'http://localhost:3012';

const tt1Script = path.join(__dirname, '../src/modules/service-catalogue/scripts/seed-services.js');
const tt2Script = path.join(__dirname, 'seed-tt2.js');

console.log('\n======================================================');
console.log('  PSS Automated Database Seeder Runner (TT1 + TT2)    ');
console.log('======================================================');
console.log(`Catalogue URL:  ${DEFAULT_CATALOGUE}`);
console.log(`KPI-SLA URL:    ${DEFAULT_KPI_SLA}`);
console.log(`Commitment URL: ${DEFAULT_COMMITMENT}`);
console.log(`Mode:           ${isDryRun ? 'DRY RUN' : 'LIVE SEED'}`);
console.log('======================================================\n');

function runScript(scriptPath, envVars, stepName) {
    return new Promise((resolve, reject) => {
        console.log(`>>> Starting ${stepName} (${path.basename(scriptPath)})...`);

        const scriptArgs = isDryRun ? ['--dry-run'] : [];
        const proc = spawn(process.execPath, [scriptPath, ...scriptArgs], {
            env: {
                ...process.env,
                ...envVars,
            },
            stdio: 'inherit',
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`\n>>> [OK] ${stepName} completed successfully.\n`);
                resolve();
            } else {
                reject(new Error(`${stepName} exited with status code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    try {
        // Step 1: TT1 — Service Catalogue
        await runScript(
            tt1Script,
            {
                API_BASE: DEFAULT_CATALOGUE,
            },
            'Step 1: TT1 (Service Catalogue Seeder)',
        );

        // Step 2: TT2 — Periods, KPIs, Commitments
        await runScript(
            tt2Script,
            {
                CATALOGUE_BASE: DEFAULT_CATALOGUE,
                KPI_SLA_BASE: DEFAULT_KPI_SLA,
                COMMITMENT_BASE: DEFAULT_COMMITMENT,
            },
            'Step 2: TT2 (Periods, KPIs, Commitments Seeder)',
        );

        console.log('======================================================');
        console.log('  ALL SEEDING COMPLETED SUCCESSFULLY!                ');
        console.log('======================================================\n');
    } catch (err) {
        console.error('\nSeeding failed:', err.message);
        process.exit(1);
    }
}

main();
