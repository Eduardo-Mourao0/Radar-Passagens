-- CreateEnum
CREATE TYPE "FinalidadeVerificacaoTelefone" AS ENUM ('CADASTRO', 'RECUPERACAO');

-- DropIndex
DROP INDEX "Rota_chaveMonitoramento_key";

-- AlterTable
ALTER TABLE "Rota" ADD COLUMN "usuarioId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telefoneVerificadoEm" TIMESTAMP(3) NOT NULL,
    "tentativasLoginFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificacaoTelefone" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "finalidade" "FinalidadeVerificacaoTelefone" NOT NULL,
    "senhaHash" TEXT,
    "tokenInicio" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "telegramUsuarioId" TEXT,
    "verificadaEm" TIMESTAMP(3),
    "consumidaEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificacaoTelefone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefone_key" ON "Usuario"("telefone");
CREATE UNIQUE INDEX "Usuario_telegramChatId_key" ON "Usuario"("telegramChatId");
CREATE UNIQUE INDEX "VerificacaoTelefone_tokenInicio_key" ON "VerificacaoTelefone"("tokenInicio");
CREATE INDEX "VerificacaoTelefone_telefone_finalidade_criadoEm_idx" ON "VerificacaoTelefone"("telefone", "finalidade", "criadoEm" DESC);
CREATE INDEX "VerificacaoTelefone_expiraEm_idx" ON "VerificacaoTelefone"("expiraEm");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_usuarioId_expiraEm_idx" ON "RefreshToken"("usuarioId", "expiraEm");
CREATE INDEX "Rota_usuarioId_criadoEm_idx" ON "Rota"("usuarioId", "criadoEm" DESC);
CREATE UNIQUE INDEX "Rota_usuarioId_chaveMonitoramento_key" ON "Rota"("usuarioId", "chaveMonitoramento");

-- AddForeignKey
ALTER TABLE "Rota" ADD CONSTRAINT "Rota_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
