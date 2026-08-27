import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AmadeusService } from './amadeus.service';

@Module({
  imports: [HttpModule],
  providers: [AmadeusService],
  exports: [AmadeusService],
})
export class AmadeusModule {}
