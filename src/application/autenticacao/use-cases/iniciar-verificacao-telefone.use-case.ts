import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MENSAGENS_ERRO } from '../../../domain/errors/mensagens-erro';
import {
  FinalidadeVerificacaoTelefone,
  UsuarioEntity,
} from '../../../domain/usuarios/entities/usuario.entity';
import { USUARIOS_REPOSITORY } from '../../../domain/usuarios/repositories/usuarios.repository';
import type { UsuariosRepository } from '../../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../../infra/autenticacao/limite-autenticacao.service';

export type IniciarVerificacaoTelefoneInput = Readonly<{
  telefone: string;
  pin?: string;
  ip: string;
  finalidade: FinalidadeVerificacaoTelefone;
}>;

@Injectable()
export class IniciarVerificacaoTelefoneUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: UsuariosRepository,
    private readonly limiteAutenticacao: LimiteAutenticacaoService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: IniciarVerificacaoTelefoneInput) {
    const telefone = UsuarioEntity.normalizarTelefone(input.telefone);
    this.limiteAutenticacao.validarInicio(telefone, input.ip);

    const recentes = await this.usuariosRepository.contarVerificacoesRecentes(
      telefone,
      input.finalidade,
      new Date(Date.now() - 60 * 60 * 1000),
    );
    if (recentes >= 3) {
      throw new HttpException(
        'Muitas tentativas. Aguarde antes de tentar novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (input.finalidade === 'CADASTRO') {
      UsuarioEntity.validarPin(input.pin ?? '');
      const usuario = await this.usuariosRepository.buscarPorTelefone(telefone);
      if (usuario)
        throw new ConflictException(MENSAGENS_ERRO.telefoneJaCadastrado);
    }

    const tokenInicio = randomBytes(32).toString('base64url');
    const verificacao = await this.usuariosRepository.criarVerificacao({
      telefone,
      finalidade: input.finalidade,
      ...(input.pin
        ? { senhaHash: await argon2.hash(input.pin, { type: argon2.argon2id }) }
        : {}),
      tokenInicio,
      expiraEm: new Date(Date.now() + 10 * 60 * 1000),
    });
    const bot = this.configService.getOrThrow<string>('TELEGRAM_BOT_USERNAME');

    return {
      id: verificacao.id,
      expiraEm: verificacao.expiraEm,
      urlTelegram: `https://t.me/${bot.replace(/^@/, '')}?start=${tokenInicio}`,
    };
  }
}
