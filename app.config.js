import "dotenv/config";

// Expo incorpora automaticamente toda variável EXPO_PUBLIC no JavaScript web.
// Estas credenciais antigas nunca devem chegar ao cliente; Firebase AI Logic
// e Open Food Facts substituem as integrações diretas no MVP.
[
  "EXPO_PUBLIC_GEMINI_API_KEY",
  "EXPO_PUBLIC_OPENROUTER_API_KEY",
  "EXPO_PUBLIC_COSMOS_TOKEN",
].forEach((key) => delete process.env[key]);

export default ({ config }) => ({
  ...config,
}); 
