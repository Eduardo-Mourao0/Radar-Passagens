import { NestFactory } from '@nestjs/core';
import { RegraDeNegocioExceptionFilter } from '../infra/http/filters/regra-de-negocio-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalFilters(new RegraDeNegocioExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
