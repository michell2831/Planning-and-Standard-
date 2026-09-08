import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActorRoleToPendingAuditEvent1788407400000 implements MigrationInterface {
  name = 'AddActorRoleToPendingAuditEvent1788407400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pending_audit_events'
      ) AS "exists";
    `);
    if (!tableExists?.[0]?.exists) {
      console.log('[Migration] Table "pending_audit_events" does not exist yet — skipping AddActorRoleToPendingAuditEvent.');
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "pending_audit_events"
      ADD COLUMN IF NOT EXISTS "actor_role" VARCHAR(50) NULL;
    `);

    // Backfill existing rows from the metadata JSONB stopgap, so history
    // isn't lost for events logged before this column existed.
    await queryRunner.query(`
      UPDATE "pending_audit_events"
      SET "actor_role" = "metadata" ->> 'actor_role'
      WHERE "actor_role" IS NULL
        AND "metadata" ->> 'actor_role' IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_audit_events" DROP COLUMN IF EXISTS "actor_role";
    `);
  }
}
