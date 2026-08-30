import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import { SOLICITADOR_CONTATO_TELEGRAM } from '../ports/solicitador-contato-telegram.port';
import type { SolicitadorContatoTelegram } from '../ports/solicitador-contato-telegram.port';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { UsuarioEntity } from '../../../domain/usuarios/entities/usuario.entity';

type InicioTelegram = Readonly<{
  tokenInicio?: string;
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
    if (!tokenInicio) {
      await this.solicitadorContato.enviarMensagem(
        chatId,
        'Para iniciar seu cadastro, use o link de confirmação enviado pelo Radar Passagens.',
      );
      return;
    }

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
      await this.solicitadorContato.enviarMensagem(
        chatId,
        'Este link de confirmação é inválido ou expirou. Solicite um novo cadastro no Radar Passagens.',
      );
      return;
    }

    const vinculada =
      await this.usuariosRepository.vincularTelegramNaVerificacao(
        verificacao.id,
        chatId,
        telegramUsuarioId,
      );
    if (vinculada) {
      await this.solicitadorContato.solicitarContato(chatId);
      return;
    }

    await this.solicitadorContato.enviarMensagem(
      chatId,
      'Este link de confirmação já foi utilizado ou expirou. Solicite um novo cadastro no Radar Passagens.',
    );
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

    const resultado =
      await this.usuariosRepository.finalizarVerificacaoTelegram({
        verificacaoId: verificacao.id,
        telefone: telefoneNormalizado,
        chatId,
        telegramUsuarioId,
        quando: new Date(),
      });
    if (resultado === 'TELEFONE_JA_CADASTRADO') {
      throw new ConflictException(MENSAGENS_ERRO.telefoneJaCadastrado);
    }
  }
}
