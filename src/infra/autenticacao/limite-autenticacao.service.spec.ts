import { HttpException } from '@nestjs/common';
import { LimiteAutenticacaoService } from './limite-autenticacao.service';

describe('LimiteAutenticacaoService', () => {
  it('permite cinco tentativas de início por telefone e IP', () => {
    const service = new LimiteAutenticacaoService();

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      expect(() =>
        service.validarInicio('+5561999999999', '127.0.0.1'),
      ).not.toThrow();
    }

    expect(() => service.validarInicio('+5561999999999', '127.0.0.1')).toThrow(
      HttpException,
    );
  });

  it('limita confirmações de código por IP', () => {
    const service = new LimiteAutenticacaoService();

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      expect(() => service.validarConfirmacaoCodigo('127.0.0.1')).not.toThrow();
    }

    expect(() => service.validarConfirmacaoCodigo('127.0.0.1')).toThrow(
      HttpException,
    );
  });
});
