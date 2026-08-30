import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Janela = { expiraEm: number; quantidade: number };

@Injectable()
export class LimiteAutenticacaoService {
  private static readonly MAXIMO_JANELAS = 10_000;
  private readonly janelas = new Map<string, Janela>();

  validarInicio(telefone: string, ip: string): void {
    this.consumir(`telefone:${telefone}`, 3, 60 * 60 * 1000);
    this.consumir(`ip:${ip}`, 10, 60 * 60 * 1000);
    this.consumir(`telefone-ip:${telefone}:${ip}`, 1, 10 * 60 * 1000);
  }

  private consumir(chave: string, limite: number, janelaMs: number): void {
    const agora = Date.now();
    const atual = this.janelas.get(chave);
    this.limparJanelasExpiradas(agora);
    const janelaExpirada = !atual || atual.expiraEm <= agora;
    const proxima = janelaExpirada
      ? { expiraEm: agora + janelaMs, quantidade: 1 }
      : { ...atual, quantidade: atual.quantidade + 1 };

    this.janelas.set(chave, proxima);

    if (proxima.quantidade > limite) {
      throw new HttpException(
        'Muitas tentativas. Aguarde antes de tentar novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private limparJanelasExpiradas(agora: number): void {
    for (const [chave, janela] of this.janelas) {
      if (janela.expiraEm <= agora) this.janelas.delete(chave);
    }

    while (this.janelas.size >= LimiteAutenticacaoService.MAXIMO_JANELAS) {
      const [entradaMaisAntiga] = this.janelas;
      if (!entradaMaisAntiga) return;
      this.janelas.delete(entradaMaisAntiga[0]);
    }
  }
}
