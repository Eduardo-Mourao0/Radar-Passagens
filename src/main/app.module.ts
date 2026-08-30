import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '../infra/http/controllers/app.controller';
import { AppService } from '../infra/http/controllers/app.service';
import { PrismaModule } from '../infra/database/prisma/prisma.module';
import { IgnavModule } from '../infra/ignav/ignav.module';
import { RegraDeNegocioExceptionFilter } from '../infra/http/filters/regra-de-negocio-exception.filter';
import { RotasModule } from './modules/rotas.module';
import { AutenticacaoModule } from './modules/autenticacao.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    IgnavModule,
    AutenticacaoModule,
    RotasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: RegraDeNegocioExceptionFilter,
    },
  ],
})
export class AppModule {}
