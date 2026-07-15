/**
 * ciclo.js
 * Ciclo de Estudos — metodologia usada em apps como o "Estude Aqui":
 * você lista as disciplinas com um peso (prioridade) e um tempo total do
 * ciclo; o app distribui o tempo proporcionalmente ao peso de cada uma.
 * Você vai estudando (cronômetro) até bater a meta de cada disciplina;
 * quando todas terminam, fecha-se o ciclo (uma "volta") e tudo recomeça.
 *
 * Dados: db.cicloMaterias (disciplinas do ciclo + progresso da volta atual),
 * db.cicloSessoes (histórico de sessões estudadas) e db.cicloConfig
 * (tempo total do ciclo + contador de ciclos fechados).
 */

let _cicloTimerInterval = null;

function _formatarMinutos(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h${m > 0 ? ' ' + m + 'min' : ''}`;
  return `${m}min`;
}

function _formatarCronometro(segundosTotais) {
  const h = Math.floor(segundosTotais / 3600);
  const m = Math.floor((segundosTotais % 3600) / 60);
  const s = Math.floor(segundosTotais % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function _cicloSomaPesos() {
  return state.cicloMaterias.reduce((s, m) => s + m.peso, 0) || 1;
}

function _cicloMetaMinutos(materia) {
  return Math.round((materia.peso / _cicloSomaPesos()) * state.cicloConfig.minutosCicloTotal);
}

/* ---- Ponto de entrada da rota #/ciclo ---- */
function renderCicloEstudos(view) {
  clearInterval(_cicloTimerInterval);
  if (!state.cicloMaterias.length) {
    renderCicloSetup(view, null);
  } else {
    renderCicloPainel(view);
  }
}

/* ---- Tela de configuração (criação ou edição do ciclo) ---- */
function renderCicloSetup(view, prefill) {
  clearInterval(_cicloTimerInterval);
  const linhasIniciais = prefill
    ? prefill.materias.map(m => `${m.nome}: ${m.peso}`).join('\n')
    : '';
  const horasIniciais = prefill ? (prefill.minutosCicloTotal / 60) : 20;

  view.innerHTML = `
    <div class="card">
      <div class="card-title">${prefill ? 'Editar ciclo de estudos' : 'Monte seu ciclo de estudos'}</div>
      <p class="text-muted" style="font-size:13.5px;">
        Liste as disciplinas do seu ciclo, uma por linha, com o peso (prioridade) depois de dois-pontos.
        Disciplinas com peso maior recebem mais tempo dentro do ciclo. Se não informar o peso, o padrão é 1.
      </p>
      <pre style="font-size:12.5px;background:var(--surface-2);padding:8px 10px;border-radius:8px;overflow-x:auto;margin:0 0 14px;">Direito Constitucional: 5
Direito Administrativo: 5
Língua Portuguesa: 3
Raciocínio Lógico: 2</pre>
      <div class="form-row">
        <label>Disciplinas e pesos</label>
        <textarea id="ciclo-texto" rows="8" placeholder="Direito Constitucional: 5&#10;Português: 3&#10;...">${escapeHtml(linhasIniciais)}</textarea>
      </div>
      <div class="form-row" style="max-width:260px;">
        <label>Tempo total do ciclo (em horas)</label>
        <input type="number" id="ciclo-horas" min="1" step="0.5" value="${horasIniciais}">
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary" id="btn-salvar-ciclo">${prefill ? 'Salvar alterações' : 'Criar ciclo de estudos'}</button>
        ${prefill ? '<button class="btn btn-ghost" id="btn-cancelar-edicao-ciclo">Cancelar</button>' : ''}
      </div>
    </div>
  `;

  $('#btn-salvar-ciclo').addEventListener('click', async () => {
    const texto = $('#ciclo-texto').value;
    const horas = Number($('#ciclo-horas').value) || 20;
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    if (!linhas.length) { showToast('Adicione ao menos uma disciplina.', 'error'); return; }

    const novasMaterias = linhas.map(linha => {
      const m = linha.match(/^(.+?)(?::\s*([\d.,]+))?$/);
      const nome = (m ? m[1] : linha).trim();
      const pesoStr = m && m[2] ? m[2].replace(',', '.') : '1';
      const peso = Number(pesoStr);
      return { nome, peso: peso > 0 ? peso : 1 };
    }).filter(m => m.nome);

    if (prefill) {
      const antigas = prefill.materias;
      const restantes = [];
      for (const nova of novasMaterias) {
        const antiga = antigas.find(a => _norm(a.nome) === _norm(nova.nome));
        restantes.push(antiga ? { ...antiga, nome: nova.nome, peso: nova.peso } : { nome: nova.nome, peso: nova.peso, minutosFeitos: 0 });
      }
      for (const antiga of antigas) {
        if (!novasMaterias.some(n => _norm(n.nome) === _norm(antiga.nome))) {
          await db.cicloMaterias.remove(antiga.id);
        }
      }
      for (let i = 0; i < restantes.length; i++) {
        const mat = { ...restantes[i], ordem: i };
        if (mat.id) await db.cicloMaterias.update(mat);
        else await db.cicloMaterias.add(mat);
      }
      await db.cicloConfig.set({ minutosCicloTotal: Math.round(horas * 60), ciclosCompletos: prefill.ciclosCompletos });
    } else {
      for (let i = 0; i < novasMaterias.length; i++) {
        await db.cicloMaterias.add({ ...novasMaterias[i], ordem: i, minutosFeitos: 0 });
      }
      await db.cicloConfig.set({ minutosCicloTotal: Math.round(horas * 60), ciclosCompletos: 0 });
    }

    await reloadState();
    showToast('Ciclo de estudos salvo!', 'success');
    renderCicloEstudos(view);
  });

  if (prefill) {
    $('#btn-cancelar-edicao-ciclo').addEventListener('click', () => renderCicloEstudos(view));
  }
}

/* ---- Painel principal (ciclo já configurado) ---- */
function renderCicloPainel(view) {
  clearInterval(_cicloTimerInterval);

  const materias = state.cicloMaterias;
  const totalFeito = materias.reduce((s, m) => s + m.minutosFeitos, 0);
  const totalMeta = state.cicloConfig.minutosCicloTotal;
  const pctGeral = totalMeta ? Math.min(100, (totalFeito / totalMeta) * 100) : 0;
  const todasConcluidas = materias.every(m => m.minutosFeitos >= _cicloMetaMinutos(m) - 0.5);
  const sessaoAtiva = settings.cicloSessaoAtiva;

  view.innerHTML = `
    <div class="card mb-16">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div class="card-title" style="margin-bottom:4px;">Progresso do ciclo</div>
          <span class="text-muted" style="font-size:13px;">
            ${_formatarMinutos(totalFeito)} de ${_formatarMinutos(totalMeta)} · Ciclos completos: <strong>${state.cicloConfig.ciclosCompletos}</strong>
          </span>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" id="btn-editar-ciclo">Editar disciplinas</button>
          <button class="btn btn-sm btn-ghost" id="btn-excluir-ciclo">Excluir ciclo</button>
        </div>
      </div>
      <div class="pct-bar-wrap mt-12" style="min-width:auto;">
        <div class="pct-bar" style="flex:1;"><span style="width:${pctGeral}%"></span></div>
        <span class="num">${fmtPct(pctGeral)}</span>
      </div>
      ${todasConcluidas ? `<button class="btn btn-primary mt-12" id="btn-fechar-ciclo">🎉 Fechar ciclo e começar nova volta</button>` : ''}
    </div>

    ${sessaoAtiva ? _renderCicloSessaoAtivaCard(sessaoAtiva) : ''}

    <div class="card">
      <div class="card-title">Disciplinas do ciclo</div>
      <div class="ciclo-lista mt-12">
        ${materias.map(m => _renderCicloLinhaMateria(m, sessaoAtiva)).join('')}
      </div>
    </div>
  `;

  $('#btn-editar-ciclo').addEventListener('click', () => {
    renderCicloSetup(view, {
      materias: state.cicloMaterias,
      minutosCicloTotal: state.cicloConfig.minutosCicloTotal,
      ciclosCompletos: state.cicloConfig.ciclosCompletos
    });
  });

  $('#btn-excluir-ciclo').addEventListener('click', async () => {
    if (!confirm('Excluir todo o ciclo de estudos (disciplinas, pesos e progresso)? As tentativas registradas nas Estatísticas não são afetadas.')) return;
    for (const m of state.cicloMaterias) await db.cicloMaterias.remove(m.id);
    for (const s of state.cicloSessoes) await db.cicloSessoes.remove(s.id);
    await db.cicloConfig.set({ minutosCicloTotal: 1200, ciclosCompletos: 0 });
    settings.cicloSessaoAtiva = null;
    await reloadState();
    renderCicloEstudos(view);
  });

  const btnFechar = $('#btn-fechar-ciclo');
  if (btnFechar) {
    btnFechar.addEventListener('click', async () => {
      if (!confirm('Fechar este ciclo e começar uma nova volta? O progresso de cada disciplina será zerado (o histórico de sessões estudadas é mantido).')) return;
      for (const m of state.cicloMaterias) {
        m.minutosFeitos = 0;
        await db.cicloMaterias.update(m);
      }
      await db.cicloConfig.set({ ...state.cicloConfig, ciclosCompletos: state.cicloConfig.ciclosCompletos + 1 });
      await reloadState();
      showToast('Ciclo concluído! Nova volta iniciada. 🎉', 'success');
      renderCicloEstudos(view);
    });
  }

  if (sessaoAtiva) {
    _iniciarCronometroVisual();
    $('#btn-concluir-sessao').addEventListener('click', () => _concluirSessaoCiclo(view));
    $('#btn-cancelar-sessao').addEventListener('click', () => _cancelarSessaoCiclo(view));
  }

  $$('[data-iniciar]', view).forEach(btn => {
    btn.addEventListener('click', () => {
      if (settings.cicloSessaoAtiva) { showToast('Finalize a sessão atual antes de iniciar outra.', 'error'); return; }
      settings.cicloSessaoAtiva = { materiaId: Number(btn.dataset.iniciar), inicio: Date.now() };
      renderCicloEstudos(view);
    });
  });

  $$('[data-manual]', view).forEach(btn => {
    btn.addEventListener('click', async () => {
      const minutos = Number(prompt('Quantos minutos você quer adicionar a essa disciplina?', '25'));
      if (!minutos || minutos <= 0) return;
      const materia = state.cicloMaterias.find(m => m.id === Number(btn.dataset.manual));
      if (!materia) return;
      materia.minutosFeitos += minutos;
      await db.cicloMaterias.update(materia);
      await db.cicloSessoes.add({
        cicloMateriaId: materia.id, nome: materia.nome, data: todayISO(),
        minutos, inicio: new Date().toISOString(), fim: new Date().toISOString()
      });
      await reloadState();
      showToast(`+${_formatarMinutos(minutos)} em ${materia.nome}`, 'success');
      renderCicloEstudos(view);
    });
  });
}

function _renderCicloSessaoAtivaCard(sessaoAtiva) {
  const materia = state.cicloMaterias.find(m => m.id === sessaoAtiva.materiaId);
  return `
    <div class="card mb-16 ciclo-sessao-ativa">
      <div class="card-title" style="margin-bottom:2px;">Estudando agora</div>
      <div style="font-size:15px; font-weight:700;">${escapeHtml(materia ? materia.nome : '')}</div>
      <div class="ciclo-cronometro" id="ciclo-cronometro">00:00</div>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="btn btn-primary" id="btn-concluir-sessao">Concluir sessão</button>
        <button class="btn btn-ghost" id="btn-cancelar-sessao">Cancelar</button>
      </div>
    </div>
  `;
}

function _renderCicloLinhaMateria(m, sessaoAtiva) {
  const meta = _cicloMetaMinutos(m);
  const pct = meta ? Math.min(100, (m.minutosFeitos / meta) * 100) : 0;
  const concluida = meta > 0 && m.minutosFeitos >= meta;
  const emAndamento = sessaoAtiva && sessaoAtiva.materiaId === m.id;
  return `
    <div class="ciclo-materia-row ${emAndamento ? 'ativa' : ''}">
      <div class="ciclo-materia-topo">
        <span class="ciclo-materia-nome">${escapeHtml(m.nome)}</span>
        <span class="badge ${concluida ? 'success' : 'muted'}">${concluida ? 'Concluído' : `peso ${m.peso}`}</span>
      </div>
      <div class="pct-bar-wrap mt-8" style="min-width:auto;">
        <div class="pct-bar" style="flex:1;"><span style="width:${pct}%"></span></div>
        <span class="num">${_formatarMinutos(m.minutosFeitos)} / ${_formatarMinutos(meta)}</span>
      </div>
      <div class="ciclo-materia-acoes">
        ${emAndamento
          ? `<span class="text-muted" style="font-size:12.5px;align-self:center;">Em andamento…</span>`
          : `<button class="btn btn-sm" data-iniciar="${m.id}" ${sessaoAtiva ? 'disabled' : ''}>Iniciar</button>
             <button class="btn btn-sm btn-ghost" data-manual="${m.id}">+ tempo manual</button>`
        }
      </div>
    </div>
  `;
}

function _iniciarCronometroVisual() {
  clearInterval(_cicloTimerInterval);
  function tick() {
    const sessaoAtiva = settings.cicloSessaoAtiva;
    const span = $('#ciclo-cronometro');
    if (!sessaoAtiva || !span) { clearInterval(_cicloTimerInterval); return; }
    const seg = Math.floor((Date.now() - sessaoAtiva.inicio) / 1000);
    span.textContent = _formatarCronometro(seg);
  }
  tick();
  _cicloTimerInterval = setInterval(tick, 1000);
}

async function _concluirSessaoCiclo(view) {
  const sessaoAtiva = settings.cicloSessaoAtiva;
  if (!sessaoAtiva) return;
  clearInterval(_cicloTimerInterval);
  const minutos = (Date.now() - sessaoAtiva.inicio) / 60000;
  const materia = state.cicloMaterias.find(m => m.id === sessaoAtiva.materiaId);
  if (materia && minutos > 0) {
    materia.minutosFeitos += minutos;
    await db.cicloMaterias.update(materia);
    await db.cicloSessoes.add({
      cicloMateriaId: materia.id, nome: materia.nome, data: todayISO(),
      minutos, inicio: new Date(sessaoAtiva.inicio).toISOString(), fim: new Date().toISOString()
    });
  }
  settings.cicloSessaoAtiva = null;
  await reloadState();
  showToast(`Sessão registrada: ${_formatarMinutos(minutos)}`, 'success');
  renderCicloEstudos(view);
}

function _cancelarSessaoCiclo(view) {
  if (!confirm('Cancelar esta sessão sem salvar o tempo estudado?')) return;
  clearInterval(_cicloTimerInterval);
  settings.cicloSessaoAtiva = null;
  renderCicloEstudos(view);
}
