import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IgnavService } from './ignav.service';

@Module({
  imports: [HttpModule],
  providers: [IgnavService],
  exports: [IgnavService],
})
export class IgnavModule {}
