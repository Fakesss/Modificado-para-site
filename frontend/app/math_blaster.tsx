import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.60; 

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

// --- MOTOR DO JOGO ---
export default function MathBlaster() {
  const router = useRouter();
  const [jogoAtivo, setJogoAtivo] = useState(false);
  const [frames, setFrames] = useState(0); // Gatilho de re-render
  const [resposta, setResposta] = useState('');
  
  // Estado completo do motor rodando fora do ciclo do React para máxima performance (60fps)
  const gs = useRef({
    player: { x: width / 2, y: GAME_AREA_HEIGHT - 50, vx: 0, vy: 0, speed: 4, fireRate: 400, lastFire: 0, damage: 1, shotSize: 4, hp: 100, maxHp: 100 },
    lasers: [] as any[],
    specialLasers: [] as any[], // Laser da matemática
    enemies: [] as any[],
    powerups: [] as any[],
    particles: [] as any[],
    score: 0,
    fase: 1,
    lastEnemySpawn: 0,
    lastPowerupSpawn: 0,
    joystickAtivo: false
  }).current;

  const loopRef = useRef<any>(null);

  // --- JOYSTICK ANALÓGICO ---
  const joyAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { gs.joystickAtivo = true; },
      onPanResponderMove: (e, gesture) => {
        const maxDist = 40;
        let dx = gesture.dx; let dy = gesture.dy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > maxDist) { dx = (dx/dist) * maxDist; dy = (dy/dist) * maxDist; }
        gs.player.vx = dx / maxDist;
        gs.player.vy = dy / maxDist;
        joyAnim.setValue({ x: dx, y: dy });
      },
      onPanResponderRelease: () => {
        gs.joystickAtivo = false;
        gs.player.vx = 0; gs.player.vy = 0;
        Animated.spring(joyAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    })
  ).current;

  // --- LÓGICA MATEMÁTICA ---
  const gerarEquacao = (dificuldade: number) => {
    const r = (m: number) => Math.floor(Math.random() * m);
    let n1, n2, res, txt;
    if (dificuldade === 1) { n1 = r(10)+1; n2 = r(10)+1; res = n1+n2; txt = `${n1} + ${n2}`; }
    else if (dificuldade === 2) { n1 = r(15)+5; n2 = r(n1)+1; res = n1-n2; txt = `${n1} - ${n2}`; }
    else { n1 = r(8)+2; n2 = r(8)+2; res = n1*n2; txt = `${n1} × ${n2}`; }
    return { txt, res };
  };

  const iniciarJogo = () => {
    gs.player = { x: width / 2, y: GAME_AREA_HEIGHT - 50, vx: 0, vy: 0, speed: 4, fireRate: 400, lastFire: 0, damage: 1, shotSize: 4, hp: 100, maxHp: 100 };
    gs.lasers = []; gs.specialLasers = []; gs.enemies = []; gs.powerups = []; gs.particles = [];
    gs.score = 0; gs.fase = 1; setResposta(''); setJogoAtivo(true);
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(gameTick, 30); // ~33 FPS
  };

  const gameOver = () => {
    setJogoAtivo(false);
    if (loopRef.current) clearInterval(loopRef.current);
  };

  // --- TICK DO MOTOR (O CORAÇÃO DO JOGO) ---
  const gameTick = () => {
    const now = Date.now();

    // 1. Movimento do Jogador
    gs.player.x += gs.player.vx * gs.player.speed;
    gs.player.y += gs.player.vy * gs.player.speed;
    
    // Travar nas bordas
    if (gs.player.x < 15) gs.player.x = 15;
    if (gs.player.x > width - 15) gs.player.x = width - 15;
    if (gs.player.y < 20) gs.player.y = 20;
    if (gs.player.y > GAME_AREA_HEIGHT - 20) gs.player.y = GAME_AREA_HEIGHT - 20;

    // 2. Auto-Fire (Tiro Normal)
    if (now - gs.lastFire > gs.player.fireRate) {
      gs.lasers.push({ id: Math.random().toString(), x: gs.player.x, y: gs.player.y - 15, damage: gs.player.damage, size: gs.player.shotSize });
      gs.lastFire = now;
    }

    // 3. Mover Tiros Normais
    gs.lasers.forEach(l => l.y -= 12);
    gs.lasers = gs.lasers.filter(l => l.y > -20);

    // 4. Mover Tiros Especiais (Visuais da Matemática)
    gs.specialLasers.forEach(sl => sl.life -= 1);
    gs.specialLasers = gs.specialLasers.filter(sl => sl.life > 0);

    // 5. Mover Partículas (Explosões)
    gs.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 1; });
    gs.particles = gs.particles.filter(p => p.life > 0);

    // 6. Atualizar Fases
    gs.fase = 1 + Math.floor(gs.score / 150);

    // 7. Spawner de Inimigos Normais
    if (now - gs.lastEnemySpawn > Math.max(800, 2000 - (gs.fase * 200))) {
      gs.enemies.push({ id: Math.random().toString(), x: Math.random() * (width - 40) + 20, y: -30, hp: 1 + Math.floor(gs.fase/2), speed: Math.random() * 2 + 2 + (gs.fase * 0.2) });
      gs.lastEnemySpawn = now;
    }

    // 8. Spawner de Power-Ups (Matemática)
    if (now - gs.lastPowerupSpawn > 10000 && gs.powerups.length < 2) {
      const tipos = [
        { type: 'SPEED', color: '#00FFFF', nome: 'VELOCIDADE' },
        { type: 'FIRE_RATE', color: '#FFD700', nome: 'CADÊNCIA' },
        { type: 'SIZE', color: '#32CD32', nome: 'TAMANHO' },
        { type: 'DAMAGE', color: '#FF00FF', nome: 'DANO' }
      ];
      const selecionado = tipos[Math.floor(Math.random() * tipos.length)];
      // PowerUps roxos/fortes exigem 2 contas
      const solvesNeeded = selecionado.type === 'DAMAGE' || gs.fase > 3 ? 2 : 1; 
      const eq = gerarEquacao(Math.min(3, gs.fase));
      
      gs.powerups.push({ id: Math.random().toString(), x: Math.random() * (width - 60) + 30, y: -40, type: selecionado.type, color: selecionado.color, title: selecionado.nome, txt: eq.txt, res: eq.res, solvesNeeded, solvesDone: 0 });
      gs.lastPowerupSpawn = now;
    }

    // 9. Colisões e Movimento: Inimigos Normais
    gs.enemies.forEach(e => {
      e.y += e.speed;
      // Colisão Tiro -> Inimigo
      gs.lasers.forEach(l => {
        if (Math.abs(l.x - e.x) < 20 && Math.abs(l.y - e.y) < 20) {
          e.hp -= l.damage;
          l.y = -100; // Destrói o tiro
          criarParticulas(l.x, l.y, '#FFF', 3);
        }
      });
      // Colisão Jogador -> Inimigo
      if (Math.abs(gs.player.x - e.x) < 25 && Math.abs(gs.player.y - e.y) < 25) {
        gs.player.hp -= 15;
        e.hp = -100;
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 10);
      }
    });

    // Mover Powerups
    gs.powerups.forEach(p => p.y += 1.5); // Caem devagarzinho

    // Limpezas e Pontuação
    gs.enemies.forEach(e => { if (e.hp <= 0 && e.hp > -90) { gs.score += 10; criarParticulas(e.x, e.y, '#FF4444', 8); } });
    gs.enemies = gs.enemies.filter(e => e.hp > 0 && e.y < GAME_AREA_HEIGHT + 20);
    gs.powerups = gs.powerups.filter(p => p.y < GAME_AREA_HEIGHT + 50);

    // Game Over Check
    if (gs.player.hp <= 0) gameOver();

    // Forçar atualização da tela
    setFrames(f => f + 1);
  };

  const criarParticulas = (x: number, y: number, color: string, qtd: number) => {
    for(let i=0; i<qtd; i++) {
      gs.particles.push({ x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 15, color });
    }
  };

  // --- INTERAÇÃO COM TECLADO MATEMÁTICO ---
  const lidarComTeclado = (valor: string) => {
    if (!jogoAtivo) return;
    if (valor === 'apagar') setResposta(r => r.slice(0, -1));
    else if (valor === 'enviar') {
      const num = parseInt(resposta);
      let acertou = false;

      // Verifica se a resposta bate com algum PowerUp na tela
      for (let i = 0; i < gs.powerups.length; i++) {
        let p = gs.powerups[i];
        if (p.res === num) {
          acertou = true;
          // Dispara laser especial visual
          gs.specialLasers.push({ id: Math.random().toString(), startX: gs.player.x, startY: gs.player.y, endX: p.x, endY: p.y, color: p.color, life: 8 });
          criarParticulas(p.x, p.y, p.color, 15);
          
          p.solvesDone += 1;
          if (p.solvesDone >= p.solvesNeeded) {
            // Pegou o PowerUp!
            coletarPowerUp(p.type);
            gs.score += 50;
            p.y = 9999; // Remove da tela
          } else {
            // Precisa de mais contas. Gera uma nova.
            const eq = gerarEquacao(Math.min(3, gs.fase));
            p.txt = eq.txt; p.res = eq.res;
          }
          break; // Só acerta um powerup por vez
        }
      }

      if (!acertou && gs.powerups.length > 0 && resposta !== '') {
        // Errou a conta: Penalidade!
        gs.player.hp = Math.max(0, gs.player.hp - 5);
        criarParticulas(gs.player.x, gs.player.y, '#FF0000', 5);
      }
      setResposta('');
    }
    else setResposta(r => r.length < 4 ? r + valor : r);
  };

  const coletarPowerUp = (type: string) => {
    if (type === 'SPEED') gs.player.speed = Math.min(8, gs.player.speed + 1);
    if (type === 'FIRE_RATE') gs.player.fireRate = Math.max(100, gs.player.fireRate - 80);
    if (type === 'SIZE') gs.player.shotSize = Math.min(12, gs.player.shotSize + 2);
    if (type === 'DAMAGE') gs.player.damage += 1;
    // Cura um pouquinho sempre que pega powerup
    gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 10);
  };

  const porcentagemHP = Math.max(0, (gs.player.hp / gs.player.maxHp) * 100);
  const corHP = porcentagemHP > 50 ? '#32CD32' : porcentagemHP > 25 ? '#FFD700' : '#FF4444';

  // --- TELAS FORA DO JOGO ---
  if (!jogoAtivo && gs.score === 0 && gs.player.hp === 100) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={{ position: 'absolute', top: 20, left: 20 }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={30} color="#00FFFF" />
          </TouchableOpacity>
          <Ionicons name="rocket" size={100} color="#00FFFF" style={{ marginBottom: 20 }} />
          <Text style={styles.tituloMenu}>NEON</Text>
          <Text style={styles.subTituloMenu}>BLASTER</Text>
          <Text style={styles.instrucoes}>Use o analógico para mover. Sua nave atira sozinha nos inimigos vermelhos.</Text>
          <Text style={[styles.instrucoes, { color: '#FFD700' }]}>Resolva as contas para capturar os Power-Ups e ficar invencível!</Text>
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

  // --- TELA DO JOGO (RENDER RÁPIDO) ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HUD SUPERIOR */}
      <View style={styles.hud}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hudScore}>SCORE: {gs.score}</Text>
          <View style={styles.hpBarContainer}>
            <View style={[styles.hpBarFill, { width: `${porcentagemHP}%`, backgroundColor: corHP }]} />
          </View>
        </View>
        <Text style={styles.hudFase}>FASE {gs.fase}</Text>
      </View>

      {/* ÁREA DO JOGO */}
      <View style={styles.gameArea}>
        
        {/* Fundo de Linhas (Grid Retrô) */}
        <View style={styles.gridOverlay} />

        {/* INIMIGOS NORMAIS (Triângulos Invertidos Vermelhos) */}
        {gs.enemies.map(e => (
          <View key={e.id} style={[styles.enemyShape, { left: e.x - 15, top: e.y - 15 }]} />
        ))}

        {/* POWER-UPS (Caixas Matemáticas) */}
        {gs.powerups.map(p => (
          <View key={p.id} style={[styles.powerupBox, { left: p.x - 35, top: p.y - 25, borderColor: p.color, shadowColor: p.color }]}>
            <Text style={[styles.powerupTitle, { color: p.color }]}>{p.title}</Text>
            <Text style={styles.powerupMath}>{p.txt}</Text>
            {p.solvesNeeded > 1 && (
               <View style={styles.powerupDots}>
                 {Array.from({length: p.solvesNeeded}).map((_, i) => (
                   <View key={i} style={[styles.dot, { backgroundColor: i < p.solvesDone ? p.color : 'transparent', borderColor: p.color }]} />
                 ))}
               </View>
            )}
          </View>
        ))}

        {/* TIROS AUTOMÁTICOS */}
        {gs.lasers.map(l => (
          <View key={l.id} style={[styles.laserNormal, { left: l.x - (l.size/2), top: l.y, width: l.size, height: l.size * 4 }]} />
        ))}

        {/* TIROS ESPECIAIS (Laser Matemático Teleguiado) */}
        {gs.specialLasers.map(sl => {
          const dx = sl.endX - sl.startX; const dy = sl.endY - sl.startY;
          const dist = Math.sqrt(dx*dx + dy*dy); const angle = Math.atan2(dy, dx);
          return (
            <View key={sl.id} style={[styles.laserEspecial, {
              left: sl.startX, top: sl.startY, width: dist, backgroundColor: sl.color, shadowColor: sl.color,
              transform: [{ rotate: `${angle}rad` }, { translateX: dist / 2 }]
            }]} />
          );
        })}

        {/* PARTÍCULAS DE EXPLOSÃO */}
        {gs.particles.map((p, i) => (
          <View key={i} style={{ position: 'absolute', width: 4, height: 4, backgroundColor: p.color, left: p.x, top: p.y }} />
        ))}

        {/* NAVE DO JOGADOR (Triângulo Neon Ciano construído em CSS) */}
        <View style={[styles.playerShape, { left: gs.player.x - 20, top: gs.player.y - 20 }]} />
        {/* Propulsor da nave */}
        <View style={[styles.propulsor, { left: gs.player.x - 6, top: gs.player.y + 18, opacity: Math.random() > 0.5 ? 1 : 0.4 }]} />

        {/* ANALÓGICO VIRTUAL (JOYSTICK) */}
        <View style={styles.joystickBase}>
          <Animated.View {...panResponder.panHandlers} style={[styles.joystickKnob, { transform: [{ translateX: joyAnim.x }, { translateY: joyAnim.y }] }]} />
        </View>

      </View>

      {/* PAINEL INFERIOR (TECLADO MATEMÁTICO) */}
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
  
  // Menu
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015' },
  tituloMenu: { fontSize: 55, fontWeight: '900', color: '#00FFFF', textShadowColor: '#00FFFF', textShadowRadius: 20, fontStyle: 'italic' },
  subTituloMenu: { fontSize: 35, fontWeight: '900', color: '#FFF', letterSpacing: 8 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 16, lineHeight: 24, fontWeight: 'bold' },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 12, marginTop: 50, shadowColor: '#FF00FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 10 },
  btnIniciarTxt: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  textoScore: { color: '#00FFFF', fontSize: 30, fontWeight: 'bold', marginTop: 20 },
  textoFase: { color: '#9D97B5', fontSize: 18, marginTop: 10 },

  // HUD
  hud: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0A0025', borderBottomWidth: 2, borderBottomColor: '#00FFFF', zIndex: 10 },
  hudScore: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  hpBarContainer: { width: '100%', height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 5 },
  hudFase: { color: '#FF00FF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },

  // Game Area & Geometria
  gameArea: { height: GAME_AREA_HEIGHT, width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#050015' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.1, backgroundImage: 'linear-gradient(#00FFFF 1px, transparent 1px), linear-gradient(90deg, #00FFFF 1px, transparent 1px)', backgroundSize: '40px 40px' }, // Efeito Grid Retrô (funciona bem na web/emuladores)
  
  // Desenho da Nave (Triângulo CSS)
  playerShape: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 20, borderRightWidth: 20, borderBottomWidth: 40, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#00FFFF', shadowColor: '#00FFFF', shadowRadius: 10, shadowOpacity: 1 },
  propulsor: { position: 'absolute', width: 12, height: 15, backgroundColor: '#FF8C00', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  
  // Desenho Inimigo (Diamante Vermelho)
  enemyShape: { position: 'absolute', width: 30, height: 30, backgroundColor: '#FF0055', transform: [{ rotate: '45deg' }], shadowColor: '#FF0055', shadowRadius: 8, shadowOpacity: 1 },
  
  // Power-Ups
  powerupBox: { position: 'absolute', width: 70, height: 50, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowRadius: 10, shadowOpacity: 1 },
  powerupTitle: { fontSize: 8, fontWeight: '900', position: 'absolute', top: -10, backgroundColor: '#050015', paddingHorizontal: 4 },
  powerupMath: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  powerupDots: { flexDirection: 'row', gap: 4, position: 'absolute', bottom: -8 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, backgroundColor: '#050015' },

  // Tiros
  laserNormal: { position: 'absolute', backgroundColor: '#00FFFF', borderRadius: 5, shadowColor: '#00FFFF', shadowRadius: 5, shadowOpacity: 1 },
  laserEspecial: { position: 'absolute', height: 6, borderRadius: 3, shadowRadius: 10, shadowOpacity: 1, zIndex: 5 },

  // Joystick
  joystickBase: { position: 'absolute', bottom: 20, left: 20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0, 255, 255, 0.1)', borderWidth: 2, borderColor: 'rgba(0, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  joystickKnob: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 255, 255, 0.8)', shadowColor: '#00FFFF', shadowRadius: 10, shadowOpacity: 1 },

  // Painel Inferior
  painelInferior: { flex: 1, backgroundColor: '#0A0025', borderTopWidth: 2, borderTopColor: '#FF00FF', padding: 15, alignItems: 'center', justifyContent: 'flex-start' },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#050015', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#00FFFF', marginBottom: 12 },
  visorTexto: { color: '#00FFFF', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 8 },
  tecladoRow: { flexDirection: 'row', gap: 8, height: 50 },
  teclaRetro: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: 'rgba(255, 68, 68, 0.15)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(255, 0, 255, 0.15)', borderColor: '#FF00FF' },
});
