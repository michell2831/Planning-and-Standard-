import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './database/service.entity';
import { ServiceVersion } from './database/service-version.entity';
import { IntakeField } from './database/service-intake-field.entity';
import { NaFlag } from './database/service-na-flag.entity';
import { ServiceCatalogueController } from './controller/service-catalogue.controller';
import { ServiceCatalogueService } from './service/service-catalogue.service';
import { ServiceMode } from './database/service-mode.entity';
import { ServiceModeController } from './controller/service-mode.controller';
import { ServiceModeService } from './service/service-mode.service';
import { HttpModule } from '@nestjs/axios';
import { RequestContextMiddleware } from '../../common/context/request-context';

import { CatalogueSeederService } from './service/catalogue-seeder.service';

@Module({
  imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule,
    TypeOrmModule.forRootAsync({
      name: 'catalogue_db',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL');
        const useSsl = config.get('DB_SSL') === 'true' || (dbUrl && (dbUrl.includes('railway') || dbUrl.includes('render')));

        const baseConfig = {
          type: 'postgres' as const,
          name: 'catalogue_db',
          entities: [Service, ServiceVersion, IntakeField, NaFlag, ServiceMode],
          synchronize: false,
          migrations: [__dirname + '/database/migrations/*.{ts,js}'],
          migrationsTableName: 'typeorm_migrations',
          migrationsRun: true,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        };

        if (dbUrl) {
          return {
            ...baseConfig,
            url: dbUrl,
          };
        }

        return {
          ...baseConfig,
          host:     config.get('DB_HOST') || 'localhost',
          port:     config.get<number>('DB_PORT') || 5432,
          username: config.get('DB_USERNAME') || 'postgres',
          password: String(config.get('DB_PASSWORD') || ''),
          database: config.get('DB_NAME') || 'service-catalogue-db',
        };
      },
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([Service, ServiceVersion, IntakeField, NaFlag, ServiceMode], 'catalogue_db'),
  ],
  controllers: [ServiceCatalogueController, ServiceModeController],
  providers: [ServiceCatalogueService, ServiceModeService, CatalogueSeederService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
