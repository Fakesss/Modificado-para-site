import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/services/api';
import * as apiRoutes from '../src/services/api';
import { socket } from '../src/services/socket';

const initialWidth = Dimensions.get('window').width;
const initialHeight = Dimensions.get('window').height * 0.75;

const isMobileWeb = Platform.OS === 'web' && initialWidth < 768;
const BASE_ZOOM = (Platform.OS !== 'web' || isMobileWeb) ? 0.5 : 1;

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

export default function MathBlasterMulti() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const params = useLocalSearchParams();
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  let parsedRoomId = (params.roomId as string) || '';
  let parsedIsHost = params.isHost === 'true' || params.isHost === true;
  let parsedOpponentName = (params.opponentName as string) || 'Aliado';
  let parsedOpponentColor = (params.opponentColor as string) || '#FF00FF';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const searchQuery = window.location.search.replace('?', '');
      const query = searchQuery || hashQuery;
      const urlParams = new URLSearchParams(query);
      
      if (urlParams.has('roomId')) parsedRoomId = urlParams.get('roomId') as string;
      if (urlParams.has('isHost')) {
          const val = urlParams.get('isHost');
          parsedIsHost = val === 'true' || val === '1';
      }
      if (urlParams.has('opponentName')) parsedOpponentName = urlParams.get('opponentName') as string;
      if (urlParams.has('opponentColor')) parsedOpponentColor = decodeURIComponent(urlParams.get('opponentColor') as string);
  }

  const roomId = parsedRoomId;
  const isHost = parsedIsHost;
  const opponentName = parsedOpponentName;
  
  const instanceId = useRef(Math.random().toString(36).substring(7)).current;

  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const telaRef = useRef(tela);
  useEffect(() => { telaRef.current = tela; }, [tela]);

  const [jogoAtivo, setJogoAtivo] = useState(false);
  const jogoAtivoRef = useRef(jogoAtivo);
  useEffect(() => { jogoAtivoRef.current = jogoAtivo; }, [jogoAtivo]);

  const [frames, setFrames] = useState(0); 
  const [resposta, setResposta] = useState('');
  const [hallDaFama, setHallDaFama] = useState<any[]>([]);
  
  const gameOverFired = useRef(false);
  const dailySpawnsRef = useRef(0);
  
  const [canvasSize, setCanvasSize] = useState({ width: initialWidth, height: initialHeight });
  const canvasSizeRef = useRef({ width: initialWidth, height: initialHeight });
  
  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const triggeredTouchesRef = useRef<Set<string>>(new Set());
  const tecladoLayoutRef = useRef({ width: 350 }); 
  const kbTouchIds = useRef<Set<string>>(new Set());

  const respostaRef = useRef('');
  useEffect(() => { respostaRef.current = resposta; }, [resposta]);
  
  const layoutRef = useRef({ width: initialWidth, height: initialHeight });

  const minhaCor = user?.equipe?.cor || '#00FFFF';
  let corAliado = parsedOpponentColor;
  if (minhaCor === corAliado) corAliado = minhaCor === '#00FFFF' ? '#FFD700' : '#00FFFF';

  const gs = useRef({
    currentZoom: BASE_ZOOM,
    keys: { up: false, down: false, left: false, right: false },
    player: { 
      x: initialWidth / 2, y: initialHeight - 60, hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false,
      weapons: {
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 },
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 45, damageMult: 1 },
        electric: { active: false, level: 1, baseCooldown: 7000, lastFire: 0, damageMult: 2, chainCount: 3 }
      }
    },
    aliado: { x: initialWidth / 2 + 30, y: initialHeight - 60, hp: 100, maxHp: 100 },
    lasers: [] as any[], specialLasers: [] as any[], mathShots: [] as any[], pulses: [] as any[], floatingTexts: [] as any[], 
    enemies: [] as any[], enemyLasers: [] as any[], powerups: [] as any[], particles: [] as any[],
    boss: { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0, scoreAliado: 0, fase: 1, gameState: 'WAVES', stateTimer: 0, lastPowerupSpawn: 0, movementTouchId: null as string | null, lastTouchX: 0, lastTouchY: 0,
    timeAlive: 0, flawlessBossesCount: 0, tookDamageThisBoss: false, timeFreezeTimer: 0, forceShieldHits: 0, xRayTimer: 0,
    drones: {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    }
  }).current;

  const loopRef = useRef<any>(null);

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

    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, []);

  const carregarHallDaFama = async () => {
    try {
      if (typeof (apiRoutes as any).getRankingMathBlaster === 'function') {
          const data = await (apiRoutes as any).getRankingMathBlaster();
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

  useEffect(() => {
    if (!roomId) return;

    const joinRoom = () => {
        if (socket.connected) {
            // Emite de várias formas para garantir que o backend Python aceite a sala
            socket.emit('join_game_room', { roomId });
            socket.emit('join_room', { room: roomId }); 
            socket.emit('joinRoom', roomId); 
            
            // HANDSHAKE DE AUTO-START CONSTANTE
            if (telaRef.current === 'menu' && !jogoAtivoRef.current) {
                if (!isHost) {
                    socket.emit('game_action', { roomId, instanceId, action: 'GUEST_READY' });
                } else {
                    socket.emit('game_action', { roomId, instanceId, action: 'HOST_READY' });
                }
            }
        }
    };

    joinRoom(); 
    socket.on('connect', joinRoom);
    // Grita para o servidor a cada 1 segundo garantindo que o outro receba quando chegar
    const interval = setInterval(joinRoom, 1000);

    const handleSocketAcao = (payload: any) => {
      if (!payload || payload.instanceId === instanceId) return; 

      // SE O HOST OUVIR QUE O CONVIDADO CHEGOU -> DÁ O START NA PARTIDA PRA TODO MUNDO
      if (payload.action === 'GUEST_READY') {
          if (isHost && telaRef.current === 'menu' && !jogoAtivoRef.current) {
              iniciarJogo();
          }
      }

      // SE O CONVIDADO OUVIR QUE O HOST JÁ TÁ PRONTO, ELE AVISA QUE CHEGOU
      if (payload.action === 'HOST_READY') {
          if (!isHost && telaRef.current === 'menu' && !jogoAtivoRef.current) {
              socket.emit('game_action', { roomId, instanceId, action: 'GUEST_READY' });
          }
      }

      // INICIA O JOGO SE O SINAL DE START CHEGAR
      if (payload.action === 'START_MATCH') {
          if (!jogoAtivoRef.current) {
              iniciarJogo();
          }
      }

      if (payload.action === 'SYNC_PLAYER') {
         gs.aliado.x = payload.data.x;
         gs.aliado.y = payload.data.y;
         gs.aliado.hp = payload.data.hp;
         gs.scoreAliado = payload.data.score;
      }
      
      if (payload.action === 'SYNC_HOST_STATE' && !isHost) {
         gs.enemies = payload.data.enemies || [];
         gs.boss = payload.data.boss || gs.boss;
         gs.powerups = payload.data.powerups || [];
         gs.enemyLasers = payload.data.enemyLasers || [];
      }

      if (payload.action === 'SOLVED_MATH') {
         verificarRespostaRemota(payload.data.respostaNum, payload.data.x, payload.data.y);
      }

      if (payload.action === 'SYNC_FASE' && !isHost) {
          gs.fase = payload.data.fase;
          gs.gameState = payload.data.gameState;
      }
    };

    socket.on('game_action', handleSocketAcao);

    return () => { 
        socket.off('connect', joinRoom);
        socket.off('game_action', handleSocketAcao);
        clearInterval(interval);
    };
  }, [roomId, isHost]);

  const enviarPosicaoSocket = () => {
     if (roomId && gs.stateTimer % 2 === 0) {
         socket.emit('game_action', {
             roomId, instanceId, action: 'SYNC_PLAYER',
             data: { x: gs.player.x, y: gs.player.y, hp: gs.player.hp, score: gs.score }
         });
     }
  };

  const enviarAcertoSocket = (respostaNum: number, alvoX: number, alvoY: number) => {
      if(roomId) {
        socket.emit('game_action', {
            roomId, instanceId, action: 'SOLVED_MATH',
            data: { respostaNum, x: alvoX, y: alvoY }
        });
      }
  };

  const goBack = () => {
      try {
          if (Platform.OS === 'web' && (window as any).ReactNativeWebView) {
              (window as any).ReactNativeWebView.postMessage('GO_BACK');
              return;
          }
      } catch (e) {}
      router.back();
  };

  const handleDesistir = () => {
      const desistirAcao = () => {
          gs.player.hp = 0;
          if (roomId) {
              socket.emit('game_action', { roomId, instanceId, action: 'SYNC_PLAYER', data: { x: gs.player.x, y: gs.player.y, hp: 0, score: gs.score }});
          }
          gameOver();
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
          if (window.confirm('Tem certeza que deseja abandonar a missão?')) {
              desistirAcao();
          }
      } else {
          Alert.alert('Desistir', 'Tem certeza que deseja abandonar a missão?', [
              { text: 'Não', style: 'cancel' },
              { text: 'Sim', style: 'destructive', onPress: desistirAcao }
          ]);
      }
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) { 
      gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color }); 
    }
  };

  const dispararMagia = (origemX: number, origemY: number, tx: number, ty: number, color: string) => { 
    gs.mathShots.push({ id: Math.random().toString(), x: origemX, y: origemY, tx, ty, color, life: 15 }); 
  };

  const verificarRespostaRemota = (num: number, aliadoX: number, aliadoY: number) => {
      let acertou = false;

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(aliadoX, aliadoY, gs.boss.x, gs.boss.y, corAliado); 
        setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 15), 350); 
      } 
      if (!acertou) {
        for (let i = 0; i < gs.enemies.length; i++) {
          let e = gs.enemies[i];
          if (e.mathRequired && !e.isDying && e.res === num) {
            acertou = true; e.solvesDone += 1; dispararMagia(aliadoX, aliadoY, e.x, e.y, corAliado);
            if (e.solvesDone >= e.solvesNeeded) {
               e.isDying = true; e.mathRequired = false;
               setTimeout(() => { e.hp = -100; criarParticulas(e.x, e.y, '#00FFFF', 15); }, 350);
            } else {
               if (!roomId || isHost) { 
                   const eq = gerarEquacao(gs.fase, getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
               }
            }
            break;
          }
        }
      }
      if (!acertou) {
        for (let i = 0; i < gs.powerups.length; i++) {
          let p = gs.powerups[i];
          if (!p.collected && p.res === num) {
            acertou = true; p.collected = true; dispararMagia(aliadoX, aliadoY, p.x, p.y, corAliado); 
            setTimeout(() => {
              criarParticulas(p.x, p.y, p.color, 10);
              p.y = 9999;
            }, 350);
            break; 
          }
        }
      }
  };

  const lidarComTeclado = useCallback((valor: string) => {
    if (!jogoAtivo || gs.player.hp <= 0) return; 
    
    if (valor === 'apagar') {
      setResposta(r => r.slice(0, -1));
    } else if (valor === 'enviar') {
      
      if (respostaRef.current === '314159') {
        if (dailySpawnsRef.current >= 5) {
            gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `LIMITE DIÁRIO ATINGIDO!`, color: '#FF4444', life: 90 });
            setResposta(''); return;
        }
        if (!roomId || isHost) {
            const gw = layoutRef.current.width;
            const eq = gerarEquacao(10, getRespostasAtivas());
            gs.enemies.push({ id: Math.random().toString(), type: 'RARE_ENEMY', x: gw / 2, y: -50, targetY: 100, hp: 9999, mathRequired: true, solvesNeeded: 1, solvesDone: 0, txt: "👑 " + eq.txt, res: eq.res, vy: 0.5, evasive: false });
        }
        dailySpawnsRef.current += 1;
        AsyncStorage.setItem('rareSpawnCount', dailySpawnsRef.current.toString()).catch(()=>{});
        setResposta(''); return;
      }

      if (respostaRef.current === '3141592') {
        gs.drones.advanced.active = true; gs.drones.advanced.baseCooldown = 500;
        gs.score += 500;
        criarParticulas(gs.player.x, gs.player.y, '#FFD700', 15);
        gs.floatingTexts.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, text: `CHEAT CODE!`, color: '#FFD700', life: 90 });
        setResposta(''); return;
      }

      const num = parseInt(respostaRef.current);
      let acertou = false;

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(gs.player.x, gs.player.y, gs.boss.x, gs.boss.y, minhaCor); 
        setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 20), 350); 
        gs.score += 5;
        enviarAcertoSocket(num, gs.player.x, gs.player.y);
      } 
      
      if (!acertou) {
        for (let i = 0; i < gs.enemies.length; i++) {
          let e = gs.enemies[i];
          if (e.mathRequired && !e.isDying && e.res === num) {
            acertou = true; e.solvesDone += 1; dispararMagia(gs.player.x, gs.player.y, e.x, e.y, minhaCor);
            if (e.solvesDone >= e.solvesNeeded) {
               e.isDying = true; e.mathRequired = false;
               
               if (e.type === 'RARE_ENEMY') {
                   if (typeof (apiRoutes as any).submitMathBlasterRareKill === 'function') {
                       (apiRoutes as any).submitMathBlasterRareKill().catch(()=>{});
                   }
                   gs.floatingTexts.push({ id: Math.random().toString(), x: e.x, y: e.y, text: `+1 PONTO GLOBAL!`, color: '#FFD700', life: 120 });
               }

               setTimeout(() => { e.hp = -100; gs.score += (e.type === 'RARE_ENEMY' ? 100 : 15); criarParticulas(e.x, e.y, '#00FFFF', 15); }, 350);
            } else {
               if (!roomId || isHost) {
                   const eq = gerarEquacao(gs.fase, getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
               }
            }
            enviarAcertoSocket(num, gs.player.x, gs.player.y);
            break;
          }
        }
      }
        
      if (!acertou) {
        for (let i = 0; i < gs.powerups.length; i++) {
          let p = gs.powerups[i];
          if (!p.collected && p.res === num) {
            acertou = true; p.collected = true; dispararMagia(gs.player.x, gs.player.y, p.x, p.y, p.color); 
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
              else if (type === 'FORCE_SHIELD') gs.forceShieldHits = 3;
              else if (type === 'DRONE_NORMAL') { if (!gs.drones.normal.active) gs.drones.normal.active = true; else gs.drones.normal.baseCooldown = Math.max(500, gs.drones.normal.baseCooldown - 200); }
              else if (type === 'TIME_FREEZE') gs.timeFreezeTimer = 5000;
              else if (type === 'X_RAY') gs.xRayTimer = 10000;
              else if (type === 'DRONE_ADVANCED') gs.drones.advanced.active = true;
              else if (type === 'DRONE_ADVANCED_UP') gs.drones.advanced.baseCooldown = Math.max(500, gs.drones.advanced.baseCooldown - 200);
              else if (type === 'ELECTRIC_UNLOCK') gs.player.weapons.electric.active = true;
              else if (type === 'ELECTRIC_COOLDOWN') { gs.player.weapons.electric.baseCooldown = Math.max(3000, gs.player.weapons.electric.baseCooldown - 500); gs.player.weapons.electric.level += 1; }
              else if (type === 'ELECTRIC_DAMAGE') { gs.player.weapons.electric.damageMult += 0.5; gs.player.weapons.electric.level += 1; }
              else if (type === 'ELECTRIC_CHAIN') { gs.player.weapons.electric.chainCount += 1; gs.player.weapons.electric.level += 1; }

              gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); 
              gs.score += 5; p.y = 9999;
            }, 350);
            enviarAcertoSocket(num, gs.player.x, gs.player.y);
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
      setResposta(r => r.length < 7 ? r + valor : r);
    }
  }, [jogoAtivo]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (!jogoAtivo || gs.timeFreezeTimer > 0) return;
            if (e.repeat) return; 

            const key = e.key ? e.key.toLowerCase() : '';
            
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault(); 
                if (key === 'w' || key === 'arrowup') gs.keys.up = true;
                if (key === 's' || key === 'arrowdown') gs.keys.down = true;
                if (key === 'a' || key === 'arrowleft') gs.keys.left = true;
                if (key === 'd' || key === 'arrowright') gs.keys.right = true;
            }

            let actionKey = '';
            if (key >= '0' && key <= '9') actionKey = key;
            else if (key === 'backspace' || key === 'delete') actionKey = 'apagar';
            else if (key === 'enter') actionKey = 'enviar';

            if (actionKey) {
                e.preventDefault();
                lidarComTeclado(actionKey);
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
      if (tentativas > 30) break; 
      
    } while (evitar.includes(res)); 
    
    return { txt, res };
  };

  const iniciarJogo = () => {
    if (jogoAtivoRef.current) return; 

    gameOverFired.current = false;
    gs.keys = { up: false, down: false, left: false, right: false }; 
    
    gs.currentZoom = BASE_ZOOM;
    const initialGw = canvasSizeRef.current.width / gs.currentZoom;
    const initialGh = canvasSizeRef.current.height / gs.currentZoom;

    gs.player = { 
      x: initialGw / 2, y: initialGh - 100, 
      hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false, 
      weapons: { 
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 }, 
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 45, damageMult: 1 },
        electric: { active: false, level: 1, baseCooldown: 7000, lastFire: 0, damageMult: 2, chainCount: 3 }
      }
    };
    gs.lasers = []; gs.specialLasers = []; gs.mathShots = []; gs.pulses = []; gs.floatingTexts = [];
    gs.enemies = []; gs.enemyLasers = []; gs.powerups = []; gs.particles = [];
    gs.boss = { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 };
    gs.score = 0; gs.fase = 1; gs.gameState = 'WAVES'; gs.stateTimer = 0; gs.movementTouchId = null;
    
    gs.timeAlive = 0; gs.flawlessBossesCount = 0; gs.tookDamageThisBoss = false; gs.timeFreezeTimer = 0; gs.forceShieldHits = 0; gs.xRayTimer = 0;
    gs.drones = {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    };
    
    setResposta(''); 
    setTela('jogo');
    setJogoAtivo(true);

    if (roomId && isHost) {
        socket.emit('game_action', { roomId, instanceId, action: 'START_MATCH' });
        // Dispara algumas vezes para garantir que o cliente pegue o pacote via socket
        setTimeout(() => { if (socket.connected) socket.emit('game_action', { roomId, instanceId, action: 'START_MATCH' }); }, 500);
        setTimeout(() => { if (socket.connected) socket.emit('game_action', { roomId, instanceId, action: 'START_MATCH' }); }, 1000);
    }
    
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); 
  };

  const gameOver = () => { 
    if (gameOverFired.current) return;
    gameOverFired.current = true;
    
    setJogoAtivo(false); 
    if (loopRef.current) clearInterval(loopRef.current); 
    setTela('resultado');
    
    if (roomId) {
        if (gs.score > 0 || gs.scoreAliado > 0) {
            if (typeof (apiRoutes as any).submitMathBlasterScore === 'function') {
                (apiRoutes as any).submitMathBlasterScore(gs.score + gs.scoreAliado)
                  .then(() => carregarHallDaFama())
                  .catch(() => carregarHallDaFama());
            } else {
                carregarHallDaFama();
            }
        } else {
            carregarHallDaFama();
        }
    } else {
        if (gs.score > 0) {
          if (typeof (apiRoutes as any).submitMathBlasterScore === 'function') {
              (apiRoutes as any).submitMathBlasterScore(gs.score)
                .then(() => carregarHallDaFama())
                .catch(() => carregarHallDaFama());
          } else {
              carregarHallDaFama();
          }
        } else {
          carregarHallDaFama();
        }
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
    
    gs.timeAlive += 30;
    if (gs.timeFreezeTimer > 0) gs.timeFreezeTimer -= 30;
    if (gs.xRayTimer > 0) gs.xRayTimer -= 30;

    enviarPosicaoSocket();
    
    if (isHost && roomId && gs.stateTimer % 2 === 0) { 
        socket.emit('game_action', {
            roomId, instanceId, action: 'SYNC_HOST_STATE',
            data: { enemies: gs.enemies, boss: gs.boss, powerups: gs.powerups, enemyLasers: gs.enemyLasers }
        });
    }

    const movSpeed = 6 / gs.currentZoom;
    if (gs.keys.up) gs.player.y -= movSpeed;
    if (gs.keys.down) gs.player.y += movSpeed;
    if (gs.keys.left) gs.player.x -= movSpeed;
    if (gs.keys.right) gs.player.x += movSpeed;

    const aplicarDano = (dano: number) => {
      if (gs.player.hp <= 0) return; // Impede a nave zumbi de tomar mais dano

      if (gs.forceShieldHits > 0) {
        gs.forceShieldHits -= 1;
        criarParticulas(gs.player.x, gs.player.y, '#00FA9A', 5);
        gs.player.y += 20; 
      } else {
        gs.player.hp = Math.max(0, gs.player.hp - dano);
        if (gs.gameState === 'BOSS') gs.tookDamageThisBoss = true;
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5);
        gs.player.y += 20; 
      }
    };

    const maxX = Math.max(20, gw - 20);
    const maxY = Math.max(20, gh - 20);
    if (gs.player.x < 20) gs.player.x = 20; if (gs.player.x > maxX) gs.player.x = maxX;
    if (gs.player.y < 20) gs.player.y = 20; if (gs.player.y > maxY) gs.player.y = maxY;

    // BLOCO DE TIRO: Só atira se o player estiver vivo
    if (gs.player.hp > 0) {
        if (now - gs.player.lastFire > gs.player.fireRate) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
          if (gs.player.tripleShot) {
            gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 10, y: gs.player.y - 15, vx: -3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
            gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 10, y: gs.player.y - 15, vx: 3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
          }
          gs.player.lastFire = now;
        }

        if (gs.player.weapons.missile.active && now - gs.player.weapons.missile.lastFire > gs.player.weapons.missile.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -8, damage: gs.player.damage * gs.player.weapons.missile.damageMult, size: gs.player.shotSize * 3, type: 'MISSILE', life: gs.player.weapons.missile.life, aoeRange: gs.player.weapons.missile.aoeRange }); 
          gs.player.weapons.missile.lastFire = now;
        }
        
        if (gs.player.weapons.laser.active && now - gs.player.weapons.laser.lastFire > gs.player.weapons.laser.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 40, vx: 0, vy: -25, damage: gs.player.damage * gs.player.weapons.laser.damageMult, size: gs.player.shotSize * 2 * gs.player.weapons.laser.sizeMult, type: 'LASER' });
          gs.player.weapons.laser.lastFire = now;
        }

        if (gs.player.weapons.electric.active && now - gs.player.weapons.electric.lastFire > gs.player.weapons.electric.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 30, vx: 0, vy: -6, damage: gs.player.damage * gs.player.weapons.electric.damageMult, size: gs.player.shotSize * 2.5, type: 'ELECTRIC', chainCount: gs.player.weapons.electric.chainCount });
          gs.player.weapons.electric.lastFire = now;
        }

        if (gs.drones.normal.active && now - gs.drones.normal.lastFire > gs.drones.normal.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 40, y: gs.player.y, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
          gs.drones.normal.lastFire = now;
        }

        if (gs.drones.advanced.active && now - gs.drones.advanced.lastFire > gs.drones.advanced.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 30, y: gs.player.y, vx: 0, vy: -5, damage: gs.player.damage * 2, size: gs.player.shotSize * 1.5, type: 'MISSILE_HOMING', life: 9999, aoeRange: 40 });
          gs.drones.advanced.lastFire = now;
        }

        if (gs.player.weapons.pulsar.active && now - gs.player.weapons.pulsar.lastFire > gs.player.weapons.pulsar.baseCooldown) {
          gs.pulses.push({ id: Math.random().toString(), maxRadius: gs.player.weapons.pulsar.radius, life: 20, maxLife: 20 });
          gs.player.weapons.pulsar.lastFire = now;
        }
    } // FIM DO BLOCO DE TIROS

    gs.pulses.forEach(p => {
      p.x = gs.player.x;
      p.y = gs.player.y;
      p.life -= 1;
      const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));

      gs.enemyLasers.forEach(el => {
        if (Math.pow(el.x - p.x, 2) + Math.pow(el.y - p.y, 2) < currentRadius * currentRadius) {
          el.hp = 0;
          criarParticulas(el.x, el.y, '#00BFFF', 2);
        }
      });

      gs.enemies.forEach(e => {
        if (!e.mathRequired && Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2) < currentRadius * currentRadius) {
          e.hp = -100;
          gs.score += 1;
          criarParticulas(e.x, e.y, '#00BFFF', 3);
        }
      });
      
      if (gs.boss.active && !gs.boss.shield && Math.pow(gs.boss.x - p.x, 2) + Math.pow(gs.boss.y - p.y, 2) < Math.pow(currentRadius + 30, 2)) {
         gs.boss.hp -= 2; 
         criarParticulas(p.x, gs.boss.y + 30, '#00BFFF', 1);
      }
    });
    gs.pulses = gs.pulses.filter(p => p.life > 0);

    gs.lasers.forEach(l => {
      if (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') {
        if (l.type === 'MISSILE') l.life -= 1;
        let closest: any = null; 
        let minDist = 999999;
        
        gs.enemies.concat(gs.boss.active ? [gs.boss] : []).forEach(e => {
          if (e.hp > 0 && !e.mathRequired && !e.invisible) { 
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

      if (l.y > -50 && l.type !== 'LASER') { 
          let hit = false;
          for (let i = 0; i < gs.enemies.length; i++) {
              let e = gs.enemies[i];
              if (!e.mathRequired && e.hp > 0 && !e.invisible) {
                  const hitRange = e.type === 'TANK' ? 25 : 15;
                  if (Math.abs(l.x - e.x) < hitRange + (l.size/2) && Math.abs(l.y - e.y) < hitRange + (l.size/2)) {
                      e.hp -= l.damage;
                      hit = true;
                      criarParticulas(l.x, l.y, '#00FFFF', 4);
                      break; 
                  }
              }
          }

          if (!hit && gs.boss.active && !gs.boss.shield && gs.boss.hp > 0) {
              if (Math.abs(l.x - gs.boss.x) < 40 + (l.size/2) && Math.abs(l.y - gs.boss.y) < 30 + (l.size/2)) {
                  gs.boss.hp -= l.damage;
                  hit = true;
                  criarParticulas(l.x, l.y, '#00FFFF', 5);
              }
          }

          if (hit && l.type !== 'ELECTRIC') {
              l.life = 0;
              l.y = -999;
          }
      }
    });
    
    gs.lasers = gs.lasers.filter(l => (l.type === 'MISSILE_HOMING' || l.type === 'ELECTRIC') ? l.y > -50 : (l.y > -50 && l.x > -20 && l.x < gw + 20));
    
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

    const speedMult = gs.timeFreezeTimer > 0 ? 0.15 : 1;

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

    gs.stateTimer += 1;

    if (gs.gameState === 'WAVES') {
      if (!roomId || isHost) {
          if (gs.stateTimer === 100) {
              if (dailySpawnsRef.current < 5 && Math.random() <= 0.10) {
                  const eq = gerarEquacao(Math.max(8, gs.fase + 4), getRespostasAtivas());
                  gs.enemies.push({ id: Math.random().toString(), type: 'RARE_ENEMY', x: Math.random() * (gw - 80) + 40, y: -50, targetY: 100, hp: 9999, mathRequired: true, solvesNeeded: 1, solvesDone: 0, txt: "👑 " + eq.txt, res: eq.res, vy: 0.5, evasive: false });
                  dailySpawnsRef.current += 1;
                  AsyncStorage.setItem('rareSpawnCount', dailySpawnsRef.current.toString()).catch(()=>{});
              }
          }

          if (gs.stateTimer % Math.max(20, 100 - gs.fase * 10) === 0) {
            const meteorVy = gs.fase === 1 ? Math.random() * 1 + 1.5 : Math.random() * 2 + 3 + (gs.fase * 0.6);
            gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: meteorVy, angle: 0 });
          }

          if (gs.stateTimer % 240 === 0 && gs.fase >= 2) {
            const isLeft = Math.random() > 0.5;
            gs.enemies.push({ id: Math.random().toString(), type: 'FLANKER', x: isLeft ? -20 : gw + 20, y: Math.random() * (gh/3), targetY: 0, hp: 2 + gs.fase * 2, vx: isLeft ? 3 + gs.fase * 1.2 : -3 - gs.fase * 1.2, vy: 1.5, angle: 0, shield: Math.random() > 0.7 ? 2 : 0 });
          }

          if (gs.fase >= 4) {
              if (gs.stateTimer % 180 === 0) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'ZIGZAG', x: Math.random() * (gw - 40) + 20, y: -30, hp: 2 + gs.fase, vy: 3 + gs.fase * 0.5, startX: 0 });
              }
              if (gs.stateTimer % 350 === 0) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'TANK', x: Math.random() * (gw - 60) + 30, y: -40, hp: 15 + gs.fase * 5, vy: 0.8 });
              }
              if (gs.stateTimer % 280 === 0) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'GHOST', x: Math.random() * (gw - 40) + 20, y: -30, hp: 3 + gs.fase, vy: 2, invisible: false, timer: 0 });
              }
          }

          if (gs.stateTimer === 600 || gs.stateTimer === 1200) {
            const eq = gerarEquacao(gs.fase, getRespostasAtivas());
            const isLeft = gs.stateTimer === 600; 
            gs.enemies.push({ id: Math.random().toString(), type: 'SPAWNER', x: isLeft ? gw * 0.25 : gw * 0.75, y: -80, targetY: 90 + Math.random() * 30, hp: 9999, mathRequired: true, solvesNeeded: Math.min(8, 2 + gs.fase), solvesDone: 0, txt: eq.txt, res: eq.res, vy: 1.5, spawnTimer: 0 });
          }

          if (gs.stateTimer % (300 - Math.min(150, gs.fase * 20)) === 0 && gs.stateTimer < 1400) {
            const cx = Math.random() * (gw - 120) + 60; 
            const baseHp = 1 + (gs.fase * 2); 
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 3, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, evasive: true });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 }); 
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 });
          }

          if (gs.stateTimer % 500 === 0 && gs.fase >= 3) {
            const cx = gw / 2;
            const baseHp = 2 + gs.fase;
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 120, isLeader: true, hp: baseHp * 3, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, evasive: false });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 40, y: -60, targetY: 90, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 40, y: -60, targetY: 90, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 80, y: -90, targetY: 60, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 80, y: -90, targetY: 60, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
          }

          if (now - gs.lastPowerupSpawn > 15000 && gs.powerups.length < 1) {
            const tipos = [ 
              { type: 'DAMAGE', color: '#FF00FF', nome: 'DANO NAVE' }, 
              { type: 'FIRE_RATE', color: '#00FFFF', nome: 'CADÊNCIA UP' } 
            ];
            
            if (!gs.player.tripleShot) tipos.push({ type: 'TRIPLE_SHOT', color: '#FFD700', nome: 'TIRO TRIPLO' });
            
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

            if (!gs.player.weapons.electric.active) tipos.push({ type: 'ELECTRIC_UNLOCK', color: '#FFFF00', nome: 'BOLA ELÉTRICA' });
            else {
              tipos.push({ type: 'ELECTRIC_COOLDOWN', color: '#FFFF00', nome: 'ELÉTRICA: RECARGA' });
              tipos.push({ type: 'ELECTRIC_DAMAGE', color: '#FFFF00', nome: 'ELÉTRICA: DANO' });
              tipos.push({ type: 'ELECTRIC_CHAIN', color: '#FFFF00', nome: 'ELÉTRICA: CADEIA' });
            }

            if (!gs.player.weapons.pulsar.active) tipos.push({ type: 'PULSAR_UNLOCK', color: '#00BFFF', nome: 'AURA PULSAR' });
            else { 
              tipos.push({ type: 'PULSAR_COOLDOWN', color: '#00BFFF', nome: 'PULSAR: RAPIDEZ' }); 
              tipos.push({ type: 'PULSAR_RADIUS', color: '#00BFFF', nome: 'PULSAR: RAIO' }); 
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

            if (gs.flawlessBossesCount >= 3) {
              if (!gs.drones.advanced.active) {
                  tipos.push({ type: 'DRONE_ADVANCED', color: '#FFD700', nome: 'DRONE ELITE' });
              } else {
                  tipos.push({ type: 'DRONE_ADVANCED_UP', color: '#FFD700', nome: 'ELITE: RECARGA' });
              }
            }

            const sel = tipos[Math.floor(Math.random() * tipos.length)];
            const eq = gerarEquacao(gs.fase, getRespostasAtivas());
            
            gs.powerups.push({ 
              id: Math.random().toString(), x: Math.random() * (gw - 60) + 30, y: -40, 
              type: sel.type, color: sel.color, title: sel.nome, txt: eq.txt, res: eq.res, collected: false 
            });
            gs.lastPowerupSpawn = now;
          }
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
        if (!roomId || isHost) {
          const eq = gerarEquacao(gs.fase, getRespostasAtivas());
          gs.boss = { active: true, type: Math.floor(Math.random() * 5), x: gw / 2, y: -100, hp: 100 + (gs.fase * 80), maxHp: 100 + (gs.fase * 80), vx: 2 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
        }
      }
    }
    else if (gs.gameState === 'BOSS') {
      if (gs.boss.type === 3) { 
          gs.boss.timer += 1 * speedMult;
          if (gs.boss.y < 90) gs.boss.y += 3 * speedMult;
          else {
              if (gs.boss.timer % 120 === 0 && (!roomId || isHost)) { 
                  gs.boss.x = Math.random() * (gw - 100) + 50;
                  gs.boss.y = Math.random() * 100 + 50;
                  criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 15);
                  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                      gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y, vx: Math.cos(angle)*5, vy: Math.sin(angle)*5, size: 8, damage: 10 + gs.fase*2, homing: false, color: '#00FFFF', hp: 1 });
                  }
              }
          }
      } 
      else if (gs.boss.type === 4) { 
          gs.boss.timer += 1 * speedMult;
          if (gs.boss.y < 60) gs.boss.y += 1.5 * speedMult;
          else {
              gs.boss.x += Math.sin(now / 500) * 2 * speedMult;
              if (gs.boss.timer % 180 === 0 && gs.enemies.length < 5 && (!roomId || isHost)) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x - 40, y: gs.boss.y + 20, targetY: gs.boss.y + 80, isLeader: true, hp: 10 + gs.fase, vx: -2, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
                  gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x + 40, y: gs.boss.y + 20, targetY: gs.boss.y + 80, isLeader: true, hp: 10 + gs.fase, vx: 2, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
              }
          }
      }
      else { 
          if (gs.boss.y < 90) {
            gs.boss.y += 1.5 * speedMult;
          } else {
            gs.boss.x += gs.boss.vx * speedMult;
            if (gs.boss.x < 50 || gs.boss.x > gw - 50) gs.boss.vx *= -1;
            gs.boss.timer += 1 * speedMult;

            if (!roomId || isHost) {
              if (gs.boss.type === 0) {
                if (gs.boss.timer % Math.max(40, 120 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: 0, vy: 2, size: 14, damage: 5 + (gs.fase * 5), homing: true, color: '#FF8C00', hp: 5 + (gs.fase * 4) });
              } else if (gs.boss.type === 1) {
                if (gs.boss.timer % Math.max(40, 90 - (gs.fase * 5)) === 0) [-2, -1, 0, 1, 2].forEach(dir => gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: dir * 1.5, vy: 6 + gs.fase, size: 6, damage: 5 + (gs.fase * 5), homing: false, color: '#FF0055', hp: 1 }));
              } else {
                if (gs.boss.timer % Math.max(60, 150 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 20, vx: 0, vy: 15, size: 20, damage: 10 + (gs.fase * 10), homing: false, color: '#32CD32', hp: 99 });
              }
            }
          }
      }
      
      if ((!roomId || isHost) && gs.boss.y >= 60 && !gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) {
          const eq = gerarEquacao(gs.fase, getRespostasAtivas()); 
          gs.boss.shield = true; gs.boss.txt = eq.txt; gs.boss.res = eq.res;
      }
      
      if (gs.boss.hp <= 0) {
        criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 30); 
        gs.score += 50 * gs.fase;
        gs.boss.active = false; 
        gs.gameState = 'TRANSITION'; 
        gs.stateTimer = 0; 
        gs.enemies = []; gs.enemyLasers = []; 
        if (!gs.tookDamageThisBoss) gs.flawlessBossesCount += 1;
      }
    }
    else if (gs.gameState === 'TRANSITION') {
      if (gs.stateTimer > 90) { 
        gs.fase += 1; 
        gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 50); 
        gs.gameState = 'WAVES'; 
        gs.stateTimer = 0; 
        if (roomId && isHost) {
            socket.emit('game_action', { roomId, action: 'SYNC_FASE', data: { fase: gs.fase, gameState: gs.gameState } });
        }
      }
    }

    gs.enemies.forEach(e => {
      if (e.type === 'METEOR') { e.y += e.vy * speedMult; } 
      else if (e.type === 'FLANKER') { e.x += e.vx * speedMult; e.y += e.vy * speedMult; }
      else if (e.type === 'ZIGZAG') {
          if (!e.startX) e.startX = e.x;
          e.x = e.startX + Math.sin(e.y / 30) * 60;
          e.y += e.vy * speedMult;
      }
      else if (e.type === 'TANK') {
          e.y += e.vy * speedMult;
      }
      else if (e.type === 'GHOST') {
          e.timer = (e.timer || 0) + 1 * speedMult;
          e.invisible = Math.sin(e.timer / 20) > 0;
          e.y += e.vy * speedMult;
      }
      else if (e.type === 'SPAWNER' || e.type === 'RARE_ENEMY') {
        if (e.y < e.targetY) e.y += e.vy * speedMult;
        else {
           e.x += Math.sin(now / 500) * 0.5 * speedMult; 
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
        } else {
          if (e.y < e.targetY) e.y += e.vy * speedMult; 
          else {
            e.x += Math.sin(now / 300) * 1.5 * speedMult;
          }
        }
      }
      
      if ((e.type === 'SQUAD' || e.type === 'TANK' || e.type === 'ZIGZAG') && (!roomId || isHost)) {
          e.fireTimer = (e.fireTimer || 0) + 1 * speedMult;
          const rate = e.type === 'TANK' ? 80 : 150;
          if (e.fireTimer > rate) {
              e.fireTimer = 0;
              gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 10, vx: 0, vy: 4 + gs.fase * 0.5, size: e.type==='TANK'?12:8, damage: 5 + gs.fase*2, homing: false, color: e.type==='TANK'?'#FFA500':'#FF0055', hp: 1 });
          }
      }

      if (Math.abs(gs.player.x - e.x) < 25 && Math.abs(gs.player.y - e.y) < 25 && !e.invisible) { 
        aplicarDano(5 + (gs.fase * 5)); 
        if (!e.mathRequired) e.hp = -100; 
      }
    });

    gs.powerups.forEach(p => { if (!p.collected) p.y += 1.5; }); 

    gs.enemies.forEach(e => { 
      if (e.hp <= 0 && e.hp > -90) { 
        gs.score += e.isLeader ? 3 : 1;
        criarParticulas(e.x, e.y, e.type === 'SQUAD' ? '#FF0055' : '#AAA', 10); 
      } 
    });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < gh + 20); 
    gs.powerups = gs.powerups.filter(p => p.y < gh + 50);

    if (roomId) {
        if (gs.player.hp <= 0 && gs.aliado.hp <= 0) gameOver();
    } else {
        if (gs.player.hp <= 0) gameOver();
    }
    
    setFrames(f => f + 1); 
  };

  const porcentagemHP = Math.max(0, (gs.player.hp / gs.player.maxHp) * 100);
  const corHP = porcentagemHP > 50 ? '#32CD32' : porcentagemHP > 25 ? '#FFD700' : '#FF4444';

  const renderBuffs = () => (
    <View style={styles.buffContainer}>
      <Text style={[styles.buffText, { color: '#FF00FF' }]}>ATK: {gs.player.damage.toFixed(1)}</Text>
      <Text style={[styles.buffText, { color: '#00FFFF' }]}>TIRO: {(gs.player.fireRate / 1000).toFixed(2)}s</Text>
      {gs.player.tripleShot && <Text style={[styles.buffText, { color: '#FFD700' }]}>TRIPLO</Text>}
      {gs.timeFreezeTimer > 0 && <Text style={[styles.buffText, { color: '#E0FFFF' }]}>GELO</Text>}
      {gs.xRayTimer > 0 && <Text style={[styles.buffText, { color: '#FF1493' }]}>RAIO-X</Text>}
    </View>
  );

  const renderCooldownBox = (weaponKey: 'missile' | 'laser' | 'pulsar' | 'electric', color: string, icon: string) => {
    const w = gs.player.weapons[weaponKey];
    if (!w.active) return null;
    const pct = Math.max(0, Math.min(100, ((Date.now() - w.lastFire) / w.baseCooldown) * 100));
    const totalDamage = weaponKey === 'pulsar' ? 'MAX' : (gs.player.damage * w.damageMult).toFixed(1);
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

          {/* NOVO: No Multiplayer o botão some completamente */}
          {!roomId ? (
            <TouchableOpacity style={styles.btnIniciar} onPress={iniciarJogo}>
              <Text style={styles.btnIniciarTxt}>INICIAR MISSÃO</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.btnIniciar, { backgroundColor: '#333' }]}>
              <Text style={[styles.btnIniciarTxt, { color: '#888' }]}>
                {isHost ? 'AGUARDANDO ALIADO...' : 'CONECTANDO AO LÍDER...'}
              </Text>
            </View>
          )}

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
          
          <Text style={styles.textoFase}>Chegou na Fase {gs.fase}</Text>
          
          {!roomId && (
              <TouchableOpacity style={[styles.btnIniciar, { marginTop: 40 }]} onPress={iniciarJogo}>
                <Text style={styles.btnIniciarTxt}>TENTAR NOVAMENTE</Text>
              </TouchableOpacity>
          )}

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
            <Text style={styles.hudScore}>SCORE: {gs.score} {roomId ? `| ALIADO: ${gs.scoreAliado}` : ''}</Text>
            <View style={{flexDirection:'row', gap: 5, width: '100%', marginTop: 2}}>
                <View style={[styles.hpBarContainer, { flex: 1, width: 'auto' }]}>
                  <View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]}/>
                </View>
                {roomId && (
                  <View style={[styles.hpBarContainer, { flex: 1, width: 'auto' }]}>
                    <View style={[styles.hpBarFill, { width: `${Math.max(0, (gs.aliado.hp / gs.aliado.maxHp) * 100)}%`, backgroundColor: corAliado }]}/>
                  </View>
                )}
            </View>
            {renderBuffs()}
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
            <Text style={[styles.hudFase, { alignSelf: 'flex-start', marginTop: 15, marginRight: 5 }]}>FASE {gs.fase}</Text>
            {renderCooldownBox('electric', '#FFFF00', 'flash-outline')}
            {renderCooldownBox('missile', '#FF4444', 'rocket')}
            {renderCooldownBox('laser', '#32CD32', 'flash')}
            {renderCooldownBox('pulsar', '#00BFFF', 'shield')} 
          </View>
        </View>

        <View style={[styles.gameArea, gs.timeFreezeTimer > 0 && { borderColor: '#E0FFFF', borderWidth: 2 }]} 
          onLayout={(e) => { 
            const { width, height } = e.nativeEvent.layout;
            if (Math.abs(width - canvasSizeRef.current.width) > 5 || Math.abs(height - canvasSizeRef.current.height) > 5) {
                setCanvasSize({ width, height }); 
                canvasSizeRef.current = { width, height }; 
            }
          }} 
          onTouchStart={handleGameTouchStart} 
          onTouchMove={handleGameTouchMove} 
          onTouchEnd={handleGameTouchEnd} 
          onTouchCancel={handleGameTouchEnd}
        >
          
          {gs.gameState === 'BOSS_WARNING' && (<View style={styles.centerAlert}><Text style={styles.alertTextDanger}>ATENÇÃO</Text><Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text></View>)}
          {gs.gameState === 'TRANSITION' && (<View style={styles.centerAlert}><Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text><Text style={styles.alertSubText}>PREPARANDO SALTO...</Text></View>)}
          
          {jogoAtivo && roomId && (
             <TouchableOpacity style={[styles.btnDesistir, { top: Math.max(insets.top, 10) + 10 }]} onPress={handleDesistir}>
                 <Ionicons name="exit-outline" size={24} color="#FFF" />
             </TouchableOpacity>
          )}

          <View style={{
            position: 'absolute',
            width: canvasSize.width / gs.currentZoom,
            height: canvasSize.height / gs.currentZoom,
            left: -(canvasSize.width / gs.currentZoom - canvasSize.width) / 2,
            top: -(canvasSize.height / gs.currentZoom - canvasSize.height) / 2,
            transform: [{ scale: gs.currentZoom }],
          }}>

            <View style={styles.gridOverlay}/>

            {gs.enemies.map(e => {
              if (e.type === 'METEOR') return <View key={e.id} style={[styles.meteorShape, { left: e.x - 12, top: e.y - 12 }]}/>;
              if (e.type === 'FLANKER') return ( <View key={e.id} style={[styles.flankerShape, { left: e.x - 10, top: e.y - 8, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}>{e.shield > 0 && <View style={styles.miniShield}/>}</View>);
              
              if (e.type === 'ZIGZAG') return <View key={e.id} style={[styles.zigzagShape, { left: e.x - 15, top: e.y - 15 }]}/>;
              if (e.type === 'TANK') return <View key={e.id} style={[styles.tankShape, { left: e.x - 20, top: e.y - 20 }]}/>;
              if (e.type === 'GHOST') return <View key={e.id} style={[styles.ghostShape, { left: e.x - 18, top: e.y - 18, opacity: e.invisible ? 0.2 : 1 }]}/>;

              if (e.type === 'RARE_ENEMY') {
                return (
                   <View key={e.id} style={[styles.spawnerShape, { left: e.x - 35, top: e.y - 25, backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700', shadowColor: 'transparent' }]}>
                      <Text style={[styles.spawnerMath, { color: '#FFD700' }]}>{e.txt}</Text>
                      {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                   </View>
                );
              }

              if (e.type === 'SPAWNER') {
                return (
                   <View key={e.id} style={[styles.spawnerShape, { left: e.x - 30, top: e.y - 22 }]}>
                      <Text style={styles.spawnerMath}>{e.txt}</Text>
                      {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                      <View style={styles.powerupDots}>
                        {Array.from({length: e.solvesNeeded}).map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i < e.solvesDone ? '#00FFFF' : 'transparent', borderColor: '#00FFFF' }]}/>))}
                      </View>
                   </View>
                );
              }
              const rot = e.isLeader ? (e.angle - Math.PI/2) + 'rad' : '0rad'; 
              return (<View key={e.id} style={[styles.squadronShip, { left: e.x - 12, top: e.y - 12, borderTopColor: e.isLeader ? '#FF00FF' : '#FF0055', transform: [{ rotate: rot }] }]}>{e.shield > 0 && <View style={styles.miniShield}/>}</View>);
            })}

            {gs.boss.active && (
              <View style={[styles.bossContainer, { left: gs.boss.x - 40, top: gs.boss.y - 30 }]}>
                <View style={styles.bossHpBar}><View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]}/></View>
                <View style={[styles.bossShip, gs.boss.type === 1 && { borderRadius: 0, backgroundColor: '#4B0082', borderColor: '#FF00FF' }, gs.boss.type === 2 && { borderRadius: 30, height: 60, backgroundColor: '#006400', borderColor: '#32CD32' }, gs.boss.type === 3 && { borderRadius: 10, backgroundColor: '#4B0082', borderColor: '#00FFFF' }, gs.boss.type === 4 && { borderRadius: 20, backgroundColor: '#8B4513', borderColor: '#FF00FF' }]}/>
                {gs.boss.shield && (
                  <View style={styles.bossShield}>
                    <Text style={styles.bossMath}>{gs.boss.txt}</Text>
                    {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{gs.boss.res}</Text>}
                  </View>
                )}
              </View>
            )}

            {gs.powerups.map(p => (
              <View key={p.id} style={[styles.powerupBox, { left: p.x - 40, top: p.y - 18, borderColor: p.color, opacity: p.collected ? 0.4 : 1 }]}>
                <Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={styles.powerupMath}>{p.txt}</Text>
              </View>
            ))}

            {gs.lasers.map(l => (
              <View key={l.id} style={[styles.laserNormal, { 
                left: l.x - (l.size/2), 
                top: l.y, 
                width: l.size, 
                height: l.type === 'MISSILE' ? l.size : (l.type === 'MISSILE_HOMING' ? l.size : (l.type === 'LASER' ? l.size * 8 : (l.type === 'ELECTRIC' ? l.size : l.size * 3))), 
                backgroundColor: l.type === 'LASER' ? '#32CD32' : l.type === 'MISSILE' ? '#FF4444' : l.type === 'MISSILE_HOMING' ? '#FFD700' : l.type === 'ELECTRIC' ? '#FFFF00' : '#00FFFF', 
                borderRadius: (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING' || l.type === 'ELECTRIC') ? l.size / 2 : 5,
                shadowColor: l.type === 'ELECTRIC' ? '#FFFF00' : 'transparent',
                shadowRadius: l.type === 'ELECTRIC' ? 10 : 0
              }]}/>
            ))}

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
              <View key={el.id} style={[el.homing ? styles.cannonBall : styles.enemyLaser, { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color }]}>
                {el.homing && el.hp < 5 && <View style={{width:'100%', height:'100%', backgroundColor:'rgba(255,255,255,0.5)', borderRadius: 20}}/>}
              </View>
            ))}

            {gs.particles.map((p, i) => (
              <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }}/>
            ))}

            {gs.floatingTexts.map(ft => (
              <Text key={ft.id} style={[styles.floatingText, { left: ft.x - 30, top: ft.y, color: ft.color, opacity: ft.life / 60 }]}>{ft.text}</Text>
            ))}

            {gs.player.hp > 0 && (
                <>
                  <View style={[styles.playerShape, { left: gs.player.x - 15, top: gs.player.y - 15, borderBottomColor: minhaCor }]}/>
                  <View style={[styles.propulsor, { left: gs.player.x - 5, top: gs.player.y + 15, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
                  <Text style={{ position:'absolute', color: minhaCor, fontSize: 10, left: gs.player.x - 20, top: gs.player.y + 25, fontWeight: 'bold' }}>VOCÊ</Text>
                </>
            )}
            
            {roomId && gs.aliado.hp > 0 && (
                <>
                    <View style={[styles.playerShape, { left: gs.aliado.x - 15, top: gs.aliado.y - 15, borderBottomColor: corAliado, opacity: 0.8 }]}/>
                    <View style={[styles.propulsor, { left: gs.aliado.x - 5, top: gs.aliado.y + 15, opacity: Math.random() > 0.5 ? 0.8 : 0.3 }]} />
                    <Text style={{ position:'absolute', color: corAliado, fontSize: 10, left: gs.aliado.x - 20, top: gs.aliado.y + 25, fontWeight: 'bold', opacity: 0.8 }}>{opponentName}</Text>
                </>
            )}

            {gs.forceShieldHits > 0 && (
              <View style={{ position: 'absolute', left: gs.player.x - 25, top: gs.player.y - 25, width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#00FA9A', backgroundColor: 'rgba(0,250,154,0.1)', zIndex: 10 }}/>
            )}
            {gs.drones.normal.active && <View style={[styles.droneNormal, { left: gs.player.x - 30, top: gs.player.y + 5 }]}/>}
            {gs.drones.advanced.active && <View style={[styles.droneAdvanced, { left: gs.player.x + 20, top: gs.player.y - 5 }]}/>}
          
          </View>
        </View>

        <View style={[styles.painelInferior, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
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
  tituloMenu: { fontSize: 45, fontWeight: '900', color: '#00FFFF', fontStyle: 'italic' },
  subTituloMenu: { fontSize: 25, fontWeight: '900', color: '#FFF', letterSpacing: 5 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center' },
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

  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10, width: '100%' },
  hudScore: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 4 },
  hudFase: { color: '#FF00FF', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  
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
  
  centerAlert: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  alertTextDanger: { color: '#FF0055', fontSize: 35, fontWeight: '900', textShadowColor: '#FF0055', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertTextSuccess: { color: '#32CD32', fontSize: 35, fontWeight: '900', textShadowColor: '#32CD32', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertSubText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginTop: 5 },

  btnDesistir: { position: 'absolute', right: 15, zIndex: 100, backgroundColor: 'rgba(231, 76, 60, 0.8)', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FFF' },

  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00FFFF' },
  propulsor: { position: 'absolute', width: 10, height: 12, backgroundColor: '#FF8C00', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  droneNormal: { position: 'absolute', width: 10, height: 10, backgroundColor: '#1E90FF', borderRadius: 5, borderWidth: 1, borderColor: '#FFF', zIndex: 5 },
  droneAdvanced: { position: 'absolute', width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 3, borderWidth: 1, borderColor: '#FF4444', zIndex: 5 },
  
  meteorShape: { position: 'absolute', width: 24, height: 24, backgroundColor: '#555', borderRadius: 4, borderWidth: 2, borderColor: '#777' },
  squadronShip: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 24, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  flankerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 16, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFA500' },
  zigzagShape: { position: 'absolute', width: 30, height: 30, backgroundColor: '#9B59B6', borderRadius: 5, transform: [{ rotate: '45deg' }] }, 
  tankShape: { position: 'absolute', width: 40, height: 40, backgroundColor: '#2E8B57', borderRadius: 8, borderWidth: 2, borderColor: '#006400' }, 
  ghostShape: { position: 'absolute', width: 36, height: 36, backgroundColor: '#E0FFFF', borderRadius: 18, borderWidth: 1, borderColor: '#FFF' }, 

  miniShield: { position: 'absolute', top: -8, left: -16, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#00FFFF', backgroundColor: 'rgba(0,255,255,0.1)' },
  
  spawnerShape: { position: 'absolute', width: 60, height: 45, backgroundColor: 'rgba(0, 255, 255, 0.2)', borderWidth: 2, borderColor: '#00FFFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: 'transparent', zIndex: 15 },
  spawnerMath: { color: '#FFF', fontSize: 15, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 1, height: 1 } },
  xrayText: { position: 'absolute', top: -20, color: '#FF1493', fontSize: 14, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 } },
  
  bossContainer: { position: 'absolute', width: 80, height: 60, alignItems: 'center', zIndex: 20 },
  bossShip: { width: 60, height: 40, backgroundColor: '#8B0000', borderRadius: 15, borderWidth: 2, borderColor: '#FF4444' },
  bossHpBar: { width: '100%', height: 5, backgroundColor: '#333', marginBottom: 4, borderRadius: 2, overflow: 'hidden' },
  bossHpFill: { height: '100%', backgroundColor: '#FF0055' },
  bossShield: { position: 'absolute', top: -10, width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#00FFFF', backgroundColor: 'rgba(0, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center' },
  bossMath: { color: '#FFF', fontSize: 20, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 } },

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
    position: 'absolute',
    width: '100%', 
    alignItems: 'center', 
    paddingTop: 5, 
    backgroundColor: 'transparent', 
    zIndex: 10 
  },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 6 }, 
  visorTexto: { color: '#00FFFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 8 }, 
  tecladoRow: { flexDirection: 'row', gap: 8, height: 45 }, 
  teclaRetro: { flex: 1, backgroundColor: 'rgba(26, 26, 46, 0.75)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)', borderColor: '#32CD32' },
});
