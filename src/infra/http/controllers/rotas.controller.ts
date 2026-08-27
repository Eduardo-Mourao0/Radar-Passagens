import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceCheckJob } from '../../../application/rotas/jobs/price-check.job';
import { CriarRotaUseCase } from '../../../application/rotas/use-cases/criar-rota.use-case';
import { ListarHistoricoRotaUseCase } from '../../../application/rotas/use-cases/listar-historico-rota.use-case';
import { ListarRotasUseCase } from '../../../application/rotas/use-cases/listar-rotas.use-case';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  criarRotaSchema,
  type CriarRotaInput,
} from '../schemas/rotas/criar-rota.schema';
import {
  rotaIdParamsSchema,
  type RotaIdParams,
} from '../schemas/rotas/rota-id-params.schema';

@Controller('rotas')
export class RotasController {
  constructor(
    private readonly criarRotaUseCase: CriarRotaUseCase,
    private readonly listarRotasUseCase: ListarRotasUseCase,
    private readonly listarHistoricoRotaUseCase: ListarHistoricoRotaUseCase,
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

  @Get(':id/historico')
  listarHistorico(
    @Param(new ZodValidationPipe(rotaIdParamsSchema)) params: RotaIdParams,
  ) {
    return this.listarHistoricoRotaUseCase.execute(params.id);
  }

  @Post('verificar-precos')
  @HttpCode(HttpStatus.OK)
  async verificarPrecos(): Promise<{ mensagem: string }> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException();
    }

    await this.priceCheckJob.executar();

    return { mensagem: 'Verificação de preços concluída.' };
  }
}
