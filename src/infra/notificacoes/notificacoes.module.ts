import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TelegramNotificadorAlertaPrecoService } from './telegram-notificador-alerta-preco.service';

@Module({
  imports: [HttpModule],
  providers: [TelegramNotificadorAlertaPrecoService],
  exports: [TelegramNotificadorAlertaPrecoService],
})
export class NotificacoesModule {}
