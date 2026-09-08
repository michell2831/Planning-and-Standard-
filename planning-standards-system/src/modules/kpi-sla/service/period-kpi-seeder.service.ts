import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { EvaluationPeriod } from '../database/evaluation-period.entity';
import { Kpi } from '../database/kpi.entity';
import { PeriodType, PeriodStatus, KpiCategory, KpiUnit } from '../enums';

@Injectable()
export class PeriodKpiSeederService implements OnApplicationBootstrap {
    private readonly logger = new Logger(PeriodKpiSeederService.name);
    private readonly targetOffices = ['ACAD', 'ADMIN', 'OSAS'];

    constructor(
        @InjectRepository(EvaluationPeriod, 'kpi_sla_db')
        private readonly periodRepo: Repository<EvaluationPeriod>,
        @InjectRepository(Kpi, 'kpi_sla_db')
        private readonly kpiRepo: Repository<Kpi>,
        private readonly httpService: HttpService,
        private readonly config: ConfigService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        try {
            this.logger.log('Starting Evaluation Periods & KPI auto-seeder...');
            await this.seedPeriods();
            await this.seedKpis();
        } catch (err) {
            // NEVER crash NestJS on seeding error — log warning only
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Period & KPI auto-seed skipped or encountered an error: ${msg}`);
        }
    }

    private async seedPeriods(): Promise<void> {
        const periodDef = {
            name: 'Q1-2026',
            period_type: PeriodType.QUARTERLY,
            start_date: '2026-01-01',
            end_date: '2026-03-31',
            status: PeriodStatus.OPEN,
        };

        try {
            const count = await this.periodRepo.count({ where: { is_active: true } });
            if (count === 0) {
                const period = this.periodRepo.create({
                    ...periodDef,
                    office: 'ALL',
                    created_by: 'system_seed',
                });
                await this.periodRepo.save(period);
                this.logger.log(`Created initial evaluation period "${periodDef.name}" (${periodDef.status})`);
            } else {
                this.logger.log(`Evaluation periods already exist (${count} period(s)). Skipping period seeding.`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Failed to seed initial period "${periodDef.name}": ${msg}`);
        }
    }

    private async seedKpis(): Promise<void> {
        const catalogueBase =
            this.config.get<string>('SERVICE_CATALOGUE_URL') ||
            this.config.get<string>('CATALOGUE_BASE') ||
            'http://localhost:3010';

        let services: any[] = [];
        try {
            const res = await firstValueFrom(
                this.httpService.get(`${catalogueBase}/api/services?limit=100`, {
                    headers: {
                        'x-office': 'ALL',
                        'x-role': 'SuperAdmin',
                        'x-is-cross-office': 'true',
                    },
                    timeout: 5000,
                }),
            );
            services = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Could not fetch services from ${catalogueBase} (${msg}). KPI seeding will be skipped.`,
            );
            return;
        }

        if (services.length === 0) {
            this.logger.log('No services found from service catalogue to seed KPIs.');
            return;
        }

        for (const office of this.targetOffices) {
            const officeServices = services.filter((s) => s.office === office).slice(0, 3);
            for (const svc of officeServices) {
                const targetDays = Math.max(
                    Math.ceil((Number(svc.sla_target_value) || 1) / (svc.sla_target_unit === 'Days' ? 1 : 1440)),
                    1,
                );

                const kpiDefs = [
                    {
                        name: 'Timeliness',
                        category: KpiCategory.EFFICIENCY,
                        target_value: 95,
                        unit: KpiUnit.PERCENT,
                    },
                    {
                        name: 'Compliance Rate',
                        category: KpiCategory.COMPLIANCE,
                        target_value: 90,
                        unit: KpiUnit.PERCENT,
                    },
                    {
                        name: 'Processing Time',
                        category: KpiCategory.CUSTOMER,
                        target_value: targetDays,
                        unit: KpiUnit.DAYS,
                    },
                ];

                for (const kpiDef of kpiDefs) {
                    try {
                        const existing = await this.kpiRepo.findOne({
                            where: {
                                service_id: svc.id,
                                name: kpiDef.name,
                            },
                        });

                        if (!existing) {
                            const newKpi = this.kpiRepo.create({
                                office,
                                service_id: svc.id,
                                name: kpiDef.name,
                                category: kpiDef.category,
                                target_value: kpiDef.target_value,
                                unit: kpiDef.unit,
                                created_by: 'system_seed',
                            });
                            await this.kpiRepo.save(newKpi);
                            this.logger.log(`Created KPI "${kpiDef.name}" for service "${svc.name}" (${office})`);
                        }
                    } catch (kpiErr) {
                        const msg = kpiErr instanceof Error ? kpiErr.message : String(kpiErr);
                        this.logger.warn(`Failed to seed KPI "${kpiDef.name}": ${msg}`);
                    }
                }
            }
        }
    }
}
