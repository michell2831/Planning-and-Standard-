import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PartialUniqueDraftPerOfficePeriod
 *
 * TT2 migration: replaces the full-table unique constraint
 * "uq_commitment_office_period_draft" on (office, period_id) with a
 * partial unique index scoped to status = 'Draft' only.
 *
 * Problem: the original @Unique decorator materialised a full-table
 * constraint, so requestRevision() — which inserts a new Draft for a
 * (office, period_id) pair that already has a Locked record — failed
 * with a Postgres duplicate-key error instead of succeeding.
 *
 * Fix (up): drop the constraint, create a partial unique index with
 *   WHERE "status" = 'Draft'
 * so multiple rows can share (office, period_id) as long as at most
 * one of them has status = 'Draft'.
 *
 * Rollback (down): drop the partial index, restore the original
 * full-table constraint. Tested path — exists so a hotfix rollback has
 * a documented, reversible route.
 */
export class PartialUniqueDraftPerOfficePeriod1788407300000 implements MigrationInterface {
  name = 'PartialUniqueDraftPerOfficePeriod1788407300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "commitment" DROP CONSTRAINT IF EXISTS "uq_commitment_office_period_draft";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_commitment_office_period_draft"
      ON "commitment" ("office", "period_id")
      WHERE "status" = 'Draft';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_commitment_office_period_draft";`);
    await queryRunner.query(`
      ALTER TABLE "commitment"
      ADD CONSTRAINT "uq_commitment_office_period_draft" UNIQUE ("office", "period_id");
    `);
  }
}
