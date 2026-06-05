/** Fila em memória para o tour — evita corrida com AsyncStorage após criar conta. */
const pendingSession = new Set<string>();

export function requestAppTourSession(uid: string): void {
  pendingSession.add(uid);
}

export function takeAppTourSession(uid: string): boolean {
  if (!pendingSession.has(uid)) return false;
  pendingSession.delete(uid);
  return true;
}
