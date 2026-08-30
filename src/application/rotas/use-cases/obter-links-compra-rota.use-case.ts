import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';

@Injectable()
export class ObterLinksCompraRotaUseCase {
  constructor(
    @Inject(ROTAS_REPOSITORY)
    private readonly rotasRepository: RotasRepository,
    @Inject(CONSULTAR_PRECOS_VOO)
    private readonly consultarPrecosVoo: ConsultarPrecosVoo,
  ) {}

  async execute(rotaId: string, usuarioId: string) {
    if (!z.uuid().safeParse(rotaId).success) {
      throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);
    }

    const rota = await this.rotasRepository.buscarPorId(rotaId, usuarioId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    const [cotacao] = await this.rotasRepository.listarHistorico(
      rotaId,
      usuarioId,
    );
    if (!cotacao?.ignavId) {
      throw new NotFoundException(MENSAGENS_ERRO.linksCompraIndisponiveis);
    }

    return this.consultarPrecosVoo.obterLinksCompra(cotacao.ignavId);
  }
}
