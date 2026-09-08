import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MockOfficeSeeder } from '../seeds/mock-office.seeder';

@Injectable()
export class MockOfficeSeederService implements OnApplicationBootstrap {
    private readonly logger = new Logger(MockOfficeSeederService.name);

    constructor(
        @InjectDataSource('commitment_db')
        private readonly dataSource: DataSource,
    ) { }

    async onApplicationBootstrap(): Promise<void> {
        if (process.env.SEED_COMMITMENT === 'false') {
            this.logger.log('SEED_COMMITMENT is false. Skipping commitment seeder.');
            return;
        }

        try {
            const countResult = await this.dataSource.query('SELECT count(*) FROM "commitment"');
            const count = Number(countResult[0]?.count || 0);

            if (count === 0 || process.env.FORCE_SEED === 'true') {
                this.logger.log('No commitment records found. Running MockOfficeSeeder...');
                await MockOfficeSeeder.run(this.dataSource);
                this.logger.log('MockOfficeSeeder completed successfully.');
            } else {
                this.logger.log(`Commitment table already has ${count} records. Skipping mock office seeder.`);
            }
        } catch (err) {
            this.logger.error('Failed to auto-seed mock office commitments:', err);
        }
    }
}
