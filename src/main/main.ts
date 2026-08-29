import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const ambiente = configService.get<string>('NODE_ENV', 'development');
  const origemPermitida =
    ambiente === 'production'
      ? configService.getOrThrow<string>('FRONTEND_URL')
      : 'http://localhost:5173';

  app.enableCors({ origin: origemPermitida });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
