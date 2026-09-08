import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Service } from '../database/service.entity';
import { IntakeField } from '../database/service-intake-field.entity';
import { ServiceStatus, SlaUnit, ReferralStatus, FieldType } from '../enums';

interface RawIntakeField {
  label: string;
  field_type?: string;
  is_required?: boolean;
  display_order?: number;
}

interface RawRecord {
  office: string;
  sub_office?: string;
  name: string;
  service_mode?: string;
  classification?: string;
  sla_target_value?: number;
  sla_target_unit?: string;
  responsible_unit?: string;
  processing_steps?: string[];
  required_documents?: string | string[];
  expected_output?: string;
  intake_fields?: RawIntakeField[];
}

@Injectable()
export class CatalogueSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogueSeederService.name);

  private readonly batchFiles = [
    'batch1_academic_office.json',
    'batch2_osas.json',
    'batch3_administrative_office.json',
  ];

  constructor(
    @InjectRepository(Service, 'catalogue_db')
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(IntakeField, 'catalogue_db')
    private readonly intakeFieldRepo: Repository<IntakeField>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.log('Starting Service Catalogue auto-seeder check...');
      await this.seedCatalogue();
    } catch (err) {
      // NEVER crash NestJS on seeding error — log warning only
      this.logger.warn(`Catalogue auto-seed skipped or encountered an error: ${err.message}`);
    }
  }

  private resolveDataDir(): string | null {
    const candidates = [
      path.join(__dirname, '../scripts/data'),
      path.join(__dirname, '../../scripts/data'),
      path.join(__dirname, 'scripts/data'),
      path.join(process.cwd(), 'scripts/data'),
      path.join(process.cwd(), 'src/modules/service-catalogue/scripts/data'),
      path.join(process.cwd(), 'planning-standards-system/src/modules/service-catalogue/scripts/data'),
      path.join(__dirname, '../../../../src/modules/service-catalogue/scripts/data'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const hasBatches = fs.existsSync(path.join(p, this.batchFiles[0]));
        if (hasBatches) {
          this.logger.log(`Found seed data directory at: ${p}`);
          return p;
        }
      }
    }

    return null;
  }

  private parseRequiredDocuments(raw: string | string[] | undefined): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.trim() === '' || raw.trim() === 'No Requirements Needed') return [];
    return raw.split('; ').map((s) => s.trim()).filter(Boolean);
  }

  private deriveReferralStatus(mode?: string): ReferralStatus {
    if (mode === 'With Referral') return ReferralStatus.WITH;
    if (mode === 'Without Referral') return ReferralStatus.WITHOUT;
    return ReferralStatus.NA;
  }

  private parseFieldType(ft?: string): FieldType {
    const upper = (ft || '').toUpperCase();
    if (upper === 'TEXT') return FieldType.TEXT;
    if (upper === 'NUMBER') return FieldType.NUMBER;
    if (upper === 'DATE') return FieldType.DATE;
    if (upper === 'DROPDOWN') return FieldType.DROPDOWN;
    if (upper === 'BOOLEAN' || upper === 'CHECKBOX') return FieldType.BOOLEAN;
    if (upper === 'FILE') return FieldType.FILE;
    if (upper === 'TEXTAREA') return FieldType.TEXTAREA;
    return FieldType.TEXT;
  }

  private async seedCatalogue(): Promise<void> {
    const dataDir = this.resolveDataDir();
    if (!dataDir) {
      this.logger.warn('Seed data directory not found in candidate paths. Skipping auto-seed.');
      return;
    }

    const rawRecords: RawRecord[] = [];
    for (const file of this.batchFiles) {
      const fullPath = path.join(dataDir, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          if (Array.isArray(content)) {
            rawRecords.push(...content);
          }
        } catch (e) {
          this.logger.warn(`Failed to parse ${file}: ${e.message}`);
        }
      }
    }

    if (rawRecords.length === 0) {
      this.logger.log('No seed records found to process.');
      return;
    }

    this.logger.log(`Loaded ${rawRecords.length} records. Processing idempotent seeding...`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const record of rawRecords) {
      try {
        const mode = record.service_mode || null;
        const existing = await this.serviceRepo.findOne({
          where: {
            office: record.office,
            name: record.name,
            service_mode: mode === null ? IsNull() : mode,
          },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        const service = this.serviceRepo.create({
          office: record.office,
          sub_office: record.sub_office || null,
          name: record.name,
          service_mode: mode,
          classification: record.classification || null,
          sla_target_value: Number(record.sla_target_value) || 1,
          sla_target_unit: SlaUnit.MINUTES,
          responsible_unit: record.responsible_unit || 'Default Unit',
          with_referral: this.deriveReferralStatus(record.service_mode),
          required_documents: this.parseRequiredDocuments(record.required_documents),
          processing_steps: Array.isArray(record.processing_steps) ? record.processing_steps : [],
          expected_output: record.expected_output || '',
          status: ServiceStatus.ACTIVE,
          created_by: 'system_seed',
        });

        const saved = await this.serviceRepo.save(service);
        createdCount++;

        if (record.intake_fields && Array.isArray(record.intake_fields)) {
          for (const f of record.intake_fields) {
            const intake = this.intakeFieldRepo.create({
              service_id: saved.id,
              label: f.label,
              field_type: this.parseFieldType(f.field_type),
              is_required: Boolean(f.is_required),
              display_order: f.display_order ?? 0,
              dropdown_options: null,
              is_active: true,
            });
            await this.intakeFieldRepo.save(intake);
          }
        }
      } catch (itemErr) {
        this.logger.warn(`Failed to seed service "${record.name}": ${itemErr.message}`);
      }
    }

    this.logger.log(`Catalogue auto-seeder finished: ${createdCount} created, ${skippedCount} already existed.`);
  }
}
