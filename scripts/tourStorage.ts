import AsyncStorage from '@react-native-async-storage/async-storage';

const tourPendingKey = (uid: string) => `@meu-cesto:app-tour-pending:${uid}`;
const tourCompletedKey = (uid: string) => `@meu-cesto:app-tour-completed:${uid}`;

export async function markAppTourPending(uid: string): Promise<void> {
  await AsyncStorage.setItem(tourPendingKey(uid), 'true');
}

export async function shouldShowAppTour(uid: string): Promise<boolean> {
  const [pending, completed] = await Promise.all([
    AsyncStorage.getItem(tourPendingKey(uid)),
    AsyncStorage.getItem(tourCompletedKey(uid)),
  ]);
  return pending === 'true' && completed !== 'true';
}

export async function completeAppTour(uid: string): Promise<void> {
  await AsyncStorage.multiSet([
    [tourCompletedKey(uid), 'true'],
    [tourPendingKey(uid), 'false'],
  ]);
}
