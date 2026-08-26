import { Module } from '@nestjs/common';
import { RotasController } from './rotas.controller';
import { RotasService } from './rotas.service';
import { PriceCheckJob } from './jobs/price-check.job';

@Module({
  controllers: [RotasController],
  providers: [RotasService, PriceCheckJob],
})
export class RotasModule {}
