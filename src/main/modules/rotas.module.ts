import { Module } from '@nestjs/common';
import { PriceCheckJob } from '../../application/rotas/jobs/price-check.job';
import { CriarRotaUseCase } from '../../application/rotas/use-cases/criar-rota.use-case';
import { ListarHistoricoRotaUseCase } from '../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../application/rotas/use-cases/listar-rotas.use-case';
import { RegistrarHistoricoPrecoUseCase } from '../../application/rotas/use-cases/registrar-historico-preco.use-case';
import { ROTAS_REPOSITORY } from '../../domain/rotas/repositories/rotas.repository';
import { PrismaRotasRepository } from '../../infra/database/prisma/repositories/prisma-rotas.repository';
import { RotasController } from '../../infra/http/controllers/rotas.controller';

@Module({
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
    PriceCheckJob,
  ],
})
export class RotasModule {}
