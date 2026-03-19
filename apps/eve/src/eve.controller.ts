import { Controller, Get } from "@nestjs/common";

@Controller()
export class EveController {
  @Get("health")
  health() {
    return { ok: true, service: "eve" };
  }
}
