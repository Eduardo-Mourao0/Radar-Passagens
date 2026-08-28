import { Module } from '@nestjs/common';
import { PriceCheckJob } from '../../application/rotas/jobs/price-check.job';
import { CONSULTAR_PRECOS_VOO } from '../../application/rotas/ports/consultar-precos-voo.port';
import { NOTIFICADOR_ALERTA_PRECO } from '../../application/rotas/ports/notificador-alerta-preco.port';
import { CriarRotaUseCase } from '../../application/rotas/use-cases/criar-rota.use-case';
import { DesativarRotaUseCase } from '../../application/rotas/use-cases/desativar-rota.use-case';
import { AvaliarAlertaPrecoUseCase } from '../../application/rotas/use-cases/avaliar-alerta-preco.use-case';
import { ConfigurarAlertaPrecoUseCase } from '../../application/rotas/use-cases/configurar-alerta-preco.use-case';
import { ListarHistoricoRotaUseCase } from '../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../application/rotas/use-cases/listar-rotas.use-case';
import { RegistrarHistoricoPrecoUseCase } from '../../application/rotas/use-cases/registrar-historico-preco.use-case';
import { ROTAS_REPOSITORY } from '../../domain/rotas/repositories/rotas.repository';
import { PrismaRotasRepository } from '../../infra/database/prisma/repositories/prisma-rotas.repository';
import { IgnavModule } from '../../infra/ignav/ignav.module';
import { IgnavService } from '../../infra/ignav/ignav.service';
import { RotasController } from '../../infra/http/controllers/rotas.controller';
import { NotificacoesModule } from '../../infra/notificacoes/notificacoes.module';
import { TelegramNotificadorAlertaPrecoService } from '../../infra/notificacoes/telegram-notificador-alerta-preco.service';

@Module({
  imports: [IgnavModule, NotificacoesModule],
  controllers: [RotasController],
  providers: [
    CriarRotaUseCase,
    DesativarRotaUseCase,
    ConfigurarAlertaPrecoUseCase,
    AvaliarAlertaPrecoUseCase,
    ListarRotasUseCase,
    ListarHistoricoRotaUseCase,
    RegistrarHistoricoPrecoUseCase,
    PrismaRotasRepository,
    {
      provide: ROTAS_REPOSITORY,
      useExisting: PrismaRotasRepository,
    },
    {
      provide: CONSULTAR_PRECOS_VOO,
      useExisting: IgnavService,
    },
    {
      provide: NOTIFICADOR_ALERTA_PRECO,
      useExisting: TelegramNotificadorAlertaPrecoService,
    },
    PriceCheckJob,
  ],
})
export class RotasModule {}
