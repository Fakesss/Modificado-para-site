import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../services/api';
import { Reino, Construcao } from '../types';

interface Props {
  equipeId: string;
  equipeCor: string;
  equipeNome: string;
  isAdmin?: boolean;
}

interface CatalogoItem {
  nome: string;
  icone: string;
  cor: string;
  custoBase: number;
  custoUpgrade: number;
  nivelMax: number;
}

function getCatalogo(equipeCor: string): Record<string, CatalogoItem> {
  return {
    CASTELO: { nome: 'Castelo', icone: 'business', cor: equipeCor, custoBase: 0, custoUpgrade: 100, nivelMax: 10 },
    TORRE: { nome: 'Torre do Saber', icone: 'school', cor: '#4169E1', custoBase: 50, custoUpgrade: 40, nivelMax: 5 },
    MURALHA: { nome: 'Muralha', icone: 'shield', cor: '#90A4AE', custoBase: 60, custoUpgrade: 50, nivelMax: 5 },
    ESTANDARTE: { nome: 'Estandarte', icone: 'flag', cor: equipeCor, custoBase: 30, custoUpgrade: 25, nivelMax: 3 },
    DECORACAO: { nome: 'Jardim', icone: 'leaf', cor: '#32CD32', custoBase: 20, custoUpgrade: 15, nivelMax: 3 },
  };
}

const TIPOS_CONSTRUIVEIS = ['TORRE', 'MURALHA', 'ESTANDARTE', 'DECORACAO'];

export default function ReinoView({ equipeId, equipeCor, equipeNome, isAdmin = false }: Props) {
  const [reino, setReino] = useState<Reino | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState<number | null>(null);
  const [construcaoSelecionada, setConstrucaoSelecionada] = useState<Construcao | null>(null);

  const catalogo = getCatalogo(equipeCor);

  const loadReino = useCallback(async () => {
    const data = await api.getReino(equipeId);
    setReino(data);
  }, [equipeId]);

  useEffect(() => {
    setLoading(true);
    loadReino().finally(() => setLoading(false));
  }, [loadReino]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReino();
    setRefreshing(false);
  };

  const fecharModais = () => {
    setSlotSelecionado(null);
    setConstrucaoSelecionada(null);
  };

  const handleConstruir = async (tipo: string) => {
    if (slotSelecionado === null) return;
    setProcessando(true);
    try {
      const atualizado = await api.construirReino(equipeId, tipo, slotSelecionado);
      setReino(atualizado);
      fecharModais();
    } catch (error: any) {
      Alert.alert('Não foi possível construir', error.response?.data?.detail || 'Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const handleUpgrade = async () => {
    if (!construcaoSelecionada) return;
    setProcessando(true);
    try {
      const atualizado = await api.upgradeReino(equipeId, construcaoSelecionada.id);
      setReino(atualizado);
      fecharModais();
    } catch (error: any) {
      Alert.alert('Não foi possível evoluir', error.response?.data?.detail || 'Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!reino) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="alert-circle-outline" size={48} color="#666" />
        <Text style={styles.emptyText}>Não foi possível carregar o reino</Text>
      </View>
    );
  }

  const slots = Array.from({ length: reino.slotsDisponiveis }, (_, i) => i);
  const castelo = reino.construcoes.find((c) => c.tipo === 'CASTELO');
  const construcaoAtiva = construcaoSelecionada
    ? reino.construcoes.find((c) => c.id === construcaoSelecionada.id) || construcaoSelecionada
    : null;
  const itemAtivo = construcaoAtiva ? catalogo[construcaoAtiva.tipo] : null;
  const nivelMaxAtivo = !!(itemAtivo && construcaoAtiva && construcaoAtiva.nivel >= itemAtivo.nivelMax);
  const custoUpgradeAtivo = itemAtivo && construcaoAtiva ? itemAtivo.custoUpgrade * construcaoAtiva.nivel : 0;
  const semMoedasUpgrade = !isAdmin && custoUpgradeAtivo > reino.moedas;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.teamBadge, { backgroundColor: equipeCor }]}>
          <Ionicons name="business" size={24} color="#000" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Reino de {equipeNome}</Text>
          <Text style={styles.subtitle}>
            Castelo nível {castelo?.nivel || 1} • {reino.construcoes.length} construções
          </Text>
        </View>
        <View style={styles.moedasBox}>
          <Ionicons name="cash" size={18} color="#FFD700" />
          <Text style={styles.moedasText}>{isAdmin ? '∞' : reino.moedas}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        <Text style={styles.sectionTitle}>Terrenos</Text>
        <View style={styles.grid}>
          {slots.map((slot) => {
            const construcao = reino.construcoes.find((c) => c.slot === slot);
            if (construcao) {
              const item = catalogo[construcao.tipo];
              const noMax = construcao.nivel >= item.nivelMax;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.plot, { borderColor: item.cor }]}
                  onPress={() => setConstrucaoSelecionada(construcao)}
                >
                  <Ionicons name={item.icone as any} size={26} color={item.cor} />
                  <Text style={styles.plotNome} numberOfLines={1}>{item.nome}</Text>
                  <View style={[styles.nivelBadge, noMax && styles.nivelBadgeMax]}>
                    <Text style={styles.nivelText}>{noMax ? 'MÁX' : `Nv. ${construcao.nivel}`}</Text>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={slot} style={styles.plotVazio} onPress={() => setSlotSelecionado(slot)}>
                <Ionicons name="add" size={28} color="#555" />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* MODAL: CONSTRUIR NOVO */}
      <Modal visible={slotSelecionado !== null} transparent animationType="fade" onRequestClose={fecharModais}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>O que construir?</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {TIPOS_CONSTRUIVEIS.map((tipo) => {
                const item = catalogo[tipo];
                const semMoedas = !isAdmin && reino.moedas < item.custoBase;
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.opcaoItem, semMoedas && styles.opcaoDesabilitada]}
                    onPress={() => handleConstruir(tipo)}
                    disabled={processando || semMoedas}
                  >
                    <View style={[styles.opcaoIcone, { backgroundColor: item.cor }]}>
                      <Ionicons name={item.icone as any} size={20} color="#000" />
                    </View>
                    <View style={styles.opcaoInfo}>
                      <Text style={styles.opcaoNome}>{item.nome}</Text>
                      <Text style={styles.opcaoCusto}>
                        {item.custoBase} moedas{semMoedas ? ' (insuficiente)' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.cancelarBtn} onPress={fecharModais} disabled={processando}>
              <Text style={styles.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: EVOLUIR EXISTENTE */}
      <Modal visible={construcaoAtiva !== null} transparent animationType="fade" onRequestClose={fecharModais}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            {construcaoAtiva && itemAtivo && (
              <>
                <View style={[styles.opcaoIcone, styles.modalIconeCentral, { backgroundColor: itemAtivo.cor }]}>
                  <Ionicons name={itemAtivo.icone as any} size={28} color="#000" />
                </View>
                <Text style={[styles.modalTitle, styles.modalTitleCentro]}>{itemAtivo.nome}</Text>
                <Text style={styles.modalSubtitle}>Nível atual: {construcaoAtiva.nivel}</Text>

                {nivelMaxAtivo ? (
                  <Text style={styles.maxText}>Nível máximo atingido!</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.evoluirBtn, semMoedasUpgrade && styles.opcaoDesabilitada]}
                    onPress={handleUpgrade}
                    disabled={processando || semMoedasUpgrade}
                  >
                    {processando ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.evoluirText}>
                        Evoluir para Nv. {construcaoAtiva.nivel + 1} ({custoUpgradeAtivo} moedas)
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={styles.cancelarBtn} onPress={fecharModais} disabled={processando}>
              <Text style={styles.cancelarText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  moedasBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  moedasText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  plot: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 4,
  },
  plotVazio: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#16161f',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotNome: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  nivelBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  nivelBadgeMax: {
    backgroundColor: '#FFD700',
  },
  nivelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalTitleCentro: {
    textAlign: 'center',
    marginBottom: 4,
  },
  modalIconeCentral: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  opcaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  opcaoDesabilitada: {
    opacity: 0.4,
  },
  opcaoIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoInfo: {
    flex: 1,
  },
  opcaoNome: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  opcaoCusto: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 2,
  },
  evoluirBtn: {
    backgroundColor: '#32CD32',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  evoluirText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  maxText: {
    color: '#FFD700',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cancelarBtn: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelarText: {
    color: '#FF4444',
    fontWeight: '600',
  },
});
