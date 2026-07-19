/**
 * REPARO ÚNICO — religa sessões órfãs do Ciclo de Estudos
 * ---------------------------------------------------------
 * Corrige sessões (db.cicloSessoes) cujo cicloMateriaId ficou "órfão"
 * (apontando pra uma disciplina que não existe mais com esse ID, por causa
 * do bug de sincronização). Usa o campo "nome" que cada sessão já guarda
 * pra encontrar a disciplina certa hoje e religar o ID.
 *
 * Como usar:
 * 1. Abra o app já atualizado com os arquivos novos (database.js corrigido).
 * 2. Confira o perfil ativo no topo.
 * 3. F12 > Console > cole este arquivo inteiro > Enter.
 * 4. Dê F5 depois de ver a mensagem de conclusão.
 *
 * Só ATUALIZA sessões órfãs (nunca cria nem apaga tentativas/ciclos).
 */
(async () => {
  if (typeof db === 'undefined' || !db.cicloSessoes) {
    console.error('❌ Rode isso na aba do app já carregado.');
    return;
  }

  await db.criarBackupLocalAutomatico('antes_de_reparar_sessoes_orfas').catch(() => {});

  const norm = (s) => (s || '').trim().toLowerCase();
  const materias = await db.getAll('cicloMaterias');
  const sessoes = await db.getAll('cicloSessoes');
  const idsValidos = new Set(materias.map(m => m.id));

  let religadas = 0;
  let semCorrespondencia = 0;

  for (const s of sessoes) {
    if (idsValidos.has(s.cicloMateriaId)) continue; // já está ok

    const materiaCorreta = materias.find(m => norm(m.nome) === norm(s.nome));
    if (materiaCorreta) {
      await db.cicloSessoes.update({ ...s, cicloMateriaId: materiaCorreta.id });
      religadas++;
    } else {
      semCorrespondencia++;
    }
  }

  console.log(`✅ Reparo concluído: ${religadas} sessão(ões) religada(s).${semCorrespondencia ? ` (${semCorrespondencia} sem disciplina correspondente encontrada — provavelmente de uma disciplina que já foi removida do ciclo)` : ''}`);
  console.log('Dê F5 para ver o gráfico "Tempo por tipo de estudo" atualizado.');
})();
