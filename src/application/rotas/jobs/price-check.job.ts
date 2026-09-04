import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ROTAS_REPOSITORY } from '../../../domain/rotas/repositories/rotas.repository';
import type { RotasRepository } from '../../../domain/rotas/repositories/rotas.repository';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { Usuario } from '../../../domain/usuarios/entities/usuario.entity';
import type { HistoricoPreco } from '../../../domain/rotas/entities/rota.entity';
import { VerificarPrecoRotaUseCase } from '../use-cases/verificar-preco-rota.use-case';

const FUSO_HORARIO_BRASILIA = 'America/Sao_Paulo';
const CRON_DUAS_VEZES_AO_DIA = '0 0,12 * * *';
const CRON_CADA_MINUTO = '0 * * * * *';

export type ResultadoVerificacaoDaRota = Readonly<{
  rotaId: string;
  situacao: 'ATUALIZADA' | 'SEM_OFERTA' | 'INDISPONIVEL';
  ultimoPreco: HistoricoPreco | null;
}>;

export type OpcoesVerificacaoPrecos = Readonly<{
  repetirLinks?: boolean;
}>;

/**
 * Orquestra as verificações periódicas; regras de negócio permanecem nos use cases.
 */
@Injectable()
export class PriceCheckJob {
  private static readonly CONCORRENCIA_MAXIMA = 5;

  private readonly logger = new Logger(PriceCheckJob.name);
  private retentativasEmAndamento = false;

  constructor(
    @Inject(ROTAS_REPOSITORY) private readonly rotasRepository: RotasRepository,
    private readonly verificarPrecoRota: VerificarPrecoRotaUseCase,
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
  ) {}

  @Cron(CRON_DUAS_VEZES_AO_DIA, {
    timeZone: FUSO_HORARIO_BRASILIA,
  })
  async executar(
    opcoes: OpcoesVerificacaoPrecos = {},
  ): Promise<ResultadoVerificacaoDaRota[]> {
    const repetirLinks = opcoes.repetirLinks ?? true;
    const inicioDeHoje = new Date();
    inicioDeHoje.setHours(0, 0, 0, 0);

    const rotasDesativadas =
      await this.rotasRepository.desativarRotasComDataIdaPassada(inicioDeHoje);
    if (rotasDesativadas > 0) {
      this.logger.log(
        JSON.stringify({
          evento: 'rotas_com_data_ida_passada_desativadas',
          quantidade: rotasDesativadas,
        }),
      );
    }

    const rotasPendentes = [...(await this.rotasRepository.listarAtivas())];
    this.logger.log(
      JSON.stringify({
        evento: 'verificacao_precos_iniciada',
        quantidadeRotas: rotasPendentes.length,
      }),
    );
    const usuarios = await this.usuariosRepository.buscarPorIds([
      ...new Set(rotasPendentes.map((rota) => rota.usuarioId)),
    ]);
    const usuariosPorId = new Map(
      usuarios.map((usuario) => [usuario.id, usuario]),
    );
    const quantidadeDeTrabalhadores = Math.min(
      PriceCheckJob.CONCORRENCIA_MAXIMA,
      rotasPendentes.length,
    );

    const resultados = (
      await Promise.all(
        Array.from({ length: quantidadeDeTrabalhadores }, () =>
          this.processarRotasPendentes(
            rotasPendentes,
            usuariosPorId,
            repetirLinks,
          ),
        ),
      )
    ).flat();
    this.logger.log(JSON.stringify({ evento: 'verificacao_precos_concluida' }));

    return resultados;
  }

  @Cron(CRON_CADA_MINUTO, {
    timeZone: FUSO_HORARIO_BRASILIA,
  })
  async executarRetentativas(): Promise<void> {
    if (this.retentativasEmAndamento) return;

    this.retentativasEmAndamento = true;
    try {
      const rotasPendentes = [
        ...(await this.rotasRepository.listarComRetentativaCotacaoPendente(
          new Date(),
          PriceCheckJob.CONCORRENCIA_MAXIMA,
        )),
      ];
      if (rotasPendentes.length === 0) return;

      this.logger.log(
        JSON.stringify({
          evento: 'retentativas_cotacao_iniciadas',
          quantidadeRotas: rotasPendentes.length,
        }),
      );
      const usuarios = await this.usuariosRepository.buscarPorIds([
        ...new Set(rotasPendentes.map((rota) => rota.usuarioId)),
      ]);
      const usuariosPorId = new Map(
        usuarios.map((usuario) => [usuario.id, usuario]),
      );
      const quantidadeDeTrabalhadores = Math.min(
        PriceCheckJob.CONCORRENCIA_MAXIMA,
        rotasPendentes.length,
      );

      await Promise.all(
        Array.from({ length: quantidadeDeTrabalhadores }, () =>
          this.processarRotasPendentes(rotasPendentes, usuariosPorId, false),
        ),
      );
      this.logger.log(
        JSON.stringify({ evento: 'retentativas_cotacao_concluidas' }),
      );
    } catch {
      this.logger.error(
        JSON.stringify({ evento: 'retentativas_cotacao_falharam' }),
      );
    } finally {
      this.retentativasEmAndamento = false;
    }
  }

  private async processarRotasPendentes(
    rotasPendentes: Awaited<ReturnType<RotasRepository['listarAtivas']>>,
    usuariosPorId: ReadonlyMap<string, Usuario>,
    repetirLinks: boolean,
  ): Promise<ResultadoVerificacaoDaRota[]> {
    const resultados: ResultadoVerificacaoDaRota[] = [];

    while (rotasPendentes.length > 0) {
      const rota = rotasPendentes.shift();
      if (!rota) break;

      const usuario = usuariosPorId.get(rota.usuarioId);
      if (!usuario) {
        this.logger.warn(
          JSON.stringify({
            evento: 'usuario_da_rota_nao_encontrado',
            rotaId: rota.id,
            usuarioId: rota.usuarioId,
          }),
        );
      }

      resultados.push(await this.verificarRota(rota, usuario, repetirLinks));
    }

    return resultados;
  }

  private async verificarRota(
    rota: Awaited<ReturnType<RotasRepository['listarAtivas']>>[number],
    usuario: Usuario | undefined,
    repetirLinks: boolean,
  ): Promise<ResultadoVerificacaoDaRota> {
    try {
      const resultado = await this.verificarPrecoRota.execute(
        rota,
        usuario,
        repetirLinks,
      );

      if (!resultado.ofertaEncontrada) {
        this.logger.log(
          JSON.stringify({
            evento: 'nenhuma_oferta_encontrada',
            rotaId: rota.id,
          }),
        );
        return {
          rotaId: rota.id,
          situacao: 'SEM_OFERTA',
          ultimoPreco: null,
        };
      }

      this.logger.log(
        JSON.stringify({
          evento: 'verificacao_preco_concluida',
          rotaId: rota.id,
          historicoRegistrado: resultado.historicoRegistrado,
        }),
      );
      return {
        rotaId: rota.id,
        situacao: 'ATUALIZADA',
        ultimoPreco: resultado.historico,
      };
    } catch {
      this.logger.error(
        JSON.stringify({
          evento: 'verificacao_preco_falhou',
          rotaId: rota.id,
        }),
      );
      return {
        rotaId: rota.id,
        situacao: 'INDISPONIVEL',
        ultimoPreco: null,
      };
    }
  }
}
