# Meu Cesto

**Meu Cesto** é um aplicativo mobile para gerenciamento de listas de compras e controle de gastos em tempo real. Este é um projeto acadêmico desenvolvido para o **5º período** da faculdade.

## Autores

- **Guilherme Sant'Ana**
- **Antonio Gomes**

## Sobre o projeto

O objetivo do Meu Cesto é oferecer uma experiência moderna e fluida para quem deseja organizar compras semanais, monitorar o orçamento mensal e buscar produtos por meio de integrações inteligentes.

## Funcionalidades principais

- **Autenticação segura:** login e cadastro integrados ao Firebase Auth.
- **Sincronização em tempo real:** listas de compras salvas no Cloud Firestore.
- **Busca de produtos:** pesquisa de produtos por nome usando API externa.
- **Seleção múltipla:** adição de vários itens à lista de uma só vez.
- **Pull-to-refresh:** atualização de dados por gesto nativo.
- **Sistema de notificações:** feedback visual com toasts.
- **Dashboards de gastos:** acompanhamento de gastos mensais e por categoria.
- **Assistente Luca:** tela de conversa com IA para dicas e insights.

## Tecnologias utilizadas

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [Firebase](https://firebase.google.com/) Auth e Firestore
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Ionicons](https://ionic.io/ionicons)

## Como rodar o projeto

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Preencha o `.env` com as credenciais do Firebase e das APIs usadas pelo projeto.

4. Inicie o servidor de desenvolvimento:

   ```bash
   npx expo start
   ```

5. Abra o app:

   - Pelo app **Expo Go** no celular.
   - Pelo navegador usando a opção web do Expo.
   - Por emulador Android/iOS.

## Verificações

Comandos usados para conferir a qualidade do projeto:

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform web
```

## Observação sobre ambiente

O app não inclui credenciais reais no repositório. Caso as variáveis do Firebase não estejam configuradas, a interface continua carregando, mas login, cadastro e dados em tempo real dependem do `.env` preenchido corretamente.
