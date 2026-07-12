/**
 * database.js
 * Camada de acesso a dados usando IndexedDB.
 * Todas as entidades principais (tentativas, editais, simulados) ficam aqui.
 * Configurações pequenas (tema, sidebar) usam localStorage — ver app.js.
 *
 * v2: o cadastro por questão individual ("questoes") foi substituído pelo
 * cadastro por TENTATIVA (bloco de questões de um mesmo assunto).
 * O store antigo "questoes" é migrado automaticamente para "tentativas"
 * na primeira abertura após a atualização, e depois é removido.
 */

const DB_NAME = 'TrilhaAprovacaoDB';
const DB_VERSION = 2;

const STORES = {
  tentativas: 'tentativas',
  editais: 'editais',
  simulados: 'simulados'
};

const TIPOS_TENTATIVA = [
  'Primeiro estudo',
  'Revisão',
  'Refazendo questões',
  'Refazendo questões erradas',
  'Simulado'
];

let _dbPromise = null;

/** Abre (ou cria/migra) o banco de dados. Reaproveita a mesma promise. */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;

      if (!db.objectStoreNames.contains(STORES.editais)) {
        db.createObjectStore(STORES.editais, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.simulados)) {
        const store = db.createObjectStore(STORES.simulados, { keyPath: 'id', autoIncrement: true });
        store.createIndex('data', 'data', { unique: false });
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

    transaction.oncomplete = () => resolve(request ? request.result : undefined);
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

  // ---------- Backup ----------
  async exportAll() {
    const [tentativas, editais, simulados] = await Promise.all([
      db.getAll(STORES.tentativas),
      db.getAll(STORES.editais),
      db.getAll(STORES.simulados)
    ]);
    return {
      versao: DB_VERSION,
      exportadoEm: new Date().toISOString(),
      tentativas, editais, simulados
    };
  },

  async importAll(data, { substituir = true } = {}) {
    if (substituir) {
      await Promise.all([
        db.clear(STORES.tentativas),
        db.clear(STORES.editais),
        db.clear(STORES.simulados)
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
  },

  async zerarTudo() {
    await Promise.all([
      db.clear(STORES.tentativas),
      db.clear(STORES.editais),
      db.clear(STORES.simulados)
    ]);
  }
};
