import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { AlertaPrecoEntity } from '../../../domain/rotas/entities/rota.entity';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { ConfigurarAlertaPrecoCommand } from '../commands/configurar-alerta-preco.command';
import { AvaliarAlertaPrecoUseCase } from './avaliar-alerta-preco.use-case';

@Injectable()
export class ConfigurarAlertaPrecoUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    private readonly avaliarAlertaPrecoUseCase: AvaliarAlertaPrecoUseCase,
  ) {}

  async execute(comando: ConfigurarAlertaPrecoCommand) {
    const rota = await this.rotasRepository.buscarPorId(
      comando.rotaId,
      comando.usuarioId,
    );
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    const alerta = AlertaPrecoEntity.criar(comando);

    const alertaSalvo = await this.rotasRepository.salvarAlertaPreco(alerta);
    const [ultimoHistorico] = await this.rotasRepository.listarHistorico(
      rota.id,
      comando.usuarioId,
    );

    if (ultimoHistorico) {
      await this.avaliarAlertaPrecoUseCase.execute(rota, ultimoHistorico);
    }

    return alertaSalvo;
  }
}
