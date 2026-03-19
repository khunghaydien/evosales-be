import { Injectable } from "@nestjs/common";
import { PagesRepository } from "@app/database";
import { CreatePageDto } from "./dto/create-page.dto";
import { UpdatePageDto } from "./dto/update-page.dto";

@Injectable()
export class PagesService {
  constructor(private readonly pagesRepo: PagesRepository) {}

  createForUser(userId: string, dto: CreatePageDto) {
    return this.pagesRepo.createForUser(userId, {
      pageId: dto.pageId,
      accessTokens: dto.accessTokens,
      salePrompt: dto.salePrompt,
    });
  }

  findAllForUser(userId: string) {
    return this.pagesRepo.findAllForUser(userId);
  }

  findOne(id: string) {
    return this.pagesRepo.findOne(id);
  }

  updateForUser(userId: string, id: string, dto: UpdatePageDto) {
    return this.pagesRepo.updateForUser(userId, id, {
      accessTokens: dto.accessTokens,
      salePrompt: dto.salePrompt,
    });
  }

  removeForUser(userId: string, id: string) {
    return this.pagesRepo.removeForUser(userId, id);
  }
}
