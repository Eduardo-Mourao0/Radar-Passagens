import { Module } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';

@Module({
  providers: [AmadeusService],
  exports: [AmadeusService],
})
export class AmadeusModule {}
