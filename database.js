/**
 * database.js
 * Camada de acesso a dados usando IndexedDB.
 * Todas as entidades principais (questões, editais, simulados) ficam aqui.
 * Configurações pequenas (tema, sidebar) usam localStorage — ver app.js.
 */

const DB_NAME = 'TrilhaAprovacaoDB';
const DB_VERSION = 1;

const STORES = {
  questoes: 'questoes',
  editais: 'editais',
  simulados: 'simulados'
};

let _dbPromise = null;

/** Abre (ou cria) o banco de dados. Reaproveita a mesma promise. */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.questoes)) {
        const store = db.createObjectStore(STORES.questoes, { keyPath: 'id', autoIncrement: true });
        store.createIndex('disciplina', 'disciplina', { unique: false });
        store.createIndex('assunto', 'assunto', { unique: false });
        store.createIndex('banca', 'banca', { unique: false });
        store.createIndex('concurso', 'concurso', { unique: false });
        store.createIndex('data', 'data', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.editais)) {
        db.createObjectStore(STORES.editais, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.simulados)) {
        const store = db.createObjectStore(STORES.simulados, { keyPath: 'id', autoIncrement: true });
        store.createIndex('data', 'data', { unique: false });
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
  questoes: {
    add: (q) => db.add(STORES.questoes, q),
    update: (q) => db.update(STORES.questoes, q),
    remove: (id) => db.remove(STORES.questoes, id),
    getAll: () => db.getAll(STORES.questoes),
    clear: () => db.clear(STORES.questoes)
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
    const [questoes, editais, simulados] = await Promise.all([
      db.getAll(STORES.questoes),
      db.getAll(STORES.editais),
      db.getAll(STORES.simulados)
    ]);
    return {
      versao: DB_VERSION,
      exportadoEm: new Date().toISOString(),
      questoes, editais, simulados
    };
  },

  async importAll(data, { substituir = true } = {}) {
    if (substituir) {
      await Promise.all([
        db.clear(STORES.questoes),
        db.clear(STORES.editais),
        db.clear(STORES.simulados)
      ]);
    }
    const listaQuestoes = Array.isArray(data.questoes) ? data.questoes : [];
    const listaEditais = Array.isArray(data.editais) ? data.editais : [];
    const listaSimulados = Array.isArray(data.simulados) ? data.simulados : [];

    for (const q of listaQuestoes) {
      const { id, ...rest } = q;
      await db.add(STORES.questoes, rest);
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
      db.clear(STORES.questoes),
      db.clear(STORES.editais),
      db.clear(STORES.simulados)
    ]);
  }
};
