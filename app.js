/**
 * app.js
 * Roteador (hash-based), renderização das telas, formulários e
 * cálculo de estatísticas do app "Trilha de Aprovação".
 *
 * Modelo de dados principal: TENTATIVA — um bloco de questões resolvidas
 * de um mesmo assunto (disciplina, assunto, banca, concurso, data,
 * quantidade de questões, acertos, erros, taxa, tipo, observações).
 * Todas as telas (dashboard, estatísticas, editais, simulados) usam
 * as tentativas como fonte única de verdade.
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

function fmtPctSigned(n) {
  if (!isFinite(n)) return '0 p.p.';
  const sinal = n > 0 ? '+' : '';
  return `${sinal}${n.toFixed(1)} p.p.`;
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
  tentativas: [],
  editais: [],
  simulados: [],
  dashboardFiltro: { tipo: '7d', inicio: null, fim: null }
};

async function reloadState() {
  const [tentativas, editais, simulados] = await Promise.all([
    db.tentativas.getAll(), db.editais.getAll(), db.simulados.getAll()
  ]);
  state.tentativas = tentativas;
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
  'tentativas': 'Tentativas',
  'estatisticas/disciplinas': 'Estatísticas por Disciplina',
  'estatisticas/assuntos': 'Estatísticas por Assunto',
  'estatisticas/bancas': 'Estatísticas por Banca',
  'estatisticas/concursos': 'Estatísticas por Concurso',
  'editais': 'Editais',
  'editais/importar': 'Importar Edital',
  'simulados': 'Simulados',
  'configuracoes': 'Configurações'
};

async function router() {
  let hash = location.hash.replace(/^#\//, '') || 'dashboard';
  // compatibilidade com links antigos (versão baseada em questões individuais)
  if (hash === 'questoes' || hash.startsWith('questoes/')) {
    hash = hash.replace('questoes', 'tentativas');
  }
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
  } else if (base === 'tentativas') {
    $('#page-title').textContent = PAGE_TITLES['tentativas'];
    updateActiveNav('tentativas');
    renderTentativas(view);
  } else if (base === 'estatisticas') {
    if (sub === 'disciplinas' && sub2) {
      $('#page-title').textContent = `Disciplina: ${decodeURIComponent(sub2)}`;
      updateActiveNav('estatisticas/disciplinas');
      renderDisciplinaDetalhe(view, decodeURIComponent(sub2));
    } else if (sub === 'assuntos' && sub2) {
      $('#page-title').textContent = `Assunto: ${decodeURIComponent(sub2)}`;
      updateActiveNav('estatisticas/assuntos');
      renderAssuntoDetalhe(view, decodeURIComponent(sub2));
    } else {
      $('#page-title').textContent = PAGE_TITLES[routeKey] || 'Estatísticas';
      updateActiveNav(routeKey);
      renderAgrupamento(view, sub);
    }
  } else if (base === 'editais') {
    if (sub === 'importar') {
      $('#page-title').textContent = 'Importar Edital';
      updateActiveNav('editais/importar');
      renderImportarEdital(view);
    } else if (sub) {
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
   CÁLCULO DE ESTATÍSTICAS (funções puras sobre state.tentativas)
   ============================================================ */

/** Filtra tentativas dentro de um intervalo de datas (inclusive), formato ISO 'YYYY-MM-DD' */
function filtrarTentativasPorPeriodo(inicio, fim) {
  return state.tentativas.filter(t => t.data >= inicio && t.data <= fim);
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

/** Resumo agregado de uma lista de tentativas (soma questões/acertos/erros) */
function calcResumo(lista) {
  const tentativas = lista.length;
  const total = lista.reduce((acc, t) => acc + (Number(t.numQuestoes) || 0), 0);
  const certas = lista.reduce((acc, t) => acc + (Number(t.acertos) || 0), 0);
  const erradas = lista.reduce((acc, t) => acc + (Number(t.erros) || 0), 0);
  const taxa = total ? (certas / total) * 100 : 0;
  return { tentativas, total, certas, erradas, taxa };
}

/** Sequência de dias consecutivos (até hoje) com pelo menos 1 tentativa registrada */
function calcSequenciaDias() {
  const diasComTentativa = new Set(state.tentativas.map(t => t.data));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const iso = toISODate(cursor);
    if (diasComTentativa.has(iso)) {
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
    const ts = state.tentativas.filter(t => t.data === iso);
    const r = calcResumo(ts);
    dias.push({ iso, count: r.total, ratio: r.total ? r.certas / r.total : 0 });
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

/** Agrupa tentativas por uma chave (disciplina, assunto, banca, concurso) */
function agruparPor(lista, chave) {
  const mapa = new Map();
  lista.forEach(t => {
    const valor = (t[chave] || '(Não informado)').trim() || '(Não informado)';
    if (!mapa.has(valor)) mapa.set(valor, []);
    mapa.get(valor).push(t);
  });
  const resultado = [];
  mapa.forEach((ts, nome) => {
    const r = calcResumo(ts);
    resultado.push({ nome, ...r });
  });
  resultado.sort((a, b) => b.total - a.total);
  return resultado;
}

/**
 * Calcula a tendência de desempenho de um assunto/agrupamento a partir de
 * uma lista de tentativas JÁ ORDENADA CRONOLOGICAMENTE (mais antiga primeiro).
 * Compara a taxa da última tentativa com a média das tentativas anteriores.
 */
function calcTendencia(tentativasOrdenadas) {
  if (tentativasOrdenadas.length < 2) {
    return { label: 'Estável', icone: '➡' };
  }
  const ultima = tentativasOrdenadas[tentativasOrdenadas.length - 1];
  const anteriores = tentativasOrdenadas.slice(0, -1);
  const mediaAnterior = anteriores.reduce((acc, t) => acc + (t.taxa || 0), 0) / anteriores.length;
  const diff = (ultima.taxa || 0) - mediaAnterior;

  if (diff >= 3) return { label: 'Melhorando', icone: '📈' };
  if (diff <= -3) return { label: 'Piorando', icone: '📉' };
  return { label: 'Estável', icone: '➡' };
}

/* ============================================================
   TELA: DASHBOARD
   ============================================================ */

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
      <div class="stat-card info"><div class="label">Tentativas registradas</div><div class="value">${resumo.tentativas}</div></div>
      <div class="stat-card"><div class="label">Média de questões/dia</div><div class="value">${mediaDiaria.toFixed(1)}</div></div>
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

    ${buildDashboardEditalHTML()}
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

  initDashboardEditalChart();
}

/* ============================================================
   TELA: TENTATIVAS (lista + CRUD do novo modelo por blocos)
   ============================================================ */

let _tentativasBusca = '';

function renderTentativas(view) {
  view.innerHTML = `
    <div class="toolbar">
      <input type="text" class="search-input" id="busca-tentativas" placeholder="Pesquisar por disciplina, assunto, banca ou concurso..." value="${escapeHtml(_tentativasBusca)}">
      <button class="btn btn-primary" id="btn-nova-tentativa"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg> Registrar tentativa</button>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-wrap" id="tabela-tentativas"></div>
    </div>
  `;

  $('#btn-nova-tentativa').addEventListener('click', () => openTentativaModal());
  const buscaInput = $('#busca-tentativas');
  buscaInput.addEventListener('input', () => {
    _tentativasBusca = buscaInput.value;
    renderTabelaTentativas();
  });

  renderTabelaTentativas();

  function renderTabelaTentativas() {
    const termo = _tentativasBusca.trim().toLowerCase();
    let lista = [...state.tentativas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    if (termo) {
      lista = lista.filter(t =>
        [t.disciplina, t.assunto, t.banca, t.concurso].some(v => (v || '').toLowerCase().includes(termo))
      );
    }

    const wrap = $('#tabela-tentativas');
    if (!lista.length) {
      wrap.innerHTML = `<div class="empty-state">
        <p>Nenhuma tentativa registrada ainda.</p>
        <button class="btn btn-primary" id="empty-add-tentativa">Registrar primeira tentativa</button>
      </div>`;
      $('#empty-add-tentativa')?.addEventListener('click', () => openTentativaModal());
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Disciplina</th><th>Assunto</th><th>Banca</th><th>Concurso</th>
            <th>Tipo</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>Taxa</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(t => `
            <tr>
              <td class="num">${toBRDate(t.data)}</td>
              <td>${escapeHtml(t.disciplina) || '-'}</td>
              <td>${escapeHtml(t.assunto) || '-'}</td>
              <td>${escapeHtml(t.banca) || '-'}</td>
              <td>${escapeHtml(t.concurso) || '-'}</td>
              <td><span class="badge muted">${escapeHtml(t.tipo) || '-'}</span></td>
              <td class="num">${t.numQuestoes}</td>
              <td class="num" style="color:var(--success)">${t.acertos}</td>
              <td class="num" style="color:var(--danger)">${t.erros}</td>
              <td class="num">${fmtPct(t.taxa)}</td>
              <td>
                <div class="flex gap-8">
                  <button class="icon-btn" data-edit="${t.id}" title="Editar">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>
                  </button>
                  <button class="icon-btn" data-del="${t.id}" title="Excluir">
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
      const t = state.tentativas.find(x => x.id === Number(btn.dataset.edit));
      openTentativaModal(t);
    }));
    $$('[data-del]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta tentativa?')) return;
      await db.tentativas.remove(Number(btn.dataset.del));
      await reloadState();
      renderTabelaTentativas();
      updateStreakMini();
      showToast('Tentativa excluída.', 'danger');
    }));
  }
}

/* ---- Modal de cadastro/edição de tentativa ---- */

function openTentativaModal(tentativa = null) {
  const isEdit = !!tentativa;
  const t = tentativa || { data: todayISO(), numQuestoes: '', acertos: '', tipo: TIPOS_TENTATIVA[0] };

  openModal(`
    <h2>${isEdit ? 'Editar tentativa' : 'Registrar tentativa'}</h2>
    <form id="form-tentativa">
      <div class="form-grid-2">
        <div class="form-row">
          <label>Disciplina</label>
          <input type="text" name="disciplina" required value="${escapeHtml(t.disciplina)}" placeholder="Ex: Direito Constitucional">
        </div>
        <div class="form-row">
          <label>Assunto</label>
          <input type="text" name="assunto" required value="${escapeHtml(t.assunto)}" placeholder="Ex: Poder Constituinte">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Banca (opcional)</label>
          <input type="text" name="banca" value="${escapeHtml(t.banca)}" placeholder="Ex: CESPE/CEBRASPE">
        </div>
        <div class="form-row">
          <label>Concurso (opcional)</label>
          <input type="text" name="concurso" value="${escapeHtml(t.concurso)}" placeholder="Ex: PF - Agente">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Data</label>
          <input type="date" name="data" required value="${t.data}">
        </div>
        <div class="form-row">
          <label>Tipo da tentativa</label>
          <select name="tipo">
            ${TIPOS_TENTATIVA.map(tp => `<option value="${tp}" ${t.tipo === tp ? 'selected' : ''}>${tp}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Quantidade de questões</label>
          <input type="number" name="numQuestoes" id="input-num-questoes" required min="1" value="${t.numQuestoes ?? ''}" placeholder="Ex: 19">
        </div>
        <div class="form-row">
          <label>Quantidade de acertos</label>
          <input type="number" name="acertos" id="input-acertos" required min="0" value="${t.acertos ?? ''}" placeholder="Ex: 14">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>Quantidade de erros</label>
          <input type="text" id="display-erros" disabled value="${isEdit ? (t.numQuestoes - t.acertos) : ''}">
        </div>
        <div class="form-row">
          <label>Taxa de acertos</label>
          <input type="text" id="display-taxa" disabled value="${isEdit ? fmtPct(t.taxa) : ''}">
        </div>
      </div>
      <div class="form-row">
        <label>Observações (opcional)</label>
        <textarea name="observacoes" placeholder="Anotações sobre essa tentativa...">${escapeHtml(t.observacoes)}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-tentativa">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Salvar alterações' : 'Salvar tentativa'}</button>
      </div>
    </form>
  `);

  const form = $('#form-tentativa');
  const numQuestoesInput = $('#input-num-questoes', form);
  const acertosInput = $('#input-acertos', form);
  const displayErros = $('#display-erros', form);
  const displayTaxa = $('#display-taxa', form);

  function atualizarCalculados() {
    const num = Number(numQuestoesInput.value) || 0;
    let acertos = Number(acertosInput.value) || 0;
    if (acertos > num) {
      acertos = num;
      acertosInput.value = num;
    }
    const erros = Math.max(0, num - acertos);
    const taxa = num ? (acertos / num) * 100 : 0;
    displayErros.value = num ? erros : '';
    displayTaxa.value = num ? fmtPct(taxa) : '';
  }
  numQuestoesInput.addEventListener('input', atualizarCalculados);
  acertosInput.addEventListener('input', atualizarCalculados);

  $('#btn-cancelar-tentativa').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const numQuestoes = Number(fd.get('numQuestoes'));
    let acertos = Number(fd.get('acertos'));
    if (acertos > numQuestoes) acertos = numQuestoes;
    const erros = numQuestoes - acertos;
    const taxa = numQuestoes ? (acertos / numQuestoes) * 100 : 0;

    const obj = {
      disciplina: fd.get('disciplina').trim(),
      assunto: fd.get('assunto').trim(),
      banca: fd.get('banca').trim(),
      concurso: fd.get('concurso').trim(),
      data: fd.get('data'),
      numQuestoes,
      acertos,
      erros,
      taxa,
      tipo: fd.get('tipo'),
      observacoes: fd.get('observacoes').trim()
    };
    if (isEdit) {
      await db.tentativas.update({ id: t.id, ...obj });
      showToast('Tentativa atualizada.', 'success');
    } else {
      await db.tentativas.add(obj);
      showToast('Tentativa registrada.', 'success');
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
  disciplinas: { chave: 'disciplina', titulo: 'Disciplina', clicavel: true, rota: 'disciplinas' },
  assuntos: { chave: 'assunto', titulo: 'Assunto', clicavel: true, rota: 'assuntos' },
  bancas: { chave: 'banca', titulo: 'Banca', clicavel: false },
  concursos: { chave: 'concurso', titulo: 'Concurso', clicavel: false }
};

function renderAgrupamento(view, tipo) {
  const cfg = AGRUPAMENTO_CONFIG[tipo] || AGRUPAMENTO_CONFIG.disciplinas;
  const dados = agruparPor(state.tentativas, cfg.chave);

  if (!dados.length) {
    view.innerHTML = `<div class="empty-state"><p>Nenhuma tentativa registrada para gerar estatísticas por ${cfg.titulo.toLowerCase()}.</p></div>`;
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
              <th>${cfg.titulo}</th><th>Tentativas</th><th>Certas</th><th>Erradas</th><th>Total</th><th>% de acerto</th>
            </tr>
          </thead>
          <tbody>
            ${dados.map((d, i) => `
              <tr class="${cfg.clicavel ? 'clickable' : ''}" ${cfg.clicavel ? `data-nome="${escapeHtml(d.nome)}"` : ''}>
                ${isRanking ? `<td class="num">${i + 1}º</td>` : ''}
                <td>${escapeHtml(d.nome)}</td>
                <td class="num">${d.tentativas}</td>
                <td class="num" style="color:var(--success)">${d.certas}</td>
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
        location.hash = `#/estatisticas/${cfg.rota}/${encodeURIComponent(tr.dataset.nome)}`;
      });
    });
  }
}

/* ---- Detalhe de uma disciplina específica ---- */

function renderDisciplinaDetalhe(view, nomeDisciplina) {
  const lista = state.tentativas.filter(t => (t.disciplina || '(Não informado)') === nomeDisciplina);
  const resumo = calcResumo(lista);
  const porAssunto = agruparPor(lista, 'assunto');

  // evolução: últimos 30 dias, apenas tentativas desta disciplina
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const iso = daysAgoISO(i);
    const ts = lista.filter(t => t.data === iso);
    const r = calcResumo(ts);
    dias.push({ iso, certas: r.certas, total: r.total });
  }

  view.innerHTML = `
    <div class="flex mb-12"><a href="#/estatisticas/disciplinas" class="btn btn-ghost btn-sm">&larr; Voltar</a></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Tentativas</div><div class="value">${resumo.tentativas}</div></div>
      <div class="stat-card"><div class="label">Total de questões</div><div class="value">${resumo.total}</div></div>
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
          <thead><tr><th>Assunto</th><th>Tentativas</th><th>Certas</th><th>Erradas</th><th>Total</th><th>% de acerto</th></tr></thead>
          <tbody>
            ${porAssunto.map(a => `
              <tr class="clickable" data-assunto="${escapeHtml(a.nome)}">
                <td>${escapeHtml(a.nome)}</td>
                <td class="num">${a.tentativas}</td>
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

    <div class="section-title">Histórico de tentativas</div>
    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Assunto</th><th>Banca</th><th>Tipo</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>Taxa</th></tr></thead>
          <tbody>
            ${[...lista].sort((a, b) => b.data.localeCompare(a.data)).map(t => `
              <tr>
                <td class="num">${toBRDate(t.data)}</td>
                <td>${escapeHtml(t.assunto) || '-'}</td>
                <td>${escapeHtml(t.banca) || '-'}</td>
                <td><span class="badge muted">${escapeHtml(t.tipo) || '-'}</span></td>
                <td class="num">${t.numQuestoes}</td>
                <td class="num" style="color:var(--success)">${t.acertos}</td>
                <td class="num" style="color:var(--danger)">${t.erros}</td>
                <td class="num">${fmtPct(t.taxa)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $$('tr[data-assunto]').forEach(tr => {
    tr.addEventListener('click', () => {
      location.hash = `#/estatisticas/assuntos/${encodeURIComponent(tr.dataset.assunto)}`;
    });
  });

  renderLineChart('chart-disciplina-evolucao', {
    labels: dias.map(d => toBRDate(d.iso).slice(0, 5)),
    series: [
      { label: 'Certas', data: dias.map(d => d.certas) },
      { label: 'Total', data: dias.map(d => d.total) }
    ]
  });
}

/* ---- Detalhe de um assunto específico: evolução por tentativa ---- */

function renderAssuntoDetalhe(view, nomeAssunto) {
  const lista = state.tentativas.filter(t => (t.assunto || '(Não informado)') === nomeAssunto);

  if (!lista.length) {
    view.innerHTML = `
      <div class="flex mb-12"><a href="#/estatisticas/assuntos" class="btn btn-ghost btn-sm">&larr; Voltar</a></div>
      <div class="empty-state"><p>Nenhuma tentativa registrada para este assunto.</p></div>
    `;
    return;
  }

  const ordenada = [...lista].sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.id - b.id));
  const resumo = calcResumo(lista);
  const melhor = ordenada.reduce((m, t) => (t.taxa > m.taxa ? t : m), ordenada[0]);
  const pior = ordenada.reduce((m, t) => (t.taxa < m.taxa ? t : m), ordenada[0]);
  const ultima = ordenada[ordenada.length - 1];
  const primeira = ordenada[0];
  const tendencia = calcTendencia(ordenada);
  const evolucaoPP = ultima.taxa - primeira.taxa;

  view.innerHTML = `
    <div class="flex mb-12"><a href="#/estatisticas/assuntos" class="btn btn-ghost btn-sm">&larr; Voltar</a></div>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total de tentativas</div><div class="value">${resumo.tentativas}</div></div>
      <div class="stat-card"><div class="label">Total de questões</div><div class="value">${resumo.total}</div></div>
      <div class="stat-card success"><div class="label">Total de acertos</div><div class="value">${resumo.certas}</div></div>
      <div class="stat-card danger"><div class="label">Total de erros</div><div class="value">${resumo.erradas}</div></div>
      <div class="stat-card gold"><div class="label">Taxa média</div><div class="value">${fmtPct(resumo.taxa)}</div></div>
      <div class="stat-card success"><div class="label">Melhor resultado</div><div class="value">${fmtPct(melhor.taxa)}</div></div>
      <div class="stat-card danger"><div class="label">Pior resultado</div><div class="value">${fmtPct(pior.taxa)}</div></div>
      <div class="stat-card info"><div class="label">Última tentativa</div><div class="value">${toBRDate(ultima.data)}</div></div>
      <div class="stat-card"><div class="label">Tendência</div><div class="value">${tendencia.icone} ${tendencia.label}</div></div>
    </div>

    <div class="card mb-12">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span>Evolução da taxa de acertos</span>
        <span class="text-muted" style="font-weight:500;font-size:13px;text-transform:none;letter-spacing:normal;">
          ${evolucaoPP >= 0 ? '📈' : '📉'} ${fmtPctSigned(evolucaoPP)} desde a primeira tentativa
        </span>
      </div>
      <div class="chart-wrap"><canvas id="chart-assunto-evolucao"></canvas></div>
    </div>

    <div class="section-title">Histórico completo</div>
    <div class="timeline">
      ${[...ordenada].reverse().map(t => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="timeline-card-head">
              <span class="timeline-date">${toBRDate(t.data)}</span>
              <span class="badge muted">${escapeHtml(t.tipo) || '-'}</span>
            </div>
            <div class="timeline-stats">
              <span><strong>${t.numQuestoes}</strong> questões</span>
              <span style="color:var(--success)"><strong>${t.acertos}</strong> acertos</span>
              <span style="color:var(--danger)"><strong>${t.erros}</strong> erros</span>
              <span class="timeline-taxa">${fmtPct(t.taxa)}</span>
            </div>
            ${t.observacoes ? `<div class="timeline-obs">${escapeHtml(t.observacoes)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  renderLineChart('chart-assunto-evolucao', {
    labels: ordenada.map(t => toBRDate(t.data).slice(0, 5)),
    series: [
      { label: '% de acerto', data: ordenada.map(t => Number(t.taxa.toFixed(1))) }
    ]
  });
}

/* ============================================================
   TELA: EDITAIS (lista)
   A importação inteligente, o quadro Kanban de cada edital e o
   cálculo de progresso (calcProgressoEdital) vivem em editais.js —
   o cadastro manual de disciplina/tópico foi substituído pela
   Importação Inteligente de Editais.
   ============================================================ */

function renderEditais(view) {
  view.innerHTML = `
    <div class="toolbar">
      <div class="text-muted">Importe o edital automaticamente e acompanhe o progresso por disciplina e tópico.</div>
      <a class="btn btn-primary" href="#/editais/importar">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
        Importar edital
      </a>
    </div>
    <div id="lista-editais"></div>
  `;

  renderListaEditais();

  function renderListaEditais() {
    const wrap = $('#lista-editais');
    if (!state.editais.length) {
      wrap.innerHTML = `<div class="empty-state">
        <p>Nenhum edital cadastrado ainda.</p>
        <a class="btn btn-primary" href="#/editais/importar">Importar edital</a>
      </div>`;
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
          <div class="text-muted" style="font-size:13px;">${prog.dominado}/${prog.total} tópicos dominados</div>
        </div>`;
      }).join('')}
    </div>`;
    $$('[data-edital]', wrap).forEach(card => {
      card.addEventListener('click', () => { location.hash = `#/editais/${card.dataset.edital}`; });
    });
  }
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

function fmtTempo(totalSegundos) {
  const s = Math.round(totalSegundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
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
        <p class="text-muted" style="font-size:13.5px;margin-top:0;">Exporte todos os seus dados (tentativas, editais e simulados) em um arquivo JSON, ou restaure a partir de um backup anterior.</p>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-exportar">Exportar backup (.json)</button>
          <button class="btn" id="btn-importar">Importar backup</button>
          <input type="file" id="input-importar" accept="application/json" style="display:none;">
        </div>
      </div>
    </div>

    <div class="card mt-12">
      <div class="card-title">Zona de risco</div>
      <p class="text-muted" style="font-size:13.5px;margin-top:0;">Isto apaga permanentemente tentativas, editais e simulados deste dispositivo.</p>
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

  $('#add-questao-btn').addEventListener('click', () => openTentativaModal());

  window.addEventListener('hashchange', router);
  router();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
