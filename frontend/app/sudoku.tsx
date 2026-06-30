import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Dimensions, AppState, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../src/services/api';
import { SudokuSessaoAPI } from '../src/types';

// ──────────────── Types & Constants ────────────────

type Difficulty = 'muito_facil' | 'facil' | 'medio' | 'dificil' | 'expert';
type Phase = 'loading' | 'select' | 'resume' | 'playing' | 'won' | 'lost';

interface SudokuTheme {
  id: string; name: string; icon: string;
  accent: string; boxLine: string; cellLine: string;
  givenColor: string; userColor: string; pencilColor: string;
  bgCell: string; bgSelected: string; bgGroup: string; bgSame: string;
}

const THEMES: SudokuTheme[] = [
  { id: 'azul', name: 'Azul Clássico', icon: 'water-outline',
    accent: '#4a6ef5', boxLine: '#555580', cellLine: '#282848',
    givenColor: '#c8c8e0', userColor: '#ffffff', pencilColor: '#7799ff',
    bgCell: '#0c0c1a', bgSelected: '#1a2260', bgGroup: '#111126', bgSame: '#1c2255' },
  { id: 'ouro', name: 'Ouro', icon: 'star-outline',
    accent: '#FFD700', boxLine: '#7a6500', cellLine: '#2e2500',
    givenColor: '#ccaa22', userColor: '#FFD700', pencilColor: '#bbaa00',
    bgCell: '#0e0b00', bgSelected: '#2a1e00', bgGroup: '#1a1400', bgSame: '#221a00' },
  { id: 'verde', name: 'Esmeralda', icon: 'leaf-outline',
    accent: '#2ddd80', boxLine: '#1a6040', cellLine: '#0a2218',
    givenColor: '#77bb88', userColor: '#2ddd80', pencilColor: '#33aa66',
    bgCell: '#050f06', bgSelected: '#062814', bgGroup: '#071108', bgSame: '#082010' },
  { id: 'roxo', name: 'Roxo', icon: 'sparkles-outline',
    accent: '#bb77ff', boxLine: '#622e99', cellLine: '#1e0a35',
    givenColor: '#c090e8', userColor: '#cc88ff', pencilColor: '#9955cc',
    bgCell: '#090512', bgSelected: '#1c0a33', bgGroup: '#0f061a', bgSame: '#170a2c' },
  { id: 'coral', name: 'Coral', icon: 'flame-outline',
    accent: '#ff7055', boxLine: '#993322', cellLine: '#2a100a',
    givenColor: '#dd7766', userColor: '#ff7055', pencilColor: '#cc5544',
    bgCell: '#0e0805', bgSelected: '#2e1008', bgGroup: '#1c0c06', bgSame: '#251008' },
];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  muito_facil: 'Muito Fácil', facil: 'Fácil', medio: 'Médio',
  dificil: 'Difícil', expert: 'Expert',
};
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  muito_facil: '#32CD32', facil: '#4169E1', medio: '#FFD700',
  dificil: '#FF8C00', expert: '#FF4444',
};
const DIFFICULTY_DESC: Record<Difficulty, string> = {
  muito_facil: '51 números dados — ideal para aprender',
  facil: '43 números dados — bem acessível',
  medio: '33 números dados — desafiador',
  dificil: '27 números dados — para experientes',
  expert: '~20 números dados — solução única garantida',
};
const CELLS_TO_REMOVE: Record<Difficulty, number> = {
  muito_facil: 30, facil: 38, medio: 48, dificil: 54, expert: 62,
};
const DIFFICULTIES: Difficulty[] = ['muito_facil', 'facil', 'medio', 'dificil', 'expert'];

const { width: SW } = Dimensions.get('window');
const CELL_SIZE = Math.floor((Math.min(SW, 420) - 16) / 9);
const NW = Math.floor((SW - 16) / 9);

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

// Conta soluções — para se tiver >= maxCount (eficiente para verificar unicidade)
function countSolutions(board: number[], maxCount = 2): number {
  const idx = board.indexOf(0);
  if (idx === -1) return 1;
  let count = 0;
  const row = Math.floor(idx / 9), col = idx % 9;
  for (let n = 1; n <= 9 && count < maxCount; n++) {
    if (canPlace(board, row, col, n)) {
      board[idx] = n;
      count += countSolutions(board, maxCount - count);
      board[idx] = 0;
    }
  }
  return count;
}

// Gera puzzle com solução única garantida
function generatePuzzle(difficulty: Difficulty): { puzzle: number[]; solution: number[] } {
  const solution = new Array(81).fill(0);
  solveBoard(solution);
  const puzzle = [...solution];
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  const target = CELLS_TO_REMOVE[difficulty];
  let removed = 0;
  for (const pos of positions) {
    if (removed >= target) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    // Só remove se manter solução única
    if (countSolutions([...puzzle]) === 1) {
      removed++;
    } else {
      puzzle[pos] = backup;
    }
  }
  return { puzzle, solution };
}

// ──────────────── Helpers ────────────────

function formatTime(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
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
  const [generating, setGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [savedData, setSavedData] = useState<SudokuSessaoAPI | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [theme, setTheme] = useState<SudokuTheme>(THEMES[0]);

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

  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  // stateRef keeps latest snapshot for effects/keyboard handler registered with empty deps
  const stateRef = useRef({
    given, solution, userBoard, pencilMarks, hintedCells,
    lives, hintsLeft, difficulty, phase, pencilMode, selected, theme,
  });
  stateRef.current = {
    given, solution, userBoard, pencilMarks, hintedCells,
    lives, hintsLeft, difficulty, phase, pencilMode, selected, theme,
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load session + theme on mount ──
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('sudoku_sessao'),
      AsyncStorage.getItem('sudoku_tema'),
    ]).then(([rawSession, rawTheme]) => {
      if (rawTheme) {
        const found = THEMES.find(t => t.id === rawTheme);
        if (found) setTheme(found);
      }
      try {
        const data: SudokuSessaoAPI = rawSession ? JSON.parse(rawSession) : null;
        if (data && !data.completed && !data.lost && data.puzzle?.length === 81) {
          setSavedData(data);
          setPhase('resume');
          return;
        }
      } catch {}
      setPhase('select');
    });
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Auto-save every 30s ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => doSave(), 30_000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Save on app background ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s !== 'active') doSave(); });
    return () => sub.remove();
  }, []);

  // ── Keyboard navigation (web) ──
  // kbRef always holds the freshest handler via stateRef
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: any) => {
      const s = stateRef.current;
      if (s.phase !== 'playing') return;

      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setSelected(prev => {
          const cur = prev ?? 40;
          const row = Math.floor(cur / 9), col = cur % 9;
          if (e.key === 'ArrowUp')    return row > 0 ? (row - 1) * 9 + col : cur;
          if (e.key === 'ArrowDown')  return row < 8 ? (row + 1) * 9 + col : cur;
          if (e.key === 'ArrowLeft')  return col > 0 ? row * 9 + col - 1 : cur;
          if (e.key === 'ArrowRight') return col < 8 ? row * 9 + col + 1 : cur;
          return cur;
        });
        return;
      }

      if (e.key === 'p' || e.key === 'P') { setPencilMode(m => !m); return; }

      const sel = s.selected;
      if (sel === null) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.given[sel] > 0 || s.hintedCells.has(sel)) return;
        setUserBoard(b => { const nb = [...b]; nb[sel] = 0; return nb; });
        setPencilMarks(pm => pm.map((m, i) => i === sel ? [] : m));
        scheduleSave();
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key);
        if (s.given[sel] > 0 || s.hintedCells.has(sel)) return;

        if (s.pencilMode) {
          setPencilMarks(pm => pm.map((m, i) =>
            i === sel ? (m.includes(num) ? m.filter(n => n !== num) : [...m, num]) : m
          ));
          scheduleSave();
          return;
        }

        // Normal fill — needs fresh state, so delegate to a handler ref
        kbNumberRef.current(num);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally empty, uses stateRef

  // Ref for number placement from keyboard (keeps fresh closure)
  const kbNumberRef = useRef((_n: number) => {});

  const doSave = () => {
    const s = stateRef.current;
    if (!s.given.some(v => v > 0)) return;
    AsyncStorage.setItem('sudoku_sessao', JSON.stringify({
      puzzle: s.given, solution: s.solution, userBoard: s.userBoard,
      pencilMarks: s.pencilMarks, hintedCells: Array.from(s.hintedCells),
      lives: s.lives, hintsLeft: s.hintsLeft, difficulty: s.difficulty,
      elapsedSeconds: elapsedRef.current,
      completed: s.phase === 'won', lost: s.phase === 'lost',
    }));
  };

  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 800);
  };

  const saveTheme = (t: SudokuTheme) => {
    setTheme(t);
    AsyncStorage.setItem('sudoku_tema', t.id);
    setShowThemes(false);
  };

  // ── Start new game ──
  const startGame = (diff: Difficulty) => {
    setGenerating(true);
    setPhase('playing'); // show grid skeleton while generating
    // Defer to next tick so UI updates first
    setTimeout(() => {
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
      setGenerating(false);
    }, 50);
  };

  // ── Resume saved game ──
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

  // ── Computed highlights ──
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

  // ── Win check ──
  const checkWin = (board: number[], hinted: Set<number>, lv: number, hl: number, diff: Difficulty) => {
    if (lv <= 0) return;
    for (let i = 0; i < 81; i++) {
      if (given[i] > 0 || hinted.has(i)) continue;
      if (board[i] !== solution[i]) return;
    }
    setPhase('won');
    api.concluirSudoku({ difficulty: diff, elapsedSeconds: elapsedRef.current, hintsUsed: 3 - hl });
  };

  // ── Handlers ──
  const handleCell = (idx: number) => setSelected(p => p === idx ? null : idx);

  const handleNumber = (num: number) => {
    if (selected === null) return;
    const idx = selected;
    if (given[idx] > 0 || hintedCells.has(idx)) return;

    if (pencilMode) {
      setPencilMarks(pm => pm.map((m, i) =>
        i === idx ? (m.includes(num) ? m.filter(n => n !== num) : [...m, num]) : m
      ));
      scheduleSave();
      return;
    }

    if (userBoard[idx] === num) {
      setUserBoard(b => { const nb = [...b]; nb[idx] = 0; return nb; });
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
        AsyncStorage.setItem('sudoku_sessao', JSON.stringify({
          puzzle: given, solution, userBoard: nb, pencilMarks: npm,
          hintedCells: Array.from(hintedCells), lives: 0, hintsLeft, difficulty,
          elapsedSeconds: elapsedRef.current, completed: false, lost: true,
        }));
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

  // Expose handleNumber to keyboard handler
  kbNumberRef.current = handleNumber;

  const handleErase = () => {
    if (selected === null) return;
    const idx = selected;
    if (given[idx] > 0 || hintedCells.has(idx)) return;
    setUserBoard(b => { const nb = [...b]; nb[idx] = 0; return nb; });
    setPencilMarks(pm => pm.map((m, i) => i === idx ? [] : m));
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
    setUserBoard(nb); setPencilMarks(npm); setHintedCells(nh); setHintsLeft(hl);
    AsyncStorage.setItem('sudoku_sessao', JSON.stringify({
      puzzle: given, solution, userBoard: nb, pencilMarks: npm,
      hintedCells: Array.from(nh), lives, hintsLeft: hl, difficulty,
      elapsedSeconds: elapsedRef.current, completed: false, lost: false,
    }));
    checkWin(nb, nh, lives, hl, difficulty);
  };

  const handleRestart = () => { AsyncStorage.removeItem('sudoku_sessao'); setPhase('select'); };

  // ── Cell renderer ──
  const renderPencil = (idx: number) => {
    const marks = new Set(pencilMarks[idx] || []);
    return (
      <View style={styles.pencilGrid}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <View key={n} style={styles.pencilCell}>
            {marks.has(n) && <Text style={[styles.pencilNum, { color: theme.pencilColor }]}>{n}</Text>}
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

    const bg = isSelected ? theme.bgSelected
      : isSame ? theme.bgSame
      : inGroup ? theme.bgGroup
      : theme.bgCell;

    const textColor = wrong ? '#FF5555'
      : hinted ? theme.accent
      : gv ? theme.givenColor
      : theme.userColor;

    // Borders: thick for box edges, medium for inner edges
    const bR = col < 8 ? ((col === 2 || col === 5) ? 2.5 : 1) : 0;
    const bB = row < 8 ? ((row === 2 || row === 5) ? 2.5 : 1) : 0;
    const bRc = (col === 2 || col === 5) ? theme.boxLine : theme.cellLine;
    const bBc = (row === 2 || row === 5) ? theme.boxLine : theme.cellLine;

    return (
      <TouchableOpacity
        key={idx}
        onPress={() => handleCell(idx)}
        activeOpacity={0.75}
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
        {isSelected && <View style={[styles.selectedBorder, { borderColor: theme.accent }]} />}
        {isSame && display > 0 && <View style={[styles.sameValDot, { backgroundColor: theme.accent + '55' }]} />}
      </TouchableOpacity>
    );
  };

  // ──────────────── Render helpers ────────────────

  const ThemeSelector = () => (
    <Modal visible={showThemes} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowThemes(false)}>
        <View style={styles.themeSheet}>
          <View style={styles.themeHandle} />
          <Text style={styles.themeSheetTitle}>Esquema de Cores</Text>
          <View style={styles.themeGrid}>
            {THEMES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.themeCard, theme.id === t.id && { borderColor: t.accent, borderWidth: 2 }]}
                onPress={() => saveTheme(t)}
              >
                {/* Mini preview of the theme */}
                <View style={[styles.themePreview, { backgroundColor: t.bgCell, borderColor: t.boxLine, borderWidth: 1.5 }]}>
                  <View style={[styles.themePreviewInner]}>
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => (
                      <View key={i} style={[
                        styles.themePreviewCell,
                        { backgroundColor: i === 5 ? t.bgSelected : t.bgCell,
                          borderRightWidth: (i%4===1||i%4===3) ? 0 : 0.5,
                          borderBottomWidth: i < 8 ? 0.5 : 0,
                          borderColor: t.cellLine }
                      ]}>
                        {[1,3,6,9,13].includes(i) && (
                          <Text style={{ color: i===5 ? t.accent : (i%2===1?t.givenColor:t.userColor), fontSize: 7, fontWeight:'bold' }}>
                            {[7,3,5,1,8][([1,3,6,9,13].indexOf(i))]}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={[styles.themeCardName, { color: theme.id === t.id ? t.accent : '#aaa' }]}>{t.name}</Text>
                {theme.id === t.id && (
                  <Ionicons name="checkmark-circle" size={14} color={t.accent} style={{ marginTop: 2 }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
          <TouchableOpacity onPress={() => setShowThemes(true)} style={styles.paletteBtn}>
            <Ionicons name="color-palette-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
          <Ionicons name="grid" size={60} color={theme.accent} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.selectTitle}>Escolha a Dificuldade</Text>
          <Text style={styles.selectSub}>Preencha o 9×9 sem repetir números em cada linha, coluna ou quadrado</Text>
          {DIFFICULTIES.map(d => (
            <TouchableOpacity key={d} style={[styles.diffBtn, { borderColor: DIFFICULTY_COLORS[d] + '55' }]} onPress={() => startGame(d)}>
              <View style={[styles.diffDot, { backgroundColor: DIFFICULTY_COLORS[d] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.diffName}>{DIFFICULTY_LABELS[d]}</Text>
                <Text style={styles.diffDesc}>{DIFFICULTY_DESC[d]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={DIFFICULTY_COLORS[d]} />
            </TouchableOpacity>
          ))}
          {Platform.OS === 'web' && (
            <View style={styles.kbHint}>
              <Ionicons name="keypad-outline" size={16} color="#555" />
              <Text style={styles.kbHintText}>Teclas: setas para navegar, 1-9 para preencher, P = lápis, Del = apagar, H = dica</Text>
            </View>
          )}
        </ScrollView>
        <ThemeSelector />
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
          <TouchableOpacity onPress={() => setShowThemes(true)} style={styles.paletteBtn}>
            <Ionicons name="color-palette-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.resumeWrap}>
          <View style={styles.resumeCard}>
            <Ionicons name="time" size={48} color={theme.accent} />
            <Text style={styles.resumeTitle}>Partida salva</Text>
            <View style={[styles.diffPill, { backgroundColor: DIFFICULTY_COLORS[diff] + '22', borderColor: DIFFICULTY_COLORS[diff] + '66', borderWidth: 1 }]}>
              <Text style={[styles.diffPillText, { color: DIFFICULTY_COLORS[diff] }]}>{DIFFICULTY_LABELS[diff]}</Text>
            </View>
            <Text style={styles.resumeTime}>{formatTime(savedData.elapsedSeconds)} jogados</Text>
            <View style={styles.resumeLivesRow}>
              {[0,1,2].map(i => (
                <Ionicons key={i} name={i < savedData.lives ? 'heart' : 'heart-outline'} size={22} color={i < savedData.lives ? '#FF4444' : '#333'} />
              ))}
            </View>
            <TouchableOpacity style={[styles.resumeBtn, { backgroundColor: theme.accent }]} onPress={resumeGame}>
              <Ionicons name="play" size={18} color="#000" />
              <Text style={styles.resumeBtnText}>Continuar partida</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeNewBtn} onPress={() => { AsyncStorage.removeItem('sudoku_sessao'); setPhase('select'); }}>
              <Text style={styles.resumeNewText}>Nova partida</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ThemeSelector />
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
        <View style={styles.headerRight}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          <TouchableOpacity onPress={() => setShowThemes(true)} style={styles.paletteBtn}>
            <Ionicons name="color-palette-outline" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>
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
            <Ionicons key={i} name={i < hintsLeft ? 'bulb' : 'bulb-outline'} size={20} color={i < hintsLeft ? theme.accent : '#333'} />
          ))}
          <Text style={styles.statusLabel}>Dicas</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridWrapper}>
        {generating ? (
          <ActivityIndicator size="large" color={theme.accent} />
        ) : (
          <View style={[styles.gridOuter, { borderColor: theme.boxLine }]}>
            <View style={[styles.grid, { width: CELL_SIZE * 9, height: CELL_SIZE * 9 }]}>
              {Array.from({ length: 81 }, (_, i) => renderCell(i))}
            </View>
          </View>
        )}
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionBtn, pencilMode && [styles.actionBtnOn, { backgroundColor: theme.bgSelected }]]} onPress={() => setPencilMode(m => !m)}>
          <Ionicons name="pencil" size={21} color={pencilMode ? theme.accent : '#888'} />
          <Text style={[styles.actionLabel, pencilMode && { color: theme.accent }]}>Lápis</Text>
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
          <Ionicons name="bulb-outline" size={21} color={hintsLeft > 0 && selected !== null ? theme.accent : '#444'} />
          <Text style={[styles.actionLabel, (hintsLeft === 0 || selected === null) && { color: '#444' }]}>Dica ({hintsLeft})</Text>
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
              activeOpacity={0.7}
              style={[
                styles.numBtn,
                done && styles.numBtnDone,
                active && [styles.numBtnActive, { backgroundColor: theme.bgSelected, borderColor: theme.accent }],
              ]}
            >
              <Text style={[styles.numText, done && styles.numTextDone, active && { color: theme.accent }]}>
                {num}
              </Text>
              {!done && <Text style={[styles.numCount, active && { color: theme.accent }]}>{remaining}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Won Modal */}
      <Modal visible={phase === 'won'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: theme.accent + '18' }]}>
              <Ionicons name="trophy" size={48} color={theme.accent} />
            </View>
            <Text style={styles.modalBigTitle}>Parabéns!</Text>
            <Text style={styles.modalSub}>Você completou o Sudoku!</Text>
            <View style={[styles.diffPill, { backgroundColor: DIFFICULTY_COLORS[difficulty] + '22', marginBottom: 20 }]}>
              <Text style={[styles.diffPillText, { color: DIFFICULTY_COLORS[difficulty] }]}>{DIFFICULTY_LABELS[difficulty]}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color={theme.accent} />
                <Text style={styles.statVal}>{formatTime(elapsed)}</Text>
                <Text style={styles.statKey}>Tempo</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={20} color="#FF4444" />
                <Text style={styles.statVal}>{lives}/3</Text>
                <Text style={styles.statKey}>Vidas</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="bulb" size={20} color={theme.accent} />
                <Text style={styles.statVal}>{3 - hintsLeft}</Text>
                <Text style={styles.statKey}>Dicas</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: theme.accent }]} onPress={() => { AsyncStorage.removeItem('sudoku_sessao'); setPhase('select'); }}>
              <Text style={styles.modalPrimaryText}>Nova Partida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lost Modal */}
      <Modal visible={phase === 'lost'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#FF444420' }]}>
              <Ionicons name="close-circle" size={48} color="#FF4444" />
            </View>
            <Text style={[styles.modalBigTitle, { color: '#FF5555' }]}>Fim de jogo!</Text>
            <Text style={styles.modalSub}>Você usou todas as suas 3 vidas.</Text>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: theme.accent }]} onPress={() => startGame(difficulty)}>
              <Text style={styles.modalPrimaryText}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => { AsyncStorage.removeItem('sudoku_sessao'); setPhase('select'); }}>
              <Text style={styles.modalSecondaryText}>Escolher dificuldade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ThemeSelector />
    </SafeAreaView>
  );
}

// ──────────────── Styles ────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a28',
  },
  backBtn: { padding: 4, width: 36 },
  headerMid: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerText: { color: '#aaa', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  paletteBtn: { padding: 4 },

  diffPill: { marginTop: 3, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  diffPillText: { fontSize: 11, fontWeight: '700' },

  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 8,
    backgroundColor: '#0c0c18', borderBottomWidth: 1, borderBottomColor: '#1a1a28',
  },
  livesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusLabel: { color: '#444', fontSize: 11, marginLeft: 8 },

  gridWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridOuter: { borderWidth: 3, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },

  cell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellNum: { fontSize: CELL_SIZE * 0.46, color: '#fff' },
  cellNumUser: { fontWeight: '800' },
  selectedBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2.5, borderRadius: 1 },
  sameValDot: { position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, borderRadius: 2 },

  pencilGrid: { width: '100%', height: '100%', padding: 1, flexDirection: 'row', flexWrap: 'wrap' },
  pencilCell: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  pencilNum: { fontSize: CELL_SIZE * 0.21, fontWeight: '700' },

  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 8,
    backgroundColor: '#0c0c18', borderTopWidth: 1, borderTopColor: '#1a1a28',
  },
  actionBtn: { alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  actionBtnOn: { borderRadius: 10 },
  actionBtnOff: { opacity: 0.35 },
  actionLabel: { color: '#666', fontSize: 11, fontWeight: '500' },

  numpad: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10, backgroundColor: '#0a0a12',
  },
  numBtn: {
    width: NW, height: NW + 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#14142a', borderRadius: 10,
  },
  numBtnDone: { opacity: 0.25 },
  numBtnActive: { borderWidth: 1.5 },
  numText: { color: '#e0e0f0', fontSize: NW * 0.52, fontWeight: 'bold', lineHeight: NW * 0.62 },
  numTextDone: { color: '#333' },
  numCount: { color: '#444', fontSize: 9, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#12122a',
    borderRadius: 22, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a44',
  },
  modalIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalBigTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { color: '#777', fontSize: 15, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 28, marginBottom: 28 },
  statItem: { alignItems: 'center', gap: 4 },
  statVal: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  statKey: { color: '#555', fontSize: 11 },
  modalPrimaryBtn: { borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 10 },
  modalPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalSecondaryBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  modalSecondaryText: { color: '#555', fontSize: 14 },

  // Select difficulty
  selectContent: { padding: 24, paddingTop: 8 },
  selectTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  selectSub: { color: '#555', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  diffBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#12122a', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5,
  },
  diffDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  diffName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  diffDesc: { color: '#555', fontSize: 12 },
  kbHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16,
    backgroundColor: '#12122a', borderRadius: 12, padding: 12,
  },
  kbHintText: { color: '#555', fontSize: 12, flex: 1, lineHeight: 18 },

  // Resume
  resumeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resumeCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#12122a',
    borderRadius: 22, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a44',
  },
  resumeTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 14, marginBottom: 14 },
  resumeTime: { color: '#888', fontSize: 16, marginBottom: 10 },
  resumeLivesRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  resumeBtn: { flexDirection: 'row', borderRadius: 14, paddingVertical: 15, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  resumeBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  resumeNewBtn: { paddingVertical: 12 },
  resumeNewText: { color: '#555', fontSize: 14 },

  // Theme selector
  themeSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#12122a', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  themeHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  themeSheetTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  themeCard: { alignItems: 'center', width: 90, borderRadius: 12, padding: 10, backgroundColor: '#0c0c1e', borderWidth: 1.5, borderColor: '#2a2a3a' },
  themePreview: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  themePreviewInner: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  themePreviewCell: { width: '25%', height: '25%', alignItems: 'center', justifyContent: 'center' },
  themeCardName: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
