import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AutenticarUsuarioUseCase } from '../../../application/autenticacao/use-cases/autenticar-usuario.use-case';
import { IniciarVerificacaoTelefoneUseCase } from '../../../application/autenticacao/use-cases/iniciar-verificacao-telefone.use-case';
import { ObterStatusVerificacaoUseCase } from '../../../application/autenticacao/use-cases/obter-status-verificacao.use-case';
import { ProcessarAtualizacaoTelegramUseCase } from '../../../application/autenticacao/use-cases/processar-atualizacao-telegram.use-case';
import { RedefinirPinUseCase } from '../../../application/autenticacao/use-cases/redefinir-pin.use-case';
import { SessaoCriada, SessaoService } from '../../autenticacao/sessao.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  cadastroSchema,
  loginSchema,
  redefinirPinSchema,
  telefoneSchema,
  verificacaoParamsSchema,
} from '../schemas/autenticacao/autenticacao.schema';
import type {
  CadastroInput,
  LoginInput,
  RedefinirPinInput,
  TelefoneInput,
  VerificacaoParams,
} from '../schemas/autenticacao/autenticacao.schema';

type AtualizacaoTelegram = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { id?: number };
    contact?: { phone_number?: string; user_id?: number };
  };
};

@Controller('auth')
export class AutenticacaoController {
  constructor(
    private readonly iniciarVerificacao: IniciarVerificacaoTelefoneUseCase,
    private readonly obterStatusVerificacao: ObterStatusVerificacaoUseCase,
    private readonly autenticarUsuario: AutenticarUsuarioUseCase,
    private readonly redefinirPin: RedefinirPinUseCase,
    private readonly processarAtualizacaoTelegram: ProcessarAtualizacaoTelegramUseCase,
    private readonly sessaoService: SessaoService,
    private readonly configService: ConfigService,
  ) {}

  @Post('cadastros')
  @HttpCode(HttpStatus.ACCEPTED)
  cadastrar(
    @Body(new ZodValidationPipe(cadastroSchema)) input: CadastroInput,
    @Req() request: Request,
  ) {
    return this.iniciarVerificacao.execute({
      ...input,
      ip: this.obterIp(request),
      finalidade: 'CADASTRO',
    });
  }

  @Post('recuperacoes')
  @HttpCode(HttpStatus.ACCEPTED)
  recuperar(
    @Body(new ZodValidationPipe(telefoneSchema)) input: TelefoneInput,
    @Req() request: Request,
  ) {
    return this.iniciarVerificacao.execute({
      ...input,
      ip: this.obterIp(request),
      finalidade: 'RECUPERACAO',
    });
  }

  @Get('verificacoes/:id')
  obterVerificacao(
    @Param(new ZodValidationPipe(verificacaoParamsSchema))
    params: VerificacaoParams,
  ) {
    return this.obterStatusVerificacao.execute(params.id);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessao = await this.autenticarUsuario.execute(
      input.telefone,
      input.pin,
    );
    this.definirCookieRefresh(response, sessao);
    return { accessToken: sessao.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessao = await this.sessaoService.renovar(
      this.obterCookieRefresh(request),
    );
    this.definirCookieRefresh(response, sessao);
    return { accessToken: sessao.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessaoService.encerrar(this.obterCookieRefreshOpcional(request));
    response.clearCookie('radar_refresh', this.opcoesCookie());
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redefinirSenha(
    @Body(new ZodValidationPipe(redefinirPinSchema)) input: RedefinirPinInput,
  ): Promise<void> {
    await this.redefinirPin.execute(input.tokenRedefinicao, input.pin);
  }

  @Post('telegram/webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async webhookTelegram(
    @Headers('x-telegram-bot-api-secret-token') segredo: string | undefined,
    @Body() atualizacao: AtualizacaoTelegram,
  ): Promise<void> {
    if (
      segredo !==
      this.configService.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET')
    ) {
      throw new UnauthorizedException();
    }

    const mensagem = atualizacao.message;
    if (
      !mensagem ||
      mensagem.chat?.type !== 'private' ||
      !this.eIdTelegramValido(mensagem.chat.id) ||
      !this.eIdTelegramValido(mensagem.from?.id)
    ) {
      return;
    }

    const chatId = String(mensagem.chat.id);
    const telegramUsuarioId = String(mensagem.from.id);
    const inicio = mensagem.text?.match(/^\/start\s+([A-Za-z0-9_-]{43})$/);
    if (inicio) {
      await this.processarAtualizacaoTelegram.iniciar({
        tokenInicio: inicio[1],
        chatId,
        telegramUsuarioId,
      });
      return;
    }

    if (mensagem.contact?.phone_number) {
      await this.processarAtualizacaoTelegram.confirmarContato({
        telefone: mensagem.contact.phone_number,
        chatId,
        telegramUsuarioId,
        ...(mensagem.contact.user_id !== undefined
          ? { contatoUsuarioId: String(mensagem.contact.user_id) }
          : {}),
      });
    }
  }

  private definirCookieRefresh(response: Response, sessao: SessaoCriada): void {
    response.cookie('radar_refresh', sessao.refreshToken, {
      ...this.opcoesCookie(),
      expires: sessao.expiraEm,
    });
  }

  private opcoesCookie() {
    const producao =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: producao,
      sameSite: producao ? ('none' as const) : ('lax' as const),
      path: '/auth',
    };
  }

  private obterIp(request: Request): string {
    const encaminhado = request.headers['x-forwarded-for'];
    if (typeof encaminhado === 'string')
      return encaminhado.split(',')[0].trim();
    return request.ip ?? 'desconhecido';
  }

  private eIdTelegramValido(id: unknown): id is number {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  }

  private obterCookieRefresh(request: Request): string {
    const refresh = this.obterCookieRefreshOpcional(request);
    if (!refresh) throw new UnauthorizedException();
    return refresh;
  }

  private obterCookieRefreshOpcional(request: Request): string | undefined {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') return undefined;
    const refresh = (cookies as Record<string, unknown>).radar_refresh;
    return typeof refresh === 'string' ? refresh : undefined;
  }
}
