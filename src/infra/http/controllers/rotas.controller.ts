import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PriceCheckJob } from '../../../application/rotas/jobs/price-check.job';
import { ConfigurarAlertaPrecoUseCase } from '../../../application/rotas/use-cases/configurar-alerta-preco.use-case';
import { CriarRotaUseCase } from '../../../application/rotas/use-cases/criar-rota.use-case';
import { DesativarRotaUseCase } from '../../../application/rotas/use-cases/desativar-rota.use-case';
import { ExcluirRotaUseCase } from '../../../application/rotas/use-cases/excluir-rota.use-case';
import { ListarHistoricoRotaUseCase } from '../../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../../application/rotas/use-cases/listar-rotas.use-case';
import { ObterLinksCompraRotaUseCase } from '../../../application/rotas/use-cases/obter-links-compra-rota.use-case';
import { ReativarRotaUseCase } from '../../../application/rotas/use-cases/reativar-rota.use-case';
import { VerificarPrecoRotaUseCase } from '../../../application/rotas/use-cases/verificar-preco-rota.use-case';
import { AutenticacaoGuard } from '../guards/autenticacao.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  configurarAlertaPrecoSchema,
  type ConfigurarAlertaPrecoInput,
} from '../schemas/rotas/configurar-alerta-preco.schema';
import {
  criarRotaSchema,
  type CriarRotaInput,
} from '../schemas/rotas/criar-rota.schema';
import {
  rotaIdParamsSchema,
  type RotaIdParams,
} from '../schemas/rotas/rota-id-params.schema';

@Controller('rotas')
@UseGuards(AutenticacaoGuard)
export class RotasController {
  constructor(
    private readonly criarRotaUseCase: CriarRotaUseCase,
    private readonly desativarRotaUseCase: DesativarRotaUseCase,
    private readonly excluirRotaUseCase: ExcluirRotaUseCase,
    private readonly reativarRotaUseCase: ReativarRotaUseCase,
    private readonly configurarAlertaPrecoUseCase: ConfigurarAlertaPrecoUseCase,
    private readonly listarRotasUseCase: ListarRotasUseCase,
    private readonly listarHistoricoRotaUseCase: ListarHistoricoRotaUseCase,
    private readonly obterLinksCompraRotaUseCase: ObterLinksCompraRotaUseCase,
    private readonly priceCheckJob: PriceCheckJob,
    private readonly verificarPrecoRotaUseCase: VerificarPrecoRotaUseCase,
  ) {}

  @Post()
  criar(
    @Body(new ZodValidationPipe(criarRotaSchema)) input: CriarRotaInput,
    @Req() request: Request,
  ) {
    return this.criarRotaUseCase.execute({
      ...input,
      usuarioId: this.obterUsuarioId(request),
    });
  }

  @Get()
  listar(@Req() request: Request) {
    return this.listarRotasUseCase.execute(this.obterUsuarioId(request));
  }

  @Patch(':id/desativar')
  desativar(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ) {
    return this.desativarRotaUseCase.execute({
      rotaId: params.id,
      usuarioId: this.obterUsuarioId(request),
    });
  }

  @Patch(':id/reativar')
  reativar(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ) {
    return this.reativarRotaUseCase.execute({
      rotaId: params.id,
      usuarioId: this.obterUsuarioId(request),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ): Promise<void> {
    await this.excluirRotaUseCase.execute({
      rotaId: params.id,
      usuarioId: this.obterUsuarioId(request),
    });
  }

  @Get(':id/historico')
  listarHistorico(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ) {
    return this.listarHistoricoRotaUseCase.execute(
      params.id,
      this.obterUsuarioId(request),
    );
  }

  @Get(':id/links-compra')
  obterLinksCompra(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ) {
    return this.obterLinksCompraRotaUseCase.execute(
      params.id,
      this.obterUsuarioId(request),
    );
  }

  @Put(':id/alerta-preco')
  configurarAlertaPreco(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Body(new ZodValidationPipe(configurarAlertaPrecoSchema))
    input: ConfigurarAlertaPrecoInput,
    @Req() request: Request,
  ) {
    return this.configurarAlertaPrecoUseCase.execute({
      rotaId: params.id,
      usuarioId: this.obterUsuarioId(request),
      ...input,
    });
  }

  @Post('verificar-precos')
  @HttpCode(HttpStatus.OK)
  async verificarPrecos(): Promise<{ mensagem: string }> {
    await this.priceCheckJob.executar();
    return { mensagem: 'Verificação de preços concluída.' };
  }

  @Post(':id/verificar-preco')
  verificarPreco(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Req() request: Request,
  ) {
    return this.verificarPrecoRotaUseCase.executarParaUsuario(
      params.id,
      this.obterUsuarioId(request),
    );
  }

  private obterUsuarioId(request: Request): string {
    if (!request.usuario?.id || typeof request.usuario.id !== 'string') {
      throw new UnauthorizedException();
    }
    return request.usuario.id;
  }
}
