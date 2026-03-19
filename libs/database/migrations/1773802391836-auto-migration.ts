import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773802391836 implements MigrationInterface {
  name = "AutoMigration1773802391836";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // enable uuid + trgm extensions (safe to run if they already exist)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text NOT NULL, "password" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "last_login" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );

    // composite index cho cursor pagination: sort theo created_at, id
    await queryRunner.query(
      `CREATE INDEX "IDX_users_created_at_id" ON "users" ("created_at" DESC, "id" DESC)`,
    );

    // index GIN dùng pg_trgm để search gần đúng trên name + email
    await queryRunner.query(
      `CREATE INDEX "IDX_users_name_trgm" ON "users" USING GIN ("name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email_trgm" ON "users" USING GIN ("email" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_created_at_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
