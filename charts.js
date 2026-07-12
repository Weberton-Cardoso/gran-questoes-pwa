/**
 * charts.js
 * Funções auxiliares para criar/atualizar gráficos com Chart.js.
 * Mantém um registro de instâncias por canvas para poder destruir
 * o gráfico anterior antes de redesenhar (evita vazamento/sobreposição).
 */

const _chartInstances = {};

function _destroyIfExists(canvasId) {
  if (_chartInstances[canvasId]) {
    _chartInstances[canvasId].destroy();
    delete _chartInstances[canvasId];
  }
}

function _themeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#5B6472' : '#8A94A6',
    grid: isLight ? '#E1E5EC' : '#232D3B',
    gold: '#E8B14D',
    success: '#34D399',
    danger: '#F87171',
    info: '#60A5FA'
  };
}

/** Gráfico de pizza (donut) Acertos x Erros */
function renderPieChart(canvasId, { acertos = 0, erros = 0 }) {
  _destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const c = _themeColors();

  _chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Acertos', 'Erros'],
      datasets: [{
        data: [acertos, erros],
        backgroundColor: [c.success, c.danger],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Inter' } } }
      }
    }
  });
}

/** Gráfico de rosca genérico com N categorias (ex: status dos tópicos de um edital) */
function renderStatusDoughnutChart(canvasId, { labels = [], values = [], colors = [] }) {
  _destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const c = _themeColors();

  _chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Inter' } } }
      }
    }
  });
}

/** Gráfico de barras - agrupado (ex: certas x erradas por disciplina) */
function renderBarChart(canvasId, { labels = [], certas = [], erradas = [] }) {
  _destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const c = _themeColors();

  _chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Certas', data: certas, backgroundColor: c.success, borderRadius: 4, maxBarThickness: 28 },
        { label: 'Erradas', data: erradas, backgroundColor: c.danger, borderRadius: 4, maxBarThickness: 28 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: c.text, font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Inter' } } }
      }
    }
  });
}

/** Gráfico de linha - evolução de acertos ao longo dos dias */
function renderLineChart(canvasId, { labels = [], series = [] }) {
  _destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const c = _themeColors();
  const palette = [c.gold, c.info, c.success, c.danger];

  _chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '22',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: palette[i % palette.length]
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: c.text, font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Inter' } } }
      }
    }
  });
}
