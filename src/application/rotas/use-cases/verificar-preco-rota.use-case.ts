import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  HistoricoPreco,
  Rota,
} from '../../../domain/rotas/entities/rota.entity';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import type { Usuario } from '../../../domain/usuarios/entities/usuario.entity';
import { CONSULTAR_PRECOS_VOO } from '../ports/consultar-precos-voo.port';
import type { ConsultarPrecosVoo } from '../ports/consultar-precos-voo.port';
import { RegistrarHistoricoPrecoUseCase } from './registrar-historico-preco.use-case';

export type ResultadoVerificacaoPreco = Readonly<{
  ofertaEncontrada: boolean;
  historicoRegistrado: boolean;
  historico: HistoricoPreco | null;
}>;

export type SituacaoCotacaoInicial =
  'ATUALIZADA' | 'SEM_OFERTA' | 'INDISPONIVEL' | 'NAO_SOLICITADA';

export type RotaComSituacaoCotacao = Rota &
  Readonly<{ situacaoCotacao: SituacaoCotacaoInicial }>;

export type RotaComCotacaoAtualizada = RotaComSituacaoCotacao &
  Readonly<{ ultimoPreco: HistoricoPreco | null }>;

@Injectable()
export class VerificarPrecoRotaUseCase {
  private readonly logger = new Logger(VerificarPrecoRotaUseCase.name);

  constructor(
    @Inject(CONSULTAR_PRECOS_VOO)
    private readonly consultarPrecosVoo: ConsultarPrecosVoo,
    private readonly registrarHistoricoPreco: RegistrarHistoricoPrecoUseCase,
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
  ) {}

  async execute(
    rota: Rota,
    usuario?: Usuario,
    repetirLinks = true,
  ): Promise<ResultadoVerificacaoPreco> {
    const cotacao = await this.consultarPrecosVoo.consultarMenorPreco(
      rota,
      repetirLinks ? undefined : { repetirLinks: false },
    );
    if (!cotacao) {
      return {
        ofertaEncontrada: false,
        historicoRegistrado: false,
        historico: null,
      };
    }

    const resultado = await this.registrarHistoricoPreco.execute(
      { rotaId: rota.id, ...cotacao },
      rota,
      usuario,
    );

    return {
      ofertaEncontrada: true,
      historicoRegistrado: resultado.registrado,
      historico: resultado.historico,
    };
  }

  async executarParaUsuario(
    rotaId: string,
    usuarioId: string,
  ): Promise<RotaComCotacaoAtualizada> {
    const rota = await this.rotasRepository.buscarPorId(rotaId, usuarioId);
    if (!rota) throw new NotFoundException(MENSAGENS_ERRO.rotaNaoEncontrada);

    try {
      const resultado = await this.execute(rota, undefined, false);
      return {
        ...rota,
        situacaoCotacao: resultado.ofertaEncontrada
          ? 'ATUALIZADA'
          : 'SEM_OFERTA',
        ultimoPreco: resultado.historico,
      };
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_manual_falhou',
          rotaId: rota.id,
        }),
      );
      return {
        ...rota,
        situacaoCotacao: 'INDISPONIVEL',
        ultimoPreco: null,
      };
    }
  }

  async executarResiliente(
    rota: Rota,
    usuario?: Usuario,
  ): Promise<SituacaoCotacaoInicial> {
    try {
      const resultado = await this.execute(rota, usuario);
      return resultado.ofertaEncontrada ? 'ATUALIZADA' : 'SEM_OFERTA';
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_imediata_falhou',
          rotaId: rota.id,
        }),
      );
      return 'INDISPONIVEL';
    }
  }
}
