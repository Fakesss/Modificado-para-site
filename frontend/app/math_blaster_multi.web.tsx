import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import socket from '../src/services/socket'; // Conexão Multiplayer
import * as apiRoutes from '../src/services/api';

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
    <View style={[customStyle, isPressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]} {...(isWeb ? { onPointerDown: (e: any) => { e.preventDefault(); onPressWeb(valor); } } : {})}>
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
  
  // Parâmetros da sala multiplayer
  const params = useLocalSearchParams();
  const roomId = params.roomId as string;
  const isHost = params.isHost === 'true';
  const opponentName = params.opponentName as string || 'Aliado';

  const [tela, setTela] = useState<'jogo' | 'resultado'>('jogo');
  const [jogoAtivo, setJogoAtivo] = useState(true);
  const [resposta, setResposta] = useState('');
  
  const [canvasSize, setCanvasSize] = useState({ width: initialWidth, height: initialHeight });
  const canvasSizeRef = useRef({ width: initialWidth, height: initialHeight });
  
  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const respostaRef = useRef('');
  useEffect(() => { respostaRef.current = resposta; }, [resposta]);
  
  const layoutRef = useRef({ width: initialWidth, height: initialHeight });

  // Cores dinâmicas baseadas na equipe
  const minhaCor = user?.equipe?.cor || '#00FFFF';
  let corAliado = params.opponentColor as string || '#FF00FF';
  if (minhaCor === corAliado) corAliado = minhaCor === '#00FFFF' ? '#FFD700' : '#00FFFF'; // Impede cores iguais

  const gs = useRef({
    currentZoom: BASE_ZOOM,
    keys: { up: false, down: false, left: false, right: false },
    player: { x: initialWidth / 2 - 30, y: initialHeight - 60, hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false, weapons: { electric: { active: false, level: 1, baseCooldown: 7000, lastFire: 0, damageMult: 2, chainCount: 3 } } },
    aliado: { x: initialWidth / 2 + 30, y: initialHeight - 60, hp: 100, maxHp: 100 }, // DADOS DO SEU AMIGO
    lasers: [] as any[], mathShots: [] as any[], pulses: [] as any[], floatingTexts: [] as any[], 
    enemies: [] as any[], enemyLasers: [] as any[], powerups: [] as any[], particles: [] as any[],
    boss: { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0, scoreAliado: 0, fase: 1, gameState: 'WAVES', stateTimer: 0, lastPowerupSpawn: 0, movementTouchId: null as string | null, lastTouchX: 0, lastTouchY: 0,
    timeAlive: 0, flawlessBossesCount: 0, forceShieldHits: 0, xRayTimer: 0, drones: { normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 }, advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 } }
  }).current;

  const loopRef = useRef<any>(null);

  // INICIALIZAÇÃO E COMUNICAÇÃO VIA SOCKET
  useEffect(() => {
    if (!roomId) { Alert.alert('Erro', 'Sala não encontrada.'); router.back(); return; }

    const handleSocketAcao = (payload: any) => {
      if (!payload || payload.userId === user?.id) return; // Ignora as próprias mensagens

      // 1. Sincroniza a posição e a vida do seu amigo
      if (payload.action === 'SYNC_PLAYER') {
         gs.aliado.x = payload.data.x;
         gs.aliado.y = payload.data.y;
         gs.aliado.hp = payload.data.hp;
         gs.scoreAliado = payload.data.score;
      }
      
      // 2. Se o aliado atirou e acertou a resposta, o inimigo morre aqui também!
      if (payload.action === 'SOLVED_MATH') {
         verificarRespostaRemota(payload.data.respostaNum, payload.data.x, payload.data.y);
      }

      // 3. Se o host avançar de fase, o convidado acompanha
      if (payload.action === 'SYNC_FASE' && !isHost) {
          gs.fase = payload.data.fase;
          gs.gameState = payload.data.gameState;
      }
    };

    socket.on('game_action', handleSocketAcao);

    // Inicia o Jogo
    loopRef.current = setInterval(gameTick, 30); 

    return () => { 
        socket.off('game_action', handleSocketAcao);
        if (loopRef.current) clearInterval(loopRef.current); 
    };
  }, []);

  const enviarPosicaoSocket = () => {
     if (gs.stateTimer % 3 === 0) { // Envia 10 vezes por segundo para não travar o servidor
         socket.emit('game_action', {
             roomId, userId: user?.id, action: 'SYNC_PLAYER',
             data: { x: gs.player.x, y: gs.player.y, hp: gs.player.hp, score: gs.score }
         });
     }
  };

  const enviarAcertoSocket = (respostaNum: number, alvoX: number, alvoY: number) => {
      socket.emit('game_action', {
          roomId, userId: user?.id, action: 'SOLVED_MATH',
          data: { respostaNum, x: gs.player.x, y: gs.player.y }
      });
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) { gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color }); }
  };

  const dispararMagia = (origemX: number, origemY: number, tx: number, ty: number, color: string) => { 
    gs.mathShots.push({ id: Math.random().toString(), x: origemX, y: origemY, tx, ty, color, life: 15 }); 
  };

  // QUANDO O ALIADO ACERTA UMA CONTA
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
               const eq = gerarEquacao(gs.fase, getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
            }
            break;
          }
        }
      }
  };

  // QUANDO VOCÊ DIGITA UMA RESPOSTA
  const lidarComTeclado = useCallback((valor: string) => {
    if (!jogoAtivo || gs.player.hp <= 0) return; // Se você morreu, não atira
    if (valor === 'apagar') { setResposta(r => r.slice(0, -1)); } 
    else if (valor === 'enviar') {
      const num = parseInt(respostaRef.current);
      let acertou = false;

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(gs.player.x, gs.player.y, gs.boss.x, gs.boss.y, minhaCor); setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 20), 350); 
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
               setTimeout(() => { e.hp = -100; gs.score += 15; criarParticulas(e.x, e.y, '#00FFFF', 15); }, 350);
            } else {
               const eq = gerarEquacao(gs.fase, getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
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
              else if (type === 'ELECTRIC_UNLOCK') gs.player.weapons.electric.active = true;
              else if (type === 'ELECTRIC_COOLDOWN') { gs.player.weapons.electric.baseCooldown = Math.max(3000, gs.player.weapons.electric.baseCooldown - 500); gs.player.weapons.electric.level += 1; }
              else if (type === 'ELECTRIC_DAMAGE') { gs.player.weapons.electric.damageMult += 0.5; gs.player.weapons.electric.level += 1; }
              else if (type === 'ELECTRIC_CHAIN') { gs.player.weapons.electric.chainCount += 1; gs.player.weapons.electric.level += 1; }

              gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); gs.score += 5; p.y = 9999;
            }, 350);
            enviarAcertoSocket(num, gs.player.x, gs.player.y); // O aliado também precisa apagar o powerup da tela dele
            break; 
          }
        }
      }

      if (!acertou && respostaRef.current !== '') { 
        gs.player.hp = Math.max(0, gs.player.hp - (3 + (gs.fase * 2))); 
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5); 
      }
      setResposta('');
    } else {
      setResposta(r => r.length < 7 ? r + valor : r);
    }
  }, [jogoAtivo]);

  // CONTROLE DO TECLADO
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (!jogoAtivo) return;
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
        return () => { window.removeEventListener('keydown', handleKeyDownLocal); window.removeEventListener('keyup', handleKeyUpLocal); };
    }
  }, [jogoAtivo, lidarComTeclado]);

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

    let tentativas = 0;
    do {
      tipo = operacoes[Math.floor(Math.random() * operacoes.length)];
      if (tipo === 'soma') { const max = fase === 1 ? 5 : 10 + (fase * 3); n1 = r(1, max); n2 = r(1, max); res = n1 + n2; txt = `${n1} + ${n2}`; }
      else if (tipo === 'subtracao') { const max = fase === 1 ? 6 : 15 + (fase * 3); const min = fase === 1 ? 2 : 5; n1 = r(min, max); n2 = r(1, n1 - 1); res = n1 - n2; txt = `${n1} - ${n2}`; }
      else if (tipo === 'multiplicacao') { const maxNum = Math.min(15, 4 + Math.floor(fase / 2)); n1 = r(2, maxNum); n2 = r(2, maxNum); res = n1 * n2; txt = `${n1} × ${n2}`; }
      else if (tipo === 'divisao') { const maxDivisor = Math.min(10, 2 + Math.floor((fase - 7) / 2)); n2 = r(2, Math.max(5, maxDivisor)); res = r(2, 9); n1 = n2 * res; txt = `${n1} ÷ ${n2}`; }
      tentativas++; if (tentativas > 30) break; 
    } while (evitar.includes(res)); 
    return { txt, res };
  };

  const gameTick = () => {
    const now = Date.now();
    gs.currentZoom = BASE_ZOOM === 1 ? 1 : Math.max(0.35, BASE_ZOOM - ((gs.fase - 1) * 0.03));
    
    if (canvasSizeRef.current.width > 0) {
        layoutRef.current.width = canvasSizeRef.current.width / gs.currentZoom;
        layoutRef.current.height = canvasSizeRef.current.height / gs.currentZoom;
    }
    const gw = layoutRef.current.width; const gh = layoutRef.current.height;
    
    gs.timeAlive += 30; gs.stateTimer += 1;
    enviarPosicaoSocket(); // Manda a sua posição pro amigo
    
    if (gs.player.hp > 0) {
        const movSpeed = 6 / gs.currentZoom;
        if (gs.keys.up) gs.player.y -= movSpeed;
        if (gs.keys.down) gs.player.y += movSpeed;
        if (gs.keys.left) gs.player.x -= movSpeed;
        if (gs.keys.right) gs.player.x += movSpeed;

        if (gs.player.x < 20) gs.player.x = 20; if (gs.player.x > gw - 20) gs.player.x = gw - 20;
        if (gs.player.y < 20) gs.player.y = 20; if (gs.player.y > gh - 20) gs.player.y = gh - 20;

        if (now - gs.player.lastFire > gs.player.fireRate) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
          if (gs.player.tripleShot) {
            gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 10, y: gs.player.y - 15, vx: -3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
            gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 10, y: gs.player.y - 15, vx: 3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL', isMine: true });
          }
          gs.player.lastFire = now;
        }

        // TIRO ELÉTRICO
        if (gs.player.weapons.electric.active && now - gs.player.weapons.electric.lastFire > gs.player.weapons.electric.baseCooldown) {
          gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 30, vx: 0, vy: -6, damage: gs.player.damage * gs.player.weapons.electric.damageMult, size: gs.player.shotSize * 2.5, type: 'ELECTRIC', chainCount: gs.player.weapons.electric.chainCount, isMine: true });
          gs.player.weapons.electric.lastFire = now;
        }
    }

    // A vida de ambos acabou = Fim de jogo
    if (gs.player.hp <= 0 && gs.aliado.hp <= 0 && !gameOverFired.current) {
        gameOverFired.current = true;
        setJogoAtivo(false);
        if (loopRef.current) clearInterval(loopRef.current);
        setTela('resultado');
        if (gs.score > 0 && typeof (apiRoutes as any).submitMathBlasterScore === 'function') {
            (apiRoutes as any).submitMathBlasterScore(gs.score + gs.scoreAliado).catch(()=>{});
        }
    }

    const aplicarDano = (dano: number) => {
      gs.player.hp = Math.max(0, gs.player.hp - dano);
      criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5);
      gs.player.y += 20; 
    };

    // MOVIMENTAÇÃO DE INIMIGOS (Se for Host, controla e avança as ondas. Se for convidado, apenas simula localmente no mesmo tempo)
    const speedMult = 1;
    gs.enemies.forEach(e => {
      if (e.type === 'METEOR') { e.y += e.vy * speedMult; } 
      else if (e.type === 'FLANKER') { e.x += e.vx * speedMult; e.y += e.vy * speedMult; }
      else if (e.type === 'ZIGZAG') {
          if (!e.startX) e.startX = e.x;
          e.x = e.startX + Math.sin(e.y / 30) * 60;
          e.y += e.vy * speedMult;
      }
      else if (e.type === 'TANK') { e.y += e.vy * speedMult; }
      else if (e.type === 'GHOST') {
          e.timer = (e.timer || 0) + 1 * speedMult;
          e.invisible = Math.sin(e.timer / 20) > 0;
          e.y += e.vy * speedMult;
      }
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
        if (e.isLeader) {
          // No co-op, o líder persegue quem tiver mais perto (você ou o aliado)
          const dMe = Math.hypot(gs.player.x - e.x, gs.player.y - e.y);
          const dAliado = Math.hypot(gs.aliado.x - e.x, gs.aliado.y - e.y);
          const alvoX = (dMe < dAliado && gs.player.hp > 0) ? gs.player.x : gs.aliado.x;
          const alvoY = (dMe < dAliado && gs.player.hp > 0) ? gs.player.y : gs.aliado.y;

          const dx = alvoX - e.x; const dy = alvoY - e.y; const dist = Math.hypot(dx, dy); 
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
      
      // Colisão Física SOMENTE com você (O Aliado cuida da colisão dele lá na máquina dele)
      if (gs.player.hp > 0 && Math.abs(gs.player.x - e.x) < 25 && Math.abs(gs.player.y - e.y) < 25 && !e.invisible) { 
        aplicarDano(5 + (gs.fase * 5)); 
        if (!e.mathRequired) e.hp = -100; 
      }
    });

    gs.lasers.forEach(l => {
      if (!l.isMine) return; // FOGO AMIGO OFF: O Laser do seu amigo é desenhado mas não causa dano duplo aqui.
      
      gs.enemyLasers.forEach(el => {
        if (el.homing && el.hp > 0 && Math.abs(l.x - el.x) < 20 && Math.abs(l.y - el.y) < 20) { 
          el.hp -= l.damage; 
          if (l.type !== 'LASER' && l.type !== 'ELECTRIC') l.y = -100;
          criarParticulas(el.x, el.y, '#FF8C00', 3); 
        }
      });

      gs.enemies.forEach(e => {
        if (!e.mathRequired && !e.invisible && Math.abs(l.x - e.x) < 20 && Math.abs(l.y - e.y) < 20) {
          if (e.shield && e.shield > 0) { e.shield -= l.damage; if (l.type !== 'LASER' && l.type !== 'ELECTRIC') l.y = -100; criarParticulas(e.x, e.y, '#00FFFF', 2); return; }
          e.hp -= l.damage;
          if (l.type === 'ELECTRIC') {
              const nearby = gs.enemies.filter(en => !en.mathRequired && !en.invisible && en !== e && Math.hypot(en.x - e.x, en.y - e.y) < 150)
                                       .sort((a,b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
                                       .slice(0, l.chainCount);
              nearby.forEach(en => { en.hp -= l.damage * 0.8; criarParticulas(en.x, en.y, '#FFFF00', 3); });
              l.y = -100; 
          }
          else if (l.type !== 'LASER') l.y = -100; 
          criarParticulas(l.x, l.y, '#FFF', 2);
        } else if (e.mathRequired && Math.abs(l.x - e.x) < 30 && Math.abs(l.y - e.y) < 30) {
           if (l.type !== 'LASER' && l.type !== 'ELECTRIC') l.y = -100; 
           criarParticulas(l.x, l.y, '#00FFFF', 2); 
        }
      });

      if (gs.boss.active && Math.abs(l.x - gs.boss.x) < 45 && Math.abs(l.y - gs.boss.y) < 35) {
        if (l.type !== 'LASER' && l.type !== 'ELECTRIC') l.y = -100;
        if (gs.boss.shield) { criarParticulas(l.x, gs.boss.y + 35, '#00FFFF', 2); } 
        else { gs.boss.hp -= l.damage; criarParticulas(l.x, l.y, '#FFD700', 3); }
      }
      l.x += l.vx; l.y += l.vy;
    });
    
    gs.lasers = gs.lasers.filter(l => l.y > -50 && l.x > -20 && l.x < gw + 20);
    
    gs.mathShots.forEach(ms => { ms.x += (ms.tx - ms.x) * 0.25; ms.y += (ms.ty - ms.y) * 0.25; ms.life -= 1; criarParticulas(ms.x, ms.y, ms.color, 1); });
    gs.mathShots = gs.mathShots.filter(ms => ms.life > 0);
    gs.floatingTexts.forEach(ft => { ft.y -= 1.5; ft.life -= 1; });
    gs.floatingTexts = gs.floatingTexts.filter(ft => ft.life > 0);

    gs.enemyLasers.forEach(el => {
      if (el.homing) {
          const dMe = Math.hypot(gs.player.x - el.x, gs.player.y - el.y);
          const dAliado = Math.hypot(gs.aliado.x - el.x, gs.aliado.y - el.y);
          const alvoX = (dMe < dAliado && gs.player.hp > 0) ? gs.player.x : gs.aliado.x;
          const alvoY = (dMe < dAliado && gs.player.hp > 0) ? gs.player.y : gs.aliado.y;
          
          const dx = alvoX - el.x; const dy = alvoY - el.y; const dist = Math.hypot(dx, dy);
          if (dist > 0.1) { el.vx += (dx/dist) * 0.4; el.vy += (dy/dist) * 0.4; }
          const speed = Math.hypot(el.vx, el.vy);
          const maxSpeed = 3 + (gs.fase * 0.6); 
          if (speed > maxSpeed) { el.vx = (el.vx/speed) * maxSpeed; el.vy = (el.vy/speed) * maxSpeed; }
      }
      el.x += el.vx * speedMult; el.y += el.vy * speedMult;

      if (gs.player.hp > 0 && Math.abs(gs.player.x - el.x) < 20 && Math.abs(gs.player.y - el.y) < 20) {
        aplicarDano(el.damage); el.hp = 0; 
      }
    });
    gs.enemyLasers = gs.enemyLasers.filter(el => el.y < gh + 20 && el.x > -20 && el.x < gw + 20 && el.hp > 0);
    gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 1; });
    gs.particles = gs.particles.filter(p => p.life > 0);

    // SISTEMA DE ONDAS SINCRONIZADAS (SÓ O HOST GERA E O VISITANTE ACOMPANHA NO TEMPO)
    if (gs.gameState === 'WAVES') {
      if (isHost) {
          if (gs.stateTimer % Math.max(20, 100 - gs.fase * 10) === 0) {
            const meteorVy = gs.fase === 1 ? Math.random() * 1 + 1.5 : Math.random() * 2 + 3 + (gs.fase * 0.6);
            gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: meteorVy, angle: 0 });
          }
          if (gs.stateTimer % 240 === 0 && gs.fase >= 2) {
            const isLeft = Math.random() > 0.5;
            gs.enemies.push({ id: Math.random().toString(), type: 'FLANKER', x: isLeft ? -20 : gw + 20, y: Math.random() * (gh/3), targetY: 0, hp: 2 + gs.fase * 2, vx: isLeft ? 3 + gs.fase * 1.2 : -3 - gs.fase * 1.2, vy: 1.5, angle: 0, shield: Math.random() > 0.7 ? 2 : 0 });
          }
          if (gs.fase >= 4) {
              if (gs.stateTimer % 180 === 0) gs.enemies.push({ id: Math.random().toString(), type: 'ZIGZAG', x: Math.random() * (gw - 40) + 20, y: -30, hp: 2 + gs.fase, vy: 3 + gs.fase * 0.5, startX: 0 });
              if (gs.stateTimer % 350 === 0) gs.enemies.push({ id: Math.random().toString(), type: 'TANK', x: Math.random() * (gw - 60) + 30, y: -40, hp: 15 + gs.fase * 5, vy: 0.8 });
              if (gs.stateTimer % 280 === 0) gs.enemies.push({ id: Math.random().toString(), type: 'GHOST', x: Math.random() * (gw - 40) + 20, y: -30, hp: 3 + gs.fase, vy: 2, invisible: false, timer: 0 });
          }
          if (gs.stateTimer === 600 || gs.stateTimer === 1200) {
            const eq = gerarEquacao(gs.fase, getRespostasAtivas());
            const isLeft = gs.stateTimer === 600; 
            gs.enemies.push({ id: Math.random().toString(), type: 'SPAWNER', x: isLeft ? gw * 0.25 : gw * 0.75, y: -80, targetY: 90 + Math.random() * 30, hp: 9999, mathRequired: true, solvesNeeded: Math.min(8, 2 + gs.fase), solvesDone: 0, txt: eq.txt, res: eq.res, vy: 1.5, spawnTimer: 0 });
          }
          if (gs.stateTimer % (300 - Math.min(150, gs.fase * 20)) === 0 && gs.stateTimer < 1400) {
            const cx = Math.random() * (gw - 120) + 60; const baseHp = 1 + (gs.fase * 2); 
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 3, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, evasive: true });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 }); 
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 40, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 2, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 });
          }
          if (gs.stateTimer % 500 === 0 && gs.fase >= 3) {
            const cx = gw / 2; const baseHp = 2 + gs.fase;
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 120, isLeader: true, hp: baseHp * 3, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, evasive: false });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 40, y: -60, targetY: 90, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
            gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 40, y: -60, targetY: 90, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: 1 });
          }
          
          if (now - gs.lastPowerupSpawn > 15000 && gs.powerups.length < 1) {
              const tipos = [ { type: 'FIRE_RATE', color: '#00FFFF', nome: 'CADÊNCIA UP' }, { type: 'ELECTRIC_UNLOCK', color: '#FFFF00', nome: 'BOLA ELÉTRICA' } ];
              const sel = tipos[Math.floor(Math.random() * tipos.length)];
              const eq = gerarEquacao(gs.fase, getRespostasAtivas());
              gs.powerups.push({ id: Math.random().toString(), x: Math.random() * (gw - 60) + 30, y: -40, type: sel.type, color: sel.color, title: sel.nome, txt: eq.txt, res: eq.res, collected: false });
              gs.lastPowerupSpawn = now;
          }
      }

      if (gs.stateTimer > 1500) { 
        gs.gameState = 'BOSS_WARNING'; gs.stateTimer = 0; 
      }
    } 
    else if (gs.gameState === 'BOSS_WARNING') {
      if (gs.stateTimer > 90) { 
        gs.gameState = 'BOSS'; gs.stateTimer = 0;
        if (isHost) {
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
              if (gs.boss.timer % 120 === 0 && isHost) { 
                  gs.boss.x = Math.random() * (gw - 100) + 50; gs.boss.y = Math.random() * 100 + 50;
                  criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 15);
                  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) { gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y, vx: Math.cos(angle)*5, vy: Math.sin(angle)*5, size: 8, damage: 10 + gs.fase*2, homing: false, color: '#00FFFF', hp: 1 }); }
              }
          }
      } 
      else if (gs.boss.type === 4) { 
          gs.boss.timer += 1 * speedMult;
          if (gs.boss.y < 60) gs.boss.y += 1.5 * speedMult;
          else {
              gs.boss.x += Math.sin(now / 500) * 2 * speedMult;
              if (gs.boss.timer % 180 === 0 && gs.enemies.length < 5 && isHost) {
                  gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x - 40, y: gs.boss.y + 20, targetY: gs.boss.y + 80, isLeader: true, hp: 10 + gs.fase, vx: -2, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
                  gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x + 40, y: gs.boss.y + 20, targetY: gs.boss.y + 80, isLeader: true, hp: 10 + gs.fase, vx: 2, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
              }
          }
      }
      else { 
          if (gs.boss.y < 90) { gs.boss.y += 1.5 * speedMult; } 
          else {
            gs.boss.x += gs.boss.vx * speedMult;
            if (gs.boss.x < 50 || gs.boss.x > gw - 50) gs.boss.vx *= -1;
            gs.boss.timer += 1 * speedMult;

            if (isHost) {
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
      
      if (isHost && gs.boss.y >= 60 && !gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) {
          const eq = gerarEquacao(gs.fase, getRespostasAtivas()); gs.boss.shield = true; gs.boss.txt = eq.txt; gs.boss.res = eq.res;
      }
      
      if (gs.boss.hp <= 0) {
        criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 30); 
        gs.score += 50 * gs.fase;
        gs.boss.active = false; gs.gameState = 'TRANSITION'; gs.stateTimer = 0; 
        gs.enemies = []; gs.enemyLasers = []; 
      }
    }
    else if (gs.gameState === 'TRANSITION') {
      if (gs.stateTimer > 90) { 
        gs.fase += 1; gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 50); 
        gs.gameState = 'WAVES'; gs.stateTimer = 0; 
        if (isHost) {
            socket.emit('game_action', { roomId, action: 'SYNC_FASE', data: { fase: gs.fase, gameState: gs.gameState } });
        }
      }
    }

    gs.enemies.forEach(e => { if (e.hp <= 0 && e.hp > -90) { gs.score += e.isLeader ? 3 : 1; criarParticulas(e.x, e.y, e.type === 'SQUAD' ? '#FF0055' : '#AAA', 10); } });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < gh + 20); 
    gs.powerups = gs.powerups.filter(p => p.y < gh + 50);

    setFrames(f => f + 1); 
  };

  const renderCooldownBox = (weaponKey: 'electric', color: string, icon: string) => {
    const w = gs.player.weapons[weaponKey];
    if (!w.active) return null;
    const pct = Math.max(0, Math.min(100, ((Date.now() - w.lastFire) / w.baseCooldown) * 100));
    return (
      <View key={weaponKey} style={{ alignItems: 'center' }}>
        <Text style={{color: color, fontSize: 10, fontWeight: 'bold', marginBottom: 2}}>Lv.{w.level}</Text>
        <View style={styles.skillBox}><Ionicons name={icon as any} size={20} color={color}/><View style={[styles.skillOverlay, { height: `${100 - pct}%` }]}/>  </View>
      </View>
    );
  };

  if (tela === 'resultado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainerFixed}>
          <Text style={[styles.tituloMenu, { color: '#FF4444' }]}>MISSÃO FALHOU</Text>
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{gs.score + gs.scoreAliado}</Text>
            <Text style={styles.resultadoLabel}>Pontos Totais da Equipe</Text>
          </View>
          <Text style={styles.textoFase}>Vocês chegaram na Fase {gs.fase}</Text>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#555', marginTop: 30 }]} onPress={goBack}>
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
            <Text style={styles.hudScore}>VOCÊ: {gs.score} | ALIADO: {gs.scoreAliado}</Text>
            <View style={{flexDirection:'row', gap: 5}}>
                <View style={styles.hpBarContainer}><View style={[styles.hpBarFill, { width: `${Math.max(0, (gs.player.hp / gs.player.maxHp) * 100)}%`, backgroundColor: minhaCor }]}/></View>
                <View style={styles.hpBarContainer}><View style={[styles.hpBarFill, { width: `${Math.max(0, (gs.aliado.hp / gs.aliado.maxHp) * 100)}%`, backgroundColor: corAliado }]}/></View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
            <Text style={[styles.hudFase, { alignSelf: 'flex-start', marginTop: 15, marginRight: 5 }]}>FASE {gs.fase}</Text>
            {renderCooldownBox('electric', '#FFFF00', 'flash-outline')}
          </View>
        </View>

        <View style={styles.gameArea} onLayout={(e) => { 
            const { width, height } = e.nativeEvent.layout;
            if (Math.abs(width - canvasSizeRef.current.width) > 5 || Math.abs(height - canvasSizeRef.current.height) > 5) {
                setCanvasSize({ width, height }); canvasSizeRef.current = { width, height }; 
            }
          }} 
          onTouchStart={handleGameTouchStart} onTouchMove={handleGameTouchMove} onTouchEnd={handleGameTouchEnd} onTouchCancel={handleGameTouchEnd}
        >
          {gs.gameState === 'BOSS_WARNING' && (<View style={styles.centerAlert}><Text style={styles.alertTextDanger}>ATENÇÃO</Text><Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text></View>)}
          {gs.gameState === 'TRANSITION' && (<View style={styles.centerAlert}><Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text><Text style={styles.alertSubText}>PREPARANDO SALTO...</Text></View>)}

          <View style={{ position: 'absolute', width: canvasSize.width / gs.currentZoom, height: canvasSize.height / gs.currentZoom, left: -(canvasSize.width / gs.currentZoom - canvasSize.width) / 2, top: -(canvasSize.height / gs.currentZoom - canvasSize.height) / 2, transform: [{ scale: gs.currentZoom }] }}>
            <View style={styles.gridOverlay}/>

            {gs.enemies.map(e => {
              if (e.type === 'METEOR') return <View key={e.id} style={[styles.meteorShape, { left: e.x - 12, top: e.y - 12 }]}/>;
              if (e.type === 'FLANKER') return ( <View key={e.id} style={[styles.flankerShape, { left: e.x - 10, top: e.y - 8, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}>{e.shield > 0 && <View style={styles.miniShield}/>}</View>);
              if (e.type === 'ZIGZAG') return <View key={e.id} style={[styles.zigzagShape, { left: e.x - 15, top: e.y - 15 }]}/>;
              if (e.type === 'TANK') return <View key={e.id} style={[styles.tankShape, { left: e.x - 20, top: e.y - 20 }]}/>;
              if (e.type === 'GHOST') return <View key={e.id} style={[styles.ghostShape, { left: e.x - 18, top: e.y - 18, opacity: e.invisible ? 0.2 : 1 }]}/>;

              if (e.type === 'RARE_ENEMY') {
                return ( <View key={e.id} style={[styles.spawnerShape, { left: e.x - 35, top: e.y - 25, backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700', shadowColor: 'transparent' }]}><Text style={[styles.spawnerMath, { color: '#FFD700' }]}>{e.txt}</Text></View> );
              }
              if (e.type === 'SPAWNER') {
                return ( <View key={e.id} style={[styles.spawnerShape, { left: e.x - 30, top: e.y - 22 }]}><Text style={styles.spawnerMath}>{e.txt}</Text><View style={styles.powerupDots}>{Array.from({length: e.solvesNeeded}).map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i < e.solvesDone ? '#00FFFF' : 'transparent', borderColor: '#00FFFF' }]}/>))}</View></View> );
              }
              const rot = e.isLeader ? (e.angle - Math.PI/2) + 'rad' : '0rad'; 
              return (<View key={e.id} style={[styles.squadronShip, { left: e.x - 12, top: e.y - 12, borderTopColor: e.isLeader ? '#FF00FF' : '#FF0055', transform: [{ rotate: rot }] }]}>{e.shield > 0 && <View style={styles.miniShield}/>}</View>);
            })}

            {gs.boss.active && (
              <View style={[styles.bossContainer, { left: gs.boss.x - 40, top: gs.boss.y - 30 }]}>
                <View style={styles.bossHpBar}><View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]}/></View>
                <View style={[styles.bossShip, gs.boss.type === 1 && { borderRadius: 0, backgroundColor: '#4B0082', borderColor: '#FF00FF' }, gs.boss.type === 2 && { borderRadius: 30, height: 60, backgroundColor: '#006400', borderColor: '#32CD32' }, gs.boss.type === 3 && { borderRadius: 10, backgroundColor: '#4B0082', borderColor: '#00FFFF' }, gs.boss.type === 4 && { borderRadius: 20, backgroundColor: '#8B4513', borderColor: '#FF00FF' }]}/>
                {gs.boss.shield && ( <View style={styles.bossShield}><Text style={styles.bossMath}>{gs.boss.txt}</Text></View> )}
              </View>
            )}

            {gs.powerups.map(p => (
              <View key={p.id} style={[styles.powerupBox, { left: p.x - 40, top: p.y - 18, borderColor: p.color, opacity: p.collected ? 0.4 : 1 }]}><Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text><Text style={styles.powerupMath}>{p.txt}</Text></View>
            ))}

            {gs.lasers.map(l => (
              <View key={l.id} style={[styles.laserNormal, { left: l.x - (l.size/2), top: l.y, width: l.size, height: l.type === 'ELECTRIC' ? l.size : l.size * 3, backgroundColor: l.type === 'ELECTRIC' ? '#FFFF00' : '#00FFFF', borderRadius: l.size / 2, shadowColor: l.type === 'ELECTRIC' ? '#FFFF00' : 'transparent', shadowRadius: l.type === 'ELECTRIC' ? 10 : 0 }]}/>
            ))}

            {gs.pulses.map(p => {
              const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));
              return ( <View key={p.id} style={{ position: 'absolute', left: p.x - currentRadius, top: p.y - currentRadius, width: currentRadius * 2, height: currentRadius * 2, borderRadius: currentRadius, borderWidth: 3, borderColor: `rgba(0, 191, 255, ${p.life / p.maxLife})`, backgroundColor: `rgba(0, 191, 255, ${(p.life / p.maxLife) * 0.2})`, zIndex: 5 }}/> )
            })}

            {gs.mathShots.map(ms => ( <View key={ms.id} style={{ position: 'absolute', left: ms.x - 6, top: ms.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: ms.color, shadowColor: ms.color, shadowRadius: 8, shadowOpacity: 1, zIndex: 10 }}/> ))}

            {gs.enemyLasers.map(el => ( <View key={el.id} style={[el.homing ? styles.cannonBall : styles.enemyLaser, { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color }]}>{el.homing && el.hp < 5 && <View style={{width:'100%', height:'100%', backgroundColor:'rgba(255,255,255,0.5)', borderRadius: 20}}/>}</View> ))}
            {gs.particles.map((p, i) => ( <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }}/> ))}
            {gs.floatingTexts.map(ft => ( <Text key={ft.id} style={[styles.floatingText, { left: ft.x - 30, top: ft.y, color: ft.color, opacity: ft.life / 60 }]}>{ft.text}</Text> ))}

            {/* SUA NAVE */}
            {gs.player.hp > 0 && (
                <>
                    <View style={[styles.playerShape, { left: gs.player.x - 15, top: gs.player.y - 15, borderBottomColor: minhaCor }]}/>
                    <View style={[styles.propulsor, { left: gs.player.x - 5, top: gs.player.y + 15, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
                    <Text style={{ position:'absolute', color: minhaCor, fontSize: 10, left: gs.player.x - 20, top: gs.player.y + 25, fontWeight: 'bold' }}>VOCÊ</Text>
                </>
            )}

            {/* NAVE DO ALIADO */}
            {gs.aliado.hp > 0 && (
                <>
                    <View style={[styles.playerShape, { left: gs.aliado.x - 15, top: gs.aliado.y - 15, borderBottomColor: corAliado, opacity: 0.8 }]}/>
                    <View style={[styles.propulsor, { left: gs.aliado.x - 5, top: gs.aliado.y + 15, opacity: Math.random() > 0.5 ? 0.8 : 0.3 }]} />
                    <Text style={{ position:'absolute', color: corAliado, fontSize: 10, left: gs.aliado.x - 20, top: gs.aliado.y + 25, fontWeight: 'bold', opacity: 0.8 }}>{opponentName}</Text>
                </>
            )}
          
          </View>
        </View>

        <View style={[styles.painelInferior, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
          <View style={styles.visorRadar}><Text style={styles.visorTexto}>{resposta || '_'}</Text></View>
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
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050015', touchAction: 'none' as any, alignItems: 'center' },
  gameWrapper: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 500 : '100%', backgroundColor: '#050015', overflow: 'hidden' },
  
  menuContainerFixed: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015', width: '100%', maxWidth: 600, paddingHorizontal: 20 },
  tituloMenu: { fontSize: 45, fontWeight: '900', color: '#00FFFF', fontStyle: 'italic' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center' },
  btnIniciarTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  textoFase: { color: '#9D97B5', fontSize: 16, marginTop: 10 },
  resultadoCard: { backgroundColor: 'rgba(255, 68, 68, 0.1)', padding: 30, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 10, width: '100%', borderWidth: 1, borderColor: '#FF4444' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FF4444' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },

  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10, width: '100%' },
  hudScore: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 4 },
  hudFase: { color: '#FF00FF', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  
  skillBox: { width: 30, height: 30, borderWidth: 2, borderColor: '#333', borderRadius: 8, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  skillOverlay: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' },

  gameArea: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#050015', touchAction: 'none' as any, width: '100%' },
  
  gridOverlay: Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'linear-gradient(#00FFFF 1px, transparent 1px), linear-gradient(90deg, #00FFFF 1px, transparent 1px)' as any, backgroundSize: '30px 30px' as any } : { display: 'none' },
  
  centerAlert: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  alertTextDanger: { color: '#FF0055', fontSize: 35, fontWeight: '900', textShadowColor: '#FF0055', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertTextSuccess: { color: '#32CD32', fontSize: 35, fontWeight: '900', textShadowColor: '#32CD32', textShadowRadius: 8, textShadowOffset: { width: 1, height: 1 } },
  alertSubText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginTop: 5 },

  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  propulsor: { position: 'absolute', width: 10, height: 12, backgroundColor: '#FF8C00', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  
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

  painelInferior: { position: 'absolute', width: '100%', alignItems: 'center', paddingTop: 5, backgroundColor: 'transparent', zIndex: 10 },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 6 }, 
  visorTexto: { color: '#00FFFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 8 }, 
  tecladoRow: { flexDirection: 'row', gap: 8, height: 45 }, 
  teclaRetro: { flex: 1, backgroundColor: 'rgba(26, 26, 46, 0.75)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)', borderColor: '#32CD32' },
});
