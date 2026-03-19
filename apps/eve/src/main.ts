import { NestFactory } from "@nestjs/core";
import { EveModule } from "./eve.module";
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(EveModule);
  const port = Number(process.env.EVE_PORT ?? process.env.PORT) || 3100;
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(
    `Eve running — Pancake socket starts via EveService; health http://0.0.0.0:${port}/health`,
  );
}

void bootstrap();
