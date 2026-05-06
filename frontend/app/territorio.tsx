import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- CONFIGURAÇÕES ISOMÉTRICAS DO HEXÁGONO ---
const HEX_SIZE = 40;
const SQUASH = 0.6; // Amassa o hexágono no eixo Y para dar a ilusão de profundidade (Isométrico)
const THICKNESS = 12; // A altura 3D do bloco (sombra)
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE * SQUASH;

// Equações para gerar as pontas
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
  return { x: x + HEX_WIDTH, y: y + HEX_HEIGHT + 20 }; // Offset para centralizar
};

// --- DADOS DAS EQUIPES (AGORA COM CORES DE SOMBRA PARA O 3D) ---
const EQUIPES = {
  NEUTRO: { id: 0, nome: 'Neutro', cor: '#444444', sombra: '#222222' },
  AZUL: { id: 1, nome: 'Equipe Azul', cor: '#4169E1', sombra: '#27408B' },
  VERMELHA: { id: 2, nome: 'Equipe Vermelha', cor: '#FF4444', sombra: '#8B0000' },
  VERDE: { id: 3, nome: 'Equipe Verde', cor: '#32CD32', sombra: '#006400' },
};

// --- GERAÇÃO DO MAPA COM BASES FIXAS ---
const gerarMapa = () => {
  const mapa = [];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      let equipe = EQUIPES.NEUTRO;
      let hp = 0;
      let isBase = false;

      // Definindo as 3 bases fixas (Torres)
      if (row === 2 && col === 2) { equipe = EQUIPES.AZUL; hp = 999; isBase = true; }
      else if (row === 2 && col === 6) { equipe = EQUIPES.VERMELHA; hp = 999; isBase = true; }
      else if (row === 9 && col === 4) { equipe = EQUIPES.VERDE; hp = 999; isBase = true; }
      else {
        // Gerando territórios aleatórios ao redor para simular um jogo em andamento
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
  
  // Usuário Atual
  const [meusPDs, setMeusPDs] = useState(250); 
  const [valorGasto, setValorGasto] = useState(10); // Controle de quanto investir
  const minhaEquipe = EQUIPES.AZUL; // Fixo para teste

  // Calcula a porcentagem do mapa dominado por cada equipe
  const stats = useMemo(() => {
    let counts = { [EQUIPES.AZUL.id]: 0, [EQUIPES.VERMELHA.id]: 0, [EQUIPES.VERDE.id]: 0, [EQUIPES.NEUTRO.id]: 0 };
    mapa.forEach(h => { counts[h.equipe.id]++; });
    const total = mapa.length;
    return {
      azul: (counts[EQUIPES.AZUL.id] / total) * 100,
      vermelha: (counts[EQUIPES.VERMELHA.id] / total) * 100,
      verde: (counts[EQUIPES.VERDE.id] / total) * 100,
      neutro: (counts[EQUIPES.NEUTRO.id] / total) * 100,
    };
  }, [mapa]);

  const handleHexClick = (hex: any) => {
    setHexSelecionado(hex);
    setValorGasto(10); // Reseta o slider falso ao trocar de hex
  };

  const mudarValorGasto = (delta: number) => {
    const novoValor = valorGasto + delta;
    if (novoValor > 0 && novoValor <= meusPDs) {
      setValorGasto(novoValor);
    }
  };

  const handleAcao = () => {
    if (!hexSelecionado || valorGasto <= 0 || meusPDs < valorGasto) return;
    if (hexSelecionado.isBase && hexSelecionado.equipe.id !== minhaEquipe.id) {
        alert("As torres base das equipes não podem ser destruídas diretamente!");
        return;
    }

    setMeusPDs(meusPDs - valorGasto);

    setMapa(mapaAtual => 
      mapaAtual.map(h => {
        if (h.id === hexSelecionado.id) {
          let novaEquipe = h.equipe;
          let novoHp = h.hp;

          if (h.equipe.id === minhaEquipe.id) {
            // Fortificar o próprio território
            novoHp += valorGasto;
          } else if (h.equipe.id === EQUIPES.NEUTRO.id) {
            // Conquistar vazio
            novaEquipe = minhaEquipe;
            novoHp = valorGasto;
          } else {
            // Atacar território inimigo (A LÓGICA CORRIGIDA)
            novoHp -= valorGasto;
            if (novoHp < 0) {
              // Dano foi maior que a defesa, sobrou dano para converter
              novaEquipe = minhaEquipe;
              novoHp = Math.abs(novoHp); 
            } else if (novoHp === 0) {
              // Empate exato, o território vira terra de ninguém
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

        {/* --- BARRA DINÂMICA DE DOMÍNIO --- */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressSegment, { width: `${stats.azul}%`, backgroundColor: EQUIPES.AZUL.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.vermelha}%`, backgroundColor: EQUIPES.VERMELHA.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.verde}%`, backgroundColor: EQUIPES.VERDE.cor }]} />
          <View style={[styles.progressSegment, { width: `${stats.neutro}%`, backgroundColor: EQUIPES.NEUTRO.cor }]} />
        </View>
        <Text style={styles.progressText}>Domínio: Azul {stats.azul.toFixed(0)}% | Verm. {stats.vermelha.toFixed(0)}% | Verde {stats.verde.toFixed(0)}%</Text>
      </View>

      {/* --- MAPA ISOMÉTRICO (SVG) --- */}
      <ScrollView horizontal={true} contentContainerStyle={{ flexGrow: 1 }} style={styles.mapContainer}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <Svg width={HEX_WIDTH * 9} height={HEX_HEIGHT * 13 + 50} style={{ backgroundColor: '#050015' }}>
            {mapa.map((hex) => {
              const { x, y } = getPixelCoords(hex.row, hex.col);
              const isSelected = hexSelecionado?.id === hex.id;
              
              return (
                <G key={hex.id} onPress={() => handleHexClick(hex)}>
                  {/* CAMADA 1: SOMBRA DO HEXÁGONO (EFEITO 3D DE ALTURA) */}
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
                  
                  {/* CAMADA 3: A TORRE (SE FOR BASE) */}
                  {hex.isBase && (
                    <G>
                       {/* Corpo da torre */}
                      <Polygon points={`${x-12},${y+5} ${x+12},${y+5} ${x+12},${y-20} ${x-12},${y-20}`} fill={hex.equipe.sombra} />
                      {/* Teto da torre */}
                      <Polygon points={`${x-16},${y-20} ${x},${y-35} ${x+16},${y-20}`} fill="#FFD700" />
                      {/* Ícone ou marca no meio */}
                      <SvgText x={x} y={y - 5} fill="#FFF" fontSize="10" fontWeight="bold" textAnchor="middle">⭐</SvgText>
                    </G>
                  )}

                  {/* CAMADA 4: TEXTO DO HP (Se não for base, para não poluir) */}
                  {!hex.isBase && hex.hp > 0 && (
                    <SvgText
                      x={x}
                      y={y + 5} // Centraliza devido ao squash
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
        </ScrollView>
      </ScrollView>

      {/* --- PAINEL DE AÇÃO INFERIOR --- */}
      <View style={styles.actionPanel}>
        {hexSelecionado ? (
          <View style={styles.panelContent}>
            
            {/* Info do Lado Esquerdo */}
            <View style={styles.hexInfo}>
              <Text style={styles.hexCoord}>Setor {hexSelecionado.row}-{hexSelecionado.col} {hexSelecionado.isBase ? '(BASE)' : ''}</Text>
              <Text style={[styles.hexEquipe, { color: hexSelecionado.equipe.cor }]}>
                {hexSelecionado.equipe.nome}
              </Text>
              <Text style={styles.hexHp}>
                Defesa: {hexSelecionado.isBase ? 'Infinita' : hexSelecionado.hp}
              </Text>
            </View>

            {/* Ações do Lado Direito */}
            {!hexSelecionado.isBase && (
                <View style={styles.actionControls}>
                    <Text style={styles.investTitle}>Investir PD:</Text>
                    
                    <View style={styles.amountSelector}>
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorGasto(-10)}>
                            <Ionicons name="remove" size={16} color="#FFF"/>
                        </TouchableOpacity>
                        
                        <Text style={styles.amountText}>{valorGasto}</Text>
                        
                        <TouchableOpacity style={styles.btnMath} onPress={() => mudarValorGasto(10)}>
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
                        Bases não podem ser atacadas. Expanda as fronteiras.
                    </Text>
                </View>
            )}

          </View>
        ) : (
          <View style={styles.panelEmpty}>
            <Ionicons name="map-outline" size={32} color="#555" />
            <Text style={styles.panelEmptyText}>Toque em um território (hexágono) no mapa de guerra para planejar sua estratégia.</Text>
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
  
  // Estilos da Barra de Progresso Global
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
  
  actionControls: { alignItems: 'flex-end', width: 140 },
  investTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  
  amountSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050015', borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 8 },
  btnMath: { padding: 5, paddingHorizontal: 10 },
  amountText: { color: '#FFD700', fontWeight: '900', fontSize: 16, width: 40, textAlign: 'center' },
  
  actionBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, elevation: 5, width: '100%', alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  
  panelEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  panelEmptyText: { color: '#888', marginTop: 10, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }
});
