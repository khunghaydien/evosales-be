import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773805190912 implements MigrationInterface {
  name = "AutoMigration1773805190912";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "page_id" text NOT NULL, "access_tokens" text array NOT NULL, "sale_prompt" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8f21ed625aa34c8391d636b7d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_embeddings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "page_id" text, "chunk" text NOT NULL, "embedding" vector, CONSTRAINT "PK_c02764999fef01fb7fe5148a32a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_98ceb5433a66707b9c649503dce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_98ceb5433a66707b9c649503dce"`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_embeddings"`);
    await queryRunner.query(`DROP TABLE "pages"`);
  }
}
