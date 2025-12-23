(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function nowIso() {
    return new Date().toISOString();
  }

  function daysAgo(n) {
    return Date.now() - n * 24 * 60 * 60 * 1000;
  }

  async function seedIfNeeded() {
    const { mockSeeded } = await NS.Storage.get(["mockSeeded"]);
    if (mockSeeded) return false;

    const contacts = await NS.CRM.Contacts.list();
    const history = await NS.Storage.getWithDefaults("history");

    const hasReal = (Array.isArray(contacts) && contacts.length > 0) || (history?.chats && Object.keys(history.chats).length > 0);
    if (hasReal) {
      await NS.Storage.set({ mockSeeded: true, mockSeededAt: nowIso(), mockSkippedBecauseRealData: true });
      return false;
    }

    const mockContacts = [
      {
        id: "contact_mock_ana",
        chatId: "mock:ana",
        name: "Ana (Loja Centro)",
        chatType: "private",
        phone: "+55 11 99999-1111",
        company: "Loja Centro",
        title: "Compras",
        tags: ["tag_quente"],
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: "contact_mock_bruno",
        chatId: "mock:bruno",
        name: "Bruno (TechLab)",
        chatType: "private",
        phone: "+55 21 98888-2222",
        company: "TechLab",
        title: "Founder",
        tags: ["tag_morno"],
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: "contact_mock_grupo",
        chatId: "mock:grupo_parcerias",
        name: "Grupo Parcerias",
        chatType: "group",
        company: "—",
        title: "Grupo",
        tags: ["tag_frio"],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ];

    const mockHistory = {
      chats: {
        "mock:ana": [
          { id: "msg1", chatId: "mock:ana", chatName: "Ana (Loja Centro)", direction: "in", text: "Oi! Qual o preço do plano?", timestampMs: daysAgo(2) },
          { id: "msg2", chatId: "mock:ana", chatName: "Ana (Loja Centro)", direction: "out", text: "Oi Ana! Qual plano você quer? Básico, Pro ou Enterprise?", timestampMs: daysAgo(2) + 60_000 }
        ],
        "mock:bruno": [
          { id: "msg3", chatId: "mock:bruno", chatName: "Bruno (TechLab)", direction: "in", text: "Vocês atendem sábado?", timestampMs: daysAgo(5) },
          { id: "msg4", chatId: "mock:bruno", chatName: "Bruno (TechLab)", direction: "out", text: "Hoje nosso horário é seg–sex 9h–18h. Se quiser, agendamos uma call.", timestampMs: daysAgo(5) + 120_000 }
        ]
      }
    };

    const mockAnalytics = {
      totals: { in: 12, out: 9 },
      daily: {
        [new Date(daysAgo(6)).toISOString().slice(0, 10)]: { in: 2, out: 1 },
        [new Date(daysAgo(4)).toISOString().slice(0, 10)]: { in: 3, out: 2 },
        [new Date(daysAgo(2)).toISOString().slice(0, 10)]: { in: 4, out: 3 },
        [new Date(daysAgo(1)).toISOString().slice(0, 10)]: { in: 3, out: 3 }
      }
    };

    await NS.Storage.set({
      contacts: mockContacts,
      history: mockHistory,
      analytics: mockAnalytics,
      suggestions: {
        "mock:ana": { suggestions: ["Claro! Me diga qual plano você quer e eu te passo o valor.", "Posso te enviar nossa tabela de preços. Qual seu objetivo?"], updatedAt: nowIso() }
      },
      mockSeeded: true,
      mockSeededAt: nowIso()
    });

    return true;
  }

  NS.MockData = { seedIfNeeded };
})();

