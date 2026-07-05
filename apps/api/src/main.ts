import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: webOrigin,
    credentials: true
  });
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`Chat An Danh API dang chay o http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
