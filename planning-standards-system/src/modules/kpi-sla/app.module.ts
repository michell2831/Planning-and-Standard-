import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Kpi } from './database/kpi.entity';
import { SlaRule } from './database/sla-rule.entity';
import { SlaRuleVersion } from './database/sla-rule-version.entity';
import { Holiday } from './database/holiday.entity';
import { EvaluationPeriod } from './database/evaluation-period.entity';
import { SlaComputationLog } from './database/sla-computation-log.entity';
import { ServiceUtilization } from './database/service-utilization.entity';
import { KpiSlaController } from './controller/kpi-sla.controller';
import { MonitorController } from './controller/monitor.controller';
import { SlaComputationController } from './controller/sla-computation.controller';
import { KpiSlaService } from './service/kpi-sla.service';
import { MonitorService } from './service/monitor.service';
import { SlaComputationService } from './service/sla-computation.service';
import { PhHolidayService } from './service/ph-holiday.service';
import { HolidaySeederService } from './service/holiday-seeder.service';
import { RequestContextMiddleware } from '../../common/context/request-context';

import { PeriodKpiSeederService } from './service/period-kpi-seeder.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule,
        TypeOrmModule.forRootAsync({
            name: 'kpi_sla_db',
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                type: 'postgres',
                name: 'kpi_sla_db',
                host: config.get('DB_HOST'),
                port: config.get<number>('DB_PORT'),
                username: config.get('DB_USERNAME'),
                password: config.get('DB_PASSWORD'),
                database: config.get('DB_NAME'),
                entities: [Kpi, SlaRule, SlaRuleVersion, Holiday, EvaluationPeriod, SlaComputationLog, ServiceUtilization],
                synchronize: true,
            }),
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature(
            [Kpi, SlaRule, SlaRuleVersion, Holiday, EvaluationPeriod, SlaComputationLog, ServiceUtilization],
            'kpi_sla_db',
        ),
    ],
    controllers: [KpiSlaController, MonitorController, SlaComputationController],
    providers: [KpiSlaService, MonitorService, SlaComputationService, PhHolidayService, HolidaySeederService, PeriodKpiSeederService],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestContextMiddleware).forRoutes('*');
    }
}