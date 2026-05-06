import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- CONFIGURAÇÕES ISOMÉTRICAS E DA GRADE AXIAL ---
const HEX_SIZE = 38;
const SQUASH = 0.55; 
const THICKNESS = 14; 
const MAP_SIZE = 9; // Tamanho da Grade Diamante (9x9)

// A largura e altura total do mapa para o Web não distorcer o SVG
const MAP_WIDTH = HEX_SIZE * Math.sqrt(3) * (MAP_SIZE + MAP_SIZE / 2) + 150;
const MAP_HEIGHT = HEX_SIZE * 1.5 * MAP_SIZE * SQUASH + 150;

// Geometria da Ponta do Hexágono
const getHexPoints = (cx: number, cy: number, size: number) => {
  let points = [];
  for (let i = 0; i < 6; i++) {
    let angle_deg = 60 * i - 30;
    let angle_rad = (Math.PI / 180) * angle_deg;
    points.push(`${cx + size * Math.cos(angle_rad)},${cy + size * Math.sin(angle_rad) * SQUASH}`);
  }
  return points.join(' ');
};

// Conversão de Coordenadas AXIAIS para Pixel (Cria a Visão Diagonal!)
const getPixelCoords = (q: number, r: number) => {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 1.5 * r * SQUASH;
  return { x: x + 80, y: y + 80 }; // +80 é a margem interna do SVG
};

// --- DADOS DAS EQUIPES ---
const EQUIPES = {
  NEUTRO: { id: 0, nome: 'Neutro', cor: '#3a3a3a', sombra: '#1c1c1c' },
  AZUL: { id: 1, nome: 'Equipe Azul', cor: '#4169E1', sombra: '#27408B' },
  VERMELHA: { id: 2, nome: 'Equipe Vermelha', cor: '#FF4444', sombra: '#8B0000' },
  VERDE: { id: 3, nome: 'Equipe Verde', cor: '#32CD32', sombra: '#006400' },
};

// --- GERAÇÃO DO MAPA LOSANGO (DIAGONAL) ---
const gerarMapa = () => {
  const mapa = [];
  // Loop q e r gera o tabuleiro em forma de diamante natural
  for (let q = 0; q < MAP_SIZE; q++) {
    for (let r = 0; r < MAP_SIZE; r++) {
      let equipe = EQUIPES.NEUTRO;
      let hp = 0;
      let isBase = false;

      // Definindo as 3 bases fixas nos cantos do diamante
      if (q === 1 && r === 1) { equipe = EQUIPES.AZUL; hp = 999; isBase = true; }
      else if (q === 7 && r === 1) { equipe = EQUIPES.VERMELHA; hp = 999; isBase = true; }
      else if (q === 4 && r === 7) { equipe = EQUIPES.VERDE; hp = 999; isBase = true; }
      else {
        // Territórios para dar vida ao protótipo
        const rand = Math.random();
        if (rand > 0.88) { equipe = EQUIPES.AZUL; hp = Math.floor(Math.random() * 40) + 10; }
        else if (rand > 0.76) { equipe = EQUIPES.VERMELHA; hp = Math.floor(Math.random() * 40) + 10; }
        else if (rand > 0.64) { equipe = EQUIPES.VERDE; hp = Math.floor(Math.random() * 40) + 10; }
      }

      mapa.push({ id: `${q}-${r}`, q, r, equipe, hp, isBase });
    }
  }
  return mapa;
};

const MAPA_INICIAL = gerarMapa();

export default function TerritorioMap() {
  const router = useRouter();
  const [mapa, setMapa] = useState(MAPA_INICIAL);
  const [hexSelecionado, setHexSelecionado] = useState<any>(null);
  
  // Usuário Atual
  const [meusPDs, setMeusPDs] = useState(250); 
  const [valorGastoText, setValorGastoText] = useState('10'); // Input livre usa string
  const minhaEquipe = EQUIPES.AZUL; // Fixo para teste

  // A MATEMÁTICA CORRIGIDA DA BARRA DE PROGRESSO
  const stats = useMemo(() => {
    let counts = { [EQUIPES.AZUL.id]: 0, [EQUIPES.VERMELHA.id]: 0, [EQUIPES.VERDE.id]: 0 };
    
    // Conta apenas os territórios ocupados pelas equipes
    mapa.forEach(h => { 
        if (h.equipe.id !== EQUIPES.NEUTRO.id) {
            counts[h.equipe.id]++; 
        }
    });

    const totalOcupado = counts[EQUIPES.AZUL.id] + counts[EQUIPES.VERMELHA.id] + counts[EQUIPES.VERDE.id];

    // Se o mapa estiver todo cinza, previne erro de divisão por zero
    if (totalOcupado === 0) return { azul: 0, vermelha: 0, verde: 0 };

    return {
      azul: (counts[EQUIPES.AZUL.id] / totalOcupado) * 100,
      vermelha: (counts[EQUIPES.VERMELHA.id] / totalOcupado) * 100,
      verde: (counts[EQUIPES.VERDE.id] / totalOcupado) * 100,
    };
  }, [mapa]);

  const handleHexClick = (hex: any) => {
    setHexSelecionado(hex);
    setValorGastoText('10'); // Volta pro padrão ao trocar de hexágono
  };

  const mudarValorBotao = (delta: number) => {
    let num = parseInt(valorGastoText || '0', 10);
    let novoValor = num + delta;
    if (novoValor < 1) novoValor = 1;
    if (novoValor > meusPDs) novoValor = meusPDs;
    setValorGastoText(String(novoValor));
  };

  const handleInputValor = (texto: string) => {
    // Remove qualquer coisa que não seja número
    let numTexto = texto.replace(/[^0-9]/g, '');
    let num = parseInt(numTexto, 10);
    
    if (isNaN(num)) {
        setValorGastoText('');
        return;
    }
    
    if (num > meusPDs) num = meusPDs; // Limita ao dinheiro máximo que o jogador tem
    setValorGastoText(String(num));
  };

  const handleAcao = () => {
    const gastoFinal = parseInt(valorGastoText || '0', 10);

    if (!hexSelecionado || gastoFinal <= 0) {
        alert("Insira um valor válido de PDs.");
        return;
    }
    if (gastoFinal > meusPDs) {
        alert("PDs insuficientes!");
        return;
    }
    if (hexSelecionado.isBase && hexSelecionado.equipe.id !== minhaEquipe.id) {
        alert("As torres base inimigas são indestrutíveis no momento!");
        return;
    }

    setMeusPDs(meusPDs - gastoFinal);

    setMapa(mapaAtual => 
      mapaAtual.map(h => {
        if (h.id === hexSelecionado.id) {
          let novaEquipe = h.equipe;
          let novoHp = h.hp;

          if (h.equipe.id === minhaEquipe.id) {
            // Fortificar o próprio território
            novoHp += gastoFinal;
          } else if (h.equipe.id === EQUIPES.NEUTRO.id) {
            // Conquistar vazio
            novaEquipe = minhaEquipe;
            novoHp = gastoFinal;
          } else {
            // Combate: Subtrai o HP inimigo
            novoHp -= gastoFinal;
            
            if (novoHp < 0) {
              // Dano sobrou! O território agora é nosso com a vida que sobrou.
              novaEquipe = minhaEquipe;
              novoHp = Math.abs(novoHp); 
            } else if (novoHp === 0) {
              // Empate! Ninguém fica com o território.
              novaEquipe = EQUIPES.NEUTRO;
            }
          }

          const atualizado = { ...h, equipe: novaEquipe, hp: novoHp };
          setHexSelecionado(atualizado); 
          return atualizado;
        }
        return h;
      })
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Mapa de Guerra</Text>
          </View>
          <View style={styles.pdBadge}>
            <Ionicons name="flash" size={16} color="#FFD700" />
            <Text style={styles.pdText}>{meusPDs} PD</Text>
          </View>
        </View>

        {/* --- BARRA DINÂMICA DE DOMÍNIO GLOBAL --- */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressSegment, { width: `${stats.azul}%`, backgroundColor: EQUIPES.AZUL.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.vermelha}%`, backgroundColor: EQUIPES.VERMELHA.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.verde}%`, backgroundColor: EQUIPES.VERDE.cor }]} />
        </View>
        <Text style={styles.progressText}>
          Influência: Azul {stats.azul.toFixed(1)}% | Verm. {stats.vermelha.toFixed(1)}% | Verde {stats.verde.toFixed(1)}%
        </Text>
      </View>

      {/* --- MAPA ISOMÉTRICO DIAGONAL (SVG) --- */}
      {/* O ScrollView precisa de uma View com tamanho EXATO dentro dele para evitar a distorção na Web */}
      <ScrollView horizontal={true} contentContainerStyle={{ flexGrow: 1 }} style={styles.mapContainer}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          
          <View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
              {mapa.map((hex) => {
                const { x, y } = getPixelCoords(hex.q, hex.r);
                const isSelected = hexSelecionado?.id === hex.id;
                
                return (
                  <G key={hex.id} onPress={() => handleHexClick(hex)}>
                    {/* CAMADA 1: SOMBRA DO HEXÁGONO (ALTURA 3D) */}
                    <Polygon
                      points={getHexPoints(x, y + THICKNESS, HEX_SIZE - 1)}
                      fill={hex.equipe.sombra}
                    />
                    {/* CAMADA 2: TOPO DO HEXÁGONO */}
                    <Polygon
                      points={getHexPoints(x, y, HEX_SIZE - 1)}
                      fill={hex.equipe.cor}
                      stroke={isSelected ? '#FFF' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isSelected ? 3 : 1}
                    />
                    
                    {/* CAMADA 3: A TORRE (SE FOR BASE FIXA) */}
                    {hex.isBase && (
                      <G>
                        <Polygon points={`${x-12},${y+5} ${x+12},${y+5} ${x+12},${y-20} ${x-12},${y-20}`} fill={hex.equipe.sombra} />
                        <Polygon points={`${x-16},${y-20} ${x},${y-38} ${x+16},${y-20}`} fill="#FFD700" />
                        <SvgText x={x} y={y - 8} fill="#FFF" fontSize="11" fontWeight="bold" textAnchor="middle">⭐</SvgText>
                      </G>
                    )}

                    {/* CAMADA 4: TEXTO DO HP */}
                    {!hex.isBase && hex.hp > 0 && (
                      <SvgText
                        x={x}
                        y={y + 5} 
                        fill="#FFF"
                        fontSize="14"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {hex.hp}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </Svg>
          </View>

        </ScrollView>
      </ScrollView>

      {/* --- PAINEL DE AÇÃO INFERIOR --- */}
      <View style={styles.actionPanel}>
        {hexSelecionado ? (
          <View style={styles.panelContent}>
            
            <View style={styles.hexInfo}>
              <Text style={styles.hexCoord}>Setor {hexSelecionado.q}-{hexSelecionado.r} {hexSelecionado.isBase ? '(BASE)' : ''}</Text>
              <Text style={[styles.hexEquipe, { color: hexSelecionado.equipe.cor }]}>
                {hexSelecionado.equipe.nome}
              </Text>
              <Text style={styles.hexHp}>
                Defesa: {hexSelecionado.isBase ? 'Infinita' : hexSelecionado.hp}
              </Text>
            </View>

            {!hexSelecionado.isBase && (
                <View style={styles.actionControls}>
                    <Text style={styles.investTitle}>Investir PD:</Text>
                    
                    <View style={styles.amountSelector}>
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorBotao(-10)}>
                            <Ionicons name="remove" size={16} color="#FFF"/>
                        </TouchableOpacity>
                        
                        {/* INPUT LIVRE DE VALOR */}
                        <TextInput
                            style={styles.amountInput}
                            value={valorGastoText}
                            onChangeText={handleInputValor}
                            keyboardType="numeric"
                            selectTextOnFocus={true}
                            maxLength={5}
                        />
                        
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorBotao(10)}>
                            <Ionicons name="add" size={16} color="#FFF"/>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: hexSelecionado.equipe.id === minhaEquipe.id ? '#32CD32' : '#FF0055' }]} 
                        onPress={handleAcao}
                    >
                        <Text style={styles.actionBtnText}>
                            {hexSelecionado.equipe.id === minhaEquipe.id ? 'FORTIFICAR' : (hexSelecionado.equipe.id === EQUIPES.NEUTRO.id ? 'OCUPAR' : 'ATACAR')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {hexSelecionado.isBase && (
                <View style={styles.actionControls}>
                    <Text style={{color: '#888', fontStyle: 'italic', fontSize: 12, textAlign: 'right'}}>
                        Bases indestrutíveis. Expanda pelas bordas!
                    </Text>
                </View>
            )}

          </View>
        ) : (
          <View style={styles.panelEmpty}>
            <Ionicons name="map-outline" size={32} color="#555" />
            <Text style={styles.panelEmptyText}>Toque em um território no mapa de guerra para planejar sua estratégia.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050015' },
  header: { padding: 15, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backBtn: { marginRight: 15 },
  headerInfo: { flex: 1 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  
  pdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#FFD700' },
  pdText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 5 },
  
  progressBarContainer: { flexDirection: 'row', height: 8, width: '100%', backgroundColor: '#222', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  progressSegment: { height: '100%' },
  progressText: { color: '#888', fontSize: 10, textAlign: 'center', fontWeight: 'bold' },

  mapContainer: { flex: 1 },
  
  actionPanel: { height: 130, backgroundColor: '#1a1a2e', borderTopWidth: 2, borderTopColor: '#4169E1', padding: 15 },
  panelContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: '100%' },
  
  hexInfo: { flex: 1, justifyContent: 'center' },
  hexCoord: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  hexEquipe: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  hexHp: { color: '#FFF', fontSize: 14, marginTop: 5, fontWeight: '600' },
  
  actionControls: { alignItems: 'flex-end', width: 150 },
  investTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  
  amountSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050015', borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 8, width: '100%', justifyContent: 'space-between' },
  btnMath: { padding: 8 },
  amountInput: { color: '#FFD700', fontWeight: '900', fontSize: 16, minWidth: 40, textAlign: 'center', padding: 0 },
  
  actionBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, elevation: 5, width: '100%', alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  
  panelEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  panelEmptyText: { color: '#888', marginTop: 10, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }
});
