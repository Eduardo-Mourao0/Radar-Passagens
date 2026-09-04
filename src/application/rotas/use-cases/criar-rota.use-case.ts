import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { Rota, RotaEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CriarRotaCommand } from '../commands/criar-rota.command';
import {
  RotaComSituacaoCotacao,
  VerificarPrecoRotaUseCase,
} from './verificar-preco-rota.use-case';

@Injectable()
export class CriarRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
  ) {}

  async execute(comando: CriarRotaCommand): Promise<RotaComSituacaoCotacao> {
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
        void this.verificarPreco(rotaReativada);
        return { ...rotaReativada, situacaoCotacao: 'PENDENTE' };
      }

      throw new ConflictException(MENSAGENS_ERRO.rotaDuplicada);
    }

    const rotaCriada = await this.rotasRepository.criar(novaRota);
    // A consulta pode levar minutos quando o provedor está instável; não bloqueie o cadastro.
    void this.verificarPreco(rotaCriada);
    return { ...rotaCriada, situacaoCotacao: 'PENDENTE' };
  }

  private async verificarPreco(rota: Rota): Promise<RotaComSituacaoCotacao> {
    const situacaoCotacao =
      await this.verificarPrecoRota.executarResiliente(rota);

    return { ...rota, situacaoCotacao };
  }
}
