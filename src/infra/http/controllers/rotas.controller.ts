import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
  ) {}

  @Post()
  criar(
    @Body(new ZodValidationPipe(criarRotaSchema)) criarRotaInput: CriarRotaInput,
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
}
