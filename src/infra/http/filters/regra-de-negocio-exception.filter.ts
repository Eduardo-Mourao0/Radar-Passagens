import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  MENSAGENS_ERRO,
  MENSAGENS_ERRO_PUBLICAS,
} from '../../../domain/errors/mensagens-erro';
import { RegraDeNegocioError } from '../../../domain/errors/regra-de-negocio.error';

@Catch(RegraDeNegocioError)
export class RegraDeNegocioExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RegraDeNegocioExceptionFilter.name);

  catch(exception: RegraDeNegocioError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mensagemCatalogada = MENSAGENS_ERRO_PUBLICAS.has(exception.message);
    const mensagem = mensagemCatalogada
      ? exception.message
      : MENSAGENS_ERRO.dadosEntradaInvalidos;

    if (mensagemCatalogada) {
      this.logger.log(`Regra de negócio rejeitada: ${mensagem}`);
    } else {
      this.logger.warn(
        'RegraDeNegocioError com mensagem não catalogada; resposta genérica enviada.',
      );
    }

    try {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: mensagem,
        error: 'Bad Request',
      });
    } catch (erro) {
      this.logger.error(
        'Falha ao serializar a resposta de regra de negócio.',
        erro instanceof Error ? erro.stack : undefined,
      );
      throw erro;
    }
  }
}
