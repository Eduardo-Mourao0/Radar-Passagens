import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { SOLICITADOR_CONTATO_TELEGRAM } from '../ports/solicitador-contato-telegram.port';
import type { SolicitadorContatoTelegram } from '../ports/solicitador-contato-telegram.port';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { UsuarioEntity } from '../../../domain/usuarios/entities/usuario.entity';

type InicioTelegram = Readonly<{
  tokenInicio: string;
  chatId: string;
  telegramUsuarioId: string;
}>;

type ContatoTelegram = Readonly<{
  telefone: string;
  chatId: string;
  telegramUsuarioId: string;
  contatoUsuarioId?: string;
}>;

@Injectable()
export class ProcessarAtualizacaoTelegramUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    @Inject(SOLICITADOR_CONTATO_TELEGRAM)
    private readonly solicitadorContato: SolicitadorContatoTelegram,
  ) {}

  async iniciar({ tokenInicio, chatId, telegramUsuarioId }: InicioTelegram) {
    const verificacao =
      await this.usuariosRepository.buscarVerificacaoPorTokenInicio(
        tokenInicio,
      );
    if (
      !verificacao ||
      verificacao.consumidaEm ||
      verificacao.verificadaEm ||
      verificacao.expiraEm <= new Date()
    ) {
      return;
    }

    await this.usuariosRepository.vincularTelegramNaVerificacao(
      verificacao.id,
      chatId,
      telegramUsuarioId,
    );
    await this.solicitadorContato.solicitarContato(chatId);
  }

  async confirmarContato({
    telefone,
    chatId,
    telegramUsuarioId,
    contatoUsuarioId,
  }: ContatoTelegram) {
    if (contatoUsuarioId && contatoUsuarioId !== telegramUsuarioId) return;

    const verificacao =
      await this.usuariosRepository.buscarVerificacaoVinculadaAoTelegram(
        chatId,
        telegramUsuarioId,
      );
    if (
      !verificacao ||
      verificacao.consumidaEm ||
      verificacao.verificadaEm ||
      verificacao.expiraEm <= new Date()
    ) {
      return;
    }

    const telefoneNormalizado = UsuarioEntity.normalizarTelefone(
      telefone.startsWith('+') ? telefone : `+${telefone}`,
    );
    if (telefoneNormalizado !== verificacao.telefone) {
      throw new ConflictException(MENSAGENS_ERRO.telefoneTelegramDivergente);
    }

    if (verificacao.finalidade === 'CADASTRO') {
      const existente = await this.usuariosRepository.buscarPorTelefone(
        verificacao.telefone,
      );
      if (existente)
        throw new ConflictException(MENSAGENS_ERRO.telefoneJaCadastrado);
      if (!verificacao.senhaHash) return;
      await this.usuariosRepository.criar({
        telefone: verificacao.telefone,
        senhaHash: verificacao.senhaHash,
        telegramChatId: chatId,
        telefoneVerificadoEm: new Date(),
      });
    }

    await this.usuariosRepository.marcarVerificacaoComoVerificada(
      verificacao.id,
      new Date(),
    );
  }
}
