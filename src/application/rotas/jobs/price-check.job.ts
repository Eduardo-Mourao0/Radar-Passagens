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
  private readonly logger = new Logger(PriceCheckJob.name);

  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    @Inject(CONSULTAR_PRECOS_VOO)
    private readonly consultarPrecosVoo: ConsultarPrecosVoo,
    private readonly registrarHistoricoPreco: RegistrarHistoricoPrecoUseCase,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async executar(): Promise<void> {
    const rotas = await this.rotasRepository.listarAtivas();

    for (const rota of rotas) {
      try {
        const cotacao = await this.consultarPrecosVoo.consultarMenorPreco(rota);

        if (!cotacao) {
          this.logger.warn(
            JSON.stringify({
              evento: 'nenhuma_oferta_encontrada',
              rotaId: rota.id,
            }),
          );
          continue;
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
}
