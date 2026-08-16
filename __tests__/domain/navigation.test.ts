import { QUICK_ACTIONS, VISIBLE_TABS } from '../../domain/navigation';

describe('bottom navigation model', () => {
  test('contains exactly the four approved tabs around the central action', () => {
    expect(VISIBLE_TABS.map((tab) => [tab.route, tab.label])).toEqual([
      ['/home', 'Início'],
      ['/stats', 'Gastos'],
      ['/lists', 'Lista'],
      ['/profile', 'Perfil'],
    ]);
  });

  test('contains exactly the four approved quick actions', () => {
    expect(QUICK_ACTIONS.map((action) => [action.route, action.label])).toEqual([
      ['/addItem', 'Adicionar produto'],
      ['/stats', 'Registrar gasto'],
      ['/lists', 'Nova lista'],
      ['/luca', 'Perguntar ao Luca'],
    ]);
  });
});
