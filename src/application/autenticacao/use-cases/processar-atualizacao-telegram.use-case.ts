import { randomInt } from 'crypto';
import * as argon2 from 'argon2';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MENSAGEIRO_TELEGRAM } from '../ports/mensageiro-telegram.port';
import type { MensageiroTelegram } from '../ports/mensageiro-telegram.port';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';

type InicioTelegram = Readonly<{
  tokenInicio?: string;
  chatId: string;
  telegramUsuarioId: string;
}>;

@Injectable()
export class ProcessarAtualizacaoTelegramUseCase {
  private readonly logger = new Logger(
    ProcessarAtualizacaoTelegramUseCase.name,
  );

  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    @Inject(MENSAGEIRO_TELEGRAM)
    private readonly mensageiroTelegram: MensageiroTelegram,
  ) {}

  async iniciar({ tokenInicio, chatId, telegramUsuarioId }: InicioTelegram) {
    if (!tokenInicio) {
      await this.mensageiroTelegram.enviarMensagem(
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
      await this.mensageiroTelegram.enviarMensagem(
        chatId,
        'Este link de confirmação é inválido ou expirou. Solicite um novo cadastro no Radar Passagens.',
      );
      return;
    }

    if (
      (verificacao.telegramChatId && verificacao.telegramChatId !== chatId) ||
      (verificacao.telegramUsuarioId &&
        verificacao.telegramUsuarioId !== telegramUsuarioId)
    ) {
      await this.mensageiroTelegram.enviarMensagem(
        chatId,
        'Este link de confirmação já foi utilizado ou expirou. Solicite um novo cadastro no Radar Passagens.',
      );
      return;
    }

    const agora = new Date();
    if (
      verificacao.codigoEnviadoEm &&
      verificacao.codigoEnviadoEm.getTime() > agora.getTime() - 60_000
    ) {
      await this.mensageiroTelegram.enviarMensagem(
        chatId,
        'Um código foi enviado recentemente. Aguarde um minuto para solicitar outro.',
      );
      return;
    }

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codigoHash = await argon2.hash(codigo, { type: argon2.argon2id });
    const preparada = await this.usuariosRepository.prepararCodigoTelegram({
      verificacaoId: verificacao.id,
      telegramChatId: chatId,
      telegramUsuarioId,
      codigoHash,
      quando: agora,
    });
    if (!preparada) {
      await this.mensageiroTelegram.enviarMensagem(
        chatId,
        'Não foi possível enviar um código agora. Solicite um novo cadastro no Radar Passagens.',
      );
      return;
    }

    try {
      await this.mensageiroTelegram.enviarMensagem(
        chatId,
        `Seu código de verificação é: ${codigo}`,
      );
    } catch (erro: unknown) {
      try {
        await this.usuariosRepository.cancelarCodigoTelegram(
          verificacao.id,
          codigoHash,
        );
      } catch {
        this.logger.error(
          JSON.stringify({
            evento: 'telegram_codigo_cancelamento_falhou',
            verificacaoId: verificacao.id,
          }),
        );
      }
      throw erro;
    }
  }
}
