import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- CONFIGURAÇÕES ISOMÉTRICAS ---
const HEX_SIZE = 40;
const SQUASH = 0.45; 
const THICKNESS = 18; 
const MAP_ROWS = 12;
const MAP_COLS = 8;
const INCOME_PER_HEX = 0.1; // Rendimento fracionado!

const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE * SQUASH;
const MAP_WIDTH = HEX_WIDTH * MAP_COLS + 100;
const MAP_HEIGHT = HEX_SIZE * 1.5 * MAP_ROWS * SQUASH + 100;

const getHexPoints = (cx: number, cy: number, size: number) => {
  let points = [];
  for (let i = 0; i < 6; i++) {
    let angle_deg = 60 * i - 30;
    let angle_rad = (Math.PI / 180) * angle_deg;
    points.push(`${cx + size * Math.cos(angle_rad)},${cy + size * Math.sin(angle_rad) * SQUASH}`);
  }
  return points.join(' ');
};

const getPixelCoords = (row: number, col: number) => {
  const x = HEX_WIDTH * (col + 0.5 * (row & 1));
  const y = (HEX_SIZE * 1.5 * row) * SQUASH;
  return { x: x + 60, y: y + 60 }; 
};

// --- DADOS DAS EQUIPES ---
const EQUIPES = {
  NEUTRO: { id: 0, nome: 'Neutro', cor: '#3a3a3a', sombra: '#1c1c1c' },
  AZUL: { id: 1, nome: 'Equipe Azul', cor: '#4169E1', sombra: '#27408B' },
  VERMELHA: { id: 2, nome: 'Equipe Vermelha', cor: '#FF4444', sombra: '#8B0000' },
  VERDE: { id: 3, nome: 'Equipe Verde', cor: '#32CD32', sombra: '#006400' },
};

const gerarMapa = () => {
  const mapa = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      let equipe = EQUIPES.NEUTRO;
      let hp = 0;
      let isBase = false;

      if (row === 2 && col === 2) { equipe = EQUIPES.AZUL; hp = 999; isBase = true; }
      else if (row === 2 && col === 6) { equipe = EQUIPES.VERMELHA; hp = 999; isBase = true; }
      else if (row === 9 && col === 4) { equipe = EQUIPES.VERDE; hp = 999; isBase = true; }
      else {
        const rand = Math.random();
        if (rand > 0.85) { equipe = EQUIPES.AZUL; hp = Math.floor(Math.random() * 40) + 10; }
        else if (rand > 0.70) { equipe = EQUIPES.VERMELHA; hp = Math.floor(Math.random() * 40) + 10; }
        else if (rand > 0.55) { equipe = EQUIPES.VERDE; hp = Math.floor(Math.random() * 40) + 10; }
      }
      mapa.push({ id: `${row}-${col}`, row, col, equipe, hp, isBase });
    }
  }
  return mapa;
};

const MAPA_INICIAL = gerarMapa();

export default function TerritorioMap() {
  const router = useRouter();
  const [mapa, setMapa] = useState(MAPA_INICIAL);
  const [hexSelecionado, setHexSelecionado] = useState<any>(null);
  
  const [meusPDs, setMeusPDs] = useState(250); 
  const [valorGastoText, setValorGastoText] = useState('10'); 
  const minhaEquipe = EQUIPES.AZUL; 

  // ESTADO DAS PARTÍCULAS FLUTUANTES (Efeito Visual de Renda)
  const [particulas, setParticulas] = useState<any[]>([]);
  const mapaRef = useRef(mapa);
  
  // Atualiza a ref do mapa sempre que ele muda para a animação ter os dados recentes
  useEffect(() => { mapaRef.current = mapa; }, [mapa]);

  // Lógica das Partículas Flutuantes
  useEffect(() => {
    // 1. Spawner: Cria novas partículas a cada 2 segundos nos territórios da equipe
    const spawnInterval = setInterval(() => {
      const territoriosDaEquipe = mapaRef.current.filter(h => h.equipe.id === minhaEquipe.id && !h.isBase);
      if (territoriosDaEquipe.length > 0) {
        const novasParticulas = [];
        // Escolhe até 3 territórios aleatórios por vez para soltar a moedinha
        const qtd = Math.min(3, territoriosDaEquipe.length);
        for(let i=0; i<qtd; i++) {
          const hex = territoriosDaEquipe[Math.floor(Math.random() * territoriosDaEquipe.length)];
          const {x, y} = getPixelCoords(hex.row, hex.col);
          novasParticulas.push({ 
            id: Math.random().toString(), 
            x, 
            y: y - 10, 
            text: `+${INCOME_PER_HEX}`, 
            opacity: 1 
          });
        }
        setParticulas(prev => [...prev, ...novasParticulas]);
      }
    }, 2000);

    // 2. Animador: Sobe a partícula e diminui a opacidade a cada 50ms
    const animInterval = setInterval(() => {
      setParticulas(prev => {
        let next = prev.map(p => ({ ...p, y: p.y - 1.5, opacity: p.opacity - 0.05 }));
        return next.filter(p => p.opacity > 0); // Remove as que sumiram
      });
    }, 50);

    return () => { clearInterval(spawnInterval); clearInterval(animInterval); };
  }, []);

  const stats = useMemo(() => {
    let counts = { [EQUIPES.AZUL.id]: 0, [EQUIPES.VERMELHA.id]: 0, [EQUIPES.VERDE.id]: 0 };
    let totalOcupado = 0;
    
    mapa.forEach(h => { 
        if (h.equipe.id !== EQUIPES.NEUTRO.id) {
            counts[h.equipe.id]++; 
            totalOcupado++;
        }
    });

    if (totalOcupado === 0) return { pctAzul: 0, pctVermelha: 0, pctVerde: 0, renda: 0 };

    return {
      pctAzul: (counts[EQUIPES.AZUL.id] / totalOcupado) * 100,
      pctVermelha: (counts[EQUIPES.VERMELHA.id] / totalOcupado) * 100,
      pctVerde: (counts[EQUIPES.VERDE.id] / totalOcupado) * 100,
      renda: counts[minhaEquipe.id] * INCOME_PER_HEX 
    };
  }, [mapa, minhaEquipe]);

  const handleHexClick = (hex: any) => {
    setHexSelecionado(hex);
  };

  const mudarValorBotao = (delta: number) => {
    let num = parseInt(valorGastoText || '0', 10);
    let novoValor = num + delta;
    if (novoValor < 1) novoValor = 1;
    if (novoValor > meusPDs) novoValor = meusPDs;
    setValorGastoText(String(novoValor));
  };

  const handleInputValor = (texto: string) => {
    let numTexto = texto.replace(/[^0-9]/g, '');
    let num = parseInt(numTexto, 10);
    if (isNaN(num)) { setValorGastoText(''); return; }
    if (num > meusPDs) num = meusPDs;
    setValorGastoText(String(num));
  };

  const handleAcao = () => {
    const gastoFinal = parseInt(valorGastoText || '0', 10);

    if (!hexSelecionado || gastoFinal <= 0) return;
    if (gastoFinal > meusPDs) { alert("PDs insuficientes!"); return; }
    if (hexSelecionado.isBase && hexSelecionado.equipe.id !== minhaEquipe.id) { alert("Bases inimigas são imunes!"); return; }

    setMeusPDs(meusPDs - gastoFinal);

    setMapa(mapaAtual => 
      mapaAtual.map(h => {
        if (h.id === hexSelecionado.id) {
          let novaEquipe = h.equipe;
          let novoHp = h.hp;

          if (h.equipe.id === minhaEquipe.id) {
            novoHp += gastoFinal;
          } else if (h.equipe.id === EQUIPES.NEUTRO.id) {
            novaEquipe = minhaEquipe;
            novoHp = gastoFinal;
          } else {
            novoHp -= gastoFinal;
            if (novoHp < 0) {
              novaEquipe = minhaEquipe;
              novoHp = Math.abs(novoHp); 
            } else if (novoHp === 0) {
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
            {/* Exibe o valor da renda diária/horária fracionada */}
            <Text style={styles.incomeText}>Sua Renda: +{stats.renda.toFixed(1)} PD/h</Text>
          </View>
          <View style={styles.pdBadge}>
            <Ionicons name="flash" size={16} color="#FFD700" />
            <Text style={styles.pdText}>{meusPDs} PD</Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressSegment, { width: `${stats.pctAzul}%`, backgroundColor: EQUIPES.AZUL.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.pctVermelha}%`, backgroundColor: EQUIPES.VERMELHA.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.pctVerde}%`, backgroundColor: EQUIPES.VERDE.cor }]} />
        </View>
        <Text style={styles.progressText}>
          Influência: Azul {stats.pctAzul.toFixed(1)}% | Verm. {stats.pctVermelha.toFixed(1)}% | Verde {stats.pctVerde.toFixed(1)}%
        </Text>
      </View>

      {/* --- MAPA ISOMÉTRICO --- */}
      <ScrollView horizontal={true} contentContainerStyle={{ flexGrow: 1 }} style={styles.mapContainer}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 10 }}>
          
          <View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
              {/* RENDER DOS HEXÁGONOS */}
              {mapa.map((hex) => {
                const { x, y } = getPixelCoords(hex.row, hex.col);
                const isSelected = hexSelecionado?.id === hex.id;
                
                return (
                  <G key={hex.id} onPress={() => handleHexClick(hex)}>
                    <Polygon points={getHexPoints(x, y + THICKNESS, HEX_SIZE - 1)} fill={hex.equipe.sombra} />
                    <Polygon points={getHexPoints(x, y, HEX_SIZE - 1)} fill={hex.equipe.cor} stroke={isSelected ? '#FFF' : 'rgba(255,255,255,0.1)'} strokeWidth={isSelected ? 3 : 1} />
                    
                    {hex.isBase && (
                      <G>
                        <Polygon points={`${x-14},${y+6} ${x+14},${y+6} ${x+14},${y-22} ${x-14},${y-22}`} fill={hex.equipe.sombra} />
                        <Polygon points={`${x-18},${y-22} ${x},${y-42} ${x+18},${y-22}`} fill="#FFD700" />
                        <SvgText x={x} y={y - 8} fill="#FFF" fontSize="12" fontWeight="bold" textAnchor="middle">⭐</SvgText>
                      </G>
                    )}

                    {!hex.isBase && hex.hp > 0 && (
                      <SvgText x={x} y={y + 5} fill="#FFF" fontSize="14" fontWeight="bold" textAnchor="middle">{hex.hp}</SvgText>
                    )}
                  </G>
                );
              })}

              {/* RENDER DAS PARTÍCULAS (No final do SVG para ficarem por cima de tudo) */}
              {particulas.map(p => (
                <SvgText 
                  key={p.id} 
                  x={p.x} 
                  y={p.y} 
                  fill="#32CD32" 
                  fontSize="16" 
                  fontWeight="900" 
                  textAnchor="middle" 
                  opacity={p.opacity}
                >
                  {p.text}
                </SvgText>
              ))}
            </Svg>
          </View>

        </ScrollView>
      </ScrollView>

      {/* --- PAINEL DE AÇÃO INFERIOR --- */}
      <View style={styles.actionPanel}>
        {hexSelecionado ? (
          <View style={styles.panelContent}>
            
            <View style={styles.hexInfo}>
              <Text style={styles.hexCoord}>Setor {hexSelecionado.row}-{hexSelecionado.col} {hexSelecionado.isBase ? '(BASE)' : ''}</Text>
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
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorBotao(-1)}>
                            <Ionicons name="remove" size={16} color="#FFF"/>
                        </TouchableOpacity>
                        
                        <TextInput
                            style={styles.amountInput}
                            value={valorGastoText}
                            onChangeText={handleInputValor}
                            keyboardType="numeric"
                            selectTextOnFocus={true}
                            maxLength={5}
                        />
                        
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorBotao(1)}>
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
                        Bases indestrutíveis. Domine os arredores!
                    </Text>
                </View>
            )}

          </View>
        ) : (
          <View style={styles.panelEmpty}>
            <Ionicons name="map-outline" size={32} color="#555" />
            <Text style={styles.panelEmptyText}>Selecione um território no mapa para planejar sua estratégia e aumentar sua renda de PDs.</Text>
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
  incomeText: { color: '#32CD32', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  
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
