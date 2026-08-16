export type NavigationItem = {
  route: string;
  label: string;
  icon: string;
  activeIcon?: string;
};

export const VISIBLE_TABS: NavigationItem[] = [
  { route: '/home', label: 'Início', icon: 'home-outline', activeIcon: 'home' },
  { route: '/stats', label: 'Gastos', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { route: '/lists', label: 'Lista', icon: 'cart-outline', activeIcon: 'cart' },
  { route: '/profile', label: 'Perfil', icon: 'person-outline', activeIcon: 'person' },
];

export const QUICK_ACTIONS: NavigationItem[] = [
  { route: '/addItem', label: 'Adicionar produto', icon: 'cart-outline' },
  { route: '/stats', label: 'Registrar gasto', icon: 'cash-outline' },
  { route: '/lists', label: 'Nova lista', icon: 'list-outline' },
  { route: '/luca', label: 'Perguntar ao Luca', icon: 'sparkles-outline' },
];
