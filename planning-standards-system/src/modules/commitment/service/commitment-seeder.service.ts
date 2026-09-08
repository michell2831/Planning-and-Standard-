import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Commitment } from '../database/commitment.entity';
import { CommitmentItem } from '../database/commitment-item.entity';
import { CommitmentStatus, CommitmentItemUnit } from '../enums';

@Injectable()
export class CommitmentSeederService implements OnApplicationBootstrap {
    private readonly logger = new Logger(CommitmentSeederService.name);
    private readonly targetOffices = ['ACAD', 'ADMIN', 'OSAS'];

    constructor(
        @InjectRepository(Commitment, 'commitment_db')
        private readonly commitmentRepo: Repository<Commitment>,
        @InjectRepository(CommitmentItem, 'commitment_db')
        private readonly commitmentItemRepo: Repository<CommitmentItem>,
        private readonly httpService: HttpService,
        private readonly config: ConfigService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        try {
            this.logger.log('Starting OPCR Commitment auto-seeder check...');
            await this.seedCommitments();
        } catch (err) {
            // NEVER crash NestJS on seeding error — log warning only
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Commitment auto-seed skipped or encountered an error: ${msg}`);
        }
    }

    private parseUnit(rawUnit?: string): CommitmentItemUnit {
        const u = (rawUnit || '').toUpperCase();
        if (u === 'DAYS' || u === 'DAY') return CommitmentItemUnit.DAYS;
        if (u === 'PERCENT' || u === '%') return CommitmentItemUnit.PERCENT;
        return CommitmentItemUnit.COUNT;
    }

    private async seedCommitments(): Promise<void> {
        const kpiSlaBase =
            this.config.get<string>('KPI_SLA_URL') ||
            this.config.get<string>('KPI_SLA_BASE') ||
            'http://localhost:3011';

        let periods: any[] = [];
        try {
            const res = await firstValueFrom(
                this.httpService.get(`${kpiSlaBase}/api/periods?limit=100`, {
                    headers: {
                        'x-office': 'ALL',
                        'x-role': 'SuperAdmin',
                        'x-is-cross-office': 'true',
                    },
                    timeout: 5000,
                }),
            );
            periods = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Could not fetch periods from ${kpiSlaBase} (${msg}). Commitment seeding skipped.`,
            );
            return;
        }

        const targetPeriod = periods.find((p) => p.name === 'Q1-2026') || periods[0];
        if (!targetPeriod) {
            this.logger.log('No evaluation period found in kpi-sla service. Skipping commitment seeding.');
            return;
        }

        for (const office of this.targetOffices) {
            try {
                const existing = await this.commitmentRepo.findOne({
                    where: { office, period_id: targetPeriod.id },
                });

                if (existing) {
                    this.logger.log(`Commitment already exists for office ${office} in ${targetPeriod.name}`);
                    continue;
                }

                let kpis: any[] = [];
                try {
                    const kpiRes = await firstValueFrom(
                        this.httpService.get(`${kpiSlaBase}/api/kpis?limit=100`, {
                            headers: {
                                'x-office': office,
                                'x-role': 'SuperAdmin',
                                'x-is-cross-office': 'false',
                            },
                            timeout: 5000,
                        }),
                    );
                    kpis = Array.isArray(kpiRes.data) ? kpiRes.data : (kpiRes.data?.data ?? []);
                } catch (kpiErr) {
                    const msg = kpiErr instanceof Error ? kpiErr.message : String(kpiErr);
                    this.logger.warn(`Could not fetch KPIs for office ${office}: ${msg}`);
                    continue;
                }

                const validKpis = kpis.filter((k) => k.id && k.service_id);
                if (validKpis.length === 0) {
                    this.logger.log(`No KPIs available to seed commitment for office ${office}`);
                    continue;
                }

                const commitment = this.commitmentRepo.create({
                    office,
                    period_id: targetPeriod.id,
                    status: CommitmentStatus.LOCKED,
                    version_number: 1,
                    submitted_by: 'system_seed',
                    submitted_at: new Date('2026-01-15T10:00:00Z'),
                    locked_by: 'system_seed',
                    locked_at: new Date('2026-01-15T10:05:00Z'),
                    created_by: 'system_seed',
                });

                const savedCommitment = await this.commitmentRepo.save(commitment);

                const items = validKpis.map((k) =>
                    this.commitmentItemRepo.create({
                        commitment_id: savedCommitment.id,
                        service_id: k.service_id,
                        kpi_id: k.id,
                        target_value: Number(k.target_value) || 0,
                        unit: this.parseUnit(k.unit),
                    }),
                );

                await this.commitmentItemRepo.save(items);
                this.logger.log(
                    `Created and locked commitment for ${office} (id=${savedCommitment.id}, items=${items.length})`,
                );
            } catch (officeErr) {
                const msg = officeErr instanceof Error ? officeErr.message : String(officeErr);
                this.logger.warn(`Failed to seed commitment for office ${office}: ${msg}`);
            }
        }
    }
}
