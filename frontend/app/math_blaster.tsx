import React, { useState, useEffect, useRef } from 'react';
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
      <TouchableOpacity 
        activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}
        style={[styles.teclaRetro, valor === 'apagar' && styles.teclaApagar, valor === 'enviar' && styles.teclaEnviar]}
      >
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
    player: { x: initialWidth / 2, y: 300, fireRate: 300, lastFire: 0, damage: 1, shotSize: 6, hp: 100, maxHp: 100 },
    lasers: [] as any[],
    specialLasers: [] as any[],
    enemies: [] as any[], // Meteoros e Esquadrões
    enemyLasers: [] as any[],
    powerups: [] as any[],
    particles: [] as any[],
    boss: { active: false, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 },
    score: 0,
    fase: 1,
    gameState: 'WAVES', // 'WAVES', 'BOSS_WARNING', 'BOSS', 'TRANSITION'
    stateTimer: 0,
    lastPowerupSpawn: 0,
    lastTouchX: 0,
    lastTouchY: 0
  }).current;

  const loopRef = useRef<any>(null);

  // --- CONTROLE ESTILO SKY FORCE (A TELA INTEIRA É O CONTROLE) ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => {
        gs.lastTouchX = gestureState.x0;
        gs.lastTouchY = gestureState.y0;
      },
      onPanResponderMove: (e, gestureState) => {
        const dx = gestureState.moveX - gs.lastTouchX;
        const dy = gestureState.moveY - gs.lastTouchY;
        
        // Move a nave com sensibilidade extra (1.5x) para o dedo não cobrir a nave
        gs.player.x += dx * 1.5;
        gs.player.y += dy * 1.5;
        
        gs.lastTouchX = gestureState.moveX;
        gs.lastTouchY = gestureState.moveY;
      }
    })
  ).current;

  // --- MATEMÁTICA ---
  const gerarEquacao = (dificuldade: number) => {
    const r = (m: number) => Math.floor(Math.random() * m);
    let n1, n2, res, txt;
    if (dificuldade === 1) { n1 = r(10)+1; n2 = r(10)+1; res = n1+n2; txt = `${n1} + ${n2}`; }
    else if (dificuldade === 2) { n1 = r(15)+5; n2 = r(n1)+1; res = n1-n2; txt = `${n1} - ${n2}`; }
    else { n1 = r(8)+2; n2 = r(8)+2; res = n1*n2; txt = `${n1} × ${n2}`; }
    return { txt, res };
  };

  const iniciarJogo = () => {
    gs.player = { x: layoutRef.current.width / 2, y: layoutRef.current.height - 100, fireRate: 300, lastFire: 0, damage: 1, shotSize: 6, hp: 100, maxHp: 100 };
    gs.lasers = []; gs.specialLasers = []; gs.enemies = []; gs.enemyLasers = []; gs.powerups = []; gs.particles = [];
    gs.boss = { active: false, x: 0, y: -100, hp: 0, maxHp: 0, vx: 4, shield: false, txt: '', res: 0, timer: 0, nextShieldAt: 100 };
    gs.score = 0; gs.fase = 1; gs.gameState = 'WAVES'; gs.stateTimer = 0;
    setResposta(''); setJogoAtivo(true);
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); 
  };

  const gameOver = () => {
    setJogoAtivo(false);
    if (loopRef.current) clearInterval(loopRef.current);
  };

  // --- MOTOR PRINCIPAL ---
  const gameTick = () => {
    const now = Date.now();
    const gw = layoutRef.current.width;
    const gh = layoutRef.current.height;

    // 1. Travar jogador nas bordas
    if (gs.player.x < 20) gs.player.x = 20;
    if (gs.player.x > gw - 20) gs.player.x = gw - 20;
    if (gs.player.y < 20) gs.player.y = 20;
    if (gs.player.y > gh - 20) gs.player.y = gh - 20;

    // 2. Auto-Fire do Jogador
    if (now - gs.player.lastFire > gs.player.fireRate) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 20, damage: gs.player.damage, size: gs.player.shotSize });
      gs.player.lastFire = now;
    }

    // 3. Mover Tiros do Jogador
    gs.lasers.forEach(l => l.y -= 15);
    gs.lasers = gs.lasers.filter(l => l.y > -20);
    gs.specialLasers.forEach(sl => sl.life -= 1);
    gs.specialLasers = gs.specialLasers.filter(sl => sl.life > 0);

    // Tiros Inimigos
    gs.enemyLasers.forEach(el => {
      if (el.homing) {
        const dx = gs.player.x - el.x;
        const dy = gs.player.y - el.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        el.vx += (dx/dist) * 0.4; 
        el.vy += (dy/dist) * 0.4;
        const speed = Math.sqrt(el.vx*el.vx + el.vy*el.vy);
        const maxSpeed = 6 + (gs.fase * 0.5);
        if (speed > maxSpeed) { el.vx = (el.vx/speed) * maxSpeed; el.vy = (el.vy/speed) * maxSpeed; }
      }
      el.x += el.vx; el.y += el.vy;
    });
    gs.enemyLasers = gs.enemyLasers.filter(el => el.y < gh + 20 && el.x > -20 && el.x < gw + 20);

    // 4. Mover Partículas
    gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 1; });
    gs.particles = gs.particles.filter(p => p.life > 0);

    // --- DIRETOR DE CENA (RITMO DE JOGO) ---
    gs.stateTimer += 1;

    if (gs.gameState === 'WAVES') {
      
      // Meteoros contínuos (Caem o tempo todo)
      if (gs.stateTimer % 60 === 0) {
        gs.enemies.push({ id: Math.random().toString(), type: 'METEOR', x: Math.random() * (gw - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), vy: Math.random() * 2 + 4 + (gs.fase * 0.5) });
      }

      // Esquadrões (Chegam a cada 12 segundos)
      if (gs.stateTimer % 350 === 0 && gs.stateTimer < 1100) {
        const cx = Math.random() * (gw - 120) + 60;
        const baseHp = 2 + gs.fase;
        // Líder (Caçador)
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx, y: -30, targetY: 100, isLeader: true, hp: baseHp * 2, vy: 3, fireTimer: 0 });
        // Asas (Estáticos)
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx - 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vy: 3, fireTimer: 0 });
        gs.enemies.push({ id: Math.random().toString(), type: 'SQUAD', x: cx + 45, y: -60, targetY: 70, isLeader: false, hp: baseHp, vy: 3, fireTimer: 0 });
      }

      // Prepara o Boss depois de bastante tempo de ondas (Aprox 40 segundos)
      if (gs.stateTimer > 1200 && gs.enemies.filter(e => e.type === 'SQUAD').length === 0) {
        gs.gameState = 'BOSS_WARNING';
        gs.stateTimer = 0;
      }
    } 
    else if (gs.gameState === 'BOSS_WARNING') {
      if (gs.stateTimer > 90) { 
        gs.gameState = 'BOSS';
        gs.stateTimer = 0;
        const eq = gerarEquacao(Math.min(3, gs.fase));
        gs.boss = { active: true, x: gw / 2, y: -100, hp: 80 + (gs.fase * 60), maxHp: 80 + (gs.fase * 60), vx: 3 + gs.fase, shield: false, txt: eq.txt, res: eq.res, timer: 0, nextShieldAt: 100 };
      }
    }
    else if (gs.gameState === 'BOSS') {
      if (gs.boss.y < 80) gs.boss.y += 2; // Desce para a arena
      else {
        gs.boss.x += gs.boss.vx;
        if (gs.boss.x < 60 || gs.boss.x > gw - 60) gs.boss.vx *= -1; // Patrulha
        
        gs.boss.timer += 1;

        // Boss Atira
        if (gs.boss.timer % Math.max(40, 90 - (gs.fase * 10)) === 0) {
          gs.enemyLasers.push({ id: Math.random().toString(), x: gs.boss.x, y: gs.boss.y + 30, vx: 0, vy: 2, size: 15, damage: 20, homing: true, color: '#FF8C00' });
        }

        // Lógica Variável do Escudo
        if (!gs.boss.shield && gs.boss.timer > gs.boss.nextShieldAt) {
          const eq = gerarEquacao(Math.min(3, gs.fase));
          gs.boss.shield = true; 
          gs.boss.txt = eq.txt; 
          gs.boss.res = eq.res;
        }
      }

      if (gs.boss.hp <= 0) {
        criarParticulas(gs.boss.x, gs.boss.y, '#FFD700', 50);
        gs.score += 500 * gs.fase;
        gs.boss.active = false;
        gs.gameState = 'TRANSITION';
        gs.stateTimer = 0;
        gs.enemyLasers = [];
      }
    }
    else if (gs.gameState === 'TRANSITION') {
      if (gs.stateTimer > 90) {
        gs.fase += 1;
        gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 30); 
        gs.gameState = 'WAVES';
        gs.stateTimer = 0;
      }
    }

    // --- COLISÕES E INTELIGÊNCIA DOS INIMIGOS ---
    gs.enemies.forEach(e => {
      
      // Inteligência Artificial
      if (e.type === 'METEOR') {
        e.y += e.vy; // Cai reto
      } 
      else if (e.type === 'SQUAD') {
        if (e.y < e.targetY) {
          e.y += e.vy; // Descendo pra posição
        } else {
          // Estacionou!
          e.fireTimer += 1;
          if (e.isLeader) {
            // Líder caça a nave (Mira no jogador de forma suave)
            e.x += (gs.player.x - e.x) * 0.015;
          } else {
            // Asas ficam flutuando levemente
            e.x += Math.sin(now / 300) * 1.5;
          }

          // Atiram
          if (e.fireTimer > 60 && Math.random() < 0.03) {
            gs.enemyLasers.push({ id: Math.random().toString(), x: e.x, y: e.y + 15, vx: 0, vy: 6 + gs.fase, size: 6, damage: 10, homing: false, color: '#FF0055' });
            e.fireTimer = 0;
          }
        }
      }

      // Laser -> Inimigo
      gs.lasers.forEach(l => {
        if (Math.abs(l.x - e.x) < 25 && Math.abs(l.y - e.y) < 25) {
          e.hp -= l.damage;
          l.y = -100; 
          criarParticulas(l.x, l.y, '#FFF', 3);
        }
      });
      // Nave -> Inimigo
      if (Math.abs(gs.player.x - e.x) < 30 && Math.abs(gs.player.y - e.y) < 30) {
        gs.player.hp -= 15;
        e.hp = -100;
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 10);
      }
    });

    // Laser -> Boss
    if (gs.boss.active) {
      gs.lasers.forEach(l => {
        if (Math.abs(l.x - gs.boss.x) < 55 && Math.abs(l.y - gs.boss.y) < 45) {
          l.y = -100; 
          if (gs.boss.shield) {
            criarParticulas(l.x, gs.boss.y + 45, '#00FFFF', 2); 
          } else {
            gs.boss.hp -= l.damage;
            criarParticulas(l.x, l.y, '#FFD700', 4); 
          }
        }
      });
    }

    // Tiros Inimigos -> Jogador
    gs.enemyLasers.forEach(el => {
      if (Math.abs(el.x - gs.player.x) < 20 && Math.abs(el.y - gs.player.y) < 20) {
        gs.player.hp -= el.damage;
        el.y = gh + 100; 
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8);
      }
    });

    // Spawner de Power-Ups
    if (now - gs.lastPowerupSpawn > 18000 && gs.powerups.length < 1 && gs.gameState === 'WAVES') {
      const tipos = [{ type: 'SPEED', color: '#00FFFF', nome: 'VELOCIDADE' }, { type: 'DAMAGE', color: '#FF00FF', nome: 'DANO MAX' }];
      const selecionado = tipos[Math.floor(Math.random() * tipos.length)];
      const eq = gerarEquacao(Math.min(3, gs.fase));
      gs.powerups.push({ id: Math.random().toString(), x: Math.random() * (gw - 80) + 40, y: -40, type: selecionado.type, color: selecionado.color, title: selecionado.nome, txt: eq.txt, res: eq.res });
      gs.lastPowerupSpawn = now;
    }
    gs.powerups.forEach(p => p.y += 1.5); 

    // Limpezas
    gs.enemies.forEach(e => { if (e.hp <= 0 && e.hp > -90) { gs.score += e.type==='SQUAD'?30:10; criarParticulas(e.x, e.y, e.type==='SQUAD'?'#FF0055':'#AAA', 10); } });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < gh + 20);
    gs.powerups = gs.powerups.filter(p => p.y < gh + 50);

    if (gs.player.hp <= 0) gameOver();

    setFrames(f => f + 1); 
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) { gs.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 15, color }); }
  };

  // --- TECLADO MATEMÁTICO ---
  const lidarComTeclado = (valor: string) => {
    if (!jogoAtivo) return;
    if (valor === 'apagar') setResposta(r => r.slice(0, -1));
    else if (valor === 'enviar') {
      const num = parseInt(resposta);
      let acertou = false;

      // 1: Escudo do Boss
      if (gs.boss.active && gs.boss.shield && gs.boss.res === num) {
        acertou = true;
        gs.boss.shield = false;
        gs.boss.timer = 0;
        gs.boss.nextShieldAt = Math.random() * 210 + 240; // Tempo variável de 8 a 15 segundos sem escudo!
        
        gs.specialLasers.push({ id: Math.random().toString(), startX: gs.player.x, startY: gs.player.y, endX: gs.boss.x, endY: gs.boss.y, color: '#FFD700', life: 15 });
        criarParticulas(gs.boss.x, gs.boss.y, '#00FFFF', 40); 
        gs.score += 100;
      } 
      // 2: PowerUps
      else {
        for (let i = 0; i < gs.powerups.length; i++) {
          let p = gs.powerups[i];
          if (p.res === num) {
            acertou = true;
            gs.specialLasers.push({ id: Math.random().toString(), startX: gs.player.x, startY: gs.player.y, endX: p.x, endY: p.y, color: p.color, life: 10 });
            criarParticulas(p.x, p.y, p.color, 20);
            
            if (p.type === 'DAMAGE') gs.player.damage += 1;
            gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 20); 
            gs.score += 50;
            p.y = 9999; 
            break; 
          }
        }
      }

      if (!acertou && resposta !== '') {
        gs.player.hp = Math.max(0, gs.player.hp - 8);
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 8);
      }
      setResposta('');
    }
    else setResposta(r => r.length < 4 ? r + valor : r);
  };

  const porcentagemHP = Math.max(0, (gs.player.hp / gs.player.maxHp) * 100);
  const corHP = porcentagemHP > 50 ? '#32CD32' : porcentagemHP > 25 ? '#FFD700' : '#FF4444';

  // --- TELAS ---
  if (!jogoAtivo && gs.score === 0 && gs.player.hp === 100) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={{ position: 'absolute', top: 20, left: 20 }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={30} color="#00FFFF" />
          </TouchableOpacity>
          <Ionicons name="rocket" size={100} color="#00FFFF" style={{ marginBottom: 20 }} />
          <Text style={styles.tituloMenu}>SKY</Text>
          <Text style={styles.subTituloMenu}>EQUATIONS</Text>
          <Text style={styles.instrucoes}>Deslize o dedo pela tela para mover a nave. Ela atira automaticamente.</Text>
          <Text style={[styles.instrucoes, { color: '#FFD700' }]}>Resolva contas no teclado para quebrar Escudos e pegar Power-Ups!</Text>
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
      
      {/* HUD SUPERIOR */}
      <View style={styles.hud}>
        <View style={{ flex: 1, paddingRight: 20 }}>
          <Text style={styles.hudScore}>SCORE: {gs.score}</Text>
          <View style={styles.hpBarContainer}>
            <View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]} />
          </View>
        </View>
        <Text style={styles.hudFase}>FASE {gs.fase}</Text>
      </View>

      {/* ÁREA DO JOGO (Agora é o controle inteiro da nave) */}
      <View 
        style={styles.gameArea} 
        onLayout={(e) => { layoutRef.current.width = e.nativeEvent.layout.width; layoutRef.current.height = e.nativeEvent.layout.height; }}
        {...panResponder.panHandlers}
      >
        <View style={styles.gridOverlay} />

        {/* ALERTA DE BOSS E TRANSIÇÃO */}
        {gs.gameState === 'BOSS_WARNING' && (
          <View style={styles.centerAlert}>
            <Text style={styles.alertTextDanger}>ATENÇÃO</Text>
            <Text style={styles.alertSubText}>NAVE MÃE SE APROXIMANDO</Text>
          </View>
        )}
        {gs.gameState === 'TRANSITION' && (
          <View style={styles.centerAlert}>
            <Text style={styles.alertTextSuccess}>FASE CONCLUÍDA</Text>
            <Text style={styles.alertSubText}>PREPARANDO SALTO...</Text>
          </View>
        )}

        {/* INIMIGOS */}
        {gs.enemies.map(e => {
          if (e.type === 'METEOR') {
            // Meteoro (Quadrado Rústico)
            return <View key={e.id} style={[styles.meteorShape, { left: e.x - 15, top: e.y - 15 }]} />;
          } else {
            // Naves do Esquadrão
            return <View key={e.id} style={[styles.squadronShip, { left: e.x - 15, top: e.y - 15, borderTopColor: e.isLeader ? '#FF00FF' : '#FF0055' }]} />;
          }
        })}

        {/* O CHEFÃO (BOSS) */}
        {gs.boss.active && (
          <View style={[styles.bossContainer, { left: gs.boss.x - 50, top: gs.boss.y - 30 }]}>
            <View style={styles.bossHpBar}>
               <View style={[styles.bossHpFill, { width: `${Math.max(0, (gs.boss.hp / gs.boss.maxHp) * 100)}%` }]} />
            </View>
            <View style={styles.bossShip} />
            {gs.boss.shield && (
              <View style={styles.bossShield}>
                 <Text style={styles.bossMath}>{gs.boss.txt}</Text>
              </View>
            )}
          </View>
        )}

        {/* POWER-UPS */}
        {gs.powerups.map(p => (
          <View key={p.id} style={[styles.powerupBox, { left: p.x - 35, top: p.y - 20, borderColor: p.color }]}>
            <Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text>
            <Text style={styles.powerupMath}>{p.txt}</Text>
          </View>
        ))}

        {/* TIROS AUTOMÁTICOS */}
        {gs.lasers.map(l => (
          <View key={l.id} style={[styles.laserNormal, { left: l.x - (l.size/2), top: l.y, width: l.size, height: l.size * 3 }]} />
        ))}

        {/* TIROS INIMIGOS E DO BOSS */}
        {gs.enemyLasers.map(el => (
          <View key={el.id} style={[
            el.homing ? styles.cannonBall : styles.enemyLaser, 
            { left: el.x - (el.size/2), top: el.y - (el.size/2), width: el.size, height: el.size, backgroundColor: el.color }
          ]} />
        ))}

        {/* TIROS ESPECIAIS TELEGUIADOS */}
        {gs.specialLasers.map(sl => {
          const dx = sl.endX - sl.startX; const dy = sl.endY - sl.startY;
          const dist = Math.sqrt(dx*dx + dy*dy); const angle = Math.atan2(dy, dx);
          return (
            <View key={sl.id} style={[styles.laserEspecial, { left: sl.startX, top: sl.startY, width: dist, backgroundColor: sl.color, transform: [{ rotate: `${angle}rad` }, { translateX: dist / 2 }] }]} />
          );
        })}

        {/* PARTÍCULAS */}
        {gs.particles.map((p, i) => (
          <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y, borderRadius: 2 }} />
        ))}

        {/* NAVE DO JOGADOR */}
        <View style={[styles.playerShape, { left: gs.player.x - 20, top: gs.player.y - 20 }]} />
        <View style={[styles.propulsor, { left: gs.player.x - 6, top: gs.player.y + 18, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />

      </View>

      {/* PAINEL INFERIOR */}
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

  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10 },
  hudScore: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 6 },
  hudFase: { color: '#FF00FF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },

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
  
  bossContainer: { position: 'absolute', width: 100, height: 80, alignItems: 'center', zIndex: 20 },
  bossShip: { width: 80, height: 50, backgroundColor: '#8B0000', borderRadius: 20, borderWidth: 3, borderColor: '#FF4444' },
  bossHpBar: { width: '100%', height: 6, backgroundColor: '#333', marginBottom: 5, borderRadius: 3, overflow: 'hidden' },
  bossHpFill: { height: '100%', backgroundColor: '#FF0055' },
  bossShield: { position: 'absolute', top: -10, width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: '#00FFFF', backgroundColor: 'rgba(0, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center' },
  bossMath: { color: '#FFF', fontSize: 24, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 5 },

  powerupBox: { position: 'absolute', width: 70, height: 40, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  powerupTitle: { fontSize: 8, fontWeight: '900', position: 'absolute', top: -10, backgroundColor: '#050015', paddingHorizontal: 4 },
  powerupMath: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  laserNormal: { position: 'absolute', backgroundColor: '#00FFFF', borderRadius: 5, zIndex: 1 },
  enemyLaser: { position: 'absolute', borderRadius: 5 },
  cannonBall: { position: 'absolute', borderRadius: 10 },
  laserEspecial: { position: 'absolute', height: 6, borderRadius: 3, shadowRadius: 10, zIndex: 5 },

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
