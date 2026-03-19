import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@app/database";
import { CoreModule } from "@app/core";
import { UsersService } from "apps/api/src/users/users.service";
import { PagesService } from "apps/api/src/pages/pages.service";
import { PagesRepository } from "@app/database";
import { EveController } from "./eve.controller";
import { EveService } from "./eve.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(),
    CoreModule,
  ],
  controllers: [EveController],
  providers: [EveService, UsersService, PagesService, PagesRepository],
})
export class EveModule {}
