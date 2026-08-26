import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AmadeusModule } from './amadeus/amadeus.module';
import { PrismaModule } from './prisma/prisma.module';
import { RotasModule } from './rotas/rotas.module';

@Module({
  imports: [PrismaModule, AmadeusModule, RotasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
