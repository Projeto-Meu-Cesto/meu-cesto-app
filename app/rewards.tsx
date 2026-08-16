import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppModal } from '../components/ui/AppModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Typography } from '../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../constants/theme';
import { DEMO_LOYALTY_RULE, DEMO_REWARDS } from '../data/demoRewards';
import type { LoyaltyEntry, LoyaltyReward } from '../domain/loyalty';
import { auth } from '../scripts/firebaseConfig';
import { createFirebaseLoyaltyRepository } from '../services/firebaseLoyaltyRepository';
import { createLoyaltyService } from '../services/loyaltyService';

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function RewardsScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState({ pending: 0, available: 0 });
  const [entries, setEntries] = useState<LoyaltyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LoyaltyReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const repository = useMemo(() => {
    const user = auth.currentUser;
    return user ? createFirebaseLoyaltyRepository(user.uid) : null;
  }, []);
  const service = useMemo(() => repository ? createLoyaltyService({ repository }) : null, [repository]);

  useEffect(() => {
    if (!repository) {
      setLoading(false);
      return;
    }
    const unsubscribeBalance = repository.subscribeBalance((next) => {
      setBalance(next);
      setLoading(false);
    }, () => {
      setMessage('Não foi possível carregar seus pontos agora.');
      setLoading(false);
    });
    const unsubscribeEntries = repository.subscribeEntries(setEntries, console.error);
    return () => { unsubscribeBalance(); unsubscribeEntries(); };
  }, [repository]);

  const redeem = async () => {
    if (!selected || !service) return;
    setRedeeming(true);
    try {
      await service.redeem(selected);
      setSelected(null);
      setMessage(`${selected.title} foi emitido no ambiente demonstrativo.`);
    } catch (error) {
      setSelected(null);
      setMessage(error instanceof Error && error.message === 'INSUFFICIENT_POINTS'
        ? 'Você ainda não tem pontos disponíveis suficientes para este benefício.'
        : 'Não foi possível trocar os pontos. Tente novamente.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Clube Meu Cesto</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Programa demonstrativo</Typography>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card elevated style={styles.balanceCard}>
          <View style={styles.balanceIcon}><Ionicons name="gift-outline" size={28} color={Colors.background} /></View>
          <View style={styles.balanceCopy}>
            <Typography variant="caption" weight="semibold" color={Colors.textSecondary}>PONTOS DISPONÍVEIS</Typography>
            {loading ? <ActivityIndicator color={Colors.primary} /> : <Typography variant="display" color={Colors.primary}>{balance.available}</Typography>}
            <Typography variant="caption" color={Colors.textSecondary}>{balance.pending} pontos aguardando a conclusão de pedidos</Typography>
          </View>
        </Card>

        <View style={styles.notice}>
          <Ionicons name="flask-outline" size={22} color={Colors.warning} />
          <Typography variant="caption" color={Colors.textSecondary} style={styles.noticeText}>{DEMO_LOYALTY_RULE.disclosure}</Typography>
        </View>

        <Typography variant="title" weight="semibold">Benefícios do mercado</Typography>
        <View style={styles.rewardGrid}>
          {DEMO_REWARDS.map((reward) => {
            const enabled = balance.available >= reward.pointsCost;
            return (
              <Card key={reward.id} style={styles.rewardCard}>
                <View style={styles.rewardIcon}><Ionicons name="ticket-outline" size={24} color={Colors.primary} /></View>
                <Typography variant="title" weight="semibold">{reward.title}</Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={styles.rewardDescription}>{reward.description}</Typography>
                <Typography weight="bold" color={Colors.primary}>{reward.pointsCost} pontos</Typography>
                <Button label={enabled ? 'Trocar pontos' : 'Saldo insuficiente'} variant={enabled ? 'primary' : 'outline'} disabled={!enabled} onPress={() => setSelected(reward)} />
              </Card>
            );
          })}
        </View>

        <Typography variant="title" weight="semibold">Extrato de pontos</Typography>
        {entries.length === 0 ? (
          <Card style={styles.empty}><Ionicons name="receipt-outline" size={28} color={Colors.textMuted} /><Typography color={Colors.textSecondary}>Seus lançamentos aparecerão após o primeiro pedido aprovado.</Typography></Card>
        ) : (
          <Card style={styles.ledger}>
            {entries.map((entry, index) => (
              <View key={entry.id} style={[styles.entry, index < entries.length - 1 && styles.entryDivider]}>
                <View style={[styles.entryIcon, { backgroundColor: entry.points >= 0 ? 'rgba(183, 255, 0, 0.10)' : 'rgba(255, 92, 92, 0.10)' }]}>
                  <Ionicons name={entry.points >= 0 ? 'add' : 'remove'} size={20} color={entry.points >= 0 ? Colors.primary : Colors.error} />
                </View>
                <View style={styles.entryCopy}>
                  <Typography weight="medium">{entry.description ?? 'Movimentação de pontos'}</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>{entry.status === 'pending' ? 'Pendente' : 'Disponível'} · {formatDate(entry.createdAt)}</Typography>
                </View>
                <Typography weight="bold" color={entry.points >= 0 ? Colors.primary : Colors.error}>{entry.points > 0 ? '+' : ''}{entry.points}</Typography>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <AppModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title="Trocar pontos"
        description={selected ? `Usar ${selected.pointsCost} pontos em “${selected.title}”? O benefício será emitido apenas para demonstração.` : ''}
        type="warning"
        confirmLabel="Sim, trocar"
        cancelLabel="Agora não"
        loading={redeeming}
        onConfirm={redeem}
      />
      <AppModal visible={message !== null} onClose={() => setMessage(null)} title="Clube Meu Cesto" description={message ?? ''} type="info" cancelLabel="Entendi" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: STATUS_BAR_HEIGHT + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  balanceCard: { minHeight: 168, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  balanceIcon: { width: 56, height: 56, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  balanceCopy: { flex: 1, gap: Spacing.xs },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255, 200, 87, 0.24)', backgroundColor: 'rgba(255, 200, 87, 0.08)' },
  noticeText: { flex: 1 },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  rewardCard: { minWidth: 220, flexBasis: 240, flexGrow: 1, gap: Spacing.sm },
  rewardIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: 'rgba(183, 255, 0, 0.08)', alignItems: 'center', justifyContent: 'center' },
  rewardDescription: { flex: 1, minHeight: 36 },
  empty: { alignItems: 'center', gap: Spacing.sm },
  ledger: { paddingVertical: Spacing.xs },
  entry: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  entryDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  entryIcon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  entryCopy: { flex: 1 },
});
