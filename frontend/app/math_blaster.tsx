import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.65; // Altura fixa e protegida para evitar bugs do teclado
const CARD_WIDTH = 90;
const DROP_LIMIT = GAME_AREA_HEIGHT - 60; // Limite onde a nave do jogador fica

// URLs de Imagens (Sprites do Jogo)
const SPRITE_PLAYER = 'https://cdn-icons-png.flaticon.com/512/3204/3204121.png';
const SPRITE_METEOR = 'https://cdn-icons-png.flaticon.com/512/4397/4397355.png';
const SPRITE_UFO = 'https://cdn-icons-png.flaticon.com/512/3204/3204090.png';

// --- COMPONENTE: TECLADO RETRÔ ---
const BotaoRetro = ({ valor, onPressWeb }: { valor: string, onPressWeb: (v: string) => void }) => {
  const anim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(anim, { toValue: 0.85, useNativeDriver: true }).start();
  const handlePressOut = () => { Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start(); onPressWeb(valor); };

  const isEspecial = valor === 'apagar' || valor === 'enviar';
  
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: anim }] }}>
      <TouchableOpacity 
        activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}
        style={[styles.teclaRetro, valor === 'apagar' && styles.teclaApagar, valor === 'enviar' && styles.teclaEnviar]}
      >
        {valor === 'apagar' ? <Ionicons name="backspace" size={26} color="#FFF" /> : 
         valor === 'enviar' ? <Ionicons name="rocket" size={26} color="#FFF" /> : 
         <Text style={styles.teclaRetroText}>{valor}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- COMPONENTE: FUNDO ESTRELADO ANIMADO ---
const Starfield = ({ velocidadeMult }: { velocidadeMult: number }) => {
  const estrelas = useRef(Array.from({ length: 40 }).map(() => ({
    x: Math.random() * width,
    y: new Animated.Value(Math.random() * GAME_AREA_HEIGHT),
    size: Math.random() * 3 + 1,
    speed: (Math.random() * 2000 + 3000)
  }))).current;

  useEffect(() => {
    estrelas.forEach(estrela => {
      const animar = () => {
        estrela.y.setValue(-10);
        Animated.timing(estrela.y, {
          toValue: GAME_AREA_HEIGHT + 10,
          duration: estrela.speed / velocidadeMult,
          easing: Easing.linear,
          useNativeDriver: true
        }).start(({ finished }) => { if (finished) animar(); });
      };
      animar();
    });
  }, [velocidadeMult]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {estrelas.map((e, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: e.size, height: e.size, backgroundColor: e.size > 2 ? '#00FFFF' : '#FFF',
          borderRadius: e.size, left: e.x, transform: [{ translateY: e.y }], opacity: e.size > 2 ? 0.8 : 0.4,
          shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: e.size * 2
        }} />
      ))}
    </View>
  );
};

export default function MathBlaster() {
  const router = useRouter();
  const [jogoAtivo, setJogoAtivo] = useState(false);
  const [vidas, setVidas] = useState(5);
  const [pontos, setPontos] = useState(0);
  const [fase, setFase] = useState(1);
  const [resposta, setResposta] = useState('');
  const [inimigos, setInimigos] = useState<any[]>([]);
  const [tiros, setTiros] = useState<any[]>([]);
  const [explosoes, setExplosoes] = useState<any[]>([]);
  const [alertaFase, setAlertaFase] = useState(false);

  const operacoesRef = useRef<any[]>([]);
  const pontosRef = useRef(0);
  const faseRef = useRef(1);
  const loopRef = useRef<any>(null);

  // Áudio Base
  const somTiro = useRef<Audio.Sound | null>(null);
  const somExplosao = useRef<Audio.Sound | null>(null);
  const somDano = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    async function carregarSons() {
      try {
        const t = await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/laser.mp3' });
        const e = await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/explosion.mp3' });
        const d = await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Gtajisan/bongoboltu_2.0/main/miss.mp3' });
        somTiro.current = t.sound; somExplosao.current = e.sound; somDano.current = d.sound;
      } catch (err) {}
    }
    carregarSons();
    return () => {
      somTiro.current?.unloadAsync(); somExplosao.current?.unloadAsync(); somDano.current?.unloadAsync();
      if(loopRef.current) clearTimeout(loopRef.current);
    };
  }, []);

  const tocar = async (som: Audio.Sound | null) => { try { if (som) { await som.setVolumeAsync(0.3); await som.replayAsync(); } } catch(e){} };

  useEffect(() => { operacoesRef.current = inimigos; pontosRef.current = pontos; faseRef.current = fase; }, [inimigos, pontos, fase]);

  // CONTROLE DE NÍVEIS (FASES)
  useEffect(() => {
    if (pontos > 0 && pontos % 100 === 0) {
      const novaFase = (pontos / 100) + 1;
      if (novaFase > faseRef.current) {
        setFase(novaFase); faseRef.current = novaFase;
        setAlertaFase(true);
        setTimeout(() => setAlertaFase(false), 2500);
      }
    }
  }, [pontos]);

  const iniciarJogo = () => {
    setVidas(5); setPontos(0); setFase(1); setResposta('');
    setInimigos([]); setTiros([]); setExplosoes([]);
    pontosRef.current = 0; faseRef.current = 1;
    setJogoAtivo(true);
    iniciarInvasao();
  };

  const iniciarInvasao = () => {
    if (loopRef.current) clearTimeout(loopRef.current);
    const rodar = () => {
      if (!jogoAtivo) return;
      if (operacoesRef.current.length < 3 + Math.floor(faseRef.current / 2)) {
        spawnarInimigo();
      }
      loopRef.current = setTimeout(rodar, Math.max(1000, 3000 - (faseRef.current * 300)));
    };
    rodar();
  };

  const gerarEquacao = () => {
    const r = (m: number) => Math.floor(Math.random() * m);
    let n1, n2, res, txt;
    const f = faseRef.current;
    
    // Matemática escala com a Fase
    if (f === 1) { n1 = r(10)+1; n2 = r(10)+1; res = n1+n2; txt = `${n1} + ${n2}`; }
    else if (f === 2) { n1 = r(20)+5; n2 = r(n1)+1; res = n1-n2; txt = `${n1} - ${n2}`; }
    else if (f === 3) { n1 = r(8)+2; n2 = r(8)+2; res = n1*n2; txt = `${n1} × ${n2}`; }
    else { n2 = r(8)+2; res = r(10)+2; n1 = n2*res; txt = `${n1} ÷ ${n2}`; }
    return { txt, res };
  };

  const perderVida = (id: string) => {
    tocar(somDano.current);
    setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; });
    setInimigos(prev => prev.filter(i => i.id !== id));
  };

  const spawnarInimigo = () => {
    const f = faseRef.current;
    const pistas = 3; const laneWidth = width / pistas;
    const lane = Math.floor(Math.random() * pistas);
    const posX = (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2);
    
    const id = Math.random().toString();
    const { txt, res } = gerarEquacao();
    const isUFO = f >= 3 && Math.random() > 0.5; // UFOs aparecem na fase 3+

    const yValue = new Animated.Value(-50);
    const speed = Math.max(3500, 8000 - (f * 800)); // Fica mais rápido a cada fase

    yValue.addListener(({ value }) => {
      if (value >= DROP_LIMIT) {
        const alvo = operacoesRef.current.find(o => o.id === id);
        if (alvo && !alvo.hit) { alvo.hit = true; alvo.y.stopAnimation(); perderVida(id); }
      }
    });

    const novoInimigo = { id, posX, y: yValue, texto: txt, resposta: res, isUFO, hit: false };
    setInimigos(prev => [...prev, novoInimigo]);

    Animated.timing(yValue, { toValue: GAME_AREA_HEIGHT + 100, duration: speed, easing: Easing.linear, useNativeDriver: true }).start();
  };

  const gameOver = () => {
    setJogoAtivo(false);
    if (loopRef.current) clearTimeout(loopRef.current);
  };

  const dispararLaser = (alvo: any) => {
    tocar(somTiro.current);
    const originX = width / 2;
    const originY = DROP_LIMIT;
    
    const bulletAnim = new Animated.Value(0);
    const idTiro = Math.random().toString();
    
    // Adiciona o tiro na tela
    setTiros(prev => [...prev, { id: idTiro, anim: bulletAnim, x: originX, y: originY, targetX: alvo.posX + CARD_WIDTH/2, targetY: (alvo.y as any)._value + 20 }]);

    // Anima o projétil do jogador até o alvo
    Animated.timing(bulletAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start(() => {
        // Quando o tiro chega, gera explosão
        setTiros(prev => prev.filter(t => t.id !== idTiro));
        tocar(somExplosao.current);
        gerarExplosao(alvo.posX, (alvo.y as any)._value);
        setPontos(p => p + 10);
        setInimigos(prev => prev.filter(i => i.id !== alvo.id));
    });
  };

  const gerarExplosao = (x: number, y: number) => {
    const id = Math.random().toString();
    const anim = new Animated.Value(0);
    setExplosoes(prev => [...prev, { id, x, y, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
      setExplosoes(prev => prev.filter(e => e.id !== id));
    });
  };

  const lidarComTeclado = (valor: string) => {
    if (!jogoAtivo) return;
    if (valor === 'apagar') setResposta(r => r.slice(0, -1));
    else if (valor === 'enviar') {
      const num = parseInt(resposta);
      const alvo = inimigos.find(i => i.resposta === num);
      if (alvo) {
        alvo.hit = true; alvo.y.stopAnimation(); dispararLaser(alvo);
      } else { tocar(somDano.current); setVidas(v => Math.max(0, v - 1)); if(vidas <= 1) gameOver(); }
      setResposta('');
    }
    else setResposta(r => r.length < 4 ? r + valor : r);
  };

  if (!jogoAtivo && pontos === 0 && vidas === 5) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={{ position: 'absolute', top: 20, left: 20 }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={30} color="#00FFFF" />
          </TouchableOpacity>
          <Ionicons name="planet" size={100} color="#FF00FF" style={{ marginBottom: 20 }} />
          <Text style={styles.tituloMenu}>MATH</Text>
          <Text style={styles.subTituloMenu}>BLASTER</Text>
          <Text style={styles.instrucoes}>Destrua os asteróides e naves inimigas digitando a resposta certa. Sobreviva e viaje pelas galáxias!</Text>
          <TouchableOpacity style={styles.btnIniciar} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>START MISSION</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!jogoAtivo && vidas <= 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <Text style={[styles.tituloMenu, { color: '#FF4444' }]}>GAME OVER</Text>
          <Text style={styles.textoScore}>Score Final: {pontos}</Text>
          <Text style={styles.textoFase}>Chegou na Fase {fase}</Text>
          <TouchableOpacity style={[styles.btnIniciar, { marginTop: 40 }]} onPress={iniciarJogo}>
            <Text style={styles.btnIniciarTxt}>TRY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#333', marginTop: 15 }]} onPress={() => router.back()}>
            <Text style={styles.btnIniciarTxt}>EXIT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* CABEÇALHO DO JOGO (HUD) */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudScore}>SCORE: {pontos}</Text>
          <View style={styles.hudVidas}>
            {Array.from({ length: vidas }).map((_, i) => <Ionicons key={i} name="heart" size={16} color="#FF00FF" />)}
          </View>
        </View>
        <Text style={styles.hudFase}>FASE {fase}</Text>
      </View>

      {/* ÁREA DO JOGO (Protegida) */}
      <View style={styles.gameArea}>
        <Starfield velocidadeMult={fase} />

        {/* ALERTA DE FASE */}
        {alertaFase && (
          <View style={styles.alertaContainer}>
            <Text style={styles.alertaTexto}>FASE {fase}</Text>
            <Text style={styles.alertaSubTexto}>INIMIGOS SE APROXIMANDO...</Text>
          </View>
        )}

        {/* INIMIGOS (Asteroides/UFOs) */}
        {inimigos.map(inimigo => (
          <Animated.View key={inimigo.id} style={[styles.inimigo, { left: inimigo.posX, transform: [{ translateY: inimigo.y }] }]}>
            <Image source={{ uri: inimigo.isUFO ? SPRITE_UFO : SPRITE_METEOR }} style={styles.spriteInimigo} />
            <View style={styles.caixaEquacao}>
              <Text style={styles.textoEquacao}>{inimigo.texto}</Text>
            </View>
          </Animated.View>
        ))}

        {/* TIROS (LASERS) */}
        {tiros.map(tiro => {
          const transX = tiro.anim.interpolate({ inputRange: [0, 1], outputRange: [0, tiro.targetX - tiro.x] });
          const transY = tiro.anim.interpolate({ inputRange: [0, 1], outputRange: [0, tiro.targetY - tiro.y] });
          return (
            <Animated.View key={tiro.id} style={[styles.laserBolt, { left: tiro.x - 4, top: tiro.y, transform: [{ translateX: transX }, { translateY: transY }] }]} />
          );
        })}

        {/* EXPLOSÕES */}
        {explosoes.map(exp => (
          <Animated.Image key={exp.id} source={{ uri: 'https://img.icons8.com/color/96/000000/explosion.png' }} 
            style={[styles.explosaoSprite, { 
              left: exp.x + 10, top: exp.y + 10, 
              transform: [{ scale: exp.anim.interpolate({ inputRange: [0,1], outputRange: [0.5, 2] }) }],
              opacity: exp.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] })
            }]} 
          />
        ))}

        {/* NAVE DO JOGADOR */}
        <View style={styles.playerContainer}>
          <Image source={{ uri: SPRITE_PLAYER }} style={styles.playerSprite} />
        </View>
      </View>

      {/* PAINEL INFERIOR (TECLADO E VISOR) */}
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
  // TEMA RETRÔ ESPACIAL
  container: { flex: 1, backgroundColor: '#05001A' }, // Roxo super escuro
  
  // Menu Incial
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05001A' },
  tituloMenu: { fontSize: 50, fontWeight: '900', color: '#00FFFF', textShadowColor: '#FF00FF', textShadowOffset: {width: 4, height: 4}, textShadowRadius: 0, fontStyle: 'italic' },
  subTituloMenu: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: 5 },
  instrucoes: { color: '#9D97B5', textAlign: 'center', marginHorizontal: 30, marginTop: 20, fontSize: 16, lineHeight: 24 },
  btnIniciar: { backgroundColor: '#FF00FF', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, marginTop: 50, borderWidth: 3, borderColor: '#00FFFF', shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 10 },
  btnIniciarTxt: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  textoScore: { color: '#00FFFF', fontSize: 30, fontWeight: 'bold', marginTop: 20 },
  textoFase: { color: '#9D97B5', fontSize: 18, marginTop: 10 },

  // HUD
  hud: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0A0033', borderBottomWidth: 2, borderBottomColor: '#FF00FF', zIndex: 10 },
  hudLeft: { gap: 5 },
  hudScore: { color: '#00FFFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  hudVidas: { flexDirection: 'row', gap: 5 },
  hudFase: { color: '#FF00FF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },

  // Game Area
  gameArea: { height: GAME_AREA_HEIGHT, width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#05001A' },
  
  // Alertas
  alertaContainer: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  alertaTexto: { color: '#FFF', fontSize: 48, fontWeight: '900', textShadowColor: '#FF00FF', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 10, letterSpacing: 5 },
  alertaSubTexto: { color: '#00FFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 5 },

  // Entidades
  inimigo: { position: 'absolute', width: CARD_WIDTH, alignItems: 'center', zIndex: 10 },
  spriteInimigo: { width: 60, height: 60, resizeMode: 'contain' },
  caixaEquacao: { backgroundColor: 'rgba(0, 255, 255, 0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: -10, borderWidth: 2, borderColor: '#FFF' },
  textoEquacao: { color: '#05001A', fontSize: 18, fontWeight: '900' },
  
  playerContainer: { position: 'absolute', bottom: 10, width: '100%', alignItems: 'center', zIndex: 20 },
  playerSprite: { width: 70, height: 70, resizeMode: 'contain' },
  
  laserBolt: { position: 'absolute', width: 8, height: 25, backgroundColor: '#00FFFF', borderRadius: 4, shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, zIndex: 5 },
  explosaoSprite: { position: 'absolute', width: 80, height: 80, resizeMode: 'contain', zIndex: 15 },

  // Painel Inferior (Teclado Neon)
  painelInferior: { flex: 1, backgroundColor: '#0A0033', borderTopWidth: 3, borderTopColor: '#00FFFF', padding: 15, alignItems: 'center', justifyContent: 'flex-start' },
  visorRadar: { width: '100%', maxWidth: 350, backgroundColor: '#000', paddingVertical: 15, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: '#FF00FF', marginBottom: 15, shadowColor: '#FF00FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 5 },
  visorTexto: { color: '#00FFFF', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  
  tecladoContainer: { width: '100%', maxWidth: 350, gap: 10 },
  tecladoRow: { flexDirection: 'row', gap: 10, height: 55 },
  teclaRetro: { flex: 1, backgroundColor: 'rgba(0, 255, 255, 0.1)', borderRadius: 12, borderWidth: 2, borderColor: '#00FFFF', justifyContent: 'center', alignItems: 'center' },
  teclaRetroText: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  teclaApagar: { backgroundColor: 'rgba(255, 68, 68, 0.2)', borderColor: '#FF4444' },
  teclaEnviar: { backgroundColor: 'rgba(255, 0, 255, 0.2)', borderColor: '#FF00FF' },
});
