import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

import { cartReducer, createCartState, getCartTotals, type CartState } from '../domain/cart';
import type { CatalogProduct } from '../domain/catalog';
import { auth } from '../scripts/firebaseConfig';

const DEMO_MARKET_ID = 'demo-market';

type CartContextValue = {
  state: CartState;
  itemCount: number;
  subtotal: number;
  addProduct: (product: CatalogProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(): string {
  return `@meu-cesto:cart:${auth.currentUser?.uid ?? 'guest'}:${DEMO_MARKET_ID}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, createCartState(DEMO_MARKET_ID));
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey())
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as CartState;
        dispatch({ type: 'hydrate', state: parsed });
      })
      .catch((error) => console.warn('[Carrinho] Não foi possível restaurar o carrinho.', error))
      .finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(storageKey(), JSON.stringify(state))
      .catch((error) => console.warn('[Carrinho] Não foi possível salvar o carrinho.', error));
  }, [hydrated, state]);

  const totals = useMemo(() => getCartTotals(state), [state]);
  const addProduct = useCallback((product: CatalogProduct, quantity?: number) => {
    dispatch({ type: 'add', product, quantity });
  }, []);
  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'setQuantity', productId, quantity });
  }, []);
  const removeProduct = useCallback((productId: string) => {
    dispatch({ type: 'remove', productId });
  }, []);
  const clearCart = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(() => ({
    state,
    ...totals,
    addProduct,
    setQuantity,
    removeProduct,
    clearCart,
  }), [addProduct, clearCart, removeProduct, setQuantity, state, totals]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa ser usado dentro de CartProvider.');
  return context;
}
