import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AutenticarUsuarioUseCase } from '../../application/autenticacao/use-cases/autenticar-usuario.use-case';
import { ConfirmarCodigoTelegramUseCase } from '../../application/autenticacao/use-cases/confirmar-codigo-telegram.use-case';
import { IniciarVerificacaoTelefoneUseCase } from '../../application/autenticacao/use-cases/iniciar-verificacao-telefone.use-case';
import { ObterStatusVerificacaoUseCase } from '../../application/autenticacao/use-cases/obter-status-verificacao.use-case';
import { ProcessarAtualizacaoTelegramUseCase } from '../../application/autenticacao/use-cases/processar-atualizacao-telegram.use-case';
import { RedefinirPinUseCase } from '../../application/autenticacao/use-cases/redefinir-pin.use-case';
import { MENSAGEIRO_TELEGRAM } from '../../application/autenticacao/ports/mensageiro-telegram.port';
import { USUARIOS_REPOSITORY } from '../../domain/usuarios/repositories/usuarios.repository';
import { LimiteAutenticacaoService } from '../../infra/autenticacao/limite-autenticacao.service';
import { SessaoService } from '../../infra/autenticacao/sessao.service';
import { TelegramMensageiroService } from '../../infra/autenticacao/telegram-mensageiro.service';
import { PrismaUsuariosRepository } from '../../infra/database/prisma/repositories/prisma-usuarios.repository';
import { AutenticacaoController } from '../../infra/http/controllers/autenticacao.controller';
import { AutenticacaoGuard } from '../../infra/http/guards/autenticacao.guard';

@Module({
  imports: [HttpModule],
  controllers: [AutenticacaoController],
  providers: [
    IniciarVerificacaoTelefoneUseCase,
    ConfirmarCodigoTelegramUseCase,
    AutenticarUsuarioUseCase,
    ObterStatusVerificacaoUseCase,
    ProcessarAtualizacaoTelegramUseCase,
    RedefinirPinUseCase,
    LimiteAutenticacaoService,
    SessaoService,
    AutenticacaoGuard,
    PrismaUsuariosRepository,
    TelegramMensageiroService,
    {
      provide: USUARIOS_REPOSITORY,
      useExisting: PrismaUsuariosRepository,
    },
    {
      provide: MENSAGEIRO_TELEGRAM,
      useExisting: TelegramMensageiroService,
    },
  ],
  exports: [USUARIOS_REPOSITORY, AutenticacaoGuard, SessaoService],
})
export class AutenticacaoModule {}
