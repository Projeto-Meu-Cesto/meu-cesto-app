import type { CatalogProduct } from './catalog';

export type CartItem = {
  product: CatalogProduct;
  quantity: number;
};

export type CartState = {
  marketId: string;
  items: CartItem[];
};

export type CartAction =
  | { type: 'add'; product: CatalogProduct; quantity?: number }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; state: CartState };

export function createCartState(marketId: string): CartState {
  return { marketId, items: [] };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (!action.product.available || action.product.stockQuantity <= 0) return state;
      const requested = Math.max(1, Math.floor(action.quantity ?? 1));
      const existing = state.items.find((item) => item.product.id === action.product.id);
      const quantity = Math.min(
        action.product.stockQuantity,
        (existing?.quantity ?? 0) + requested,
      );
      const nextItem = { product: action.product, quantity };

      return {
        ...state,
        marketId: action.product.marketId,
        items: existing
          ? state.items.map((item) => item.product.id === action.product.id ? nextItem : item)
          : [...state.items, nextItem],
      };
    }
    case 'setQuantity': {
      const existing = state.items.find((item) => item.product.id === action.productId);
      if (!existing) return state;
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((item) => item.product.id !== action.productId) };
      }
      const quantity = Math.min(existing.product.stockQuantity, Math.floor(action.quantity));
      return {
        ...state,
        items: state.items.map((item) => item.product.id === action.productId
          ? { ...item, quantity }
          : item),
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((item) => item.product.id !== action.productId) };
    case 'clear':
      return { ...state, items: [] };
    case 'hydrate':
      return action.state.marketId === state.marketId ? action.state : state;
  }
}

export function getCartTotals(state: CartState): { itemCount: number; subtotal: number } {
  return state.items.reduce(
    (totals, item) => ({
      itemCount: totals.itemCount + item.quantity,
      subtotal: totals.subtotal + item.product.price * item.quantity,
    }),
    { itemCount: 0, subtotal: 0 },
  );
}
