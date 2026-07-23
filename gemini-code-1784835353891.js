/* ============================================================
   TELA: DASHBOARD
   ============================================================ */

/**
 * Renderiza o resumo das estatísticas registradas hoje no Dashboard.
 */
function renderResumoHojeDashboard() {
  const container = $('#card-resumo-hoje');
  if (!container) return;

  const hoje = todayISO();
  const tentativasHoje = state.tentativas.filter(t => t.data === hoje);
  const resumo = calcResumo(tentativasHoje);

  if (resumo.total === 0) {
    container.innerHTML = `
      <div class="card-title">📅 Resumo do Dia (Hoje)</div>
      <p class="text-muted" style="font-size:13.5px;margin-top:0;">
        Nenhuma questão resolvida hoje ainda. Registre uma tentativa para acompanhar seu progresso diário!
      </p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card-title">📅 Resumo do Dia (Hoje)</div>
    <div class="stat-grid mt-8" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
      <div class="stat-card">
        <div class="label">Total de questões</div>
        <div class="value">${resumo.total}</div>
      </div>
      <div class="stat-card success">
        <div class="label">Acertos</div>
        <div class="value">${resumo.certas}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">Erros</div>
        <div class="value">${resumo.erradas}</div>
      </div>
      <div class="stat-card gold">
        <div class="label">Aproveitamento</div>
        <div class="value">${fmtPct(resumo.taxa)}</div>
      </div>
      <div class="stat-card info">
        <div class="label">Tentativas</div>
        <div class="value">${resumo.tentativas}</div>
      </div>
    </div>
  `;
}

function renderDashboard(view) {
  const filtro = state.dashboardFiltro;
  const { inicio, fim } = resolverPeriodo(filtro);
  const lista = filtrarTentativasPorPeriodo(inicio, fim);
  const resumo = calcResumo(lista);
  const streak = calcSequenciaDias();

  const diasNoPeriodo = Math.max(1, (new Date(fim) - new Date(inicio)) / 86400000 + 1);
  const mediaDiaria = resumo.total / diasNoPeriodo;

  const porDisciplina = agruparPor(lista, 'disciplina').slice(0, 6);
  const trilha = calcTrilhaDias(30);

  // Tempo total estudado HOJE (Ciclo de Estudos), independente do filtro
  // de período escolhido acima — é sempre "hoje" mesmo.
  const hojeISO = todayISO();
  const minutosHoje = state.cicloSessoes
    .filter(s => s.data === hojeISO)
    .reduce((soma, s) => soma + (s.minutos || 0), 0);

  view.innerHTML = `
    <div class="filter-bar" id="dash-filters">
      ${['hoje', '7d', '30d', '90d', 'custom'].map(t => `
        <button class="chip ${filtro.tipo === t ? 'active' : ''}" data-filtro="${t}">
          ${{hoje:'Hoje', '7d':'Últimos 7 dias', '30d':'Últimos 30 dias', '90d':'Últimos 90 dias', custom:'Personalizado'}[t]}
        </button>
      `).join('')}
      <div id="custom-range" style="display:${filtro.tipo === 'custom' ? 'flex' : 'none'};gap:8px;align-items:center;">
        <input type="date" id="filtro-inicio" min="2015-01-01" max="${daysAgoISO(-1)}" value="${filtro.inicio || daysAgoISO(6)}">
        <span class="text-muted">até</span>
        <input type="date" id="filtro-fim" min="2015-01-01" max="${daysAgoISO(-1)}" value="${filtro.fim || todayISO()}">
      </div>
    </div>

    <!-- Container do Resumo de Hoje adicionado abaixo -->
    <div class="card mb-12" id="card-resumo-hoje"></div>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total de questões</div><div class="value">${resumo.total}</div></div>
      <div class="stat-card success"><div class="label">Questões certas</div><div class="value">${resumo.certas}</div></div>
      <div class="stat-card danger"><div class="label">Questões erradas</div><div class="value">${resumo.erradas}</div></div>
      <div class="stat-card gold"><div class="label">Taxa de acerto</div><div class="value">${fmtPct(resumo.taxa)}</div></div>
      <div class="stat-card info"><div class="label">Tentativas registradas</div><div class="value">${resumo.tentativas}</div></div>
      <div class="stat-card"><div class="label">Média de questões/dia</div><div class="value">${mediaDiaria.toFixed(1)}</div></div>
      <div class="stat-card gold"><div class="label">Sequência de dias</div><div class="value">${streak} 🔥</div></div>
      <div class="stat-card info"><div class="label">Tempo estudado hoje</div><div class="value">${_formatarMinutos(minutosHoje)}</div></div>
    </div>

    <div class="card mb-12" id="card-prioridade-revisao"></div>

    <div class="grid-2 mb-12">
      <div class="card">
        <div class="card-title">Acertos × Erros</div>
        <div class="chart-wrap"><canvas id="chart-pizza"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Questões por disciplina</div>
        <div class="chart-wrap"><canvas id="chart-barras"></canvas></div>
      </div>
    </div>

    <div class="card mb-12">
      <div class="card-title">Evolução — últimos dias</div>
      <div class="chart-wrap tall"><canvas id="chart-linha"></canvas></div>
    </div>

    <div class="card">
      <div class="card-title">Trilha de estudo — últimos 30 dias</div>
      <div class="streak-strip">
        ${trilha.map(d => `<div class="streak-dot" data-level="${nivelStreakDot(d)}" title="${toBRDate(d.iso)} · ${d.count} questão(ões)"></div>`).join('')}
      </div>
    </div>

    <div class="card mt-12" id="card-tempo-por-tipo-ciclo"></div>

    <div class="card mt-12" id="card-correlacao-tipo-taxa"></div>

    ${buildDashboardEditalHTML()}

    <div class="card mt-12" id="card-stats-disciplina"></div>
  `;

  // filtros
  $$('#dash-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.dashboardFiltro.tipo = chip.dataset.filtro;
      renderDashboard(view);
    });
  });
  const inicioInput = $('#filtro-inicio');
  const fimInput = $('#filtro-fim');
  if (inicioInput) inicioInput.addEventListener('change', () => {
    state.dashboardFiltro.tipo = 'custom';
    state.dashboardFiltro.inicio = inicioInput.value;
    renderDashboard(view);
  });
  if (fimInput) fimInput.addEventListener('change', () => {
    state.dashboardFiltro.tipo = 'custom';
    state.dashboardFiltro.fim = fimInput.value;
    renderDashboard(view);
  });

  // gráficos
  renderPieChart('chart-pizza', { acertos: resumo.certas, erros: resumo.erradas });
  renderBarChart('chart-barras', {
    labels: porDisciplina.map(d => d.nome),
    certas: porDisciplina.map(d => d.certas),
    erradas: porDisciplina.map(d => d.erradas)
  });

  // evolução: agrupa por dia dentro do período (ou últimos 60 dias se período muito curto)
  const diasEvolucao = [];
  const nDias = Math.min(60, diasNoPeriodo);
  for (let i = nDias - 1; i >= 0; i--) {
    const iso = daysAgoISO(i);
    if (iso < inicio) continue;
    const ts = state.tentativas.filter(t => t.data === iso);
    const r = calcResumo(ts);
    diasEvolucao.push({ iso, certas: r.certas, total: r.total });
  }
  renderLineChart('chart-linha', {
    labels: diasEvolucao.map(d => toBRDate(d.iso).slice(0, 5)),
    series: [
      { label: 'Certas', data: diasEvolucao.map(d => d.certas) },
      { label: 'Total', data: diasEvolucao.map(d => d.total) }
    ]
  });

  // Chamada do card de resumo de hoje adicionada
  renderResumoHojeDashboard();

  initDashboardEditalChart();
  renderStatsPorDisciplina();
  renderTempoPorTipoCicloDashboard();
  renderPrioridadeRevisao();
  renderCorrelacaoTipoTaxa();
}