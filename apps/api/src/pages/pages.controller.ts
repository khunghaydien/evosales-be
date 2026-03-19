import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { PagesService } from "./pages.service";
import { CreatePageDto } from "./dto/create-page.dto";
import { UpdatePageDto } from "./dto/update-page.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
@Controller("pages")
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    const user = req.user as any;
    return this.pagesService.findAllForUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreatePageDto) {
    const user = req.user as any;
    return this.pagesService.createForUser(user.id, dto);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.pagesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdatePageDto,
  ) {
    const user = req.user as any;
    return this.pagesService.updateForUser(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  remove(@Req() req: Request, @Param("id") id: string) {
    const user = req.user as any;
    return this.pagesService.removeForUser(user.id, id);
  }
}
