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
import { CatalogueSeederService } from './service/catalogue-seeder.service';
import { HttpModule } from '@nestjs/axios';
import { RequestContextMiddleware } from '../../common/context/request-context';

@Module({
  imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule,
    TypeOrmModule.forRootAsync({
      name: 'catalogue_db',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        name: 'catalogue_db',
        host:     config.get('DB_HOST'),
        port:     config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
          password: String(config.get('DB_PASSWORD')),
        database: config.get('DB_NAME'),
        entities: [Service, ServiceVersion, IntakeField, NaFlag, ServiceMode],
        // Migrations are now the source of truth for schema changes.
        // synchronize: false prevents TypeORM from auto-diffing entities on boot,
        // which would conflict with explicit migration runs.
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*.{ts,js}'],
        migrationsTableName: 'typeorm_migrations',
        migrationsRun: true,  // auto-apply pending migrations on startup
      }),
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
