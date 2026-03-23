import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1774255833589 implements MigrationInterface {
  name = "AutoMigration1774255833589";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_created_at_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email_trgm"`);
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_status_enum" AS ENUM('never_messaged', 'order_info_collected', 'shipping_info_collected', 'sold')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "page_id" uuid NOT NULL, "external_conversation_id" text NOT NULL, "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'never_messaged', "order_info" jsonb, "shipping_info" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conversations_page_id_external_id" ON "conversations" ("page_id", "external_conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_page_id_status" ON "conversations" ("page_id", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_89071d2e94921ad47f9c5600c01" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_89071d2e94921ad47f9c5600c01"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_conversations_page_id_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_conversations_page_id_external_id"`,
    );
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email_trgm" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_name_trgm" ON "users" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_created_at_id" ON "users" ("created_at", "id") `,
    );
  }
}
