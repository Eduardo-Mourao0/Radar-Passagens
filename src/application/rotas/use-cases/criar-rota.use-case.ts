import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CriarRotaCommand } from '../commands/criar-rota.command';
import { VerificarPrecoRotaUseCase } from './verificar-preco-rota.use-case';

@Injectable()
export class CriarRotaUseCase {
  private readonly logger = new Logger(CriarRotaUseCase.name);

  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
  ) {}

  async execute(comando: CriarRotaCommand) {
    const novaRota = {
      ...RotaEntity.criarNova(comando),
      usuarioId: comando.usuarioId,
    };

    const rotaExistente = await this.rotasRepository.buscarPorChave(
      comando.usuarioId,
      novaRota.chaveMonitoramento,
    );

    if (rotaExistente) {
      if (!rotaExistente.ativa) {
        const rotaReativada = await this.rotasRepository.reativar(
          rotaExistente.id,
          comando.usuarioId,
        );
        await this.verificarPreco(rotaReativada);
        return rotaReativada;
      }

      throw new ConflictException(MENSAGENS_ERRO.rotaDuplicada);
    }

    const rotaCriada = await this.rotasRepository.criar(novaRota);
    await this.verificarPreco(rotaCriada);
    return rotaCriada;
  }

  private async verificarPreco(
    rota: Awaited<ReturnType<RotasRepository['criar']>>,
  ): Promise<void> {
    try {
      await this.verificarPrecoRota.execute(rota);
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_imediata_falhou',
          rotaId: rota.id,
        }),
      );
    }
  }
}
