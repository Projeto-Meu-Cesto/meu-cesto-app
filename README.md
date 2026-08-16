# Meu Cesto

MVP web demonstrável para mercados: catálogo, carrinho, retirada ou entrega, pagamento simulado, acompanhamento do pedido, finanças, pontos e assistente Luca em um único fluxo.

O projeto está preparado para apresentar o produto antes da integração com o sistema real do mercado. Produtos, preços, estoque, pagamento, benefícios e progressão operacional são identificados como demonstração. Nenhuma cobrança real é feita.

## O que já funciona

- Cadastro e login com Firebase Authentication.
- Catálogo demonstrativo pesquisável, estoque e carrinho persistente por usuário.
- Checkout de retirada ou entrega com cenários aprovado e recusado.
- Histórico, detalhe e linha do tempo do pedido.
- Progressão demonstrativa: confirmado, preparo, retirada/entrega, concluído e estornado.
- Clube Meu Cesto com pontos pendentes, liberação na conclusão, reversão e troca de benefícios.
- Compras concluídas refletidas nas finanças; estornos removem o valor e deixam lançamento de reversão.
- Luca com Firebase AI Logic e fallback local transparente.
- Navbar web responsiva com menu central de ações.
- Inter para textos e Poppins ExtraBold para títulos de destaque, sem alteração da paleta original.

## Limites intencionais do MVP

- O pagamento é um simulador determinístico; Stripe ou outro provedor entra somente após definição com o parceiro.
- O catálogo atual é local e demonstrativo. A integração futura pode consumir ERP, PDV, API, arquivo ou dashboard do mercado.
- Pontos e finanças são calculados no cliente para a apresentação. Antes de produção pública, confirmação de pagamento, estoque, pontos e transições devem ser validados em um backend confiável.
- O projeto permanece no Firebase Spark. Não há Cloud Functions nem serviço pago obrigatório.
- Android e iOS são destinos futuros; a entrega atual é web.

## Configuração

Requisitos: Node.js compatível com Expo 54 e uma aplicação Web cadastrada no Firebase.

```powershell
npm install
Copy-Item .env.example .env
```

Preencha no `.env` apenas os identificadores públicos da aplicação Firebase. Para o Luca online:

1. No console Firebase, abra Firebase AI Logic e selecione Gemini Developer API no nível gratuito.
2. Cadastre a aplicação Web no App Check com reCAPTCHA Enterprise.
3. Informe `EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`.
4. Em desenvolvimento, defina `EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG=true`, copie o token exibido pelo SDK e registre-o no console. Nunca use o modo debug em produção.

Sem App Check/AI configurado, todo o restante continua utilizável e o Luca responde com o fallback local sem inventar números.

## Executar na web

```powershell
npm run web
```

Para gerar a versão estática:

```powershell
npx expo export --platform web
```

O resultado fica em `dist/`.

## Firebase e regras

As regras mantêm dados em `users/{uid}` isolados por proprietário, validam pedidos, pontos e lançamentos financeiros, exigem autenticação para ler o cache de produtos e negam escrita de catálogo pelo cliente.

```powershell
npm run firebase:login
npm run firebase:deploy
```

O teste automatizado das regras usa o Firestore Emulator e exige Java instalado:

```powershell
npm run test:rules
```

## Qualidade

```powershell
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

O roteiro completo de apresentação está em [docs/testing/mvp-demo-script.md](docs/testing/mvp-demo-script.md).

## Autores

- Guilherme Sant'Ana
- Antonio Gomes
