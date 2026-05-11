import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getLucaResponse } from '../scripts/aiService';
import { auth } from '../scripts/firebaseConfig';

const { width } = Dimensions.get('window');
const PRIMARY_GREEN = '#00A36C';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'luca';
}

type GeminiHistory = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

const QUICK_ACTIONS = [
  { id: '1', label: 'Como economizar no mercado?', icon: 'leaf-outline' },
  { id: '2', label: 'Analise meus gastos do mês', icon: 'stats-chart-outline' },
  { id: '3', label: 'Dicas de lista de compras', icon: 'list-outline' },
  { id: '4', label: 'Produtos mais baratos', icon: 'pricetag-outline' },
];

// Dot loader animado
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

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
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: PRIMARY_GREEN,
            opacity: dot,
            transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

export default function LucaScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const userName = user?.displayName?.split(' ')[0] || 'amigo';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  // Histórico no formato Gemini, mantido em paralelo
  const geminiHistory = useRef<GeminiHistory[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const hasMessages = messages.length > 0;

  const sendMessage = useCallback(async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), text: textToSend, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Rola para o final após adicionar mensagem
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      // Chama a IA com o histórico atual + nova mensagem
      const responseText = await getLucaResponse(geminiHistory.current, textToSend);

      // Atualiza o histórico Gemini com o par user→model
      geminiHistory.current = [
        ...geminiHistory.current,
        { role: 'user', parts: [{ text: textToSend }] },
        { role: 'model', parts: [{ text: responseText }] },
      ];

      const lucaMsg: Message = { id: (Date.now() + 1).toString(), text: responseText, sender: 'luca' };
      setMessages(prev => [...prev, lucaMsg]);
    } catch (err) {
      console.error('[Luca] Erro:', err);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Desculpe, tive um problema. Pode tentar novamente?',
        sender: 'luca',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowLuca]}>
        {!isUser && (
          <View style={styles.avatarMini}>
            <Ionicons name="sparkles" size={13} color={PRIMARY_GREEN} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleLuca]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.onlineDot} />
          <Text style={styles.headerName}>Luca</Text>
          <Text style={styles.headerSub}>Online</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Mensagens ou Tela inicial */}
      {!hasMessages ? (
        <View style={styles.emptyState}>
          <Image
            source={require('../assets/images/Meu-Cesto-Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.greetingTitle}>Olá, {userName} 👋</Text>
          <Text style={styles.greetingSubtitle}>Como eu posso te ajudar hoje?</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickScroll}
            style={styles.quickScrollContainer}
          >
            {QUICK_ACTIONS.map(action => (
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
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            loading ? (
              <View style={[styles.messageRow, styles.messageRowLuca]}>
                <View style={styles.avatarMini}>
                  <Ionicons name="sparkles" size={13} color={PRIMARY_GREEN} />
                </View>
                <View style={[styles.bubble, styles.bubbleLuca]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Input Area */}
      <View style={styles.inputArea}>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.textInput}
            placeholder="Mensagem..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>Luca pode cometer erros. Verifique informações importantes.</Text>
      </View>
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
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    flex: 1,
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
    fontWeight: '500',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
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

  // Messages
  listContent: {
    padding: 20,
    paddingBottom: 10,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '88%',
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
  bubbleText: {
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 22,
    fontWeight: '500',
  },
  bubbleTextUser: {
    color: '#fff',
  },

  // Input
  inputArea: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 35 : 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
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
});
