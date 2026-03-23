import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { UpdateConversationDto } from "./dto/update-conversation.dto";
import { ConversationStatus } from "@app/database/entities/conversation.entity";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrUpdate(@Req() req: Request, @Body() dto: CreateConversationDto) {
    const user = req.user as any;
    return this.conversationsService.createOrUpdate(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listMine(
    @Req() req: Request,
    @Query("pageId") pageId?: string,
    @Query("status") status?: ConversationStatus,
  ) {
    const user = req.user as any;
    return this.conversationsService.listMine(user.id, { pageId, status });
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  detailMine(@Req() req: Request, @Param("id") id: string) {
    const user = req.user as any;
    return this.conversationsService.detailMine(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  updateMine(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const user = req.user as any;
    return this.conversationsService.updateMine(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  removeMine(@Req() req: Request, @Param("id") id: string) {
    const user = req.user as any;
    return this.conversationsService.removeMine(user.id, id);
  }
}
