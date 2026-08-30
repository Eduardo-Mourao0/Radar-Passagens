export const MENSAGEIRO_TELEGRAM = Symbol('MENSAGEIRO_TELEGRAM');

export interface MensageiroTelegram {
  enviarMensagem(chatId: string, mensagem: string): Promise<void>;
}
