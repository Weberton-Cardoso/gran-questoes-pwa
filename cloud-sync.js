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
 *
 * REDE DE SEGURANÇA (adicionada após um incidente de perda de dados):
 * - Antes de QUALQUER envio para a nuvem que vá sobrescrever o documento
 *   principal, o conteúdo atual da nuvem é copiado para
 *   usuarios/{uid}/backups/{auto} — assim, mesmo que o envio seguinte
 *   esteja errado/vazio, o estado anterior fica preservado ali.
 * - Antes de puxar da nuvem (que substitui o banco local), o app cria um
 *   backup automático local do que já existe no aparelho.
 * - Se a nuvem estiver vazia mas o aparelho tiver dados, o app NÃO
 *   substitui o local pelo vazio (e avisa). Se o aparelho estiver vazio
 *   mas a nuvem tiver dados, o app NÃO sobrescreve a nuvem com o vazio.
 *   Isso evita que qualquer um dos dois lados apague o outro por engano.
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

  /** Soma quantos itens (tentativas + editais + simulados + ciclos +
   *  cicloMaterias + cicloSessoes) um pacote de dados tem, pra detectar
   *  se ele está "essencialmente vazio". */
  _totalItens(dados) {
    if (!dados) return 0;
    const chaves = ['tentativas', 'editais', 'simulados', 'ciclos', 'cicloMaterias', 'cicloSessoes'];
    return chaves.reduce((soma, chave) => soma + (Array.isArray(dados[chave]) ? dados[chave].length : 0), 0);
  },

  /** Copia o documento principal atual da nuvem para uma subcoleção de
   *  backups ANTES de sobrescrevê-lo. Isso garante que, mesmo que o envio
   *  seguinte esteja errado, o estado anterior fica preservado. */
  async _snapshotNuvemAntesDeSobrescrever(motivo) {
    if (!this.usuarioAtual) return;
    try {
      const ref = firestore.collection('usuarios').doc(this.usuarioAtual.uid);
      const snap = await ref.get();
      if (!snap.exists) return; // nada pra guardar ainda
      const dadosAtuais = snap.data();
      await ref.collection('backups').add({
        motivo: motivo || 'auto',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        dados: dadosAtuais
      });
    } catch (err) {
      console.error('Erro ao salvar snapshot de segurança na nuvem:', err);
    }
  },

  /** Lista os backups salvos na nuvem (mais recentes primeiro), para a
   *  tela de Configurações mostrar e permitir restaurar. */
  async listarBackupsNuvem(limite = 20) {
    if (!this.usuarioAtual) return [];
    const ref = firestore.collection('usuarios').doc(this.usuarioAtual.uid).collection('backups');
    const query = await ref.orderBy('criadoEm', 'desc').limit(limite).get();
    return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  /** Restaura um backup específico da nuvem (por id do documento) direto
   *  no banco local do perfil ativo. Não mexe na nuvem — se depois disso
   *  o app sincronizar de novo, o backup restaurado é que sobe. */
  async restaurarBackupNuvem(backupId) {
    if (!this.usuarioAtual) throw new Error('Não há usuário logado.');
    const doc = await firestore
      .collection('usuarios').doc(this.usuarioAtual.uid)
      .collection('backups').doc(backupId).get();
    if (!doc.exists) throw new Error('Backup não encontrado.');
    const { dados } = doc.data();

    this._ignorarProximosEventos = true;
    await db.criarBackupLocalAutomatico('antes_de_restaurar_backup_nuvem').catch(() => {});
    await db.importAll(dados, { substituir: true });
    this._ignorarProximosEventos = false;
  },

  async _enviarParaNuvem() {
    if (!this.usuarioAtual) return;
    try {
      const dados = await db.exportAll();
      const totalLocal = this._totalItens(dados);

      // Sempre guarda o estado atual da nuvem antes de sobrescrever,
      // independente do que vier a seguir.
      await this._snapshotNuvemAntesDeSobrescrever('antes_de_enviar');

      if (totalLocal === 0) {
        const docAtual = await firestore.collection('usuarios').doc(this.usuarioAtual.uid).get();
        const totalNuvemAtual = docAtual.exists ? this._totalItens(docAtual.data()) : 0;
        if (totalNuvemAtual > 0) {
          console.warn('[cloud-sync] Envio abortado: dados locais vazios, mas a nuvem tem dados. Preservando a nuvem.');
          showToast('Sincronização pulada: este aparelho está sem dados locais. A nuvem foi preservada.', 'warning');
          return;
        }
      }

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
      const totalNuvem = this._totalItens(dadosNuvem);
      const totalLocalAtual = this._totalItens(await db.exportAll());

      if (totalNuvem === 0 && totalLocalAtual > 0) {
        console.warn('[cloud-sync] Sincronização abortada: a nuvem está vazia, mas este aparelho tem dados. Preservando os dados locais.');
        showToast('Sincronização pulada: a nuvem está vazia. Seus dados locais foram preservados.', 'warning');
        return;
      }

      // Backup de segurança do que já existe localmente, antes de substituir.
      await db.criarBackupLocalAutomatico('antes_de_puxar_da_nuvem').catch(() => {});

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
