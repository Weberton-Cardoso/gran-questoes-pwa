/**
 * app.js
 * Roteador (hash-based), renderização das telas, formulários e
 * cálculo de estatísticas do app "Trilha de Aprovação".
 */

/* ============================================================
   HELPERS GERAIS
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() { return Math.random().toString(36).slice(2, 9); }

function pad(n) { return String(n).padStart(2, '0'); }

/** Formata Date -> 'YYYY-MM-DD' (usado como chave interna) */
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formata 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
function toBRDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() { return toISODate(new Date()); }

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function fmtPct(n) {
  if (!isFinite(n)) return '0%';
  return `${n.toFixed(1)}%`;
}

function fmtTempo(totalSegundos) {
  const s = Math.round(totalSegundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = '') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ============================================================
   CONFIGURAÇÕES LEVES — localStorage
   ============================================================ */

const settings = {
  get theme() { return localStorage.getItem('ta_theme') || 'dark'; },
  set theme(v) { localStorage.setItem('ta_theme', v); },
  get sidebarCollapsed() { return localStorage.getItem('ta_sidebar_collapsed') === '1'; },
  set sidebarCollapsed(v) { localStorage.setItem('ta_sidebar_collapsed', v ? '1' : '0'); }
};

function applyTheme() {
  document.documentElement.setAttribute('data-theme', settings.theme);
}

/* ============================================================
   ESTADO EM MEMÓRIA (cache simples para evitar reconsultas)
   ============================================================ */

const state = {
  questoes: [],
  editais: [],
  simulados: [],
  dashboardFiltro: { tipo: '7d', inicio: null, fim: null }
};

async function reloadState() {
  const [questoes, editais, simulados] = await Promise.all([
    db.questoes.getAll(), db.editais.getAll(), db.simulados.getAll()
  ]);
  state.questoes = questoes;
  state.editais = editais;
  state.simulados = simulados;
}

/* ============================================================
   SIDEBAR / NAVEGAÇÃO
   ============================================================ */

function initSidebar() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');

  if (settings.sidebarCollapsed) sidebar.classList.add('collapsed');

  $('#sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    settings.sidebarCollapsed = sidebar.classList.contains('collapsed');
  });

  $('#mobile-menu-btn').addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('show');
  });

  // Submenus recolhíveis (Estatísticas)
  $$('.nav-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.nav-group').classList.toggle('open');
    });
  });
}

function closeMobileSidebar() {
  $('#sidebar').classList.remove('mobile-open');
  $('#sidebar-overlay').classList.remove('show');
}

function updateActiveNav(route) {
  $$('.nav-item[data-route], .nav-submenu a[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  // Abre o submenu de estatísticas se a rota atual estiver dentro dele
  if (route.startsWith('estatisticas/')) {
    $('.nav-group[data-group]')?.classList.add('open');
    $('.nav-group')?.classList.add('open');
  }
}

/* ============================================================
   ROTEADOR
   ============================================================ */

const PAGE_TITLES = {
  'dashboard': 'Dashboard',
  'questoes': 'Questões',
  'estatisticas/disciplinas': 'Estatísticas por Disciplina',
  'estatisticas/assuntos': 'Estatísticas por Assunto',
  'estatisticas/bancas': 'Estatísticas por Banca',
  'estatisticas/concursos': 'Estatísticas por Concurso',
  'editais': 'Editais',
  'simulados': 'Simulados',
  'configuracoes': 'Configurações'
};

async function router() {
  const hash = location.hash.replace(/^#\//, '') || 'dashboard';
  const [base, sub, sub2] = hash.split('/');
  const routeKey = sub ? `${base}/${sub}` : base;

  closeMobileSidebar();
  await reloadState();

  const view = $('#view');
  view.innerHTML = '';

  if (base === 'dashboard') {
    $('#page-title').textContent = PAGE_TITLES['dashboard'];
    updateActiveNav('dashboard');
    renderDashboard(view);
  } else if (base === 'questoes') {
    $('#page-title').textContent = PAGE_TITLES['questoes'];
    updateActiveNav('questoes');
    renderQuestoes(view);
  } else if (base === 'estatisticas') {
    if (sub === 'disciplinas' && sub2) {
      $('#page-title').textContent = `Disciplina: ${decodeURIComponent(sub2)}`;
      updateActiveNav('estatisticas/disciplinas');
      renderDisciplinaDetalhe(view, decodeURIComponent(sub2));
    } else {
      $('#page-title').textContent = PAGE_TITLES[routeKey] || 'Estatísticas';
      updateActiveNav(routeKey);
      renderAgrupamento(view, sub);
    }
  } else if (base === 'editais') {
    if (sub) {
      $('#page-title').textContent = 'Detalhe do Edital';
      updateActiveNav('editais');
      renderEditalDetalhe(view, sub);
    } else {
      $('#page-title').textContent = PAGE_TITLES['editais'];
      updateActiveNav('editais');
      renderEditais(view);
    }
  } else if (base === 'simulados') {
    $('#page-title').textContent = PAGE_TITLES['simulados'];
    updateActiveNav('simulados');
    renderSimulados(view);
  } else if (base === 'configuracoes') {
    $('#page-title').textContent = PAGE_TITLES['configuracoes'];
    updateActiveNav('configuracoes');
    renderConfiguracoes(view);
  } else {
    view.innerHTML = '<div class="empty-state"><p>Página não encontrada.</p></div>';
  }

  updateStreakMini();
}

/* ============================================================
   CÁLCULO DE ESTATÍSTICAS (funções puras sobre state.questoes)
   ============================================================ */

/** Filtra questões dentro de um intervalo de datas (inclusive), formato ISO 'YYYY-MM-DD' */
function filtrarQuestoesPorPeriodo(inicio, fim) {
  return state.questoes.filter(q => q.data >= inicio && q.data <= fim);
}

/** Resolve o filtro do dashboard em { inicio, fim } */
function resolverPeriodo(filtro) {
  const hoje = todayISO();
  switch (filtro.tipo) {
    case 'hoje': return { inicio: hoje, fim: hoje };
    case '7d': return { inicio: daysAgoISO(6), fim: hoje };
    case '30d': return { inicio: daysAgoISO(29), fim: hoje };
    case '90d': return { inicio: daysAgoISO(89), fim: hoje };
    case 'custom': return { inicio: filtro.inicio || daysAgoISO(6), fim: filtro.fim || hoje };
    default: return { inicio: daysAgoISO(6), fim: hoje };
  }
}

function calcResumo(lista) {
  const total = lista.length;
  const certas = lista.filter(q => q.correta).length;
  const erradas = total - certas;
  const taxa = total ? (certas / total) * 100 : 0;
  const tempoTotal = lista.reduce((acc, q) => acc + (Number(q.tempoGasto) || 0), 0);
  return { total, certas, erradas, taxa, tempoTotal };
}

/** Sequência de dias consecutivos (até hoje) com pelo menos 1 questão respondida */
function calcSequenciaDias() {
  const diasComQuestao = new Set(state.questoes.map(q => q.data));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const iso = toISODate(cursor);
    if (diasComQuestao.has(iso)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Últimos N dias como array de {iso, count, correctRatio} para a trilha visual */
function calcTrilhaDias(n = 30) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const iso = daysAgoISO(i);
    const qs = state.questoes.filter(q => q.data === iso);
    const certas = qs.filter(q => q.correta).length;
    dias.push({ iso, count: qs.length, ratio: qs.length ? certas / qs.length : 0 });
  }
  return dias;
}

function nivelStreakDot(dia) {
  if (dia.count === 0) return 0;
  if (dia.ratio >= 0.8) return 3;
  if (dia.ratio >= 0.5) return 2;
  return 1;
}

function updateStreakMini() {
  const streak = calcSequenciaDias();
  $('#streak-mini-count').textContent = `${streak} dia${streak === 1 ? '' : 's'}`;
}

/** Agrupa questões por uma chave (disciplina, assunto, banca, concurso) */
function agruparPor(lista, chave) {
  const mapa = new Map();
  lista.forEach(q => {
    const valor = (q[chave] || '(Não informado)').trim() || '(Não informado)';
    if (!mapa.has(valor)) mapa.set(valor, []);
    mapa.get(valor).push(q);
  });
  const resultado = [];
  mapa.forEach((qs, nome) => {
    const r = calcResumo(qs);
    resultado.push({ nome, ...r });
  });
  resultado.sort((a, b) => b.total - a.total);
  return resultado;
}

/* ============================================================
   TELA: DASHBOARD
   ============================================================ */

function renderDashboard(view) {
  const filtro = state.dashboardFiltro;
  const { inicio, fim } = resolverPeriodo(filtro);
  const lista = filtrarQuestoesPorPeriodo(inicio, fim);
  const resumo = calcResumo(lista);
  const streak = calcSequenciaDias();

  const diasNoPeriodo = Math.max(1, (new Date(fim) - new Date(inicio)) / 86400000 + 1);
  const mediaDiaria = resumo.total / diasNoPeriodo;

  const porDisciplina = agruparPor(lista, 'disciplina').slice(0, 6);
  const trilha = calcTrilhaDias(30);

  view.innerHTML = `
    <div class="filter-bar" id="dash-filters">
      ${['hoje', '7d', '30d', '90d', 'custom'].map(t => `
        <button class="chip ${filtro.tipo === t ? 'active' : ''}" data-filtro="${t}">
          ${{hoje:'Hoje', '7d':'Últimos 7 dias', '30d':'Últimos 30 dias', '90d':'Últimos 90 dias', custom:'Personalizado'}[t]}
        </button>
      `).join('')}
      <div id="custom-range" style="display:${filtro.tipo === 'custom' ? 'flex' : 'none'};gap:8px;align-items:center;">
        <input type="date" id="filtro-inicio" value="${filtro.inicio || daysAgoISO(6)}">
        <span class="text-muted">até</span>
        <input type="date" id="filtro-fim" value="${filtro.fim || todayISO()}">
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total de questões</div><div class="value">${resumo.total}</div></div>
      <div class="stat-card success"><div class="label">Questões certas</div><div class="value">${resumo.certas}</div></div>
      <div class="stat-card danger"><div class="label">Questões erradas</div><div class="value">${resumo.erradas}</div></div>
      <div class="stat-card gold"><div class="label">Taxa de acerto</div><div class="value">${fmtPct(resumo.taxa)}</div></div>
      <div class="stat-card info"><div class="label">Tempo estudado</div><div class="value">${fmtTempo(resumo.tempoTotal)}</div></div>
      <div class="stat-card"><div class="label">Média diária</div><div class="value">${mediaDiaria.toFixed(1)}</div></div>
      <div class="stat-card gold"><div class="label">Sequência de dias</div><div class="value">${streak} 🔥</div></div>
    </div>

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

  // evolução: agrupa por dia dentro do período (ou últimos 14 dias se período muito curto)
  const diasEvolucao = [];
  const nDias = Math.min(60, diasNoPeriodo);
  for (let i = nDias - 1; i >= 0; i--) {
    const iso = daysAgoISO(i);
    if (iso < inicio) continue;
    const qs = state.questoes.filter(q => q.data === iso);
    diasEvolucao.push({ iso, certas: qs.filter(q => q.correta).length, total: qs.length });
  }
  renderLineChart('chart-linha', {
    labels: diasEvolucao.map(d => toBRDate(d.iso).slice(0, 5)),
    series: [
      { label: 'Certas', data: diasEvolucao.map(d => d.certas) },
      { label: 'Total', data: diasEvolucao.map(d => d.total) }
    ]
  });
}

/* ============================================================
   TELA: QUESTÕES (lista + CRUD)
   ============================================================ */

let _questoesBusca = '';

function renderQuestoes(view) {
  view.innerHTML = `
    <div class="toolbar">
      <input type="text" class="search-input" id="busca-questoes" placeholder="Pesquisar por disciplina, assunto, banca ou concurso..." value="${escapeHtml(_questoesBusca)}">
      <button class="btn btn-primary" id="btn-nova-questao"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg> Nova questão</button>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-wrap" id="tabela-questoes"></div>
    </div>
  `;

  $('#btn-nova-questao').addEventListener('click', () => openQuestaoModal());
  const buscaInput = $('#busca-questoes');
  buscaInput.addEventListener('input', () => {
    _questoesBusca = buscaInput.value;
    renderTabelaQuestoes();
  });

  renderTabelaQuestoes();

  function renderTabelaQuestoes() {
    const termo = _questoesBusca.trim().toLowerCase();
    let lista = [...state.questoes].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    if (termo) {
      lista = lista.filter(q =>
        [q.disciplina, q.assunto, q.banca, q.concurso].some(v => (v || '').toLowerCase().includes(termo))
      );
    }

    const wrap = $('#tabela-questoes');
    if (!lista.length) {
      wrap.innerHTML = `<div class="empty-state">
        <p>Nenhuma questão cadastrada ainda.</p>
        <button class="btn btn-primary" id="empty-add-questao">Adicionar primeira questão</button>
      </div>`;
      $('#empty-add-questao')?.addEventListener('click', () => openQuestaoModal());
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Disciplina</th><th>Assunto</th><th>Banca</th><th>Concurso</th>
            <th>Resultado</th><th>Tempo</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(q => `
            <tr>
              <td class="num">${toBRDate(q.data)}</td>
              <td>${escapeHtml(q.disciplina) || '-'}</td>
              <td>${escapeHtml(q.assunto) || '-'}</td>
              <td>${escapeHtml(q.banca) || '-'}</td>
              <td>${escapeHtml(q.concurso) || '-'}</td>
              <td><span class="badge ${q.correta ? 'success' : 'danger'}">${q.correta ? 'Certa' : 'Errada'}</span></td>
              <td class="num">${q.tempoGasto ? fmtTempo(q.tempoGasto) : '-'}</td>
              <td>
                <div class="flex gap-8">
                  <button class="icon-btn" data-edit="${q.id}" title="Editar">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>
                  </button>
                  <button class="icon-btn" data-del="${q.id}" title="Excluir">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12l-1 14H7zM9 4h6l1 2H8zM9 10v8M12 10v8M15 10v8"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    $$('[data-edit]', wrap).forEach(btn => btn.addEventListener('click', () => {
      const q = state.questoes.find(x => x.id === Number(btn.dataset.edit));
      openQuestaoModal(q);
    }));
    $$('[data-del]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta questão?')) return;
      await db.questoes.remove(Number(btn.dataset.del));
      await reloadState();
      renderTabelaQuestoes();
      updateStreakMini();
      showToast('Questão excluída.', 'danger');
    }));
  }
}

/* ---- Modal de cadastro/edição de questão ---- */

function openQuestaoModal(questao = null) {
  const isEdit = !!questao;
  const q = questao || { data: todayISO(), correta: true };

  openModal(`
    <h2>${isEdit ? 'Editar questão' : 'Nova questão'}</h2>
    <form id="form-questao">
      <div class="form-grid-2">
        <div class="form-row">
          <label>Disciplina</label>
          <input type="text" name="disciplina" required value="${escapeHtml(q.disciplina)}" placeholder="Ex: Direito Constitucional">
        </div>
        <div class="form-row">
          <label>Assunto</label>
          <input type="text" name="assunto" value="${escapeHtml(q.assunto)}" placeholder="Ex: Controle de Constitucionalidade">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Banca</label>
          <input type="text" name="banca" value="${escapeHtml(q.banca)}" placeholder="Ex: CESPE/CEBRASPE">
        </div>
        <div class="form-row">
          <label>Concurso</label>
          <input type="text" name="concurso" value="${escapeHtml(q.concurso)}" placeholder="Ex: PF - Agente">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Data</label>
          <input type="date" name="data" required value="${q.data}">
        </div>
        <div class="form-row">
          <label>Tempo gasto (segundos, opcional)</label>
          <input type="number" name="tempoGasto" min="0" value="${q.tempoGasto || ''}" placeholder="Ex: 90">
        </div>
      </div>
      <div class="form-row">
        <label>Resultado</label>
        <div class="toggle-group">
          <button type="button" class="tg-correta ${q.correta ? 'on correta' : ''}" data-val="true">Certa</button>
          <button type="button" class="tg-correta ${!q.correta ? 'on errada' : ''}" data-val="false">Errada</button>
        </div>
      </div>
      <div class="form-row">
        <label>Observações (opcional)</label>
        <textarea name="observacoes" placeholder="Anotações sobre a questão...">${escapeHtml(q.observacoes)}</textarea>
      </div>
      <input type="hidden" name="correta" value="${q.correta ? 'true' : 'false'}">
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-questao">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Salvar alterações' : 'Adicionar questão'}</button>
      </div>
    </form>
  `);

  const form = $('#form-questao');
  const hiddenCorreta = form.querySelector('input[name="correta"]');
  $$('.tg-correta', form).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tg-correta', form).forEach(b => b.classList.remove('on', 'correta', 'errada'));
      const isCerta = btn.dataset.val === 'true';
      btn.classList.add('on', isCerta ? 'correta' : 'errada');
      hiddenCorreta.value = btn.dataset.val;
    });
  });

  $('#btn-cancelar-questao').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const obj = {
      disciplina: fd.get('disciplina').trim(),
      assunto: fd.get('assunto').trim(),
      banca: fd.get('banca').trim(),
      concurso: fd.get('concurso').trim(),
      data: fd.get('data'),
      tempoGasto: fd.get('tempoGasto') ? Number(fd.get('tempoGasto')) : 0,
      correta: fd.get('correta') === 'true',
      observacoes: fd.get('observacoes').trim()
    };
    if (isEdit) {
      await db.questoes.update({ id: q.id, ...obj });
      showToast('Questão atualizada.', 'success');
    } else {
      await db.questoes.add(obj);
      showToast('Questão adicionada.', 'success');
    }
    closeModal();
    await reloadState();
    router();
  });
}

/* ============================================================
   TELA: ESTATÍSTICAS (agrupamentos: disciplina/assunto/banca/concurso)
   ============================================================ */

const AGRUPAMENTO_CONFIG = {
  disciplinas: { chave: 'disciplina', titulo: 'Disciplina', clicavel: true },
  assuntos: { chave: 'assunto', titulo: 'Assunto', clicavel: false },
  bancas: { chave: 'banca', titulo: 'Banca', clicavel: false },
  concursos: { chave: 'concurso', titulo: 'Concurso', clicavel: false }
};

function renderAgrupamento(view, tipo) {
  const cfg = AGRUPAMENTO_CONFIG[tipo] || AGRUPAMENTO_CONFIG.disciplinas;
  const dados = agruparPor(state.questoes, cfg.chave);

  if (!dados.length) {
    view.innerHTML = `<div class="empty-state"><p>Nenhuma questão cadastrada para gerar estatísticas por ${cfg.titulo.toLowerCase()}.</p></div>`;
    return;
  }

  const isRanking = tipo === 'bancas';

  view.innerHTML = `
    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${isRanking ? '<th>#</th>' : ''}
              <th>${cfg.titulo}</th><th>Certas</th><th>Erradas</th><th>Total</th><th>% de acerto</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map((d, i) => `
              <tr class="${cfg.clicavel ? 'clickable' : ''}" ${cfg.clicavel ? `data-nome="${escapeHtml(d.nome)}"` : ''}>
                ${isRanking ? `<td class="num">${i + 1}º</td>` : ''}
                <td>${escapeHtml(d.nome)}</td>
                <td class="num badge success" style="background:none;color:var(--success)">${d.certas}</td>
                <td class="num" style="color:var(--danger)">${d.erradas}</td>
                <td class="num">${d.total}</td>
                <td>
                  <div class="pct-bar-wrap">
                    <div class="pct-bar"><span style="width:${d.taxa.toFixed(1)}%"></span></div>
                    <span class="num">${fmtPct(d.taxa)}</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (cfg.clicavel) {
    $$('tr[data-nome]').forEach(tr => {
      tr.addEventListener('click', () => {
        location.hash = `#/estatisticas/disciplinas/${encodeURIComponent(tr.dataset.nome)}`;
      });
    });
  }
}

/* ---- Detalhe de uma disciplina específica ---- */

function renderDisciplinaDetalhe(view, nomeDisciplina) {
  const lista = state.questoes.filter(q => (q.disciplina || '(Não informado)') === nomeDisciplina);
  const resumo = calcResumo(lista);
  const porAssunto = agruparPor(lista, 'assunto');

  // evolução: últimos 30 dias, apenas questões desta disciplina
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const iso = daysAgoISO(i);
    const qs = lista.filter(q => q.data === iso);
    dias.push({ iso, certas: qs.filter(q => q.correta).length, total: qs.length });
  }

  view.innerHTML = `
    <div class="flex mb-12"><a href="#/estatisticas/disciplinas" class="btn btn-ghost btn-sm">&larr; Voltar</a></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total</div><div class="value">${resumo.total}</div></div>
      <div class="stat-card success"><div class="label">Certas</div><div class="value">${resumo.certas}</div></div>
      <div class="stat-card danger"><div class="label">Erradas</div><div class="value">${resumo.erradas}</div></div>
      <div class="stat-card gold"><div class="label">% de acerto</div><div class="value">${fmtPct(resumo.taxa)}</div></div>
    </div>

    <div class="card mb-12">
      <div class="card-title">Evolução</div>
      <div class="chart-wrap"><canvas id="chart-disciplina-evolucao"></canvas></div>
    </div>

    <div class="section-title">Assuntos estudados</div>
    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Assunto</th><th>Certas</th><th>Erradas</th><th>Total</th><th>% de acerto</th></tr></thead>
          <tbody>
            ${porAssunto.map(a => `
              <tr>
                <td>${escapeHtml(a.nome)}</td>
                <td class="num" style="color:var(--success)">${a.certas}</td>
                <td class="num" style="color:var(--danger)">${a.erradas}</td>
                <td class="num">${a.total}</td>
                <td>
                  <div class="pct-bar-wrap">
                    <div class="pct-bar"><span style="width:${a.taxa.toFixed(1)}%"></span></div>
                    <span class="num">${fmtPct(a.taxa)}</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-title">Histórico de questões</div>
    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Assunto</th><th>Banca</th><th>Resultado</th></tr></thead>
          <tbody>
            ${[...lista].sort((a, b) => b.data.localeCompare(a.data)).map(q => `
              <tr>
                <td class="num">${toBRDate(q.data)}</td>
                <td>${escapeHtml(q.assunto) || '-'}</td>
                <td>${escapeHtml(q.banca) || '-'}</td>
                <td><span class="badge ${q.correta ? 'success' : 'danger'}">${q.correta ? 'Certa' : 'Errada'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderLineChart('chart-disciplina-evolucao', {
    labels: dias.map(d => toBRDate(d.iso).slice(0, 5)),
    series: [
      { label: 'Certas', data: dias.map(d => d.certas) },
      { label: 'Total', data: dias.map(d => d.total) }
    ]
  });
}

/* ============================================================
   TELA: EDITAIS
   ============================================================ */

function calcProgressoEdital(edital) {
  let total = 0, concluidos = 0, emEstudo = 0;
  (edital.materias || []).forEach(m => {
    (m.topicos || []).forEach(t => {
      total++;
      if (t.status === 'concluido') concluidos++;
      if (t.status === 'em_estudo') emEstudo++;
    });
  });
  const pct = total ? (concluidos / total) * 100 : 0;
  return { total, concluidos, emEstudo, pendentes: total - concluidos - emEstudo, pct };
}

function renderEditais(view) {
  view.innerHTML = `
    <div class="toolbar">
      <div class="text-muted">Organize as matérias e tópicos do seu edital e acompanhe o progresso.</div>
      <button class="btn btn-primary" id="btn-novo-edital">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
        Novo edital
      </button>
    </div>
    <div id="lista-editais"></div>
  `;

  $('#btn-novo-edital').addEventListener('click', () => openEditalFormModal());
  renderListaEditais();

  function renderListaEditais() {
    const wrap = $('#lista-editais');
    if (!state.editais.length) {
      wrap.innerHTML = `<div class="empty-state">
        <p>Nenhum edital cadastrado ainda.</p>
        <button class="btn btn-primary" id="empty-add-edital">Cadastrar edital</button>
      </div>`;
      $('#empty-add-edital')?.addEventListener('click', () => openEditalFormModal());
      return;
    }
    wrap.innerHTML = `<div class="grid-3">
      ${state.editais.map(e => {
        const prog = calcProgressoEdital(e);
        return `
        <div class="card clickable" data-edital="${e.id}" style="cursor:pointer;">
          <div class="card-title">${escapeHtml(e.concurso || 'Edital')}</div>
          <h3 style="margin:0 0 10px;font-family:var(--font-display);">${escapeHtml(e.nome)}</h3>
          <div class="pct-bar-wrap mb-12">
            <div class="pct-bar"><span style="width:${prog.pct.toFixed(1)}%"></span></div>
            <span class="num">${fmtPct(prog.pct)}</span>
          </div>
          <div class="text-muted" style="font-size:13px;">${prog.concluidos}/${prog.total} tópicos concluídos</div>
        </div>`;
      }).join('')}
    </div>`;
    $$('[data-edital]', wrap).forEach(card => {
      card.addEventListener('click', () => { location.hash = `#/editais/${card.dataset.edital}`; });
    });
  }
}

function openEditalFormModal() {
  openModal(`
    <h2>Novo edital</h2>
    <form id="form-edital">
      <div class="form-row">
        <label>Nome do edital</label>
        <input type="text" name="nome" required placeholder="Ex: Edital PF 2026">
      </div>
      <div class="form-row">
        <label>Concurso</label>
        <input type="text" name="concurso" placeholder="Ex: Polícia Federal - Agente">
      </div>
      <div class="form-row">
        <label>Matérias e tópicos</label>
        <textarea name="estrutura" rows="8" placeholder="Português
  Interpretação de Texto
  Crase
  Pontuação
Direito Constitucional
  Poder Constituinte
  Direitos Fundamentais" required></textarea>
        <span class="text-muted" style="font-size:12.5px;">Uma matéria por linha sem recuo, e os tópicos indentados com espaço/tab na linha de baixo.</span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-edital">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-block">Criar edital</button>
      </div>
    </form>
  `);

  $('#btn-cancelar-edital').addEventListener('click', closeModal);
  $('#form-edital').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const linhas = fd.get('estrutura').split('\n').map(l => l.replace(/\r/, ''));
    const materias = [];
    linhas.forEach(linha => {
      if (!linha.trim()) return;
      const isTopico = /^[\s\t]/.test(linha);
      if (isTopico) {
        if (!materias.length) return;
        materias[materias.length - 1].topicos.push({ nome: linha.trim(), status: 'nao_estudado' });
      } else {
        materias.push({ nome: linha.trim(), topicos: [] });
      }
    });
    await db.editais.add({
      nome: fd.get('nome').trim(),
      concurso: fd.get('concurso').trim(),
      materias
    });
    closeModal();
    await reloadState();
    showToast('Edital criado.', 'success');
    router();
  });
}

function renderEditalDetalhe(view, idStr) {
  const id = Number(idStr);
  const edital = state.editais.find(e => e.id === id);
  if (!edital) {
    view.innerHTML = '<div class="empty-state"><p>Edital não encontrado.</p></div>';
    return;
  }
  const prog = calcProgressoEdital(edital);
  const STATUS_LABEL = { nao_estudado: 'Não estudado', em_estudo: 'Em estudo', concluido: 'Concluído' };

  view.innerHTML = `
    <div class="flex mb-12" style="justify-content:space-between;">
      <a href="#/editais" class="btn btn-ghost btn-sm">&larr; Voltar</a>
      <button class="btn btn-danger btn-sm" id="btn-del-edital">Excluir edital</button>
    </div>

    <div class="card mb-12">
      <div class="progress-ring-wrap">
        <div class="progress-ring-num">${fmtPct(prog.pct)}</div>
        <div style="flex:1;">
          <h2 style="margin:0 0 4px;font-family:var(--font-display);">${escapeHtml(edital.nome)}</h2>
          <div class="text-muted mb-12">${escapeHtml(edital.concurso || '')}</div>
          <div class="pct-bar-wrap">
            <div class="pct-bar"><span style="width:${prog.pct.toFixed(1)}%"></span></div>
          </div>
          <div class="text-muted mt-12" style="font-size:13px;">
            ${prog.concluidos} concluídos · ${prog.emEstudo} em estudo · ${prog.pendentes} pendentes
          </div>
        </div>
      </div>
    </div>

    <div id="materias-wrap"></div>
  `;

  $('#btn-del-edital').addEventListener('click', async () => {
    if (!confirm('Excluir este edital? Esta ação não pode ser desfeita.')) return;
    await db.editais.remove(id);
    await reloadState();
    showToast('Edital excluído.', 'danger');
    location.hash = '#/editais';
  });

  const materiasWrap = $('#materias-wrap');
  materiasWrap.innerHTML = (edital.materias || []).map((m, mi) => `
    <div class="edital-materia">
      <h3>${escapeHtml(m.nome)}</h3>
      ${(m.topicos || []).map((t, ti) => `
        <div class="edital-topic">
          <span>${escapeHtml(t.nome)}</span>
          <select class="status-select" data-mi="${mi}" data-ti="${ti}">
            <option value="nao_estudado" ${t.status === 'nao_estudado' ? 'selected' : ''}>Não estudado</option>
            <option value="em_estudo" ${t.status === 'em_estudo' ? 'selected' : ''}>Em estudo</option>
            <option value="concluido" ${t.status === 'concluido' ? 'selected' : ''}>Concluído</option>
          </select>
        </div>
      `).join('')}
    </div>
  `).join('');

  $$('.status-select', materiasWrap).forEach(sel => {
    sel.addEventListener('change', async () => {
      const mi = Number(sel.dataset.mi), ti = Number(sel.dataset.ti);
      edital.materias[mi].topicos[ti].status = sel.value;
      await db.editais.update(edital);
      await reloadState();
      renderEditalDetalhe(view, idStr);
    });
  });
}

/* ============================================================
   TELA: SIMULADOS
   ============================================================ */

function renderSimulados(view) {
  const lista = [...state.simulados].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  view.innerHTML = `
    <div class="toolbar">
      <div class="text-muted">Registre seus simulados e acompanhe a evolução do aproveitamento.</div>
      <button class="btn btn-primary" id="btn-novo-simulado">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
        Novo simulado
      </button>
    </div>

    ${lista.length ? `
    <div class="card mb-12">
      <div class="card-title">Evolução do aproveitamento</div>
      <div class="chart-wrap"><canvas id="chart-simulados"></canvas></div>
    </div>` : ''}

    <div class="card" style="padding:0;">
      <div class="table-wrap" id="tabela-simulados"></div>
    </div>
  `;

  $('#btn-novo-simulado').addEventListener('click', () => openSimuladoModal());

  if (lista.length) {
    const cronologico = [...lista].reverse();
    renderLineChart('chart-simulados', {
      labels: cronologico.map(s => toBRDate(s.data).slice(0, 5)),
      series: [{
        label: '% de acerto',
        data: cronologico.map(s => s.numQuestoes ? Number(((s.acertos / s.numQuestoes) * 100).toFixed(1)) : 0)
      }]
    });
  }

  const wrap = $('#tabela-simulados');
  if (!lista.length) {
    wrap.innerHTML = `<div class="empty-state">
      <p>Nenhum simulado cadastrado ainda.</p>
      <button class="btn btn-primary" id="empty-add-simulado">Cadastrar simulado</button>
    </div>`;
    $('#empty-add-simulado')?.addEventListener('click', () => openSimuladoModal());
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Nome</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>Aproveitamento</th><th>Tempo</th><th></th></tr></thead>
      <tbody>
        ${lista.map(s => {
          const pct = s.numQuestoes ? (s.acertos / s.numQuestoes) * 100 : 0;
          return `
          <tr>
            <td class="num">${toBRDate(s.data)}</td>
            <td>${escapeHtml(s.nome)}</td>
            <td class="num">${s.numQuestoes}</td>
            <td class="num" style="color:var(--success)">${s.acertos}</td>
            <td class="num" style="color:var(--danger)">${s.erros}</td>
            <td>${fmtPct(pct)}</td>
            <td class="num">${s.tempo ? fmtTempo(s.tempo) : '-'}</td>
            <td><button class="icon-btn" data-del-sim="${s.id}" title="Excluir">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12l-1 14H7zM9 4h6l1 2H8zM9 10v8M12 10v8M15 10v8"/></svg>
            </button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  $$('[data-del-sim]', wrap).forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Excluir este simulado?')) return;
    await db.simulados.remove(Number(btn.dataset.delSim));
    await reloadState();
    renderSimulados(view);
    showToast('Simulado excluído.', 'danger');
  }));
}

function openSimuladoModal() {
  openModal(`
    <h2>Novo simulado</h2>
    <form id="form-simulado">
      <div class="form-row">
        <label>Nome</label>
        <input type="text" name="nome" required placeholder="Ex: Simulado Governança e Qualidade">
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label>Data</label><input type="date" name="data" required value="${todayISO()}"></div>
        <div class="form-row"><label>Nº de questões</label><input type="number" name="numQuestoes" required min="1"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label>Acertos</label><input type="number" name="acertos" required min="0"></div>
        <div class="form-row"><label>Erros</label><input type="number" name="erros" required min="0"></div>
      </div>
      <div class="form-row">
        <label>Tempo gasto (minutos, opcional)</label>
        <input type="number" name="tempoMin" min="0" placeholder="Ex: 180">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-simulado">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-block">Salvar simulado</button>
      </div>
    </form>
  `);

  $('#btn-cancelar-simulado').addEventListener('click', closeModal);
  $('#form-simulado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.simulados.add({
      nome: fd.get('nome').trim(),
      data: fd.get('data'),
      numQuestoes: Number(fd.get('numQuestoes')),
      acertos: Number(fd.get('acertos')),
      erros: Number(fd.get('erros')),
      tempo: fd.get('tempoMin') ? Number(fd.get('tempoMin')) * 60 : 0
    });
    closeModal();
    await reloadState();
    showToast('Simulado salvo.', 'success');
    router();
  });
}

/* ============================================================
   TELA: CONFIGURAÇÕES
   ============================================================ */

function renderConfiguracoes(view) {
  view.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Aparência</div>
        <div class="form-row">
          <label>Tema</label>
          <div class="toggle-group">
            <button type="button" id="tema-escuro" class="${settings.theme === 'dark' ? 'on correta' : ''}">Escuro</button>
            <button type="button" id="tema-claro" class="${settings.theme === 'light' ? 'on correta' : ''}">Claro</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Backup</div>
        <p class="text-muted" style="font-size:13.5px;margin-top:0;">Exporte todos os seus dados (questões, editais e simulados) em um arquivo JSON, ou restaure a partir de um backup anterior.</p>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-exportar">Exportar backup (.json)</button>
          <button class="btn" id="btn-importar">Importar backup</button>
          <input type="file" id="input-importar" accept="application/json" style="display:none;">
        </div>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-title">Zona de risco</div>
      <p class="text-muted" style="font-size:13.5px;margin-top:0;">Isto apaga permanentemente questões, editais e simulados deste dispositivo.</p>
      <button class="btn btn-danger" id="btn-zerar">Zerar todas as estatísticas</button>
    </div>
  `;

  $('#tema-escuro').addEventListener('click', () => { settings.theme = 'dark'; applyTheme(); router(); });
  $('#tema-claro').addEventListener('click', () => { settings.theme = 'light'; applyTheme(); router(); });

  $('#btn-exportar').addEventListener('click', async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trilha-aprovacao-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado.', 'success');
  });

  const fileInput = $('#input-importar');
  $('#btn-importar').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('Importar este backup vai substituir todos os dados atuais. Continuar?')) return;
      await db.importAll(data, { substituir: true });
      await reloadState();
      showToast('Backup importado com sucesso.', 'success');
      router();
    } catch (err) {
      showToast('Arquivo inválido. Verifique o backup.', 'danger');
    }
    fileInput.value = '';
  });

  $('#btn-zerar').addEventListener('click', async () => {
    if (!confirm('Tem certeza? Todos os dados serão apagados permanentemente.')) return;
    await db.zerarTudo();
    await reloadState();
    showToast('Estatísticas zeradas.', 'danger');
    router();
  });
}

/* ============================================================
   SISTEMA DE MODAIS
   ============================================================ */

function openModal(innerHtml) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${innerHtml}</div></div>`;
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}

function initGlobalModalHandlers() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  initSidebar();
  initGlobalModalHandlers();

  $('#add-questao-btn').addEventListener('click', () => openQuestaoModal());

  window.addEventListener('hashchange', router);
  router();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
