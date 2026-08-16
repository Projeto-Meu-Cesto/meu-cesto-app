import { getLucaFailureFallback, type LucaFailureReason } from '../domain/aiFallback';
import { FinanceContext } from './financeContext';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const LUCA_MODELS = {
  primary: 'gemini-3.5-flash',
  fallback: 'gemini-3.0-flash-exp',
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

export type GeneratedShoppingItem = {
  name: string;
  category: string;
  estimatedPrice?: number;
};

export type GeneratedShoppingList = {
  title: string;
  items: GeneratedShoppingItem[];
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

// Palavras-chave que indicam tópicos fora do escopo do LUCA
const OUT_OF_SCOPE_KEYWORDS = [
  'investimento',
  'ação',
  'bolsa de valores',
  'criptomoeda',
  'bitcoin',
  'renda fixa',
  'tesouro direto',
  'fundo imobiliário',
  'imposto de renda',
  'declaração',
  'receita federal',
  'jurídico',
  'advogado',
  'processo',
  'política',
  'religião',
  'esporte',
  'futebol',
  'notícia',
  'clima',
  'previsão do tempo',
  'receita culinária',
  'como fazer',
  'piada',
  'música',
  'filme',
  'série',
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

// Detecta se a mensagem pede para montar uma lista de compras
export function isShoppingListRequest(message: string): boolean {
  const normalized = normalizeText(message);
  const triggers = [
    'monta',
    'montar',
    'cria',
    'criar',
    'gera',
    'gerar',
    'sugere',
    'sugerir',
    'faz',
    'fazer',
    'prepara',
    'preparar',
  ];
  const targets = [
    'lista de compras',
    'lista do mercado',
    'lista de mercado',
    'lista de supermercado',
    'minha lista',
    'uma lista',
    'lista pra',
    'lista para',
  ];
  return triggers.some((t) => normalized.includes(t)) && targets.some((tg) => normalized.includes(tg));
}

// Detecta se a mensagem está fora do escopo do LUCA
export function isOutOfScope(message: string): boolean {
  const normalized = normalizeText(message);
  return OUT_OF_SCOPE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
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

ESCOPO — você só responde sobre:
- Gastos pessoais, orçamento doméstico e controle de despesas.
- Lista de compras, mercado e supermercado.
- Comparação de consumo, economia e dicas de compra.
- Categorias de produtos e organização financeira básica do dia a dia.

FUNÇÃO ESPECIAL:
- Se o usuário pedir para "criar", "montar" ou "fazer" uma lista de compras, o sistema vai interceptar automaticamente o seu comando e criar a lista real no banco de dados. Portanto, você só precisa responder amigavelmente confirmando que a lista está sendo gerada e dando uma dica de economia ou finança rápida com base nos hábitos dele.

FORA DO ESCOPO — se o usuário perguntar sobre qualquer outro assunto (investimentos, bolsa de valores, criptomoedas, política, receitas culinárias, esportes, previsão do tempo, piadas, filmes, séries ou qualquer tema não relacionado a compras e finanças domésticas), responda educadamente que você é especializado em compras e finanças do dia a dia e não pode ajudar com esse tópico. Sugira que o usuário use outro assistente para isso.

REGRAS DE DADOS:
- Use os dados reais abaixo como fonte principal.
- Se a pergunta pedir análise dos gastos, cite total do mês, categoria mais forte e uma ação concreta.
- Se os dados estiverem zerados, oriente o usuário a adicionar itens com preço para melhorar a análise.
- Não invente números, preços, saldos ou históricos.
- Não diga que acessou banco, Open Finance ou cartão; este app usa a lista e o histórico registrados pelo usuário.

${buildContextBlock(context)}`;
}

function buildShoppingListSystemInstruction(context?: FinanceContext | null): string {
  const topItems = context?.topItems?.length
    ? context.topItems.map((i) => i.name).join(', ')
    : null;

  const historyBlock = topItems
    ? `O usuário costuma comprar: ${topItems}.`
    : 'O usuário não tem histórico de compras ainda.';

  return `Você é Luca, assistente de compras do app Meu Cesto. Sua tarefa é gerar uma lista de compras de mercado.

${historyBlock}

Retorne APENAS um JSON válido, sem texto extra, sem markdown, sem blocos de código. O formato deve ser exatamente:
{
  "title": "Lista da semana",
  "items": [
    { "name": "Leite integral", "category": "Laticínios", "estimatedPrice": 6.90 },
    { "name": "Arroz 5kg", "category": "Outros", "estimatedPrice": 22.00 }
  ]
}

Categorias permitidas: Frutas, Laticínios, Limpeza, Higiene, Bebidas, Padaria, Carnes, Outros.
Gere entre 8 e 15 itens práticos e variados para uma semana típica de mercado no Brasil.
Priorize itens que o usuário já comprou antes, se houver histórico.
Os preços estimados devem ser realistas para o mercado brasileiro atual.`;
}

function classifyAiFailure(error: unknown): LucaFailureReason {
  if (!GEMINI_API_KEY) return 'missing_configuration';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('quota') || message.includes('429') || message.includes('resource-exhausted')
    ? 'quota'
    : 'network';
}

function localShoppingListFallback(context?: FinanceContext | null): GeneratedShoppingList {
  const fromHistory: GeneratedShoppingItem[] = context?.topItems?.slice(0, 5).map((item) => ({
    name: item.name,
    category: localCategory(item.name),
    estimatedPrice: item.price,
  })) ?? [];

  const defaults: GeneratedShoppingItem[] = [
    { name: 'Arroz 5kg', category: 'Outros', estimatedPrice: 22.0 },
    { name: 'Feijão 1kg', category: 'Outros', estimatedPrice: 8.5 },
    { name: 'Leite integral 1L', category: 'Laticínios', estimatedPrice: 6.9 },
    { name: 'Pão de forma', category: 'Padaria', estimatedPrice: 7.5 },
    { name: 'Ovos (dúzia)', category: 'Outros', estimatedPrice: 12.0 },
    { name: 'Frango 1kg', category: 'Carnes', estimatedPrice: 18.5 },
    { name: 'Banana (cacho)', category: 'Frutas', estimatedPrice: 5.0 },
    { name: 'Detergente', category: 'Limpeza', estimatedPrice: 2.5 },
  ];

  const existingNames = new Set(fromHistory.map((i) => normalizeText(i.name)));
  const complementary = defaults.filter((d) => !existingNames.has(normalizeText(d.name)));
  const items = [...fromHistory, ...complementary].slice(0, 12);

  return { title: 'Lista da semana', items };
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
              text: `Você é um assistente de mercado brasileiro. Região do usuário: ${regionName}.\n\nLista de produtos:\n${productList}\n\nReordene ou filtre a lista priorizando marcas regionais locais, produtos típicos ou marcas mais populares e consumidas na região indicada. Retorne APENAS os índices dos produtos (ex: "0, 2, 1, 3") em ordem de relevância geográfica. Se todos forem igualmente relevantes, retorne todos na ordem original.`,
            },
          ],
        },
      ],
      systemInstruction: 'Você ordena e filtra índices de produtos com base na relevância geográfica. Responda apenas com os índices separados por vírgula.',
      model: LUCA_MODELS.fallback,
      temperature: 0.15,
      maxOutputTokens: 200,
    });

    const indices = response
      .replace(/[^\d,]/g, '')
      .split(',')
      .map((num) => parseInt(num.trim(), 10))
      .filter((num) => !isNaN(num) && num >= 0 && num < results.length);

    if (indices.length === 0) return results;

    const sortedResults: any[] = [];
    const addedIndices = new Set<number>();

    indices.forEach((idx) => {
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

// Gera uma lista de compras completa com base no histórico do usuário
export const generateShoppingList = async (
  context?: FinanceContext | null,
  userMessage?: string
): Promise<GeneratedShoppingList> => {
  try {
    const prompt = userMessage
      ? `O usuário pediu: "${userMessage}". Gere uma lista de compras personalizada considerando esse pedido e o histórico disponível.`
      : 'Gere uma lista de compras completa para a semana com base no histórico do usuário.';

    const raw = await callGeminiText({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: buildShoppingListSystemInstruction(context),
      model: LUCA_MODELS.primary,
      temperature: 0.4,
      maxOutputTokens: 1200,
    });

    const clean = raw
      .replace(/```json|```/g, '')
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '')
      .trim();

    const parsed: GeneratedShoppingList = JSON.parse(clean);

    // Garante que as categorias são válidas, aplicando fallback local se necessário
    parsed.items = parsed.items.map((item) => ({
      ...item,
      category: ALLOWED_CATEGORIES.includes(item.category)
        ? item.category
        : localCategory(item.name),
    }));

    return parsed;
  } catch (error) {
    console.warn('Geração de lista via IA falhou, usando fallback local:', error);
    return localShoppingListFallback(context);
  }
};

export const getLucaResponse = async ({
  history,
  message,
  context,
  model = LUCA_MODELS.primary,
}: LucaResponseParams): Promise<string> => {
  // Bloqueio rápido client-side para tópicos fora do escopo
  if (isOutOfScope(message)) {
    return 'Esse assunto está fora do que posso ajudar. 😊 Sou especializado em lista de compras, gastos do mercado e finanças domésticas. Para outros temas, recomendo usar um assistente de uso geral!';
  }

  const contents: GeminiContent[] = [
    ...history.slice(-12),
    { role: 'user', parts: [{ text: message }] },
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
      return getLucaFailureFallback(classifyAiFailure(fallbackError), message, context);
    }
  }
};
