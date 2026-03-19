import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PancakeSocketService } from "@app/core";
import { UsersService } from "apps/api/src/users/users.service";
import { PagesService } from "apps/api/src/pages/pages.service";

@Injectable()
export class EveService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly pancakeSocketService: PancakeSocketService,
    private readonly usersService: UsersService,
    private readonly pagesService: PagesService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.resolveEveUserEmail();
    if (!email) {
      // eslint-disable-next-line no-console
      console.warn(
        "EVE_USER_EMAIL or SUPPORTED_USERS is not set — Pancake socket will not start.",
      );
      return;
    }
    await this.startForEmail(email);
  }

  private resolveEveUserEmail(): string | undefined {
    const direct = this.configService.get<string>("EVE_USER_EMAIL")?.trim();
    if (direct) {
      return direct;
    }
    const supported = this.configService.get<string>("SUPPORTED_USERS")?.trim();
    if (!supported) {
      return undefined;
    }
    const first = supported.split(",")[0]?.trim();
    return first || undefined;
  }

  async startForEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // eslint-disable-next-line no-console
      console.log(`User not found for email ${email}`);
      return;
    }

    const pages = await this.pagesService.findAllForUser(user.id);
    if (!pages.length) {
      // eslint-disable-next-line no-console
      console.log(`No pages configured for user ${email}`);
      return;
    }

    const accessTokens = pages.flatMap((p) => p.accessTokens || []);

    if (!accessTokens.length) {
      // eslint-disable-next-line no-console
      console.log(`No access tokens for user ${email}`);
      return;
    }

    const pagePrompts: Record<string, string | null> = {};
    for (const page of pages) {
      pagePrompts[page.pageId] = page.salePrompt ?? null;
    }

    // eslint-disable-next-line no-console
    console.log(
      `Starting Pancake socket for user ${email} with ${pages.length} pages`,
    );

    await this.pancakeSocketService.connectWebSocket(accessTokens, pagePrompts);
  }
}
