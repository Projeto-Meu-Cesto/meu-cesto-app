# Roteiro de demonstração do MVP Meu Cesto

## Preparação

1. Abra a versão web em uma janela com aproximadamente 390 px de largura.
2. Entre com uma conta Firebase de demonstração.
3. Confirme que a home identifica catálogo, pedidos e Clube Meu Cesto como fluxos demonstrativos.
4. Explique ao parceiro que os dados locais serão substituídos pela integração com ERP, PDV, API, planilha ou dashboard.

## Compra aprovada para retirada

1. Na home, abra **Comprar online**.
2. Pesquise um produto, adicione dois itens e abra o carrinho.
3. Altere uma quantidade e avance para o checkout.
4. Selecione **Retirar no mercado**, escolha um horário e mantenha **Simular aprovação**.
5. Processe o pedido e mostre o detalhe, a linha do tempo e os pontos pendentes no Clube Meu Cesto.
6. Avance por preparo e pronto para retirada até **Concluir pedido**.
7. Abra o Clube Meu Cesto e mostre os pontos liberados e o extrato.
8. Abra Gastos e mostre que a compra concluída entrou no período atual.

## Entrega, recusa e cancelamento

1. Monte outro carrinho e escolha **Receber em casa**.
2. Mostre a validação obrigatória do endereço.
3. Selecione **Simular recusa** e confirme que o carrinho não é cobrado nem cria pontos.
4. Crie outro pedido aprovado e, no detalhe, use **Cancelar pedido**.
5. Mostre que o modal explica a consequência e oferece primeiro a opção segura **Manter pedido**.

## Estorno

1. Em um pedido concluído, use **Simular estorno**.
2. Confirme que os pontos disponíveis são revertidos.
3. Volte às finanças e confirme que o valor não aparece mais nos totais.
4. Explique que o lançamento negativo fica em `finance_entries` para auditoria da demonstração.

## Benefícios

1. Com saldo suficiente, abra **Clube Meu Cesto**.
2. Escolha um benefício e confirme a troca.
3. Mostre a baixa no saldo e no extrato.
4. Reforce que regra, brindes, descontos e sorteios serão definidos pelo mercado parceiro.

## Luca e modo degradado

1. Pergunte ao Luca sobre os gastos do mês.
2. Mostre que a resposta usa apenas os dados salvos no app.
3. Sem AI Logic/App Check configurado, mostre que o fallback local continua funcional e informa a limitação claramente.

## Checklist final da apresentação

- Nenhuma cobrança real foi feita.
- Nenhum estoque foi apresentado como integração real.
- Pedidos, pontos e finanças acompanharam o mesmo ciclo.
- Navbar, menu central, modais e alvos de toque funcionaram em web mobile.
- Ficaram claros os próximos limites: integração do mercado, backend confiável e provedor de pagamento.
