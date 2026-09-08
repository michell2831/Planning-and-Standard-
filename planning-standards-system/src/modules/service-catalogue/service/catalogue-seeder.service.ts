import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Service } from '../database/service.entity';
import { IntakeField } from '../database/service-intake-field.entity';
import { FieldType, ReferralStatus, ServiceStatus, SlaUnit } from '../enums';

function deriveWithReferral(serviceMode?: string | null): ReferralStatus {
    if (serviceMode === 'With Referral') return ReferralStatus.WITH;
    if (serviceMode === 'Without Referral') return ReferralStatus.WITHOUT;
    return ReferralStatus.NA;
}

function parseRequiredDocuments(raw?: string | null): string[] {
    if (!raw || raw.trim() === '' || raw.trim() === 'No Requirements Needed') {
        return [];
    }
    return raw.split('; ').map((s) => s.trim()).filter(Boolean);
}

function normalizeClassification(value?: string | null): string | null {
    if (!value) return null;
    return value
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseFieldType(raw?: string | null): FieldType {
    const upper = (raw || '').toUpperCase();
    if (Object.values(FieldType).includes(upper as FieldType)) {
        return upper as FieldType;
    }
    return FieldType.TEXT;
}

@Injectable()
export class CatalogueSeederService implements OnApplicationBootstrap {
    private readonly logger = new Logger(CatalogueSeederService.name);

    constructor(
        @InjectRepository(Service, 'catalogue_db')
        private readonly serviceRepo: Repository<Service>,

        @InjectRepository(IntakeField, 'catalogue_db')
        private readonly intakeFieldRepo: Repository<IntakeField>,
    ) { }

    async onApplicationBootstrap(): Promise<void> {
        if (process.env.SEED_SERVICES === 'false') {
            this.logger.log('SEED_SERVICES is explicitly false. Skipping catalogue seeder.');
            return;
        }

        try {
            const existingCount = await this.serviceRepo.count();
            this.logger.log(`Service catalogue currently has ${existingCount} service(s) in DB.`);

            // --- Locate seed data files ---
            // Build a wide list of candidate directories so the seeder works
            // regardless of runtime environment (local dev, Docker, Railway/Nixpacks).
            const candidateDirs = [
                // Docker compose: cwd = /app/src/modules/service-catalogue
                path.resolve(process.cwd(), 'scripts/data'),
                // Railway Nixpacks: source files may be at project root
                path.resolve(process.cwd(), 'src/modules/service-catalogue/scripts/data'),
                // NestJS assets copy: nest build copies JSON into dist/scripts/data
                path.resolve(process.cwd(), 'dist/scripts/data'),
                // Relative to compiled __dirname in dist/
                path.resolve(__dirname, '../scripts/data'),
                path.resolve(__dirname, '../../scripts/data'),
                path.resolve(__dirname, '../../../scripts/data'),
                path.resolve(__dirname, '../../../../scripts/data'),
                // Absolute fallbacks for common layouts
                path.resolve(__dirname, '../../../src/modules/service-catalogue/scripts/data'),
                path.resolve(__dirname, '../../../../src/modules/service-catalogue/scripts/data'),
            ];

            this.logger.log(`[Seeder Debug] __dirname = ${__dirname}`);
            this.logger.log(`[Seeder Debug] process.cwd() = ${process.cwd()}`);

            let dataDir: string | undefined;
            for (const dir of candidateDirs) {
                const testFile = path.join(dir, 'batch1_academic_office.json');
                const exists = fs.existsSync(testFile);
                this.logger.log(`[Seeder Debug] Checking ${dir} => ${exists ? 'FOUND' : 'not found'}`);
                if (exists && !dataDir) {
                    dataDir = dir;
                }
            }

            if (!dataDir) {
                this.logger.warn(
                    'Seed data directory not found in any candidate path. ' +
                    'Ensure scripts/data/*.json files are present in the deployed build. ' +
                    'Skipping catalogue auto-seed.',
                );
                return;
            }

            const batchFiles = [
                'batch1_academic_office.json',
                'batch2_osas.json',
                'batch3_administrative_office.json',
            ];

            this.logger.log(`Starting automated Service Catalogue seeding from ${dataDir}...`);

            const rawRecords: any[] = [];
            for (const file of batchFiles) {
                const filePath = path.join(dataDir, file);
                if (fs.existsSync(filePath)) {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    rawRecords.push(...data);
                    this.logger.log(`  Loaded ${data.length} records from ${file}`);
                } else {
                    this.logger.warn(`  Batch file missing: ${filePath}`);
                }
            }

            // Deduplicate exact overlaps (office, name, service_mode)
            const seen = new Set<string>();
            const uniqueRecords: any[] = [];
            for (const r of rawRecords) {
                const key = `${r.office}||${r.name}||${r.service_mode ?? ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueRecords.push(r);
                }
            }

            this.logger.log(`Total unique records to process: ${uniqueRecords.length}`);

            let createdServices = 0;
            let skippedServices = 0;
            let createdIntakeFields = 0;

            for (const r of uniqueRecords) {
                const name = r.name?.trim();
                const office = r.office?.trim();
                const serviceMode = r.service_mode ? r.service_mode.trim() : null;

                // Check if already exists (per-record dedup — safe to re-run)
                const existing = await this.serviceRepo.findOne({
                    where: {
                        office,
                        name,
                        service_mode: serviceMode,
                    },
                });

                if (existing) {
                    skippedServices++;
                    continue;
                }

                const service = this.serviceRepo.create({
                    office,
                    responsible_unit: r.responsible_unit || office,
                    name,
                    service_mode: serviceMode,
                    classification: normalizeClassification(r.classification),
                    sla_target_value: Number(r.sla_target_value) || 1,
                    sla_target_unit: SlaUnit.MINUTES,
                    required_documents: parseRequiredDocuments(r.required_documents),
                    processing_steps: Array.isArray(r.processing_steps) ? r.processing_steps : [],
                    expected_output: r.expected_output || null,
                    with_referral: deriveWithReferral(serviceMode),
                    status: ServiceStatus.ACTIVE,
                    created_by: 'system_auto_seed',
                });

                const saved = await this.serviceRepo.save(service);
                createdServices++;

                // Seed intake fields if defined
                if (Array.isArray(r.intake_fields) && r.intake_fields.length > 0) {
                    for (const field of r.intake_fields) {
                        const intakeField = this.intakeFieldRepo.create({
                            service_id: saved.id,
                            label: field.label,
                            field_type: parseFieldType(field.field_type),
                            is_required: Boolean(field.is_required),
                            display_order: Number(field.display_order) || 0,
                            dropdown_options: field.dropdown_options || null,
                            is_active: true,
                        });
                        await this.intakeFieldRepo.save(intakeField);
                        createdIntakeFields++;
                    }
                }
            }

            this.logger.log(
                `Catalogue auto-seed completed: ` +
                `${createdServices} created, ${skippedServices} skipped (already existed), ` +
                `${createdIntakeFields} intake fields created.`,
            );
        } catch (err) {
            this.logger.error('Failed to auto-seed service catalogue:', err);
        }
    }
}
