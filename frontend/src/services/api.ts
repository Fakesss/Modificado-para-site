// ... (código anterior)

// ================== CONFIGURAÇÕES GERAIS DO JOGO ==================
const CONFIG_KEY = '@config_jogo_v1';

export const salvarConfiguracaoJogo = async (vidas: number) => {
  try {
    const config = { vidasPadrao: vidas };
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) { return false; }
};

export const getConfiguracaoJogo = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(CONFIG_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : { vidasPadrao: 5 }; // Padrão 5 se não tiver nada salvo
  } catch(e) {
    return { vidasPadrao: 5 };
  }
};

export default api; //
