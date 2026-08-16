import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  View,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { getLucaResponse, LUCA_MODELS, LucaHistoryItem, isShoppingListRequest, generateShoppingList } from '../scripts/aiService';
import { FinanceContext, getUserFinanceContext, shouldAttachFinanceChart } from '../scripts/financeContext';
import { auth, db } from '../scripts/firebaseConfig';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../constants/theme';

// UI components
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { AppModal } from '../components/ui/AppModal';
import AnimatedReanimated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { Sidebar } from '../components/ui/Sidebar';

const DEFAULT_CHAT_ID = 'principal';
const HISTORY_TIMEOUT_MS = 4500;
const FINANCE_CONTEXT_TIMEOUT_MS = 3500;

type ChartBar = {
  label: string;
  value: number;
  color: string;
};

type MessageChart = {
  title: string;
  total: number;
  bars: ChartBar[];
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'luca';
  createdAt?: any;
  model?: string;
  chart?: MessageChart | null;
}

const QUICK_ACTIONS = [
  { id: '1', label: 'Como economizar no mercado?', icon: 'leaf-outline' },
  { id: '2', label: 'Analise meus gastos do mês', icon: 'stats-chart-outline' },
  { id: '3', label: 'Dicas de lista de compras', icon: 'list-outline' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function buildChart(context: FinanceContext): MessageChart {
  return {
    title: 'Gastos por categoria',
    total: context.currentMonthTotal,
    bars: [
      { label: 'Alimentação', value: context.categoryTotals.Alimentação || 0, color: Colors.primary },
      { label: 'Transporte', value: context.categoryTotals.Transporte || 0, color: '#38BDF8' },
      { label: 'Outros', value: context.categoryTotals.Outros || 0, color: Colors.textMuted },
    ],
  };
}

function toGeminiHistory(messages: Message[]): LucaHistoryItem[] {
  return messages
    .filter((message) => message.text.trim().length > 0)
    .slice(-12)
    .map((message) => ({
      role: message.sender === 'luca' ? 'model' : 'user',
      parts: [{ text: message.text }],
    }));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

function TypingDots() {
  const dotOne = useRef(new Animated.Value(0)).current;
  const dotTwo = useRef(new Animated.Value(0)).current;
  const dotThree = useRef(new Animated.Value(0)).current;
  const dots = useMemo(() => [dotOne, dotTwo, dotThree], [dotOne, dotTwo, dotThree]);

  React.useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.typingDots}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot,
              transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function InlineMarkdown({ text, isUser = false }: { text: string; isUser?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[styles.markdownText, isUser ? styles.markdownTextUser : { color: Colors.textPrimary }]}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={`${part}-${index}`} style={[styles.markdownBold, { color: isUser ? '#080A09' : Colors.primary }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={`${part}-${index}`}>{part}</Text>;
      })}
    </Text>
  );
}

function MarkdownMessage({ text, isUser = false }: { text: string; isUser?: boolean }) {
  const lines = text.split('\n');
  return (
    <View style={styles.markdownBlock}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={`space-${index}`} style={styles.markdownSpacer} />;

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          return (
            <Typography key={`h3-${index}`} variant="body" weight="bold" color={isUser ? '#080A09' : Colors.primary} style={{ marginTop: Spacing.sm, marginBottom: 2 }}>
              {trimmed.replace(/^###\s+|^##\s+/, '')}
            </Typography>
          );
        }

        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <View key={`bullet-${index}`} style={styles.bulletRow}>
              <Typography variant="body" color={isUser ? '#080A09' : Colors.primary}>•</Typography>
              <View style={styles.bulletText}>
                <InlineMarkdown text={trimmed.replace(/^[-*]\s+/, '')} isUser={isUser} />
              </View>
            </View>
          );
        }

        return <InlineMarkdown key={`text-${index}`} text={trimmed} isUser={isUser} />;
      })}
    </View>
  );
}

function FinanceMiniChart({ chart }: { chart: MessageChart }) {
  const maxValue = Math.max(...chart.bars.map((bar) => bar.value), 1);

  return (
    <Card elevated style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Typography variant="body" weight="bold" color={Colors.textPrimary}>{chart.title}</Typography>
        <Typography variant="body" weight="heavy" color={Colors.primary}>{formatCurrency(chart.total)}</Typography>
      </View>

      {chart.bars.map((bar) => (
        <View key={bar.label} style={styles.chartRow}>
          <View style={styles.chartLabelRow}>
            <Typography variant="caption" color={Colors.textSecondary}>{bar.label}</Typography>
            <Typography variant="caption" weight="bold" color={Colors.textPrimary}>{formatCurrency(bar.value)}</Typography>
          </View>
          <ProgressBar progress={bar.value / maxValue} color={bar.color} height={6} />
        </View>
      ))}
    </Card>
  );
}

export default function LucaScreen({ inTabs = false }: { inTabs?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(Boolean(auth.currentUser));
  const userUid = user?.uid;

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  const messagesPath = React.useMemo(
    () => userUid && activeChatId
      ? collection(db, 'users', userUid, 'luca_chats', activeChatId, 'messages')
      : null,
    [userUid, activeChatId]
  );

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const hasMessages = messages.length > 0;
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyWarning, setHistoryWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Typing effect states
  const [currentlyTypingId, setCurrentlyTypingId] = useState<string | null>(null);
  const [typingText, setTypingText] = useState('');
  const typingIntervalRef = useRef<any>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  // Listen to auth changes
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) router.replace('/');
    });
    return unsubscribe;
  }, [router]);

  // Sync chats
  React.useEffect(() => {
    if (!authReady || !user) {
      setChatsLoading(false);
      return;
    }

    setChatsLoading(true);
    const chatsQuery = query(
      collection(db, 'users', user.uid, 'luca_chats'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const loadedChats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      setChats(loadedChats);
      setChatsLoading(false);

      if (loadedChats.length > 0) {
        if (!activeChatId) {
          setActiveChatId(loadedChats[0].id);
        }
      } else {
        createFirstChat(user.uid);
      }
    }, (error) => {
      console.error('[Luca] Erro ao sincronizar chats:', error);
      setChatsLoading(false);
    });

    return unsubscribe;
  }, [authReady, user, activeChatId]);

  const createFirstChat = async (uid: string) => {
    try {
      const newDoc = await addDoc(collection(db, 'users', uid, 'luca_chats'), {
        title: 'Conversa Principal',
        updatedAt: serverTimestamp(),
      });
      setActiveChatId(newDoc.id);
    } catch (e) {
      console.error('[Luca] Erro ao criar primeiro chat:', e);
    }
  };

  // Load message history
  React.useEffect(() => {
    if (!authReady) return;
    if (!user || !messagesPath) {
      setHistoryLoading(false);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryWarning(false);
        const historyQuery = query(messagesPath, orderBy('createdAt', 'desc'), limit(30));
        const snapshot = await withTimeout(getDocs(historyQuery), HISTORY_TIMEOUT_MS);
        const loaded = snapshot.docs.map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data(),
        })) as Message[];

        if (!active) return;
        setMessages(loaded.reverse());
      } catch (error) {
        console.error('[Luca] Erro ao carregar histórico:', error);
        if (active) setHistoryWarning(true);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [authReady, messagesPath, user]);

  const simulateTyping = useCallback((fullText: string, lucaMsgId: string, onComplete: () => void) => {
    setCurrentlyTypingId(lucaMsgId);
    setTypingText('');
    const words = fullText.split(' ');
    let currentWordIndex = 0;
    let currentText = '';

    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

    typingIntervalRef.current = setInterval(() => {
      if (currentWordIndex < words.length) {
        currentText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        setTypingText(currentText);
        currentWordIndex++;
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 30);
      } else {
        clearInterval(typingIntervalRef.current);
        setCurrentlyTypingId(null);
        setTypingText('');
        onComplete();
      }
    }, 45);
  }, []);

  const saveMessage = useCallback(async (message: Omit<Message, 'id'>) => {
    if (!user || !activeChatId || !messagesPath) return;
    const isFirstUserMessage = message.sender === 'user' && messages.length === 0;

    await setDoc(
      doc(db, 'users', user.uid, 'luca_chats', activeChatId),
      {
        title: isFirstUserMessage
          ? (message.text.length > 25 ? message.text.slice(0, 22) + '...' : message.text)
          : (chats.find(c => c.id === activeChatId)?.title || 'Conversa'),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return addDoc(messagesPath, {
      ...message,
      createdAt: serverTimestamp(),
    });
  }, [messagesPath, activeChatId, user, messages.length, chats]);

  const sendMessage = useCallback(async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || loading || !user || !activeChatId) return;

    setInput('');
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: `local-user-${Date.now()}`,
      text: cleanText,
      sender: 'user',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      saveMessage({ text: cleanText, sender: 'user' }).catch(err => console.warn(err));

      let financeContext: FinanceContext | null = null;
      try {
        financeContext = await withTimeout(getUserFinanceContext(user.uid), FINANCE_CONTEXT_TIMEOUT_MS);
      } catch (contextError) {
        console.warn('[Luca] Contexto financeiro lento:', contextError);
      }

      let responseText = '';

      if (isShoppingListRequest(cleanText)) {
        try {
          const generatedList = await generateShoppingList(financeContext, cleanText);
          
          if (generatedList && generatedList.items.length > 0) {
            for (const item of generatedList.items) {
               await addDoc(collection(db, 'users', user.uid, 'shopping_list'), {
                 name: item.name,
                 category: item.category,
                 quantity: '1 un',
                 checked: false,
                 createdAt: serverTimestamp(),
               });
            }
            
            const itemList = generatedList.items.map(i => `- **${i.name}**`).join('\n');
            responseText = `Pronto! Criei a sua lista. 🛒\n\nAdicionei os seguintes itens:\n${itemList}\n\nEles já estão salvos na aba Lista!`;
          } else {
            responseText = await getLucaResponse({
              history: toGeminiHistory([...messages, userMsg]),
              message: cleanText,
              context: financeContext,
              model: LUCA_MODELS.primary,
            });
          }
        } catch (e) {
          console.error('[Luca] Erro ao criar lista via IA', e);
          responseText = await getLucaResponse({
            history: toGeminiHistory([...messages, userMsg]),
            message: cleanText,
            context: financeContext,
            model: LUCA_MODELS.primary,
          });
        }
      } else {
        responseText = await getLucaResponse({
          history: toGeminiHistory([...messages, userMsg]),
          message: cleanText,
          context: financeContext,
          model: LUCA_MODELS.primary,
        });
      }

      const lucaMsgId = `local-luca-${Date.now()}`;
      const lucaMsg: Message = {
        id: lucaMsgId,
        text: '',
        sender: 'luca',
        model: LUCA_MODELS.primary,
        chart: financeContext && shouldAttachFinanceChart(cleanText, financeContext) ? buildChart(financeContext) : null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, lucaMsg]);

      simulateTyping(responseText, lucaMsgId, () => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === lucaMsgId ? { ...msg, text: responseText } : msg
          )
        );
        saveMessage({
          text: responseText,
          sender: 'luca',
          model: lucaMsg.model,
          chart: lucaMsg.chart,
        }).catch(err => console.warn(err));
      });

    } catch (err) {
      console.error('[Luca] Erro:', err);
      const errorMsg: Message = {
        id: `local-error-${Date.now()}`,
        text: 'Tive um problema para responder agora. Pode tentar novamente?',
        sender: 'luca',
        model: 'local-fallback',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, saveMessage, user, activeChatId, simulateTyping]);

  const handleRefresh = useCallback(async () => {
    if (!messagesPath) return;
    try {
      setIsRefreshing(true);
      const historyQuery = query(messagesPath, orderBy('createdAt', 'desc'), limit(30));
      const snapshot = await getDocs(historyQuery);
      const loaded = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
      })) as Message[];
      setMessages(loaded.reverse());
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  }, [messagesPath]);

  const handleCreateNewChat = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setLoading(true);
      const newDoc = await addDoc(collection(db, 'users', user.uid, 'luca_chats'), {
        title: `Conversa ${chats.length + 1}`,
        updatedAt: serverTimestamp(),
      });
      setActiveChatId(newDoc.id);
      setMessages([]);
      toggleDrawer(false);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar uma nova conversa.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = (chatId: string, chatTitle: string) => {
    if (!user) return;
    setDeleteTarget({ id: chatId, title: chatTitle });
  };

  const confirmDeleteChat = async () => {
    if (!user || !deleteTarget) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeletingChat(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'luca_chats', deleteTarget.id));
      if (activeChatId === deleteTarget.id) {
        setActiveChatId(null);
        setMessages([]);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingChat(false);
    }
  };

  const toggleDrawer = (open: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDrawerOpen(open);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        {inTabs ? (
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleContainer}>
          <Ionicons name="sparkles" size={16} color={Colors.primary} />
          <Typography variant="title" weight="bold" color={Colors.textPrimary}>
            Luca
          </Typography>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => toggleDrawer(true)}>
          <Ionicons name="chatbubbles-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.chatScroll, !hasMessages && { flex: 1, justifyContent: 'center' }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.lucaAvatarBig}>
                <Ionicons name="sparkles" size={32} color="#080A09" />
              </View>
              <Typography variant="heading" weight="bold" color={Colors.textPrimary}>
                Olá, sou o Luca
              </Typography>
              <Typography variant="body" color={Colors.textSecondary} align="center" style={styles.emptySubtitle}>
                Seu copiloto de compras inteligentes e finanças domésticas. Como posso te ajudar hoje?
              </Typography>

              <View style={styles.quickActionsWrap}>
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.quickActionBtn}
                    onPress={() => sendMessage(action.label)}
                  >
                    <Ionicons name={action.icon as any} size={16} color={Colors.primary} />
                    <Typography variant="caption" weight="semibold" color={Colors.textPrimary}>
                      {action.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.sender === 'user';
            const isTyping = item.id === currentlyTypingId;
            const msgText = isTyping ? typingText : item.text;

            return (
              <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowLuca]}>
                {!isUser && (
                  <View style={styles.avatarMini}>
                    <Ionicons name="sparkles" size={14} color="#080A09" />
                  </View>
                )}
                <View style={{ maxWidth: '80%', gap: Spacing.sm }}>
                  <View style={[
                    styles.messageBubble,
                    isUser ? styles.bubbleUser : styles.bubbleLuca
                  ]}>
                    {isTyping && msgText.length === 0 ? (
                      <TypingDots />
                    ) : (
                      <MarkdownMessage text={msgText} isUser={isUser} />
                    )}
                  </View>
                  {item.chart && <FinanceMiniChart chart={item.chart} />}
                </View>
              </View>
            );
          }}
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.md }]}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte sobre seus gastos ou listas..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            disabled={!input.trim() || loading}
            onPress={() => sendMessage(input)}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#080A09" />
            ) : (
              <Ionicons name="send" size={16} color="#080A09" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Drawer Menu Sidepanel */}
      {drawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          <AnimatedReanimated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.drawerBackdrop}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleDrawer(false)} />
          </AnimatedReanimated.View>

          <AnimatedReanimated.View
            entering={SlideInRight.duration(250)}
            exiting={SlideOutRight.duration(200)}
            style={styles.drawerSheet}
          >
            <Typography variant="body" weight="bold" color={Colors.textMuted} style={styles.drawerTitle}>
              CONVERSAS ATIVAS
            </Typography>

            <Button
              variant="outline"
              label="Nova conversa"
              leftIcon={<Ionicons name="add" size={18} color={Colors.textPrimary} />}
              onPress={handleCreateNewChat}
              style={styles.newChatBtn}
            />

            <ScrollView contentContainerStyle={styles.chatsList}>
              {chats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <View key={chat.id} style={[styles.chatItem, isActive && styles.chatItemActive]}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 12, paddingLeft: 12 }}
                      onPress={() => {
                        setActiveChatId(chat.id);
                        toggleDrawer(false);
                      }}
                    >
                      <Typography variant="body" weight={isActive ? 'bold' : 'regular'} color={isActive ? Colors.primary : Colors.textPrimary}>
                        {chat.title || 'Conversa'}
                      </Typography>
                    </TouchableOpacity>
                    {chats.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteChatBtn}
                        onPress={() => handleDeleteChat(chat.id, chat.title)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Typography variant="body" weight="bold" color={Colors.textMuted} style={[styles.drawerTitle, { marginTop: Spacing.lg }]}>
              NAVEGAÇÃO
            </Typography>

            <View style={styles.navBlock}>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => {
                  toggleDrawer(false);
                  setTimeout(() => router.replace('/home'), 150);
                }}
              >
                <Ionicons name="home-outline" size={18} color={Colors.textSecondary} />
                <Typography variant="body" color={Colors.textSecondary}>Voltar ao Início</Typography>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navRow}
                onPress={() => {
                  toggleDrawer(false);
                  setTimeout(() => router.replace('/stats'), 150);
                }}
              >
                <Ionicons name="bar-chart-outline" size={18} color={Colors.textSecondary} />
                <Typography variant="body" color={Colors.textSecondary}>Ver Gastos</Typography>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navRow}
                onPress={() => {
                  toggleDrawer(false);
                  setTimeout(() => router.replace('/lists'), 150);
                }}
              >
                <Ionicons name="list-outline" size={18} color={Colors.textSecondary} />
                <Typography variant="body" color={Colors.textSecondary}>Ver Lista</Typography>
              </TouchableOpacity>
            </View>
          </AnimatedReanimated.View>
        </View>
      )}
      {/* Global Sidebar navigation drawer */}
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      <AppModal
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Excluir conversa"
        description={deleteTarget ? `A conversa “${deleteTarget.title}” e todas as mensagens serão apagadas permanentemente.` : ''}
        type="error"
        destructive
        confirmLabel="Excluir conversa"
        cancelLabel="Manter conversa"
        loading={deletingChat}
        onConfirm={confirmDeleteChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatScroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 40,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  lucaAvatarBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  quickActionsWrap: {
    width: '100%',
    gap: Spacing.sm,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  messageRowLuca: {
    alignItems: 'flex-end',
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleLuca: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  markdownBlock: {
    gap: Spacing.xs,
  },
  markdownSpacer: {
    height: Spacing.sm,
  },
  markdownText: {
    fontSize: 15,
    lineHeight: 21,
  },
  markdownTextUser: {
    color: '#080A09',
    fontWeight: '500',
  },
  markdownBold: {
    fontWeight: 'bold',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  bulletText: {
    flex: 1,
  },
  chartCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    gap: Spacing.md,
    width: '100%',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartRow: {
    gap: Spacing.xs,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    opacity: 0.5,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerSheet: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '78%',
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.xl,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    gap: Spacing.lg,
  },
  drawerTitle: {
    letterSpacing: 0.5,
  },
  newChatBtn: {
    width: '100%',
  },
  chatsList: {
    gap: Spacing.sm,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatItemActive: {
    borderColor: Colors.primary,
  },
  deleteChatBtn: {
    padding: 12,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  navBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
});
