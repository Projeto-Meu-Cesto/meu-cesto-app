# Meu Cesto — Design do MVP demonstrável

Data: 8 de agosto de 2026

Status: aprovado para planejamento

Plataforma inicial: web responsivo

Plataformas futuras: Android e iOS

## 1. Objetivo

Entregar um MVP funcional do Meu Cesto para apresentação a donos de mercados e testes com usuários. O produto deve demonstrar, de ponta a ponta, como um cliente monta uma compra, escolhe retirada ou entrega, passa por um pagamento simulado, acompanha o pedido, recebe pontos e visualiza o impacto da compra em suas finanças.

O MVP deve usar apenas serviços compatíveis com o plano gratuito Spark do Firebase. Ele não receberá dinheiro real, não terá integração com o sistema de caixa/estoque de um mercado e não terá painel administrativo nesta etapa.

## 2. Princípios

- Preservar exatamente a paleta dark atual, incluindo cores e opacidades.
- Usar dados reais do usuário para listas, pedidos, pontos e finanças.
- Identificar claramente catálogo, pagamento e operação simulados.
- Não inventar silenciosamente preço, estoque, pagamento ou estado de pedido.
- Manter os domínios separados para substituir simuladores por integrações reais sem refazer a interface.
- Priorizar web responsivo, sem impedir a futura publicação em Android e iOS.
- Não depender de serviço pago no MVP.

## 3. Escopo

### Incluído

- Consolidação do design system.
- Nova tipografia com Poppins ExtraBold e Inter.
- Correção e padronização da navbar.
- Menu de quatro ações rápidas no botão central.
- Padronização de modais e confirmações destrutivas.
- Catálogo demonstrativo com busca, filtros, preço e disponibilidade.
- Carrinho com alteração de quantidade e totais.
- Checkout demonstrativo para retirada ou entrega.
- Processamento simulado com cenários de aprovação e recusa.
- Histórico e acompanhamento de pedidos.
- Programa de pontos configurável por mercado.
- Catálogo demonstrativo de brindes e descontos.
- Integração de pedidos concluídos com as finanças do usuário.
- Luca usando dados autorizados do usuário e um caminho gratuito e protegido para IA.
- Estados de carregamento, vazio, erro e indisponibilidade.
- Regras do Firestore, App Check no web e validação automatizada.

### Fora do escopo

- Cobrança real por Stripe ou outro processador.
- Webhooks e liquidação financeira.
- Integração com ERP, PDV, banco de dados ou aplicação Java do mercado.
- Sincronização real de estoque, entrada e saída de produtos.
- Painel administrativo do mercado.
- Gestão logística ou rastreamento de entregador.
- Publicação nas lojas Android e iOS.
- Sorteios ativos. Esse recurso exige análise jurídica e, quando aplicável, autorização da Secretaria de Prêmios e Apostas.

## 4. Arquitetura

O app continuará em Expo, React Native Web, Expo Router e Firebase. A interface consumirá serviços de domínio, e os serviços dependerão de contratos substituíveis.

```text
Interface Expo / React Native Web
              |
       Serviços de domínio
              |
  +-----------+-----------+----------------+
  |                       |                |
Catálogo                Pagamento       Persistência
DemoProvider            DemoProvider     Firebase Spark
  |                       |
Integração futura       Stripe/outro no backend futuro
```

### Unidades

- `CatalogProvider`: pesquisa e entrega produtos, preços e disponibilidade. Usa dados demonstrativos no MVP.
- `PaymentProvider`: retorna estados controlados de processamento, aprovação ou recusa. Não representa uma transação financeira real.
- `OrderService`: calcula totais, cria pedidos e valida transições de estado.
- `LoyaltyService`: calcula e registra pontos, resgates e estornos em um livro-razão.
- `FinanceService`: consolida lançamentos manuais e pedidos concluídos sem duplicidade.
- `AiProvider`: usa Firebase AI Logic no web com Gemini Developer API em nível gratuito e fallback local limitado.

## 5. Sistema visual

### Cores

Nenhuma cor ou opacidade existente será alterada. Os tokens atuais continuarão como fonte única para fundo, superfícies, bordas, textos, destaque primário, erro e alerta.

### Tipografia

| Uso | Família e peso | Tamanho/linha |
| --- | --- | --- |
| Display | Poppins ExtraBold | 32/40 |
| Título de tela | Poppins ExtraBold | 24/32 |
| Subtítulo grande | Inter SemiBold | 18/24 |
| Subtítulo | Inter SemiBold | 16/24 |
| Corpo | Inter Regular | 16/24 |
| Texto secundário | Inter Regular | 14/20 |
| Legenda/navbar | Inter SemiBold | 12/16 |
| Botão pequeno | Inter SemiBold | 14/20 |
| Botão padrão | Inter SemiBold | 16/24 |

Poppins ExtraBold será restrita a displays e títulos principais. Toda leitura, controle e navegação usará Inter.

### Espaçamento e raios

- Escala de espaçamento: `4, 8, 12, 16, 24, 32, 48, 64`.
- Escala de raios: `8, 12, 16, 24, 32` e circular.
- Em elementos aninhados, o raio externo será igual ao raio interno mais o padding entre as superfícies.
- Exceções precisam ser justificadas pelo formato circular ou por restrição nativa.

## 6. Navbar e ações rápidas

A navbar terá exatamente cinco posições visíveis, nesta ordem:

1. Início.
2. Gastos.
3. Botão central `+`.
4. Lista.
5. Perfil.

Especificação:

- Altura visual de 72 px.
- Ícones de 24 px.
- Rótulos de 12/16.
- Área de toque mínima de 44 × 44 px.
- Botão central de 52 px, com área interativa maior e sem estado de aba selecionada.
- Barra centralizada e com largura máxima apropriada à experiência mobile quando aberta em telas web largas.
- Posicionamento compatível com safe area e sem cobrir o conteúdo.
- Rotas auxiliares, inclusive `luca`, `luca-tab` e `plus`, não podem gerar abas extras.

O `+` abre um painel de ações rápidas com:

- Adicionar produto.
- Registrar gasto.
- Nova lista.
- Perguntar ao Luca.

## 7. Modais

Um componente compartilhado atenderá confirmações, alertas e conteúdo, com variantes visualmente consistentes.

- A consequência deve ser descrita em linguagem direta.
- Ações terão rótulos específicos, como `Sair da conta`, `Excluir conversa` e `Manter conversa`.
- A ação segura aparece primeiro; a destrutiva usa a cor de erro.
- Loading desabilita ações duplicadas.
- O modal poderá fechar por botão, backdrop e tecla Escape quando isso não descartar uma operação irreversível em andamento.
- Foco inicial, retorno de foco e rótulos de acessibilidade serão definidos no web.
- Confirmações nativas remanescentes de exclusão ou saída serão migradas para o componente compartilhado.

## 8. Fluxo de compra

1. O usuário autenticado abre o catálogo demonstrativo.
2. Pesquisa ou filtra produtos e consulta preço, categoria e disponibilidade.
3. Adiciona produtos ao carrinho e altera quantidades.
4. Escolhe retirada ou entrega.
5. Para entrega, informa endereço; para retirada, escolhe uma faixa de horário demonstrativa.
6. Confere subtotal, taxas demonstrativas, descontos e total.
7. Seleciona um meio de pagamento demonstrativo.
8. O simulador processa o pedido e produz aprovação ou recusa conforme o cenário selecionado para a demonstração.
9. Um pedido aprovado entra no histórico como `confirmado`.
10. O usuário acompanha a linha do tempo até `concluído`.

Estados válidos:

```text
rascunho -> aguardando_pagamento -> confirmado -> em_preparo
         -> recusado                         -> pronto_retirada -> concluido
                                             -> em_entrega -> concluido

aguardando_pagamento | confirmado -> cancelado
concluido -> estornado (somente cenário demonstrativo explícito)
```

Transições que não aparecem no diagrama são inválidas. O histórico registra data, origem e evento responsável por cada mudança.

## 9. Pontos e recompensas

As regras pertencem ao mercado e não são globais. No MVP, o mercado demonstrativo terá configuração inicial editada no conjunto de dados, sem painel administrativo.

- Pagamento aprovado cria pontos pendentes.
- Conclusão do pedido libera os pontos.
- Cancelamento antes da liberação remove os pontos pendentes.
- Estorno após a liberação cria um lançamento negativo; lançamentos anteriores não são editados.
- Resgates também são lançamentos no livro-razão.
- O saldo é a soma dos lançamentos válidos, nunca um número atualizado isoladamente.
- O usuário visualiza saldo disponível, pontos pendentes e extrato.
- Recompensas demonstrativas podem ser brindes ou descontos.
- Sorteios não serão exibidos como recurso disponível no MVP.

## 10. Finanças

- Pedido concluído cria um lançamento financeiro único.
- Pedido cancelado, recusado ou ainda em andamento não entra no total gasto.
- Estorno cria o ajuste correspondente sem apagar o histórico.
- Compras externas continuam podendo ser registradas manualmente.
- Cada lançamento informa a origem `pedido` ou `manual` e uma chave de idempotência.
- Visões diária, mensal e anual usam os mesmos lançamentos persistidos.
- Categorias, evolução e itens principais são derivados desses dados.

## 11. Luca e IA gratuita

- A chave atual do Gemini não será enviada diretamente em chamadas HTTP pelo build público.
- No web, o app usará Firebase AI Logic com Gemini Developer API no nível gratuito do plano Spark.
- App Check será aplicado antes da disponibilização pública.
- O modelo padrão será `gemini-3.5-flash-lite`, versão estável compatível com o nível gratuito em 8 de agosto de 2026. A disponibilidade será verificada novamente antes da publicação.
- Limites de uso e falhas resultarão em fallback local explícito, sem bloquear compras, listas ou finanças.
- Luca receberá apenas o contexto financeiro e de compras necessário para a solicitação.
- Luca não poderá inventar preço, estoque, pedido, saldo ou pagamento.

## 12. Modelo de dados

Estrutura lógica inicial:

```text
markets/{marketId}
markets/{marketId}/catalog/{productId}
markets/{marketId}/rewards/{rewardId}
markets/{marketId}/config/loyalty

users/{uid}
users/{uid}/shopping_list/{itemId}
users/{uid}/orders/{orderId}
users/{uid}/orders/{orderId}/events/{eventId}
users/{uid}/loyalty_ledger/{entryId}
users/{uid}/finance_entries/{entryId}
users/{uid}/luca_chats/{chatId}
```

Cada item de pedido armazena um snapshot de nome, preço, categoria e quantidade para que alterações posteriores no catálogo não modifiquem o histórico.

## 13. Segurança no plano Spark

- Firebase Authentication identifica o usuário.
- Regras do Firestore limitam dados privados ao proprietário.
- Escritas validam campos permitidos, tipos, limites e identificadores.
- App Check com provedor web de produção protege Firestore, Storage e Firebase AI Logic antes da publicação.
- Tokens de depuração do App Check não entram no repositório ou no build público.
- O catálogo demonstrativo tem política de leitura explícita.
- Segredos de processadores e mercados não existem no cliente.

Limite aceito: sem backend confiável, pagamento, evolução operacional e pontos são simulações suscetíveis a manipulação pelo próprio cliente. Essa limitação é aceitável apenas para apresentação e testes. Antes de receber dinheiro real, essas operações deverão migrar para backend seguro com confirmação por webhook.

## 14. Falhas e estados da interface

- Toda consulta apresenta loading, vazio, sucesso ou erro.
- A interface só confirma persistência após o Firestore concluir a operação.
- Repetir uma operação usa a mesma chave de idempotência quando aplicável.
- Falha da IA não afeta os demais domínios.
- Produto sem imagem recebe placeholder visual; seus demais dados não são fabricados.
- Falta de configuração mostra orientação objetiva em vez de travar.
- Modo demonstração fica visível no catálogo e no checkout.

## 15. Critérios de aceite

O MVP será considerado pronto para apresentação quando:

- uma conta nova concluir cadastro e onboarding;
- o usuário pesquisar o catálogo, montar um carrinho e escolher retirada ou entrega;
- o checkout simulado cobrir aprovação e recusa;
- o pedido aprovado percorrer estados válidos e chegar à conclusão;
- pontos passarem de pendentes a disponíveis somente na conclusão;
- cancelamento e estorno produzirem os ajustes corretos;
- a compra concluída aparecer uma única vez nas finanças diária, mensal e anual;
- recompensas e extrato de pontos forem consultáveis;
- Luca usar contexto autorizado e apresentar fallback transparente;
- navbar, fontes, raios e modais seguirem o design system aprovado;
- nenhuma rota auxiliar aparecer como aba;
- nenhuma chave privada estiver presente no bundle web;
- regras do Firestore bloquearem acesso cruzado entre usuários;
- o app funcionar em larguras mobile e desktop, por toque e teclado;
- lint, TypeScript, testes automatizados e exportação web concluírem sem erro;
- um teste manual completo passar com conta nova e conta com histórico.

## 16. Estratégia de testes

- Testes unitários para cálculos, totais, máquina de estados, pontos e idempotência.
- Testes no Firebase Emulator Suite para regras do Firestore.
- Testes integrados dos fluxos aprovado, recusado, cancelado e estornado.
- Testes de integração entre pedido concluído, livro-razão e finanças.
- Testes de componentes compartilhados de navbar, botão e modal.
- Auditoria responsiva, de foco, rótulos acessíveis e contraste.
- Verificações finais com lint, TypeScript e exportação web.

## 17. Sequência de entrega

Para manter cada mudança verificável, a implementação seguirá quatro marcos no mesmo plano:

1. Fundação visual: fontes, tokens, componentes compartilhados, navbar e modais.
2. Domínio de comércio: catálogo demonstrativo, carrinho, checkout e pedidos.
3. Domínios derivados: pontos, recompensas, finanças e contexto do Luca.
4. Proteção e lançamento web: regras, App Check, testes integrados, acessibilidade e exportação.

Cada marco precisa manter os fluxos existentes funcionando e passar por suas verificações antes do próximo.

## 18. Evolução posterior

Após fechar parceria com um mercado:

1. Mapear o sistema existente e obter acesso autorizado a API ou exportação.
2. Implementar um novo `CatalogProvider` para catálogo e estoque reais.
3. Criar backend confiável para pedidos, pontos e webhooks.
4. Integrar Stripe ou outro processador escolhido pelo mercado.
5. Criar painel web do mercado caso o sistema existente não ofereça gestão adequada.
6. Validar operação, privacidade, contabilidade, logística e suporte antes do lançamento comercial.
