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
            if (existingCount > 0 && process.env.FORCE_SEED !== 'true') {
                this.logger.log(`Service catalogue already has ${existingCount} services. Skipping auto-seed.`);
                return;
            }

            const candidateDirs = [
                path.resolve(__dirname, '../scripts/data'),
                path.resolve(__dirname, '../../scripts/data'),
                path.resolve(process.cwd(), 'src/modules/service-catalogue/scripts/data'),
                path.resolve(process.cwd(), 'scripts/data'),
                path.resolve(__dirname, '../../../src/modules/service-catalogue/scripts/data'),
            ];

            const dataDir = candidateDirs.find((dir) =>
                fs.existsSync(path.join(dir, 'batch1_academic_office.json')),
            );

            if (!dataDir) {
                this.logger.warn('Seed data directory not found in candidate paths. Skipping catalogue auto-seed.');
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

            let createdServices = 0;
            let createdIntakeFields = 0;

            for (const r of uniqueRecords) {
                const name = r.name?.trim();
                const office = r.office?.trim();
                const serviceMode = r.service_mode ? r.service_mode.trim() : null;

                // Check if already exists
                const existing = await this.serviceRepo.findOne({
                    where: {
                        office,
                        name,
                        service_mode: serviceMode,
                    },
                });

                if (existing) {
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
                `Catalogue auto-seed completed: ${createdServices} services and ${createdIntakeFields} intake fields created.`,
            );
        } catch (err) {
            this.logger.error('Failed to auto-seed service catalogue:', err);
        }
    }
}
