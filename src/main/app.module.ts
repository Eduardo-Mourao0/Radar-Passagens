import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '../infra/http/controllers/app.controller';
import { AppService } from '../infra/http/controllers/app.service';
import { AmadeusModule } from '../infra/amadeus/amadeus.module';
import { PrismaModule } from '../infra/database/prisma/prisma.module';
import { RotasModule } from './modules/rotas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    AmadeusModule,
    RotasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
