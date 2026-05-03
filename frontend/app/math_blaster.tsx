import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const initialWidth = Dimensions.get('window').width;

// --- COMPONENTE: TECLADO RETRÔ ---
const BotaoRetro = ({ valor, onPressWeb }: { valor: string, onPressWeb: (v: string) => void }) => {
  const anim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(anim, { toValue: 0.85, useNativeDriver: true }).start();
  const handlePressOut = () => { Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start(); onPressWeb(valor); };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: anim }] }}>
      <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}
        style={[styles.teclaRetro, valor === 'apagar' && styles.teclaApagar, valor === 'enviar' && styles.teclaEnviar]}>
        {valor === 'apagar' ? <Ionicons name="backspace" size={26} color="#FFF" /> : 
         valor === 'enviar' ? <Ionicons name="flash" size={26} color="#FFF" /> : 
         <Text style={styles.teclaRetroText}>{valor}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function MathBlaster() {
  const router = useRouter();
  const [jogoAtivo, setJogoAtivo] = useState(false);
  const [frames, setFrames] = useState(0); 
  const [resposta, setResposta] = useState('');
  
  const layoutRef = useRef({ width: initialWidth, height: 500 });

  // ESTADO GLOBAL DO MOTOR
  const gs = useRef({
    player: { 
      x: initialWidth / 2, y: 300, 
      hp: 100, maxHp: 100, damage: 1, shotSize: 6,
      fireRate: 300, lastFire: 0, tripleShot: false,
      weapons: {
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 },
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 }
      }
    },
    lasers: [] as any[], 
    specialLasers: [] as any[],
    mathShots: [] as any[],
    floatingTexts: [] as any[], // NOVA LISTA: Textos que flutuam na tela!
    enemies: [] as any[], enemyLasers: [] as any[],
    powerups: [] as any[], particles: [] as any[],
    boss: { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0, fase: 1, gameState: 'WAVES', stateTimer: 0, lastPowerupSpawn: 0,
    lastTouchX: 0, lastTouchY: 0
  }).current;

  const loopRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, []);

  // --- CONTROLE DE NAVEGAÇÃO ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => { gs.lastTouchX = gestureState.x0; gs.lastTouchY = gestureState.y0; },
      onPanResponderMove: (e, gestureState) => {
        const dx = gestureState.moveX - gs.lastTouchX; const dy = gestureState.moveY - gs.lastTouchY;
        gs.player.x += dx * 1.5; gs.player.y += dy * 1.5;
        gs.lastTouchX = gestureState.moveX; gs.lastTouchY = gestureState.moveY;
      }
    })
  ).current;

  const getRespostasAtivas = () => {
    const resps: number[] = [];
    if (gs.boss.active && gs.boss.shield) resps.push(gs.boss.res);
    gs.enemies.forEach(e => { if (e.mathRequired && !e.isDying) resps.push(e.res); });
    gs.powerups.forEach(p => { if (!p.collected) resps.push(p.res); });
    return resps;
  };

  const gerarEquacao = (dificuldade: number, evitar: number[] = []) => {
    const r = (m: number) => Math.floor(Math.random() * m);
    let n1, n2, res, txt;
    do {
      if (dificuldade === 1) { n1 = r(10)+1; n2 = r(10)+1; res = n1+n2; txt = `${n1} + ${n2}`; }
      else if (dificuldade === 2) { n1 = r(15)+5; n2 = r(n1)+1; res = n1-n2; txt = `${n1} - ${n2}`; }
      else { n1 = r(8)+2; n2 = r(8)+2; res = n1*n2; txt = `${n1} × ${n2}`; }
    } while (evitar.includes(res)); 
    return { txt, res };
  };

  const iniciarJogo = () => {
    gs.player = { 
      x: layoutRef.current.width / 2, y: layoutRef.current.height - 100, 
      hp: 100, maxHp: 100, damage: 1, shotSize: 6, fireRate: 300, lastFire: 0, tripleShot: false, 
      weapons: { 
        missile: { active: false, level: 1, baseCooldown: 8000, lastFire: 0, damageMult: 3, aoeRange: 60, life: 80 }, 
        laser: { active: false, level: 1, baseCooldown: 10000, lastFire: 0, damageMult: 2, sizeMult: 1 } 
      }
    };
    gs.lasers = []; gs.specialLasers = []; gs.mathShots = []; gs.floatingTexts = [];
    gs.enemies = []; gs.enemyLasers = []; gs.powerups = []; gs.particles = [];
    gs.boss = { active: false, type: 0, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 };
    gs.score = 0; gs.fase = 1; gs.gameState = 'WAVES'; gs.stateTimer = 0;
    setResposta(''); setJogoAtivo(true);
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); 
  };

  const gameOver = () => { setJogoAtivo(false); if (loopRef.current) clearInterval(loopRef.current); };

  const gameTick = () => {
    const now = Date.now();
    const gw = layoutRef.current.width; const gh = layoutRef.current.height;

    if (gs.player.x < 20) gs.player.x = 20; if (gs.player.x > gw - 20) gs.player.x = gw - 20;
    if (gs.player.y < 20) gs.player.y = 20; if (gs.player.y > gh - 20) gs.player.y = gh - 20;

    // DISPAROS DA NAVE
    if (now - gs.player.lastFire > gs.player.fireRate) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, vx: 0, vy: -15, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
      if (gs.player.tripleShot) {
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x - 10, y: gs.player.y - 15, vx: -3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
        gs.lasers.push({ id: Math.random().toString(), x: gs.player.x + 10, y: gs.player.y - 15, vx: 3, vy: -14, damage: gs.player.damage, size: gs.player.shotSize, type: 'NORMAL' });
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

    // FÍSICA DOS TIROS
    gs.lasers.forEach(l => {
      if (l.type === 'MISSILE') {
        l.life -= 1;
        let closest: any = null; let minDist = 999999;
        gs.enemies.concat(gs.boss.active ? [gs.boss] : []).forEach(e => {
          if (e.hp > 0 && !e.mathRequired) { 
            let d = Math.pow(e.x - l.x, 2) + Math.pow(e.y - l.y, 2);
            if (d < minDist) { minDist = d; closest = e; }
          }
        });
        if (closest) {
          const dx = closest.x - l.x; const dy = closest.y - l.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0.1) { l.vx += (dx/dist) * 2; l.vy += (dy/dist) * 2; }
        }
        const speed = Math.sqrt(l.vx*l.vx + l.vy*l.vy);
        if (speed > 10) { l.vx = (l.vx/speed)*10; l.vy = (l.vy/speed)*10; }
        if (l.life <= 0) l.y = -100; 
      }
      l.x += l.vx; l.y += l.vy;
    });
    gs.lasers = gs.lasers.filter(l => l.y > -50 && l.x > -20 && l.x < gw + 20);
    
    // ANIMAÇÕES
    gs.mathShots.forEach(ms => { ms.x += (ms.tx - ms.x) * 0.25; ms.y += (ms.ty - ms.y) * 0.25; ms.life -= 1; criarParticulas(ms.x, ms.y, ms.color, 1); });
    gs.mathShots = gs.mathShots.filter(ms => ms.life > 0);

    gs.floatingTexts.forEach(ft => { ft.y -= 1.5; ft.life -= 1; });
    gs.floatingTexts = gs.floatingTexts.filter(ft => ft.life > 0);

    gs.enemyLasers.forEach(el => {
      if (el.homing) {
        const dx = gs.player.x - el.x; const dy = gs.player.y - el.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0.1) { el.vx += (dx/dist) * 0.4; el.vy += (dy/dist) * 0.4; }
        const speed = Math.sqrt(el.vx*el.vx + el.vy*el.vy);
        const maxSpeed = 5 + (gs.fase * 0.5);
        if (speed > maxSpeed) { el.vx = (el.vx/speed) * maxSpeed; el.vy = (el.vy/speed) * maxSpeed; }
      }
      el.x += el.vx; el.y += el.vy;
    });
    gs.enemyLasers = gs.enemyLasers.filter(el => el.y < gh + 20 && el.x > -20 && el.x < gw + 20 && el.hp > 0);

    gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 1; });
    gs.particles = gs.particles.filter(p => p.life > 0);

    // DIRETOR DE CENA
    gs.stateTimer += 1;

    if (gs.gameState === 'WAVES') {
      if (gs.stateTimer % Math.max(20, 60 - gs.fase * 5) === 0) { gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: Math.random() * 2 + 4 + (gs.fase * 0.5), angle: 0 }); }
      if (gs.stateTimer % 180 === 0 && gs.fase >= 2) { const isLeft = Math.random() > 0.5; gs.enemies.push({ id: Math.random().toString(), type: 'FLANKER', x: isLeft ? -20 : gw + 20, y: Math.random() * (gh/3), targetY: 0, hp: 2 + gs.fase * 2, vx: isLeft ? 5 + gs.fase : -5 - gs.fase, vy: 2, angle: 0, shield: Math.random() > 0.7 ? 2 : 0 }); }
      if (gs.stateTimer === 600 || gs.stateTimer === 1200) { const eq = gerarEquacao(Math.min(3, gs.fase), getRespostasAtivas()); const isLeft = gs.stateTimer === 600; gs.enemies.push({ id: Math.random().toString(), type: 'SPAWNER', x: isLeft ? gw * 0.25 : gw * 0.75, y: -80, targetY: 90 + Math.random() * 30, hp: 9999, mathRequired: true, solvesNeeded: Math.min(8, 3 + gs.fase), solvesDone: 0, txt: eq.txt, res: eq.res, vy: 2, spawnTimer: 0 }); }
      if (gs.stateTimer % 200 === 0 && gs.stateTimer < 1400) {
        const cx = Math.random() * (gw - 120) + 60; const baseHp = 3 + (gs.fase * 3); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 3, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, evasive: true });
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 }); 
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI, shield: gs.fase > 3 ? 1 : 0 });
      }
      if (gs.stateTimer > 1500) { gs.gameState = 'BOSS_WARNING'; gs.stateTimer = 0; }
    } 
    else if (gs.gameState === 'BOSS_WARNING') {
      if (gs.stateTimer > 90) { 
        gs.gameState = 'BOSS'; gs.stateTimer = 0;
        const eq = gerarEquacao(Math.min(3, gs.fase), getRespostasAtivas());
        gs.boss = { active: true, type: Math.floor(Math.random() * 3), x: gw / 2, y: -100, hp: 200 + (gs.fase * 120), maxHp: 200 + (gs.fase * 120), vx: 3 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
      }
    }
    else if (gs.gameState === 'BOSS') {
      if (gs.boss.y < 90) gs.boss.y += 2;
      else {
        gs.boss.x += gs.boss.vx; if (gs.boss.x < 60 || gs.boss.x > gw - 60) gs.boss.vx *= -1;
        gs.boss.timer += 1;
        if (gs.boss.type === 0) { if (gs.boss.timer % Math.max(30, 80 - (gs.fase * 10)) === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: 0, vy: 2, size: 18, damage: 20, homing: true, color: '#FF8C00', hp: 5 + (gs.fase * 4) }); } 
        else if (gs.boss.type === 1) { if (gs.boss.timer % 60 === 0) [-2, -1, 0, 1, 2].forEach(dir => gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: dir * 1.5, vy: 6 + gs.fase, size: 8, damage: 15, homing: false, color: '#FF0055', hp: 1 })); } 
        else { if (gs.boss.timer % 120 === 0) gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: 0, vy: 15, size: 25, damage: 30, homing: false, color: '#32CD32', hp: 99 }); }

        if (gs.boss.timer % 300 === 0 && gs.enemies.length < 2) {
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x - 40, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI });
          gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: gs.boss.x + 40, y: gs.boss.y, targetY: gs.boss.y + 40, isLeader: false, hp: 10 + gs.fase, vx: 0, vy: 3, fireTimer: 0, angle: Math.PI });
        }
        if (!gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) { const eq = gerarEquacao(Math.min(3, gs.fase), getRespostasAtivas()); gs.boss.shield = true; gs.boss.txt = eq.txt; gs.boss.res = eq.res; }
      }
      if (gs.boss.hp <= 0) { criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 80); gs.score += 1000 * gs.fase; gs.boss.active = false; gs.gameState = 'TRANSITION'; gs.stateTimer = 0; gs.enemies = []; gs.enemyLasers = []; }
    }
    else if (gs.gameState === 'TRANSITION') { if (gs.stateTimer > 90) { gs.fase += 1; gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 50); gs.gameState = 'WAVES'; gs.stateTimer = 0; } }

    gs.enemies.forEach(e => {
      if (e.type === 'METEOR') { e.y += e.vy; } 
      else if (e.type === 'FLANKER') { e.x += e.vx; e.y += e.vy; }
      else if (e.type === 'SPAWNER') {
        if (e.y < e.targetY) e.y += e.vy;
        else { e.x += Math.sin(now / 500) * 0.5; e.spawnTimer += 1; if (e.spawnTimer > Math.max(50, 120 - (gs.fase * 10))) { gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: e.x, y: e.y + 40, targetY: e.y + 100 + Math.random() * 50, isLeader: false, hp: 1 + gs.fase, vx: (Math.random() - 0.5) * 3, vy: 4, fireTimer: 0, angle: Math.PI }); e.spawnTimer = 0; } }
      }
      else if (e.type === 'SQUAD') {
        if (e.evasive) { gs.lasers.forEach(l => { if (l.y > e.y && l.y - e.y < 80 && Math.abs(l.x - e.x) < 20) e.x += e.x > l.x ? 3 : -3; }); }
        if (e.isLeader) { const dx = gs.player.x - e.x; const dy = gs.player.y - e.y; const dist = Math.sqrt(dx*dx + dy*dy); e.angle = Math.atan2(dy, dx); if (dist > 50) { e.x += (dx/dist) * (1.5 + gs.fase * 0.3); e.y += (dy/dist) * (1.0 + gs.fase * 0.2); } e.fireTimer += 1; if (e.fireTimer > Math.max(30, 80 - (gs.fase * 8))) { gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 15, vx: Math.cos(e.angle)*5, vy: Math.sin(e.angle)*5, size: 8, damage: 15, homing: false, color: '#FF00FF', hp: 1 }); e.fireTimer = 0; } } 
        else { if (e.y < e.targetY) { e.y += e.vy; } else { e.x += Math.sin(now / 300) * 1.5; e.fireTimer += 1; if (e.fireTimer > Math.max(60, 120 - (gs.fase * 5)) && Math.random() < 0.05) { gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 15, vx: 0, vy: 6 + gs.fase, size: 6, damage: 10, homing: false, color: '#FF0055', hp: 1 }); e.fireTimer = 0; } } }
      }
      if (Math.abs(gs.player.x - e.x) < 30 && Math.abs(gs.player.y - e.y) < 30) { gs.player.hp -= 15; if (!e.mathRequired) e.hp = -100; criarParticulas(gs.player.x, gs.player.y, '#FF0000', 10); }
    });

    gs.lasers.forEach(l => {
      gs.enemyLasers.forEach(el => { if (el.homing && el.hp > 0 && Math.abs(l.x - el.x) < 25 && Math.abs(l.y - el.y) < 25) { el.hp -= l.damage; if (l.type !== 'LASER') l.y = -100; criarParticulas(el.x, el.y, '#FF8C00', 3); } });
      gs.enemies.forEach(e => {
        if (!e.mathRequired && Math.abs(l.x - e.x) < 25 && Math.abs(l.y - e.y) < 25) {
          if (e.shield && e.shield > 0) { e.shield -= l.damage; if (l.type !== 'LASER') l.y = -100; criarParticulas(e.x, e.y, '#00FFFF', 5); return; }
          e.hp -= l.damage;
          if (l.type === 'MISSILE') { criarParticulas(e.x, e.y, '#FF4444', 15); gs.enemies.forEach(e2 => { if (!e2.mathRequired && Math.abs(e.x - e2.x) < l.aoeRange && Math.abs(e.y - e2.y) < l.aoeRange) e2.hp -= l.damage; }); if (gs.boss.active && Math.abs(gs.boss.x - e.x) < l.aoeRange && Math.abs(gs.boss.y - e.y) < l.aoeRange) gs.boss.hp -= l.damage; l.y = -100; } 
          else if (l.type !== 'LASER') { l.y = -100; }
          criarParticulas(l.x, l.y, '#FFF', 3);
        } else if (e.mathRequired && Math.abs(l.x - e.x) < 40 && Math.abs(l.y - e.y) < 40) { l.y = -100; criarParticulas(l.x, l.y, '#00FFFF', 2); }
      });
      if (gs.boss.active && Math.abs(l.x - gs.boss.x) < 55 && Math.abs(l.y - gs.boss.y) < 45) {
        if (l.type !== 'LASER') l.y = -100; 
        if (gs.boss.shield) { criarParticulas(l.x, gs.boss.y + 45, '#00FFFF', 2); } else { gs.boss.hp -= l.damage; criarParticulas(l.x, l.y, '#FFD700', 4); if (l.type === 'MISSILE') { criarParticulas(l.x, l.y, '#FF4444', 15); l.y = -100; } }
      }
    });

    gs.enemyLasers.forEach(el => { if (Math.abs(el.x - gs.player.x) < 20 && Math.abs(el.y - gs.player.y) < 20) { gs.player.hp -= el.damage; el.hp = 0; criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8); } });

    // SISTEMA INTELIGENTE DE SPAWN
    if (now - gs.lastPowerupSpawn > 15000 && gs.powerups.length < 1 && gs.gameState === 'WAVES') {
      const tipos = [ { type: 'DAMAGE', color: '#FF00FF', nome: 'DANO NAVE' }, { type: 'FIRE_RATE', color: '#00FFFF', nome: 'CADÊNCIA UP' } ];
      if (!gs.player.tripleShot) { tipos.push({ type: 'TRIPLE_SHOT', color: '#FFD700', nome: 'TIRO TRIPLO' }); }
      
      if (!gs.player.weapons.missile.active) { tipos.push({ type: 'MISSILE_UNLOCK', color: '#FF4444', nome: 'MÍSSIL NOVO' }); } 
      else { tipos.push({ type: 'MISSILE_COOLDOWN', color: '#FF4444', nome: 'MÍSSIL: RECARGA' }); tipos.push({ type: 'MISSILE_DAMAGE', color: '#FF4444', nome: 'MÍSSIL: DANO' }); tipos.push({ type: 'MISSILE_AOE', color: '#FF4444', nome: 'MÍSSIL: ÁREA' }); tipos.push({ type: 'MISSILE_LIFE', color: '#FF4444', nome: 'MÍSSIL: TEMPO' }); }

      if (!gs.player.weapons.laser.active) { tipos.push({ type: 'LASER_UNLOCK', color: '#32CD32', nome: 'LASER NOVO' }); } 
      else { tipos.push({ type: 'LASER_COOLDOWN', color: '#32CD32', nome: 'LASER: RECARGA' }); tipos.push({ type: 'LASER_DAMAGE', color: '#32CD32', nome: 'LASER: DANO' }); tipos.push({ type: 'LASER_SIZE', color: '#32CD32', nome: 'LASER: TAMANHO' }); }

      const sel = tipos[Math.floor(Math.random() * tipos.length)];
      const eq = gerarEquacao(Math.min(3, gs.fase), getRespostasAtivas());
      gs.powerups.push({ id: Math.random().toString(), x: Math.random() * (gw - 80) + 40, y: -40, type: sel.type, color: sel.color, title: sel.nome, txt: eq.txt, res: eq.res, collected: false });
      gs.lastPowerupSpawn = now;
    }
    gs.powerups.forEach(p => { if (!p.collected) p.y += 1.5; }); 

    gs.enemies.forEach(e => { if (e.hp <= 0 && e.hp > -90) { gs.score += e.isLeader ? 50 : 20; criarParticulas(e.x, e.y, e.type === 'SQUAD' ? '#FF0055' : '#AAA', 10); } });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < gh + 20); 
    gs.powerups = gs.powerups.filter(p => p.y < gh + 50);

    if (gs.player.hp <= 0) gameOver();
    setFrames(f => f + 1); 
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) { gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color }); }
  };

  // --- TECLADO E COLISÕES DE MATEMÁTICA ---
  const lidarComTeclado = useCallback((valor: string) => {
    if (!jogoAtivo) return;
    
    if (valor === 'apagar') {
      setResposta(r => r.slice(0, -1));
    } else if (valor === 'enviar') {
      const num = parseInt(resposta);
      let acertou = false;

      const dispararMagia = (tx: number, ty: number, color: string) => { 
        gs.mathShots.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y, tx, ty, color, life: 15 }); 
      };

      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true; gs.boss.shield = false; gs.boss.timer = 0; gs.boss.nextShieldAt = Math.random() * 210 + 240; 
        dispararMagia(gs.boss.x, gs.boss.y, '#FFD700'); setTimeout(() => criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 50), 350); gs.score += 200;
      } 
      if (!acertou) {
        for (let i = 0; i < gs.enemies.length; i++) {
          let e = gs.enemies[i];
          if (e.mathRequired && !e.isDying && e.res === num) {
            acertou = true; e.solvesDone += 1;
            dispararMagia(e.x, e.y, '#00FFFF');
            if (e.solvesDone >= e.solvesNeeded) {
               e.isDying = true; e.mathRequired = false;
               setTimeout(() => { e.hp = -100; gs.score += 300; criarParticulas(e.x, e.y, '#00FFFF', 80); }, 350);
            } else {
               const eq = gerarEquacao(Math.min(3, gs.fase), getRespostasAtivas()); e.txt = eq.txt; e.res = eq.res;
            }
            break;
          }
        }
      }
        
      if (!acertou) {
        for (let i = 0; i < gs.powerups.length; i++) {
          let p = gs.powerups[i];
          if (!p.collected && p.res === num) {
            acertou = true; p.collected = true; 
            dispararMagia(p.x, p.y, p.color); 
            
            // Salvando referências para aplicar o buff e o Texto Flutuante
            const type = p.type; const color = p.color; const px = p.x; const py = p.y; const title = p.title;
            
            setTimeout(() => {
              criarParticulas(px, py, color, 30);
              // CRIA O TEXTO FLUTUANTE NA TELA!
              gs.floatingTexts.push({ id: Math.random().toString(), x: px, y: py, text: `+ ${title}`, color: color, life: 60 });
              
              if (type === 'DAMAGE') gs.player.damage += 0.5;
              else if (type === 'FIRE_RATE') gs.player.fireRate = Math.max(100, gs.player.fireRate - 20);
              else if (type === 'TRIPLE_SHOT') gs.player.tripleShot = true;
              else if (type === 'MISSILE_UNLOCK') gs.player.weapons.missile.active = true;
              else if (type === 'MISSILE_COOLDOWN') { gs.player.weapons.missile.baseCooldown = Math.max(3000, gs.player.weapons.missile.baseCooldown - 500); gs.player.weapons.missile.level += 1; }
              else if (type === 'MISSILE_DAMAGE') { gs.player.weapons.missile.damageMult += 0.5; gs.player.weapons.missile.level += 1; }
              else if (type === 'MISSILE_AOE') { gs.player.weapons.missile.aoeRange += 10; gs.player.weapons.missile.level += 1; }
              else if (type === 'MISSILE_LIFE') { gs.player.weapons.missile.life += 20; gs.player.weapons.missile.level += 1; }
              else if (type === 'LASER_UNLOCK') gs.player.weapons.laser.active = true;
              else if (type === 'LASER_COOLDOWN') { gs.player.weapons.laser.baseCooldown = Math.max(4000, gs.player.weapons.laser.baseCooldown - 500); gs.player.weapons.laser.level += 1; }
              else if (type === 'LASER_DAMAGE') { gs.player.weapons.laser.damageMult += 0.5; gs.player.weapons.laser.level += 1; }
              else if (type === 'LASER_SIZE') { gs.player.weapons.laser.sizeMult += 0.2; gs.player.weapons.laser.level += 1; }
              
              gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); gs.score += 50; p.y = 9999; 
            }, 350);
            break; 
          }
        }
      }

      if (!acertou && resposta !== '') { gs.player.hp = Math.max(0, gs.player.hp - 8); criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8); }
      setResposta('');
    } else {
      setResposta(r => r.length < 4 ? r + valor : r);
    }
  }, [jogoAtivo, resposta]);

  const porcentagemHP = Math.max(0, (gs.player.hp / gs.player.maxHp) * 100);
  const corHP = porcentagemHP > 50 ? '#32CD32' : porcentagemHP > 25 ? '#FFD700' : '#FF4444';

  const renderBuffs = () => (
    <View style={styles.buffContainer}>
      <Text style={[styles.buffText, { color: '#FF00FF' }]}>ATK: {gs.player.damage.toFixed(1)}</Text>
      <Text style={[styles.buffText, { color: '#00FFFF' }]}>TIRO: {(gs.player.fireRate / 1000).toFixed(2)}s</Text>
      {gs.player.tripleShot && <Text style={[styles.buffText, { color: '#FFD700' }]}>TRIPLO</Text>}
    </View>
  );

  const renderCooldownBox = (weaponKey: 'missile' | 'laser', color: string, icon: string) => {
    const w = gs.player.weapons[weaponKey];
    if (!w.active) return null;
    const pct = Math.max(0, Math.min(100, ((Date.now() - w.lastFire) / w.baseCooldown) * 100));
    
    // Calcula as estatísticas visuais que o usuário pediu
    const totalDamage = (gs.player.damage * w.damageMult).toFixed(1);
    const cooldownSecs = (w.baseCooldown / 1000).toFixed(1);

    return (
      <View key={weaponKey} style={{ alignItems: 'center' }}>
        <Text style={{color: color, fontSize: 10, fontWeight: 'bold', marginBottom: 2}}>Lv.{w.level}</Text>
        <View style={styles.skillBox}>
          <Ionicons name={icon as any} size={24} color={color} />
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
          <TouchableOpacity style={{ position: 'absolute', top: 20, left: 20 }} onPress={() => router.back()}><Ionicons name="arrow-back" size={30} color="#00FFFF" /></TouchableOpacity>
          <Ionicons name="rocket" size={100} color="#00FFFF" style={{ marginBottom: 20 }} />
          <Text style={styles.tituloMenu}>SKY</Text><Text style={styles.subTituloMenu}>EQUATIONS</Text>
          <Text style={styles.instrucoes}>Deslize o dedo pela tela de jogo. Painel de Status visual e Textos Flutuantes ativados!</Text>
          <TouchableOpacity style={styles.btnIniciar} onPress={iniciarJogo}><Text style={styles.btnIniciarTxt}>INICIAR MISSÃO</Text></TouchableOpacity>
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
          <TouchableOpacity style={[styles.btnIniciar, { marginTop: 40 }]} onPress={iniciarJogo}><Text style={styles.btnIniciarTxt}>TENTAR NOVAMENTE</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#555', marginTop: 15 }]} onPress={() => router.back()}><Text style={[styles.btnIniciarTxt, { color: '#888' }]}>VOLTAR AO MENU</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.hud}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.hudScore}>SCORE: {gs.score}</Text>
          <View style={styles.hpBarContainer}><View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]} /></View>
          {renderBuffs()}
        </View>
        <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 15 }}>
          <Text style={[styles.hudFase, { alignSelf: 'flex-start', marginTop: 15, marginRight: 5 }]}>FASE {gs.fase}</Text>
          {renderCooldownBox('missile', '#FF4444', 'rocket')}
          {renderCooldownBox('laser', '#32CD32', 'flash')}
        </View>
      </View>

      <View style={styles.gameArea} onLayout={(e) => { layoutRef.current.width = e.nativeEvent.layout.width; layoutRef.current.height = e.nativeEvent.layout.height; }} {...panResponder.panHandlers}>
        <View style={styles.gridOverlay} />
        {gs.gameState === 'BOSS_WARNING' && (<View style={styles.centerAlert}><Text style={styles.alertTextDanger}>ATENÇÃO</Text><Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text></View>)}
        {gs.gameState === 'TRANSITION' && (<View style={styles.centerAlert}><Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text><Text style={styles.alertSubText}>PREPARANDO SALTO...</Text></View>)}

        {gs.enemies.map(e => {
          if (e.type === 'METEOR') return <View key={e.id} style={[styles.meteorShape, { left: e.x - 15, top: e.y - 15 }]} />;
          if (e.type === 'FLANKER') return ( <View key={e.id} style={[styles.flankerShape, { left: e.x - 15, top: e.y - 15, transform: [{ rotate: e.vx > 0 ? '90deg' : '-90deg' }] }]}>{e.shield > 0 && <View style={styles.miniShield} />}</View>);
          if (e.type === 'SPAWNER') return (
             <View key={e.id} style={[styles.spawnerShape, { left: e.x - 40, top: e.y - 30 }]}>
                <Text style={styles.spawnerMath}>{e.txt}</Text>
                <View style={styles.powerupDots}>{Array.from({length: e.solvesNeeded}).map((_, i) => (<View key={i} style={[styles.dot, { backgroundColor: i < e.solvesDone ? '#00FFFF' : 'transparent', borderColor: '#00FFFF' }]} />))}</View>
             </View>
          );
          const rot = e.isLeader ? (e.angle - Math.PI/2) + 'rad' : '0rad'; 
          return (<View key={e.id} style={[styles.squadronShip, { left: e.x - 15, top: e.y - 15, borderTopColor: e.isLeader ? '#FF00FF' : '#FF0055', transform: [{ rotate: rot }] }]}>{e.shield > 0 && <View style={styles.miniShield} />}</View>);
        })}

        {gs.boss.active && (
          <View style={[styles.bossContainer, { left: gs.boss.x - 50, top: gs.boss.y - 30 }]}>
            <View style={styles.bossHpBar}><View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]} /></View>
            <View style={[styles.bossShip, gs.boss.type === 1 && { borderRadius: 0, backgroundColor: '#4B0082', borderColor: '#FF00FF' }, gs.boss.type === 2 && { borderRadius: 40, height: 80, backgroundColor: '#006400', borderColor: '#32CD32' }]} />
            {gs.boss.shield && (<View style={styles.bossShield}><Text style={styles.bossMath}>{gs.boss.txt}</Text></View>)}
          </View>
        )}

        {gs.powerups.map(p => (<View key={p.id} style={[styles.powerupBox, { left: p.x - 45, top: p.y - 20, borderColor: p.color, opacity: p.collected ? 0.4 : 1 }]}><Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text><Text style={styles.powerupMath}>{p.txt}</Text></View>))}
        {gs.lasers.map(l => (<View key={l.id} style={[styles.laserNormal, { left: l.x - (l.size/2), top: l.y, width: l.size, height: l.type === 'MISSILE' ? l.size : (l.type === 'LASER' ? l.size * 8 : l.size * 3), backgroundColor: l.type === 'LASER' ? '#32CD32' : l.type === 'MISSILE' ? '#FF4444' : '#00FFFF', borderRadius: l.type === 'MISSILE' ? l.size / 2 : 5 }]} />))}
        {gs.mathShots.map(ms => (<View key={ms.id} style={{ position: 'absolute', left: ms.x - 8, top: ms.y - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: ms.color, shadowColor: ms.color, shadowRadius: 10, shadowOpacity: 1, zIndex: 10 }} />))}
        {gs.enemyLasers.map(el => (<View key={el.id} style={[el.homing ? styles.cannonBall : styles.enemyLaser, { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color }]}>{el.homing && el.hp < 5 && <View style={{width:'100%', height:'100%', backgroundColor:'rgba(255,255,255,0.5)', borderRadius: 20}}/>}</View>))}
        {gs.particles.map((p, i) => (<View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }} />))}
        
        {/* TEXTOS FLUTUANTES (Feedback Visual de Upgrade) */}
        {gs.floatingTexts.map(ft => (
          <Text key={ft.id} style={[styles.floatingText, { left: ft.x - 40, top: ft.y, color: ft.color, opacity: ft.life / 60 }]}>
            {ft.text}
          </Text>
        ))}

        <View style={[styles.playerShape, { left: gs.player.x - 20, top: gs.player.y - 20 }]} />
        <View style={[styles.propulsor, { left: gs.player.x - 6, top: gs.player.y + 18, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />
      </View>

      <View style={styles.painelInferior}>
        <View style={styles.visorRadar}><Text style={styles.visorTexto}>{resposta || '_'}</Text></View>
        <View style={styles.tecladoContainer}>
          {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((linha, i) => (
            <View key={i} style={styles.tecladoRow}>{linha.map(num => <BotaoRetro key={num} valor={num} onPressWeb={lidarComTeclado} />)}</View>
          ))}
          <View style={styles.tecladoRow}><BotaoRetro valor="apagar" onPressWeb={lidarComTeclado} /><BotaoRetro valor="0" onPressWeb={lidarComTeclado} /><BotaoRetro valor="enviar" onPressWeb={lidarComTeclado} /></View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050015' },
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015' },
  tituloMenu: { fontSize: 55, fontWeight: '900', color: '#00FFFF', fontStyle: 'italic' },
  subTituloMenu: { fontSize: 35, fontWeight: '900', color: '#FFF', letterSpacing: 5 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 16, fontWeight: 'bold' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 12, marginTop: 50 },
  btnIniciarTxt: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  textoScore: { color: '#00FFFF', fontSize: 30, fontWeight: 'bold', marginTop: 20 },
  textoFase: { color: '#9D97B5', fontSize: 18, marginTop: 10 },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10 },
  hudScore: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { width: '100%', height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 5 },
  hudFase: { color: '#FF00FF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  buffContainer: { flexDirection: 'row', gap: 5, marginTop: 5 },
  buffText: { fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 4 },
  skillBox: { width: 34, height: 34, borderWidth: 2, borderColor: '#333', borderRadius: 8, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  skillOverlay: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  gameArea: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#050015' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.1, backgroundImage: 'linear-gradient(#00FFFF 1px, transparent 1px), linear-gradient(90deg, #00FFFF 1px, transparent 1px)', backgroundSize: '40px 40px' },
  centerAlert: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  alertTextDanger: { color: '#FF0055', fontSize: 40, fontWeight: '900', textShadowColor: '#FF0055', textShadowRadius: 10 },
  alertTextSuccess: { color: '#32CD32', fontSize: 40, fontWeight: '900', textShadowColor: '#32CD32', textShadowRadius: 10 },
  alertSubText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 5 },
  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 20, borderRightWidth: 20, borderBottomWidth: 40, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00FFFF' },
  propulsor: { position: 'absolute', width: 12, height: 15, backgroundColor: '#FF8C00', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  meteorShape: { position: 'absolute', width: 30, height: 30, backgroundColor: '#555', borderRadius: 5, borderWidth: 2, borderColor: '#777' },
  squadronShip: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 15, borderRightWidth: 15, borderTopWidth: 30, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  flankerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 20, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFA500' },
  miniShield: { position: 'absolute', top: -10, left: -20, width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#00FFFF', backgroundColor: 'rgba(0,255,255,0.1)' },
  spawnerShape: { position: 'absolute', width: 80, height: 60, backgroundColor: 'rgba(0, 255, 255, 0.2)', borderWidth: 3, borderColor: '#00FFFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowColor: '#00FFFF', shadowRadius: 15, zIndex: 15 },
  spawnerMath: { color: '#FFF', fontSize: 20, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 5 },
  bossContainer: { position: 'absolute', width: 100, height: 80, alignItems: 'center', zIndex: 20 },
  bossShip: { width: 80, height: 50, backgroundColor: '#8B0000', borderRadius: 20, borderWidth: 3, borderColor: '#FF4444' },
  bossHpBar: { width: '100%', height: 6, backgroundColor: '#333', marginBottom: 5, borderRadius: 3, overflow: 'hidden' },
  bossHpFill: { height: '100%', backgroundColor: '#FF0055' },
  bossShield: { position: 'absolute', top: -10, width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: '#00FFFF', backgroundColor: 'rgba(0, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center' },
  bossMath: { color: '#FFF', fontSize: 24, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 5 },
  powerupBox: { position: 'absolute', width: 105, height: 40, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  powerupTitle: { fontSize: 8, fontWeight: '900', position: 'absolute', top: -10, backgroundColor: '#050015', paddingHorizontal: 4 },
  powerupMath: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  powerupDots: { flexDirection: 'row', gap: 4, position: 'absolute', bottom: -8 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, backgroundColor: '#050015' },
  laserNormal: { position: 'absolute', zIndex: 1 },
  enemyLaser: { position: 'absolute', borderRadius: 5 },
  cannonBall: { position: 'absolute', borderRadius: 20, borderWidth: 2, borderColor: '#FFF' }, 
  floatingText: { position: 'absolute', fontSize: 14, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 3, zIndex: 100, textAlign: 'center', width: 100 },
  painelInferior: { backgroundColor: '#0A0025', borderTopWidth: 2, borderTopColor: '#FF00FF', paddingHorizontal: 15, paddingTop: 15, paddingBottom: Platform.OS === 'android' ? 20 : 15, alignItems: 'center' },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 12 },
  visorTexto: { color: '#00FFFF', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 8 },
  tecladoRow: { flexDirection: 'row', gap: 8, height: 50 },
  teclaRetro: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: 'rgba(255, 68, 68, 0.15)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(255, 0, 255, 0.15)', borderColor: '#FF00FF' },
});
