-- CreateEnum
CREATE TYPE "SituacaoCotacao" AS ENUM ('PENDENTE', 'ATUALIZADA', 'SEM_OFERTA', 'INDISPONIVEL');

-- AlterTable
ALTER TABLE "Rota" ADD COLUMN     "proximaTentativaCotacaoEm" TIMESTAMP(3),
ADD COLUMN     "situacaoCotacao" "SituacaoCotacao" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "tentativasCotacao" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimaCotacaoEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Rota_ativa_situacaoCotacao_proximaTentativaCotacaoEm_idx" ON "Rota"("ativa", "situacaoCotacao", "proximaTentativaCotacaoEm");
