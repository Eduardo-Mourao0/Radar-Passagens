import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  HistoricoPreco,
  Rota,
  SituacaoCotacao,
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

export type SituacaoCotacaoInicial = SituacaoCotacao;

export type RotaComSituacaoCotacao = Rota &
  Readonly<{ situacaoCotacao: SituacaoCotacaoInicial }>;

export type RotaComCotacaoAtualizada = RotaComSituacaoCotacao &
  Readonly<{ ultimoPreco: HistoricoPreco | null }>;

@Injectable()
export class VerificarPrecoRotaUseCase {
  private readonly logger = new Logger(VerificarPrecoRotaUseCase.name);

  private static readonly INTERVALOS_RETENTATIVA_MS = [
    60_000,
    60_000,
    5 * 60_000,
    15 * 60_000,
  ] as const;

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
    try {
      const cotacao = await this.consultarPrecosVoo.consultarMenorPreco(
        rota,
        repetirLinks ? undefined : { repetirLinks: false },
      );
      if (!cotacao) {
        await this.atualizarSituacaoCotacao(rota, 'SEM_OFERTA');
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
      await this.atualizarSituacaoCotacao(rota, 'ATUALIZADA');

      return {
        ofertaEncontrada: true,
        historicoRegistrado: resultado.registrado,
        historico: resultado.historico,
      };
    } catch (erro: unknown) {
      try {
        await this.atualizarSituacaoCotacao(rota, 'INDISPONIVEL');
      } catch {
        this.logger.error(
          JSON.stringify({
            evento: 'atualizacao_situacao_cotacao_falhou',
            rotaId: rota.id,
          }),
        );
      }
      throw erro;
    }
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
      const resultado = await this.execute(rota, usuario, false);
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

  private async atualizarSituacaoCotacao(
    rota: Rota,
    situacaoCotacao: SituacaoCotacao,
  ): Promise<void> {
    const tentativasCotacao =
      situacaoCotacao === 'INDISPONIVEL' ? rota.tentativasCotacao + 1 : 0;
    const intervaloRetentativa =
      VerificarPrecoRotaUseCase.INTERVALOS_RETENTATIVA_MS[
        tentativasCotacao - 1
      ];
    const ultimaCotacaoEm = new Date();

    await this.rotasRepository.atualizarSituacaoCotacao(rota.id, {
      situacaoCotacao,
      ultimaCotacaoEm,
      tentativasCotacao,
      proximaTentativaCotacaoEm:
        intervaloRetentativa === undefined
          ? null
          : new Date(ultimaCotacaoEm.getTime() + intervaloRetentativa),
    });
  }
}
