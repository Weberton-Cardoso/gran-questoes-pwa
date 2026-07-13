/**
 * cloud-sync.js
 * Sincronização entre dispositivos usando Firebase (Auth + Firestore).
 *
 * Estratégia simples e segura para um app de uso pessoal:
 * - O IndexedDB continua sendo a fonte de dados usada pelo app no dia a dia
 *   (rápido, funciona offline).
 * - Sempre que os dados mudam localmente (evento 'ta:mudou', disparado pelo
 *   database.js), fazemos upload de um "pacote" com tudo (tentativas,
 *   editais, simulados) para um único documento no Firestore, em
 *   usuarios/{uid}. Isso reaproveita as funções exportAll()/importAll()
 *   que já existiam para backup manual.
 * - Ao logar (ou abrir o app já logado), baixamos esse documento do
 *   Firestore e substituímos o conteúdo local por ele (importAll com
 *   substituir:true), trazendo os dados para o dispositivo atual.
 *
 * Isso é suficiente para "um usuário, vários aparelhos". Não foi pensado
 * para edição simultânea nos dois aparelhos ao mesmo tempo.
 */

const firebaseConfig = {
  apiKey: "AIzaSyBk64IEbSZakYbtcBMvId0iITFA5Xuis8g",
  authDomain: "analisedequestoes-e963c.firebaseapp.com",
  projectId: "analisedequestoes-e963c",
  storageBucket: "analisedequestoes-e963c.firebasestorage.app",
  messagingSenderId: "376267857062",
  appId: "1:376267857062:web:b0613b88922551b0a7e867"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const firestore = firebase.firestore();

// Habilita cache local do Firestore (ajuda em conexões instáveis)
firestore.enablePersistence().catch(() => {
  // Se falhar (ex.: várias abas abertas), não é crítico — o app continua
  // funcionando normalmente com o IndexedDB próprio.
});

const cloudSync = {
  usuarioAtual: null,
  _pushTimer: null,
  _ignorarProximosEventos: false,

  /** Chama isso uma vez, ao carregar o app. */
  init(onStatusChange) {
    this._onStatusChange = onStatusChange || (() => {});

    auth.onAuthStateChanged(async (user) => {
      this.usuarioAtual = user;
      this._onStatusChange(user);

      if (user) {
        await this._puxarDaNuvem(user.uid);
      }
    });

    window.addEventListener('ta:mudou', () => {
      if (this._ignorarProximosEventos) return;
      if (!this.usuarioAtual) return;
      this._agendarEnvio();
    });
  },

  async entrarComGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (err) {
      console.error('Erro ao entrar com Google:', err);
      showToast('Não foi possível entrar. Tente novamente.', 'error');
    }
  },

  async sair() {
    await auth.signOut();
  },

  /** Junta tudo (db.exportAll) e sobe pro Firestore, com pequeno atraso
   *  para agrupar várias mudanças seguidas em um único envio. */
  _agendarEnvio() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this._enviarParaNuvem(), 1500);
  },

  async _enviarParaNuvem() {
    if (!this.usuarioAtual) return;
    try {
      const dados = await db.exportAll();
      await firestore
        .collection('usuarios')
        .doc(this.usuarioAtual.uid)
        .set(dados);
    } catch (err) {
      console.error('Erro ao enviar dados para a nuvem:', err);
    }
  },

  async _puxarDaNuvem(uid) {
    try {
      const snap = await firestore.collection('usuarios').doc(uid).get();
      if (!snap.exists) {
        // Primeiro login deste usuário: sobe o que já existe localmente.
        await this._enviarParaNuvem();
        return;
      }

      const dadosNuvem = snap.data();

      // Evita que a importação (que dispara 'ta:mudou' várias vezes)
      // gere um novo envio para a nuvem logo em seguida.
      this._ignorarProximosEventos = true;
      await db.importAll(dadosNuvem, { substituir: true });
      this._ignorarProximosEventos = false;

      // Recarrega a tela atual para refletir os dados sincronizados.
      if (typeof router === 'function') router();
      showToast('Dados sincronizados.', 'success');
    } catch (err) {
      this._ignorarProximosEventos = false;
      console.error('Erro ao baixar dados da nuvem:', err);
    }
  }
};
