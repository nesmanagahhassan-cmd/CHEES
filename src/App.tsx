import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { 
  Crown, 
  RotateCcw, 
  User, 
  Users, 
  Gamepad2, 
  Copy, 
  Check, 
  LogOut, 
  ChevronRight, 
  Play, 
  Info,
  Sparkles,
  Volume2,
  VolumeX,
  MessageCircle,
  Trophy,
  Compass,
  ArrowRightLeft,
  Smartphone,
  Download
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { useFirebase, FirebaseProvider } from './context/FirebaseContext';
import ChessBoard3D, { squareToCoords } from './components/ChessBoard3D';
import ChessChat from './components/ChessChat';
import Leaderboard from './components/Leaderboard';
import GoogleAd from './components/GoogleAd';
import { getBestMove } from './utils/ai';
import { audio } from './utils/audio';
import { ChessRoom, GameMode, AIDifficulty, LastMove } from './types';

function ChessAppContent() {
  const { 
    user, 
    userStats, 
    loading: authLoading, 
    signInWithGoogle, 
    signInAsGuest, 
    logout,
    addWin,
    addLoss,
    addDraw
  } = useFirebase();

  // Navigation and State
  const [activeTab, setActiveTab] = useState<'lobby' | 'leaderboard'>('lobby');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [guestName, setGuestName] = useState<string>('');
  
  // Game state
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>('w'); // w, b, or null (spectator)

  // AI settings
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(AIDifficulty.MEDIUM);
  const [aiThinking, setAiThinking] = useState<boolean>(false);

  // Online multiplayer states
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<ChessRoom | null>(null);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [spectatorNames, setSpectatorNames] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [onlineRoomsList, setOnlineRoomsList] = useState<ChessRoom[]>([]);

  // Sound and HUD settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [activeClocks, setActiveClocks] = useState<{ w: number; b: number }>({ w: 600, b: 600 });
  
  // References
  const boardSyncRef = useRef<boolean>(false);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(true); // default true so they always have setup instructions

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app loads inside standalone android or ios mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAppClick = async () => {
    if (!deferredPrompt) {
      triggerToast('تطبيقات الويب التقدمية مدعومة بالكامل! لتثبيت اللعبة يدوياً على أندرويد: انقر على النقاط الثلاثة المتصفح ثم "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية" 📲');
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        triggerToast('رائع! تم بدء هبوط وتثبيت التطبيق على هاتفك بنجاح 🎉');
        setShowInstallBtn(false);
      } else {
        triggerToast('تم إلغاء تثبيت التطبيق.');
      }
    } catch (e) {
      console.warn('Install prompt error:', e);
      triggerToast('بإمكانك دائماً التثبيت يدوياً عبر خيارات متصفح هاتفك كروم!');
    }
    setDeferredPrompt(null);
  };

  // Play entry chime on load
  useEffect(() => {
    if (soundEnabled) {
      audio.playStart();
    }
    fetchActiveRooms();
  }, []);

  // Fetch online rooms list for lobbies
  const fetchActiveRooms = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'rooms'));
      const list: ChessRoom[] = [];
      querySnapshot.forEach((doc) => {
        const item = doc.data();
        if (item.status === 'waiting') {
          list.push(item as ChessRoom);
        }
      });
      setOnlineRoomsList(list);
    } catch (e) {
      console.warn('Could not fetch active rooms list - offline mode defaults active:', e);
    }
  };

  // Toast notifier helper
  const triggerToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  // Turn clocks timer
  useEffect(() => {
    if (gameMode && !room && !game.isGameOver()) {
      // Offline mode local clock
      clockIntervalRef.current = setInterval(() => {
        const turn = game.turn();
        setActiveClocks((prev) => ({
          ...prev,
          [turn]: Math.max(0, prev[turn] - 1),
        }));
      }, 1000);
    } else if (room && room.status === 'playing') {
      // Online mode clock ticker
      clockIntervalRef.current = setInterval(() => {
        const turn = room.turn;
        setActiveClocks((prev) => ({
          ...prev,
          [turn]: Math.max(0, prev[turn] - 1),
        }));
      }, 1000);
    }

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [gameMode, room, fen]);

  // Handle local timers expiry
  useEffect(() => {
    if (activeClocks.w === 0) {
      triggerToast('انتهى وقت اللاعب الأبيض! فاز اللاعب الأسود بالزمن.');
      if (soundEnabled) audio.playVictory();
      setGameMode(null);
    } else if (activeClocks.b === 0) {
      triggerToast('انتهى وقت اللاعب الأسود! فاز اللاعب الأبيض بالزمن.');
      if (soundEnabled) audio.playVictory();
      setGameMode(null);
    }
  }, [activeClocks]);

  // Fetch available candidate chess.js moves for highlighted 3D square
  useEffect(() => {
    if (selectedSquare) {
      const moves = game.moves({ square: selectedSquare as any, verbose: true });
      setValidMoves(moves.map((m) => m.to));
    } else {
      setValidMoves([]);
    }
  }, [selectedSquare, fen]);

  // Trigger computer move in singleplayer AI
  useEffect(() => {
    if (gameMode === 'offline_ai' && game.turn() === 'b' && !game.isGameOver() && !aiThinking) {
      setAiThinking(true);
      setTimeout(() => {
        const bestMove = getBestMove(game.fen(), aiDifficulty);
        if (bestMove) {
          const moveRes = game.move(bestMove);
          if (moveRes) {
            setFen(game.fen());
            if (soundEnabled) {
              if (moveRes.captured) {
                audio.playCapture();
              } else {
                audio.playMove();
              }
            }
            // triggers checks
            if (game.inCheck()) {
              if (soundEnabled) audio.playCheck();
              triggerToast('كش ملك! الملك في خطر!');
            }
          }
        }
        setAiThinking(false);
      }, 700);
    }
  }, [gameMode, fen, aiDifficulty]);

  // Sync and listen to real-time online room
  useEffect(() => {
    if (!currentRoomId) return;

    const roomRef = doc(db, 'rooms', currentRoomId);
    let firstLoad = true;

    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const roomData = snapshot.data() as ChessRoom;
      setRoom(roomData);

      // 1. Sync Chess local move model
      const incomingFen = roomData.fen;
      if (game.fen() !== incomingFen) {
        game.load(incomingFen);
        setFen(incomingFen);

        // Sound effects play on update
        if (!firstLoad && soundEnabled && roomData.lastMove) {
          if (roomData.lastMove.captured) {
            audio.playCapture();
          } else {
            audio.playMove();
          }
        }
      }

      // Check for remote check status
      if (game.inCheck() && !firstLoad) {
        if (soundEnabled) audio.playCheck();
        triggerToast('كش ملك! الملك في مأزق!');
      }

      // Check for results
      if (roomData.status === 'finished' && roomData.winnerId) {
        if (!firstLoad && soundEnabled) audio.playVictory();
      }

      firstLoad = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${currentRoomId}`);
    });

    // Mirror spectators list changes too!
    const spectatorsRef = collection(db, 'rooms', currentRoomId, 'spectators');
    const specUnsubscribe = onSnapshot(spectatorsRef, (specSnap) => {
      const names: string[] = [];
      specSnap.forEach((sDoc) => {
        names.push(sDoc.data().displayName);
      });
      
      // Notify player when a spectator joins
      if (names.length > spectatorCount && names.length > 0) {
        const newSpecName = names[names.length - 1];
        triggerToast(`المشاهد ${newSpecName} يتابع المباراة الآن! 👀`);
        // publish alert chat message
        if (playerColor !== null && !isSpectatorSlot()) {
          logSystemNotification(`المشاهد ${newSpecName} انضم للمتابعة.`);
        }
      }
      setSpectatorNames(names);
      setSpectatorCount(names.length);
    });

    return () => {
      unsubscribe();
      specUnsubscribe();
    };
  }, [currentRoomId]);

  const isSpectatorSlot = () => {
    if (!room || !user) return true;
    return room.whitePlayerId !== user.uid && room.blackPlayerId !== user.uid;
  };

  const logSystemNotification = async (alertText: string) => {
    if (!currentRoomId || !user) return;
    try {
      const messagesRef = collection(db, 'rooms', currentRoomId, 'messages');
      await addDoc(messagesRef, {
        userId: 'system',
        userName: 'الحكم الرقمي 🤖',
        text: alertText,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('Could not post system notification:', e);
    }
  };

  // Handle active square movement logic (from source 3D click, to target 3D target)
  const handlePieceMove = async (from: string, to: string) => {
    // 1. Guard check if it is the correct user turn
    if (room) {
      // Online mode checks
      const isMyTurn = (room.turn === 'w' && room.whitePlayerId === user?.uid) ||
                       (room.turn === 'b' && room.blackPlayerId === user?.uid);
      if (!isMyTurn) {
        triggerToast('انتظر دور منافسك الإستراتيجي!');
        return;
      }
    } else {
      // Offline mode turns
      if (gameMode === 'offline_ai' && game.turn() !== playerColor) {
        triggerToast('هذا جولة الذكاء الاصطناعي!');
        return;
      }
    }

    try {
      // Attempt moving via chess.js library
      const moveRes = game.move({ from, to, promotion: 'q' });
      if (moveRes) {
        // Successful chess coordinate translate
        setFen(game.fen());
        setSelectedSquare(null);

        // Calculate capture indicators for sound
        if (soundEnabled) {
          if (moveRes.captured) {
            audio.playCapture();
          } else {
            audio.playMove();
          }
        }

        const lMove: LastMove = {
          from,
          to,
          piece: moveRes.piece,
          color: moveRes.color,
          captured: moveRes.captured,
          san: moveRes.san,
          timestamp: Date.now(),
        };

        // Determine if Game Over
        let isDone = false;
        let isDraw = false;
        let outcomeText = '';
        if (game.isCheckmate()) {
          isDone = true;
          outcomeText = `كش ملك مات! فاز اللاعب ${moveRes.color === 'w' ? 'الأبيض' : 'الأسود'} بالضربة القاضية!`;
          if (soundEnabled) audio.playVictory();
          triggerToast(outcomeText);

          // update user statistics
          if (room) {
            const isWinnerMe = (moveRes.color === 'w' && room.whitePlayerId === user?.uid) ||
                               (moveRes.color === 'b' && room.blackPlayerId === user?.uid);
            if (isWinnerMe) {
              await addWin();
            } else {
              await addLoss();
            }
          }
        } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
          isDone = true;
          isDraw = true;
          outcomeText = 'تعادل! انتهى التنافس بالتساوي.';
          if (soundEnabled) audio.playVictory();
          triggerToast(outcomeText);
          if (room) await addDraw();
        }

        // 2. Sync online room document if playing multiplayer
        if (room && currentRoomId) {
          const roomRef = doc(db, 'rooms', currentRoomId);
          await updateDoc(roomRef, {
            fen: game.fen(),
            turn: game.turn(),
            lastMove: lMove,
            status: isDone ? (isDraw ? 'draw' : 'finished') : 'playing',
            winnerId: isDone && !isDraw ? user?.uid : null,
            winnerName: isDone && !isDraw ? (user?.displayName || 'منافس') : null,
            updatedAt: serverTimestamp()
          });

          // System Alerts chat log
          if (isDone) {
            logSystemNotification(`انتهت المباراة! ${outcomeText}`);
          } else if (game.inCheck()) {
            logSystemNotification(`تنبيه: اللاعب الأخر في وضعية كش ملك! ⚠️`);
          }
        }
      }
    } catch (err) {
      triggerToast('حركة غير قانونية طبقاً لقواعد الشطرنج!');
      setSelectedSquare(null);
    }
  };

  // Multiplayers: CREATE ONLINE PRIVATE ROOM
  const handleCreateRoom = async () => {
    if (!user) {
      triggerToast('الرجاء تسجيل الدخول بـ Google أو كزائر أولاً!');
      return;
    }

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'rooms', newCode);

    const initialRoomState: ChessRoom = {
      roomId: newCode,
      status: 'waiting',
      whitePlayerId: user.uid,
      whitePlayerName: user.displayName || 'لاعب مجهول',
      whitePlayerEmail: user.email || '',
      blackPlayerId: null,
      blackPlayerName: null,
      blackPlayerEmail: null,
      winnerId: null,
      winnerName: null,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w',
      lastMove: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(roomRef, {
        ...initialRoomState,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setCurrentRoomId(newCode);
      setGameMode('online_room');
      setPlayerColor('w');
      game.reset();
      setFen(game.fen());
      triggerToast(`تم إنشاء الغرفة بنجاح! شارك الكود: ${newCode}`);
      if (soundEnabled) audio.playStart();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${newCode}`);
    }
  };

  // Multiplayers: JOIN EXISTING ROOM
  const handleJoinRoom = async (targetId?: string) => {
    const code = (targetId || roomIdInput).trim().toUpperCase();
    if (!code) {
      triggerToast('الرجاء إدخال كود غرفة صحيح!');
      return;
    }

    if (!user) {
      triggerToast('الرجاء تسجيل الدخول أولاً للمطابقة!');
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    try {
      const docSnap = await getDoc(roomRef);
      if (!docSnap.exists()) {
        triggerToast('لم يتم العثور على الغرفة، تأكد من الرمز!');
        return;
      }

      const roomData = docSnap.data() as ChessRoom;

      if (roomData.status === 'finished' || roomData.status === 'draw') {
        triggerToast('هذه الغرفة انتهت بالفعل، انضم لغرف أخرى!');
        return;
      }

      // Check slot bindings
      if (roomData.whitePlayerId === user.uid) {
        // Player reconnects as White
        setPlayerColor('w');
      } else if (roomData.blackPlayerId === user.uid) {
        // Player reconnects as Black
        setPlayerColor('b');
      } else if (roomData.blackPlayerId === null && roomData.whitePlayerId !== user.uid) {
        // Join as Black
        await updateDoc(roomRef, {
          blackPlayerId: user.uid,
          blackPlayerName: user.displayName || 'لاعب مجهول',
          blackPlayerEmail: user.email || '',
          status: 'playing',
          updatedAt: serverTimestamp()
        });
        setPlayerColor('b');
        triggerToast('لقد انضممت كلاعب أسود تكتيكي! بالتوفيق.');
      } else {
        // Active room is full: JOIN AS SPECTATOR!
        setPlayerColor(null); // spectator
        const spectatorDocRef = doc(db, 'rooms', code, 'spectators', user.uid);
        await setDoc(spectatorDocRef, {
          uid: user.uid,
          email: user.email || 'guest@chess.com',
          displayName: user.displayName || 'مشاهد مجهول',
          joinedAt: new Date().toISOString()
        });
        triggerToast('الملعب ممتلئ! انضممت الآن كمشاهد ومحلل للمباراة 👁️');
      }

      setCurrentRoomId(code);
      setGameMode('online_room');
      game.load(roomData.fen);
      setFen(roomData.fen);
      if (soundEnabled) audio.playStart();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `rooms/${code}`);
    }
  };

  // Forfeit/Resign Game
  const handleResign = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في الاستسلام وإعلان غريمك كبطل؟')) {
      if (room && currentRoomId && user) {
        const isWhite = user.uid === room.whitePlayerId;
        const winnerName = isWhite ? (room.blackPlayerName || 'الأسود') : (room.whitePlayerName || 'الأبيض');
        const winnerId = isWhite ? room.blackPlayerId : room.whitePlayerId;

        const roomRef = doc(db, 'rooms', currentRoomId);
        await updateDoc(roomRef, {
          status: 'finished',
          winnerId,
          winnerName,
          updatedAt: serverTimestamp()
        });

        await logSystemNotification(`انسحاب اللاعب ${user.displayName}. أعلن فوز اللاعب المنافس بالاستسلام.`);
        await addLoss();
      }

      triggerToast('لقد أعلنت استسلامك! حظاً أوفر في الجولات القادمة.');
      setGameMode(null);
      setCurrentRoomId(null);
      setRoom(null);
    }
  };

  // Exit Match View
  const handleExitMatch = async () => {
    if (room && currentRoomId && playerColor === null && user) {
      // Spectator leaves of their own accord
      try {
        const specDoc = doc(db, 'rooms', currentRoomId, 'spectators', user.uid);
        await deleteDoc(specDoc);
      } catch (e) {
        console.warn('Could not clean up spectator entry on exit:', e);
      }
    }

    setGameMode(null);
    setCurrentRoomId(null);
    setRoom(null);
    setSelectedSquare(null);
    setActiveClocks({ w: 600, b: 600 });
    fetchActiveRooms();
  };

  const copyRoomCode = () => {
    if (!currentRoomId) return;
    navigator.clipboard.writeText(currentRoomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    triggerToast('تم نسخ رمز الغرفة بنجاح! أرسله للمنافس للمبارزة.');
  };

  // Reset Match State for Local games
  const handleLocalReset = () => {
    game.reset();
    setFen(game.fen());
    setSelectedSquare(null);
    setActiveClocks({ w: 600, b: 600 });
    triggerToast('تمت إعادة تهيئة الطاولة وبدء مبارزة جديدة!');
    if (soundEnabled) audio.playStart();
  };

  // Helper count of captured elements
  const getCapturedCounts = () => {
    // Standard starting set: 8p, 2r, 2n, 2b, 1q
    const startCount: Record<string, number> = { p: 8, r: 2, n: 2, b: 2, q: 1 };
    const currentCount: Record<string, { w: number; b: number }> = {
      p: { w: 0, b: 0 },
      r: { w: 0, b: 0 },
      n: { w: 0, b: 0 },
      b: { w: 0, b: 0 },
      q: { w: 0, b: 0 },
    };

    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type !== 'k') {
          currentCount[p.type][p.color]++;
        }
      }
    }

    // Captured piece counters
    const capturedByWhite: string[] = [];
    const capturedByBlack: string[] = [];

    Object.keys(startCount).forEach((piece) => {
      const start = startCount[piece];
      const remainingWhite = currentCount[piece]['w'];
      const remainingBlack = currentCount[piece]['b'];

      const lostByWhite = start - remainingWhite;
      const lostByBlack = start - remainingBlack;

      for (let i = 0; i < lostByWhite; i++) capturedByBlack.push(piece.toUpperCase());
      for (let i = 0; i < lostByBlack; i++) capturedByWhite.push(piece);
    });

    return { w: capturedByWhite, b: capturedByBlack };
  };

  const captured = getCapturedCounts();

  // Format clocks beautifully: mm:ss
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* 🚀 Sleek Header Navigation bar with custom Chess Emblem */}
      <header className="py-4 px-6 bg-slate-900/60 border-b border-slate-900 static top-0 backdrop-blur z-40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-yellow-400 rounded-xl text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/15">
            <Crown className="w-5.5 h-5.5 fill-slate-950" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent tracking-tight">غرفة الشطرنج ثلاثية الأبعاد</span>
            <span className="text-[10px] text-slate-500 font-mono block">3D Master Chess Online</span>
          </div>
        </div>

        {/* Sync panel tabs */}
        <div className="hidden md:flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1">
          <button
            id="tab_lobby"
            onClick={() => setActiveTab('lobby')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'lobby'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            مجلس اللعب والحروب
          </button>
          <button
            id="tab_leaderboard"
            onClick={() => {
              setActiveTab('leaderboard');
              fetchActiveRooms();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            قائمة قنص المتصدرين
          </button>
        </div>

        {/* Auth profile panel widget */}
        <div className="flex items-center gap-3">
          <button
            id="btn_sound_mute"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={soundEnabled ? "كتم المؤثرات الصوتية" : "تشغيل المؤثرات الصوتية"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {authLoading ? (
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 animate-spin border-t-transparent" />
          ) : userStats ? (
            <div className="flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <img
                src={userStats.photoURL}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-700"
                alt={userStats.displayName}
              />
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-slate-200 block">{userStats.displayName}</span>
                <span className="text-[9px] text-amber-500 font-bold tracking-wider">{userStats.points} نقطة ⚔️</span>
              </div>
              <button
                id="btn_signout"
                onClick={logout}
                className="p-1 px-2 text-[10px] bg-slate-900 hover:bg-rose-950 border border-slate-800 text-red-400 hover:text-red-300 rounded-lg flex items-center gap-1 transition-all"
              >
                <LogOut className="w-3" />
                خروج
              </button>
            </div>
          ) : (
            <button
              id="btn_google_signin"
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs px-4 py-2 rounded-xl border border-blue-500/30 transition-all shadow-md active:scale-98"
            >
              <User className="w-4 h-4" />
              سجل بـ Google
            </button>
          )}
        </div>
      </header>

      {/* Real-time Toast Notifications Alert */}
      {toastNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-500/30 text-amber-300 px-5 py-3 rounded-2xl shadow-2xl z-50 text-xs font-semibold flex items-center gap-2.5 animate-bounce backdrop-blur-md max-w-[92%]">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* 🧩 Active game Board Interface */}
      {gameMode ? (
        <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
          
          {/* Active 3D Board Canvas (8 cols layout) */}
          <section className="lg:col-span-8 flex flex-col gap-4 h-full w-full min-h-[280px] sm:min-h-[400px] lg:min-h-[580px] max-w-full overflow-hidden">
            <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-900">
              <button
                id="btn_exit_game"
                onClick={handleExitMatch}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                مغادرة والرجوع للردهة
              </button>

              <div className="flex items-center gap-2.5">
                {currentRoomId && (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-[10px] text-slate-500 font-mono">الكود:</span>
                    <button
                      id="btn_copy_code"
                      onClick={copyRoomCode}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-500 flex items-center gap-1.5 hover:bg-slate-900 font-mono"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{currentRoomId}</span>
                    </button>
                  </div>
                )}

                {/* Local reset button strictly for offline */}
                {!room && (
                  <button
                    id="btn_local_reset"
                    onClick={handleLocalReset}
                    className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
                    title="تصفية ريكب بداية اللعبة"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Render 3D Engine canvas */}
            <div className="flex-grow min-h-[250px] sm:min-h-[350px] md:min-h-[450px] aspect-square lg:aspect-auto">
              <ChessBoard3D
                fen={fen}
                onMove={handlePieceMove}
                turn={room ? room.turn : game.turn()}
                playerColor={room ? playerColor : (gameMode === 'offline_ai' ? playerColor : 'w')}
                lastMove={room ? (room.lastMove as any) : null}
                validMoves={validMoves}
                selectedSquare={selectedSquare}
                setSelectedSquare={setSelectedSquare}
              />
            </div>
          </section>

          {/* Side control modules and chat log (4 cols layout) */}
          <section className="lg:col-span-4 h-full flex flex-col gap-6">
            
            {/* Clocks, captures, and HUD ratings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-200">منافسة استراتيجية</span>
                <span className="text-xs text-blue-400 font-semibold uppercase font-mono bg-blue-500/5 px-2.5 py-1 rounded-md border border-blue-500/10">
                  {gameMode === 'online_room' ? 'أونلاين مباشر' : 'محلي'}
                </span>
              </div>

              {/* Player panels */}
              <div className="space-y-3.5">
                {/* BLACK PLAYER Row */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  (room ? room.turn === 'b' : game.turn() === 'b') 
                    ? 'bg-amber-500/5 border-amber-500/35 shadow shadow-amber-500/10' 
                    : 'bg-slate-950/40 border-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-7.5 h-7.5 rounded-lg bg-slate-950 font-bold border border-slate-600 flex items-center justify-center text-slate-300">
                      ♟️
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">
                        {room ? (room.blackPlayerName || 'في انتظار انضمام أسود...') : (gameMode === 'offline_ai' ? 'الذكاء الاصطناعي 🤖' : 'اللاعب الأسود')}
                      </h5>
                      <span className="text-[10px] text-slate-500">{room ? (room.blackPlayerEmail || 'رابط غائب') : 'خصم ذكي'}</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    {/* Captured pieces by Black */}
                    <div className="flex gap-0.5 text-[10px]">
                      {captured.b.slice(0, 4).map((p, idx) => (
                        <span key={idx} className="bg-slate-800 px-1 rounded text-slate-400">{p}</span>
                      ))}
                    </div>
                    <span className="p-1 px-2 text-xs font-mono font-bold bg-slate-950 rounded-lg text-slate-400 border border-slate-800">
                      {formatTime(activeClocks.b)}
                    </span>
                  </div>
                </div>

                {/* VERSUS Swapper */}
                <div className="flex justify-center">
                  <div className="p-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-500 animate-pulse">
                    <ArrowRightLeft className="w-4 h-4 rotate-90" />
                  </div>
                </div>

                {/* WHITE PLAYER Row */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  (room ? room.turn === 'w' : game.turn() === 'w') 
                    ? 'bg-amber-500/5 border-amber-500/35 shadow shadow-amber-500/10'  
                    : 'bg-slate-950/40 border-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-7.5 h-7.5 rounded-lg bg-slate-50 font-bold border border-slate-300 flex items-center justify-center text-slate-950">
                      ♕
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">
                        {room ? (room.whitePlayerName || 'لاعب أبيض') : (userStats ? userStats.displayName : 'اللاعب الأبيض')}
                      </h5>
                      <span className="text-[10px] text-slate-500">{room ? (room.whitePlayerEmail || 'المنشئ للغرفة') : 'لاعب محلي'}</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    {/* Captured pieces by White */}
                    <div className="flex gap-0.5 text-[10px]">
                      {captured.w.slice(0, 4).map((p, idx) => (
                        <span key={idx} className="bg-slate-100 px-1 rounded text-slate-950 font-semibold">{p}</span>
                      ))}
                    </div>
                    <span className="p-1 px-2 text-xs font-mono font-bold bg-slate-950 rounded-lg text-slate-400 border border-slate-800">
                      {formatTime(activeClocks.w)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Online Spectator List Banner if available */}
              {room && spectatorCount > 0 && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-semibold text-blue-400 block">👀 يتابع المباراة الآن ({spectatorCount} مشاهد):</span>
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                    {spectatorNames.map((name, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">{name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Control Options (Resign) */}
              <div className="pt-3 flex gap-2">
                {room && playerColor !== null && (
                  <button
                    id="btn_resign"
                    onClick={handleResign}
                    className="w-full py-2 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold text-rose-400 rounded-xl"
                  >
                    🚩 إعلان الاستسلام والانسحاب
                  </button>
                )}
              </div>

              {/* Responsive Google Ads unit */}
              <GoogleAd className="mt-4" />
            </div>

            {/* Chat Module */}
            <div className="flex-grow">
              <ChessChat
                roomId={currentRoomId || 'offline'}
                userId={user?.uid || 'guest'}
                userName={user?.displayName || 'زائر'}
                isOffline={!room}
              />
            </div>
          </section>
        </main>
      ) : (
        /* 🏰 Main Lobby Dashboard Grid (Start Screen) */
        <main className="flex-grow max-w-5xl mx-auto w-full p-6 space-y-8 animate-fade-in">
          
          {/* Main Display Title banner */}
          <section className="text-center py-6 space-y-3 max-w-xl mx-auto">
            <h1 className="text-3xl md:text-4.5xl font-extrabold tracking-tight text-slate-100 uppercase">
              تنافس، خطط، وانتصر في مصفوفة الشطرنج
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              واجهة شطرنج احترافية ثلاثية الأبعاد تفاعلية بالكامل. العب بشكل مباشر مع الأصدقاء أونلاين عبر غرف تشفير الكود والمشاهدين، أو تحدى المحرك الذكي محلياً.
            </p>
          </section>

          {/* PWA Mobile App Promo Card */}
          {showInstallBtn && (
            <div id="btn_pwa_prompt_main" className="max-w-xl mx-auto p-4 md:p-5 rounded-2xl bg-gradient-to-tr from-blue-950/45 via-slate-900 to-amber-950/20 border border-amber-500/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:border-amber-500/25">
              <div className="flex items-center gap-3.5 text-right">
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shadow-md shrink-0">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                    تثبيت كـ تطبيق أندرويد حقيقي 📱
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">جاهز للتثبيت</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans mt-0.5">
                    احصل على تجربة لعب شطرنج ثلاثي الأبعاد كاملة وبدون إعلانات منبثقة مزعجة أو مشاكل توافق، مع تشغيل فوري من شاشتك الرئيسية!
                  </p>
                </div>
              </div>

              <button
                id="btn_pwa_actions"
                onClick={handleInstallAppClick}
                className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
              >
                <Download className="w-4 h-4" />
                تثبيت على الهاتف الآن
              </button>
            </div>
          )}

          {/* Quick tab filters on mobile */}
          <div className="flex md:hidden justify-center bg-slate-900 border border-slate-800 p-1.5 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('lobby')}
              className={`flex-grow py-2 text-xs font-bold rounded-lg ${
                activeTab === 'lobby' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              طاولة اللعب
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-grow py-2 text-xs font-bold rounded-lg ${
                activeTab === 'leaderboard' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              قائمة الشرف
            </button>
          </div>

          {activeTab === 'lobby' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Online Matchmaking card logic (7 cols) */}
              <div className="md:col-span-7 space-y-6">
                
                {/* 1. Play Online Matching panel */}
                <div className="bg-slate-900 border border-slate-805 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">المباريات واللوبي أونلاين مباشر</h3>
                      <p className="text-xs text-slate-500">أنشئ غرفة آمنة أو اكتب الكود المرسل للانضمام فوراً</p>
                    </div>
                  </div>

                  {!user ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-850/40 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        الرجاء كتابة اسم مستعار للعب السريع كزائر، أو تسجيل الدخول بـ Google لمزامنة إنجازاتك
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                        <input
                          id="guest_name_input"
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="اكتب اسم الزائر هنا..."
                          className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <button
                          id="btn_guest_login"
                          onClick={() => signInAsGuest(guestName)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl border border-slate-750 transition-all"
                        >
                          دخول كزائر 👤
                        </button>
                      </div>
                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink mx-4 text-[10px] text-slate-500">أو سجل إلكترونياً</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                      </div>
                      <button
                        id="btn_google_lobby"
                        onClick={signInWithGoogle}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 shadow-md shadow-blue-500/10"
                      >
                        <User className="w-4 h-4" />
                        سجل الدخول بحساب Google الآمن
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* CREATE BUTTON */}
                        <button
                          id="btn_create_online"
                          onClick={handleCreateRoom}
                          className="py-4 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm tracking-tight transition-all shadow-lg active:scale-98 flex flex-col items-center justify-center gap-1.5"
                        >
                          <Crown className="w-5.5 h-5.5 fill-slate-950" />
                          <span>إنشاء غرفة جديدة وبث الكود</span>
                        </button>

                        {/* JOIN BUTTON & INPUT */}
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850 flex flex-col justify-between gap-3">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase font-mono block">انضم بكود الغرفة</label>
                          <div className="flex gap-2">
                            <input
                              id="room_code_input"
                              type="text"
                              value={roomIdInput}
                              onChange={(e) => setRoomIdInput(e.target.value)}
                              placeholder="أدخل رمز الغرفة..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-center font-mono uppercase font-bold"
                            />
                            <button
                              id="btn_join_by_input"
                              onClick={() => handleJoinRoom()}
                              className="px-4 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                            >
                              انضم
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Active rooms list on the lobby */}
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-400 font-semibold block">الغرف العامة المفتوحة حالياً للعب:</span>
                          <button
                            id="btn_refresh_rooms"
                            onClick={fetchActiveRooms}
                            className="text-[10px] text-amber-500 hover:text-amber-400 underline"
                          >
                            تحديث القائمة 🔄
                          </button>
                        </div>
                        {onlineRoomsList.length === 0 ? (
                          <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850/50 text-center">
                            <p className="text-xs text-slate-500">لا توجد غرف عامة بانتظار الخصم حالياً. بادر بإنشاء غرفة وتحدّ المنافسين!</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {onlineRoomsList.map((rm) => (
                              <div
                                key={rm.roomId}
                                className="flex justify-between items-center p-3 rounded-lg bg-slate-950/60 border border-slate-850 hover:border-slate-700 transition-colors"
                              >
                                <div className="text-right">
                                  <span className="text-xs font-bold text-slate-200 block">غرفة {rm.roomId}</span>
                                  <span className="text-[10px] text-slate-500">المنشئ: {rm.whitePlayerName}</span>
                                </div>
                                <button
                                  id={`btn_join_${rm.roomId}`}
                                  onClick={() => handleJoinRoom(rm.roomId)}
                                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  تحدّ الآن ⚔️
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Play Offline modes */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                      <Compass className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">التدريب واللعب الفردي دون اتصال بالإنترنت</h3>
                      <p className="text-xs text-slate-500">مبارزة ذكاء اصطناعي بذكاءات متعددة أو تمرير الشاشة محليا</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* SOLO COMPUTER MODULE */}
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold text-amber-500 uppercase block mb-1 font-mono tracking-wider">الذكاء الاصطناعي 🤖</span>
                        <h4 className="text-xs font-bold text-slate-200 mb-2">مباراة ضد محرك Minimax</h4>
                        
                        {/* Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 block">اختر مستوى التحدي والمبارزة الكلاسيكية:</label>
                          <select
                            id="ai_difficulty_picker"
                            value={aiDifficulty}
                            onChange={(e) => setAiDifficulty(e.target.value as AIDifficulty)}
                            className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 focus:outline-none focus:border-amber-500"
                          >
                            <option value={AIDifficulty.EASY}>مبتدئ سهل (Easy Evaluation)</option>
                            <option value={AIDifficulty.MEDIUM}>متمرس متوسط (Medium Alpha-Beta)</option>
                            <option value={AIDifficulty.HARD}>محترف ماستر (Hard MiniMax Depth 3)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        id="btn_start_ai"
                        onClick={() => {
                          setGameMode('offline_ai');
                          setPlayerColor('w');
                          game.reset();
                          setFen(game.fen());
                          if (soundEnabled) audio.playStart();
                          triggerToast('بدأت المباراة ضد الذكاء الاصطناعي بوضع هجوم الأبيض! بالتوفيق.');
                        }}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        بدء التدريب الفردي
                      </button>
                    </div>

                    {/* PASS AND PLAY MODULE */}
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 flex flex-col justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold text-blue-400 uppercase block mb-1 font-mono tracking-wider">جهازي الشخصي 📱</span>
                        <h4 className="text-xs font-bold text-slate-200 mb-1">تمرير ولعب محلي (Pass & Play)</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          العب مع صديقك بجانبك في اللابتوب أو الموبايل عبر تبادل تحريك ورؤية لوحة الشطرنج ثلاثية الأبعاد التفاعلية في نفس الشاشة.
                        </p>
                      </div>

                      <button
                        id="btn_start_local"
                        onClick={() => {
                          setGameMode('offline_pass_play');
                          setPlayerColor('w'); // white starts
                          game.reset();
                          setFen(game.fen());
                          if (soundEnabled) audio.playStart();
                          triggerToast('بدأت جولة اللعب والتمرير المحلي! تحد وتبارز.');
                        }}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        بدء تبادل الشاشة
                      </button>
                    </div>

                  </div>
                </div>

                {/* Google Ad banner in Lobby for premium Adsense / Simulated promotions */}
                <GoogleAd className="mt-6" />

              </div>

              {/* Leaderboard display on lobby (5 cols) */}
              <div className="md:col-span-12 lg:col-span-5 h-full">
                <Leaderboard />
              </div>

            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <Leaderboard />
            </div>
          )}

        </main>
      )}

      {/* FOOTER */}
      <footer className="py-6 bg-slate-900 border-t border-slate-900 text-center text-[10px] text-slate-500 gap-1 mt-auto">
        <p>جميع قوانين الشطرنج العالمية مطبقة بالكامل بواسطة كش ملك و التبييت و En Passant.</p>
        <p className="mt-1">© {new Date().getFullYear()} لعبة شطرنج مجسمة احترافية ثلاثية الأبعاد - جميع الحقوق محفوظة.</p>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <ChessAppContent />
    </FirebaseProvider>
  );
}
