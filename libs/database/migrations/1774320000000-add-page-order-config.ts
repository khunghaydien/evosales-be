import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPageOrderConfig1774320000000 implements MigrationInterface {
  name = "AddPageOrderConfig1774320000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN "order_ship_config" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD COLUMN "order_collection_config" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN "order_collection_config"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP COLUMN "order_ship_config"`,
    );
  }
}
