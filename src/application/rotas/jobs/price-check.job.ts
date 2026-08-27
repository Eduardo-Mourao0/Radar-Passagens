import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';
import { RegistrarHistoricoPrecoUseCase } from '../use-cases/registrar-historico-preco.use-case';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';

/**
 * Orquestra as verificações periódicas; regras de negócio permanecem nos use cases.
 */
@Injectable()
export class PriceCheckJob {
  private static readonly CONCORRENCIA_MAXIMA = 5;

  private readonly logger = new Logger(PriceCheckJob.name);

  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    @Inject(CONSULTAR_PRECOS_VOO)
    private readonly consultarPrecosVoo: ConsultarPrecosVoo,
    private readonly registrarHistoricoPreco: RegistrarHistoricoPrecoUseCase,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async executar(): Promise<void> {
    const rotasPendentes = [...(await this.rotasRepository.listarAtivas())];
    const quantidadeDeTrabalhadores = Math.min(
      PriceCheckJob.CONCORRENCIA_MAXIMA,
      rotasPendentes.length,
    );

    await Promise.all(
      Array.from({ length: quantidadeDeTrabalhadores }, () =>
        this.processarRotasPendentes(rotasPendentes),
      ),
    );
  }

  private async processarRotasPendentes(
    rotasPendentes: Awaited<ReturnType<RotasRepository['listarAtivas']>>,
  ): Promise<void> {
    while (rotasPendentes.length > 0) {
      const rota = rotasPendentes.shift();
      if (!rota) return;

      await this.verificarRota(rota);
    }
  }

  private async verificarRota(
    rota: Awaited<ReturnType<RotasRepository['listarAtivas']>>[number],
  ): Promise<void> {
    try {
      const cotacao = await this.consultarPrecosVoo.consultarMenorPreco(rota);

      if (!cotacao) {
        this.logger.log(
          JSON.stringify({
            evento: 'nenhuma_oferta_encontrada',
            rotaId: rota.id,
          }),
        );
        return;
      }

      const resultado = await this.registrarHistoricoPreco.execute({
        rotaId: rota.id,
        ...cotacao,
      });

      this.logger.log(
        JSON.stringify({
          evento: 'verificacao_preco_concluida',
          rotaId: rota.id,
          historicoRegistrado: resultado.registrado,
        }),
      );
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_falhou',
          rotaId: rota.id,
        }),
      );
    }
  }
}
