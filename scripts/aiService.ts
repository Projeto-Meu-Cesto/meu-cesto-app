const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || "";
const DEFAULT_MODEL = "inclusionai/ring-2.6-1t:free";

/**
 * Função genérica para chamar o OpenRouter
 */
async function callOpenRouter(messages: any[], model: string = DEFAULT_MODEL) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://meucesto.app", // Opcional, para o ranking do OpenRouter
        "X-Title": "Meu Cesto App",
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("Erro OpenRouter API:", data.error);
      throw new Error(data.error.message || "Erro na API do OpenRouter");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao chamar OpenRouter:", error);
    throw error;
  }
}

export const categorizeProduct = async (productName: string): Promise<string> => {
  try {
    const messages = [
      { 
        role: "system", 
        content: "Você é um assistente que categoriza produtos de mercado. Responda APENAS o nome da categoria." 
      },
      { 
        role: "user", 
        content: `Categorize o produto "${productName}" em uma das seguintes categorias: Frutas, Laticínios, Limpeza, Higiene, Bebidas, Padaria, Carnes ou Outros.` 
      }
    ];

    const result = await callOpenRouter(messages);
    return result.trim();
  } catch (error) {
    console.error("Erro ao categorizar:", error);
    return "Outros";
  }
};

export const filterResultsWithAI = async (results: any[], activeFilter: string): Promise<any[]> => {
  if (activeFilter === "Tudo") return results;
  
  try {
    const productList = results.map(r => r.description).join(", ");
    const messages = [
      {
        role: "system",
        content: "Você é um filtro de produtos. Responda apenas os nomes dos produtos que pertencem à categoria solicitada, separados por ponto e vírgula."
      },
      {
        role: "user",
        content: `Dada a lista de produtos: [${productList}], quais pertencem à categoria "${activeFilter}"? Se nenhum pertencer, retorne "Nenhum".`
      }
    ];

    const response = await callOpenRouter(messages);
    const matches = response.split(";").map((s: string) => s.trim().toLowerCase());
    
    if (matches.includes("nenhum")) return [];
    
    return results.filter(r => matches.some((m: string) => r.description.toLowerCase().includes(m)));
  } catch (error) {
    console.error("Erro ao filtrar:", error);
    return results;
  }
};

export const getLucaResponse = async (history: { role: "user" | "model", parts: { text: string }[] }[], message: string) => {
  const systemInstruction = `Você é Luca, assistente financeiro e especialista em compras inteligentes do app Meu Cesto.

PERSONALIDADE:
- Tom amigável, direto e encorajador, como um amigo que entende de finanças.
- Use linguagem simples, evite jargões desnecessários.
- Seja objetivo: respostas curtas quando possível, detalhadas quando necessário.
- Pode usar emojis com moderação para deixar a conversa mais leve.

ESPECIALIDADES:
1. Análise de gastos e orçamento pessoal.
2. Dicas de economia no supermercado e compras do dia a dia.
3. Comparação de preços e custo-benefício de produtos.
4. Planejamento financeiro doméstico.
5. Identificação de desperdícios e onde cortar gastos.
6. Sugestões de produtos substitutos mais baratos.

CONTEXTO DO APP:
- O usuário usa o app para gerenciar listas de compras e finanças pessoais.
- Você tem acesso ao histórico de compras e gastos do usuário quando ele compartilhar.
- Foque sempre em economia prática e resultados reais no bolso do usuário.

REGRAS:
- NUNCA faça recomendações de investimentos de risco (ações, cripto, etc.).
- Se perguntado sobre algo fora do seu escopo, redirecione gentilmente para finanças e compras.
- Sempre que der uma dica de economia, tente quantificar o impacto (ex: "isso pode economizar R$ X por mês").
- Não invente dados ou preços, diga que não tem essa informação se não souber.
- Responda sempre em português brasileiro.`;

  try {
    // Converte o histórico do formato Gemini para o formato OpenAI/OpenRouter
    const formattedMessages = [
      { role: "system", content: systemInstruction },
      ...history.map(h => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.parts[0].text
      })),
      { role: "user", content: message }
    ];

    return await callOpenRouter(formattedMessages);
  } catch (error) {
    console.error("Erro no chat do Luca:", error);
    return "Desculpe, tive um probleminha aqui. Pode repetir a pergunta?";
  }
};
