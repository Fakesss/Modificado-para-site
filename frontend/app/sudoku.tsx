import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Dimensions, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../src/services/api';
import { SudokuSessaoAPI } from '../src/types';

// ──────────────── Types & Constants ────────────────

type Difficulty = 'muito_facil' | 'facil' | 'medio' | 'dificil' | 'expert';
type Phase = 'loading' | 'select' | 'resume' | 'playing' | 'won' | 'lost';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  muito_facil: 'Muito Fácil',
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
  expert: 'Expert',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  muito_facil: '#32CD32',
  facil: '#4169E1',
  medio: '#FFD700',
  dificil: '#FF8C00',
  expert: '#FF4444',
};

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  muito_facil: '51 números dados — para começar',
  facil: '43 números dados — bem acessível',
  medio: '33 números dados — desafiador',
  dificil: '27 números dados — para experientes',
  expert: '19 números dados — somente os melhores',
};

const CELLS_TO_REMOVE: Record<Difficulty, number> = {
  muito_facil: 30,
  facil: 38,
  medio: 48,
  dificil: 54,
  expert: 62,
};

const DIFFICULTIES: Difficulty[] = ['muito_facil', 'facil', 'medio', 'dificil', 'expert'];

const { width: SW } = Dimensions.get('window');
const GRID_PAD = 16;
const CELL_SIZE = Math.floor((Math.min(SW, 420) - GRID_PAD) / 9);

// ──────────────── Sudoku Generator ────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(board: number[], row: number, col: number, n: number): boolean {
  for (let c = 0; c < 9; c++) if (board[row * 9 + c] === n) return false;
  for (let r = 0; r < 9; r++) if (board[r * 9 + col] === n) return false;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (board[r * 9 + c] === n) return false;
  return true;
}

function solveBoard(board: number[]): boolean {
  const idx = board.indexOf(0);
  if (idx === -1) return true;
  const row = Math.floor(idx / 9), col = idx % 9;
  for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(board, row, col, n)) {
      board[idx] = n;
      if (solveBoard(board)) return true;
      board[idx] = 0;
    }
  }
  return false;
}

function generatePuzzle(difficulty: Difficulty): { puzzle: number[]; solution: number[] } {
  const solution = new Array(81).fill(0);
  solveBoard(solution);
  const puzzle = [...solution];
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < CELLS_TO_REMOVE[difficulty]; i++) puzzle[positions[i]] = 0;
  return { puzzle, solution };
}

// ──────────────── Helpers ────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clearPencilFor(pm: number[][], cellIdx: number, num: number): number[][] {
  const row = Math.floor(cellIdx / 9), col = cellIdx % 9;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  const affected = new Set<number>();
  for (let i = 0; i < 9; i++) { affected.add(row * 9 + i); affected.add(i * 9 + col); }
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) affected.add(r * 9 + c);
  return pm.map((m, i) => affected.has(i) ? m.filter(n => n !== num) : m);
}

const emptyPencil = () => Array.from({ length: 81 }, (): number[] => []);

// ──────────────── Component ────────────────

export default function SudokuScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [savedData, setSavedData] = useState<SudokuSessaoAPI | null>(null);

  // core game state
  const [given, setGiven] = useState<number[]>(new Array(81).fill(0));
  const [solution, setSolution] = useState<number[]>(new Array(81).fill(0));
  const [userBoard, setUserBoard] = useState<number[]>(new Array(81).fill(0));
  const [pencilMarks, setPencilMarks] = useState<number[][]>(emptyPencil);
  const [hintedCells, setHintedCells] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [lives, setLives] = useState(3);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [pencilMode, setPencilMode] = useState(false);

  // refs so callbacks always see latest values
  const elapsedRef = useRef(0);
  const stateRef = useRef({ given, solution, userBoard, pencilMarks, hintedCells, lives, hintsLeft, difficulty, phase });
  elapsedRef.current = elapsed;
  stateRef.current = { given, solution, userBoard, pencilMarks, hintedCells, lives, hintsLeft, difficulty, phase };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load saved session ──
  useEffect(() => {
    api.getSudokuSessao().then((data: SudokuSessaoAPI | null) => {
      if (data && !data.completed && !data.lost && data.puzzle?.length === 81) {
        setSavedData(data);
        setPhase('resume');
      } else {
        setPhase('select');
      }
    });
  }, []);

  // ── timer ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── auto-save every 30s ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => doSave(), 30000);
    return () => clearInterval(id);
  }, [phase]);

  // ── save on app background ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s !== 'active') doSave(); });
    return () => sub.remove();
  }, []);

  const doSave = () => {
    const s = stateRef.current;
    if (!s.given.some(v => v > 0)) return;
    api.saveSudokuSessao({
      puzzle: s.given, solution: s.solution, userBoard: s.userBoard,
      pencilMarks: s.pencilMarks, hintedCells: Array.from(s.hintedCells),
      lives: s.lives, hintsLeft: s.hintsLeft, difficulty: s.difficulty,
      elapsedSeconds: elapsedRef.current,
      completed: s.phase === 'won', lost: s.phase === 'lost',
    });
  };

  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 800);
  };

  // ── start new game ──
  const startGame = (diff: Difficulty) => {
    const { puzzle, solution: sol } = generatePuzzle(diff);
    setGiven(puzzle);
    setSolution(sol);
    setUserBoard(new Array(81).fill(0));
    setPencilMarks(emptyPencil());
    setHintedCells(new Set());
    setSelected(null);
    setLives(3);
    setHintsLeft(3);
    setElapsed(0);
    setPencilMode(false);
    setDifficulty(diff);
    setPhase('playing');
  };

  // ── resume saved game ──
  const resumeGame = () => {
    if (!savedData) return;
    const d = savedData;
    setGiven(d.puzzle);
    setSolution(d.solution);
    setUserBoard(d.userBoard);
    setPencilMarks(d.pencilMarks?.length === 81 ? d.pencilMarks : emptyPencil());
    setHintedCells(new Set(d.hintedCells || []));
    setSelected(null);
    setLives(d.lives);
    setHintsLeft(d.hintsLeft);
    setElapsed(d.elapsedSeconds || 0);
    setPencilMode(false);
    setDifficulty((d.difficulty as Difficulty) || 'medio');
    setPhase('playing');
  };

  // ── computed highlights ──
  const getGroupCells = (idx: number): Set<number> => {
    const row = Math.floor(idx / 9), col = idx % 9;
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    const s = new Set<number>();
    for (let i = 0; i < 9; i++) { s.add(row * 9 + i); s.add(i * 9 + col); }
    for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) s.add(r * 9 + c);
    return s;
  };

  const selectedValue = selected !== null ? (given[selected] || userBoard[selected]) : 0;
  const groupCells = selected !== null ? getGroupCells(selected) : new Set<number>();

  const isWrong = (idx: number) =>
    !given[idx] && !hintedCells.has(idx) && userBoard[idx] > 0 && userBoard[idx] !== solution[idx];

  const countPlaced = (num: number) => {
    let n = 0;
    for (let i = 0; i < 81; i++)
      if (given[i] === num || (userBoard[i] === num && solution[i] === num)) n++;
    return n;
  };

  // ── win check ──
  const checkWin = (board: number[], hinted: Set<number>, lv: number, hl: number, diff: Difficulty) => {
    if (lv <= 0) return;
    for (let i = 0; i < 81; i++) {
      if (given[i] > 0 || hinted.has(i)) continue;
      if (board[i] !== solution[i]) return;
    }
    setPhase('won');
    api.concluirSudoku({ difficulty: diff, elapsedSeconds: elapsedRef.current, hintsUsed: 3 - hl });
  };

  // ── handlers ──
  const handleCell = (idx: number) => setSelected(p => p === idx ? null : idx);

  const handleNumber = (num: number) => {
    if (selected === null) return;
    const idx = selected;
    if (given[idx] > 0 || hintedCells.has(idx)) return;

    if (pencilMode) {
      const npm = pencilMarks.map((m, i) =>
        i === idx ? (m.includes(num) ? m.filter(n => n !== num) : [...m, num]) : m
      );
      setPencilMarks(npm);
      scheduleSave();
      return;
    }

    // erase if same
    if (userBoard[idx] === num) {
      const nb = [...userBoard]; nb[idx] = 0;
      setUserBoard(nb);
      scheduleSave();
      return;
    }

    const nb = [...userBoard]; nb[idx] = num;
    let npm = pencilMarks.map((m, i) => i === idx ? [] : m);

    if (num !== solution[idx]) {
      const newLives = lives - 1;
      setUserBoard(nb);
      setPencilMarks(npm);
      setLives(newLives);
      if (newLives <= 0) {
        setPhase('lost');
        api.saveSudokuSessao({ puzzle: given, solution, userBoard: nb, pencilMarks: npm, hintedCells: Array.from(hintedCells), lives: 0, hintsLeft, difficulty, elapsedSeconds: elapsedRef.current, completed: false, lost: true });
      } else {
        scheduleSave();
      }
    } else {
      npm = clearPencilFor(npm, idx, num);
      setUserBoard(nb);
      setPencilMarks(npm);
      scheduleSave();
      checkWin(nb, hintedCells, lives, hintsLeft, difficulty);
    }
  };

  const handleErase = () => {
    if (selected === null) return;
    const idx = selected;
    if (given[idx] > 0 || hintedCells.has(idx)) return;
    const nb = [...userBoard]; nb[idx] = 0;
    const npm = pencilMarks.map((m, i) => i === idx ? [] : m);
    setUserBoard(nb);
    setPencilMarks(npm);
    scheduleSave();
  };

  const handleHint = () => {
    if (hintsLeft <= 0 || selected === null) return;
    const idx = selected;
    if (given[idx] > 0 || hintedCells.has(idx)) return;
    if (userBoard[idx] === solution[idx] && userBoard[idx] > 0) return;
    const val = solution[idx];
    const nb = [...userBoard]; nb[idx] = val;
    let npm = pencilMarks.map((m, i) => i === idx ? [] : m);
    npm = clearPencilFor(npm, idx, val);
    const nh = new Set(hintedCells); nh.add(idx);
    const hl = hintsLeft - 1;
    setUserBoard(nb);
    setPencilMarks(npm);
    setHintedCells(nh);
    setHintsLeft(hl);
    api.saveSudokuSessao({ puzzle: given, solution, userBoard: nb, pencilMarks: npm, hintedCells: Array.from(nh), lives, hintsLeft: hl, difficulty, elapsedSeconds: elapsedRef.current, completed: false, lost: false });
    checkWin(nb, nh, lives, hl, difficulty);
  };

  const handleRestart = () => {
    api.deleteSudokuSessao();
    setPhase('select');
  };

  // ── cell renderer ──
  const renderPencil = (idx: number) => {
    const marks = new Set(pencilMarks[idx] || []);
    return (
      <View style={styles.pencilGrid}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <View key={n} style={styles.pencilCell}>
            {marks.has(n) && <Text style={styles.pencilNum}>{n}</Text>}
          </View>
        ))}
      </View>
    );
  };

  const renderCell = (idx: number) => {
    const row = Math.floor(idx / 9), col = idx % 9;
    const gv = given[idx], uv = userBoard[idx];
    const display = gv || uv;
    const isSelected = selected === idx;
    const inGroup = groupCells.has(idx) && !isSelected;
    const isSame = selectedValue > 0 && display === selectedValue && !isSelected;
    const wrong = isWrong(idx);
    const hinted = hintedCells.has(idx);
    const hasPencil = !gv && !uv && (pencilMarks[idx]?.length > 0);

    const bg = isSelected ? '#1a2255'
      : isSame ? '#1c2248'
      : inGroup ? '#131520'
      : '#0e0e18';

    const textColor = wrong ? '#FF5555'
      : hinted ? '#5599FF'
      : gv ? '#c0c0d0'
      : '#fff';

    const bR = col < 8 ? ((col === 2 || col === 5) ? 2 : 0.5) : 0;
    const bB = row < 8 ? ((row === 2 || row === 5) ? 2 : 0.5) : 0;
    const bRc = (col === 2 || col === 5) ? '#595969' : '#1e1e2e';
    const bBc = (row === 2 || row === 5) ? '#595969' : '#1e1e2e';

    return (
      <TouchableOpacity
        key={idx}
        onPress={() => handleCell(idx)}
        activeOpacity={0.7}
        style={[styles.cell, {
          width: CELL_SIZE, height: CELL_SIZE, backgroundColor: bg,
          borderRightWidth: bR, borderBottomWidth: bB, borderRightColor: bRc, borderBottomColor: bBc,
        }]}
      >
        {display > 0 ? (
          <Text style={[styles.cellNum, { color: textColor }, !gv && !hinted && styles.cellNumUser]}>
            {display}
          </Text>
        ) : hasPencil ? renderPencil(idx) : null}
        {isSelected && <View style={styles.selectedBorder} />}
        {isSame && display > 0 && <View style={styles.sameValueDot} />}
      </TouchableOpacity>
    );
  };

  // ──────────────── PHASE: LOADING ────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // ──────────────── PHASE: SELECT DIFFICULTY ────────────────
  if (phase === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sudoku</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
          <Ionicons name="grid" size={64} color="#FFD700" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.selectTitle}>Escolha a Dificuldade</Text>
          <Text style={styles.selectSub}>Preencha o tabuleiro 9×9 sem repetir números em cada linha, coluna ou quadrado</Text>
          {DIFFICULTIES.map(d => (
            <TouchableOpacity key={d} style={[styles.diffBtn, { borderColor: DIFFICULTY_COLORS[d] + '66' }]} onPress={() => startGame(d)}>
              <View style={[styles.diffDot, { backgroundColor: DIFFICULTY_COLORS[d] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.diffName}>{DIFFICULTY_LABELS[d]}</Text>
                <Text style={styles.diffDesc}>{DIFFICULTY_DESC[d]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={DIFFICULTY_COLORS[d]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ──────────────── PHASE: RESUME ────────────────
  if (phase === 'resume' && savedData) {
    const diff = (savedData.difficulty as Difficulty) || 'medio';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sudoku</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.resumeWrap}>
          <View style={styles.resumeCard}>
            <Ionicons name="time" size={48} color="#FFD700" />
            <Text style={styles.resumeTitle}>Partida salva</Text>
            <View style={[styles.resumeDiffBadge, { backgroundColor: DIFFICULTY_COLORS[diff] + '22', borderColor: DIFFICULTY_COLORS[diff] + '88' }]}>
              <Text style={[styles.resumeDiffText, { color: DIFFICULTY_COLORS[diff] }]}>{DIFFICULTY_LABELS[diff]}</Text>
            </View>
            <Text style={styles.resumeTime}>{formatTime(savedData.elapsedSeconds)} jogados</Text>
            <View style={styles.resumeLivesRow}>
              {[0,1,2].map(i => (
                <Ionicons key={i} name={i < savedData.lives ? 'heart' : 'heart-outline'} size={20} color={i < savedData.lives ? '#FF4444' : '#444'} />
              ))}
            </View>
            <TouchableOpacity style={styles.resumeBtn} onPress={resumeGame}>
              <Ionicons name="play" size={18} color="#000" />
              <Text style={styles.resumeBtnText}>Continuar partida</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeNewBtn} onPress={() => { api.deleteSudokuSessao(); setPhase('select'); }}>
              <Text style={styles.resumeNewText}>Nova partida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ──────────────── PHASE: PLAYING / WON / LOST ────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleRestart} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Sudoku</Text>
          <View style={[styles.diffPill, { backgroundColor: DIFFICULTY_COLORS[difficulty] + '22' }]}>
            <Text style={[styles.diffPillText, { color: DIFFICULTY_COLORS[difficulty] }]}>{DIFFICULTY_LABELS[difficulty]}</Text>
          </View>
        </View>
        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      </View>

      {/* Lives & Hints */}
      <View style={styles.statusBar}>
        <View style={styles.livesRow}>
          {[0,1,2].map(i => (
            <Ionicons key={i} name={i < lives ? 'heart' : 'heart-outline'} size={22} color={i < lives ? '#FF4444' : '#333'} />
          ))}
          <Text style={styles.statusLabel}>Vidas</Text>
        </View>
        <View style={styles.hintsRow}>
          {[0,1,2].map(i => (
            <Ionicons key={i} name={i < hintsLeft ? 'bulb' : 'bulb-outline'} size={20} color={i < hintsLeft ? '#FFD700' : '#333'} />
          ))}
          <Text style={styles.statusLabel}>Dicas</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridWrapper}>
        <View style={styles.gridOuter}>
          <View style={[styles.grid, { width: CELL_SIZE * 9, height: CELL_SIZE * 9 }]}>
            {Array.from({ length: 81 }, (_, i) => renderCell(i))}
          </View>
        </View>
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, pencilMode && styles.actionBtnOn]}
          onPress={() => setPencilMode(m => !m)}
        >
          <Ionicons name="pencil" size={21} color={pencilMode ? '#FFD700' : '#888'} />
          <Text style={[styles.actionLabel, pencilMode && { color: '#FFD700' }]}>Lápis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleErase}>
          <Ionicons name="backspace-outline" size={21} color="#888" />
          <Text style={styles.actionLabel}>Apagar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, (hintsLeft === 0 || selected === null) && styles.actionBtnOff]}
          onPress={handleHint}
          disabled={hintsLeft === 0 || selected === null}
        >
          <Ionicons name="bulb-outline" size={21} color={hintsLeft > 0 && selected !== null ? '#FFD700' : '#444'} />
          <Text style={[styles.actionLabel, (hintsLeft === 0 || selected === null) && { color: '#444' }]}>
            Dica ({hintsLeft})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRestart}>
          <Ionicons name="refresh" size={21} color="#888" />
          <Text style={styles.actionLabel}>Reiniciar</Text>
        </TouchableOpacity>
      </View>

      {/* Number pad */}
      <View style={styles.numpad}>
        {[1,2,3,4,5,6,7,8,9].map(num => {
          const placed = countPlaced(num);
          const remaining = Math.max(0, 9 - placed);
          const done = remaining === 0;
          const active = selectedValue === num;
          return (
            <TouchableOpacity
              key={num}
              onPress={() => handleNumber(num)}
              disabled={done}
              style={[
                styles.numBtn,
                done && styles.numBtnDone,
                active && styles.numBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.numText, done && styles.numTextDone, active && styles.numTextActive]}>
                {num}
              </Text>
              {!done && (
                <Text style={[styles.numCount, active && { color: '#FFD700' }]}>{remaining}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Won Modal ── */}
      <Modal visible={phase === 'won'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trophy" size={48} color="#FFD700" />
            </View>
            <Text style={styles.modalBigTitle}>Parabéns!</Text>
            <Text style={styles.modalSub}>Você completou o Sudoku!</Text>
            <View style={[styles.diffPill, { backgroundColor: DIFFICULTY_COLORS[difficulty] + '25', marginBottom: 20 }]}>
              <Text style={[styles.diffPillText, { color: DIFFICULTY_COLORS[difficulty] }]}>{DIFFICULTY_LABELS[difficulty]}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color="#FFD700" />
                <Text style={styles.statVal}>{formatTime(elapsed)}</Text>
                <Text style={styles.statKey}>Tempo</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={20} color="#FF4444" />
                <Text style={styles.statVal}>{lives}/3</Text>
                <Text style={styles.statKey}>Vidas</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="bulb" size={20} color="#FFD700" />
                <Text style={styles.statVal}>{3 - hintsLeft}</Text>
                <Text style={styles.statKey}>Dicas</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => { api.deleteSudokuSessao(); setPhase('select'); }}>
              <Text style={styles.modalPrimaryText}>Nova Partida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Lost Modal ── */}
      <Modal visible={phase === 'lost'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#FF444420' }]}>
              <Ionicons name="close-circle" size={48} color="#FF4444" />
            </View>
            <Text style={[styles.modalBigTitle, { color: '#FF5555' }]}>Fim de jogo!</Text>
            <Text style={styles.modalSub}>Você usou todas as suas {'\n'}3 vidas.</Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => startGame(difficulty)}>
              <Text style={styles.modalPrimaryText}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => { api.deleteSudokuSessao(); setPhase('select'); }}>
              <Text style={styles.modalSecondaryText}>Escolher dificuldade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ──────────────── Styles ────────────────

const NW = Math.floor((SW - 16) / 9);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a28',
  },
  backBtn: { padding: 4, width: 40 },
  headerMid: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  timerText: { color: '#FFD700', fontSize: 17, fontWeight: 'bold', width: 60, textAlign: 'right', fontVariant: ['tabular-nums'] },

  diffPill: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  diffPillText: { fontSize: 11, fontWeight: '700' },

  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: '#0e0e1a', borderBottomWidth: 1, borderBottomColor: '#1a1a28',
  },
  livesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusLabel: { color: '#555', fontSize: 11, marginLeft: 8 },

  gridWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridOuter: { borderWidth: 2.5, borderColor: '#595969', borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },

  cell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellNum: { fontSize: CELL_SIZE * 0.46, fontWeight: 'bold', color: '#fff' },
  cellNumUser: { fontWeight: '800' },
  selectedBorder: { position: 'absolute', inset: 0, borderWidth: 2.5, borderColor: '#4466DD', borderRadius: 1 },
  sameValueDot: { position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#4466DD66' },

  pencilGrid: { width: '100%', height: '100%', padding: 1, flexDirection: 'row', flexWrap: 'wrap' },
  pencilCell: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  pencilNum: { color: '#6688EE', fontSize: CELL_SIZE * 0.2, fontWeight: '700' },

  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#0e0e1a', borderTopWidth: 1, borderTopColor: '#1a1a28',
  },
  actionBtn: { alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  actionBtnOn: { backgroundColor: '#1a1a30' },
  actionBtnOff: { opacity: 0.35 },
  actionLabel: { color: '#777', fontSize: 11, fontWeight: '500' },

  numpad: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: '#0a0a12',
  },
  numBtn: {
    width: NW, height: NW + 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16162a', borderRadius: 10,
  },
  numBtnDone: { backgroundColor: '#0f0f18', opacity: 0.35 },
  numBtnActive: { backgroundColor: '#1a1a40', borderWidth: 1.5, borderColor: '#4466DD' },
  numText: { color: '#fff', fontSize: NW * 0.55, fontWeight: 'bold', lineHeight: NW * 0.65 },
  numTextDone: { color: '#444' },
  numTextActive: { color: '#8899FF' },
  numCount: { color: '#555', fontSize: 9, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#14142a',
    borderRadius: 22, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a44',
  },
  modalIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFD70018', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalBigTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { color: '#777', fontSize: 15, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 28, marginBottom: 28 },
  statItem: { alignItems: 'center', gap: 4 },
  statVal: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  statKey: { color: '#666', fontSize: 11 },
  modalPrimaryBtn: {
    backgroundColor: '#FFD700', borderRadius: 14,
    paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  modalPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalSecondaryBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  modalSecondaryText: { color: '#666', fontSize: 14 },

  // Select difficulty
  selectContent: { padding: 24, paddingTop: 8 },
  selectTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  selectSub: { color: '#555', fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  diffBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#14142a', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5,
  },
  diffDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  diffName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  diffDesc: { color: '#555', fontSize: 12 },

  // Resume
  resumeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resumeCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#14142a',
    borderRadius: 22, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a44',
  },
  resumeTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 14, marginBottom: 14 },
  resumeDiffBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 14 },
  resumeDiffText: { fontWeight: '700', fontSize: 14 },
  resumeTime: { color: '#888', fontSize: 16, marginBottom: 10 },
  resumeLivesRow: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  resumeBtn: {
    flexDirection: 'row', backgroundColor: '#FFD700', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', gap: 8, width: '100%',
    justifyContent: 'center', marginBottom: 10,
  },
  resumeBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  resumeNewBtn: { paddingVertical: 12 },
  resumeNewText: { color: '#666', fontSize: 14 },
});
