import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceCheckJob } from '../../../application/rotas/jobs/price-check.job';
import { CriarRotaUseCase } from '../../../application/rotas/use-cases/criar-rota.use-case';
import { DesativarRotaUseCase } from '../../../application/rotas/use-cases/desativar-rota.use-case';
import { ExcluirRotaUseCase } from '../../../application/rotas/use-cases/excluir-rota.use-case';
import { ConfigurarAlertaPrecoUseCase } from '../../../application/rotas/use-cases/configurar-alerta-preco.use-case';
import { ListarHistoricoRotaUseCase } from '../../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../../application/rotas/use-cases/listar-rotas.use-case';
import { ReativarRotaUseCase } from '../../../application/rotas/use-cases/reativar-rota.use-case';
import { ObterLinksCompraRotaUseCase } from '../../../application/rotas/use-cases/obter-links-compra-rota.use-case';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  criarRotaSchema,
  type CriarRotaInput,
} from '../schemas/rotas/criar-rota.schema';
import {
  rotaIdParamsSchema,
  type RotaIdParams,
} from '../schemas/rotas/rota-id-params.schema';
import {
  configurarAlertaPrecoSchema,
  type ConfigurarAlertaPrecoInput,
} from '../schemas/rotas/configurar-alerta-preco.schema';

@Controller('rotas')
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
    private readonly configService: ConfigService,
  ) {}

  @Post()
  criar(
    @Body(new ZodValidationPipe(criarRotaSchema))
    criarRotaInput: CriarRotaInput,
  ) {
    return this.criarRotaUseCase.execute(criarRotaInput);
  }

  @Get()
  listar() {
    return this.listarRotasUseCase.execute();
  }

  @Patch(':id/desativar')
  desativar(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ) {
    return this.desativarRotaUseCase.execute({ rotaId: params.id });
  }

  @Patch(':id/reativar')
  reativar(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ) {
    return this.reativarRotaUseCase.execute({ rotaId: params.id });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ): Promise<void> {
    await this.excluirRotaUseCase.execute({ rotaId: params.id });
  }

  @Get(':id/historico')
  listarHistorico(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ) {
    return this.listarHistoricoRotaUseCase.execute(params.id);
  }

  @Get(':id/links-compra')
  obterLinksCompra(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ) {
    return this.obterLinksCompraRotaUseCase.execute(params.id);
  }

  @Put(':id/alerta-preco')
  configurarAlertaPreco(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
    @Body(new ZodValidationPipe(configurarAlertaPrecoSchema))
    input: ConfigurarAlertaPrecoInput,
  ) {
    return this.configurarAlertaPrecoUseCase.execute({
      rotaId: params.id,
      ...input,
    });
  }

  @Post('verificar-precos')
  @HttpCode(HttpStatus.OK)
    async verificarPrecos(): Promise<{ mensagem: string }> {
    await this.priceCheckJob.executar();

   return { mensagem: 'Verificação de preços concluída.' };
  }
}
