export const SOLICITADOR_CONTATO_TELEGRAM = Symbol(
  'SOLICITADOR_CONTATO_TELEGRAM',
);

export interface SolicitadorContatoTelegram {
  solicitarContato(chatId: string): Promise<void>;
  enviarMensagem(chatId: string, mensagem: string): Promise<void>;
}
