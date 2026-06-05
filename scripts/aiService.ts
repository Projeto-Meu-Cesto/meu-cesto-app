import { FinanceContext } from './financeContext';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const LUCA_MODELS = {
  primary: 'gemini-2.5-flash',
  fallback: 'gemini-2.5-flash-lite',
};

type LucaRole = 'user' | 'model';

export type LucaHistoryItem = {
  role: LucaRole;
  parts: { text: string }[];
};

type GeminiContent = {
  role: LucaRole;
  parts: { text: string }[];
};

type LucaResponseParams = {
  history: LucaHistoryItem[];
  message: string;
  context?: FinanceContext | null;
  model?: string;
};

const ALLOWED_CATEGORIES = [
  'Frutas',
  'Laticínios',
  'Limpeza',
  'Higiene',
  'Bebidas',
  'Padaria',
  'Carnes',
  'Outros',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function localCategory(productName: string): string {
  const name = normalizeText(productName);

  if (/(banana|maca|maça|uva|morango|laranja|limao|limão|abacaxi|mamao|mamão|melancia|fruta)/.test(name)) {
    return 'Frutas';
  }

  if (/(leite|queijo|iogurte|manteiga|requeijao|requeijão|laticinio|laticínio)/.test(name)) {
    return 'Laticínios';
  }

  if (/(detergente|sabao|sabão|amaciante|limpador|desinfetante|esponja|cloro|sanitaria|sanitária)/.test(name)) {
    return 'Limpeza';
  }

  if (/(shampoo|sabonete|pasta|escova|desodorante|papel higienico|papel higiênico|absorvente)/.test(name)) {
    return 'Higiene';
  }

  if (/(agua|água|suco|refrigerante|cerveja|vinho|cafe|café|cha|chá|bebida)/.test(name)) {
    return 'Bebidas';
  }

  if (/(pao|pão|bolo|biscoito|bolacha|rosca|baguete|padaria)/.test(name)) {
    return 'Padaria';
  }

  if (/(carne|frango|peixe|linguica|linguiça|presunto|salame|bife|costela)/.test(name)) {
    return 'Carnes';
  }

  return 'Outros';
}

export function categorizeProductLocal(productName: string): string {
  return localCategory(productName);
}

async function callGeminiText({
  contents,
  systemInstruction,
  model = LUCA_MODELS.primary,
  temperature = 0.35,
  maxOutputTokens = 900,
}: {
  contents: GeminiContent[];
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction
        ? {
            parts: [{ text: systemInstruction }],
          }
        : undefined,
      generationConfig: {
        temperature,
        topP: 0.9,
        maxOutputTokens,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data.error?.message || `Gemini HTTP ${response.status}`;
    throw new Error(message);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini não retornou texto.');
  }

  return text;
}

function buildContextBlock(context?: FinanceContext | null): string {
  if (!context) {
    return 'Dados reais do usuário: ainda não carregados.';
  }

  const topItems = context.topItems.length > 0
    ? context.topItems.map((item) => `${item.name} (${formatCurrency(item.price)})`).join(', ')
    : 'nenhum item com preço registrado';

  const monthlyTotals = context.monthlyTotals.length > 0
    ? context.monthlyTotals.map((month) => `${month.label}: ${formatCurrency(month.total)}`).join('; ')
    : 'sem histórico mensal suficiente';

  return `Dados reais do usuário:
- Mês atual: ${context.currentMonthLabel}
- Total do mês atual: ${formatCurrency(context.currentMonthTotal)}
- Total do mês anterior: ${formatCurrency(context.previousMonthTotal)}
- Estimativa mensal pela média recente: ${context.estimatedMonthlySpend > 0 ? formatCurrency(context.estimatedMonthlySpend) : 'sem dados suficientes'}
- Quantidade de compras confirmadas no mês atual: ${context.currentMonthItemCount}
- Gastos por categoria no mês atual:
  - Alimentação (mercado geral): ${formatCurrency(context.categoryTotals.Alimentação)}
  - Outros: ${formatCurrency(context.categoryTotals.Outros)}
- Últimos itens com preço: ${topItems}
- Evolução mensal recente: ${monthlyTotals}`;
}

function buildLucaSystemInstruction(context?: FinanceContext | null): string {
  return `Você é Luca, assistente financeiro e especialista em compras inteligentes do app Meu Cesto.

PERSONALIDADE:
- Fale em português brasileiro.
- Seja amigável, direto e útil.
- Use linguagem simples.
- Responda curto por padrão, mas detalhe quando o usuário pedir análise.
- Use markdown simples quando ajudar: títulos curtos, listas e negrito.

ESCOPO:
- Ajude com gastos, orçamento doméstico, mercado, lista de compras, economia e comparação de consumo.
- Não dê recomendação de investimento de risco.
- Não invente números, preços, saldos ou históricos.
- Quando não houver dados suficientes, diga isso claramente e sugira o próximo passo prático.

REGRAS DE DADOS:
- Use os dados reais abaixo como fonte principal.
- Se a pergunta pedir análise dos gastos, cite total do mês, categoria mais forte e uma ação concreta.
- Se os dados estiverem zerados, oriente o usuário a adicionar itens com preço para melhorar a análise.
- Não diga que acessou banco, Open Finance ou cartão; este app usa a lista e o histórico registrados pelo usuário.

${buildContextBlock(context)}`;
}

function localLucaFallback(message: string, context?: FinanceContext | null): string {
  const normalized = normalizeText(message);

  if (context && (normalized.includes('gasto') || normalized.includes('analise') || normalized.includes('mês') || normalized.includes('mes'))) {
    const categoryEntries = Object.entries(context.categoryTotals).sort((a, b) => b[1] - a[1]);
    const [topCategory, topValue] = categoryEntries[0] || ['Outros', 0];

    if (context.currentMonthTotal <= 0) {
      return '**Análise do mês**\n\nAinda não tenho compras confirmadas neste mês. Adicione itens com preço na lista e marque como comprados para eu calcular total, categorias e tendência.';
    }

    return `**Análise do mês**\n\nVocê confirmou **${formatCurrency(context.currentMonthTotal)}** em compras neste mês.\n\n- Categoria principal: **${topCategory}** (${formatCurrency(topValue)})\n- Compras confirmadas: **${context.currentMonthItemCount}**\n- Estimativa mensal: **${context.estimatedMonthlySpend > 0 ? formatCurrency(context.estimatedMonthlySpend) : 'sem dados suficientes'}**\n\nAção prática: revise os itens de ${topCategory} e veja se algum pode ser comprado em maior quantidade, trocado por marca equivalente ou cortado na próxima lista.`;
  }

  if (!GEMINI_API_KEY) {
    return 'A chave do Gemini ainda não está configurada no `.env`. Mesmo assim, posso fazer análises básicas quando houver itens com preço na sua lista.';
  }

  return 'Não consegui acessar a IA agora. Tente novamente em instantes; se quiser, peça “analise meus gastos do mês” que eu faço uma leitura básica com os dados salvos.';
}

export const categorizeProduct = async (productName: string): Promise<string> => {
  const fallback = localCategory(productName);

  try {
    const result = await callGeminiText({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Categorize o produto "${productName}" em uma destas categorias: ${ALLOWED_CATEGORIES.join(', ')}. Responda apenas a categoria.`,
            },
          ],
        },
      ],
      systemInstruction: 'Você classifica produtos de mercado. Responda só com uma categoria permitida.',
      model: LUCA_MODELS.fallback,
      temperature: 0.1,
      maxOutputTokens: 20,
    });

    const clean = result.replace(/[^\p{L}\s]/gu, '').trim();
    return ALLOWED_CATEGORIES.includes(clean) ? clean : fallback;
  } catch (error) {
    console.warn('Fallback local de categoria usado:', error);
    return fallback;
  }
};

export const filterResultsWithAI = async (results: any[], activeFilter: string): Promise<any[]> => {
  if (activeFilter === 'Tudo') return results;

  const localMatches = results.filter((result) => localCategory(result.description) === activeFilter);

  try {
    const productList = results.map((result) => result.description).join('; ');
    const response = await callGeminiText({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Lista: ${productList}\nCategoria desejada: ${activeFilter}\nRetorne apenas os nomes que pertencem à categoria, separados por ponto e vírgula. Se nenhum, responda "Nenhum".`,
            },
          ],
        },
      ],
      systemInstruction: 'Você filtra produtos de mercado com precisão e responde só no formato pedido.',
      model: LUCA_MODELS.fallback,
      temperature: 0.1,
      maxOutputTokens: 300,
    });

    const matches = response.split(';').map((item) => item.trim().toLowerCase());
    if (matches.some((item) => item === 'nenhum')) return [];

    return results.filter((result) =>
      matches.some((match) => result.description.toLowerCase().includes(match))
    );
  } catch (error) {
    console.warn('Fallback local de filtro usado:', error);
    return localMatches.length > 0 ? localMatches : results;
  }
};

export const filterProductsByRegionWithAI = async (
  results: any[],
  location: { city?: string; state?: string; country?: string }
): Promise<any[]> => {
  if (!location || results.length === 0) return results;

  try {
    const regionName = [location.city, location.state, location.country].filter(Boolean).join(', ');
    const productList = results
      .map((result, idx) => `${idx}: ${result.name || result.description || ''}`)
      .join(' | ');

    const response = await callGeminiText({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Você é um assistente de mercado brasileiro. Região do usuário: ${regionName}.\n\nLista de produtos:\n${productList}\n\nReordene ou filtre a lista priorizando marcas regionais locais, produtos típicos ou marcas mais populares e consumidas na região indicada. Retorne APENAS os índices dos produtos (ex: "0, 2, 1, 3") em ordem de relevância geográfica. Se todos forem igualmente relevantes, retorne todos na ordem original.`
            }
          ]
        }
      ],
      systemInstruction: 'Você ordena e filtra índices de produtos com base na relevância geográfica. Responda apenas com os índices separados por vírgula.',
      model: LUCA_MODELS.fallback,
      temperature: 0.15,
      maxOutputTokens: 200,
    });

    const indices = response
      .replace(/[^\d,]/g, '')
      .split(',')
      .map(num => parseInt(num.trim(), 10))
      .filter(num => !isNaN(num) && num >= 0 && num < results.length);

    if (indices.length === 0) return results;

    const sortedResults: any[] = [];
    const addedIndices = new Set<number>();

    indices.forEach(idx => {
      if (!addedIndices.has(idx)) {
        sortedResults.push(results[idx]);
        addedIndices.add(idx);
      }
    });

    results.forEach((result, idx) => {
      if (!addedIndices.has(idx)) {
        sortedResults.push(result);
      }
    });

    return sortedResults;
  } catch (error) {
    console.warn('Filtro de região por IA falhou, usando ordem original:', error);
    return results;
  }
};

export const getLucaResponse = async ({
  history,
  message,
  context,
  model = LUCA_MODELS.primary,
}: LucaResponseParams): Promise<string> => {
  const contents: GeminiContent[] = [
    ...history.slice(-12),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  try {
    return await callGeminiText({
      contents,
      systemInstruction: buildLucaSystemInstruction(context),
      model,
      temperature: 0.45,
      maxOutputTokens: 1100,
    });
  } catch (primaryError) {
    console.warn('Modelo principal do Gemini falhou:', primaryError);

    try {
      return await callGeminiText({
        contents,
        systemInstruction: buildLucaSystemInstruction(context),
        model: LUCA_MODELS.fallback,
        temperature: 0.35,
        maxOutputTokens: 900,
      });
    } catch (fallbackError) {
      console.warn('Fallback do Gemini falhou:', fallbackError);
      return localLucaFallback(message, context);
    }
  }
};
