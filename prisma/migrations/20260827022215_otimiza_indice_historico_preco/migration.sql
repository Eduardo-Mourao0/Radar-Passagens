-- DropIndex
DROP INDEX "HistoricoPreco_rotaId_coletadoEm_idx";

-- CreateIndex
CREATE INDEX "HistoricoPreco_rotaId_coletadoEm_idx" ON "HistoricoPreco"("rotaId", "coletadoEm" DESC);
