import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } fro 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. IMPORTAMOS O 'G' AQUI
import Svg, { Polygon, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- CONFIGURAÇÕES DO HEXÁGONO ---
const HEX_SIZE = 35;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;

const getHexPoints = (cx: number, cy: number, size: number) => {
  let points = [];
  for (let i = 0; i < 6; i++) {
    let angle_deg = 60 * i - 30;
    let angle_rad = (Math.PI / 180) * angle_deg;
    points.push(`${cx + size * Math.cos(angle_rad)},${cy + size * Math.sin(angle_rad)}`);
  }
  return points.join(' ');
};

const getPixelCoords = (row: number, col: number) => {
  const x = HEX_WIDTH * (col + 0.5 * (row & 1));
  const y = HEX_SIZE * 1.5 * row;
  return { x: x + HEX_WIDTH, y: y + HEX_HEIGHT }; 
};

// --- DADOS FALSOS (MOCK) PARA O TESTE VISUAL ---
const EQUIPES = {
  NEUTRO: { id: 0, nome: 'Neutro', cor: '#333333' },
  AZUL: { id: 1, nome: 'Equipe Azul', cor: '#4169E1' },
  VERMELHA: { id: 2, nome: 'Equipe Vermelha', cor: '#FF4444' },
  VERDE: { id: 3, nome: 'Equipe Verde', cor: '#32CD32' },
};

const gerarMapaFalso = () => {
  const mapa = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      let equipe = EQUIPES.NEUTRO;
      let hp = 0;

      const rand = Math.random();
      if (rand > 0.8) { equipe = EQUIPES.AZUL; hp = Math.floor(Math.random() * 50) + 10; }
      else if (rand > 0.6) { equipe = EQUIPES.VERMELHA; hp = Math.floor(Math.random() * 50) + 10; }
      else if (rand > 0.5) { equipe = EQUIPES.VERDE; hp = Math.floor(Math.random() * 50) + 10; }

      mapa.push({ id: `${row}-${col}`, row, col, equipe, hp });
    }
  }
  return mapa;
};

const MAPA_INICIAL = gerarMapaFalso();

export default function TerritorioMap() {
  const router = useRouter();
  const [mapa, setMapa] = useState(MAPA_INICIAL);
  const [hexSelecionado, setHexSelecionado] = useState<any>(null);
  
  const [meusPDs, setMeusPDs] = useState(150); 
  const minhaEquipe = EQUIPES.AZUL;

  const handleHexClick = (hex: any) => {
    setHexSelecionado(hex);
  };

  const handleAcao = () => {
    if (!hexSelecionado) return;

    const custo = 20; 
    if (meusPDs < custo) {
      alert("Pontos de Domínio (PD) insuficientes!");
      return;
    }

    setMeusPDs(meusPDs - custo);

    setMapa(mapaAtual => 
      mapaAtual.map(h => {
        if (h.id === hexSelecionado.id) {
          const novoHp = h.equipe.id === minhaEquipe.id ? h.hp + custo : custo;
          const atualizado = { ...h, equipe: minhaEquipe, hp: novoHp };
          setHexSelecionado(atualizado); 
          return atualizado;
        }
        return h;
      })
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Guerra de Territórios</Text>
          <Text style={styles.subtitle}>Expanda a fronteira da sua equipe</Text>
        </View>
        <View style={styles.pdBadge}>
          <Ionicons name="flash" size={16} color="#FFD700" />
          <Text style={styles.pdText}>{meusPDs} PD</Text>
        </View>
      </View>

      <ScrollView horizontal={true} contentContainerStyle={{ flexGrow: 1 }} style={styles.mapContainer}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <Svg width={HEX_WIDTH * 8} height={HEX_HEIGHT * 7} style={{ backgroundColor: '#050015' }}>
            {mapa.map((hex) => {
              const { x, y } = getPixelCoords(hex.row, hex.col);
              const isSelected = hexSelecionado?.id === hex.id;
              
              // 2. TROCAMOS React.Fragment POR G
              return (
                <G key={hex.id}>
                  <Polygon
                    points={getHexPoints(x, y, HEX_SIZE - 2)}
                    fill={hex.equipe.cor}
                    stroke={isSelected ? '#FFF' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isSelected ? 3 : 1}
                    onPress={() => handleHexClick(hex)}
                  />
                  {hex.hp > 0 && (
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
        </ScrollView>
      </ScrollView>

      <View style={styles.actionPanel}>
        {hexSelecionado ? (
          <View style={styles.panelContent}>
            <View style={styles.hexInfo}>
              <Text style={styles.hexCoord}>Setor {hexSelecionado.row}-{hexSelecionado.col}</Text>
              <Text style={[styles.hexEquipe, { color: hexSelecionado.equipe.cor }]}>
                {hexSelecionado.equipe.nome}
              </Text>
              <Text style={styles.hexHp}>HP Atual: {hexSelecionado.hp}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: hexSelecionado.equipe.id === minhaEquipe.id ? '#32CD32' : '#FF0055' }]} 
              onPress={handleAcao}
            >
              <Text style={styles.actionBtnText}>
                {hexSelecionado.equipe.id === minhaEquipe.id ? 'FORTIFICAR' : 'CONQUISTAR'} (-20 PD)
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panelEmpty}>
            <Ionicons name="map-outline" size={32} color="#555" />
            <Text style={styles.panelEmptyText}>Toque em um hexágono no mapa para inspecionar o território.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn: { marginRight: 15 },
  headerInfo: { flex: 1 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#888', fontSize: 12 },
  pdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#FFD700' },
  pdText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 5 },
  mapContainer: { flex: 1 },
  actionPanel: { height: 120, backgroundColor: '#1a1a2e', borderTopWidth: 2, borderTopColor: '#4169E1', padding: 15 },
  panelContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: '100%' },
  hexInfo: { flex: 1 },
  hexCoord: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  hexEquipe: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  hexHp: { color: '#FFF', fontSize: 14, marginTop: 5 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 15, borderRadius: 10, elevation: 5 },
  actionBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  panelEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  panelEmptyText: { color: '#888', marginTop: 10, fontSize: 14, textAlign: 'center' }
});
