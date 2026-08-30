-- AlterTable
ALTER TABLE "Usuario" RENAME COLUMN "telefoneVerificadoEm" TO "verificadoEm";

-- AlterTable
ALTER TABLE "VerificacaoTelefone" ADD COLUMN     "codigoEnviadoEm" TIMESTAMP(3),
ADD COLUMN     "codigoHash" TEXT,
ADD COLUMN     "tentativasCodigo" INTEGER NOT NULL DEFAULT 0;
