import "dotenv/config";

export default {
    expo: {
        name: "meu-cesto",
        slug: "meu-cesto",
        scheme: "meucesto",
        extra: {
            geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
            cosmosToken: process.env.EXPO_PUBLIC_COSMOS_TOKEN,
        },
    },
}; 