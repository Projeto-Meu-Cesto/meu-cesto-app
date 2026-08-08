# Meu Cesto MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um MVP web responsivo, funcional e demonstrável do Meu Cesto com design system consolidado, catálogo, carrinho, checkout simulado, pedidos, pontos, recompensas, finanças e Luca no Firebase Spark.

**Architecture:** A interface Expo Router consome serviços de domínio puros e repositórios Firebase. Catálogo e pagamento são providers substituíveis; o MVP usa implementações demonstrativas. Pedidos, pontos e finanças persistem dados do usuário no Firestore, enquanto regras de segurança e App Check protegem a versão web dentro dos limites do plano gratuito.

**Tech Stack:** Expo 54, React Native 0.81, React 19, TypeScript 5.9, Expo Router 6, Firebase 12, Firestore, Firebase AI Logic, React Native Reanimated, Jest com jest-expo.

## Global Constraints

- Manter exatamente a paleta e as opacidades atuais.
- Usar Poppins ExtraBold somente em display e títulos principais; usar Inter no restante da interface.
- Usar espaçamento `4, 8, 12, 16, 24, 32, 48, 64` e raios `8, 12, 16, 24, 32`.
- Permanecer no Firebase Spark; não adicionar Cloud Functions nem dependência paga.
- Identificar catálogo, checkout e pagamento como demonstração.
- Não expor chaves privadas ou tokens de fornecedores no bundle web.
- Não ativar sorteios, pagamento real, painel administrativo ou integração de estoque.
- Preservar alterações locais existentes; não sobrescrever nem incluir trabalho preexistente em commits sem separação segura.
- Priorizar web responsivo e manter compatibilidade futura com Android e iOS.

---

## File Structure

### Foundation

- `constants/theme.ts`: tokens únicos de cor, espaço, raio e tipografia.
- `components/ui/Typography.tsx`: mapeamento Poppins/Inter por variante.
- `components/ui/AppModal.tsx`: modal acessível compartilhado.
- `components/ui/BottomNav.tsx`: navbar responsiva e painel de ações rápidas.
- `app/_layout.tsx`: carregamento de fontes, providers e rotas protegidas.
- `app/(tabs)/_layout.tsx`: configuração de abas sem rotas auxiliares visíveis.

### Commerce domain

- `domain/catalog.ts`: tipos e contrato `CatalogProvider`.
- `domain/orders.ts`: tipos, totais e máquina de estados.
- `domain/loyalty.ts`: cálculo e livro-razão de pontos.
- `domain/finance.ts`: conversão idempotente de pedido em lançamento.
- `data/demoCatalog.ts`: mercado, catálogo, regras e recompensas demonstrativos.
- `services/demoCatalogProvider.ts`: busca e filtros sobre o catálogo demo.
- `services/demoPaymentProvider.ts`: processamento determinístico aprovado/recusado.
- `services/orderService.ts`: orquestra criação e transições válidas de pedidos.
- `services/userCommerceRepository.ts`: persistência Firestore do usuário.
- `context/CartContext.tsx`: estado transitório do carrinho.

### Screens

- `app/catalog.tsx`: catálogo e filtros.
- `app/cart.tsx`: itens, quantidades e resumo.
- `app/checkout.tsx`: retirada/entrega e pagamento demonstrativo.
- `app/orders.tsx`: histórico de pedidos.
- `app/order/[id].tsx`: linha do tempo e avanço demonstrativo.
- `app/rewards.tsx`: saldo, extrato e recompensas.
- `app/(tabs)/home.tsx`: entradas para catálogo, pedidos e fidelidade.
- `app/(tabs)/stats.tsx`: consolidação de pedidos e registros manuais.
- `app/luca.tsx`: contexto real e Firebase AI Logic com fallback.

### Security and tests

- `firestore.rules`: validação de propriedade e estruturas permitidas.
- `firestore.indexes.json`: índices exigidos pelas consultas.
- `scripts/firebaseConfig.ts`: App Check web e Firebase AI.
- `__tests__/domain/*.test.ts`: regras puras de domínio.
- `__tests__/services/*.test.ts`: providers demonstrativos.
- `__tests__/firestore/firestore.rules.test.ts`: isolamento entre usuários.

---

### Task 1: Test Harness and Commerce Domain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `jest.config.js`
- Create: `domain/catalog.ts`
- Create: `domain/orders.ts`
- Create: `domain/loyalty.ts`
- Create: `domain/finance.ts`
- Test: `__tests__/domain/orders.test.ts`
- Test: `__tests__/domain/loyalty.test.ts`
- Test: `__tests__/domain/finance.test.ts`

**Interfaces:**
- Produces: `CatalogProduct`, `CatalogProvider`, `Order`, `OrderStatus`, `calculateOrderTotals`, `canTransitionOrder`, `calculateEarnedPoints`, `sumLoyaltyBalance`, `financeEntryFromOrder`.

- [ ] **Step 1: Add the test runner**

Add `"test": "jest --runInBand"` and `"test:watch": "jest --watch"` to scripts. Install compatible dev dependencies with:

```powershell
npm install --save-dev jest-expo@~54.0.17 @types/jest@^29.5.14
```

Create `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|firebase)/)',
  ],
};
```

- [ ] **Step 2: Write failing order tests**

```ts
import { calculateOrderTotals, canTransitionOrder } from '../../domain/orders';

test('calculates item snapshot totals and delivery fee', () => {
  expect(calculateOrderTotals([{ unitPrice: 7.5, quantity: 2 }], 5, 3)).toEqual({
    subtotal: 15,
    deliveryFee: 5,
    discount: 3,
    total: 17,
  });
});

test('rejects invalid status jumps', () => {
  expect(canTransitionOrder('confirmado', 'em_preparo')).toBe(true);
  expect(canTransitionOrder('confirmado', 'concluido')).toBe(false);
});
```

- [ ] **Step 3: Run the order test and confirm red**

Run: `npm test -- __tests__/domain/orders.test.ts`

Expected: FAIL because `domain/orders.ts` does not exist.

- [ ] **Step 4: Implement catalog and order types**

```ts
export type OrderStatus =
  | 'rascunho' | 'aguardando_pagamento' | 'recusado' | 'confirmado'
  | 'em_preparo' | 'pronto_retirada' | 'em_entrega' | 'concluido'
  | 'cancelado' | 'estornado';

export function calculateOrderTotals(
  items: Pick<OrderItem, 'unitPrice' | 'quantity'>[],
  deliveryFee = 0,
  discount = 0,
): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return { subtotal, deliveryFee, discount, total: Math.max(0, subtotal + deliveryFee - discount) };
}
```

Define `ORDER_TRANSITIONS` as an explicit record and make `canTransitionOrder` check membership.

- [ ] **Step 5: Write and run loyalty red tests**

```ts
test('keeps points pending until completion', () => {
  expect(calculateEarnedPoints(103.8, { pointsPerReal: 1 })).toBe(103);
  expect(sumLoyaltyBalance([
    { id: '1', kind: 'earn', status: 'pending', points: 103 },
    { id: '2', kind: 'earn', status: 'available', points: 20 },
  ])).toEqual({ pending: 103, available: 20 });
});
```

Run: `npm test -- __tests__/domain/loyalty.test.ts`

Expected: FAIL because loyalty functions do not exist.

- [ ] **Step 6: Implement loyalty ledger calculations**

Use integer points, `Math.floor(total * pointsPerReal)`, immutable entries and a reducer that separates pending and available points. Negative reversal and redemption entries reduce available balance.

- [ ] **Step 7: Write and implement finance idempotency test**

```ts
test('uses the order id as a stable finance source key', () => {
  const entry = financeEntryFromOrder(orderFixture);
  expect(entry.source).toBe('order');
  expect(entry.sourceKey).toBe('order:order-1');
  expect(entry.amount).toBe(orderFixture.totals.total);
});
```

Run once before and once after implementing `financeEntryFromOrder`; expect RED then PASS.

- [ ] **Step 8: Run the complete domain suite**

Run: `npm test -- __tests__/domain`

Expected: all domain tests PASS.

- [ ] **Step 9: Commit only safely separable task files**

```powershell
git add jest.config.js domain __tests__/domain package.json package-lock.json
git commit -m "feat: add commerce domain model"
```

If `package.json` or `package-lock.json` contains preexisting unstaged work that cannot be separated safely, leave those files uncommitted and report them in the task checkpoint.

---

### Task 2: Design System, Modals, and Navbar

**Files:**
- Modify: `constants/theme.ts`
- Modify: `components/ui/Typography.tsx`
- Modify: `components/ui/AppModal.tsx`
- Create: `components/ui/BottomNav.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `components/ui/Sidebar.tsx`
- Modify: `app/luca.tsx`
- Test: `__tests__/domain/theme.test.ts`

**Interfaces:**
- Consumes: existing `Colors` unchanged.
- Produces: `FontFamily`, `FontSize`, `LineHeight`, `Spacing`, `Radius`, `AppModal`, `BottomNav`.

- [ ] **Step 1: Write token invariants**

```ts
test('keeps approved spacing and radius scales', () => {
  expect(Object.values(Spacing)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
  expect([Radius.sm, Radius.md, Radius.lg, Radius.xl, Radius.xxl]).toEqual([8, 12, 16, 24, 32]);
});
```

Run: `npm test -- __tests__/domain/theme.test.ts`

Expected: FAIL against the current token values.

- [ ] **Step 2: Load and map fonts**

Install `@expo-google-fonts/poppins`, load `Poppins_800ExtraBold` in `app/_layout.tsx`, remove Montserrat loading, and map only `display` and `heading` to Poppins. Map every other variant and weight to Inter.

- [ ] **Step 3: Normalize theme tokens without changing colors**

Replace the spacing and radius values with the approved scales. Add explicit line heights and font-family names. Run the theme test and expect PASS.

- [ ] **Step 4: Make AppModal semantic**

Add `destructive?: boolean`, `dismissible?: boolean`, `testID?: string`, safe-first button order, destructive red confirm styling, loading protection and web accessibility props. Keep `onRequestClose` inactive while loading.

- [ ] **Step 5: Replace destructive native alerts**

Use `AppModal` for logout in both profile and sidebar and conversation deletion in Luca. Copy must explicitly name the action and consequence.

- [ ] **Step 6: Build BottomNav**

Render exactly `Início`, `Gastos`, central `+`, `Lista`, `Perfil`; cap web width; respect safe-area inset; use 24 px icons and 12 px labels. The central button calls `onOpenActions` and never navigates.

- [ ] **Step 7: Wire the four-action sheet**

The action sheet routes to `/addItem`, `/(tabs)/stats`, `/(tabs)/lists`, and `/luca`. Hide `plus`, `luca`, `luca-tab`, and `explore` from generated tabs.

- [ ] **Step 8: Verify foundation**

Run:

```powershell
npm test -- __tests__/domain/theme.test.ts
npx tsc --noEmit
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit task-owned changes where separable**

```powershell
git add constants/theme.ts components/ui/Typography.tsx components/ui/AppModal.tsx components/ui/BottomNav.tsx app/_layout.tsx "app/(tabs)/_layout.tsx"
git commit -m "feat: consolidate navigation design system"
```

Do not stage unrelated preexisting hunks.

---

### Task 3: Demo Catalog and Cart

**Files:**
- Create: `data/demoCatalog.ts`
- Create: `services/demoCatalogProvider.ts`
- Create: `context/CartContext.tsx`
- Create: `app/catalog.tsx`
- Create: `app/cart.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/home.tsx`
- Test: `__tests__/services/demoCatalogProvider.test.ts`
- Test: `__tests__/domain/cart.test.ts`

**Interfaces:**
- Consumes: `CatalogProduct`, `CatalogProvider`, `calculateOrderTotals`.
- Produces: `demoMarket`, `demoCatalogProvider`, `CartProvider`, `useCart()`.

- [ ] **Step 1: Write catalog search red test**

```ts
test('searches normalized product names and filters stock', async () => {
  const result = await demoCatalogProvider.search({ query: 'feijao', onlyAvailable: true });
  expect(result.every((item) => item.available)).toBe(true);
  expect(result[0].name).toMatch(/Feijão/i);
});
```

- [ ] **Step 2: Implement a coherent demo dataset**

Create 24–32 Brazilian grocery products with stable IDs, barcode where known, name, brand, category, unit, price, image URL or null, stock quantity, availability and `updatedAt`. Add a visible `isDemo: true` market flag.

- [ ] **Step 3: Implement the provider and pass tests**

Normalize accents, filter category and availability, and sort by relevance then name. Run `npm test -- __tests__/services/demoCatalogProvider.test.ts` and expect PASS.

- [ ] **Step 4: Write cart behavior tests**

Cover add, merge quantity, cap at stock, remove, clear and totals. Implement reducer actions with immutable state until tests pass.

- [ ] **Step 5: Add CartProvider at the root**

Persist cart to AsyncStorage by `uid` and `marketId`; clear only after an approved order is persisted.

- [ ] **Step 6: Build catalog screen**

Add demo badge, search, category chips, availability, product cards, empty/error states, cart count and navigation to `/cart`.

- [ ] **Step 7: Build cart screen**

Show snapshots, quantity controls, removal confirmation, subtotal and checkout CTA. Disable checkout for empty cart or unavailable quantities.

- [ ] **Step 8: Verify catalog milestone**

Run tests, typecheck, lint and `npx expo export --platform web`.

- [ ] **Step 9: Commit new, isolated files**

```powershell
git add data/demoCatalog.ts services/demoCatalogProvider.ts context/CartContext.tsx app/catalog.tsx app/cart.tsx __tests__/services __tests__/domain/cart.test.ts
git commit -m "feat: add demo catalog and cart"
```

---

### Task 4: Simulated Checkout and Order Timeline

**Files:**
- Create: `services/demoPaymentProvider.ts`
- Create: `services/orderService.ts`
- Create: `services/userCommerceRepository.ts`
- Create: `app/checkout.tsx`
- Create: `app/orders.tsx`
- Create: `app/order/[id].tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/home.tsx`
- Test: `__tests__/services/demoPaymentProvider.test.ts`
- Test: `__tests__/domain/orderTransitions.test.ts`

**Interfaces:**
- Produces: `PaymentProvider.process(input)`, `OrderService.create(input)`, `OrderService.transition(orderId, nextStatus)`, `subscribeOrders`, `subscribeOrder`.

- [ ] **Step 1: Write deterministic payment tests**

```ts
test.each([
  ['approved', 'approved'],
  ['declined', 'declined'],
])('maps demo scenario %s to %s', async (scenario, expected) => {
  await expect(demoPaymentProvider.process({ scenario, amount: 10, idempotencyKey: 'k1' }))
    .resolves.toMatchObject({ status: expected });
});
```

- [ ] **Step 2: Implement the payment simulator**

Return deterministic results after a short delay. Include `provider: 'demo'`, transaction ID, timestamp and a visible demo message. Never read Stripe keys.

- [ ] **Step 3: Implement Firestore order repository**

Persist orders under `users/{uid}/orders/{orderId}` with item snapshots and events under the order. Use stable idempotency keys and Firestore transactions for create/transition operations.

- [ ] **Step 4: Implement OrderService**

`OrderService.create(input)` calculates snapshots and totals before calling the repository. `OrderService.transition(orderId, nextStatus)` loads the current status, rejects transitions not present in `ORDER_TRANSITIONS`, persists the event and returns the updated order.

- [ ] **Step 5: Build checkout**

Collect fulfillment mode, address or pickup slot, demo payment method and scenario. Validate required fields and show an explicit “Pagamento demonstrativo” notice before confirmation.

- [ ] **Step 6: Persist approved and declined outcomes**

Approved checkout creates `confirmado`; declined checkout creates `recusado`; both appear in history. Only approved checkout clears the cart.

- [ ] **Step 7: Build history and detail screens**

List orders newest first with status badges. Detail shows items, totals, fulfillment, events and only valid next demo actions from `ORDER_TRANSITIONS`.

- [ ] **Step 8: Verify all transition branches**

Test approved pickup, approved delivery, declined, cancelled and refunded paths. Run domain and provider suites, typecheck, lint and web export.

- [ ] **Step 9: Commit isolated commerce flow**

```powershell
git add services/demoPaymentProvider.ts services/orderService.ts services/userCommerceRepository.ts app/checkout.tsx app/orders.tsx app/order __tests__/services/demoPaymentProvider.test.ts __tests__/domain/orderTransitions.test.ts
git commit -m "feat: add simulated checkout and orders"
```

---

### Task 5: Loyalty Ledger and Rewards

**Files:**
- Modify: `services/userCommerceRepository.ts`
- Create: `services/loyaltyService.ts`
- Create: `app/rewards.tsx`
- Modify: `app/order/[id].tsx`
- Modify: `app/(tabs)/home.tsx`
- Test: `__tests__/services/loyaltyService.test.ts`

**Interfaces:**
- Consumes: order events and `calculateEarnedPoints`.
- Produces: `ensurePendingPoints`, `releaseOrderPoints`, `reverseOrderPoints`, `redeemReward`, `subscribeLoyaltyLedger`.

- [ ] **Step 1: Write idempotent ledger tests**

Test that repeated calls for the same `orderId` and event kind produce one logical entry; completion releases pending points; refund creates a negative available entry.

- [ ] **Step 2: Implement loyalty transactions**

Use entry IDs derived from `{orderId}:{kind}`. Never update historical entries; status changes are represented by explicit release/reversal entries with `sourceKey`.

- [ ] **Step 3: Connect order transitions**

Approved creates pending points, completion releases them, cancellation removes pending points, and refund reverses available points.

- [ ] **Step 4: Build rewards screen**

Show available, pending, ledger and demo rewards. A redemption checks balance and writes a negative entry plus a redemption record atomically.

- [ ] **Step 5: Verify and commit**

Run loyalty, order and repository tests plus typecheck/lint. Commit only task-owned changes with message `feat: add loyalty points and rewards`.

---

### Task 6: Finance Integration

**Files:**
- Modify: `scripts/financeContext.ts`
- Create: `services/financeService.ts`
- Modify: `services/userCommerceRepository.ts`
- Modify: `app/(tabs)/stats.tsx`
- Modify: `app/(tabs)/home.tsx`
- Test: `__tests__/services/financeService.test.ts`

**Interfaces:**
- Consumes: completed/refunded orders and `financeEntryFromOrder`.
- Produces: `ensureOrderFinanceEntry`, `ensureRefundFinanceEntry`, `subscribeFinanceEntries`.

- [ ] **Step 1: Write finance deduplication tests**

Cover one entry per completed order, no entry for in-progress/declined/cancelled orders, and one negative adjustment for refund.

- [ ] **Step 2: Implement finance repository functions**

Use stable document IDs `order_{orderId}` and `refund_{orderId}`. Store occurred date, amount, categories, items and source.

- [ ] **Step 3: Update aggregations**

Merge `finance_entries` with legacy `shopping_list` and `purchases` without counting the same order twice. Base daily, monthly and yearly views on normalized entries.

- [ ] **Step 4: Update stats and home summaries**

Expose period totals, categories, history and origin badges. Keep manual registration available.

- [ ] **Step 5: Verify and commit**

Run finance/domain tests, typecheck, lint and web export. Commit separable changes with `feat: connect orders to personal finances`.

---

### Task 7: Firebase AI Logic, App Check, and Firestore Rules

**Files:**
- Modify: `scripts/firebaseConfig.ts`
- Modify: `scripts/aiService.ts`
- Modify: `app/luca.tsx`
- Modify: `app.config.js`
- Modify: `.env`
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `__tests__/firestore/firestore.rules.test.ts`
- Test: `__tests__/domain/aiFallback.test.ts`

**Interfaces:**
- Produces: protected Firebase initialization, Firebase AI Logic provider using `gemini-3.5-flash-lite`, and enforced owner-only data rules.

- [ ] **Step 1: Remove private AI keys from public configuration**

Delete Gemini, OpenRouter and Cosmos secrets from Expo `extra`. Do not print or commit `.env` values. Keep only Firebase public configuration and the App Check site key as public identifiers.

- [ ] **Step 2: Initialize App Check on web**

Use `ReCaptchaEnterpriseProvider` in production web and the documented debug provider only in development. Enable automatic token refresh. If the site key is absent, show a configuration error and keep non-AI flows usable.

- [ ] **Step 3: Replace direct Gemini fetch**

Use Firebase AI Logic with `gemini-3.5-flash-lite`, authenticated users only, bounded history and existing system instructions. Preserve local classification and finance fallback.

- [ ] **Step 4: Write AI fallback tests**

Test missing configuration, quota error and network error. Each must return a transparent local response without fabricated values.

- [ ] **Step 5: Strengthen Firestore rules**

Validate owner paths, allowed order states, immutable item snapshots, loyalty entry shape, finance source keys, maximum array sizes and numeric bounds. Catalog reads require authentication; client catalog writes are denied.

- [ ] **Step 6: Test cross-user denial in emulator**

Create users A and B; assert A can read/write own allowed documents and cannot read/write B. Assert unauthenticated catalog access and client catalog writes are denied.

- [ ] **Step 7: Verify security milestone**

Run rule tests in Emulator Suite, all Jest tests, typecheck, lint and web export. Inspect the exported JavaScript with `rg` for known private environment variable names and secret prefixes.

- [ ] **Step 8: Commit only non-secret files**

Never stage `.env`. Commit implementation and rules with `feat: secure Firebase demo services`.

---

### Task 8: End-to-End Polish and Release Validation

**Files:**
- Modify: `README.md`
- Modify: `app.json`
- Modify: affected screens discovered by validation
- Create: `docs/testing/mvp-demo-script.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: reproducible setup, demo script and verified web export.

- [ ] **Step 1: Remove template routes and dead UI**

Remove or hide unused Expo example screens and ensure every visible action navigates to a working destination.

- [ ] **Step 2: Audit responsive layout**

Check 320, 375, 430, 768, 1024 and 1440 px widths. Verify navbar, modals, forms, catalog grids, order detail and Luca do not overflow or hide content.

- [ ] **Step 3: Audit accessibility**

Verify keyboard navigation, visible focus, Escape behavior, modal focus return, button labels, contrast, disabled/loading states and 44 px targets.

- [ ] **Step 4: Run the complete automated gate**

```powershell
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Expected: every command exits 0 with zero failing tests.

- [ ] **Step 5: Run the manual demo script**

Test a new account and an account with history through approved pickup, approved delivery, declined payment, cancellation, completion, points release, reward redemption, finance aggregation and Luca fallback.

- [ ] **Step 6: Inspect the final bundle**

Search the export for `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_OPENROUTER_API_KEY`, `EXPO_PUBLIC_COSMOS_TOKEN`, `sk-`, and known secret values without printing the values. Expected: no private credential in the bundle.

- [ ] **Step 7: Update documentation**

Document Spark-only setup, App Check, demo limitations, Firebase rule deployment, test commands and future backend boundary. State explicitly that payment is simulated.

- [ ] **Step 8: Final review and commit**

Review `git diff`, confirm unrelated local work remains preserved, and commit only safely attributable changes with `docs: document Meu Cesto MVP demo`.
