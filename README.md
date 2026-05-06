# Meu Cesto 🛒

**Meu Cesto** é um aplicativo móvel desenvolvido para facilitar o gerenciamento de listas de compras e controle de gastos em tempo real. Este é um projeto acadêmico desenvolvido para o **5º período** da faculdade.

## 👥 Autores
- **Guilherme Sant'Ana**
- **Antonio Gomes**

---

## 🚀 Sobre o Projeto
O objetivo do Meu Cesto é proporcionar uma experiência moderna e fluida para quem deseja organizar suas compras semanais, monitorar o orçamento mensal e descobrir produtos através de uma integração inteligente com APIs de mercado.

## ✨ Funcionalidades Principais
- **Autenticação Segura**: Sistema de login e cadastro integrado ao Firebase Auth.
- **Sincronização em Tempo Real**: Listas de compras sincronizadas instantaneamente via Cloud Firestore.
- **Busca de Produtos (API Cosmos)**: Pesquisa inteligente de produtos por nome, trazendo informações detalhadas.
- **Seleção Múltipla**: Adicione vários itens à sua lista de uma só vez.
- **Pull-to-Refresh**: Interface responsiva com gestos nativos para atualização de dados.
- **Sistema de Notificações (Toasts)**: Feedback visual moderno para todas as ações do usuário.
- **Dashboards de Gastos**: Visualize seus gastos mensais e por categoria de forma intuitiva.

## 🛠️ Tecnologias Utilizadas
- [**Expo**](https://expo.dev/) & [**React Native**](https://reactnative.dev/)
- [**Firebase**](https://firebase.google.com/) (Auth & Firestore)
- [**React Native Reanimated**](https://docs.swmansion.com/react-native-reanimated/) (Animações premium)
- [**Expo Router**](https://docs.expo.dev/router/introduction/) (Navegação baseada em arquivos)
- [**Ionicons**](https://ionic.io/ionicons) (Ícones)

## 📦 Como rodar o projeto

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure o Firebase:**
   Certifique-se de que o arquivo `scripts/firebaseConfig.ts` contém suas credenciais válidas do Firebase.

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npx expo start
   ```

4. **Abra o app:**
   - Use o app **Expo Go** no seu celular físico (recomendado).
   - Ou use um emulador Android/iOS.

---

Este projeto foi desenvolvido com foco em UI/UX moderno, seguindo as melhores práticas de desenvolvimento mobile.
