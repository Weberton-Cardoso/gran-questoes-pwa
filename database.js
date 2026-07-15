/**
 * database.js
 * Camada de acesso a dados usando IndexedDB.
 * Todas as entidades principais (tentativas, editais, simulados, ciclo de
 * estudos) ficam aqui. Configurações pequenas (tema, sidebar, duração padrão
 * da sessão do ciclo) usam localStorage — ver app.js.
 *
 * v2: o cadastro por questão individual ("questoes") foi substituído pelo
 * cadastro por TENTATIVA (bloco de questões de um mesmo assunto).
 * v3: os tópicos de um edital passam a ter 4 status (quadro estilo Kanban)
 * em vez de 3. Editais antigos são migrados automaticamente:
 *   nao_estudado -> nao_iniciado
 *   em_estudo    -> em_estudo (mantém)
 *   concluido    -> dominado
 * v4: adiciona o Ciclo de Estudos (cicloMaterias + cicloSessoes).
 * v5: adiciona cicloConfig (config única: tempo total do ciclo em minutos
 *     e quantos ciclos completos já foram fechados).
 */

const DB_NAME = 'TrilhaAprovacaoDB';
const DB_VERSION = 5;

const STORES = {
  tentativas: 'tentativas',
  editais: 'editais',
  simulados: 'simulados',
  cicloMaterias: 'cicloMaterias',
  cicloSessoes: 'cicloSessoes',
  cicloConfig: 'cicloConfig'
};

const TIPOS_TENTATIVA = [
  'Primeiro estudo',
  'Revisão',
  'Refazendo questões',
  'Refazendo questões erradas',
  'Simulado'
];

const STATUS_TOPICO = ['nao_iniciado', 'em_estudo', 'em_revisao', 'dominado'];

const STATUS_TOPICO_LABEL = {
  nao_iniciado: 'Não iniciado',
  em_estudo: 'Em estudo',
  em_revisao: 'Em revisão',
  dominado: 'Dominado'
};

const _STATUS_MIGRACAO_V3 = {
  nao_estudado: 'nao_iniciado',
  em_estudo: 'em_estudo',
  concluido: 'dominado'
};

let _dbPromise = null;

/** Abre (ou cria/migra) o banco de dados. Reaproveita a mesma promise. */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;
      const oldVersion = event.oldVersion || 0;

      let editaisStore;
      if (!db.objectStoreNames.contains(STORES.editais)) {
        editaisStore = db.createObjectStore(STORES.editais, { keyPath: 'id', autoIncrement: true });
      } else {
        editaisStore = tx.objectStore(STORES.editais);
      }

      if (!db.objectStoreNames.contains(STORES.simulados)) {
        const store = db.createObjectStore(STORES.simulados, { keyPath: 'id', autoIncrement: true });
        store.createIndex('data', 'data', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.cicloMaterias)) {
        db.createObjectStore(STORES.cicloMaterias, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.cicloSessoes)) {
        const store = db.createObjectStore(STORES.cicloSessoes, { keyPath: 'id', autoIncrement: true });
        store.createIndex('data', 'data', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.cicloConfig)) {
        db.createObjectStore(STORES.cicloConfig, { keyPath: 'id' });
      }

      const jaTinhaQuestoes = db.objectStoreNames.contains('questoes');
      let tentativasStore;

      if (!db.objectStoreNames.contains(STORES.tentativas)) {
        tentativasStore = db.createObjectStore(STORES.tentativas, { keyPath: 'id', autoIncrement: true });
        tentativasStore.createIndex('disciplina', 'disciplina', { unique: false });
        tentativasStore.createIndex('assunto', 'assunto', { unique: false });
        tentativasStore.createIndex('banca', 'banca', { unique: false });
        tentativasStore.createIndex('concurso', 'concurso', { unique: false });
        tentativasStore.createIndex('data', 'data', { unique: false });
      } else {
        tentativasStore = tx.objectStore(STORES.tentativas);
      }

      // Migração: cada questão individual antiga vira uma tentativa de 1 questão.
      if (jaTinhaQuestoes) {
        const questoesStore = tx.objectStore('questoes');
        questoesStore.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            const q = cursor.value;
            tentativasStore.add({
              disciplina: q.disciplina || '',
              assunto: q.assunto || '',
              banca: q.banca || '',
              concurso: q.concurso || '',
              data: q.data || '',
              numQuestoes: 1,
              acertos: q.correta ? 1 : 0,
              erros: q.correta ? 0 : 1,
              taxa: q.correta ? 100 : 0,
              tipo: 'Primeiro estudo',
              observacoes: q.observacoes || ''
            });
            cursor.continue();
          } else {
            // terminou a migração: remove o store antigo
            db.deleteObjectStore('questoes');
          }
        };
      }

      // Migração v3: remapeia status antigos (3 estados) para o novo modelo (4 estados)
      if (oldVersion > 0 && oldVersion < 3) {
        editaisStore.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return;
          const edital = cursor.value;
          (edital.materias || []).forEach(m => {
            (m.topicos || []).forEach(t => {
              t.status = _STATUS_MIGRACAO_V3[t.status] || 'nao_iniciado';
            });
          });
          cursor.update(edital);
          cursor.continue();
        };
      }
    };

    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });

  return _dbPromise;
}

/** Executa uma transação e devolve uma Promise resolvida com o resultado do request. */
async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = fn(store);

    transaction.oncomplete = () => {
      // Avisa quem estiver interessado (ex.: cloud-sync.js) que algo mudou,
      // apenas para transações de escrita.
      if (mode === 'readwrite') {
        window.dispatchEvent(new CustomEvent('ta:mudou', { detail: { storeName } }));
      }
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

const db = {

  // ---------- CRUD genérico ----------
  add(storeName, obj) {
    return tx(storeName, 'readwrite', (store) => store.add(obj));
  },

  update(storeName, obj) {
    return tx(storeName, 'readwrite', (store) => store.put(obj));
  },

  remove(storeName, id) {
    return tx(storeName, 'readwrite', (store) => store.delete(id));
  },

  get(storeName, id) {
    return tx(storeName, 'readonly', (store) => store.get(id));
  },

  getAll(storeName) {
    return tx(storeName, 'readonly', (store) => store.getAll());
  },

  clear(storeName) {
    return tx(storeName, 'readwrite', (store) => store.clear());
  },

  // ---------- Atalhos por entidade ----------
  tentativas: {
    add: (t) => db.add(STORES.tentativas, t),
    update: (t) => db.update(STORES.tentativas, t),
    remove: (id) => db.remove(STORES.tentativas, id),
    getAll: () => db.getAll(STORES.tentativas),
    clear: () => db.clear(STORES.tentativas)
  },

  editais: {
    add: (e) => db.add(STORES.editais, e),
    update: (e) => db.update(STORES.editais, e),
    remove: (id) => db.remove(STORES.editais, id),
    get: (id) => db.get(STORES.editais, id),
    getAll: () => db.getAll(STORES.editais),
    clear: () => db.clear(STORES.editais)
  },

  simulados: {
    add: (s) => db.add(STORES.simulados, s),
    update: (s) => db.update(STORES.simulados, s),
    remove: (id) => db.remove(STORES.simulados, id),
    getAll: () => db.getAll(STORES.simulados),
    clear: () => db.clear(STORES.simulados)
  },

  cicloMaterias: {
    add: (m) => db.add(STORES.cicloMaterias, m),
    update: (m) => db.update(STORES.cicloMaterias, m),
    remove: (id) => db.remove(STORES.cicloMaterias, id),
    getAll: () => db.getAll(STORES.cicloMaterias),
    clear: () => db.clear(STORES.cicloMaterias)
  },

  cicloSessoes: {
    add: (s) => db.add(STORES.cicloSessoes, s),
    update: (s) => db.update(STORES.cicloSessoes, s),
    remove: (id) => db.remove(STORES.cicloSessoes, id),
    getAll: () => db.getAll(STORES.cicloSessoes),
    clear: () => db.clear(STORES.cicloSessoes)
  },

  // Config única do ciclo (id fixo = 1): tempo total do ciclo e nº de ciclos fechados.
  cicloConfig: {
    async get() {
      const registro = await db.get(STORES.cicloConfig, 1);
      return registro || { id: 1, minutosCicloTotal: 1200, ciclosCompletos: 0 };
    },
    set: (cfg) => db.update(STORES.cicloConfig, { ...cfg, id: 1 })
  },

  // ---------- Backup ----------
  async exportAll() {
    const [tentativas, editais, simulados, cicloMaterias, cicloSessoes, cicloConfig] = await Promise.all([
      db.getAll(STORES.tentativas),
      db.getAll(STORES.editais),
      db.getAll(STORES.simulados),
      db.getAll(STORES.cicloMaterias),
      db.getAll(STORES.cicloSessoes),
      db.cicloConfig.get()
    ]);
    return {
      versao: DB_VERSION,
      exportadoEm: new Date().toISOString(),
      tentativas, editais, simulados, cicloMaterias, cicloSessoes, cicloConfig
    };
  },

  async importAll(data, { substituir = true } = {}) {
    if (substituir) {
      await Promise.all([
        db.clear(STORES.tentativas),
        db.clear(STORES.editais),
        db.clear(STORES.simulados),
        db.clear(STORES.cicloMaterias),
        db.clear(STORES.cicloSessoes),
        db.clear(STORES.cicloConfig)
      ]);
    }

    // Compatível com backups antigos (v1, baseados em "questoes")
    const listaTentativas = Array.isArray(data.tentativas)
      ? data.tentativas
      : (Array.isArray(data.questoes) ? data.questoes.map(q => ({
          disciplina: q.disciplina || '',
          assunto: q.assunto || '',
          banca: q.banca || '',
          concurso: q.concurso || '',
          data: q.data || '',
          numQuestoes: 1,
          acertos: q.correta ? 1 : 0,
          erros: q.correta ? 0 : 1,
          taxa: q.correta ? 100 : 0,
          tipo: 'Primeiro estudo',
          observacoes: q.observacoes || ''
        })) : []);

    const listaEditais = Array.isArray(data.editais) ? data.editais : [];
    const listaSimulados = Array.isArray(data.simulados) ? data.simulados : [];
    const listaCicloMaterias = Array.isArray(data.cicloMaterias) ? data.cicloMaterias : [];
    const listaCicloSessoes = Array.isArray(data.cicloSessoes) ? data.cicloSessoes : [];

    for (const t of listaTentativas) {
      const { id, ...rest } = t;
      await db.add(STORES.tentativas, rest);
    }
    for (const e of listaEditais) {
      const { id, ...rest } = e;
      await db.add(STORES.editais, rest);
    }
    for (const s of listaSimulados) {
      const { id, ...rest } = s;
      await db.add(STORES.simulados, rest);
    }
    for (const m of listaCicloMaterias) {
      const { id, ...rest } = m;
      await db.add(STORES.cicloMaterias, rest);
    }
    for (const s of listaCicloSessoes) {
      const { id, ...rest } = s;
      await db.add(STORES.cicloSessoes, rest);
    }
    if (data.cicloConfig) {
      await db.cicloConfig.set({
        minutosCicloTotal: data.cicloConfig.minutosCicloTotal ?? 1200,
        ciclosCompletos: data.cicloConfig.ciclosCompletos ?? 0
      });
    }
  },

  async zerarTudo() {
    await Promise.all([
      db.clear(STORES.tentativas),
      db.clear(STORES.editais),
      db.clear(STORES.simulados),
      db.clear(STORES.cicloMaterias),
      db.clear(STORES.cicloSessoes),
      db.clear(STORES.cicloConfig)
    ]);
  }
};
