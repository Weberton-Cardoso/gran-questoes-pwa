/**
 * importar-historico.js
 * Módulo de Importação de Histórico — permite trazer para o sistema anos de
 * estatísticas já registradas em planilhas, Trello, anotações etc., sem
 * precisar cadastrar tentativa por tentativa.
 *
 * Formas de importação:
 *   1) Cadastro manual        -> reaproveita openTentativaModal() (app.js)
 *   2) Importação rápida      -> texto colado com "% + data + nº questões"
 *   3) Importação por planilha-> CSV, XLSX (SheetJS) ou tabela colada
 *   4) Importação JSON        -> backup exportado pelo próprio sistema
 *
 * Assistente em 5 passos: Tipo -> Prévia -> Validação -> Importar -> Relatório.
 * Todas as telas (dashboard, estatísticas, editais etc.) já recalculam tudo
 * sozinhas a partir de state.tentativas a cada navegação — este módulo só
 * precisa gravar no IndexedDB e chamar reloadState().
 *
 * Depende de globais já existentes em database.js/app.js/editais.js:
 * db, state, reloadState, TIPOS_TENTATIVA, $, $$, escapeHtml, showToast,
 * openModal, closeModal, openTentativaModal, todayISO, toBRDate, fmtPct,
 * _norm.
 */

/* ============================================================
   ESTADO DO ASSISTENTE
   ============================================================ */

function _estadoInicialImportHist() {
  return {
    passo: 1,
    tipo: null,          // 'texto' | 'planilha' | 'json'
    contexto: { disciplina: '', assunto: '', banca: '', concurso: '' },
    registros: [],        // candidatos parseados
    duplicataAcao: 'ignorar', // 'ignorar' | 'substituir' | 'duplicar'
    relatorio: null
  };
}

let _importHist = _estadoInicialImportHist();

/* ============================================================
   HELPERS DE PARSING
   ============================================================ */

function _parseDataFlexivel(str) {
  if (!str) return null;
  const s = str.toString().trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    d = d.padStart(2, '0'); mo = mo.padStart(2, '0');
    if (Number(mo) > 12 || Number(d) > 31) return null;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function _detectarTipoTentativa(texto) {
  const norm = _norm(texto);
  const tipos = [...TIPOS_TENTATIVA].sort((a, b) => b.length - a.length);
  for (const t of tipos) {
    if (norm.includes(_norm(t))) return t;
  }
  return null;
}

function _novoRegistro(base) {
  const numQuestoes = Number(base.numQuestoes) || 0;
  let acertos = base.acertos !== undefined && base.acertos !== null && base.acertos !== ''
    ? Number(base.acertos) : null;
  if (acertos === null && base.percentual !== undefined && base.percentual !== null) {
    acertos = Math.round((Number(base.percentual) / 100) * numQuestoes);
  }
  if (acertos === null || isNaN(acertos)) acertos = 0;
  if (acertos > numQuestoes) acertos = numQuestoes;
  const erros = Math.max(0, numQuestoes - acertos);
  const taxa = numQuestoes ? (acertos / numQuestoes) * 100 : 0;

  return {
    disciplina: (base.disciplina || '').trim(),
    assunto: (base.assunto || '').trim(),
    banca: (base.banca || '').trim(),
    concurso: (base.concurso || '').trim(),
    data: base.data || '',
    numQuestoes,
    acertos,
    erros,
    taxa,
    tipo: (base.tipo && TIPOS_TENTATIVA.includes(base.tipo)) ? base.tipo : 'Primeiro estudo',
    observacoes: (base.observacoes || '').trim(),
    _status: null,
    _motivo: '',
    _dupExistenteId: null
  };
}

/** Importação Rápida: "72% 08/06/26 19 questões [tipo opcional]" por linha. */
function parseTextoRapido(texto, contexto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  return linhas.map(linha => {
    const pctMatch = linha.match(/(\d{1,3})\s*%/);
    const data = _parseDataFlexivel(linha);
    const qMatch = linha.match(/(\d{1,4})\s*quest(?:ões|oes|ão|ao)?/i);
    const tipo = _detectarTipoTentativa(linha);

    if (!pctMatch || !data || !qMatch) {
      const r = _novoRegistro({ ...contexto, numQuestoes: qMatch ? qMatch[1] : 0, data: data || '', tipo });
      r._status = 'invalido';
      r._motivo = 'Não reconheci percentual, data ou quantidade de questões nesta linha.';
      r._raw = linha;
      return r;
    }
    const r = _novoRegistro({
      ...contexto,
      percentual: pctMatch[1],
      numQuestoes: qMatch[1],
      data,
      tipo: tipo || 'Primeiro estudo'
    });
    r._raw = linha;
    return r;
  });
}

/** Cabeçalhos aceitos (normalizados) -> campo do registro, para planilha/tabela colada. */
const _MAPA_CABECALHOS = {
  disciplina: 'disciplina', materia: 'disciplina',
  assunto: 'assunto', topico: 'assunto',
  banca: 'banca',
  concurso: 'concurso',
  data: 'data',
  questoes: 'numQuestoes', qtdquestoes: 'numQuestoes', quantidadedequestoes: 'numQuestoes', quantidadequestoes: 'numQuestoes', numquestoes: 'numQuestoes',
  acertos: 'acertos', qtdacertos: 'acertos', quantidadeacertos: 'acertos',
  erros: 'erros', qtderros: 'erros',
  tipo: 'tipo', tipodatentativa: 'tipo',
  observacoes: 'observacoes', obs: 'observacoes'
};

function _mapearCabecalho(celula) {
  const chave = _norm(celula).replace(/[^a-z0-9]/g, '');
  return _MAPA_CABECALHOS[chave] || null;
}

/** Detecta delimitador (tab / ; / ,) numa linha de cabeçalho. */
function _detectarDelimitador(linha) {
  const candidatos = [{ ch: '\t', n: (linha.match(/\t/g) || []).length }, { ch: ';', n: (linha.match(/;/g) || []).length }, { ch: ',', n: (linha.match(/,/g) || []).length }];
  candidatos.sort((a, b) => b.n - a.n);
  return candidatos[0].n > 0 ? candidatos[0].ch : null;
}

function _splitLinhaCsv(linha, delim) {
  // parser simples com suporte a campos entre aspas contendo o delimitador
  const out = [];
  let atual = '', dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { dentroAspas = !dentroAspas; continue; }
    if (c === delim && !dentroAspas) { out.push(atual); atual = ''; continue; }
    atual += c;
  }
  out.push(atual);
  return out.map(s => s.trim());
}

/** Converte linhas de cabeçalho+dados (arrays de células) em registros brutos. */
function _linhasParaRegistros(linhasCelulas) {
  const cabecalho = linhasCelulas[0].map(_mapearCabecalho);
  const registros = [];
  for (let i = 1; i < linhasCelulas.length; i++) {
    const celulas = linhasCelulas[i];
    if (celulas.every(c => !c || !c.toString().trim())) continue; // linha vazia
    const base = {};
    cabecalho.forEach((campo, idx) => {
      if (!campo) return;
      base[campo] = celulas[idx] !== undefined ? celulas[idx] : '';
    });
    base.data = _parseDataFlexivel(base.data) || base.data || '';
    registros.push(_novoRegistro(base));
  }
  return registros;
}

/** Texto colado (CSV/TSV) OU, na ausência de delimitador, blocos de N linhas
 *  (uma célula por linha) como no exemplo do prompt — agrupa usando o tamanho
 *  do cabeçalho detectado. */
function parseTabelaTexto(texto) {
  const linhasBrutas = texto.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!linhasBrutas.length) return { registros: [], erro: 'Nada para importar.' };

  const delim = _detectarDelimitador(linhasBrutas[0]);
  if (delim) {
    const linhasCelulas = linhasBrutas.map(l => _splitLinhaCsv(l, delim));
    return { registros: _linhasParaRegistros(linhasCelulas), erro: null };
  }

  // Fallback: uma célula por linha — descobre o tamanho do cabeçalho testando
  // as primeiras linhas contra os nomes de coluna conhecidos.
  let tamanhoCabecalho = 0;
  for (let i = 0; i < Math.min(linhasBrutas.length, 10); i++) {
    if (_mapearCabecalho(linhasBrutas[i])) tamanhoCabecalho++;
    else break;
  }
  if (tamanhoCabecalho < 2) {
    return { registros: [], erro: 'Não reconheci colunas nesta tabela. Cole um texto com colunas separadas por tab/vírgula, ou envie um arquivo CSV/XLSX.' };
  }
  const resto = linhasBrutas.slice(tamanhoCabecalho);
  if (resto.length % tamanhoCabecalho !== 0) {
    return { registros: [], erro: `Encontrei um cabeçalho de ${tamanhoCabecalho} colunas, mas o restante do texto (${resto.length} linhas) não forma um número exato de registros.` };
  }
  const linhasCelulas = [linhasBrutas.slice(0, tamanhoCabecalho)];
  for (let i = 0; i < resto.length; i += tamanhoCabecalho) {
    linhasCelulas.push(resto.slice(i, i + tamanhoCabecalho));
  }
  return { registros: _linhasParaRegistros(linhasCelulas), erro: null };
}

async function parseArquivoCsv(file) {
  const texto = await file.text();
  return parseTabelaTexto(texto);
}

async function parseArquivoXlsx(file) {
  if (typeof XLSX === 'undefined') {
    return { registros: [], erro: 'Leitor de planilhas não carregou. Verifique sua conexão e tente novamente.' };
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    .map(row => row.map(c => (c instanceof Date) ? toISODate(c) : c));
  const filtradas = linhas.filter(l => l.some(c => c !== ''));
  if (filtradas.length < 2) return { registros: [], erro: 'Planilha vazia ou sem dados reconhecíveis.' };
  return { registros: _linhasParaRegistros(filtradas), erro: null };
}

async function parseArquivoJson(file) {
  const texto = await file.text();
  const data = JSON.parse(texto);
  const lista = Array.isArray(data) ? data : (Array.isArray(data.tentativas) ? data.tentativas : null);
  if (!lista) return { registros: [], erro: 'Este JSON não contém uma lista de tentativas reconhecível.' };
  const registros = lista.map(t => _novoRegistro({
    disciplina: t.disciplina, assunto: t.assunto, banca: t.banca, concurso: t.concurso,
    data: _parseDataFlexivel(t.data) || t.data, numQuestoes: t.numQuestoes, acertos: t.acertos,
    tipo: t.tipo, observacoes: t.observacoes
  }));
  return { registros, erro: null };
}

/* ============================================================
   VALIDAÇÃO E DETECÇÃO DE DUPLICIDADE
   ============================================================ */

function _chaveRegistro(r) {
  return `${_norm(r.disciplina)}|${_norm(r.assunto)}|${r.data}|${r.numQuestoes}`;
}

function validarEDetectarDuplicatas(registros) {
  const existentesPorChave = new Map();
  state.tentativas.forEach(t => {
    existentesPorChave.set(_chaveRegistro(t), t);
  });

  const vistasNoLote = new Map();

  registros.forEach(r => {
    if (r._status === 'invalido') return; // já veio marcado do parsing

    if (!r.disciplina || !r.assunto) {
      r._status = 'invalido'; r._motivo = 'Disciplina ou assunto ausente.'; return;
    }
    if (!r.data || !_parseDataFlexivel(r.data)) {
      r._status = 'invalido'; r._motivo = 'Data inválida ou ausente.'; return;
    }
    r.data = _parseDataFlexivel(r.data);
    if (!r.numQuestoes || r.numQuestoes <= 0) {
      r._status = 'invalido'; r._motivo = 'Quantidade de questões inválida.'; return;
    }
    if (r.acertos === null || r.acertos === undefined || isNaN(r.acertos) || r.acertos < 0) {
      r._status = 'invalido'; r._motivo = 'Quantidade de acertos inválida.'; return;
    }

    const chave = _chaveRegistro(r);
    const existente = existentesPorChave.get(chave);
    const noLote = vistasNoLote.get(chave);

    if (existente) {
      r._status = 'duplicado';
      r._motivo = `Já existe uma tentativa igual em ${toBRDate(existente.data)}.`;
      r._dupExistenteId = existente.id;
    } else if (noLote) {
      r._status = 'duplicado';
      r._motivo = 'Repetida dentro do próprio texto/planilha importado.';
      r._dupExistenteId = null;
    } else {
      r._status = 'ok';
      r._motivo = '';
      vistasNoLote.set(chave, r);
    }
  });

  return registros;
}

/* ============================================================
   TELA: ASSISTENTE DE IMPORTAÇÃO DE HISTÓRICO
   ============================================================ */

function renderImportarHistorico(view) {
  if (location.hash !== '#/importar-historico') return; // segurança contra navegação concorrente
  _importHist = _estadoInicialImportHist();
  _renderPassoAtual(view);
}

function _renderPassoAtual(view) {
  const passos = ['Tipo', 'Prévia', 'Validação', 'Importar', 'Relatório'];
  const indicador = `
    <div class="wizard-steps">
      ${passos.map((p, i) => `
        <div class="wizard-step ${i + 1 === _importHist.passo ? 'active' : ''} ${i + 1 < _importHist.passo ? 'done' : ''}">
          <span class="wizard-step-num">${i + 1 < _importHist.passo ? '✓' : i + 1}</span>
          <span class="wizard-step-label">${p}</span>
        </div>
      `).join('')}
    </div>
  `;

  view.innerHTML = `<div id="wizard-indicador">${indicador}</div><div id="wizard-corpo"></div>`;
  const corpo = $('#wizard-corpo');

  if (_importHist.passo === 1) _renderPasso1Tipo(corpo);
  else if (_importHist.passo === 2) _renderPasso2Entrada(corpo);
  else if (_importHist.passo === 3) _renderPasso3Validacao(corpo);
  else if (_importHist.passo === 5) _renderPasso5Relatorio(corpo);
}

function _irParaPasso(view, passo) {
  _importHist.passo = passo;
  _renderPassoAtual(view);
}

/* ---- Passo 1: escolher o tipo de importação ---- */

function _renderPasso1Tipo(corpo) {
  const view = corpo.closest('#view') || corpo.parentElement.parentElement;
  corpo.innerHTML = `
    <p class="text-muted mb-12">Escolha como você quer trazer seu histórico de tentativas para o sistema.</p>
    <div class="grid-2">
      <button class="card import-tipo-card" data-tipo="manual" style="text-align:left;cursor:pointer;">
        <div class="card-title">1 · Cadastro manual</div>
        <h3 style="margin:0 0 6px;font-family:var(--font-display);">Registrar uma tentativa</h3>
        <p class="text-muted" style="font-size:13px;margin:0;">Abre o mesmo formulário usado na tela de Tentativas.</p>
      </button>
      <button class="card import-tipo-card" data-tipo="texto" style="text-align:left;cursor:pointer;">
        <div class="card-title">2 · Importação rápida</div>
        <h3 style="margin:0 0 6px;font-family:var(--font-display);">Colar texto (% + data + questões)</h3>
        <p class="text-muted" style="font-size:13px;margin:0;">Ideal para colar o histórico de um único assunto, linha por linha.</p>
      </button>
      <button class="card import-tipo-card" data-tipo="planilha" style="text-align:left;cursor:pointer;">
        <div class="card-title">3 · Planilha</div>
        <h3 style="margin:0 0 6px;font-family:var(--font-display);">CSV, Excel (.xlsx) ou tabela colada</h3>
        <p class="text-muted" style="font-size:13px;margin:0;">Para quem já tem uma planilha com Disciplina, Assunto, Data, Questões, Acertos e Tipo.</p>
      </button>
      <button class="card import-tipo-card" data-tipo="json" style="text-align:left;cursor:pointer;">
        <div class="card-title">4 · Backup JSON</div>
        <h3 style="margin:0 0 6px;font-family:var(--font-display);">Importar um backup exportado pelo sistema</h3>
        <p class="text-muted" style="font-size:13px;margin:0;">Arquivo gerado em Configurações → Exportar backup.</p>
      </button>
    </div>
  `;

  $$('.import-tipo-card', corpo).forEach(btn => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.tipo;
      if (tipo === 'manual') {
        openTentativaModal();
        return;
      }
      _importHist = { ..._estadoInicialImportHist(), tipo, passo: 2 };
      _renderPassoAtual($('#view'));
    });
  });
}

/* ---- Passo 2: entrada de dados (conforme o tipo escolhido) ---- */

function _renderPasso2Entrada(corpo) {
  if (_importHist.tipo === 'texto') return _renderPasso2Texto(corpo);
  if (_importHist.tipo === 'planilha') return _renderPasso2Planilha(corpo);
  if (_importHist.tipo === 'json') return _renderPasso2Json(corpo);
}

function _renderPasso2Texto(corpo) {
  const ctx = _importHist.contexto;
  corpo.innerHTML = `
    <div class="card mb-12">
      <div class="card-title">Esse histórico é de qual disciplina/assunto?</div>
      <div class="form-grid-2">
        <div class="form-row"><label>Disciplina</label><input type="text" id="ih-disciplina" value="${escapeHtml(ctx.disciplina)}" placeholder="Ex: Direito Constitucional"></div>
        <div class="form-row"><label>Assunto</label><input type="text" id="ih-assunto" value="${escapeHtml(ctx.assunto)}" placeholder="Ex: Poder Constituinte"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label>Banca (opcional)</label><input type="text" id="ih-banca" value="${escapeHtml(ctx.banca)}"></div>
        <div class="form-row"><label>Concurso (opcional)</label><input type="text" id="ih-concurso" value="${escapeHtml(ctx.concurso)}"></div>
      </div>
    </div>
    <div class="card mb-12">
      <div class="card-title">Cole o histórico — uma tentativa por linha</div>
      <p class="text-muted" style="font-size:13px;margin-top:0;">Exemplo: <code>72% 08/06/26 19 questões Revisão</code>. O tipo é opcional; se não informado, uso "Primeiro estudo".</p>
      <textarea id="ih-texto" rows="10" placeholder="72% 08/06/26 19 questões
62% 15/04/26 8 questões Refazendo questões
57% 14/04/26 26 questões Refazendo questões erradas
45% 17/03/26 20 questões
55% 13/04/26 20 questões Refazendo questões erradas
41% 02/04/26 39 questões"></textarea>
    </div>
    <div class="flex gap-8" style="flex-wrap:wrap;">
      <button class="btn btn-ghost" id="ih-voltar">&larr; Voltar</button>
      <button class="btn btn-primary btn-block" id="ih-analisar" style="flex:1;min-width:220px;">Analisar texto</button>
    </div>
  `;

  $('#ih-voltar').addEventListener('click', () => _irParaPasso($('#view'), 1));
  $('#ih-analisar').addEventListener('click', () => {
    const disciplina = $('#ih-disciplina').value.trim();
    const assunto = $('#ih-assunto').value.trim();
    if (!disciplina || !assunto) { showToast('Informe disciplina e assunto antes de analisar.', 'danger'); return; }
    _importHist.contexto = {
      disciplina, assunto,
      banca: $('#ih-banca').value.trim(),
      concurso: $('#ih-concurso').value.trim()
    };
    const texto = $('#ih-texto').value;
    if (!texto.trim()) { showToast('Cole o histórico antes de analisar.', 'danger'); return; }
    _importHist.registros = parseTextoRapido(texto, _importHist.contexto);
    _irParaPasso($('#view'), 3);
  });
}

function _renderPasso2Planilha(corpo) {
  corpo.innerHTML = `
    <div class="import-tabs">
      <button class="import-tab active" data-tab="colar">Colar tabela</button>
      <button class="import-tab" data-tab="csv">Upload CSV</button>
      <button class="import-tab" data-tab="xlsx">Upload Excel (.xlsx)</button>
    </div>
    <div class="import-panel" data-panel="colar">
      <div class="form-row">
        <label>Cole a tabela (do Excel/Sheets, com colunas Disciplina, Assunto, Data, Questões, Acertos, Tipo)</label>
        <textarea id="ih-tabela-texto" rows="10" placeholder="Disciplina&#9;Assunto&#9;Data&#9;Questões&#9;Acertos&#9;Tipo
Constitucional&#9;Poder Constituinte&#9;17/03/2026&#9;20&#9;9&#9;Primeiro estudo"></textarea>
      </div>
      <button class="btn btn-primary" id="ih-analisar-colar">Analisar tabela</button>
    </div>
    <div class="import-panel" data-panel="csv" hidden>
      <div class="form-row"><label>Arquivo CSV</label><input type="file" id="ih-csv" accept=".csv,text/csv"></div>
      <button class="btn btn-primary" id="ih-analisar-csv">Analisar CSV</button>
    </div>
    <div class="import-panel" data-panel="xlsx" hidden>
      <div class="form-row"><label>Arquivo Excel (.xlsx)</label><input type="file" id="ih-xlsx" accept=".xlsx,.xls"></div>
      <button class="btn btn-primary" id="ih-analisar-xlsx">Analisar Excel</button>
    </div>
    <div class="flex gap-8 mt-12">
      <button class="btn btn-ghost" id="ih-voltar">&larr; Voltar</button>
    </div>
  `;

  $$('.import-tab', corpo).forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.import-tab', corpo).forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.import-panel', corpo).forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  $('#ih-voltar').addEventListener('click', () => _irParaPasso($('#view'), 1));

  $('#ih-analisar-colar').addEventListener('click', () => {
    const texto = $('#ih-tabela-texto').value;
    if (!texto.trim()) { showToast('Cole a tabela antes de analisar.', 'danger'); return; }
    const { registros, erro } = parseTabelaTexto(texto);
    if (erro) { showToast(erro, 'danger'); return; }
    _importHist.registros = registros;
    _irParaPasso($('#view'), 3);
  });

  $('#ih-analisar-csv').addEventListener('click', async () => {
    const file = $('#ih-csv').files[0];
    if (!file) { showToast('Selecione um arquivo CSV.', 'danger'); return; }
    const { registros, erro } = await parseArquivoCsv(file);
    if (erro) { showToast(erro, 'danger'); return; }
    _importHist.registros = registros;
    _irParaPasso($('#view'), 3);
  });

  $('#ih-analisar-xlsx').addEventListener('click', async () => {
    const file = $('#ih-xlsx').files[0];
    if (!file) { showToast('Selecione um arquivo .xlsx.', 'danger'); return; }
    const { registros, erro } = await parseArquivoXlsx(file);
    if (erro) { showToast(erro, 'danger'); return; }
    _importHist.registros = registros;
    _irParaPasso($('#view'), 3);
  });
}

function _renderPasso2Json(corpo) {
  corpo.innerHTML = `
    <div class="card mb-12">
      <div class="card-title">Selecione o backup JSON</div>
      <p class="text-muted" style="font-size:13px;margin-top:0;">Aceita um backup completo exportado em Configurações, ou um arquivo com uma lista de tentativas.</p>
      <div class="form-row"><input type="file" id="ih-json" accept="application/json"></div>
      <button class="btn btn-primary" id="ih-analisar-json">Analisar JSON</button>
    </div>
    <div class="flex gap-8">
      <button class="btn btn-ghost" id="ih-voltar">&larr; Voltar</button>
    </div>
  `;
  $('#ih-voltar').addEventListener('click', () => _irParaPasso($('#view'), 1));
  $('#ih-analisar-json').addEventListener('click', async () => {
    const file = $('#ih-json').files[0];
    if (!file) { showToast('Selecione um arquivo JSON.', 'danger'); return; }
    try {
      const { registros, erro } = await parseArquivoJson(file);
      if (erro) { showToast(erro, 'danger'); return; }
      _importHist.registros = registros;
      _irParaPasso($('#view'), 3);
    } catch (err) {
      showToast('Arquivo JSON inválido.', 'danger');
    }
  });
}

/* ---- Passo 3: prévia editável + validação + duplicidade ---- */

function _renderPasso3Validacao(corpo) {
  validarEDetectarDuplicatas(_importHist.registros);
  _desenharPasso3(corpo);
}

function _desenharPasso3(corpo) {
  const registros = _importHist.registros;
  const ok = registros.filter(r => r._status === 'ok').length;
  const dup = registros.filter(r => r._status === 'duplicado').length;
  const inv = registros.filter(r => r._status === 'invalido').length;
  const aImportar = ok + (_importHist.duplicataAcao !== 'ignorar' ? dup : 0);

  corpo.innerHTML = `
    <div class="report-summary mb-12">
      <div class="report-chip ok">✅ ${ok} válido(s)</div>
      <div class="report-chip dup">⚠️ ${dup} duplicado(s)</div>
      <div class="report-chip inv">❌ ${inv} inválido(s)</div>
    </div>

    ${dup > 0 ? `
      <div class="card mb-12">
        <div class="card-title">O que fazer com os ${dup} registro(s) duplicado(s)?</div>
        <p class="text-muted" style="font-size:13px;margin-top:0;">Considerei duplicado quando disciplina, assunto, data e quantidade de questões são idênticos a um registro já existente.</p>
        <div class="radio-group">
          <label><input type="radio" name="ih-dup-acao" value="ignorar" ${_importHist.duplicataAcao === 'ignorar' ? 'checked' : ''}> Ignorar (não importar de novo)</label>
          <label><input type="radio" name="ih-dup-acao" value="substituir" ${_importHist.duplicataAcao === 'substituir' ? 'checked' : ''}> Substituir o registro existente</label>
          <label><input type="radio" name="ih-dup-acao" value="duplicar" ${_importHist.duplicataAcao === 'duplicar' ? 'checked' : ''}> Duplicar mesmo assim</label>
        </div>
      </div>
    ` : ''}

    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table class="import-hist-table">
          <thead>
            <tr>
              <th></th><th>Disciplina</th><th>Assunto</th><th>Data</th><th>Questões</th><th>Acertos</th><th>Taxa</th><th>Tipo</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${registros.map((r, i) => `
              <tr class="row-${r._status}">
                <td><span class="status-badge ${r._status}">${r._status === 'ok' ? '✅' : r._status === 'duplicado' ? '⚠️' : '❌'}</span></td>
                <td><input type="text" data-campo="disciplina" data-idx="${i}" value="${escapeHtml(r.disciplina)}"></td>
                <td><input type="text" data-campo="assunto" data-idx="${i}" value="${escapeHtml(r.assunto)}"></td>
                <td><input type="text" data-campo="data" data-idx="${i}" value="${escapeHtml(r.data)}" style="width:100px;"></td>
                <td><input type="number" data-campo="numQuestoes" data-idx="${i}" value="${r.numQuestoes}" style="width:70px;"></td>
                <td><input type="number" data-campo="acertos" data-idx="${i}" value="${r.acertos}" style="width:70px;"></td>
                <td class="num">${fmtPct(r.taxa)}</td>
                <td>
                  <select data-campo="tipo" data-idx="${i}">
                    ${TIPOS_TENTATIVA.map(tp => `<option value="${tp}" ${r.tipo === tp ? 'selected' : ''}>${tp}</option>`).join('')}
                  </select>
                </td>
                <td><button class="icon-btn" data-remover="${i}" title="Remover">✕</button></td>
              </tr>
              ${r._motivo ? `<tr class="row-motivo"><td></td><td colspan="8" class="text-muted" style="font-size:12px;">${escapeHtml(r._motivo)}${r._raw ? ` — <span style="font-family:var(--font-mono);">"${escapeHtml(r._raw)}"</span>` : ''}</td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex gap-8 mt-12" style="flex-wrap:wrap;">
      <button class="btn btn-ghost" id="ih-voltar-passo2">&larr; Voltar</button>
      <button class="btn btn-primary btn-block" id="ih-importar" style="flex:1;min-width:220px;" ${aImportar === 0 ? 'disabled' : ''}>
        Importar ${aImportar} registro(s)
      </button>
    </div>
  `;

  $('#ih-voltar-passo2').addEventListener('click', () => _irParaPasso($('#view'), 2));

  $$('input[name="ih-dup-acao"]', corpo).forEach(radio => {
    radio.addEventListener('change', () => {
      _importHist.duplicataAcao = radio.value;
      _desenharPasso3(corpo);
    });
  });

  $$('[data-campo]', corpo).forEach(input => {
    input.addEventListener('change', () => {
      const idx = Number(input.dataset.idx);
      const campo = input.dataset.campo;
      const r = registros[idx];
      if (campo === 'numQuestoes' || campo === 'acertos') {
        r[campo] = Number(input.value) || 0;
        if (r.acertos > r.numQuestoes) r.acertos = r.numQuestoes;
        r.erros = Math.max(0, r.numQuestoes - r.acertos);
        r.taxa = r.numQuestoes ? (r.acertos / r.numQuestoes) * 100 : 0;
      } else {
        r[campo] = input.value;
      }
      validarEDetectarDuplicatas(registros);
      _desenharPasso3(corpo);
    });
  });

  $$('[data-remover]', corpo).forEach(btn => {
    btn.addEventListener('click', () => {
      registros.splice(Number(btn.dataset.remover), 1);
      validarEDetectarDuplicatas(registros);
      _desenharPasso3(corpo);
    });
  });

  $('#ih-importar').addEventListener('click', _executarImportacao);
}

/* ---- Passo 4: commit no banco (transitório) + Passo 5: relatório ---- */

async function _executarImportacao() {
  const view = $('#view');
  view.innerHTML = `<div class="empty-state"><p>Importando registros...</p></div>`;

  const registros = _importHist.registros;
  let importados = 0, substituidos = 0, duplicadosMantidos = 0, ignorados = 0;

  for (const r of registros) {
    if (r._status === 'invalido') continue;

    if (r._status === 'duplicado') {
      if (_importHist.duplicataAcao === 'ignorar') { ignorados++; continue; }
      if (_importHist.duplicataAcao === 'substituir') {
        if (r._dupExistenteId) {
          await db.tentativas.update({ id: r._dupExistenteId, ...(({ _status, _motivo, _dupExistenteId, _raw, ...resto }) => resto)(r) });
          substituidos++;
        } else {
          await db.tentativas.add((({ _status, _motivo, _dupExistenteId, _raw, ...resto }) => resto)(r));
          importados++;
        }
        continue;
      }
      // duplicar
      await db.tentativas.add((({ _status, _motivo, _dupExistenteId, _raw, ...resto }) => resto)(r));
      duplicadosMantidos++;
      continue;
    }

    // ok
    await db.tentativas.add((({ _status, _motivo, _dupExistenteId, _raw, ...resto }) => resto)(r));
    importados++;
  }

  await reloadState();

  _importHist.relatorio = {
    importados: importados + substituidos + duplicadosMantidos,
    substituidos,
    ignorados,
    invalidos: registros.filter(r => r._status === 'invalido')
  };
  _importHist.passo = 5;
  _renderPassoAtual(view);
}

function _renderPasso5Relatorio(corpo) {
  const rel = _importHist.relatorio || { importados: 0, substituidos: 0, ignorados: 0, invalidos: [] };
  corpo.innerHTML = `
    <div class="card mb-12">
      <div class="card-title">Importação concluída</div>
      <div class="report-summary">
        <div class="report-chip ok">✅ ${rel.importados} tentativa(s) importada(s)</div>
        ${rel.substituidos ? `<div class="report-chip dup">🔁 ${rel.substituidos} substituída(s)</div>` : ''}
        ${rel.ignorados ? `<div class="report-chip dup">⚠️ ${rel.ignorados} duplicada(s) ignorada(s)</div>` : ''}
        ${rel.invalidos.length ? `<div class="report-chip inv">❌ ${rel.invalidos.length} registro(s) inválido(s)</div>` : ''}
      </div>
      ${rel.invalidos.length ? `
        <div class="mt-12">
          <div class="text-muted" style="font-size:13px;font-weight:600;margin-bottom:6px;">Registros que não foram importados:</div>
          ${rel.invalidos.map(r => `<div class="text-muted" style="font-size:12.5px;">• ${escapeHtml(r._raw || `${r.disciplina} / ${r.assunto}`)} — ${escapeHtml(r._motivo)}</div>`).join('')}
        </div>
      ` : ''}
      <p class="text-muted" style="font-size:13px;">Dashboard, estatísticas, gráficos e o progresso dos editais já foram atualizados com esses dados.</p>
    </div>
    <div class="flex gap-8" style="flex-wrap:wrap;">
      <a class="btn btn-primary" href="#/tentativas">Ver tentativas</a>
      <button class="btn" id="ih-importar-mais">Importar mais</button>
    </div>
  `;

  $('#ih-importar-mais').addEventListener('click', () => {
    _importHist = _estadoInicialImportHist();
    _renderPassoAtual($('#view'));
  });
}
