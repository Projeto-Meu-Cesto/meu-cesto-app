export type OrderStatus =
  | 'rascunho'
  | 'aguardando_pagamento'
  | 'recusado'
  | 'confirmado'
  | 'em_preparo'
  | 'pronto_retirada'
  | 'em_entrega'
  | 'concluido'
  | 'cancelado'
  | 'estornado';

export type OrderItem = {
  productId: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
};

export type OrderTotals = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
};

export type Order = {
  id: string;
  uid: string;
  marketId: string;
  status: OrderStatus;
  fulfillment:
    | { mode: 'pickup'; pickupSlot: string }
    | { mode: 'delivery'; address: string; deliveryWindow?: string };
  payment: {
    provider: 'demo';
    status: 'pending' | 'approved' | 'declined' | 'refunded';
    transactionId?: string;
  };
  items: OrderItem[];
  totals: OrderTotals;
  createdAt: string;
  updatedAt: string;
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  rascunho: ['aguardando_pagamento'],
  aguardando_pagamento: ['confirmado', 'recusado', 'cancelado'],
  recusado: [],
  confirmado: ['em_preparo', 'cancelado'],
  em_preparo: ['pronto_retirada', 'em_entrega'],
  pronto_retirada: ['concluido'],
  em_entrega: ['concluido'],
  concluido: ['estornado'],
  cancelado: [],
  estornado: [],
};

export function calculateOrderTotals(
  items: Pick<OrderItem, 'unitPrice' | 'quantity'>[],
  deliveryFee = 0,
  discount = 0,
): OrderTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return {
    subtotal,
    deliveryFee,
    discount,
    total: Math.max(0, subtotal + deliveryFee - discount),
  };
}

export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  return ORDER_TRANSITIONS[current].includes(next);
}
