import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { PontoSerie } from '../types';

// Gráfico de linha simples e leve (react-native-svg, funciona em Expo Go e web).
// Usado na tela "Minha Evolução" do aluno e no relatório individual do professor.
// Os pontos vêm SEMPRE do histórico real de respostas — nunca de dados simulados.

interface Props {
  titulo: string;
  pontos: PontoSerie[];
  cor: string;
  unidade?: string;      // ex.: "%", "s"
  maxYFixo?: number;     // ex.: 100 para percentuais
}

const LARGURA = 320;
const ALTURA = 150;
const MARGEM = { esquerda: 34, direita: 10, topo: 12, baixo: 22 };

export default function GraficoLinha({ titulo, pontos, cor, unidade = '', maxYFixo }: Props) {
  if (!pontos || pontos.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={styles.vazioBox}>
          <Text style={styles.vazioTexto}>
            {pontos && pontos.length === 1
              ? 'Complete mais um treino para ver a linha do seu progresso!'
              : 'Complete seus primeiros treinos para ver seu gráfico aqui!'}
          </Text>
        </View>
      </View>
    );
  }

  const valores = pontos.map(p => p.valor);
  const maxY = maxYFixo ?? Math.max(...valores, 1);
  const minY = 0;

  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;

  const coordX = (i: number) => MARGEM.esquerda + (i / (pontos.length - 1)) * larguraUtil;
  const coordY = (v: number) => MARGEM.topo + alturaUtil - ((v - minY) / (maxY - minY || 1)) * alturaUtil;

  const linhaPontos = pontos.map((p, i) => `${coordX(i)},${coordY(p.valor)}`).join(' ');

  const formatarData = (d: string) => {
    const partes = d.split('-'); // "2026-07-04"
    return partes.length === 3 ? `${partes[2]}/${partes[1]}` : d;
  };

  const ultimo = pontos[pontos.length - 1];

  return (
    <View style={styles.card}>
      <View style={styles.tituloRow}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={[styles.valorAtual, { color: cor }]}>
          {ultimo.valor}{unidade}
        </Text>
      </View>
      <Svg width="100%" height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
        {/* Linhas-guia horizontais (0%, 50%, 100% do eixo) */}
        {[0, 0.5, 1].map(frac => {
          const y = MARGEM.topo + alturaUtil - frac * alturaUtil;
          const valor = Math.round(minY + frac * (maxY - minY));
          return (
            <React.Fragment key={frac}>
              <Line x1={MARGEM.esquerda} y1={y} x2={LARGURA - MARGEM.direita} y2={y} stroke="#26264a" strokeWidth={1} />
              <SvgText x={MARGEM.esquerda - 6} y={y + 4} fill="#666" fontSize="9" textAnchor="end">
                {valor}{unidade}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Polyline points={linhaPontos} fill="none" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {pontos.map((p, i) => (
          <Circle key={i} cx={coordX(i)} cy={coordY(p.valor)} r={3.5} fill={cor} />
        ))}

        {/* Rótulos de data: primeiro e último ponto */}
        <SvgText x={coordX(0)} y={ALTURA - 6} fill="#888" fontSize="9" textAnchor="start">
          {formatarData(pontos[0].data)}
        </SvgText>
        <SvgText x={coordX(pontos.length - 1)} y={ALTURA - 6} fill="#888" fontSize="9" textAnchor="end">
          {formatarData(ultimo.data)}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#14142e', borderRadius: 14, borderWidth: 1, borderColor: '#26264a', padding: 14, marginBottom: 14 },
  tituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titulo: { color: '#CCD', fontSize: 13, fontWeight: '700' },
  valorAtual: { fontSize: 16, fontWeight: '900' },
  vazioBox: { height: 90, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  vazioTexto: { color: '#667', fontSize: 12, textAlign: 'center' },
});
