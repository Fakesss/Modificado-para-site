import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import * as api from '../src/services/api';
import { HangarPerfil, ConfiguracaoJogo } from '../src/types';

const initialWidth = Dimensions.get('window').width;
const initialHeight = Dimensions.get('window').height * 0.75;

const isMobileWeb = Platform.OS === 'web' && initialWidth < 768;
const BASE_ZOOM = (Platform.OS !== 'web' || isMobileWeb) ? 0.5 : 1;

// >>> DIAL DO RITMO FRENÉTICO DO JOGO <<<
// O tick do loop principal é fixo em 30ms (ver `setInterval(gameTick, 30)`, dentro de iniciarJogo).
// Este multiplicador afeta o movimento do jogador e de inimigos/tiros inimigos/símbolos de fundo
// (é aplicado em `movSpeed` e em `speedMult`, dentro de gameTick). Valor 1 = ritmo atual, sem
// nenhuma mudança de velocidade — é só o ponto único pra acelerar/desacelerar o jogo no futuro.
const VELOCIDADE_BASE_MULT = 1;

const BotaoRetro = ({ valor, isPressed, onPressWeb }: { valor: string, isPressed: boolean, onPressWeb: (v: string) => void }) => {
  const isWeb = Platform.OS === 'web';
  let customStyle = styles.teclaRetro;
  if (valor === 'apagar') customStyle = { ...styles.teclaRetro, ...styles.teclaApagar } as any;
  if (valor === 'enviar') customStyle = { ...styles.teclaRetro, ...styles.teclaEnviar } as any;

  return (
    <View 
      style={[customStyle, isPressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]} 
      {...(isWeb ? {
        onPointerDown: (e: any) => {
            e.preventDefault();
            onPressWeb(valor);
        }
      } : {})}
    >
      {valor === 'apagar' && <Ionicons name="backspace" size={22} color="#FFF"/>}
      {valor === 'enviar' && <Ionicons name="flash" size={22} color="#FFF"/>}
      {valor !== 'apagar' && valor !== 'enviar' && <Text style={styles.teclaRetroText}>{valor}</Text>}
    </View>
  );
};

export default function MathBlaster() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [jogoAtivo, setJogoAtivo] = useState(false);
  const [frames, setFrames] = useState(0); 
  const [resposta, setResposta] = useState('');
  const [pontosEquipeGanhos, setPontosEquipeGanhos] = useState<{ pontosGanhos: number; limiteAtingido: boolean } | null>(null);
  
  const [hallDaFama, setHallDaFama] = useState<any[]>([]);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const gameOverFired = useRef(false);
  
  // Limite Diário de Spawn do Inimigo Raro
  const dailySpawnsRef = useRef(0);

  // Loadout do Hangar (arma inicial, upgrades, cor) e configuração global do admin (drop rate,
  // powerups habilitados, chance de spawn por inimigo) — carregados uma vez e aplicados em iniciarJogo
  const hangarPerfilRef = useRef<HangarPerfil | null>(null);
  const configJogoRef = useRef<ConfiguracaoJogo | null>(null);

  const [canvasSize, setCanvasSize] = useState({ width: initialWidth, height: initialHeight });
  const canvasSizeRef = useRef({ width: initialWidth, height: initialHeight });
  
  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const triggeredTouchesRef = useRef<Set<string>>(new Set());
  const tecladoLayoutRef = useRef({ width: 350 }); 
  const kbTouchIds = useRef<Set<string>>(new Set());

  const respostaRef = useRef('');
  useEffect(() => { respostaRef.current = resposta; }, [resposta]);
  
  const layoutRef = useRef({ width: initialWidth, height: initialHeight });

  const gs = useRef({
    currentZoom: BASE_ZOOM,
    keys: { up: false, down: false, left: false, right: false },
    dynamicVisualsUnlocked: false, // Cheat code 40028922: fundo dinâmico + alerta de chefe (desativado por padrão)
    player: {
      x: initialWidth / 2, y: initialHeight - 60, hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false,
      fireMode: 'PROJETIL' as 'PROJETIL' | 'CONTINUO', beamIntensity: 0,
      // Loadout carregado do Hangar (ver hangarPerfilRef, aplicado em iniciarJogo)
      armaInicial: 'PADRAO' as 'PADRAO' | 'ELETRICA' | 'PLASMA' | 'LEQUE',
      cdr: 0, speedBonus: 0, corNave: '#00FFFF', secretSkillUnlocked: false, secretSkillUsedThisGame: false,
      weapons: {
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 },
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 70, damageMult: 6 },
        chain: { active: false, level: 1, baseCooldown: 9000, lastFire: 0, damageMult: 2, bounces: 3, range: 140 },
        mine: { active: false, level: 1, baseCooldown: 11000, lastFire: 0, damageMult: 4, fuse: 1500, blastRadius: 70, count: 1 },
        electric: { active: false, level: 1, baseCooldown: 4000, lastFire: 0, damageMult: 0.6, bounces: 3, range: 150 }
      }
    },
    lasers: [] as any[], specialLasers: [] as any[], mathShots: [] as any[], pulses: [] as any[], floatingTexts: [] as any[],
    chainBolts: [] as any[], mines: [] as any[], bgSymbols: [] as any[],
    enemies: [] as any[], enemyLasers: [] as any[], powerups: [] as any[], particles: [] as any[],
    boss: { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0, fase: 1, gameState: 'WAVES', stateTimer: 0, lastPowerupSpawn: 0, movementTouchId: null as string | null, lastTouchX: 0, lastTouchY: 0,
    waveFlavor: 'CLASSICA' as string,
    timeAlive: 0, flawlessBossesCount: 0, tookDamageThisBoss: false, timeFreezeTimer: 0, forceShieldHits: 0, xRayTimer: 0,
    overdriveTimer: 0, overdriveStoredDamage: 0, overdriveStoredFireRate: 0, // Habilidade secreta do Hangar (ver hangarCodigoSecreto)
    drones: {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    }
  }).current;

  const loopRef = useRef<any>(null);

  // Controle de Inimigos Raros no Dia
  useEffect(() => {
    const loadDailyLimit = async () => {
       const today = new Date().toLocaleDateString();
       const storedDate = await AsyncStorage.getItem('rareSpawnDate');
       if (storedDate === today) {
           const count = await AsyncStorage.getItem('rareSpawnCount');
           dailySpawnsRef.current = count ? parseInt(count) : 0;
       } else {
           await AsyncStorage.setItem('rareSpawnDate', today);
           await AsyncStorage.setItem('rareSpawnCount', '0');
           dailySpawnsRef.current = 0;
       }
    };
    loadDailyLimit();

    api.getHangarPerfil().then((p: any) => { if (p) hangarPerfilRef.current = p; });
    api.getConfiguracaoJogo('math_blaster').then((c: any) => { if (c) configJogoRef.current = c; });

    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, []);

  const carregarHallDaFama = async () => {
    try {
      if (typeof (api as any).getRankingMathBlaster === 'function') {
          const data = await (api as any).getRankingMathBlaster();
          setHallDaFama(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Erro ao carregar ranking", e);
    }
  };

  useEffect(() => {
    const initWebViewAuth = async () => {
        if (Platform.OS === 'web') {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const token = urlParams.get('token');
                const uid = urlParams.get('userId');
                
                if (token) {
                    await AsyncStorage.setItem('token', token);
                    if ((api as any).defaults) {
                        (api as any).defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    }
                }
                if (uid) setGuestUserId(uid);
            } catch(e) {}
        }
        if (tela === 'menu') {
            carregarHallDaFama();
        }
    };
    initWebViewAuth();
  }, [tela]);

  const goBack = () => {
      try {
          if (Platform.OS === 'web' && (window as any).ReactNativeWebView) {
              (window as any).ReactNativeWebView.postMessage('GO_BACK');
              return;
          }
      } catch (e) {}
      router.back();
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    // QUANTIDADE DE PARTÍCULAS DRASTICAMENTE REDUZIDA PARA EVITAR TRAVAMENTO DO NAVEGADOR
    for(let i=0; i<qtd; i++) {
      gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color });
    }
  };

  const acharInimigoMaisProximoDentroDoRaio = (x: number, y: number, raio: number, excluir: Set<string>) => {
    let closest: any = null;
    let minDist = raio * raio;
    gs.enemies.forEach((e: any) => {
      if (e.hp > 0 && !e.mathRequired && !excluir.has(e.id)) {
        const d = Math.pow(e.x - x, 2) + Math.pow(e.y - y, 2);
        if (d < minDist) { minDist = d; closest = e; }
      }
    });
    return closest;
  };

  // Powerups adaptativos: cadência e tiro triplo só valem pra arma primária por projétil (PROJETIL).
  // Preparado para uma futura arma primária de tiro contínuo (ex.: feixe laser) via player.fireMode.
  const POWERUPS_EXCLUSIVOS_PROJETIL = new Set(['FIRE_RATE', 'TRIPLE_SHOT']);

  const converterBuffsDeModo = (modoNovo: 'PROJETIL' | 'CONTINUO') => {
    const jogador = gs.player;
    if (jogador.fireMode === modoNovo) return;
    if (modoNovo === 'CONTINUO') {
      const bonusCadenciaAcumulado = Math.max(0, 300 - jogador.fireRate);
      jogador.beamIntensity += bonusCadenciaAcumulado / 20 + (jogador.tripleShot ? 3 : 0);
      jogador.fireRate = 300;
      jogador.tripleShot = false;
    } else {
      jogador.fireRate = Math.max(100, 300 - jogador.beamIntensity * 20);
      jogador.beamIntensity = 0;
    }
    jogador.fireMode = modoNovo;
  };

  // Reduz um tipo granular de powerup (ex.: "MISSILE_COOLDOWN") à sua família (ex.: "MISSILE"),
  // que é o nível de granularidade usado pelo Painel de Partida do admin pra habilitar/desabilitar.
  const familiaDoPowerup = (tipo: string): string => {
    const semSufixo = ['DAMAGE', 'FIRE_RATE', 'TRIPLE_SHOT', 'HULL_UPGRADE', 'FORCE_SHIELD', 'TIME_FREEZE', 'X_RAY'];
    if (semSufixo.includes(tipo)) return tipo;
    for (const familia of ['MISSILE', 'LASER', 'PULSAR', 'CHAIN', 'ELECTRIC', 'MINE', 'DRONE']) {
      if (tipo.startsWith(familia)) return familia;
    }
    return tipo;
  };

  // Painel de Partida do admin: 100 = frequência padrão, 0 = nunca aparece, 200 = o dobro da frequência
  const chanceSpawn = (tipo: string): number => configJogoRef.current?.spawnChancePorInimigo?.[tipo] ?? 100;
  const intervaloAjustado = (intervaloBase: number, tipo: string): number => {
    const chance = chanceSpawn(tipo);
    if (chance <= 0) return Infinity;
    return Math.max(10, Math.round(intervaloBase * (100 / chance)));
  };

  // Símbolos matemáticos flutuando no fundo (decorativo, sem colisão)
  const novoSimboloFundo = (gw: number, gh: number, yFixo?: number) => {
    const simbolos = ['+', '-', '×', '÷', '=', 'π', '√', '∞', '%'];
    const cores = ['#00FFFF', '#FF00FF', '#7FFF00', '#FFD700'];
    return {
      id: Math.random().toString(),
      x: Math.random() * gw,
      y: yFixo !== undefined ? yFixo : Math.random() * gh,
      vy: 0.2 + Math.random() * 0.5,
      char: simbolos[Math.floor(Math.random() * simbolos.length)],
      size: 16 + Math.random() * 22,
      opacity: 0.08 + Math.random() * 0.14,
      color: cores[Math.floor(Math.random() * cores.length)],
    };
  };

  const lidarComTeclado = useCallback((valor: string) => {
    if (!jogoAtivo) return;
    
    if (valor === 'apagar') {
      setResposta(r => r.slice(0, -1));
    } else if (valor === 'enviar') {
      
      // CHEAT CODE 1: INVOCAR INIMIGO RARO (Usa 1 limite diário)
      if (respostaRef.current === '314159') {
        if (dailySpawnsRef.current >= 5) {
            gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `LIMITE DIÁRIO ATINGIDO!`, color: '#FF4444', life: 90 });
            setResposta(''); return;
        }
        const gw = layoutRef.current.width;
        const eq = gerarEquacao(10, getRespostasAtivas());
        gs.enemies.push({ id: Math.random().toString(), type: 'RARE_ENEMY', x: gw / 2, y: -50, targetY: 100, hp: 9999, mathRequired: true, solvesNeeded: 1, solvesDone: 0, txt: "👑 " + eq.txt, res: eq.res, vy: 0.5, evasive: false });
        
        dailySpawnsRef.current += 1;
        AsyncStorage.setItem('rareSpawnCount', dailySpawnsRef.current.toString()).catch(()=>{});
        setResposta(''); return;
      }

      // CHEAT CODE 2: DRONE
      if (respostaRef.current === '3141592') {
        gs.drones.advanced.active = true; gs.drones.advanced.baseCooldown = 500;
        gs.score += 500;
        criarParticulas(gs.player.x, gs.player.y, '#FFD700', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE!`, color: '#FFD700', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 3: INVOCAR BLINDADO PESADO (SHIELD_TANK)
      if (respostaRef.current === '444000') {
        const gw = layoutRef.current.width;
        gs.enemies.push({ id: Math.random().toString(), type: 'SHIELD_TANK', x: gw / 2, y: -40, vy: 0.8 + gs.fase * 0.15, hp: 15 + gs.fase * 4, armorReduction: 0.5 });
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! BLINDADO`, color: '#90A4AE', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 4: INVOCAR ENXAME (SWARMLING)
      if (respostaRef.current === '777000') {
        const gw = layoutRef.current.width;
        const cx = Math.random() * (gw - 100) + 50;
        for (let i = 0; i < 6; i++) {
          gs.enemies.push({ id: Math.random().toString(), type: 'SWARMLING', x: cx + (Math.random() - 0.5) * 60, y: -30 - Math.random() * 60, vy: 2.5 + gs.fase * 0.3, hp: 1, seed: Math.random() * 100 });
        }
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! ENXAME`, color: '#7FFF00', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 5: DESBLOQUEAR E TURBINAR RAIO CADEIA
      if (respostaRef.current === '121212') {
        gs.player.weapons.chain.active = true;
        gs.player.weapons.chain.baseCooldown = 4000;
        gs.player.weapons.chain.bounces = 6;
        criarParticulas(gs.player.x, gs.player.y, '#9D00FF', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! RAIO CADEIA`, color: '#9D00FF', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 6: DESBLOQUEAR E TURBINAR MINA DE PROXIMIDADE
      if (respostaRef.current === '666000') {
        gs.player.weapons.mine.active = true;
        gs.player.weapons.mine.baseCooldown = 5000;
        gs.player.weapons.mine.blastRadius = 100;
        gs.player.weapons.mine.count = 2;
        criarParticulas(gs.player.x, gs.player.y, '#FFA500', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! MINA`, color: '#FFA500', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 7: CASCO NO MÁXIMO (HULL_UPGRADE instantâneo)
      if (respostaRef.current === '220220') {
        gs.player.maxHp = 220; gs.player.hp = 220;
        criarParticulas(gs.player.x, gs.player.y, '#7CFC00', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! CASCO MÁXIMO`, color: '#7CFC00', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 8: EVOLUÇÃO INSTANTÂNEA DA NAVE (NAVE ÔMEGA)
      if (respostaRef.current === '101010') {
        if (gs.fase < 10) gs.fase = 10;
        criarParticulas(gs.player.x, gs.player.y, '#FFFFFF', 20);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! NAVE ÔMEGA`, color: '#FFD700', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 9: INVOCAR NAVE MÃE PENTÁGONO (visual de teste, usa a habilidade da nave mãe tipo 0)
      if (respostaRef.current === '505050') {
        const gw = layoutRef.current.width;
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        gs.boss = { active: true, type: 3, x: gw / 2, y: -100, hp: 100 + (gs.fase * 80), maxHp: 100 + (gs.fase * 80), vx: 2 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
        gs.gameState = 'BOSS'; gs.stateTimer = 0; gs.tookDamageThisBoss = false;
        criarParticulas(gs.player.x, gs.player.y, '#00E5FF', 20);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! NAVE PENTÁGONO`, color: '#00E5FF', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 10: INVOCAR NAVE MÃE HEXÁGONO (visual de teste, usa a habilidade da nave mãe tipo 1)
      if (respostaRef.current === '606060') {
        const gw = layoutRef.current.width;
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        gs.boss = { active: true, type: 4, x: gw / 2, y: -100, hp: 100 + (gs.fase * 80), maxHp: 100 + (gs.fase * 80), vx: 2 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
        gs.gameState = 'BOSS'; gs.stateTimer = 0; gs.tookDamageThisBoss = false;
        criarParticulas(gs.player.x, gs.player.y, '#FFD700', 20);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! NAVE HEXÁGONO`, color: '#FFD700', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 11: INVOCAR NAVE MÃE ESTRELA (visual de teste, usa a habilidade da nave mãe tipo 2)
      if (respostaRef.current === '707070') {
        const gw = layoutRef.current.width;
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        gs.boss = { active: true, type: 5, x: gw / 2, y: -100, hp: 100 + (gs.fase * 80), maxHp: 100 + (gs.fase * 80), vx: 2 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
        gs.gameState = 'BOSS'; gs.stateTimer = 0; gs.tookDamageThisBoss = false;
        criarParticulas(gs.player.x, gs.player.y, '#FF3300', 20);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE! NAVE ESTRELA`, color: '#FF3300', life: 90 });
        setResposta(''); return;
      }

      // CHEAT CODE 12: ALTERNA VISUAIS DINÂMICOS (fundo progressivo + alerta pulsante de chefe)
      if (respostaRef.current === '40028922') {
        gs.dynamicVisualsUnlocked = !gs.dynamicVisualsUnlocked;
        criarParticulas(gs.player.x, gs.player.y, '#FFDD00', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: gs.dynamicVisualsUnlocked ? `CHEAT CODE! VISUAIS DINÂMICOS ON` : `VISUAIS DINÂMICOS OFF`, color: '#FFDD00', life: 90 });
        setResposta(''); return;
      }

      // ATIVAÇÃO DA HABILIDADE SECRETA (OVERDRIVE): só funciona se desbloqueada no Hangar
      // (código digitado lá, ver hangarCodigoSecreto) e só uma vez por partida.
      if (respostaRef.current === '77778888') {
        if (gs.player.secretSkillUnlocked && !gs.player.secretSkillUsedThisGame && gs.overdriveTimer <= 0) {
          gs.player.secretSkillUsedThisGame = true;
          gs.overdriveTimer = 8000;
          gs.overdriveStoredDamage = gs.player.damage;
          gs.overdriveStoredFireRate = gs.player.fireRate;
          gs.player.damage *= 2.2;
          gs.player.fireRate = Math.max(60, gs.player.fireRate / 3);
          gs.forceShieldHits = Math.max(gs.forceShieldHits, 5);
          criarParticulas(gs.player.x, gs.player.y, '#FFD700', 30);
          gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `OVERDRIVE ATIVADO!`, color: '#FFD700', life: 90 });
        }
        setResposta(''); return;
      }

      const num = parseInt(respostaRef.current);
      let acertou = false;

      const dispararMagia = (tx: number, ty: number, color: string) => { 
        gs.mathShots.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, tx, ty, color, life: 15 }); 
      };

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(gs.boss.x, gs.boss.y, '#FFD700'); setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 15), 350); 
        gs.score += 5;
      } 
      
      if (!acertou) {
        for (let i = 0; i < gs.enemies.length; i++) {
          let e = gs.enemies[i];
          if (e.mathRequired && !e.isDying && e.res === num) {
            acertou = true; dispararMagia(e.x, e.y, '#00FFFF');
            if (e.type === 'GHOST') {
              // Resolveu a conta: o fantasma vira VISIVEL (vulnerável) por alguns segundos
              e.mathRequired = false;
              e.estadoFantasma = 'VISIVEL';
              e.visibleUntil = Date.now() + 6000;
              criarParticulas(e.x, e.y, '#7FFFD4', 12);
              break;
            }
            e.solvesDone += 1;
            if (e.solvesDone >= e.solvesNeeded) {
               e.isDying = true; e.mathRequired = false;

               // PREMIAÇÃO: PONTO GLOBAL NA HORA E PARA A EQUIPE!
               if (e.type === 'RARE_ENEMY') {
                   if (typeof (api as any).submitMathBlasterRareKill === 'function') {
                       (api as any).submitMathBlasterRareKill().catch(()=>{});
                   }
                   gs.floatingTexts.push({ id: Math.random().toString(), x: e.x, y: e.y, text: `+1 PONTO GLOBAL!`, color: '#FFD700', life: 120 });
               }

               setTimeout(() => { e.hp = -100; gs.score += (e.type === 'RARE_ENEMY' ? 100 : 15); criarParticulas(e.x, e.y, '#00FFFF', 15); }, 350);
            } else {
               const eq = gerarEquacao(gs.fase, getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
            }
            break;
          }
        }
      }
        
      if (!acertou) {
        for (let i = 0; i < gs.powerups.length; i++) {
          let p = gs.powerups[i];
          if (!p.collected && p.res === num) {
            acertou = true; p.collected = true; dispararMagia(p.x, p.y, p.color); 
            const type = p.type; const color = p.color; const px = p.x; const py = p.y; const title = p.title;
            
            setTimeout(() => {
              criarParticulas(px, py, color, 10);
              gs.floatingTexts.push({ id: Math.random().toString(), x: px, y: py, text: `+ ${title}`, color: color, life: 60 });
              
              if (type === 'DAMAGE') gs.player.damage += 0.5;
              else if (type === 'FIRE_RATE') gs.player.fireRate = Math.max(100, gs.player.fireRate - 20);
              else if (type === 'TRIPLE_SHOT') gs.player.tripleShot = true;
              else if (type === 'MISSILE_UNLOCK') gs.player.weapons.missile.active = true;
              else if (type === 'MISSILE_COOLDOWN') { gs.player.weapons.missile.baseCooldown = Math.max(3000, gs.player.weapons.missile.baseCooldown - 500); gs.player.weapons.missile.level += 1; }
              else if (type === 'MISSILE_DAMAGE') { gs.player.weapons.missile.damageMult += 0.5; gs.player.weapons.missile.level += 1; }
              else if (type === 'MISSILE_AOE') { gs.player.weapons.missile.aoeRange += 10; gs.player.weapons.missile.level += 1; }
              else if (type === 'LASER_UNLOCK') gs.player.weapons.laser.active = true;
              else if (type === 'LASER_COOLDOWN') { gs.player.weapons.laser.baseCooldown = Math.max(4000, gs.player.weapons.laser.baseCooldown - 500); gs.player.weapons.laser.level += 1; }
              else if (type === 'LASER_DAMAGE') { gs.player.weapons.laser.damageMult += 0.5; gs.player.weapons.laser.level += 1; }
              else if (type === 'PULSAR_UNLOCK') gs.player.weapons.pulsar.active = true;
              else if (type === 'PULSAR_COOLDOWN') { gs.player.weapons.pulsar.baseCooldown = Math.max(4000, gs.player.weapons.pulsar.baseCooldown - 1000); gs.player.weapons.pulsar.level += 1; }
              else if (type === 'PULSAR_RADIUS') { gs.player.weapons.pulsar.radius += 20; gs.player.weapons.pulsar.level += 1; }
              else if (type === 'PULSAR_DAMAGE') { gs.player.weapons.pulsar.damageMult += 1; gs.player.weapons.pulsar.level += 1; }
              else if (type === 'CHAIN_UNLOCK') gs.player.weapons.chain.active = true;
              else if (type === 'CHAIN_COOLDOWN') { gs.player.weapons.chain.baseCooldown = Math.max(4000, gs.player.weapons.chain.baseCooldown - 1000); gs.player.weapons.chain.level += 1; }
              else if (type === 'CHAIN_BOUNCE') { gs.player.weapons.chain.bounces += 1; gs.player.weapons.chain.level += 1; }
              else if (type === 'ELECTRIC_UNLOCK') gs.player.weapons.electric.active = true;
              else if (type === 'ELECTRIC_COOLDOWN') { gs.player.weapons.electric.baseCooldown = Math.max(1500, gs.player.weapons.electric.baseCooldown - 500); gs.player.weapons.electric.level += 1; }
              else if (type === 'ELECTRIC_BOUNCE') { gs.player.weapons.electric.bounces += 1; gs.player.weapons.electric.level += 1; }
              else if (type === 'MINE_UNLOCK') gs.player.weapons.mine.active = true;
              else if (type === 'MINE_COOLDOWN') { gs.player.weapons.mine.baseCooldown = Math.max(5000, gs.player.weapons.mine.baseCooldown - 1500); gs.player.weapons.mine.level += 1; }
              else if (type === 'MINE_BLAST') { gs.player.weapons.mine.blastRadius += 15; gs.player.weapons.mine.level += 1; }
              else if (type === 'MINE_COUNT') gs.player.weapons.mine.count += 1;
              else if (type === 'HULL_UPGRADE') { gs.player.maxHp = Math.min(220, gs.player.maxHp + 20); gs.player.hp = gs.player.maxHp; }
              else if (type === 'FORCE_SHIELD') gs.forceShieldHits = 3;
              else if (type === 'DRONE_NORMAL') { if (!gs.drones.normal.active) gs.drones.normal.active = true; else gs.drones.normal.baseCooldown = Math.max(500, gs.drones.normal.baseCooldown - 200); }
              else if (type === 'TIME_FREEZE') gs.timeFreezeTimer = 5000;
              else if (type === 'X_RAY') gs.xRayTimer = 10000;
              else if (type === 'DRONE_ADVANCED') gs.drones.advanced.active = true;
              else if (type === 'DRONE_ADVANCED_UP') gs.drones.advanced.baseCooldown = Math.max(500, gs.drones.advanced.baseCooldown - 200);

              gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); 
              gs.score += 5; p.y = 9999;
            }, 350);
            break; 
          }
        }
      }

      if (!acertou && respostaRef.current !== '') { 
        if (gs.forceShieldHits > 0) {
          gs.forceShieldHits -= 1;
          criarParticulas(gs.player.x, gs.player.y, '#00FA9A', 5);
        } else {
          gs.player.hp = Math.max(0, gs.player.hp - (3 + (gs.fase * 2))); 
          criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5); 
        }
      }
      setResposta('');
    } else {
      // Limite de 8 dígitos: comporta o maior cheat code atual (40028922) sem travar respostas normais
      setResposta(r => r.length < 8 ? r + valor : r);
    }
  }, [jogoAtivo]);

  // CONTROLE DO TECLADO FÍSICO COM ALÍVIO DE PROCESSAMENTO (Sem congelar o React)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (!jogoAtivo || gs.timeFreezeTimer > 0) return;
            if (e.repeat) return; // BLOQUEIO EXTREMAMENTE IMPORTANTE

            const key = e.key ? e.key.toLowerCase() : '';
            
            // Movimentação Fluida
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault(); 
                if (key === 'w' || key === 'arrowup') gs.keys.up = true;
                if (key === 's' || key === 'arrowdown') gs.keys.down = true;
                if (key === 'a' || key === 'arrowleft') gs.keys.left = true;
                if (key === 'd' || key === 'arrowright') gs.keys.right = true;
            }

            // Ações Numéricas
            let actionKey = '';
            if (key >= '0' && key <= '9') actionKey = key;
            else if (key === 'backspace' || key === 'delete') actionKey = 'apagar';
            else if (key === 'enter') actionKey = 'enviar';

            if (actionKey) {
                e.preventDefault();
                lidarComTeclado(actionKey);
                // Animação visual mantida mas controlada
                setTeclasPressionadas(prev => [...prev, actionKey]);
                setTimeout(() => setTeclasPressionadas(prev => prev.filter(k => k !== actionKey)), 150);
            }
        };

        const handleKeyUpLocal = (e: any) => {
            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 'w' || key === 'arrowup') gs.keys.up = false;
            if (key === 's' || key === 'arrowdown') gs.keys.down = false;
            if (key === 'a' || key === 'arrowleft') gs.keys.left = false;
            if (key === 'd' || key === 'arrowright') gs.keys.right = false;
        };

        window.addEventListener('keydown', handleKeyDownLocal, { passive: false });
        window.addEventListener('keyup', handleKeyUpLocal, { passive: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDownLocal);
            window.removeEventListener('keyup', handleKeyUpLocal);
        };
    }
  }, [jogoAtivo, lidarComTeclado]);

  const handleGameTouchStart = (e: any) => {
    const changed = e.nativeEvent.changedTouches;
    for (let i = 0; i < changed.length; i++) {
      const touch = changed[i];
      if (gs.movementTouchId === null) {
        gs.movementTouchId = touch.identifier;
        gs.lastTouchX = touch.pageX;
        gs.lastTouchY = touch.pageY;
        break;
      }
    }
  };

  const handleGameTouchMove = (e: any) => {
    if (gs.movementTouchId !== null) {
      const touch = Array.from(e.nativeEvent.touches).find((t: any) => t.identifier === gs.movementTouchId);
      if (touch) {
        const dx = ((touch as any).pageX - gs.lastTouchX) / gs.currentZoom;
        const dy = ((touch as any).pageY - gs.lastTouchY) / gs.currentZoom;
        gs.player.x += dx * 1.5;
        gs.player.y += dy * 1.5;
        gs.lastTouchX = (touch as any).pageX;
        gs.lastTouchY = (touch as any).pageY;
      }
    }
  };

  const handleGameTouchEnd = (e: any) => {
    const touchExists = Array.from(e.nativeEvent.touches).some((t: any) => t.identifier === gs.movementTouchId);
    if (!touchExists) gs.movementTouchId = null;
  };

  const getTeclaFromCoords = (x: number, y: number, layoutWidth: number) => {
    const GAP = 8; 
    const KEY_W = (layoutWidth - (GAP * 2)) / 3; 
    const KEY_H = 45; 
    
    let col = -1;
    if (x >= 0 && x <= KEY_W) col = 0; 
    else if (x > KEY_W && x <= KEY_W * 2 + GAP) col = 1; 
    else if (x > KEY_W * 2 + GAP) col = 2;

    let row = -1;
    if (y >= 0 && y <= KEY_H) row = 0; 
    else if (y > KEY_H && y <= KEY_H * 2 + GAP) row = 1; 
    else if (y > KEY_H * 2 + GAP && y <= KEY_H * 3 + GAP * 2) row = 2; 
    else if (y > KEY_H * 3 + GAP * 2) row = 3;

    if (col === -1 || row === -1) return null;
    const layout = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['apagar', '0', 'enviar']];
    return layout[row]?.[col] || null;
  };

  const processKeyboardTouches = (evt: any) => {
    if (Platform.OS === 'web') return;
    const touches = evt.nativeEvent.touches;
    const currentActive = new Set<string>();

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        if (kbTouchIds.current.has(touch.identifier)) {
            const x = touch.locationX;
            const y = touch.locationY;
            if (x >= -20 && x <= tecladoLayoutRef.current.width + 20 && y >= -20 && y <= 250) {
                const key = getTeclaFromCoords(x, y, tecladoLayoutRef.current.width);
                if (key) currentActive.add(key);
            }
        }
    }
    
    setTeclasPressionadas(Array.from(currentActive));

    currentActive.forEach(key => {
        if (!triggeredTouchesRef.current.has(key)) {
            triggeredTouchesRef.current.add(key);
            lidarComTeclado(key);
        }
    });

    triggeredTouchesRef.current.forEach(key => {
        if (!currentActive.has(key)) triggeredTouchesRef.current.delete(key);
    });
  };

  const handleKbTouchStart = (evt: any) => {
    if (Platform.OS === 'web') return;
    const changed = evt.nativeEvent.changedTouches;
    for (let i = 0; i < changed.length; i++) {
        kbTouchIds.current.add(changed[i].identifier);
    }
    processKeyboardTouches(evt);
  };

  const handleKbTouchMove = (evt: any) => {
    if (Platform.OS === 'web') return;
    processKeyboardTouches(evt);
  };

  const handleKbTouchEnd = (evt: any) => {
    if (Platform.OS === 'web') return;
    const changed = evt.nativeEvent.changedTouches;
    for (let i = 0; i < changed.length; i++) {
        kbTouchIds.current.delete(changed[i].identifier);
    }
    processKeyboardTouches(evt);
  };

  const getRespostasAtivas = () => {
    const resps: number[] = [];
    if (gs.boss.active && gs.boss.shield) resps.push(gs.boss.res);
    gs.enemies.forEach(e => { if (e.mathRequired && !e.isDying) resps.push(e.res); });
    gs.powerups.forEach(p => { if (!p.collected) resps.push(p.res); });
    return resps;
  };

  const gerarEquacao = (fase: number, evitar: number[] = []) => {
    const r = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    let n1, n2, res, txt, tipo;

    let operacoes = ['soma'];
    if (fase >= 2) operacoes.push('subtracao', 'soma'); 
    if (fase >= 3) operacoes.push('multiplicacao', 'subtracao');
    if (fase >= 7) operacoes.push('divisao');
    if (fase >= 8) operacoes.push('potencia', 'raiz');

    let tentativas = 0;
    do {
      tipo = operacoes[Math.floor(Math.random() * operacoes.length)];

      if (tipo === 'soma') {
        const max = fase === 1 ? 5 : 10 + (fase * 3);
        n1 = r(1, max); n2 = r(1, max);
        res = n1 + n2; txt = `${n1} + ${n2}`;
      }
      else if (tipo === 'subtracao') {
        const max = fase === 1 ? 6 : 15 + (fase * 3);
        const min = fase === 1 ? 2 : 5;
        n1 = r(min, max); n2 = r(1, n1 - 1);
        res = n1 - n2; txt = `${n1} - ${n2}`;
      }
      else if (tipo === 'multiplicacao') {
        const maxNum = Math.min(15, 4 + Math.floor(fase / 2));
        n1 = r(2, maxNum); n2 = r(2, maxNum);
        res = n1 * n2; txt = `${n1} × ${n2}`;
      }
      else if (tipo === 'divisao') {
        const maxDivisor = Math.min(10, 2 + Math.floor((fase - 7) / 2));
        n2 = r(2, Math.max(5, maxDivisor)); 
        res = r(2, 9); 
        n1 = n2 * res; 
        txt = `${n1} ÷ ${n2}`;
      }
      else if (tipo === 'potencia') {
        n1 = r(2, 5);
        n2 = n1 === 2 ? r(2, 4) : r(2, 3);
        res = Math.pow(n1, n2);
        const superScript: any = { 2: '²', 3: '³', 4: '⁴' };
        txt = `${n1}${superScript[n2]}`;
      }
      else if (tipo === 'raiz') {
        res = r(2, Math.min(15, 3 + Math.floor((fase - 8)/2))); 
        n1 = res * res;
        txt = `√${n1}`;
      }
      
      tentativas++;
      if (tentativas > 30) break; // Trava de segurança (redundante, mas necessária)
      
    } while (evitar.includes(res)); 
    
    return { txt, res };
  };

  const iniciarJogo = () => {
    gameOverFired.current = false;
    setPontosEquipeGanhos(null);
    gs.keys = { up: false, down: false, left: false, right: false }; // Zera teclas pressionadas ao reiniciar
    
    gs.currentZoom = BASE_ZOOM;
    const initialGw = canvasSizeRef.current.width / gs.currentZoom;
    const initialGh = canvasSizeRef.current.height / gs.currentZoom;

    gs.player = {
      x: initialGw / 2, y: initialGh - 100,
      hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false,
      fireMode: 'PROJETIL' as 'PROJETIL' | 'CONTINUO', beamIntensity: 0,
      // Loadout carregado do Hangar (ver hangarPerfilRef, aplicado em iniciarJogo)
      armaInicial: 'PADRAO' as 'PADRAO' | 'ELETRICA' | 'PLASMA' | 'LEQUE',
      cdr: 0, speedBonus: 0, corNave: '#00FFFF', secretSkillUnlocked: false, secretSkillUsedThisGame: false,
      weapons: {
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 },
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 70, damageMult: 6 },
        chain: { active: false, level: 1, baseCooldown: 9000, lastFire: 0, damageMult: 2, bounces: 3, range: 140 },
        mine: { active: false, level: 1, baseCooldown: 11000, lastFire: 0, damageMult: 4, fuse: 1500, blastRadius: 70, count: 1 },
        electric: { active: false, level: 1, baseCooldown: 4000, lastFire: 0, damageMult: 0.6, bounces: 3, range: 150 }
      }
    };

    // Aplica o loadout do Hangar (se já carregado). Efeitos com soft-cap pra não deixar a nave
    // overpower rapidamente, mesmo com muitas moedas: CDR até 40%, velocidade até +48%, dano até +64%.
    const hp = hangarPerfilRef.current;
    if (hp) {
      gs.player.armaInicial = hp.armaInicial || 'PADRAO';
      gs.player.cdr = Math.min(0.5, (hp.nivelCDR || 0) * 0.05);
      gs.player.speedBonus = Math.min(0.6, (hp.nivelVelocidade || 0) * 0.06);
      gs.player.damage = 1 * (1 + Math.min(0.8, (hp.nivelDano || 0) * 0.08));
      gs.player.corNave = hp.corNave || '#00FFFF';
      gs.player.secretSkillUnlocked = !!hp.habilidadeSecretaDesbloqueada;
      if (gs.player.armaInicial === 'LEQUE') gs.player.tripleShot = true;
    }
    gs.player.secretSkillUsedThisGame = false;

    gs.lasers = []; gs.specialLasers = []; gs.mathShots = []; gs.pulses = []; gs.floatingTexts = [];
    gs.chainBolts = []; gs.mines = [];
    gs.bgSymbols = Array.from({ length: 16 }, () => novoSimboloFundo(layoutRef.current.width, layoutRef.current.height));
    gs.enemies = []; gs.enemyLasers = []; gs.powerups = []; gs.particles = [];
    gs.boss = { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 };
    gs.score = 0; gs.fase = 1; gs.gameState = 'WAVES'; gs.stateTimer = 0; gs.movementTouchId = null;
    gs.waveFlavor = 'CLASSICA';
    
    gs.timeAlive = 0; gs.flawlessBossesCount = 0; gs.tookDamageThisBoss = false; gs.timeFreezeTimer = 0; gs.forceShieldHits = 0; gs.xRayTimer = 0;
    gs.overdriveTimer = 0; gs.overdriveStoredDamage = 0; gs.overdriveStoredFireRate = 0;
    gs.drones = {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    };
    
    setResposta(''); 
    setTela('jogo');
    setJogoAtivo(true);
    
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); // Tick rate / delta-time fixo — não alterado (ver VELOCIDADE_BASE_MULT no topo do arquivo)
  };

  const gameOver = () => { 
    if (gameOverFired.current) return;
    gameOverFired.current = true;
    
    setJogoAtivo(false); 
    if (loopRef.current) clearInterval(loopRef.current); 
    setTela('resultado');
    
    if (gs.score > 0) {
      if (typeof (api as any).submitMathBlasterScore === 'function') {
          (api as any).submitMathBlasterScore(gs.score)
            .then(() => carregarHallDaFama())
            .catch(() => carregarHallDaFama());
      } else {
          carregarHallDaFama();
      }
      if (typeof (api as any).pontuarJogo === 'function') {
        (api as any).pontuarJogo('math_blaster', gs.score).then((r: any) => { if (r) setPontosEquipeGanhos(r); }).catch(() => {});
      }
      // Moedas do Hangar: progressão permanente do jogador, separada da pontuação de equipe
      api.hangarGanharMoedas(gs.score).then((r: any) => {
        if (r && hangarPerfilRef.current) hangarPerfilRef.current.moedas += (r.moedasGanhas || 0);
      });
    } else {
      carregarHallDaFama();
    }
  };

  const gameTick = () => {
    const now = Date.now();
    gs.currentZoom = BASE_ZOOM === 1 ? 1 : Math.max(0.35, BASE_ZOOM - ((gs.fase - 1) * 0.03));
    
    if (canvasSizeRef.current.width > 0) {
        layoutRef.current.width = canvasSizeRef.current.width / gs.currentZoom;
        layoutRef.current.height = canvasSizeRef.current.height / gs.currentZoom;
    }

    const gw = layoutRef.current.width;
    const gh = layoutRef.current.height;

    // Guarda o HP máximo na primeira vez que o inimigo aparece pro jogo, pra dar pra calcular
    // a porcentagem da barra de vida flutuante (ver TAREFA 3 — UI Overlays)
    gs.enemies.forEach((e: any) => { if (e.maxHp === undefined) e.maxHp = e.hp; });

    gs.timeAlive += 30;
    if (gs.timeFreezeTimer > 0) gs.timeFreezeTimer -= 30;
    if (gs.xRayTimer > 0) gs.xRayTimer -= 30;
    if (gs.overdriveTimer > 0) {
      gs.overdriveTimer -= 30;
      if (gs.overdriveTimer <= 0) {
        gs.player.damage = gs.overdriveStoredDamage;
        gs.player.fireRate = gs.overdriveStoredFireRate;
      }
    }

    // APLICAR MOVIMENTO DO TECLADO FÍSICO (bônus de velocidade do Hangar aplicado aqui)
    const movSpeed = (6 / gs.currentZoom) * VELOCIDADE_BASE_MULT * (1 + gs.player.speedBonus);
    if (gs.keys.up) gs.player.y -= movSpeed;
    if (gs.keys.down) gs.player.y += movSpeed;
    if (gs.keys.left) gs.player.x -= movSpeed;
    if (gs.keys.right) gs.player.x += movSpeed;

    const aplicarDano = (dano: number) => {
      if (gs.forceShieldHits > 0) {
        gs.forceShieldHits -= 1;
        criarParticulas(gs.player.x, gs.player.y, '#00FA9A', 5);
      } else {
        gs.player.hp = Math.max(0, gs.player.hp - dano);
        if (gs.gameState === 'BOSS') gs.tookDamageThisBoss = true;
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5);
      }
    };

    if (gs.player.x < 20) gs.player.x = 20; 
    if (gs.player.x > gw - 20) gs.player.x = gw - 20;
    if (gs.player.y < 20) gs.player.y = 20; 
    if (gs.player.y > gh - 20) gs.player.y = gh - 20;

    // Arquétipo de arma inicial (escolhido no Hangar): muda o comportamento do tiro primário.
    // PADRAO/LEQUE usam o tiro normal (LEQUE só força tripleShot=true desde o início, em iniciarJogo).
    // PLASMA atira mais devagar (cadência x2.5) e mais forte (dano x3). ELETRICA salta pra inimigos
    // próximos a cada disparo, com dano reduzido e atordoamento — reaproveita o sistema de chainBolts.
    const fireRateEfetivo = gs.player.fireRate * (gs.player.armaInicial === 'PLASMA' ? 2.5 : 1);
    if (now - gs.player.lastFire > fireRateEfetivo) {
      if (gs.player.armaInicial === 'ELETRICA') {
        const primeiroAlvo = acharInimigoMaisProximoDentroDoRaio(gs.player.x, gs.player.y, 260, new Set());
        gs.chainBolts.push({
          id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, prevX: gs.player.x, prevY: gs.player.y - 20,
          hitIds: new Set(), bouncesLeft: 1, damage: gs.player.damage * 0.5, range: 130,
          targetX: primeiroAlvo ? primeiroAlvo.x : gs.player.x, targetY: primeiroAlvo ? primeiroAlvo.y : gs.player.y - 260,
          resolved: !primeiroAlvo, life: 25, color: '#FFFF00', stun: true
        });
      } else if (gs.player.armaInicial === 'PLASMA') {
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -13, damage: gs.player.damage * 3, size: gs.player.shotSize * 3.5, type: 'PLASMA' });
      } else {
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
        if (gs.player.tripleShot) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 10, y: gs.player.y - 15, vx: -3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 10, y: gs.player.y - 15, vx: 3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
        }
      }
      gs.player.lastFire = now;
    }

    // CDR (Redução de Recarga do Hangar) reduz o cooldown de todas as armas especiais abaixo
    const cdrMult = 1 - gs.player.cdr;

    if (gs.player.weapons.missile.active && now - gs.player.weapons.missile.lastFire > gs.player.weapons.missile.baseCooldown * cdrMult) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -8, damage: gs.player.damage * gs.player.weapons.missile.damageMult, size: gs.player.shotSize * 3, type: 'MISSILE', life: gs.player.weapons.missile.life, aoeRange: gs.player.weapons.missile.aoeRange });
      gs.player.weapons.missile.lastFire = now;
    }

    if (gs.player.weapons.laser.active && now - gs.player.weapons.laser.lastFire > gs.player.weapons.laser.baseCooldown * cdrMult) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 40, vx: 0, vy: -25, damage: gs.player.damage * gs.player.weapons.laser.damageMult, size: gs.player.shotSize * 2 * gs.player.weapons.laser.sizeMult, type: 'LASER' });
      gs.player.weapons.laser.lastFire = now;
    }

    if (gs.player.weapons.chain.active && now - gs.player.weapons.chain.lastFire > gs.player.weapons.chain.baseCooldown * cdrMult) {
      const cw = gs.player.weapons.chain;
      const primeiroAlvo = acharInimigoMaisProximoDentroDoRaio(gs.player.x, gs.player.y, cw.range * 2, new Set());
      gs.chainBolts.push({
        id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, prevX: gs.player.x, prevY: gs.player.y - 20,
        hitIds: new Set(), bouncesLeft: cw.bounces, damage: gs.player.damage * cw.damageMult, range: cw.range,
        targetX: primeiroAlvo ? primeiroAlvo.x : gs.player.x, targetY: primeiroAlvo ? primeiroAlvo.y : gs.player.y - 260,
        resolved: !primeiroAlvo, life: 25, color: '#9D00FF', stun: false
      });
      cw.lastFire = now;
    }

    // BALAS ELÉTRICAS: dano base menor que os tiros convencionais, salta entre inimigos próximos
    // e atordoa (impede de atirar) no exato instante em que a eletricidade encosta neles.
    if (gs.player.weapons.electric.active && now - gs.player.weapons.electric.lastFire > gs.player.weapons.electric.baseCooldown * cdrMult) {
      const ew = gs.player.weapons.electric;
      const primeiroAlvo = acharInimigoMaisProximoDentroDoRaio(gs.player.x, gs.player.y, ew.range * 2, new Set());
      gs.chainBolts.push({
        id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, prevX: gs.player.x, prevY: gs.player.y - 20,
        hitIds: new Set(), bouncesLeft: ew.bounces, damage: gs.player.damage * ew.damageMult, range: ew.range,
        targetX: primeiroAlvo ? primeiroAlvo.x : gs.player.x, targetY: primeiroAlvo ? primeiroAlvo.y : gs.player.y - 260,
        resolved: !primeiroAlvo, life: 25, color: '#FFFF00', stun: true
      });
      ew.lastFire = now;
    }

    if (gs.player.weapons.mine.active && now - gs.player.weapons.mine.lastFire > gs.player.weapons.mine.baseCooldown * cdrMult && gs.mines.filter((m: any) => !m.exploded).length < gs.player.weapons.mine.count) {
      const mw = gs.player.weapons.mine;
      gs.mines.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y + 30, armedAt: now + mw.fuse, exploded: false, damage: gs.player.damage * mw.damageMult, blastRadius: mw.blastRadius });
      mw.lastFire = now;
    }

    if (gs.drones.normal.active && now - gs.drones.normal.lastFire > gs.drones.normal.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 40, y: gs.player.y, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
      gs.drones.normal.lastFire = now;
    }

    if (gs.drones.advanced.active && now - gs.drones.advanced.lastFire > gs.drones.advanced.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 30, y: gs.player.y, vx: 0, vy: -5, damage: gs.player.damage * 2, size: gs.player.shotSize * 1.5, type: 'MISSILE_HOMING', life: 9999, aoeRange: 40 });
      gs.drones.advanced.lastFire = now;
    }

    if (gs.player.weapons.pulsar.active && now - gs.player.weapons.pulsar.lastFire > gs.player.weapons.pulsar.baseCooldown * cdrMult) {
      gs.pulses.push({ id: Math.random().toString(), maxRadius: gs.player.weapons.pulsar.radius, life: 20, maxLife: 20 });
      gs.player.weapons.pulsar.lastFire = now;
    }

    gs.pulses.forEach(p => {
      p.x = gs.player.x;
      p.y = gs.player.y;
      p.life -= 1;
      const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));
      const pulsarDamage = gs.player.damage * gs.player.weapons.pulsar.damageMult;

      // Efeito defensivo: destrói automaticamente tiros inimigos que entram no raio
      gs.enemyLasers.forEach(el => {
        if (Math.pow(el.x - p.x, 2) + Math.pow(el.y - p.y, 2) < currentRadius * currentRadius) {
          el.hp = 0;
          criarParticulas(el.x, el.y, '#00BFFF', 3);
        }
      });

      // Efeito ofensivo: dano contínuo a quem tocar/permanecer no raio, respeitando escudo/blindagem
      gs.enemies.forEach(e => {
        if (!e.mathRequired && Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2) < currentRadius * currentRadius) {
          if (e.shield && e.shield > 0) { e.shield -= pulsarDamage; }
          else if (e.type === 'SHIELD_TANK') { e.hp -= pulsarDamage * (1 - e.armorReduction); }
          else { e.hp -= pulsarDamage; }
          e.lastPowerupHitAt = now; // barra de vida flutuante temporária (ver render)
          criarParticulas(e.x, e.y, '#00BFFF', 3);
        }
      });

      if (gs.boss.active && !gs.boss.shield && Math.pow(gs.boss.x - p.x, 2) + Math.pow(gs.boss.y - p.y, 2) < Math.pow(currentRadius + 30, 2)) {
         gs.boss.hp -= pulsarDamage;
         criarParticulas(p.x, gs.boss.y + 30, '#00BFFF', 1);
      }
    });
    gs.pulses = gs.pulses.filter(p => p.life > 0);

    gs.mines.forEach((m: any) => {
      if (m.exploded) return;
      if (now < m.armedAt) return;
      const gatilho = gs.enemies.some((e: any) => !e.mathRequired && Math.pow(e.x - m.x, 2) + Math.pow(e.y - m.y, 2) < m.blastRadius * m.blastRadius);
      const bossGatilho = gs.boss.active && !gs.boss.shield && Math.pow(gs.boss.x - m.x, 2) + Math.pow(gs.boss.y - m.y, 2) < Math.pow(m.blastRadius + 30, 2);
      if (gatilho || bossGatilho) {
        gs.enemies.forEach((e: any) => { if (!e.mathRequired && Math.pow(e.x - m.x, 2) + Math.pow(e.y - m.y, 2) < m.blastRadius * m.blastRadius) { e.hp -= m.damage; e.lastPowerupHitAt = now; } });
        if (bossGatilho) gs.boss.hp -= m.damage;
        criarParticulas(m.x, m.y, '#FFA500', 15);
        m.exploded = true;
      }
    });
    gs.mines = gs.mines.filter((m: any) => !m.exploded);

    gs.lasers.forEach(l => {
      if (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') {
        if (l.type === 'MISSILE') l.life -= 1;
        let closest: any = null; 
        let minDist = 999999;
        
        gs.enemies.concat(gs.boss.active ? [gs.boss] : []).forEach(e => {
          if (e.hp > 0 && !e.mathRequired) { 
            let d = Math.pow(e.x - l.x, 2) + Math.pow(e.y - l.y, 2);
            if (d < minDist) { minDist = d; closest = e; }
          }
        });
        
        if (closest) {
          const dx = closest.x - l.x; 
          const dy = closest.y - l.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0.1) { 
            const steer = l.type === 'MISSILE_HOMING' ? 4 : 2;
            l.vx += (dx/dist) * steer; 
            l.vy += (dy/dist) * steer; 
          }
        }
        
        const maxSpeed = l.type === 'MISSILE_HOMING' ? 14 : 10;
        const speed = Math.sqrt(l.vx*l.vx + l.vy*l.vy);
        if (speed > maxSpeed) { 
          l.vx = (l.vx/speed)*maxSpeed; 
          l.vy = (l.vy/speed)*maxSpeed; 
        }
        if (l.type === 'MISSILE' && l.life <= 0) l.y = -100; 
      }
      l.x += l.vx; 
      l.y += l.vy;
    });
    
    gs.lasers = gs.lasers.filter(l => l.type === 'MISSILE_HOMING' ? l.life > 0 : (l.y > -50 && l.x > -20 && l.x < gw + 20));
    
    gs.mathShots.forEach(ms => {
      ms.x += (ms.tx - ms.x) * 0.25; 
      ms.y += (ms.ty - ms.y) * 0.25; 
      ms.life -= 1;
      criarParticulas(ms.x, ms.y, ms.color, 1); 
    });
    gs.mathShots = gs.mathShots.filter(ms => ms.life > 0);

    gs.floatingTexts.forEach(ft => { 
      ft.y -= 1.5; 
      ft.life -= 1; 
    });
    gs.floatingTexts = gs.floatingTexts.filter(ft => ft.life > 0);

    const speedMult = (gs.timeFreezeTimer > 0 ? 0.15 : 1) * VELOCIDADE_BASE_MULT;

    gs.enemyLasers.forEach(el => {
      if (el.homing) {
        const dx = gs.player.x - el.x; 
        const dy = gs.player.y - el.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0.1) { 
          el.vx += (dx/dist) * 0.4; 
          el.vy += (dy/dist) * 0.4; 
        }
        const speed = Math.sqrt(el.vx*el.vx + el.vy*el.vy);
        const maxSpeed = gs.fase === 1 ? 3 : 3 + (gs.fase * 0.6); 
        if (speed > maxSpeed) { 
          el.vx = (el.vx/speed) * maxSpeed; 
          el.vy = (el.vy/speed) * maxSpeed; 
        }
      }
      el.x += el.vx * speedMult; 
      el.y += el.vy * speedMult;

      if (Math.abs(gs.player.x - el.x) < 20 && Math.abs(gs.player.y - el.y) < 20) {
        aplicarDano(el.damage);
        el.hp = 0; 
      }
    });
    gs.enemyLasers = gs.enemyLasers.filter(el => el.y < gh + 20 && el.x > -20 && el.x < gw + 20 && el.hp > 0);

    gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 1; });
    gs.particles = gs.particles.filter(p => p.life > 0);

    gs.bgSymbols.forEach((s: any) => {
      s.y += s.vy * speedMult;
      if (s.y > gh + 20) {
        const novo = novoSimboloFundo(gw, gh, -20 - Math.random() * 40);
        s.x = novo.x; s.y = novo.y; s.vy = novo.vy; s.char = novo.char; s.size = novo.size; s.opacity = novo.opacity; s.color = novo.color;
      }
    });

    gs.stateTimer += 1;

    if (gs.gameState === 'WAVES') {
        
      // INIMIGO RARO (10% de chance APENAS no inicio da fase, e restrito a 5 por dia)
      if (gs.stateTimer === 100) {
          if (dailySpawnsRef.current < 5 && Math.random() <= 0.10) {
              const eq = gerarEquacao(Math.max(8, gs.fase + 4), getRespostasAtivas());
              gs.enemies.push({ id: Math.random().toString(), type: 'RARE_ENEMY', x: Math.random() * (gw - 80) + 40, y: -50, targetY: 100, hp: 9999, mathRequired: true, solvesNeeded: 1, solvesDone: 0, txt: "👑 " + eq.txt, res: eq.res, vy: 0.5, evasive: false });
              
              dailySpawnsRef.current += 1;
              AsyncStorage.setItem('rareSpawnCount', dailySpawnsRef.current.toString()).catch(()=>{});
          }
      }

      const meteorBase = Math.max(20, 100 - gs.fase * 10);
      const meteorInterval = intervaloAjustado(gs.waveFlavor === 'CHUVA_METEOROS' ? Math.max(6, Math.floor(meteorBase / 4)) : gs.waveFlavor === 'ENXAME' ? meteorBase * 4 : meteorBase, 'METEOR');
      if (chanceSpawn('METEOR') > 0 && gs.waveFlavor !== 'BLINDADOS' && gs.stateTimer % meteorInterval === 0) {
        const meteorVy = gs.fase === 1 ? Math.random() * 1 + 1.5 : Math.random() * 2 + 3 + (gs.fase * 0.6);
        gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: meteorVy, angle: 0 });
      }

      if (chanceSpawn('FLANKER') > 0 && gs.stateTimer % intervaloAjustado(240, 'FLANKER') === 0 && gs.fase >= 2 && (gs.waveFlavor !== 'CHUVA_METEOROS' || Math.random() < 0.15)) {
        const isLeft = Math.random() > 0.5;
        const shieldThreshold = gs.waveFlavor === 'BLINDADOS' ? 0.3 : 0.7;
        gs.enemies.push({ id: Math.random().toString(), type: 'FLANKER', x: isLeft ? -20 : gw + 20, y: Math.random() * (gh/3), targetY: 0, hp: 2 + gs.fase * 2, vx: isLeft ? 3 + gs.fase * 1.2 : -3 - gs.fase * 1.2, vy: 1.5, angle: 0, shield: Math.random() > shieldThreshold ? 2 : 0 });
      }

      const tankInterval = intervaloAjustado(gs.waveFlavor === 'BLINDADOS' ? 100 : 280, 'SHIELD_TANK');
      if (chanceSpawn('SHIELD_TANK') > 0 && gs.stateTimer % tankInterval === 0 && gs.fase >= 4 && gs.stateTimer < 1400) {
        gs.enemies.push({ id: Math.random().toString(), type: 'SHIELD_TANK', x: Math.random() * (gw - 60) + 30, y: -40, vy: 0.8 + gs.fase * 0.15, hp: 15 + gs.fase * 4, armorReduction: 0.5 });
      }

      const swarmInterval = intervaloAjustado(gs.waveFlavor === 'ENXAME' ? 90 : 260, 'SWARMLING');
      if (chanceSpawn('SWARMLING') > 0 && gs.waveFlavor !== 'BLINDADOS' && gs.stateTimer % swarmInterval === 0 && gs.fase >= 3 && gs.stateTimer < 1400) {
        const qtd = gs.waveFlavor === 'ENXAME' ? 6 + Math.floor(Math.random() * 5) : 5 + Math.floor(Math.random() * 4);
        const cx = Math.random() * (gw - 80) + 40;
        for (let i = 0; i < qtd; i++) {
          gs.enemies.push({ id: Math.random().toString(), type: 'SWARMLING', x: cx + (Math.random() - 0.5) * 60, y: -30 - Math.random() * 60, vy: 2.5 + gs.fase * 0.3, hp: 1, seed: Math.random() * 100 });
        }
      }

      if ((gs.stateTimer === 600 || gs.stateTimer === 1200) && Math.random() * 100 < chanceSpawn('SPAWNER')) {
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        const isLeft = gs.stateTimer === 600;
        gs.enemies.push({ id: Math.random().toString(), type: 'SPAWNER', x: isLeft ? gw * 0.25 : gw * 0.75, y: -80, targetY: 90 + Math.random() * 30, hp: 9999, mathRequired: true, solvesNeeded: Math.min(8, 2 + gs.fase), solvesDone: 0, txt: eq.txt, res: eq.res, vy: 1.5, spawnTimer: 0 });
      }

      // FANTASMA MATEMÁTICO: começa INVISIVEL (indestrutível/não colidível). Resolver a conta
      // torna ele VISIVEL (vulnerável) por alguns segundos; se não for derrotado, volta a ficar
      // invisível com uma equação nova. Dificuldade da equação escala com a fase (gerarEquacao).
      if (gs.stateTimer === 850 && gs.fase >= 2 && Math.random() * 100 < chanceSpawn('GHOST')) {
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        const hpFantasma = 3 + Math.floor(gs.fase / 2);
        gs.enemies.push({
          id: Math.random().toString(), type: 'GHOST', x: Math.random() * (gw - 80) + 40, y: 100 + Math.random() * 100,
          hp: hpFantasma, maxHp: hpFantasma, mathRequired: true, estadoFantasma: 'INVISIVEL',
          txt: eq.txt, res: eq.res, visibleUntil: 0, seed: Math.random() * 100,
        });
      }

      if (chanceSpawn('SQUAD') > 0 && gs.waveFlavor !== 'ENXAME' && (gs.waveFlavor !== 'CHUVA_METEOROS' || Math.random() < 0.15) && gs.stateTimer % intervaloAjustado(300 - Math.min(150, gs.fase * 20), 'SQUAD') === 0 && gs.stateTimer < 1400) {
        const cx = Math.random() * (gw - 120) + 60;
        const baseHp = 1 + (gs.fase * 2); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 3, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, evasive: true });
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 }); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 });
      }

      if (gs.stateTimer > 1500) { 
        gs.gameState = 'BOSS_WARNING'; 
        gs.stateTimer = 0; 
        gs.tookDamageThisBoss = false; 
      }
    } 
    else if (gs.gameState === 'BOSS_WARNING') {
      if (gs.stateTimer > 90) { 
        gs.gameState = 'BOSS'; 
        gs.stateTimer = 0;
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        gs.boss = { active: true, type: Math.floor(Math.random() * 3), x: gw / 2, y: -100, hp: 100 + (gs.fase * 80), maxHp: 100 + (gs.fase * 80), vx: 2 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
      }
    }
    else if (gs.gameState === 'BOSS') {
      if (gs.boss.y < 90) {
        gs.boss.y += 1.5 * speedMult;
      } else {
        gs.boss.x += gs.boss.vx * speedMult;
        if (gs.boss.x < 50 || gs.boss.x > gw - 50) gs.boss.vx *= -1;
        gs.boss.timer += 1 * speedMult;

        const bossAbility = gs.boss.type % 3;
        if (bossAbility === 0) {
          if (gs.boss.timer % Math.max(40, 120 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: 0, vy: 2, size: 14, damage: 5 + (gs.fase * 5), homing: true, color: '#FF8C00', hp: 5 + (gs.fase * 4) });
        } else if (bossAbility === 1) {
          if (gs.boss.timer % Math.max(40, 90 - (gs.fase * 5)) === 0) [-2, -1, 0, 1, 2].forEach(dir => gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: dir * 1.5, vy: 6 + gs.fase, size: 6, damage: 5 + (gs.fase * 5), homing: false, color: '#FF0055', hp: 1 }));
        } else {
          if (gs.boss.timer % Math.max(60, 150 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: 0, vy: 15, size: 20, damage: 10 + (gs.fase * 10), homing: false, color: '#32CD32', hp: 99 });
        }

        if (gs.boss.timer % 300 === 0 && gs.enemies.length < 2) {
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x - 30, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI });
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x + 30, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI });
        }

        if (!gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) {
          const eq = gerarEquacao(gs.fase, getRespostasAtivas()); 
          gs.boss.shield = true; gs.boss.txt = eq.txt; gs.boss.res = eq.res;
        }
      }
      
      if (gs.boss.hp <= 0) {
        criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 30);
        gs.score += 50 * gs.fase;
        gs.boss.active = false;
        gs.gameState = 'TRANSITION';
        gs.stateTimer = 0;
        gs.enemies = []; gs.enemyLasers = [];
        if (!gs.tookDamageThisBoss) gs.flawlessBossesCount += 1;

        const proximaFase = gs.fase + 1;
        const saboresDisponiveis = ['CLASSICA', 'CHUVA_METEOROS'];
        if (proximaFase >= 3) saboresDisponiveis.push('ENXAME');
        if (proximaFase >= 5) saboresDisponiveis.push('BLINDADOS');
        gs.waveFlavor = saboresDisponiveis[Math.floor(Math.random() * saboresDisponiveis.length)];
      }
    }
    else if (gs.gameState === 'TRANSITION') {
      if (gs.stateTimer > 90) {
        gs.fase += 1;
        gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 50);
        gs.gameState = 'WAVES';
        gs.stateTimer = 0;
      }
    }

    gs.enemies.forEach(e => {
      // Rastro fantasma (efeito puramente visual, sem hitbox/colisão nem ataque): guarda a
      // posição de alguns ticks atrás pra desenhar sprites "fantasmas" com atraso (ver render)
      if (e.type === 'METEOR' || e.type === 'FLANKER' || e.type === 'SHIELD_TANK' || e.type === 'SWARMLING' || e.type === 'SQUAD') {
        if (!e.trail) e.trail = [];
        if (gs.timeAlive % 120 === 0) {
          e.trail.unshift({ x: e.x, y: e.y });
          if (e.trail.length > 2) e.trail.length = 2;
        }
      }
      if (e.type === 'METEOR') { e.y += e.vy * speedMult; e.angle = (e.angle || 0) + 2 * speedMult; }
      else if (e.type === 'FLANKER') { e.x += e.vx * speedMult; e.y += e.vy * speedMult; }
      else if (e.type === 'SHIELD_TANK') { e.y += e.vy * speedMult; }
      else if (e.type === 'SWARMLING') { e.x += Math.sin((now + e.seed * 100) / 90) * 4 * speedMult; e.y += e.vy * speedMult; }
      else if (e.type === 'SPAWNER' || e.type === 'RARE_ENEMY') {
        if (e.y < e.targetY) e.y += e.vy * speedMult;
        else {
           e.x += Math.sin(now / 500) * 0.5 * speedMult; 
           if (e.type !== 'RARE_ENEMY') {
               e.spawnTimer += 1 * speedMult;
               if (e.spawnTimer > Math.max(50, 120 - (gs.fase * 10))) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: e.x, y: e.y + 30, targetY: e.y + 80 + Math.random() * 50, isLeader: false, hp: 1 + gs.fase, vx: (Math.random() - 0.5) * 3, vy: 4, fireTimer: 0, angle: Math.PI });
                  e.spawnTimer = 0;
               }
           }
        }
      }
      else if (e.type === 'SQUAD') {
        if (e.evasive) {
          gs.lasers.forEach(l => { 
            if (l.y > e.y && l.y - e.y < 80 && Math.abs(l.x - e.x) < 20) e.x += (e.x > l.x ? 3 : -3) * speedMult; 
          });
        }
        if (e.isLeader) {
          const dx = gs.player.x - e.x; const dy = gs.player.y - e.y; const dist = Math.sqrt(dx*dx + dy*dy); 
          e.angle = Math.atan2(dy, dx); 
          if (dist > 50) { e.x += (dx/dist) * (1.5 + gs.fase * 0.3) * speedMult; e.y += (dy/dist) * (1.0 + gs.fase * 0.2) * speedMult; }
          e.fireTimer += 1 * speedMult;
          if (e.fireTimer > Math.max(30, 80 - (gs.fase * 8))) { 
            gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 10, vx: Math.cos(e.angle)*(3 + gs.fase*0.8), vy: Math.sin(e.angle)*(3 + gs.fase*0.8), size: 6, damage: 5 + (gs.fase * 3), homing: false, color: '#FF00FF', hp: 1 }); 
            e.fireTimer = 0; 
          }
        } else {
          if (e.y < e.targetY) e.y += e.vy * speedMult; 
          else {
            e.x += Math.sin(now / 300) * 1.5 * speedMult; e.fireTimer += 1 * speedMult;
            if (e.fireTimer > Math.max(60, 120 - (gs.fase * 5)) && Math.random() < 0.05) { 
              gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 10, vx: 0, vy: 3 + gs.fase, size: 5, damage: 5 + (gs.fase * 3), homing: false, color: '#FF0055', hp: 1 }); 
              e.fireTimer = 0; 
            }
          }
        }
      }
      else if (e.type === 'GHOST') {
        // Flutuação suave, igual nas duas fases (INVISIVEL/VISIVEL)
        e.x += Math.sin((now + e.seed * 100) / 400) * 1.2 * speedMult;
        e.y += Math.cos((now + e.seed * 100) / 500) * 0.6 * speedMult;
        if (e.estadoFantasma === 'VISIVEL' && now > e.visibleUntil) {
          // Esgotou o tempo sem ser derrotado: volta a ficar invisível com uma equação nova
          e.estadoFantasma = 'INVISIVEL';
          e.mathRequired = true;
          e.hp = e.maxHp;
          const eq = gerarEquacao(gs.fase, getRespostasAtivas());
          e.txt = eq.txt; e.res = eq.res;
          criarParticulas(e.x, e.y, '#7FFFD4', 8);
        }
      }

      // Fantasma invisível não é colidível — nem toma dano de contato nem machuca o jogador
      if (Math.abs(gs.player.x - e.x) < 25 && Math.abs(gs.player.y - e.y) < 25 && !(e.type === 'GHOST' && e.mathRequired)) {
        aplicarDano(5 + (gs.fase * 5));
        if (!e.mathRequired) e.hp = -100;
      }
    });

    gs.lasers.forEach(l => {
      gs.enemyLasers.forEach(el => {
        if (el.homing && el.hp > 0 && Math.abs(l.x - el.x) < 20 && Math.abs(l.y - el.y) < 20) { 
          el.hp -= l.damage; 
          if (l.type !== 'LASER') { if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; }
          criarParticulas(el.x, el.y, '#FF8C00', 3); 
        }
      });

      gs.enemies.forEach(e => {
        if (!e.mathRequired && Math.abs(l.x - e.x) < 20 && Math.abs(l.y - e.y) < 20) {
          if (e.shield && e.shield > 0) {
            e.shield -= l.damage;
            if (l.type !== 'NORMAL') e.lastPowerupHitAt = now; // barra de vida flutuante temporária
            if (l.type !== 'LASER') { if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; }
            criarParticulas(e.x, e.y, '#00FFFF', 5); return;
          }

          e.hp -= (e.type === 'SHIELD_TANK' && l.type !== 'MISSILE' && l.type !== 'MISSILE_HOMING') ? l.damage * (1 - e.armorReduction) : l.damage;
          if (l.type !== 'NORMAL') e.lastPowerupHitAt = now; // barra de vida flutuante temporária
          if (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') {
            criarParticulas(e.x, e.y, '#FF4444', 10);
            gs.enemies.forEach(e2 => { if (!e2.mathRequired && Math.abs(e.x - e2.x) < l.aoeRange && Math.abs(e.y - e2.y) < l.aoeRange) { e2.hp -= l.damage; e2.lastPowerupHitAt = now; } });
            if (gs.boss.active && Math.abs(gs.boss.x - e.x) < l.aoeRange && Math.abs(gs.boss.y - e.y) < l.aoeRange) gs.boss.hp -= l.damage;
            if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100;
          } else if (l.type !== 'LASER') l.y = -100;
          criarParticulas(l.x, l.y, '#FFF', 3);
        } else if (e.mathRequired && Math.abs(l.x - e.x) < 30 && Math.abs(l.y - e.y) < 30) {
           if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; 
           criarParticulas(l.x, l.y, '#00FFFF', 2); 
        }
      });

      if (gs.boss.active && Math.abs(l.x - gs.boss.x) < 45 && Math.abs(l.y - gs.boss.y) < 35) {
        if (l.type !== 'LASER') { if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; }
        
        if (gs.boss.shield) { 
          criarParticulas(l.x, gs.boss.y + 35, '#00FFFF', 2); 
        } else { 
          gs.boss.hp -= l.damage; 
          criarParticulas(l.x, l.y, '#FFD700', 4); 
          if (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') { 
            criarParticulas(l.x, l.y, '#FF4444', 10); 
            if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; 
          }
        }
      }
    });

    gs.chainBolts.forEach((b: any) => {
      if (b.resolved) { b.life -= 2; return; }
      b.x += (b.targetX - b.x) * 0.4;
      b.y += (b.targetY - b.y) * 0.4;
      b.life -= 1;
      const distSq = Math.pow(b.targetX - b.x, 2) + Math.pow(b.targetY - b.y, 2);
      if (distSq < 400) {
        const alvo = gs.enemies.find((e: any) => e.hp > 0 && !e.mathRequired && Math.abs(e.x - b.targetX) < 20 && Math.abs(e.y - b.targetY) < 20);
        if (alvo) {
          if (alvo.shield && alvo.shield > 0) { alvo.shield -= b.damage; }
          else if (alvo.type === 'SHIELD_TANK') { alvo.hp -= b.damage * (1 - alvo.armorReduction); }
          else { alvo.hp -= b.damage; }
          alvo.lastPowerupHitAt = now; // barra de vida flutuante temporária
          // Atordoamento: só impede o inimigo de atirar no exato momento em que a eletricidade encosta nele
          if (b.stun) alvo.fireTimer = 0;
          criarParticulas(alvo.x, alvo.y, b.color || '#9D00FF', 5);
          b.hitIds.add(alvo.id);
        }
        if (gs.boss.active && !gs.boss.shield && Math.abs(gs.boss.x - b.targetX) < 45 && Math.abs(gs.boss.y - b.targetY) < 35) {
          gs.boss.hp -= b.damage;
          criarParticulas(b.targetX, b.targetY, b.color || '#9D00FF', 5);
        }
        if (b.bouncesLeft > 0) {
          const proximo = acharInimigoMaisProximoDentroDoRaio(b.targetX, b.targetY, b.range, b.hitIds);
          if (proximo) {
            b.prevX = b.targetX; b.prevY = b.targetY;
            b.targetX = proximo.x; b.targetY = proximo.y;
            b.bouncesLeft -= 1;
            b.damage *= 0.7;
            b.life = 25;
          } else {
            b.resolved = true;
          }
        } else {
          b.resolved = true;
        }
      }
    });
    gs.chainBolts = gs.chainBolts.filter((b: any) => b.life > 0);

    const intervaloPowerupEfetivo = 15000 / (configJogoRef.current?.dropRateMultiplier || 1);
    if (now - gs.lastPowerupSpawn > intervaloPowerupEfetivo && gs.powerups.length < 1 && gs.gameState === 'WAVES') {
      const tipos: { type: string; color: string; nome: string }[] = [
        { type: 'DAMAGE', color: '#FF00FF', nome: 'DANO NAVE' },
        { type: 'HULL_UPGRADE', color: '#7CFC00', nome: 'CASCO REFORÇADO' }
      ];

      // Powerups adaptativos: cadência e tiro triplo só valem pra arma primária por projétil.
      // Preparado pra uma futura arma primária de tiro contínuo — nesse modo eles somem do mapa
      // sozinhos, e os buffs acumulados são convertidos via converterBuffsDeModo().
      const modoAtualCompativel = (tipoPowerup: string) => !POWERUPS_EXCLUSIVOS_PROJETIL.has(tipoPowerup) || gs.player.fireMode === 'PROJETIL';
      if (modoAtualCompativel('FIRE_RATE')) tipos.push({ type: 'FIRE_RATE', color: '#00FFFF', nome: 'CADÊNCIA UP' });
      if (modoAtualCompativel('TRIPLE_SHOT') && !gs.player.tripleShot) tipos.push({ type: 'TRIPLE_SHOT', color: '#FFD700', nome: 'TIRO TRIPLO' });

      if (!gs.player.weapons.missile.active) tipos.push({ type: 'MISSILE_UNLOCK', color: '#FF4444', nome: 'MÍSSIL TELE' });
      else { 
        tipos.push({ type: 'MISSILE_COOLDOWN', color: '#FF4444', nome: 'MÍSSIL: RECARGA' }); 
        tipos.push({ type: 'MISSILE_DAMAGE', color: '#FF4444', nome: 'MÍSSIL: DANO' }); 
        tipos.push({ type: 'MISSILE_AOE', color: '#FF4444', nome: 'MÍSSIL: ÁREA' }); 
      }

      if (!gs.player.weapons.laser.active) tipos.push({ type: 'LASER_UNLOCK', color: '#32CD32', nome: 'RAIO LASER' });
      else { 
        tipos.push({ type: 'LASER_COOLDOWN', color: '#32CD32', nome: 'LASER: RECARGA' }); 
        tipos.push({ type: 'LASER_DAMAGE', color: '#32CD32', nome: 'LASER: DANO' }); 
      }

      if (!gs.player.weapons.pulsar.active) tipos.push({ type: 'PULSAR_UNLOCK', color: '#00BFFF', nome: 'AURA PULSAR' });
      else {
        tipos.push({ type: 'PULSAR_COOLDOWN', color: '#00BFFF', nome: 'PULSAR: RAPIDEZ' });
        tipos.push({ type: 'PULSAR_RADIUS', color: '#00BFFF', nome: 'PULSAR: RAIO' });
        tipos.push({ type: 'PULSAR_DAMAGE', color: '#00BFFF', nome: 'PULSAR: DANO' });
      }

      if (!gs.player.weapons.chain.active) tipos.push({ type: 'CHAIN_UNLOCK', color: '#9D00FF', nome: 'RAIO CADEIA' });
      else {
        tipos.push({ type: 'CHAIN_COOLDOWN', color: '#9D00FF', nome: 'CADEIA: RECARGA' });
        tipos.push({ type: 'CHAIN_BOUNCE', color: '#9D00FF', nome: 'CADEIA: SALTOS' });
      }

      if (!gs.player.weapons.electric.active) tipos.push({ type: 'ELECTRIC_UNLOCK', color: '#FFFF00', nome: 'BALAS ELÉTRICAS' });
      else {
        tipos.push({ type: 'ELECTRIC_COOLDOWN', color: '#FFFF00', nome: 'ELÉTRICA: RECARGA' });
        tipos.push({ type: 'ELECTRIC_BOUNCE', color: '#FFFF00', nome: 'ELÉTRICA: SALTOS' });
      }

      if (!gs.player.weapons.mine.active) tipos.push({ type: 'MINE_UNLOCK', color: '#FFA500', nome: 'MINA PROXIMIDADE' });
      else {
        tipos.push({ type: 'MINE_COOLDOWN', color: '#FFA500', nome: 'MINA: RECARGA' });
        tipos.push({ type: 'MINE_BLAST', color: '#FFA500', nome: 'MINA: EXPLOSÃO' });
      }

      if (gs.fase >= 2 || gs.timeAlive > 60000) {
        tipos.push({ type: 'FORCE_SHIELD', color: '#00FA9A', nome: 'ESCUDO FORÇA' });
      }
      if (gs.fase >= 3) {
        tipos.push({ type: 'DRONE_NORMAL', color: '#1E90FF', nome: 'DRONE BÁSICO' });
        tipos.push({ type: 'TIME_FREEZE', color: '#E0FFFF', nome: 'CONGELA TEMPO' });
      }
      if (gs.fase >= 4) {
        tipos.push({ type: 'X_RAY', color: '#FF1493', nome: 'RAIO-X MATH' });
      }
      if (gs.fase >= 5 && gs.player.weapons.mine.active) {
        tipos.push({ type: 'MINE_COUNT', color: '#FFA500', nome: 'MINA: QUANTIDADE' });
      }

      if (gs.flawlessBossesCount >= 3) {
        if (!gs.drones.advanced.active) {
            tipos.push({ type: 'DRONE_ADVANCED', color: '#FFD700', nome: 'DRONE ELITE' });
        } else {
            tipos.push({ type: 'DRONE_ADVANCED_UP', color: '#FFD700', nome: 'ELITE: RECARGA' });
        }
      }

      // Painel de Partida do admin: só deixa aparecer powerups de famílias habilitadas.
      // habilitados === null/undefined significa "configuração não carregada" (mostra tudo);
      // uma lista vazia É uma escolha válida do admin (desmarcou tudo — não aparece nada).
      const habilitados = configJogoRef.current?.powerupsHabilitados;
      const tiposFiltrados = habilitados == null ? tipos : tipos.filter(t => habilitados.includes(familiaDoPowerup(t.type)));

      if (tiposFiltrados.length > 0) {
        const sel = tiposFiltrados[Math.floor(Math.random() * tiposFiltrados.length)];
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());

        gs.powerups.push({
          id: Math.random().toString(), x: Math.random() * (gw - 60) + 30, y: -40,
          type: sel.type, color: sel.color, title: sel.nome, txt: eq.txt, res: eq.res, collected: false
        });
      }
      gs.lastPowerupSpawn = now;
    }
    
    gs.powerups.forEach(p => { if (!p.collected) p.y += 1.5; }); 

    gs.enemies.forEach(e => { 
      if (e.hp <= 0 && e.hp > -90) { 
        gs.score += e.isLeader ? 3 : 1;
        criarParticulas(e.x, e.y, e.type === 'SQUAD' ? '#FF0055' : '#AAA', 10); 
      } 
    });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < gh + 20); 
    gs.powerups = gs.powerups.filter(p => p.y < gh + 50);

    if (gs.player.hp <= 0) gameOver();
    setFrames(f => f + 1); 
  };

  const porcentagemHP = Math.max(0, (gs.player.hp / gs.player.maxHp) * 100);
  const corHP = porcentagemHP > 50 ? '#32CD32' : porcentagemHP > 25 ? '#FFD700' : '#FF4444';
  const naveStage = gs.fase >= 10 ? 4 : gs.fase >= 6 ? 3 : gs.fase >= 3 ? 2 : 1;

  const getFlavorLabel = (flavor: string) => {
    if (flavor === 'CHUVA_METEOROS') return 'CHUVA DE METEOROS';
    if (flavor === 'ENXAME') return 'ENXAME HOSTIL';
    if (flavor === 'BLINDADOS') return 'ESQUADRÃO BLINDADO';
    return 'ONDA CLÁSSICA';
  };
  const getFlavorColor = (flavor: string) => {
    if (flavor === 'CHUVA_METEOROS') return '#AAAAAA';
    if (flavor === 'ENXAME') return '#7FFF00';
    if (flavor === 'BLINDADOS') return '#90A4AE';
    return '#32CD32';
  };

  // Progressão visual sutil da malha de fundo conforme a fase avança (só ativa via cheat code 40028922)
  const CORES_MALHA_POR_FASE = ['#00FFFF', '#00E5FF', '#33CCFF', '#6699FF', '#9966FF', '#CC66FF', '#FF66CC', '#FF6699', '#FF6666', '#FFAA33'];
  const gridEstiloDinamico = (fase: number) => {
    const cor = CORES_MALHA_POR_FASE[Math.min(CORES_MALHA_POR_FASE.length - 1, Math.max(0, fase - 1))];
    return {
      backgroundImage: `linear-gradient(${cor} 1px, transparent 1px), linear-gradient(90deg, ${cor} 1px, transparent 1px)`,
      opacity: 0.08 + Math.min(0.1, fase * 0.008),
    };
  };

  // Ghost Trail: sprite "fantasma" idêntico ao inimigo, opacidade fixa em 20%, sem hitbox/ataque —
  // reaproveita exatamente os mesmos estilos do inimigo real, só que numa posição antiga (e.trail)
  const renderGhostSombra = (e: any, pos: { x: number; y: number }, key: string) => {
    if (e.type === 'METEOR') return <View key={key} pointerEvents="none" style={[styles.meteorShape, { left: pos.x - 12, top: pos.y - 12, opacity: 0.2, transform: [{ rotate: `${e.angle || 0}deg` }] }]}/>;
    if (e.type === 'FLANKER') return <View key={key} pointerEvents="none" style={[styles.flankerShape, { left: pos.x - 7, top: pos.y - 12, opacity: 0.2, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}/>;
    if (e.type === 'SHIELD_TANK') return (
      <View key={key} pointerEvents="none" style={{ position: 'absolute', left: pos.x - 15, top: pos.y - 15, width: 30, height: 30, opacity: 0.2 }}>
        <View style={styles.shieldTankBody}/>
      </View>
    );
    if (e.type === 'SWARMLING') return <View key={key} pointerEvents="none" style={[styles.swarmlingShape, { left: pos.x - 6, top: pos.y - 6, opacity: 0.2 }]}/>;
    if (e.type === 'SQUAD') {
      const corNave = e.isLeader ? '#FF00FF' : '#FF0055';
      return <View key={key} pointerEvents="none" style={[styles.squadronShip, { left: pos.x - 12, top: pos.y - 12, borderTopColor: corNave, opacity: 0.2 }]}/>;
    }
    return null;
  };

  const renderBuffs = () => (
    <View style={styles.buffContainer}>
      <Text style={[styles.buffText, { color: '#FF00FF' }]}>ATK: {gs.player.damage.toFixed(1)}</Text>
      <Text style={[styles.buffText, { color: '#00FFFF' }]}>TIRO: {(gs.player.fireRate / 1000).toFixed(2)}s</Text>
      {gs.player.maxHp > 100 && <Text style={[styles.buffText, { color: '#7CFC00' }]}>CASCO +{gs.player.maxHp - 100}</Text>}
      {gs.player.tripleShot && <Text style={[styles.buffText, { color: '#FFD700' }]}>TRIPLO</Text>}
      {gs.timeFreezeTimer > 0 && <Text style={[styles.buffText, { color: '#E0FFFF' }]}>GELO</Text>}
      {gs.xRayTimer > 0 && <Text style={[styles.buffText, { color: '#FF1493' }]}>RAIO-X</Text>}
      {gs.overdriveTimer > 0 && <Text style={[styles.buffText, { color: '#FFD700' }]}>OVERDRIVE {Math.ceil(gs.overdriveTimer / 1000)}s</Text>}
    </View>
  );

  const renderCooldownBox = (weaponKey: 'missile' | 'laser' | 'pulsar' | 'chain' | 'mine' | 'electric', color: string, icon: string) => {
    const w = gs.player.weapons[weaponKey];
    if (!w.active) return null;
    const pct = Math.max(0, Math.min(100, ((Date.now() - w.lastFire) / w.baseCooldown) * 100));
    const totalDamage = (gs.player.damage * w.damageMult).toFixed(1);
    const cooldownSecs = (w.baseCooldown / 1000).toFixed(1);

    return (
      <View key={weaponKey} style={{ alignItems: 'center' }}>
        <Text style={{color: color, fontSize: 10, fontWeight: 'bold', marginBottom: 2}}>Lv.{w.level}</Text>
        <View style={styles.skillBox}>
          <Ionicons name={icon as any} size={20} color={color}/>
          <View style={[styles.skillOverlay, { height: `${100 - pct}%` }]}/>
        </View>
        <Text style={{color: '#FFF', fontSize: 8, marginTop: 2, fontWeight: 'bold'}}>ATK: {totalDamage}</Text>
        <Text style={{color: '#AAA', fontSize: 8}}>{cooldownSecs}s</Text>
      </View>
    );
  };

  if (tela === 'menu') {
    const meuRank = hallDaFama.find(j => j.id === (user?.id || guestUserId));

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.menuScrollContent}>
          <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={goBack}>
            <Ionicons name="arrow-back" size={30} color="#00FFFF"/>
          </TouchableOpacity>
          <Ionicons name="rocket" size={80} color="#00FFFF" style={{ marginBottom: 20, marginTop: 20 }}/>
          <Text style={styles.tituloMenu}>SKY</Text>
          <Text style={styles.subTituloMenu}>EQUATIONS</Text>
          <Text style={styles.instrucoes}>Use (W,A,S,D) ou Setas do teclado para voar. Digite a resposta e aperte (ENTER) para atirar!</Text>

          <View style={styles.rankingContainer}>
            <View style={styles.rankingHeaderRow}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
              <Text style={styles.rankingTitle}>HALL DA FAMA - BLASTER</Text>
            </View>
            <View style={styles.rankingScrollWrapper}>
              <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                {hallDaFama.length > 0 ? (
                  hallDaFama.map((jogador, idx) => {
                    let corPosicao = '#888'; 
                    if (jogador.posicao === 1 || idx === 0) corPosicao = '#FFD700'; 
                    else if (jogador.posicao === 2 || idx === 1) corPosicao = '#C0C0C0'; 
                    else if (jogador.posicao === 3 || idx === 2) corPosicao = '#CD7F32';
                    
                    const isMe = jogador.id === (user?.id || guestUserId);

                    return (
                      <View key={jogador.posicao || Math.random().toString()} style={[styles.rankingRow, isMe && styles.rankingRowMe]}>
                        <View style={styles.rankingLeft}>
                          <Text style={[styles.rankingPosText, { color: corPosicao }]}>#{jogador.posicao || idx + 1}</Text>
                          <View>
                            <Text style={[styles.rankingNameText, isMe && { color: '#00FFFF' }, jogador.isProf && { color: '#E74C3C' }]}>
                              {jogador.nome} {jogador.isProf ? '👑' : ''}
                            </Text>
                            {!jogador.isProf && jogador.equipe ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: jogador.cor || '#AAA' }} />
                                <Text style={{ color: '#AAA', fontSize: 11, fontWeight: 'bold' }}>{jogador.equipe}</Text>
                                {jogador.turma ? <Text style={{ color: '#666', fontSize: 11 }}>• {jogador.turma}</Text> : null}
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.rankingScoreText, isMe && { color: '#00FFFF' }]}>
                          {jogador.pontosMaximos !== undefined ? jogador.pontosMaximos : (jogador.score || 0)} pts
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: 15, alignItems: 'center' }}>
                    <Text style={{ color: '#888', fontStyle: 'italic' }}>Nenhum jogador pontuou ainda. Seja o primeiro!</Text>
                  </View>
                )}
              </ScrollView>
            </View>
            
            {meuRank && (
              <View style={styles.myRankingFixed}>
                <Text style={styles.myRankingLabel}>Sua Posição Atual:</Text>
                <View style={styles.rankingLeft}>
                  <Text style={[styles.rankingPosText, { color: '#00FFFF' }]}>#{meuRank.posicao}</Text>
                  <Text style={[styles.rankingScoreText, { color: '#00FFFF' }]}>
                    {meuRank.pontosMaximos !== undefined ? meuRank.pontosMaximos : meuRank.score} pts
                  </Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.btnIniciar} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>INICIAR MISSÃO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#00FFFF', marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 }]} onPress={() => router.push('/hangar' as any)}>
            <Ionicons name="construct-outline" size={18} color="#00FFFF" />
            <Text style={[styles.btnIniciarTxt, { color: '#00FFFF' }]}>HANGAR</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (tela === 'resultado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainerFixed}>
          <Text style={[styles.tituloMenu, { color: '#FF4444' }]}>DESTRUÍDO</Text>
          
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{gs.score}</Text>
            <Text style={styles.resultadoLabel}>Pontos Totais</Text>
          </View>

          {pontosEquipeGanhos && (
            <View style={[styles.resultadoCard, { backgroundColor: pontosEquipeGanhos.pontosGanhos > 0 ? '#FFD70020' : '#88888820', marginTop: 12 }]}>
              <Text style={[styles.resultadoPontos, { color: '#FFD700', fontSize: 26 }]}>
                {pontosEquipeGanhos.pontosGanhos > 0 ? `+${pontosEquipeGanhos.pontosGanhos} pts pra equipe!` : 'Limite diário já atingido'}
              </Text>
              {pontosEquipeGanhos.limiteAtingido && <Text style={[styles.resultadoLabel, { marginTop: 4 }]}>Volte amanhã pra ganhar mais pontos de equipe neste jogo 😉</Text>}
            </View>
          )}
          
          <Text style={styles.textoFase}>Chegou na Fase {gs.fase}</Text>
          
          <TouchableOpacity style={[styles.btnIniciar, { marginTop: 40 }]} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#555', marginTop: 15 }]} onPress={goBack}>
            <Text style={[styles.btnIniciarTxt, { color: '#888' }]}>VOLTAR AO MENU</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.gameWrapper}>
        
        <View style={styles.hud}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hudScore}>SCORE: {gs.score}</Text>
            <View style={styles.hpBarContainer}>
              <View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]}/>
            </View>
            {renderBuffs()}
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 15 }}>
            <Text style={[styles.hudFase, { alignSelf: 'flex-start', marginTop: 15, marginRight: 5 }]}>FASE {gs.fase}</Text>
            {renderCooldownBox('missile', '#FF4444', 'rocket')}
            {renderCooldownBox('laser', '#32CD32', 'flash')}
            {renderCooldownBox('pulsar', '#00BFFF', 'shield')}
            {renderCooldownBox('chain', '#9D00FF', 'link')}
            {renderCooldownBox('mine', '#FFA500', 'disc')}
            {renderCooldownBox('electric', '#FFFF00', 'flash-outline')} 
          </View>
        </View>

        <View style={[styles.gameArea, gs.timeFreezeTimer > 0 && { borderColor: '#E0FFFF', borderWidth: 2 }]} 
          onLayout={(e) => { 
            const { width, height } = e.nativeEvent.layout;
            setCanvasSize({ width, height }); 
            canvasSizeRef.current = { width, height }; 
          }} 
          onTouchStart={handleGameTouchStart} 
          onTouchMove={handleGameTouchMove} 
          onTouchEnd={handleGameTouchEnd} 
          onTouchCancel={handleGameTouchEnd}
        >
          
          {gs.dynamicVisualsUnlocked && (gs.gameState === 'BOSS' || gs.gameState === 'BOSS_WARNING') && (
            <View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60,
              borderWidth: 6,
              borderColor: `rgba(255, 221, 0, ${(0.3 + 0.55 * Math.abs(Math.sin(Date.now() / 260))).toFixed(2)})`,
              shadowColor: '#FFDD00', shadowRadius: 20, shadowOpacity: 0.5 + 0.4 * Math.abs(Math.sin(Date.now() / 260)),
            }}/>
          )}

          {gs.gameState === 'BOSS_WARNING' && (<View style={styles.centerAlert}><Text style={styles.alertTextDanger}>ATENÇÃO</Text><Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text></View>)}
          {gs.gameState === 'TRANSITION' && (
            <View style={styles.centerAlert}>
              <Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text>
              <Text style={styles.alertSubText}>PREPARANDO SALTO...</Text>
              <Text style={[styles.alertSubText, { color: getFlavorColor(gs.waveFlavor), marginTop: 8 }]}>PRÓXIMA ONDA: {getFlavorLabel(gs.waveFlavor)}</Text>
            </View>
          )}

          <View style={{
            position: 'absolute',
            width: canvasSize.width / gs.currentZoom,
            height: canvasSize.height / gs.currentZoom,
            left: -(canvasSize.width / gs.currentZoom - canvasSize.width) / 2,
            top: -(canvasSize.height / gs.currentZoom - canvasSize.height) / 2,
            transform: [{ scale: gs.currentZoom }],
          }}>

            <View style={[styles.gridOverlay, gs.dynamicVisualsUnlocked && (gridEstiloDinamico(gs.fase) as any)]}/>

            <View style={styles.bgSymbolsLayer} pointerEvents="none">
              {gs.bgSymbols.map((s: any) => (
                <Text key={s.id} style={[styles.bgSymbolText, { left: s.x, top: s.y, fontSize: s.size, color: s.color, opacity: s.opacity }]}>{s.char}</Text>
              ))}
            </View>

            {gs.enemies.map((e: any) => e.trail ? e.trail.map((pos: any, i: number) => renderGhostSombra(e, pos, `ghost-${e.id}-${i}`)) : null)}

            {gs.enemies.map(e => {
              if (e.type === 'METEOR') return <View key={e.id} style={[styles.meteorShape, { left: e.x - 12, top: e.y - 12, transform: [{ rotate: `${e.angle || 0}deg` }] }]}/>;
              if (e.type === 'FLANKER') return ( <View key={e.id} style={[styles.flankerShape, { left: e.x - 7, top: e.y - 12, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}>{e.shield > 0 && <View style={styles.miniShield}/>}</View>);

              if (e.type === 'RARE_ENEMY') {
                return (
                   <View key={e.id} style={[styles.spawnerShape, { left: e.x - 35, top: e.y - 25, backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700', shadowColor: 'transparent' }]}>
                      <View style={[styles.rareRing, { left: 22, top: 14, transform: [{ rotate: `${(Date.now() / 20) % 360}deg` }] }]}/>
                      <Text style={[styles.spawnerMath, { color: '#FFD700' }]}>{e.txt}</Text>
                      {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                   </View>
                );
              }

              if (e.type === 'SHIELD_TANK') {
                return (
                  <View key={e.id} style={{ position: 'absolute', left: e.x - 15, top: e.y - 15, width: 30, height: 30 }}>
                    <View style={styles.shieldTankBody}/>
                    <View style={[styles.shieldTankTop, { left: 8, top: -10 }]}/>
                  </View>
                );
              }

              if (e.type === 'SWARMLING') return <View key={e.id} style={[styles.swarmlingShape, { left: e.x - 6, top: e.y - 6 }]}/>;

              if (e.type === 'GHOST') {
                const invisivel = e.estadoFantasma === 'INVISIVEL';
                return (
                  <View key={e.id} style={{ position: 'absolute', left: e.x - 24, top: e.y - 24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: invisivel ? 'rgba(127,255,212,0.08)' : 'rgba(127,255,212,0.35)',
                      borderWidth: 2, borderColor: invisivel ? 'rgba(127,255,212,0.25)' : '#7FFFD4',
                      shadowColor: '#7FFFD4', shadowRadius: invisivel ? 4 : 14, shadowOpacity: invisivel ? 0.3 : 1,
                    }}/>
                    <Text style={{ position: 'absolute', top: -22, color: invisivel ? 'rgba(127,255,212,0.6)' : '#7FFFD4', fontSize: 12, fontWeight: '900', backgroundColor: '#050015', paddingHorizontal: 4 }}>{e.txt}</Text>
                    {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                  </View>
                );
              }

              if (e.type === 'SPAWNER') {
                const nodePulso = 0.4 + Math.abs(Math.sin(Date.now() / 200)) * 0.6;
                return (
                   <View key={e.id} style={[styles.spawnerShape, { left: e.x - 30, top: e.y - 22 }]}>
                      <View style={[styles.spawnerNode, { left: -4, top: -4, opacity: nodePulso }]}/>
                      <View style={[styles.spawnerNode, { right: -4, top: -4, opacity: nodePulso }]}/>
                      <View style={[styles.spawnerNode, { left: -4, bottom: -4, opacity: nodePulso }]}/>
                      <View style={[styles.spawnerNode, { right: -4, bottom: -4, opacity: nodePulso }]}/>
                      <Text style={styles.spawnerMath}>{e.txt}</Text>
                      {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                      <View style={styles.powerupDots}>
                        {Array.from({length: e.solvesNeeded}).map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i < e.solvesDone ? '#00FFFF' : 'transparent', borderColor: '#00FFFF' }]}/>))}
                      </View>
                   </View>
                );
              }
              const rot = e.isLeader ? (e.angle - Math.PI/2) + 'rad' : '0rad';
              const corNave = e.isLeader ? '#FF00FF' : '#FF0055';
              return (
                <View key={e.id} style={[styles.squadronShip, { left: e.x - 12, top: e.y - 12, borderTopColor: corNave, filter: `drop-shadow(0 0 6px ${corNave})` as any, transform: [{ rotate: rot }] }]}>
                  <View style={[styles.squadShadow, { left: -4, top: 4 }]}/>
                  {e.shield > 0 && <View style={styles.miniShield}/>}
                </View>
              );
            })}

            {gs.boss.active && (
              <View style={[styles.bossContainer, { left: gs.boss.x - 40, top: gs.boss.y - 30 }]}>
                <View style={styles.bossHpBar}><View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]}/></View>
                {gs.boss.type <= 2 ? (
                  <View style={[
                    styles.bossShip,
                    gs.boss.type === 0 && { shadowColor: '#FF4444', shadowRadius: 12, shadowOpacity: 0.9 },
                    gs.boss.type === 1 && { borderRadius: 0, backgroundColor: '#4B0082', borderColor: '#FF00FF', shadowColor: '#FF00FF', shadowRadius: 12, shadowOpacity: 0.9 },
                    gs.boss.type === 2 && { borderRadius: 30, height: 60, backgroundColor: '#006400', borderColor: '#32CD32', shadowColor: '#32CD32', shadowRadius: 12, shadowOpacity: 0.9 },
                  ]}/>
                ) : (
                  <View style={[
                    styles.bossPoligono,
                    gs.boss.type === 3 && styles.bossPentagono,
                    gs.boss.type === 4 && styles.bossHexagono,
                    gs.boss.type === 5 && styles.bossEstrela,
                  ]}>
                    <View style={styles.bossPoligonoNucleo}/>
                  </View>
                )}
                {gs.boss.shield && (
                  <View style={styles.bossShield}>
                    <Text style={styles.bossMath}>{gs.boss.txt}</Text>
                    {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{gs.boss.res}</Text>}
                  </View>
                )}
              </View>
            )}

            {gs.enemies.map((e: any) => {
              if (!e.lastPowerupHitAt || Date.now() - e.lastPowerupHitAt >= 1500) return null;
              const opacidade = 1 - (Date.now() - e.lastPowerupHitAt) / 1500;
              const pct = Math.max(0, Math.min(1, e.hp / (e.maxHp || e.hp || 1)));
              return (
                <View key={'hpbar-' + e.id} pointerEvents="none" style={{ position: 'absolute', left: e.x - 16, top: e.y - 26, width: 32, height: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 3, opacity: opacidade, zIndex: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                  <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: pct > 0.5 ? '#32CD32' : pct > 0.25 ? '#FFD700' : '#FF4444', borderRadius: 2 }}/>
                </View>
              );
            })}

            {gs.powerups.map(p => (
              <View key={p.id} style={[styles.powerupBox, { left: p.x - 40, top: p.y - 18, borderColor: p.color, shadowColor: p.color, shadowRadius: 8, shadowOpacity: 0.8, opacity: p.collected ? 0.4 : 1 }]}>
                <Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={styles.powerupMath}>{p.txt}</Text>
              </View>
            ))}

            {gs.lasers.map(l => {
              const corTiro = l.type === 'LASER' ? '#32CD32' : l.type === 'MISSILE' ? '#FF4444' : l.type === 'MISSILE_HOMING' ? '#FFD700' : l.type === 'PLASMA' ? '#FF6600' : '#00FFFF';
              return (
                <View key={l.id} style={[styles.laserNormal, {
                  left: l.x - (l.size/2),
                  top: l.y,
                  width: l.size,
                  height: l.type === 'MISSILE' ? l.size : (l.type === 'MISSILE_HOMING' ? l.size : (l.type === 'LASER' ? l.size * 8 : l.type === 'PLASMA' ? l.size * 1.6 : l.size * 3)),
                  backgroundColor: corTiro,
                  shadowColor: corTiro, shadowRadius: l.type === 'PLASMA' ? 12 : 6, shadowOpacity: 0.9,
                  borderRadius: (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING' || l.type === 'PLASMA') ? l.size / 2 : 5
                }]}/>
              );
            })}

            {gs.chainBolts.map((b: any) => {
              const dx = b.x - b.prevX; const dy = b.y - b.prevY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const angle = Math.atan2(dy, dx);
              const midX = (b.prevX + b.x) / 2;
              const midY = (b.prevY + b.y) / 2;
              const corBolt = b.color || '#9D00FF';
              return (
                <View key={b.id} style={{ position: 'absolute', left: midX - dist / 2, top: midY - 2, width: dist, height: 4, backgroundColor: corBolt, borderRadius: 2, opacity: b.resolved ? Math.max(0, b.life / 25) : 1, transform: [{ rotate: angle + 'rad' }], shadowColor: corBolt, shadowRadius: 6, shadowOpacity: 0.9, zIndex: 6 }}/>
              );
            })}

            {gs.mines.map((m: any) => {
              const armado = Date.now() >= m.armedAt;
              const pulso = 0.5 + Math.abs(Math.sin(Date.now() / (armado ? 100 : 250))) * 0.5;
              return (
                <View key={m.id} style={{ position: 'absolute', left: m.x - 10, top: m.y - 10, width: 20, height: 20, backgroundColor: armado ? '#FF4500' : '#FFA500', borderWidth: 2, borderColor: armado ? '#FF0000' : '#FFD700', opacity: pulso, transform: [{ rotate: '45deg' }], zIndex: 4 }}/>
              );
            })}

            {gs.pulses.map(p => {
              const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));
              return (
                <View key={p.id} style={{ position: 'absolute', left: p.x - currentRadius, top: p.y - currentRadius, width: currentRadius * 2, height: currentRadius * 2, borderRadius: currentRadius, borderWidth: 3, borderColor: `rgba(0, 191, 255, ${p.life / p.maxLife})`, backgroundColor: `rgba(0, 191, 255, ${(p.life / p.maxLife) * 0.2})`, zIndex: 5 }}/>
              )
            })}

            {gs.mathShots.map(ms => (
              <View key={ms.id} style={{ position: 'absolute', left: ms.x - 6, top: ms.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: ms.color, shadowColor: ms.color, shadowRadius: 8, shadowOpacity: 1, zIndex: 10 }}/>
            ))}

            {gs.enemyLasers.map(el => (
              <View key={el.id} style={[el.homing ? styles.cannonBall : styles.enemyLaser, { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color, shadowColor: el.color, shadowRadius: 6, shadowOpacity: 0.9 }]}>
                {el.homing && el.hp < 5 && <View style={{width:'100%', height:'100%', backgroundColor:'rgba(255,255,255,0.5)', borderRadius: 20}}/>}
              </View>
            ))}

            {gs.particles.map((p, i) => (
              <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }}/>
            ))}

            {gs.floatingTexts.map(ft => (
              <Text key={ft.id} style={[styles.floatingText, { left: ft.x - 30, top: ft.y, color: ft.color, opacity: ft.life / 60 }]}>{ft.text}</Text>
            ))}

            {naveStage >= 4 && (
              <View style={[styles.naveNucleo, { left: gs.player.x - 13, top: gs.player.y + 2, opacity: 0.5 + Math.abs(Math.sin(Date.now() / 180)) * 0.5 }]}/>
            )}
            {naveStage >= 3 && (
              <View style={[styles.naveAuraTras, { left: gs.player.x - 19, top: gs.player.y - 9 }]}/>
            )}
            {naveStage >= 2 && (
              <View style={[styles.naveWingLeft, naveStage >= 3 && styles.naveWingGrown, { left: gs.player.x - 23, top: gs.player.y + 4, transform: [{ rotate: '-15deg' }], borderBottomColor: gs.player.corNave }]}>
                {naveStage >= 4 && <View style={styles.naveWingTip}/>}
              </View>
            )}
            {naveStage >= 2 && (
              <View style={[styles.naveWingRight, naveStage >= 3 && styles.naveWingGrown, { left: gs.player.x + 11, top: gs.player.y + 4, transform: [{ rotate: '15deg' }], borderBottomColor: gs.player.corNave }]}>
                {naveStage >= 4 && <View style={styles.naveWingTip}/>}
              </View>
            )}
            <View style={[naveStage >= 4 ? styles.playerShapeOmega : styles.playerShape, { left: gs.player.x - 15, top: gs.player.y - 15, borderBottomColor: gs.player.corNave, shadowColor: gs.player.corNave }]}/>
            <View style={[styles.propulsor, { left: gs.player.x - 5, top: gs.player.y + 15, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
            {naveStage >= 2 && (
              <View style={[styles.propulsorSecundario, { left: gs.player.x - 14, top: gs.player.y + 13, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
            )}
            {naveStage >= 3 && (
              <View style={[styles.propulsorSecundario, { left: gs.player.x + 8, top: gs.player.y + 13, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
            )}

            {gs.forceShieldHits > 0 && (
              <View style={{ position: 'absolute', left: gs.player.x - 25, top: gs.player.y - 25, width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#00FA9A', backgroundColor: 'rgba(0,250,154,0.1)', zIndex: 10 }}/>
            )}
            {gs.drones.normal.active && <View style={[styles.droneNormal, { left: gs.player.x - 30, top: gs.player.y + 5 }]}/>}
            {gs.drones.advanced.active && <View style={[styles.droneAdvanced, { left: gs.player.x + 20, top: gs.player.y - 5 }]}/>}
          
          </View>
        </View>

        <View style={styles.painelInferior} pointerEvents="box-none">
          <View style={styles.visorRadar}>
            <Text style={styles.visorTexto}>{resposta || '_'}</Text>
          </View>
          <View style={styles.tecladoContainer} onLayout={(e) => tecladoLayoutRef.current.width = e.nativeEvent.layout.width}>
            {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((linha, i) => (
              <View key={i} style={styles.tecladoRow}>
                {linha.map(num => <BotaoRetro key={num} valor={num} isPressed={teclasPressionadas.includes(num)} onPressWeb={lidarComTeclado}/>)}
              </View>
            ))}
            <View style={styles.tecladoRow}>
              <BotaoRetro valor="apagar" isPressed={teclasPressionadas.includes('apagar')} onPressWeb={lidarComTeclado}/>
              <BotaoRetro valor="0" isPressed={teclasPressionadas.includes('0')} onPressWeb={lidarComTeclado}/>
              <BotaoRetro valor="enviar" isPressed={teclasPressionadas.includes('enviar')} onPressWeb={lidarComTeclado}/>
            </View>

            {Platform.OS !== 'web' && (
                <View 
                    style={StyleSheet.absoluteFillObject} 
                    onTouchStart={handleKbTouchStart} 
                    onTouchMove={handleKbTouchMove} 
                    onTouchEnd={handleKbTouchEnd} 
                    onTouchCancel={handleKbTouchEnd} 
                />
            )}
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050015', touchAction: 'none' as any, alignItems: 'center' },
  gameWrapper: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 500 : '100%', backgroundColor: '#050015', overflow: 'hidden' },
  
  menuScrollContent: { alignItems: 'center', paddingBottom: 20, paddingHorizontal: 20 },
  menuContainerFixed: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015', width: '100%', maxWidth: 600, paddingHorizontal: 20 },
  tituloMenu: { fontSize: 45, fontWeight: '900', color: '#00FFFF', fontStyle: 'italic', textShadowColor: '#00FFFF', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  subTituloMenu: { fontSize: 25, fontWeight: '900', color: '#FFF', letterSpacing: 5 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center', shadowColor: '#FF00FF', shadowRadius: 10, shadowOpacity: 0.6 },
  btnIniciarTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  textoFase: { color: '#9D97B5', fontSize: 16, marginTop: 10 },

  resultadoCard: { backgroundColor: 'rgba(255, 68, 68, 0.1)', padding: 30, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 10, width: '100%', borderWidth: 1, borderColor: '#FF4444' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FF4444' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },

  rankingContainer: { width: '100%', marginTop: 25, marginBottom: 15, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#FFD70040' },
  rankingHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  rankingTitle: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  rankingScrollWrapper: { maxHeight: 180, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' },
  rankingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rankingRowMe: { backgroundColor: 'rgba(0, 255, 255, 0.15)' },
  rankingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankingPosText: { fontWeight: '900', fontSize: 16, width: 30 },
  rankingNameText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  rankingScoreText: { color: '#00FFFF', fontWeight: 'bold', fontSize: 15 },
  myRankingFixed: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myRankingLabel: { color: '#AAA', fontSize: 13, fontWeight: '600' },

  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10, width: '100%', shadowColor: '#00FFFF', shadowRadius: 10, shadowOpacity: 0.5 },
  hudScore: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginBottom: 5, textShadowColor: '#00FFFF', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  hpBarContainer: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 4 },
  hudFase: { color: '#FF00FF', fontSize: 20, fontWeight: '900', fontStyle: 'italic', textShadowColor: '#FF00FF', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  
  buffContainer: { flexDirection: 'row', gap: 5, marginTop: 5 },
  buffText: { fontSize: 9, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 4 },
  
  skillBox: { width: 30, height: 30, borderWidth: 2, borderColor: '#333', borderRadius: 8, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  skillOverlay: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' },

  gameArea: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#050015', touchAction: 'none' as any, width: '100%' },
  
  gridOverlay: Platform.OS === 'web' ? {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.1,
    backgroundImage: 'linear-gradient(#00FFFF 1px, transparent 1px), linear-gradient(90deg, #00FFFF 1px, transparent 1px)' as any,
    backgroundSize: '30px 30px' as any
  } : { display: 'none' },

  bgSymbolsLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgSymbolText: { position: 'absolute', fontWeight: '900' },

  centerAlert: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  alertTextDanger: { color: '#FF0055', fontSize: 35, fontWeight: '900', textShadowColor: '#FF0055', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertTextSuccess: { color: '#32CD32', fontSize: 35, fontWeight: '900', textShadowColor: '#32CD32', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertSubText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginTop: 5 },

  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00FFFF', shadowColor: '#00FFFF', shadowRadius: 8, shadowOpacity: 0.7 },
  playerShapeOmega: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#E0FFFF', shadowColor: '#00FFFF', shadowRadius: 14, shadowOpacity: 1 },
  propulsor: { position: 'absolute', width: 10, height: 12, backgroundColor: '#FF8C00', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  propulsorSecundario: { position: 'absolute', width: 6, height: 8, backgroundColor: '#FFA500', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  naveWingLeft: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 14, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0099AA' },
  naveWingRight: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 14, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0099AA' },
  naveWingGrown: { borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 20 },
  naveWingTip: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#7DF9FF', top: 16, left: -3, shadowColor: '#7DF9FF', shadowRadius: 4, shadowOpacity: 1 },
  naveAuraTras: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 19, borderRightWidth: 19, borderBottomWidth: 38, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#AA00AA', opacity: 0.55, shadowColor: '#FF00FF', shadowRadius: 10, shadowOpacity: 0.9 },
  naveNucleo: { position: 'absolute', width: 26, height: 26, backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFFACD', transform: [{ rotate: '45deg' }], shadowColor: '#FFD700', shadowRadius: 12, shadowOpacity: 1 },
  droneNormal: { position: 'absolute', width: 10, height: 10, backgroundColor: '#1E90FF', borderRadius: 5, borderWidth: 1, borderColor: '#FFF', zIndex: 5, shadowColor: '#1E90FF', shadowRadius: 4, shadowOpacity: 0.8 },
  droneAdvanced: { position: 'absolute', width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 3, borderWidth: 1, borderColor: '#FF4444', zIndex: 5, shadowColor: '#FFD700', shadowRadius: 5, shadowOpacity: 0.9 },
  
  meteorShape: { position: 'absolute', width: 24, height: 24, backgroundColor: '#555', borderRadius: 4, borderWidth: 2, borderColor: '#777', shadowColor: '#FF6600', shadowRadius: 5, shadowOpacity: 0.5 },
  squadronShip: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 24, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  squadShadow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 24, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,0,85,0.35)' },
  flankerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 24, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFA500', filter: 'drop-shadow(0 0 6px #FFA500)' as any },
  miniShield: { position: 'absolute', top: -8, left: -16, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#00FFFF', backgroundColor: 'rgba(0,255,255,0.1)', shadowColor: '#00FFFF', shadowRadius: 6, shadowOpacity: 0.7 },
  spawnerNode: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FFFF', shadowColor: '#00FFFF', shadowRadius: 4, shadowOpacity: 1 },
  rareRing: { position: 'absolute', width: 16, height: 16, borderWidth: 2, borderColor: '#FFD700', backgroundColor: 'transparent', shadowColor: '#FFD700', shadowRadius: 6, shadowOpacity: 0.9 },
  shieldTankBody: { position: 'absolute', left: 0, top: 0, width: 30, height: 30, backgroundColor: '#37474F', borderWidth: 2, borderColor: '#90A4AE', transform: [{ rotate: '45deg' }], shadowColor: '#90A4AE', shadowRadius: 6, shadowOpacity: 0.6 },
  shieldTankTop: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 12, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#90A4AE', shadowColor: '#90A4AE', shadowRadius: 5, shadowOpacity: 0.6 },
  swarmlingShape: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#7FFF00', shadowColor: '#7FFF00', shadowRadius: 3, shadowOpacity: 0.8 },

  spawnerShape: { position: 'absolute', width: 60, height: 45, backgroundColor: 'rgba(0, 255, 255, 0.2)', borderWidth: 2, borderColor: '#00FFFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: 'transparent', zIndex: 15 },
  spawnerMath: { color: '#FFF', fontSize: 15, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 1, height: 1 } },
  xrayText: { position: 'absolute', top: -20, color: '#FF1493', fontSize: 14, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  
  bossContainer: { position: 'absolute', width: 80, height: 60, alignItems: 'center', zIndex: 20 },
  bossShip: { width: 60, height: 40, backgroundColor: '#8B0000', borderRadius: 15, borderWidth: 2, borderColor: '#FF4444' },
  bossHpBar: { width: '100%', height: 5, backgroundColor: '#333', marginBottom: 4, borderRadius: 2, overflow: 'hidden' },
  bossHpFill: { height: '100%', backgroundColor: '#FF0055' },
  bossShield: { position: 'absolute', top: -10, width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#00FFFF', backgroundColor: 'rgba(0, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center', shadowColor: '#00FFFF', shadowRadius: 10, shadowOpacity: 0.8 },
  bossMath: { color: '#FFF', fontSize: 20, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 } },

  // Naves mãe experimentais (pentágono/hexágono/estrela) - apenas visual, ainda sem habilidade própria
  bossPoligono: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  bossPentagono: { backgroundColor: '#00E5FF', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' as any, filter: 'drop-shadow(0 0 10px #00E5FF)' as any },
  bossHexagono: { backgroundColor: '#FFD700', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' as any, filter: 'drop-shadow(0 0 10px #FFD700)' as any },
  bossEstrela: { backgroundColor: '#FF3300', clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' as any, filter: 'drop-shadow(0 0 10px #FF3300)' as any },
  bossPoligonoNucleo: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', shadowColor: '#FFFFFF', shadowRadius: 8, shadowOpacity: 1 },

  powerupBox: { position: 'absolute', width: 80, height: 35, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  powerupTitle: { fontSize: 7, fontWeight: '900', position: 'absolute', top: -8, backgroundColor: '#050015', paddingHorizontal: 3 },
  powerupMath: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  powerupDots: { flexDirection: 'row', gap: 3, position: 'absolute', bottom: -6 },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, backgroundColor: '#050015' },

  laserNormal: { position: 'absolute', zIndex: 1 },
  enemyLaser: { position: 'absolute', borderRadius: 5 },
  cannonBall: { position: 'absolute', borderRadius: 16, borderWidth: 2, borderColor: '#FFF' }, 
  floatingText: { position: 'absolute', fontSize: 12, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 }, zIndex: 100, textAlign: 'center', width: 80 },

  painelInferior: { 
    backgroundColor: '#0A0025', 
    borderTopWidth: 2, 
    borderTopColor: '#FF00FF', 
    paddingHorizontal: 15, 
    paddingTop: 6, 
    paddingBottom: Platform.OS === 'android' ? 10 : 8, 
    alignItems: 'center',
    width: '100%',
    flexShrink: 1,
    shadowColor: '#FF00FF',
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 6, shadowColor: '#00FFFF', shadowRadius: 8, shadowOpacity: 0.7 },
  visorTexto: { color: '#00FFFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 8 }, 
  tecladoRow: { flexDirection: 'row', gap: 8, height: 45 }, 
  teclaRetro: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)', borderColor: '#FF4444', shadowColor: '#FF4444', shadowRadius: 6, shadowOpacity: 0.6 },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)', borderColor: '#32CD32', shadowColor: '#32CD32', shadowRadius: 6, shadowOpacity: 0.6 },
});
