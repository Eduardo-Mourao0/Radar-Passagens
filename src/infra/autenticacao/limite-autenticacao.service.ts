import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Janela = { inicio: number; quantidade: number };

@Injectable()
export class LimiteAutenticacaoService {
  private readonly janelas = new Map<string, Janela>();

  validarInicio(telefone: string, ip: string): void {
    this.consumir(`telefone:${telefone}`, 3, 60 * 60 * 1000);
    this.consumir(`ip:${ip}`, 10, 60 * 60 * 1000);
  }

  private consumir(chave: string, limite: number, janelaMs: number): void {
    const agora = Date.now();
    const atual = this.janelas.get(chave);
    const janelaExpirada = !atual || atual.inicio + janelaMs <= agora;
    const proxima = janelaExpirada
      ? { inicio: agora, quantidade: 1 }
      : { ...atual, quantidade: atual.quantidade + 1 };

    this.janelas.set(chave, proxima);

    if (proxima.quantidade > limite) {
      throw new HttpException(
        'Muitas tentativas. Aguarde antes de tentar novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
