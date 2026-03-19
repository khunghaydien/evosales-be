import { DynamicModule, Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseService } from "./database.service";
import * as dotenv from "dotenv";
import { DATABASE_ENTITIES } from "./entities";

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    dotenv.config();
    const url = process.env.DATABASE_URL ?? "";
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          url,
          entities: [...DATABASE_ENTITIES],
          synchronize: false,
          logging: false,
        }),
        TypeOrmModule.forFeature([...DATABASE_ENTITIES]),
      ],
      providers: [DatabaseService],
      exports: [TypeOrmModule, DatabaseService],
    };
  }
}
