import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { Commitment } from './database/commitment.entity';
import { CommitmentItem } from './database/commitment-item.entity';
import { CommitmentVersion } from './database/commitment-version.entity';
import { PendingAuditEvent } from './database/pending-audit-event.entity';
import { CommitmentController } from './controller/commitment.controller';
import { DashboardController } from './controller/dashboard.controller';
import { AuditController } from './controller/audit.controller';
import { CommitmentService } from './service/commitment.service';
import { DashboardService } from './service/dashboard-data.service';
import { AuditService } from './service/audit.service';
import { AuditDispatcherService } from './service/audit-dispatcher.service';
import { KafkaAuditProducer } from '../../common/kafka/kafka-audit.producer';
import { RequestContextMiddleware } from '../../common/context/request-context';

import { CommitmentSeederService } from './service/commitment-seeder.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        HttpModule,
        TypeOrmModule.forRootAsync({
            name: 'commitment_db',
            imports: [ConfigModule],
            useFactory: (config: ConfigService): TypeOrmModuleOptions => {
                const dbUrl = config.get<string>('DATABASE_URL');
                const useSsl = config.get('DB_SSL') === 'true' || (dbUrl && (dbUrl.includes('railway') || dbUrl.includes('render')));

                if (dbUrl) {
                    return {
                        type: 'postgres',
                        name: 'commitment_db',
                        url: dbUrl,
                        entities: [Commitment, CommitmentItem, CommitmentVersion, PendingAuditEvent],
                        migrations: [__dirname + '/database/migrations/*.{ts,js}'],
                        migrationsTableName: 'typeorm_migrations',
                        synchronize: true,
                        migrationsRun: true,
                        logging: config.get('NODE_ENV') !== 'production',
                        ssl: useSsl ? { rejectUnauthorized: false } : false,
                    };
                }

                return {
                    type: 'postgres',
                    name: 'commitment_db',
                    host: config.get<string>('DB_HOST') || 'localhost',
                    port: Number(config.get('DB_PORT') || 5432),
                    username: config.get<string>('DB_USERNAME') || 'postgres',
                    password: String(config.get('DB_PASSWORD') || ''),
                    database: String(config.get<string>('DB_NAME') || 'commitment-db'),
                    entities: [Commitment, CommitmentItem, CommitmentVersion, PendingAuditEvent],
                    migrations: [__dirname + '/database/migrations/*.{ts,js}'],
                    migrationsTableName: 'typeorm_migrations',
                    synchronize: true,
                    migrationsRun: true,
                    logging: config.get('NODE_ENV') !== 'production',
                    ssl: useSsl ? { rejectUnauthorized: false } : false,
                };
            },
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature(
            [Commitment, CommitmentItem, CommitmentVersion, PendingAuditEvent],
            'commitment_db',
        ),
    ],
    controllers: [CommitmentController, DashboardController, AuditController],
    providers: [
        CommitmentService,
        DashboardService,
        AuditService,
        AuditDispatcherService,
        KafkaAuditProducer,
        CommitmentSeederService,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(RequestContextMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}