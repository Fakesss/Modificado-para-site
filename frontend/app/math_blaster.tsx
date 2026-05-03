import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const initialWidth = Dimensions.get('window').width;
const initialHeight = Dimensions.get('window').height * 0.7;

const BotaoRetro = ({ valor, onPressWeb }: { valor: string, onPressWeb: (v: string) => void }) => {
  const anim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = (e: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    Animated.spring(anim, { toValue: 0.85, useNativeDriver: true }).start();
    onPressWeb(valor);
  };
  
  const handlePressOut = (e: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  };

  const isWeb = Platform.OS === 'web';

  let customStyle = styles.teclaRetro;
  if (valor === 'apagar') customStyle = { ...styles.teclaRetro, ...styles.teclaApagar } as any;
  if (valor === 'enviar') customStyle = { ...styles.teclaRetro, ...styles.teclaEnviar } as any;

  return (
    <Animated.View 
      style={[customStyle, { transform: [{ scale: anim }], flex: 1 }]}
      onTouchStart={handlePressIn}
      onTouchEnd={handlePressOut}
      onTouchCancel={handlePressOut}
      onMouseDown={isWeb ? handlePressIn : undefined}
      onMouseUp={isWeb ? handlePressOut : undefined}
      onMouseLeave={isWeb ? handlePressOut : undefined}
    >
      {valor === 'apagar' && <Ionicons name="backspace" size={22} color="#FFF" />}
      {valor === 'enviar' && <Ionicons name="flash" size={22} color="#FFF" />}
      {valor !== 'apagar' && valor !== 'enviar' && <Text style={styles.teclaRetroText}>{valor}</Text>}
    </Animated.View>
  );
};

export default function MathBlaster() {
  const router = useRouter();
  const [jogoAtivo, setJogoAtivo] = useState(false);
  const [frames, setFrames] = useState(0); 
  const [resposta, setResposta] = useState('');
  
  const respostaRef = useRef('');
  useEffect(() => { respostaRef.current = resposta; }, [resposta]);
  
  const layoutRef = useRef({ width: initialWidth, height: initialHeight });

  const gs = useRef({
    player: { 
      x: initialWidth / 2, 
      y: initialHeight - 80, 
      hp: 100, 
      maxHp: 100, 
      damage: 1, 
      shotSize: 5,
      fireRate: 300, 
      lastFire: 0, 
      tripleShot: false,
      weapons: {
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 50, life: 80 },
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 40, damageMult: 1 }
      }
    },
    lasers: [] as any[], 
    specialLasers: [] as any[],
    mathShots: [] as any[],
    pulses: [] as any[], 
    floatingTexts: [] as any[], 
    enemies: [] as any[], 
    enemyLasers: [] as any[],
    powerups: [] as any[], 
    particles: [] as any[],
    boss: { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0, 
    fase: 1, 
    gameState: 'WAVES', 
    stateTimer: 0, 
    lastPowerupSpawn: 0,
    movementTouchId: null as string | null,
    lastTouchX: 0, 
    lastTouchY: 0,
    keys: { up: false, down: false, left: false, right: false },
    timeAlive: 0,
    flawlessBossesCount: 0,
    tookDamageThisBoss: false,
    timeFreezeTimer: 0,
    forceShieldHits: 0,
    xRayTimer: 0,
    drones: {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    }
  }).current;

  const loopRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, []);

  const handleGameTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (gs.movementTouchId === null && touch.pageY < layoutRef.current.height + 100) {
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
        const dx = (touch as any).pageX - gs.lastTouchX;
        const dy = (touch as any).pageY - gs.lastTouchY;
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
    } while (evitar.includes(res)); 
    
    return { txt, res };
  };

  const iniciarJogo = () => {
    gs.player = { 
      x: layoutRef.current.width / 2, y: layoutRef.current.height - 80, 
      hp: 100, maxHp: 100, damage: 1, shotSize: 5, fireRate: 300, lastFire: 0, tripleShot: false, 
      weapons: { 
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 50, life: 80 }, 
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 },
        pulsar: { active: false, level: 1, baseCooldown: 12000, lastFire: 0, radius: 40, damageMult: 1 } 
      }
    };
    gs.lasers = []; gs.specialLasers = []; gs.mathShots = []; gs.pulses = []; gs.floatingTexts = [];
    gs.enemies = []; gs.enemyLasers = []; gs.powerups = []; gs.particles = [];
    gs.boss = { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 };
    gs.score = 0; gs.fase = 1; gs.gameState = 'WAVES'; gs.stateTimer = 0; gs.movementTouchId = null;
    gs.keys = { up: false, down: false, left: false, right: false };
    
    gs.timeAlive = 0;
    gs.flawlessBossesCount = 0;
    gs.tookDamageThisBoss = false;
    gs.timeFreezeTimer = 0;
    gs.forceShieldHits = 0;
    gs.xRayTimer = 0;
    gs.drones = {
      normal: { active: false, level: 1, lastFire: 0, baseCooldown: 1500 },
      advanced: { active: false, level: 1, lastFire: 0, baseCooldown: 2000 }
    };
    
    setResposta(''); 
    setJogoAtivo(true);
    
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); 
  };

  const gameOver = () => { 
    setJogoAtivo(false); 
    if (loopRef.current) clearInterval(loopRef.current); 
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) { 
      gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color }); 
    }
  };

  const lidarComTeclado = useCallback((valor: string) => {
    if (!jogoAtivo) return;
    
    if (valor === 'apagar') {
      setResposta(r => r.slice(0, -1));
    } else if (valor === 'enviar') {
      const num = parseInt(respostaRef.current);
      let acertou = false;

      const dispararMagia = (tx: number, ty: number, color: string) => { 
        gs.mathShots.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, tx, ty, color, life: 15 }); 
      };

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(gs.boss.x, gs.boss.y, '#FFD700'); setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 50), 350); 
        gs.score += 200;
      } 
      
      if (!acertou) {
        for (let i = 0; i < gs.enemies.length; i++) {
          let e = gs.enemies[i];
          if (e.mathRequired && !e.isDying && e.res === num) {
            acertou = true; e.solvesDone += 1; dispararMagia(e.x, e.y, '#00FFFF');
            if (e.solvesDone >= e.solvesNeeded) {
               e.isDying = true; e.mathRequired = false;
               setTimeout(() => { e.hp = -100; gs.score += 300; criarParticulas(e.x, e.y, '#00FFFF', 80); }, 350);
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
              criarParticulas(px, py, color, 30);
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

              gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); 
              gs.score += 50; p.y = 9999; 
            }, 350);
            break; 
          }
        }
      }

      if (!acertou && respostaRef.current !== '') { 
        if (gs.forceShieldHits > 0) {
          gs.forceShieldHits -= 1;
          criarParticulas(gs.player.x, gs.player.y, '#00FA9A', 10);
        } else {
          gs.player.hp = Math.max(0, gs.player.hp - 8); 
          criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8); 
        }
      }
      setResposta('');
    } else {
      setResposta(r => r.length < 4 ? r + valor : r);
    }
  }, [jogoAtivo]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!jogoAtivo) return;
      const key = e.key;

      if (key === 'w' || key === 'W' || key === 'ArrowUp') gs.keys.up = true;
      if (key === 's' || key === 'S' || key === 'ArrowDown') gs.keys.down = true;
      if (key === 'a' || key === 'A' || key === 'ArrowLeft') gs.keys.left = true;
      if (key === 'd' || key === 'D' || key === 'ArrowRight') gs.keys.right = true;

      if (/\d/.test(key)) lidarComTeclado(key);
      if (key === 'Backspace') lidarComTeclado('apagar');
      if (key === 'Enter') lidarComTeclado('enviar');

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'w' || key === 'W' || key === 'ArrowUp') gs.keys.up = false;
      if (key === 's' || key === 'S' || key === 'ArrowDown') gs.keys.down = false;
      if (key === 'a' || key === 'A' || key === 'ArrowLeft') gs.keys.left = false;
      if (key === 'd' || key === 'D' || key === 'ArrowRight') gs.keys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jogoAtivo, lidarComTeclado]);

  const gameTick = () => {
    const now = Date.now();
    const gw = layoutRef.current.width; 
    const gh = layoutRef.current.height;
    
    gs.timeAlive += 30;
    if (gs.timeFreezeTimer > 0) gs.timeFreezeTimer -= 30;
    if (gs.xRayTimer > 0) gs.xRayTimer -= 30;

    const keyboardSpeed = 6;
    if (gs.keys.up) gs.player.y -= keyboardSpeed;
    if (gs.keys.down) gs.player.y += keyboardSpeed;
    if (gs.keys.left) gs.player.x -= keyboardSpeed;
    if (gs.keys.right) gs.player.x += keyboardSpeed;

    const aplicarDano = (dano: number) => {
      if (gs.forceShieldHits > 0) {
        gs.forceShieldHits -= 1;
        criarParticulas(gs.player.x, gs.player.y, '#00FA9A', 15);
      } else {
        gs.player.hp = Math.max(0, gs.player.hp - dano);
        if (gs.gameState === 'BOSS') gs.tookDamageThisBoss = true;
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8);
      }
    };

    if (gs.player.x < 15) gs.player.x = 15; 
    if (gs.player.x > gw - 15) gs.player.x = gw - 15;
    if (gs.player.y < 15) gs.player.y = 15; 
    if (gs.player.y > gh - 15) gs.player.y = gh - 15;

    if (now - gs.player.lastFire > gs.player.fireRate) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 15, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
      if (gs.player.tripleShot) {
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 8, y: gs.player.y - 10, vx: -3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 8, y: gs.player.y - 10, vx: 3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
      }
      gs.player.lastFire = now;
    }

    if (gs.player.weapons.missile.active && now - gs.player.weapons.missile.lastFire > gs.player.weapons.missile.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 15, vx: 0, vy: -8, damage: gs.player.damage * gs.player.weapons.missile.damageMult, size: gs.player.shotSize * 2.5, type: 'MISSILE', life: gs.player.weapons.missile.life, aoeRange: gs.player.weapons.missile.aoeRange }); 
      gs.player.weapons.missile.lastFire = now;
    }
    
    if (gs.player.weapons.laser.active && now - gs.player.weapons.laser.lastFire > gs.player.weapons.laser.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 30, vx: 0, vy: -25, damage: gs.player.damage * gs.player.weapons.laser.damageMult, size: gs.player.shotSize * 1.5 * gs.player.weapons.laser.sizeMult, type: 'LASER' });
      gs.player.weapons.laser.lastFire = now;
    }

    if (gs.drones.normal.active && now - gs.drones.normal.lastFire > gs.drones.normal.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 30, y: gs.player.y, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
      gs.drones.normal.lastFire = now;
    }

    if (gs.drones.advanced.active && now - gs.drones.advanced.lastFire > gs.drones.advanced.baseCooldown) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 25, y: gs.player.y, vx: 0, vy: -5, damage: gs.player.damage * 2, size: gs.player.shotSize * 1.2, type: 'MISSILE_HOMING', life: 9999, aoeRange: 35 });
      gs.drones.advanced.lastFire = now;
    }

    if (gs.player.weapons.pulsar.active && now - gs.player.weapons.pulsar.lastFire > gs.player.weapons.pulsar.baseCooldown) {
      gs.pulses.push({ id: Math.random().toString(), maxRadius: gs.player.weapons.pulsar.radius, life: 20, maxLife: 20 });
      gs.player.weapons.pulsar.lastFire = now;
    }

    gs.pulses.forEach(p => {
      p.x = gs.player.x;
      p.y = gs.player.y;
      p.life -= 1;
      const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));

      gs.enemyLasers.forEach(el => {
        if (Math.pow(el.x - p.x, 2) + Math.pow(el.y - p.y, 2) < currentRadius * currentRadius) {
          el.hp = 0;
          criarParticulas(el.x, el.y, '#00BFFF', 3);
        }
      });

      gs.enemies.forEach(e => {
        if (!e.mathRequired && Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2) < currentRadius * currentRadius) {
          e.hp = -100;
          gs.score += 10;
          criarParticulas(e.x, e.y, '#00BFFF', 10);
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
        const maxSpeed = 5 + (gs.fase * 0.5);
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
      
      if (gs.stateTimer % Math.max(20, 60 - gs.fase * 5) === 0) {
        const meteorVy = gs.fase === 1 ? Math.random() * 1.5 + 2.5 : Math.random() * 2 + 4 + (gs.fase * 0.5);
        gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: meteorVy, angle: 0 });
      }

      if (gs.stateTimer % 180 === 0 && gs.fase >= 2) {
        const isLeft = Math.random() > 0.5;
        gs.enemies.push({ id: Math.random().toString(), type: 'FLANKER', x: isLeft ? -20 : gw + 20, y: Math.random() * (gh/3), targetY: 0, hp: 2 + gs.fase * 2, vx: isLeft ? 5 + gs.fase : -5 - gs.fase, vy: 2, angle: 0, shield: Math.random() > 0.7 ? 2 : 0 });
      }

      if (gs.stateTimer === 600 || gs.stateTimer === 1200) {
        const eq = gerarEquacao(gs.fase, getRespostasAtivas());
        const isLeft = gs.stateTimer === 600; 
        gs.enemies.push({ id: Math.random().toString(), type: 'SPAWNER', x: isLeft ? gw * 0.25 : gw * 0.75, y: -80, targetY: 90 + Math.random() * 30, hp: 9999, mathRequired: true, solvesNeeded: Math.min(8, 3 + gs.fase), solvesDone: 0, txt: eq.txt, res: eq.res, vy: 2, spawnTimer: 0 });
      }

      if (gs.stateTimer % 200 === 0 && gs.stateTimer < 1400) {
        const cx = Math.random() * (gw - 120) + 60; 
        const baseHp = 3 + (gs.fase * 3); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 3, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 }); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 });
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
        gs.boss = { active: true, type: Math.floor(Math.random() * 3), x: gw / 2, y: -100, hp: 200 + (gs.fase * 120), maxHp: 200 + (gs.fase * 120), vx: 3 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
      }
    }
    else if (gs.gameState === 'BOSS') {
      if (gs.boss.y < 90) {
        gs.boss.y += 2 * speedMult;
      } else {
        gs.boss.x += gs.boss.vx * speedMult;
        if (gs.boss.x < 60 || gs.boss.x > gw - 60) gs.boss.vx *= -1;
        gs.boss.timer += 1 * speedMult;

        if (gs.boss.type === 0) {
          if (gs.boss.timer % Math.max(30, 80 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: 0, vy: 2, size: 14, damage: 20, homing: true, color: '#FF8C00', hp: 5 + (gs.fase * 4) });
        } else if (gs.boss.type === 1) {
          if (gs.boss.timer % 60 === 0) [-2, -1, 0, 1, 2].forEach(dir => gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: dir * 1.5, vy: 6 + gs.fase, size: 6, damage: 15, homing: false, color: '#FF0055', hp: 1 }));
        } else {
          if (gs.boss.timer % 120 === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: 0, vy: 15, size: 20, damage: 30, homing: false, color: '#32CD32', hp: 99 });
        }

        if (gs.boss.timer % 300 === 0 && gs.enemies.length < 2) {
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x - 35, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI });
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x + 35, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI });
        }

        if (!gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) {
          const eq = gerarEquacao(gs.fase, getRespostasAtivas()); 
          gs.boss.shield = true; gs.boss.txt = eq.txt; gs.boss.res = eq.res;
        }
      }
      
      if (gs.boss.hp <= 0) {
        criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 80); 
        gs.score += 1000 * gs.fase; 
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
      }
    }

    gs.enemies.forEach(e => {
      if (e.type === 'METEOR') { e.y += e.vy * speedMult; } 
      else if (e.type === 'FLANKER') { e.x += e.vx * speedMult; e.y += e.vy * speedMult; }
      else if (e.type === 'SPAWNER') {
        if (e.y < e.targetY) e.y += e.vy * speedMult;
        else {
           e.x += Math.sin(now / 500) * 0.5 * speedMult; 
           e.spawnTimer += 1 * speedMult;
           if (e.spawnTimer > Math.max(50, 120 - (gs.fase * 10))) {
              gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: e.x, y: e.y + 30, targetY: e.y + 80 + Math.random() * 50, isLeader: false, hp: 1 + gs.fase, vx: (Math.random() - 0.5) * 3, vy: 4, fireTimer: 0, angle: Math.PI });
              e.spawnTimer = 0;
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
            gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 10, vx: Math.cos(e.angle)*5, vy: Math.sin(e.angle)*5, size: 6, damage: 15, homing: false, color: '#FF00FF', hp: 1 }); 
            e.fireTimer = 0; 
          }
        } else {
          if (e.y < e.targetY) e.y += e.vy * speedMult; 
          else {
            e.x += Math.sin(now / 300) * 1.5 * speedMult; e.fireTimer += 1 * speedMult;
            if (e.fireTimer > Math.max(60, 120 - (gs.fase * 5)) && Math.random() < 0.05) { 
              gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 10, vx: 0, vy: 6 + gs.fase, size: 5, damage: 10, homing: false, color: '#FF0055', hp: 1 }); 
              e.fireTimer = 0; 
            }
          }
        }
      }
      
      if (Math.abs(gs.player.x - e.x) < 25 && Math.abs(gs.player.y - e.y) < 25) { 
        aplicarDano(15); 
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
            if (l.type !== 'LASER') { if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; } 
            criarParticulas(e.x, e.y, '#00FFFF', 5); return; 
          }
          
          e.hp -= l.damage;
          if (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') {
            criarParticulas(e.x, e.y, '#FF4444', 15);
            gs.enemies.forEach(e2 => { if (!e2.mathRequired && Math.abs(e.x - e2.x) < l.aoeRange && Math.abs(e.y - e2.y) < l.aoeRange) e2.hp -= l.damage; });
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
            criarParticulas(l.x, l.y, '#FF4444', 15); 
            if (l.type === 'MISSILE_HOMING') l.life = 0; else l.y = -100; 
          } 
        }
      }
    });

    if (now - gs.lastPowerupSpawn > 15000 && gs.powerups.length < 1 && gs.gameState === 'WAVES') {
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
    
    gs.powerups.forEach(p => { if (!p.collected) p.y += 1.5; }); 

    gs.enemies.forEach(e => { 
      if (e.hp <= 0 && e.hp > -90) { 
        gs.score += e.isLeader ? 50 : 20; 
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

  const renderBuffs = () => (
    <View style={styles.buffContainer}>
      <Text style={[styles.buffText, { color: '#FF00FF' }]}>ATK: {gs.player.damage.toFixed(1)}</Text>
      <Text style={[styles.buffText, { color: '#00FFFF' }]}>TIRO: {(gs.player.fireRate / 1000).toFixed(2)}s</Text>
      {gs.player.tripleShot && <Text style={[styles.buffText, { color: '#FFD700' }]}>TRIPLO</Text>}
      {gs.timeFreezeTimer > 0 && <Text style={[styles.buffText, { color: '#E0FFFF' }]}>GELO</Text>}
      {gs.xRayTimer > 0 && <Text style={[styles.buffText, { color: '#FF1493' }]}>RAIO-X</Text>}
    </View>
  );

  const renderCooldownBox = (weaponKey: 'missile' | 'laser' | 'pulsar', color: string, icon: string) => {
    const w = gs.player.weapons[weaponKey];
    if (!w.active) return null;
    const pct = Math.max(0, Math.min(100, ((Date.now() - w.lastFire) / w.baseCooldown) * 100));
    const totalDamage = weaponKey === 'pulsar' ? 'MAX' : (gs.player.damage * w.damageMult).toFixed(1);
    const cooldownSecs = (w.baseCooldown / 1000).toFixed(1);

    return (
      <View key={weaponKey} style={{ alignItems: 'center' }}>
        <Text style={{color: color, fontSize: 10, fontWeight: 'bold', marginBottom: 2}}>Lv.{w.level}</Text>
        <View style={styles.skillBox}>
          <Ionicons name={icon as any} size={20} color={color} />
          <View style={[styles.skillOverlay, { height: `${100 - pct}%` }]} />
        </View>
        <Text style={{color: '#FFF', fontSize: 8, marginTop: 2, fontWeight: 'bold'}}>ATK: {totalDamage}</Text>
        <Text style={{color: '#AAA', fontSize: 8}}>{cooldownSecs}s</Text>
      </View>
    );
  };

  if (!jogoAtivo && gs.score === 0 && gs.player.hp === 100) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={{ position: 'absolute', top: 20, left: 20 }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={30} color="#00FFFF" />
          </TouchableOpacity>
          <Ionicons name="rocket" size={80} color="#00FFFF" style={{ marginBottom: 20 }} />
          <Text style={styles.tituloMenu}>SKY</Text>
          <Text style={styles.subTituloMenu}>EQUATIONS</Text>
          <Text style={styles.instrucoes}>Toque ou use as Setas/WASD para mover. Digite a resposta no teclado físico e dê Enter!</Text>
          <TouchableOpacity style={styles.btnIniciar} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>INICIAR MISSÃO</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!jogoAtivo && gs.player.hp <= 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <Text style={[styles.tituloMenu, { color: '#FF4444' }]}>DESTRUÍDO</Text>
          <Text style={styles.textoScore}>Pontos: {gs.score}</Text>
          <Text style={styles.textoFase}>Chegou na Fase {gs.fase}</Text>
          <TouchableOpacity style={[styles.btnIniciar, { marginTop: 40 }]} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#555', marginTop: 15 }]} onPress={() => router.back()}>
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
              <View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]} />
            </View>
            {renderBuffs()}
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 15 }}>
            <Text style={[styles.hudFase, { alignSelf: 'flex-start', marginTop: 15, marginRight: 5 }]}>FASE {gs.fase}</Text>
            {renderCooldownBox('missile', '#FF4444', 'rocket')}
            {renderCooldownBox('laser', '#32CD32', 'flash')}
            {renderCooldownBox('pulsar', '#00BFFF', 'shield')} 
          </View>
        </View>

        <View 
          style={[styles.gameArea, gs.timeFreezeTimer > 0 && { borderColor: '#E0FFFF', borderWidth: 2 }]} 
          onLayout={(e) => { layoutRef.current.width = e.nativeEvent.layout.width; layoutRef.current.height = e.nativeEvent.layout.height; }} 
          onTouchStart={handleGameTouchStart} 
          onTouchMove={handleGameTouchMove} 
          onTouchEnd={handleGameTouchEnd} 
          onTouchCancel={handleGameTouchEnd}
          pointerEvents="auto"
        >
          <View style={styles.gridOverlay} />
          
          {gs.gameState === 'BOSS_WARNING' && (<View style={styles.centerAlert}><Text style={styles.alertTextDanger}>ATENÇÃO</Text><Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text></View>)}
          {gs.gameState === 'TRANSITION' && (<View style={styles.centerAlert}><Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text><Text style={styles.alertSubText}>PREPARANDO SALTO...</Text></View>)}

          {gs.enemies.map(e => {
            if (e.type === 'METEOR') return <View key={e.id} style={[styles.meteorShape, { left: e.x - 12, top: e.y - 12 }]} />;
            if (e.type === 'FLANKER') return ( <View key={e.id} style={[styles.flankerShape, { left: e.x - 10, top: e.y - 10, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}>{e.shield > 0 && <View style={styles.miniShield} />}</View>);
            if (e.type === 'SPAWNER') {
              return (
                 <View key={e.id} style={[styles.spawnerShape, { left: e.x - 30, top: e.y - 22 }]}>
                    <Text style={styles.spawnerMath}>{e.txt}</Text>
                    {gs.xRayTimer > 0 && <Text style={styles.xrayText}>{e.res}</Text>}
                    <View style={styles.powerupDots}>
                      {Array.from({length: e.solvesNeeded}).map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i < e.solvesDone ? '#00FFFF' : 'transparent', borderColor: '#00FFFF' }]} />))}
                    </View>
                 </View>
              );
            }
            const rot = e.isLeader ? (e.angle - Math.PI/2) + 'rad' : '0rad'; 
            return (<View key={e.id} style={[styles.squadronShip, { left: e.x - 12, top: e.y - 12, borderTopColor: e.isLeader ? '#FF00FF' : '#FF0055', transform: [{ rotate: rot }] }]}>{e.shield > 0 && <View style={styles.miniShield} />}</View>);
          })}

          {gs.boss.active && (
            <View style={[styles.bossContainer, { left: gs.boss.x - 40, top: gs.boss.y - 25 }]}>
              <View style={styles.bossHpBar}><View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]} /></View>
              <View style={[styles.bossShip, gs.boss.type === 1 && { borderRadius: 0, backgroundColor: '#4B0082', borderColor: '#FF00FF' }, gs.boss.type === 2 && { borderRadius: 30, height: 60, backgroundColor: '#006400', borderColor: '#32CD32' }]} />
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
              left: l.x - (l.size/2), top: l.y, 
              width: l.size, height: l.type === 'MISSILE' ? l.size : (l.type === 'MISSILE_HOMING' ? l.size : (l.type === 'LASER' ? l.size * 8 : l.size * 3)), 
              backgroundColor: l.type === 'LASER' ? '#32CD32' : l.type === 'MISSILE' ? '#FF4444' : l.type === 'MISSILE_HOMING' ? '#FFD700' : '#00FFFF', 
              borderRadius: (l.type === 'MISSILE' || l.type === 'MISSILE_HOMING') ? l.size / 2 : 5 
            }]} />
          ))}

          {gs.pulses.map(p => {
            const currentRadius = p.maxRadius * (1 - (p.life / p.maxLife));
            return (
              <View key={p.id} style={{ position: 'absolute', left: p.x - currentRadius, top: p.y - currentRadius, width: currentRadius * 2, height: currentRadius * 2, borderRadius: currentRadius, borderWidth: 3, borderColor: `rgba(0, 191, 255, ${p.life / p.maxLife})`, backgroundColor: `rgba(0, 191, 255, ${(p.life / p.maxLife) * 0.2})`, zIndex: 5 }} />
            )
          })}

          {gs.mathShots.map(ms => (
            <View key={ms.id} style={{ position: 'absolute', left: ms.x - 6, top: ms.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: ms.color, shadowColor: ms.color, shadowRadius: 8, shadowOpacity: 1, zIndex: 10 }} />
          ))}

          {gs.enemyLasers.map(el => (
            <View key={el.id} style={[el.homing ? styles.cannonBall : styles.enemyLaser, { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color }]}>
              {el.homing && el.hp < 5 && <View style={{width:'100%', height:'100%', backgroundColor:'rgba(255,255,255,0.5)', borderRadius: 20}}/>}
            </View>
          ))}

          {gs.particles.map((p, i) => (
            <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }} />
          ))}

          {gs.floatingTexts.map(ft => (
            <Text key={ft.id} style={[styles.floatingText, { left: ft.x - 30, top: ft.y, color: ft.color, opacity: ft.life / 60 }]}>{ft.text}</Text>
          ))}

          <View style={[styles.playerShape, { left: gs.player.x - 15, top: gs.player.y - 15 }]} />
          <View style={[styles.propulsor, { left: gs.player.x - 5, top: gs.player.y + 15, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
          
          {gs.forceShieldHits > 0 && (
            <View style={{ position: 'absolute', left: gs.player.x - 25, top: gs.player.y - 25, width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#00FA9A', backgroundColor: 'rgba(0,250,154,0.1)', zIndex: 10 }} />
          )}
          {gs.drones.normal.active && <View style={[styles.droneNormal, { left: gs.player.x - 30, top: gs.player.y + 5 }]} />}
          {gs.drones.advanced.active && <View style={[styles.droneAdvanced, { left: gs.player.x + 20, top: gs.player.y + 5 }]} />}
        </View>

        <View style={styles.painelInferior}>
          <View style={styles.visorRadar}>
            <Text style={styles.visorTexto}>{resposta || '_'}</Text>
          </View>
          <View style={styles.tecladoContainer}>
            {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((linha, i) => (
              <View key={i} style={styles.tecladoRow}>
                {linha.map(num => <BotaoRetro key={num} valor={num} onPressWeb={lidarComTeclado} />)}
              </View>
            ))}
            <View style={styles.tecladoRow}>
              <BotaoRetro valor="apagar" onPressWeb={lidarComTeclado} />
              <BotaoRetro valor="0" onPressWeb={lidarComTeclado} />
              <BotaoRetro valor="enviar" onPressWeb={lidarComTeclado} />
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#050015', 
    touchAction: 'none' as any,
    alignItems: 'center', 
  },
  gameWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '100%', 
    backgroundColor: '#050015',
    overflow: 'hidden',
  },
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015', width: '100%', maxWidth: 600 },
  tituloMenu: { fontSize: 45, fontWeight: '900', color: '#00FFFF', fontStyle: 'italic' },
  subTituloMenu: { fontSize: 25, fontWeight: '900', color: '#FFF', letterSpacing: 5 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, marginTop: 40 },
  btnIniciarTxt: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  textoScore: { color: '#00FFFF', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  textoFase: { color: '#9D97B5', fontSize: 16, marginTop: 10 },

  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10, width: '100%' },
  hudScore: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
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

  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00FFFF' },
  propulsor: { position: 'absolute', width: 10, height: 12, backgroundColor: '#FF8C00', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  droneNormal: { position: 'absolute', width: 10, height: 10, backgroundColor: '#1E90FF', borderRadius: 5, borderWidth: 1, borderColor: '#FFF', zIndex: 5 },
  droneAdvanced: { position: 'absolute', width: 12, height: 12, backgroundColor: '#FFD700', borderRadius: 3, borderWidth: 1, borderColor: '#FF4444', zIndex: 5 },
  
  meteorShape: { position: 'absolute', width: 24, height: 24, backgroundColor: '#555', borderRadius: 4, borderWidth: 2, borderColor: '#777' },
  squadronShip: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 24, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  flankerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 16, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFA500' },
  miniShield: { position: 'absolute', top: -8, left: -16, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#00FFFF', backgroundColor: 'rgba(0,255,255,0.1)' },
  
  spawnerShape: { position: 'absolute', width: 60, height: 45, backgroundColor: 'rgba(0, 255, 255, 0.2)', borderWidth: 2, borderColor: '#00FFFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#00FFFF', shadowRadius: 10, zIndex: 15 },
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
  cannonBall: { position: 'absolute', borderRadius: 20, borderWidth: 2, borderColor: '#FFF' }, 
  floatingText: { position: 'absolute', fontSize: 12, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 2, textShadowOffset: { width: 1, height: 1 }, zIndex: 100, textAlign: 'center', width: 80 },

  painelInferior: { 
    backgroundColor: '#0A0025', 
    borderTopWidth: 2, 
    borderTopColor: '#FF00FF', 
    paddingHorizontal: 15, 
    paddingTop: 8, 
    paddingBottom: Platform.OS === 'android' ? 15 : 10, 
    alignItems: 'center',
    width: '100%',
    flexShrink: 1, 
  },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 8 }, 
  visorTexto: { color: '#00FFFF', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 4 }, 
  tecladoRow: { flexDirection: 'row', gap: 4, height: 40 }, 
  teclaRetro: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  teclaApagar: { backgroundColor: 'rgba(255, 68, 68, 0.15)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(255, 0, 255, 0.15)', borderColor: '#FF00FF' },
});
