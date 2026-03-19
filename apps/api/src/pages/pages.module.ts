import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PageEntity } from "@app/database/entities/page.entity";
import { PagesRepository } from "@app/database";
import { PagesService } from "./pages.service";
import { PagesController } from "./pages.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PageEntity])],
  providers: [PagesService, PagesRepository],
  controllers: [PagesController],
})
export class PagesModule {}
