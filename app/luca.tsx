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
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getLucaResponse, LUCA_MODELS, LucaHistoryItem } from '../scripts/aiService';
import { FinanceContext, getUserFinanceContext, shouldAttachFinanceChart } from '../scripts/financeContext';
import { auth, db } from '../scripts/firebaseConfig';

const PRIMARY_GREEN = '#00A36C';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';
const BG_LIGHT = '#F8FAFC';
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
  { id: '4', label: 'Quais categorias pesaram mais?', icon: 'pie-chart-outline' },
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
      { label: 'Alimentação', value: context.categoryTotals.Alimentação, color: PRIMARY_GREEN },
      { label: 'Transporte', value: context.categoryTotals.Transporte, color: '#38BDF8' },
      { label: 'Outros', value: context.categoryTotals.Outros, color: '#F59E0B' },
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
    <Text style={[styles.markdownText, isUser && styles.markdownTextUser]}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={`${part}-${index}`} style={styles.markdownBold}>
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

        if (!trimmed) {
          return <View key={`space-${index}`} style={styles.markdownSpacer} />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={`h3-${index}`} style={[styles.markdownHeading, isUser && styles.markdownTextUser]}>
              {trimmed.replace(/^###\s+/, '')}
            </Text>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <Text key={`h2-${index}`} style={[styles.markdownHeading, isUser && styles.markdownTextUser]}>
              {trimmed.replace(/^##\s+/, '')}
            </Text>
          );
        }

        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <View key={`bullet-${index}`} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, isUser && styles.markdownTextUser]}>•</Text>
              <View style={styles.bulletText}>
                <InlineMarkdown text={trimmed.replace(/^[-*]\s+/, '')} isUser={isUser} />
              </View>
            </View>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const marker = trimmed.match(/^\d+\./)?.[0] || '';
          return (
            <View key={`number-${index}`} style={styles.bulletRow}>
              <Text style={[styles.numberMarker, isUser && styles.markdownTextUser]}>{marker}</Text>
              <View style={styles.bulletText}>
                <InlineMarkdown text={trimmed.replace(/^\d+\.\s+/, '')} isUser={isUser} />
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
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{chart.title}</Text>
        <Text style={styles.chartTotal}>{formatCurrency(chart.total)}</Text>
      </View>

      {chart.bars.map((bar) => (
        <View key={bar.label} style={styles.chartRow}>
          <View style={styles.chartLabelRow}>
            <Text style={styles.chartLabel}>{bar.label}</Text>
            <Text style={styles.chartValue}>{formatCurrency(bar.value)}</Text>
          </View>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartFill,
                {
                  width: `${Math.max(4, (bar.value / maxValue) * 100)}%` as any,
                  backgroundColor: bar.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const MAX_CHATS_LIMIT = 8;
const MAX_MESSAGES_LIMIT = 20;

function SkeletonItem({ width, height, style }: { width: any; height: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E2E8F0',
          borderRadius: 12,
          opacity,
        },
        style,
      ]}
    />
  );
}

function ChatSkeleton() {
  return (
    <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '80%' }}>
        <View style={[styles.avatarMini, { backgroundColor: '#E2E8F0' }]} />
        <SkeletonItem width="60%" height={40} style={{ borderBottomLeftRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, maxWidth: '80%', alignSelf: 'flex-end' }}>
        <SkeletonItem width="70%" height={60} style={{ borderBottomRightRadius: 4, backgroundColor: '#D1FAE5' }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '80%' }}>
        <View style={[styles.avatarMini, { backgroundColor: '#E2E8F0' }]} />
        <SkeletonItem width="80%" height={85} style={{ borderBottomLeftRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, maxWidth: '80%', alignSelf: 'flex-end' }}>
        <SkeletonItem width="50%" height={45} style={{ borderBottomRightRadius: 4, backgroundColor: '#D1FAE5' }} />
      </View>
    </View>
  );
}

export default function LucaScreen({ inTabs = false }: { inTabs?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(Boolean(auth.currentUser));
  const userUid = user?.uid;
  const userName = user?.displayName?.split(' ')[0] || 'amigo';

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnimation = useRef(new Animated.Value(-Dimensions.get('window').width * 0.78)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const messagesPath = React.useMemo(
    () => userUid && activeChatId
      ? collection(db, 'users', userUid, 'luca_chats', activeChatId, 'messages')
      : null,
    [userUid, activeChatId]
  );

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyWarning, setHistoryWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Typing effect states
  const [currentlyTypingId, setCurrentlyTypingId] = useState<string | null>(null);
  const [typingText, setTypingText] = useState('');
  const typingIntervalRef = useRef<any>(null);

  const flatListRef = useRef<FlatList<Message>>(null);
  const hasMessages = messages.length > 0;

  // Listen to auth changes
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        router.replace('/');
      }
    });

    return unsubscribe;
  }, [router]);

  // Listen to chats list in real-time
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

  // Load message history when activeChatId or messagesPath changes
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
        const loaded = snapshot.docs
          .map((messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          })) as Message[];

        if (!active) return;

        setMessages(loaded.reverse());
      } catch (error) {
        console.error('[Luca] Erro ao carregar histórico:', error);
        if (active) {
          setHistoryWarning(true);
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [authReady, messagesPath, user]);

  React.useEffect(() => {
    if (historyLoading) {
      const timer = setTimeout(() => {
        setHistoryLoading(false);
        setHistoryWarning(true);
      }, HISTORY_TIMEOUT_MS + 700);

      return () => clearTimeout(timer);
    }
  }, [historyLoading]);

  // Clean up typing animation interval
  React.useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const simulateTyping = useCallback((fullText: string, lucaMsgId: string, onComplete: () => void) => {
    setCurrentlyTypingId(lucaMsgId);
    setTypingText('');

    const words = fullText.split(' ');
    let currentWordIndex = 0;
    let currentText = '';

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

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

  const copyMessage = useCallback(async (text: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copiado', 'Resposta copiada para a área de transferência.');
        return;
      }

      Alert.alert('Copiar resposta', text);
    } catch {
      Alert.alert('Copiar resposta', text);
    }
  }, []);

  const sendMessage = useCallback(async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || loading || !user || !activeChatId) return;

    if (messages.length >= MAX_MESSAGES_LIMIT) {
      Alert.alert(
        'Limite de Conversa Atingido',
        'Esta conversa atingiu o limite de 20 mensagens. Crie uma nova conversa para continuar.'
      );
      return;
    }

    setInput('');
    setLoading(true);

    const userMsg: Message = {
      id: `local-user-${Date.now()}`,
      text: cleanText,
      sender: 'user',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      saveMessage({
        text: cleanText,
        sender: 'user',
      }).catch((error) => console.warn('[Luca] Mensagem do usuário não foi salva ainda:', error));

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

      let financeContext: FinanceContext | null = null;

      try {
        financeContext = await withTimeout(getUserFinanceContext(user.uid), FINANCE_CONTEXT_TIMEOUT_MS);
      } catch (contextError) {
        console.warn('[Luca] Contexto financeiro lento. Respondendo sem bloquear:', contextError);
      }

      const responseText = await getLucaResponse({
        history: toGeminiHistory([...messages, userMsg]),
        message: cleanText,
        context: financeContext,
        model: LUCA_MODELS.primary,
      });

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
        }).catch((error) => console.warn('[Luca] Resposta do Luca não foi salva ainda:', error));
      });

    } catch (err) {
      console.error('[Luca] Erro:', err);
      const errorMsg: Message = {
        id: `local-error-${Date.now()}`,
        text: 'Desculpe, tive um problema para responder agora. Pode tentar novamente?',
        sender: 'luca',
        model: 'local-fallback',
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMsg]);

      saveMessage({
        text: errorMsg.text,
        sender: errorMsg.sender,
        model: errorMsg.model,
      }).catch((error) => console.warn('[Luca] Erro local não foi salvo ainda:', error));
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
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
      console.error('[Luca] Erro ao atualizar mensagens:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [messagesPath]);

  const handleCreateNewChat = async () => {
    if (!user) return;
    if (chats.length >= MAX_CHATS_LIMIT) {
      Alert.alert(
        'Limite de Chats Atingido',
        `Você atingiu o limite máximo de ${MAX_CHATS_LIMIT} chats ativos. Por favor, exclua uma conversa antiga antes de criar uma nova.`
      );
      return;
    }

    try {
      setLoading(true);
      const newDoc = await addDoc(collection(db, 'users', user.uid, 'luca_chats'), {
        title: `Nova conversa ${chats.length + 1}`,
        updatedAt: serverTimestamp(),
      });
      setActiveChatId(newDoc.id);
      setMessages([]);
      toggleDrawer(false);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar uma nova conversa.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = (chatId: string, chatTitle: string) => {
    if (!user) return;
    Alert.alert(
      'Excluir Conversa',
      `Tem certeza que deseja excluir permanentemente a conversa "${chatTitle}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'luca_chats', chatId));
              if (activeChatId === chatId) {
                setActiveChatId(null);
                setMessages([]);
              }
            } catch (error) {
              console.error('[Luca] Erro ao excluir chat:', error);
              Alert.alert('Erro', 'Não foi possível excluir a conversa.');
            }
          },
        },
      ]
    );
  };

  const toggleDrawer = (open: boolean) => {
    if (open) {
      setDrawerOpen(true);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(drawerAnimation, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        ]).start();
      }, 10);
    } else {
      Animated.parallel([
        Animated.timing(drawerAnimation, {
          toValue: -Dimensions.get('window').width * 0.78,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setDrawerOpen(false);
      });
    }
  };

  const handleInputKeyPress = useCallback((event: any) => {
    if (Platform.OS !== 'web') return;

    const nativeEvent = event?.nativeEvent;
    const key = nativeEvent?.key;
    const shiftKey = Boolean(nativeEvent?.shiftKey);

    if (key === 'Enter' && !shiftKey) {
      event.preventDefault?.();
      nativeEvent.preventDefault?.();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    const textToShow = item.id === currentlyTypingId ? (typingText || '') + ' ▊' : item.text;

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowLuca]}>
        {!isUser && (
          <View style={styles.avatarMini}>
            <Ionicons name="sparkles" size={13} color={PRIMARY_GREEN} />
          </View>
        )}

        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleLuca]}>
          <MarkdownMessage text={textToShow} isUser={isUser} />
          {!isUser && item.chart ? <FinanceMiniChart chart={item.chart} /> : null}
          {!isUser && (
            <TouchableOpacity style={styles.copyButton} onPress={() => copyMessage(item.text)}>
              <Ionicons name="copy-outline" size={14} color={TEXT_GRAY} />
              <Text style={styles.copyText}>Copiar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [copyMessage, currentlyTypingId, typingText]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent />

      <View style={styles.header}>
        {inTabs ? (
          <TouchableOpacity onPress={() => toggleDrawer(true)} style={styles.headerBtn}>
            <Ionicons name="menu-outline" size={24} color={TEXT_DARK} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
          </TouchableOpacity>
        )}
      </View>

      {historyLoading ? (
        <ChatSkeleton />
      ) : !hasMessages ? (
        <ScrollView
          contentContainerStyle={[styles.emptyStateScroll, inTabs && { paddingBottom: keyboardVisible ? 20 : 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY_GREEN]}
              tintColor={PRIMARY_GREEN}
              progressViewOffset={30}
            />
          }
        >
          <View style={styles.emptyStateInner}>
            <Image
              source={require('../assets/images/Meu-Cesto-Logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.greetingTitle}>Olá, {userName}</Text>
            <Text style={styles.greetingSubtitle}>Posso analisar seus gastos reais e ajudar sua lista ficar mais econômica.</Text>

            {historyWarning ? (
              <View style={styles.historyNotice}>
                <Ionicons name="cloud-offline-outline" size={16} color={TEXT_GRAY} />
                <Text style={styles.historyNoticeText}>Histórico lento. Você já pode conversar.</Text>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickScroll}
              style={styles.quickScrollContainer}
            >
              {QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.chip}
                  onPress={() => sendMessage(action.label)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={action.icon as any} size={16} color={PRIMARY_GREEN} />
                  <Text style={styles.chipText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY_GREEN]}
              tintColor={PRIMARY_GREEN}
            />
          }
          ListFooterComponent={
            loading ? (
              <View style={[styles.messageRow, styles.messageRowLuca]}>
                <View style={styles.avatarMini}>
                  <Ionicons name="sparkles" size={13} color={PRIMARY_GREEN} />
                </View>
                <View style={[styles.bubble, styles.bubbleLuca]}>
                  <TypingDots />
                  <Text style={styles.thinkingText}>Luca analisando seus dados...</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.inputArea, (inTabs && !keyboardVisible) && styles.inputAreaWithTabs]}>
        {/* Messages Limit Badge */}
        {messages.length >= 16 && (
          <View style={[
            styles.limitBadge,
            messages.length >= MAX_MESSAGES_LIMIT ? styles.limitBadgeBlocked : styles.limitBadgeWarning
          ]}>
            <Ionicons
              name={messages.length >= MAX_MESSAGES_LIMIT ? 'lock-closed-outline' : 'warning-outline'}
              size={12}
              color={messages.length >= MAX_MESSAGES_LIMIT ? '#EF4444' : '#D97706'}
            />
            <Text style={[
              styles.limitBadgeText,
              messages.length >= MAX_MESSAGES_LIMIT ? styles.limitBadgeTextBlocked : styles.limitBadgeTextWarning
            ]}>
              {messages.length >= MAX_MESSAGES_LIMIT
                ? 'Limite de 20 mensagens atingido. Comece outro chat!'
                : `Atenção: resta(m) ${MAX_MESSAGES_LIMIT - messages.length} mensagem(ns) nesta conversa.`
              }
            </Text>
          </View>
        )}

        <View style={styles.inputBox}>
          <TextInput
            style={styles.textInput}
            placeholder={
              !user
                ? 'Faça login para conversar'
                : messages.length >= MAX_MESSAGES_LIMIT
                  ? 'Limite atingido nesta conversa'
                  : 'Mensagem...'
            }
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            editable={Boolean(user) && !loading && messages.length < MAX_MESSAGES_LIMIT}
            onSubmitEditing={() => sendMessage(input)}
            onKeyPress={handleInputKeyPress}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading || !user || messages.length >= MAX_MESSAGES_LIMIT) && styles.sendBtnDisabled
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading || !user || messages.length >= MAX_MESSAGES_LIMIT}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>Luca usa seus dados salvos no app e pode cometer erros.</Text>
      </View>

      {/* Side Menu Drawer */}
      {drawerOpen && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <TouchableWithoutFeedback onPress={() => toggleDrawer(false)}>
            <Animated.View style={[styles.drawerBackdrop, { opacity: backdropOpacity }]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                transform: [{ translateX: drawerAnimation }],
              },
            ]}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={{ flex: 1 }}>
                {/* Drawer Header */}
                <View style={styles.drawerHeader}>
                  <Text style={styles.drawerTitle}>Conversas Luca</Text>
                  <TouchableOpacity onPress={() => toggleDrawer(false)}>
                    <Ionicons name="close" size={24} color={TEXT_DARK} />
                  </TouchableOpacity>
                </View>

                {/* Create New Chat Button */}
                <TouchableOpacity
                  style={styles.newChatBtn}
                  onPress={handleCreateNewChat}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.newChatBtnText}>Nova Conversa</Text>
                  <Text style={styles.chatCountBadge}>{chats.length}/{MAX_CHATS_LIMIT}</Text>
                </TouchableOpacity>

                {/* Chats List */}
                {chatsLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={PRIMARY_GREEN} />
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={styles.drawerScroll} showsVerticalScrollIndicator={false}>
                    {chats.map((chat) => {
                      const isActive = chat.id === activeChatId;
                      return (
                        <TouchableOpacity
                          key={chat.id}
                          style={[styles.chatListItem, isActive && styles.chatListItemActive]}
                          onPress={() => {
                            setActiveChatId(chat.id);
                            toggleDrawer(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={18}
                            color={isActive ? PRIMARY_GREEN : TEXT_GRAY}
                          />
                          <Text
                            style={[styles.chatListItemText, isActive && styles.chatListItemTextActive]}
                            numberOfLines={1}
                          >
                            {chat.title || 'Conversa'}
                          </Text>

                          <TouchableOpacity
                            onPress={() => handleDeleteChat(chat.id, chat.title || 'Conversa')}
                            style={styles.deleteChatBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Drawer Footer */}
                <View style={styles.drawerFooter}>
                  <Text style={styles.drawerFooterText}>Meu Cesto App • Luca AI</Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 24) + 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginBottom: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_DARK,
    lineHeight: 18,
  },
  headerSub: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '700',
  },
  modelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelBadgeText: {
    color: PRIMARY_GREEN,
    fontSize: 12,
    fontWeight: '900',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: TEXT_GRAY,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyStateScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 28,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 8,
    textAlign: 'center',
  },
  greetingSubtitle: {
    fontSize: 16,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginBottom: 22,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 330,
  },
  historyNotice: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    borderRadius: 18,
    marginBottom: 28,
  },
  historyNoticeText: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '800',
  },
  quickScrollContainer: {
    flexGrow: 0,
    marginBottom: 10,
  },
  quickScroll: {
    paddingHorizontal: 5,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  listContent: {
    padding: 20,
    paddingBottom: 10,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '92%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageRowLuca: {
    alignSelf: 'flex-start',
  },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: PRIMARY_GREEN,
    borderBottomRightRadius: 5,
  },
  bubbleLuca: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 5,
  },
  markdownBlock: {
    gap: 3,
  },
  markdownText: {
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 22,
    fontWeight: '500',
  },
  markdownTextUser: {
    color: '#fff',
  },
  markdownBold: {
    fontWeight: '900',
  },
  markdownHeading: {
    color: TEXT_DARK,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '900',
  },
  markdownSpacer: {
    height: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  bulletDot: {
    color: TEXT_DARK,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '900',
  },
  numberMarker: {
    color: TEXT_DARK,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    minWidth: 22,
  },
  bulletText: {
    flex: 1,
  },
  copyButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyText: {
    color: TEXT_GRAY,
    fontSize: 11,
    fontWeight: '800',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY_GREEN,
  },
  thinkingText: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '700',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  chartTitle: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: '900',
  },
  chartTotal: {
    color: PRIMARY_GREEN,
    fontSize: 13,
    fontWeight: '900',
  },
  chartRow: {
    gap: 5,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartLabel: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '800',
  },
  chartValue: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: '900',
  },
  chartTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 4,
  },
  inputArea: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 35 : 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputAreaWithTabs: {
    paddingBottom: Platform.OS === 'ios' ? 112 : 92,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: BG_LIGHT,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
    fontWeight: '500',
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEXT_DARK,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  disclaimer: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Dimensions.get('window').width * 0.78,
    backgroundColor: '#fff',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 110,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_GREEN,
    marginHorizontal: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newChatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  chatCountBadge: {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '800',
  },
  drawerScroll: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    gap: 8,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
    backgroundColor: 'transparent',
  },
  chatListItemActive: {
    backgroundColor: '#ECFDF5',
  },
  chatListItemText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
  chatListItemTextActive: {
    color: PRIMARY_GREEN,
    fontWeight: '800',
  },
  deleteChatBtn: {
    padding: 4,
  },
  drawerFooter: {
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 'auto',
  },
  drawerFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'center',
  },
  limitBadgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  limitBadgeBlocked: {
    backgroundColor: '#FEE2E2',
  },
  limitBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  limitBadgeTextWarning: {
    color: '#D97706',
  },
  limitBadgeTextBlocked: {
    color: '#DC2626',
  },
});
