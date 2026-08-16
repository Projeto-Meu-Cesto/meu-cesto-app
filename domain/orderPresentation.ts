import { Colors } from '../constants/theme';
import type { OrderStatus } from './orders';

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; description: string; color: string }> = {
  rascunho: { label: 'Rascunho', description: 'Pedido ainda não enviado.', color: Colors.textMuted },
  aguardando_pagamento: { label: 'Aguardando pagamento', description: 'O pagamento demonstrativo está sendo processado.', color: Colors.warning },
  recusado: { label: 'Pagamento recusado', description: 'O cenário demonstrou uma recusa de pagamento.', color: Colors.error },
  confirmado: { label: 'Confirmado', description: 'O mercado recebeu e confirmou o pedido.', color: Colors.primary },
  em_preparo: { label: 'Em preparo', description: 'Os produtos estão sendo separados.', color: Colors.warning },
  pronto_retirada: { label: 'Pronto para retirada', description: 'O pedido pode ser retirado no mercado.', color: Colors.primary },
  em_entrega: { label: 'Saiu para entrega', description: 'O pedido está a caminho do endereço informado.', color: Colors.primary },
  concluido: { label: 'Concluído', description: 'A compra foi finalizada e entrou nas finanças.', color: Colors.primary },
  cancelado: { label: 'Cancelado', description: 'O pedido foi cancelado antes da conclusão.', color: Colors.error },
  estornado: { label: 'Estornado', description: 'A compra demonstrativa foi estornada.', color: Colors.error },
};
