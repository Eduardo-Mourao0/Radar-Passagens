import { Module } from '@nestjs/common';
import { PriceCheckJob } from '../../application/rotas/jobs/price-check.job';
import { CONSULTAR_PRECOS_VOO } from '../../application/rotas/ports/consultar-precos-voo.port';
import { CriarRotaUseCase } from '../../application/rotas/use-cases/criar-rota.use-case';
import { ListarHistoricoRotaUseCase } from '../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../application/rotas/use-cases/listar-rotas.use-case';
import { RegistrarHistoricoPrecoUseCase } from '../../application/rotas/use-cases/registrar-historico-preco.use-case';
import { ROTAS_REPOSITORY } from '../../domain/rotas/repositories/rotas.repository';
import { PrismaRotasRepository } from '../../infra/database/prisma/repositories/prisma-rotas.repository';
import { AmadeusModule } from '../../infra/amadeus/amadeus.module';
import { AmadeusService } from '../../infra/amadeus/amadeus.service';
import { RotasController } from '../../infra/http/controllers/rotas.controller';

@Module({
  imports: [AmadeusModule],
  controllers: [RotasController],
  providers: [
    CriarRotaUseCase,
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
      useExisting: AmadeusService,
    },
    PriceCheckJob,
  ],
})
export class RotasModule {}
