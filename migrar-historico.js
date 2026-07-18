/**
 * MIGRAÇÃO ÚNICA — histórico do Gran Questões
 * ---------------------------------------------
 * Como usar:
 * 1. Abra o app (https://gran-questoes-pwa.pages.dev/) no navegador.
 * 2. Confira no topo qual PERFIL está ativo (ex.: "Histórico Geral") —
 *    os dados serão importados para o perfil que estiver selecionado
 *    NESTE momento.
 * 3. Abra o DevTools (F12) > aba Console.
 * 4. Cole este arquivo inteiro e aperte Enter.
 * 5. Aguarde a mensagem de conclusão no console, depois dê F5 na página.
 *
 * IMPORTANTE — corte por data:
 * Você começou a lançar tentativas manualmente no app em 11/06/2026.
 * Para não duplicar com o que você já lançou à mão, este script importa
 * SÓ os meses ANTERIORES a junho/2026 (ou seja, até 2026-05). Os blocos
 * de 2026-06 e 2026-07 do JSON são ignorados de propósito.
 *
 * Este script só ADICIONA registros novos (db.tentativas.add). Ele nunca
 * limpa, atualiza ou remove nada que já existe. Depois de rodar uma vez,
 * pode descartar este arquivo — não precisa deixá-lo no projeto.
 */
(async () => {
  if (typeof db === 'undefined' || !db.tentativas || typeof db.tentativas.add !== 'function') {
    console.error('❌ Não encontrei o objeto "db". Rode este script na aba do app já carregado (não numa página em branco).');
    return;
  }

  const HISTORICO = {
  "dados_mensais": [
    {
      "mes": "2023-08",
      "periodo": "01/08/2023 a 31/08/2023",
      "disciplinas": [
        {
          "disciplina": "Língua Portuguesa",
          "certas": 190,
          "erradas": 260,
          "branco": 0,
          "total": 450,
          "percentual": 42.22
        }
      ]
    },
    {
      "mes": "2023-09",
      "periodo": "01/09/2023 a 30/09/2023",
      "disciplinas": [
        {
          "disciplina": "Língua Portuguesa",
          "certas": 105,
          "erradas": 52,
          "branco": 0,
          "total": 157,
          "percentual": 66.88
        }
      ]
    },
    {
      "mes": "2023-10",
      "periodo": "01/10/2023 a 31/10/2023",
      "disciplinas": [
        {
          "disciplina": "Língua Portuguesa",
          "certas": 19,
          "erradas": 11,
          "branco": 0,
          "total": 30,
          "percentual": 63.33
        }
      ]
    },
    {
      "mes": "2024-07",
      "periodo": "01/07/2024 a 31/07/2024",
      "disciplinas": [
        {
          "disciplina": "Administração de Recursos Materiais",
          "certas": 0,
          "erradas": 2,
          "branco": 0,
          "total": 2,
          "percentual": 0
        },
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 2,
          "erradas": 1,
          "branco": 0,
          "total": 3,
          "percentual": 66.67
        },
        {
          "disciplina": "Administração Geral",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Atualidades e Conhecimentos Gerais",
          "certas": 10,
          "erradas": 3,
          "branco": 0,
          "total": 13,
          "percentual": 76.92
        },
        {
          "disciplina": "Conhecimentos Bancários",
          "certas": 1,
          "erradas": 1,
          "branco": 0,
          "total": 2,
          "percentual": 50
        }
      ]
    },
    {
      "mes": "2024-08",
      "periodo": "01/08/2024 a 30/08/2024",
      "disciplinas": [
        {
          "disciplina": "Administração de Recursos Materiais",
          "certas": 2,
          "erradas": 4,
          "branco": 0,
          "total": 6,
          "percentual": 33.33
        },
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 9,
          "erradas": 57,
          "branco": 0,
          "total": 66,
          "percentual": 13.64
        },
        {
          "disciplina": "Administração Geral",
          "certas": 5,
          "erradas": 8,
          "branco": 0,
          "total": 13,
          "percentual": 38.46
        },
        {
          "disciplina": "Administração Pública",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Arquivologia",
          "certas": 1,
          "erradas": 2,
          "branco": 0,
          "total": 3,
          "percentual": 33.33
        }
      ]
    },
    {
      "mes": "2024-09",
      "periodo": "01/09/2024 a 30/09/2024",
      "disciplinas": [
        {
          "disciplina": "Administração de Recursos Materiais",
          "certas": 2,
          "erradas": 5,
          "branco": 0,
          "total": 7,
          "percentual": 28.57
        },
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 11,
          "erradas": 23,
          "branco": 0,
          "total": 34,
          "percentual": 32.35
        },
        {
          "disciplina": "Administração Geral",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Antropologia",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Arquivologia",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        }
      ]
    },
    {
      "mes": "2024-10",
      "periodo": "01/10/2024 a 31/10/2024",
      "disciplinas": [
        {
          "disciplina": "Administração Pública",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Artes",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Atualidades e Conhecimentos Gerais",
          "certas": 15,
          "erradas": 24,
          "branco": 0,
          "total": 39,
          "percentual": 38.46
        },
        {
          "disciplina": "Biologia",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Comunicação Social",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        }
      ]
    },
    {
      "mes": "2024-11",
      "periodo": "01/11/2024 a 30/11/2024",
      "disciplinas": [
        {
          "disciplina": "Administração Geral",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Administração Pública",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Atualidades e Conhecimentos Gerais",
          "certas": 9,
          "erradas": 5,
          "branco": 0,
          "total": 14,
          "percentual": 64.29
        },
        {
          "disciplina": "Biologia",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 1,
          "erradas": 1,
          "branco": 0,
          "total": 2,
          "percentual": 50
        }
      ]
    },
    {
      "mes": "2024-12",
      "periodo": "01/12/2024 a 31/12/2024",
      "disciplinas": [
        {
          "disciplina": "Agricultura e Agropecuária",
          "certas": 2,
          "erradas": 3,
          "branco": 0,
          "total": 5,
          "percentual": 40
        },
        {
          "disciplina": "Biologia",
          "certas": 2,
          "erradas": 0,
          "branco": 0,
          "total": 2,
          "percentual": 100
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 24,
          "erradas": 36,
          "branco": 0,
          "total": 60,
          "percentual": 40
        },
        {
          "disciplina": "Direito Agrário",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 0,
          "erradas": 2,
          "branco": 0,
          "total": 2,
          "percentual": 0
        }
      ]
    },
    {
      "mes": "2025-01",
      "periodo": "01/01/2025 a 31/01/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Pública",
          "certas": 2,
          "erradas": 0,
          "branco": 0,
          "total": 2,
          "percentual": 100
        },
        {
          "disciplina": "Agricultura e Agropecuária",
          "certas": 0,
          "erradas": 3,
          "branco": 0,
          "total": 3,
          "percentual": 0
        },
        {
          "disciplina": "Biblioteconomia",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Biologia",
          "certas": 2,
          "erradas": 1,
          "branco": 0,
          "total": 3,
          "percentual": 66.67
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 74,
          "erradas": 44,
          "branco": 0,
          "total": 118,
          "percentual": 62.71
        }
      ]
    },
    {
      "mes": "2025-02",
      "periodo": "01/02/2025 a 28/02/2025",
      "disciplinas": [
        {
          "disciplina": "Agricultura e Agropecuária",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 16,
          "erradas": 23,
          "branco": 0,
          "total": 39,
          "percentual": 41.03
        },
        {
          "disciplina": "Engenharia Agronômica",
          "certas": 14,
          "erradas": 15,
          "branco": 0,
          "total": 29,
          "percentual": 48.28
        },
        {
          "disciplina": "Engenharia Ambiental e Sanitária",
          "certas": 2,
          "erradas": 4,
          "branco": 0,
          "total": 6,
          "percentual": 33.33
        },
        {
          "disciplina": "Engenharia Cartográfica e de Agrimensura",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        }
      ]
    },
    {
      "mes": "2025-03",
      "periodo": "01/03/2025 a 31/03/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Geral",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        },
        {
          "disciplina": "Conhecimentos Bancários",
          "certas": 8,
          "erradas": 4,
          "branco": 0,
          "total": 12,
          "percentual": 66.67
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 40,
          "erradas": 44,
          "branco": 0,
          "total": 84,
          "percentual": 47.62
        },
        {
          "disciplina": "Direito Civil",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        }
      ]
    },
    {
      "mes": "2025-04",
      "periodo": "01/04/2025 a 30/04/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Geral",
          "certas": 1,
          "erradas": 1,
          "branco": 0,
          "total": 2,
          "percentual": 50
        },
        {
          "disciplina": "Administração Pública",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Conhecimentos Bancários",
          "certas": 19,
          "erradas": 12,
          "branco": 0,
          "total": 31,
          "percentual": 61.29
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 5,
          "erradas": 2,
          "branco": 0,
          "total": 7,
          "percentual": 71.43
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 116,
          "erradas": 90,
          "branco": 0,
          "total": 206,
          "percentual": 56.31
        }
      ]
    },
    {
      "mes": "2025-05",
      "periodo": "01/05/2025 a 31/05/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Geral",
          "certas": 3,
          "erradas": 1,
          "branco": 0,
          "total": 4,
          "percentual": 75
        },
        {
          "disciplina": "Atuária",
          "certas": 0,
          "erradas": 2,
          "branco": 0,
          "total": 2,
          "percentual": 0
        },
        {
          "disciplina": "Comunicação Social",
          "certas": 2,
          "erradas": 4,
          "branco": 0,
          "total": 6,
          "percentual": 33.33
        },
        {
          "disciplina": "Conhecimentos Bancários",
          "certas": 12,
          "erradas": 17,
          "branco": 0,
          "total": 29,
          "percentual": 41.38
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 2,
          "erradas": 1,
          "branco": 0,
          "total": 3,
          "percentual": 66.67
        }
      ]
    },
    {
      "mes": "2025-06",
      "periodo": "01/06/2025 a 30/06/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 110,
          "erradas": 76,
          "branco": 0,
          "total": 186,
          "percentual": 59.14
        },
        {
          "disciplina": "Administração Geral",
          "certas": 142,
          "erradas": 74,
          "branco": 0,
          "total": 216,
          "percentual": 65.74
        },
        {
          "disciplina": "Administração Pública",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Auditoria",
          "certas": 5,
          "erradas": 0,
          "branco": 0,
          "total": 5,
          "percentual": 100
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 5,
          "erradas": 4,
          "branco": 0,
          "total": 9,
          "percentual": 55.56
        }
      ]
    },
    {
      "mes": "2025-07",
      "periodo": "01/07/2025 a 31/07/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 383,
          "erradas": 164,
          "branco": 0,
          "total": 547,
          "percentual": 70.02
        },
        {
          "disciplina": "Administração Geral",
          "certas": 129,
          "erradas": 45,
          "branco": 0,
          "total": 174,
          "percentual": 74.14
        },
        {
          "disciplina": "Administração Pública",
          "certas": 12,
          "erradas": 2,
          "branco": 0,
          "total": 14,
          "percentual": 85.71
        },
        {
          "disciplina": "Auditoria",
          "certas": 6,
          "erradas": 2,
          "branco": 0,
          "total": 8,
          "percentual": 75
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 9,
          "erradas": 3,
          "branco": 0,
          "total": 12,
          "percentual": 75
        }
      ]
    },
    {
      "mes": "2025-08",
      "periodo": "01/08/2025 a 31/08/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 98,
          "erradas": 53,
          "branco": 0,
          "total": 151,
          "percentual": 64.9
        },
        {
          "disciplina": "Auditoria",
          "certas": 37,
          "erradas": 18,
          "branco": 0,
          "total": 55,
          "percentual": 67.27
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 2,
          "erradas": 1,
          "branco": 0,
          "total": 3,
          "percentual": 66.67
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 23,
          "erradas": 15,
          "branco": 0,
          "total": 38,
          "percentual": 60.53
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 10,
          "erradas": 9,
          "branco": 0,
          "total": 19,
          "percentual": 52.63
        }
      ]
    },
    {
      "mes": "2025-09",
      "periodo": "01/09/2025 a 30/09/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 174,
          "erradas": 124,
          "branco": 0,
          "total": 298,
          "percentual": 58.39
        },
        {
          "disciplina": "Administração Geral",
          "certas": 11,
          "erradas": 4,
          "branco": 0,
          "total": 15,
          "percentual": 73.33
        },
        {
          "disciplina": "Administração Pública",
          "certas": 42,
          "erradas": 28,
          "branco": 0,
          "total": 70,
          "percentual": 60
        },
        {
          "disciplina": "Auditoria",
          "certas": 103,
          "erradas": 57,
          "branco": 0,
          "total": 160,
          "percentual": 64.38
        },
        {
          "disciplina": "Contabilidade de Custos",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        }
      ]
    },
    {
      "mes": "2025-10",
      "periodo": "01/10/2025 a 31/10/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 143,
          "erradas": 108,
          "branco": 0,
          "total": 251,
          "percentual": 56.97
        },
        {
          "disciplina": "Administração Geral",
          "certas": 3,
          "erradas": 4,
          "branco": 0,
          "total": 7,
          "percentual": 42.86
        },
        {
          "disciplina": "Administração Pública",
          "certas": 72,
          "erradas": 48,
          "branco": 0,
          "total": 120,
          "percentual": 60
        },
        {
          "disciplina": "Auditoria",
          "certas": 87,
          "erradas": 57,
          "branco": 0,
          "total": 144,
          "percentual": 60.42
        },
        {
          "disciplina": "Contabilidade de Custos",
          "certas": 2,
          "erradas": 2,
          "branco": 0,
          "total": 4,
          "percentual": 50
        }
      ]
    },
    {
      "mes": "2025-11",
      "periodo": "01/11/2025 a 30/11/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 55,
          "erradas": 30,
          "branco": 0,
          "total": 85,
          "percentual": 64.71
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 4,
          "erradas": 0,
          "branco": 0,
          "total": 4,
          "percentual": 100
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 47,
          "erradas": 18,
          "branco": 0,
          "total": 65,
          "percentual": 72.31
        },
        {
          "disciplina": "Direito Civil",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 26,
          "erradas": 16,
          "branco": 0,
          "total": 42,
          "percentual": 61.9
        }
      ]
    },
    {
      "mes": "2025-12",
      "periodo": "01/12/2025 a 31/12/2025",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 29,
          "erradas": 7,
          "branco": 0,
          "total": 36,
          "percentual": 80.56
        },
        {
          "disciplina": "Administração Pública",
          "certas": 8,
          "erradas": 0,
          "branco": 0,
          "total": 8,
          "percentual": 100
        },
        {
          "disciplina": "Auditoria",
          "certas": 13,
          "erradas": 2,
          "branco": 0,
          "total": 15,
          "percentual": 86.67
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 4,
          "erradas": 1,
          "branco": 0,
          "total": 5,
          "percentual": 80
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 12,
          "erradas": 1,
          "branco": 0,
          "total": 13,
          "percentual": 92.31
        }
      ]
    },
    {
      "mes": "2026-02",
      "periodo": "01/02/2026 a 28/02/2026",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Auditoria",
          "certas": 5,
          "erradas": 5,
          "branco": 0,
          "total": 10,
          "percentual": 50
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 41,
          "erradas": 17,
          "branco": 0,
          "total": 58,
          "percentual": 70.69
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Ética",
          "certas": 0,
          "erradas": 1,
          "branco": 0,
          "total": 1,
          "percentual": 0
        }
      ]
    },
    {
      "mes": "2026-03",
      "periodo": "01/03/2026 a 31/03/2026",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 19,
          "erradas": 15,
          "branco": 0,
          "total": 34,
          "percentual": 55.88
        },
        {
          "disciplina": "Administração Pública",
          "certas": 5,
          "erradas": 3,
          "branco": 0,
          "total": 8,
          "percentual": 62.5
        },
        {
          "disciplina": "Auditoria",
          "certas": 16,
          "erradas": 8,
          "branco": 0,
          "total": 24,
          "percentual": 66.67
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 115,
          "erradas": 105,
          "branco": 0,
          "total": 220,
          "percentual": 52.27
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 10,
          "erradas": 10,
          "branco": 0,
          "total": 20,
          "percentual": 50
        }
      ]
    },
    {
      "mes": "2026-04",
      "periodo": "01/04/2026 a 30/04/2026",
      "disciplinas": [
        {
          "disciplina": "Administração Pública",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 115,
          "erradas": 86,
          "branco": 0,
          "total": 201,
          "percentual": 57.21
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 1,
          "erradas": 0,
          "branco": 0,
          "total": 1,
          "percentual": 100
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 143,
          "erradas": 110,
          "branco": 0,
          "total": 253,
          "percentual": 56.52
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 108,
          "erradas": 98,
          "branco": 0,
          "total": 206,
          "percentual": 52.43
        }
      ]
    },
    {
      "mes": "2026-05",
      "periodo": "01/05/2026 a 31/05/2026",
      "disciplinas": [
        {
          "disciplina": "Auditoria",
          "certas": 21,
          "erradas": 19,
          "branco": 0,
          "total": 40,
          "percentual": 52.5
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 74,
          "erradas": 50,
          "branco": 0,
          "total": 124,
          "percentual": 59.68
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 69,
          "erradas": 63,
          "branco": 0,
          "total": 132,
          "percentual": 52.27
        },
        {
          "disciplina": "Direito Ambiental",
          "certas": 1,
          "erradas": 1,
          "branco": 0,
          "total": 2,
          "percentual": 50
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 7,
          "erradas": 3,
          "branco": 0,
          "total": 10,
          "percentual": 70
        }
      ]
    },
    {
      "mes": "2026-06",
      "periodo": "01/06/2026 a 30/06/2026",
      "disciplinas": [
        {
          "disciplina": "Administração Pública",
          "certas": 1,
          "erradas": 1,
          "branco": 0,
          "total": 2,
          "percentual": 50
        },
        {
          "disciplina": "Contabilidade Geral",
          "certas": 36,
          "erradas": 14,
          "branco": 0,
          "total": 50,
          "percentual": 72
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 3,
          "erradas": 2,
          "branco": 0,
          "total": 5,
          "percentual": 60
        },
        {
          "disciplina": "Direito Administrativo",
          "certas": 60,
          "erradas": 25,
          "branco": 0,
          "total": 85,
          "percentual": 70.59
        },
        {
          "disciplina": "Direito Constitucional",
          "certas": 30,
          "erradas": 6,
          "branco": 0,
          "total": 36,
          "percentual": 83.33
        }
      ]
    },
    {
      "mes": "2026-07",
      "periodo": "01/07/2026 a 17/07/2026",
      "disciplinas": [
        {
          "disciplina": "Administração Financeira e Orçamentária - AFO",
          "certas": 37,
          "erradas": 23,
          "branco": 0,
          "total": 60,
          "percentual": 61.67
        },
        {
          "disciplina": "Administração Geral",
          "certas": 5,
          "erradas": 1,
          "branco": 0,
          "total": 6,
          "percentual": 83.33
        },
        {
          "disciplina": "Administração Pública",
          "certas": 19,
          "erradas": 5,
          "branco": 0,
          "total": 24,
          "percentual": 79.17
        },
        {
          "disciplina": "Contabilidade Pública",
          "certas": 0,
          "erradas": 2,
          "branco": 0,
          "total": 2,
          "percentual": 0
        },
        {
          "disciplina": "Controle da Administração",
          "certas": 2,
          "erradas": 0,
          "branco": 0,
          "total": 2,
          "percentual": 100
        }
      ]
    }
  ]
};

  function parseDataFim(periodo) {
    // periodo vem como "DD/MM/AAAA a DD/MM/AAAA" — pegamos a segunda data.
    const m = String(periodo || '').match(/a\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Junho/2026 entra normalmente (mesmo com sobreposição parcial a partir do
  // dia 11, por decisão do usuário). Só julho/2026 em diante é pulado, por já
  // estar totalmente coberto pelos lançamentos manuais no app.
  const MES_CORTE = '2026-07';

  let inseridos = 0;
  let ignorados = 0;
  let pulados = 0;

  for (const bloco of HISTORICO.dados_mensais || []) {
    if (bloco.mes >= MES_CORTE) {
      console.log(`⏭️ Pulando ${bloco.mes} (sobreposição com lançamentos manuais no app).`);
      pulados++;
      continue;
    }

    const dataFim = parseDataFim(bloco.periodo);
    if (!dataFim) {
      console.warn('⚠️ Não consegui interpretar o período, pulando bloco:', bloco.mes);
      continue;
    }

    for (const d of bloco.disciplinas || []) {
      const acertos = Number(d.certas) || 0;
      const erros = Number(d.erradas) || 0;
      const branco = Number(d.branco) || 0;
      const numQuestoes = acertos + erros + branco;

      if (!d.disciplina || numQuestoes === 0) {
        ignorados++;
        continue;
      }

      const taxa = numQuestoes > 0
        ? Number(((acertos / numQuestoes) * 100).toFixed(2))
        : 0;

      await db.tentativas.add({
        disciplina: d.disciplina,
        assunto: 'Histórico importado',
        banca: '',
        concurso: '',
        data: dataFim,
        numQuestoes,
        acertos,
        erros,
        taxa,
        tipo: 'Primeiro estudo',
        observacoes: `Importado do histórico Gran Questões — ${bloco.mes}`
      });
      inseridos++;
    }
  }

  console.log(`✅ Migração concluída: ${inseridos} registro(s) adicionados.${ignorados ? ` (${ignorados} ignorado(s) por estarem vazios/incompletos)` : ''}${pulados ? ` (${pulados} mês(es) pulado(s) por sobreposição: a partir de ${MES_CORTE})` : ''}`);
  console.log('Dê F5 na página para ver os dados atualizados na Dashboard, gráficos e Estatísticas.');
})();
