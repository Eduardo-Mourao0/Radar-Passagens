import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { HistoricoPrecoEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { RegistrarHistoricoPrecoCommand } from '../commands/registrar-historico-preco.command';

@Injectable()
export class RegistrarHistoricoPrecoUseCase {
  constructor(@Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository) {}

  async execute(comando: RegistrarHistoricoPrecoCommand) {
    const rota = await this.rotasRepository.buscarPorId(comando.rotaId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    const novoHistorico = HistoricoPrecoEntity.criar(comando);

    const ultimoHistorico = await this.rotasRepository.buscarUltimoHistorico(rota.id);
    if (
      ultimoHistorico &&
      ultimoHistorico.preco === novoHistorico.preco &&
      ultimoHistorico.moeda === novoHistorico.moeda &&
      ultimoHistorico.companhia === novoHistorico.companhia
    ) {
      return { registrado: false };
    }

    return { registrado: true, historico: await this.rotasRepository.criarHistorico(novoHistorico) };
  }
}
