import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Rotate3d, Maximize2, Zap, HelpCircle } from 'lucide-react';
import { LastMove } from '../types';

interface ChessBoard3DProps {
  fen: string;
  onMove: (from: string, to: string) => void;
  turn: 'w' | 'b';
  playerColor: 'w' | 'b' | null; // null for spectator
  lastMove: LastMove | null;
  validMoves: string[]; // algebraic list of target squares if a piece is selected
  selectedSquare: string | null;
  setSelectedSquare: (square: string | null) => void;
}

// Convert algebraic coord ('e4') to 3D grid indices
export function squareToCoords(square: string): { row: number; col: number } {
  const col = square.charCodeAt(0) - 97; // 'a' -> 0
  const row = parseInt(square[1], 10) - 1; // '1' -> 0
  return { row, col };
}

// Convert 3D indices to algebraic coord
export function coordsToSquare(row: number, col: number): string {
  const file = String.fromCharCode(97 + col);
  const rank = (row + 1).toString();
  return file + rank;
}

export default function ChessBoard3D({
  fen,
  onMove,
  turn,
  playerColor,
  lastMove,
  validMoves,
  selectedSquare,
  setSelectedSquare,
}: ChessBoard3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Custom Rotation States
  const [yaw, setYaw] = useState<number>(playerColor === 'b' ? Math.PI : 0); // yaw around the board
  const [pitch, setPitch] = useState<number>(0.8); // tilt angle
  const [zoom, setZoom] = useState<number>(10.5); // camera distance
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showHelpers, setShowHelpers] = useState<boolean>(true);

  // References to communicate with Three.js loops
  const stateRef = useRef({
    yaw: playerColor === 'b' ? Math.PI : 0,
    pitch: 0.8,
    zoom: 10.5,
    autoRotate: false,
    selectedSquare: null as string | null,
    validMoves: [] as string[],
    playerColor: playerColor,
    fen: fen,
    lastMove: lastMove as LastMove | null,
  });

  // Sync props to stateRef
  useEffect(() => {
    stateRef.current.fen = fen;
    stateRef.current.playerColor = playerColor;
    stateRef.current.selectedSquare = selectedSquare;
    stateRef.current.validMoves = validMoves;
    stateRef.current.lastMove = lastMove;
  }, [fen, playerColor, selectedSquare, validMoves, lastMove]);

  // Handle Drag / Pointer coordinates to rotate camera
  useEffect(() => {
    stateRef.current.yaw = yaw;
    stateRef.current.pitch = pitch;
    stateRef.current.zoom = zoom;
    stateRef.current.autoRotate = autoRotate;
  }, [yaw, pitch, zoom, autoRotate]);

  // Adjust View when player color changes
  useEffect(() => {
    if (playerColor === 'b') {
      setYaw(Math.PI);
    } else {
      setYaw(0);
    }
  }, [playerColor]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 500;
    const height = containerRef.current.clientHeight || 450;

    // --- 1. Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0f19'); // Elegant deep space background
    scene.fog = new THREE.FogExp2('#0b0f19', 0.015);

    // --- 2. Camera setup ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Position camera along a sphere centered at (0,0,0)
    const updateCameraPosition = () => {
      const activeYaw = stateRef.current.yaw + (stateRef.current.autoRotate ? Date.now() * 0.0001 : 0);
      const activePitch = stateRef.current.pitch;
      const r = stateRef.current.zoom;

      camera.position.x = r * Math.sin(activePitch) * Math.sin(activeYaw);
      camera.position.z = r * Math.sin(activePitch) * Math.cos(activeYaw);
      camera.position.y = r * Math.cos(activePitch);
      camera.lookAt(0, -0.2, 0);
    };
    updateCameraPosition();

    // --- 3. Renderer ---
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- 4. Lights ---
    const ambientLight = new THREE.AmbientLight('#2a3754', 1.8);
    scene.add(ambientLight);

    // Dynamic key light throwing cast shadows
    const dirLight = new THREE.DirectionalLight('#e0f2fe', 2.5);
    dirLight.position.set(6, 14, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    const d = 6;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Secondary warm ambient light for depth
    const fillerLight = new THREE.DirectionalLight('#ea580c', 0.8);
    fillerLight.position.set(-6, 3, -5);
    scene.add(fillerLight);

    // --- 5. Beautiful wooden/marble table underneath the Chessboard ---
    const tableGeo = new THREE.BoxGeometry(10.2, 0.6, 10.2);
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.2,
      metalness: 0.1,
    });
    const tableMesh = new THREE.Mesh(tableGeo, woodMat);
    tableMesh.position.y = -0.31;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // Gold decorative border rim around board
    const tableRimGeo = new THREE.BoxGeometry(9.7, 0.06, 9.7);
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.15,
      metalness: 0.9,
    });
    const rimMesh = new THREE.Mesh(tableRimGeo, goldRimMat);
    rimMesh.position.y = -0.02;
    scene.add(rimMesh);

    // --- 6. Creating Chess board Squares (64 boxes) ---
    const squareGeo = new THREE.BoxGeometry(1.1, 0.15, 1.1);

    const matLight = new THREE.MeshStandardMaterial({
      color: '#e2e8f0', // Cool clean ivory
      roughness: 0.15,
      metalness: 0.05,
    });
    const matDark = new THREE.MeshStandardMaterial({
      color: '#334155', // Sleek slate charcoal
      roughness: 0.25,
      metalness: 0.1,
    });

    const boardGroup = new THREE.Group();
    const squareMeshes: { mesh: THREE.Mesh; row: number; col: number; defaultColor: THREE.Color }[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isWhite = (r + c) % 2 === 1; // standard board pattern
        const mat = isWhite ? matLight.clone() : matDark.clone();
        const sqMesh = new THREE.Mesh(squareGeo, mat);

        // Center chessboard at XZ (0,0) index 0..7 ranges X:-3.85..3.85, step 1.1
        const xPos = (c - 3.5) * 1.1;
        const zPos = (3.5 - r) * 1.1; // White side is bottom (row=0, rank=1 -> z=3.85)
        sqMesh.position.set(xPos, -0.015, zPos);
        sqMesh.receiveShadow = true;
        sqMesh.castShadow = true;

        boardGroup.add(sqMesh);
        squareMeshes.push({
          mesh: sqMesh,
          row: r,
          col: c,
          defaultColor: (sqMesh.material as THREE.MeshStandardMaterial).color.clone(),
        });
      }
    }
    scene.add(boardGroup);

    // --- 7. Piece mesh generators (Procedurally sculpted 3D models) ---
    // Beautiful stylized shapes using cylinders, cones, and spheres!
    const constructPieceMesh = (type: string, color: 'w' | 'b'): THREE.Group => {
      const pGroup = new THREE.Group();

      const baseMat = new THREE.MeshPhysicalMaterial({
        color: color === 'w' ? '#f8fafc' : '#0f172a',
        roughness: color === 'w' ? 0.12 : 0.2,
        metalness: color === 'w' ? 0.15 : 0.45,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
      });

      // Simple golden band highlighting details
      const metalBandMat = new THREE.MeshStandardMaterial({
        color: color === 'w' ? '#d97706' : '#f59e0b',
        roughness: 0.1,
        metalness: 0.9,
      });

      // Constructive solid parts depending on TYPE
      // Base cylinder for all pieces
      const baseGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.15, 16);
      const basePiece = new THREE.Mesh(baseGeo, baseMat);
      basePiece.position.y = 0.075;
      basePiece.castShadow = true;
      basePiece.receiveShadow = true;
      pGroup.add(basePiece);

      const collarGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16);
      const collar = new THREE.Mesh(collarGeo, metalBandMat);
      collar.position.y = 0.16;
      pGroup.add(collar);

      switch (type) {
        case 'p': {
          // Pawn: lower torso cone + top sphere head
          const stemGeo = new THREE.CylinderGeometry(0.18, 0.3, 0.45, 12);
          const stem = new THREE.Mesh(stemGeo, baseMat);
          stem.position.y = 0.385;
          stem.castShadow = true;
          pGroup.add(stem);

          const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
          const head = new THREE.Mesh(headGeo, baseMat);
          head.position.y = 0.68;
          head.castShadow = true;
          pGroup.add(head);
          break;
        }
        case 'r': {
          // Rook: castle tower column + top crown
          const columnGeo = new THREE.CylinderGeometry(0.26, 0.32, 0.6, 16);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = 0.45;
          column.castShadow = true;
          pGroup.add(column);

          const crownGeo = new THREE.CylinderGeometry(0.33, 0.28, 0.25, 12);
          const crown = new THREE.Mesh(crownGeo, baseMat);
          crown.position.y = 0.8;
          crown.castShadow = true;
          pGroup.add(crown);
          break;
        }
        case 'n': {
          // Knight: stylized elegant block horse silhouette
          const neckGeo = new THREE.CylinderGeometry(0.16, 0.28, 0.4, 12);
          const neck = new THREE.Mesh(neckGeo, baseMat);
          neck.position.y = 0.35;
          neck.rotation.x = 0.25;
          neck.castShadow = true;
          pGroup.add(neck);

          const headGeo = new THREE.BoxGeometry(0.25, 0.38, 0.45);
          const head = new THREE.Mesh(headGeo, baseMat);
          head.position.set(0, 0.65, 0.1);
          head.rotation.x = -0.28;
          head.castShadow = true;
          pGroup.add(head);

          // EARS
          const earGeo = new THREE.ConeGeometry(0.06, 0.15, 4);
          const earL = new THREE.Mesh(earGeo, baseMat);
          earL.position.set(-0.08, 0.85, -0.03);
          pGroup.add(earL);

          const earR = earL.clone();
          earR.position.x = 0.08;
          pGroup.add(earR);
          break;
        }
        case 'b': {
          // Bishop: mitre cone + golden crown bead
          const columnGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.65, 12);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = 0.48;
          column.castShadow = true;
          pGroup.add(column);

          const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
          // Scale sphere vertically to look like bishop mitre
          const head = new THREE.Mesh(headGeo, baseMat);
          head.scale.set(1, 1.4, 1);
          head.position.y = 0.88;
          head.castShadow = true;
          pGroup.add(head);

          const cruzGeo = new THREE.SphereGeometry(0.06, 8, 8);
          const cruz = new THREE.Mesh(cruzGeo, metalBandMat);
          cruz.position.y = 1.25;
          pGroup.add(cruz);
          break;
        }
        case 'q': {
          // Queen: flaring crown torso + coronet beads
          const columnGeo = new THREE.CylinderGeometry(0.18, 0.32, 0.85, 16);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = 0.58;
          column.castShadow = true;
          pGroup.add(column);

          const crownGeo = new THREE.CylinderGeometry(0.36, 0.22, 0.35, 16);
          const crown = new THREE.Mesh(crownGeo, baseMat);
          crown.position.y = 1.05;
          crown.castShadow = true;
          pGroup.add(crown);

          const orbGeo = new THREE.SphereGeometry(0.07, 12, 12);
          const orb = new THREE.Mesh(orbGeo, metalBandMat);
          orb.position.y = 1.25;
          pGroup.add(orb);
          break;
        }
        case 'k': {
          // King: tallest model + solid crown cap + cross topper
          const columnGeo = new THREE.CylinderGeometry(0.22, 0.34, 0.95, 16);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = 0.62;
          column.castShadow = true;
          pGroup.add(column);

          const crownGeo = new THREE.BoxGeometry(0.35, 0.18, 0.35);
          const crown = new THREE.Mesh(crownGeo, baseMat);
          crown.position.y = 1.15;
          crown.rotation.y = Math.PI / 4;
          crown.castShadow = true;
          pGroup.add(crown);

          // Dynamic cross model
          const crossBarH = new THREE.BoxGeometry(0.2, 0.05, 0.05);
          const crossBarV = new THREE.BoxGeometry(0.05, 0.22, 0.05);
          const cross = new THREE.Group();
          const p1 = new THREE.Mesh(crossBarH, metalBandMat);
          p1.position.y = 0.12;
          const p2 = new THREE.Mesh(crossBarV, metalBandMat);
          p2.position.y = 0.12;
          cross.add(p1);
          cross.add(p2);
          cross.position.y = 1.18;
          pGroup.add(cross);
          break;
        }
      }

      // Slightly lift up piece from floor coordinates
      pGroup.position.y = 0.01;
      return pGroup;
    };

    // --- 8. Synchronizing logical board (FEN) into 3D pieces ---
    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);

    interface ActivePiece {
      square: string;
      row: number;
      col: number;
      type: string;
      color: 'w' | 'b';
      group: THREE.Group;
    }

    let activePieces: ActivePiece[] = [];

    const syncPiecesFromFen = (currentFen: string) => {
      // Clear current visual pieces
      while (piecesGroup.children.length > 0) {
        piecesGroup.remove(piecesGroup.children[0]);
      }
      activePieces = [];

      const parts = currentFen.split(' ');
      const boardLayout = parts[0];
      const rows = boardLayout.split('/');

      for (let r = 0; r < 8; r++) {
        const rowStr = rows[r];
        let colIdx = 0;

        for (let i = 0; i < rowStr.length; i++) {
          const char = rowStr[i];
          if (isNaN(parseInt(char, 10))) {
            const isWhite = char === char.toUpperCase();
            const type = char.toLowerCase();
            const color = isWhite ? 'w' : 'b';

            const pMeshGroup = constructPieceMesh(type, color);

            // Compute board offsets
            const xPos = (colIdx - 3.5) * 1.1;
            const zPos = (3.5 - r) * 1.1; // row 0 ranks 8 at top (Z = -3.85)
            pMeshGroup.position.x = xPos;
            pMeshGroup.position.z = zPos;

            piecesGroup.add(pMeshGroup);
            activePieces.push({
              square: coordsToSquare(7 - r, colIdx),
              row: 7 - r,
              col: colIdx,
              type,
              color,
              group: pMeshGroup,
            });

            colIdx++;
          } else {
            colIdx += parseInt(char, 10);
          }
        }
      }
    };

    syncPiecesFromFen(stateRef.current.fen);

    // --- 9. Capture Spark Particle System ---
    const particles: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      decay: number;
      life: number;
    }[] = [];

    const spawnCaptureExplosion = (x: number, z: number) => {
      const pCount = 20;
      const partGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

      for (let i = 0; i < pCount; i++) {
        const partMat = new THREE.MeshBasicMaterial({
          color: Math.random() < 0.35 ? '#ea580c' : '#f1f5f9', // fiery dust sparks
          transparent: true,
          opacity: 1.0,
        });
        const pMesh = new THREE.Mesh(partGeo, partMat);
        pMesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.3, z + (Math.random() - 0.5) * 0.4);

        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2.2,
          Math.random() * 2.8 + 1.2,
          (Math.random() - 0.5) * 2.2
        );

        scene.add(pMesh);
        particles.push({
          mesh: pMesh,
          velocity,
          decay: Math.random() * 0.02 + 0.025,
          life: 1.0,
        });
      }
    };

    // Trigger capture particle animation if dynamic moves occur
    let latestPhen = stateRef.current.fen;
    let latestLastMove = stateRef.current.lastMove;

    // --- 10. Smooth sliding active move transitions ---
    interface PieceAnimation {
      group: THREE.Group;
      startX: number;
      startZ: number;
      endX: number;
      endZ: number;
      progress: number;
    }
    let activeSlide: PieceAnimation | null = null;

    // --- 11. Custom Interactive Pointer & Raycasting Click Control ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getRaycastSquare = (event: PointerEvent): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);

      // Raycast against chess board squares
      const intersects = raycaster.intersectObjects(
        squareMeshes.map((s) => s.mesh)
      );
      if (intersects.length > 0) {
        const hitSquare = squareMeshes.find((s) => s.mesh === intersects[0].object);
        if (hitSquare) {
          return coordsToSquare(hitSquare.row, hitSquare.col);
        }
      }
      return null;
    };

    // Register Pointer Events for clicking squares
    let dragActive = false;
    let initX = 0;
    let initY = 0;
    let clickCandidate: string | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      dragActive = true;
      initX = e.clientX;
      initY = e.clientY;
      clickCandidate = getRaycastSquare(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      dragActive = false;
      const deltaX = Math.abs(e.clientX - initX);
      const deltaY = Math.abs(e.clientY - initY);

      // If they didn't drag their angle but performed a swift clean click
      if (deltaX < 5 && deltaY < 5) {
        const clickedSq = getRaycastSquare(e);
        if (clickedSq) {
          const selected = stateRef.current.selectedSquare;
          const valid = stateRef.current.validMoves;
          const userColor = stateRef.current.playerColor;

          // Check if it was a movement click to a valid candidate square
          if (selected && valid.includes(clickedSq)) {
            // Execution callback
            onMove(selected, clickedSq);
            setSelectedSquare(null);
          } else {
            // Else handle selection
            const pieceOnSq = activePieces.find((p) => p.square === clickedSq);
            if (pieceOnSq) {
              // Ensure player only highlights their own legal pieces
              if (userColor === null) {
                // Spectator - no selection
                setSelectedSquare(null);
              } else if (pieceOnSq.color === userColor) {
                setSelectedSquare(clickedSq);
              } else {
                setSelectedSquare(null);
              }
            } else {
              setSelectedSquare(null);
            }
          }
        } else {
          setSelectedSquare(null);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragActive) return;
      const dx = e.clientX - initX;
      const dy = e.clientY - initY;

      // Adjust camera yaw and pitch
      setYaw((y) => y - dx * 0.006);
      setPitch((p) => Math.max(0.12, Math.min(Math.PI / 2 - 0.08, p - dy * 0.006)));

      initX = e.clientX;
      initY = e.clientY;
    };

    const canvasElem = canvasRef.current;
    canvasElem.addEventListener('pointerdown', handlePointerDown);
    canvasElem.addEventListener('pointerup', handlePointerUp);
    canvasElem.addEventListener('pointermove', handlePointerMove);

    // Touch support (using Mouse coordinates above makes typical pointers click-compatible,
    // but we can explicitly set style and prevent defaults to keep standard mobile scrolls smooth)
    canvasElem.style.touchAction = 'none';

    // --- 12. Interactive Tick loop ---
    let animationFrameId = 0;

    const tick = () => {
      updateCameraPosition();

      // Detect visual update triggers (like new FEN from network)
      if (stateRef.current.fen !== latestPhen) {
        latestPhen = stateRef.current.fen;

        // Check if a move was highlighted to trigger sliders & particle explosions
        const mv = stateRef.current.lastMove;
        if (mv && (latestLastMove !== mv)) {
          latestLastMove = mv;

          const fromCoords = squareToCoords(mv.from);
          const toCoords = squareToCoords(mv.to);
          const fX = (fromCoords.col - 3.5) * 1.1;
          const fZ = (3.5 - fromCoords.row) * 1.1;
          const tX = (toCoords.col - 3.5) * 1.1;
          const tZ = (3.5 - toCoords.row) * 1.1;

          // Spawn particle explosion if a capture took place
          if (mv.captured) {
            spawnCaptureExplosion(tX, tZ);
          }

          // Redraw FEN layout coordinates
          syncPiecesFromFen(stateRef.current.fen);

          // Locate piece mesh group to initiate 3D sliding transition
          const targetPieceObj = activePieces.find((p) => p.square === mv.to);
          if (targetPieceObj) {
            activeSlide = {
              group: targetPieceObj.group,
              startX: fX,
              startZ: fZ,
              endX: tX,
              endZ: tZ,
              progress: 0,
            };
          }
        } else {
          syncPiecesFromFen(stateRef.current.fen);
        }
      }

      // 1. Process Sliding Piece Arc Animation
      if (activeSlide) {
        activeSlide.progress += 0.09; // speed
        if (activeSlide.progress >= 1.0) {
          activeSlide.group.position.x = activeSlide.endX;
          activeSlide.group.position.z = activeSlide.endZ;
          activeSlide.group.position.y = 0.01; // Rest
          activeSlide = null;
        } else {
          const t = activeSlide.progress;
          // Linear interpolation for XZ
          activeSlide.group.position.x = THREE.MathUtils.lerp(activeSlide.startX, activeSlide.endX, t);
          activeSlide.group.position.z = THREE.MathUtils.lerp(activeSlide.startZ, activeSlide.endZ, t);
          // Set organic arc jump path on Y axis
          activeSlide.group.position.y = 0.01 + Math.sin(t * Math.PI) * 1.1;
        }
      }

      // 2. Animate and Decay Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        p.velocity.y -= 0.12; // simulated gravity

        p.mesh.position.addScaledVector(p.velocity, 0.012);

        // bounce off chess board level nicely
        if (p.mesh.position.y < 0) {
          p.mesh.position.y = 0;
          p.velocity.y *= -0.25; // damp
        }

        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = p.life;

        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          mat.dispose();
          particles.splice(i, 1);
        }
      }

      // 3. Highlight Board Squares based on stateRef
      const sSel = stateRef.current.selectedSquare;
      const sVal = stateRef.current.validMoves;
      const sLast = stateRef.current.lastMove;

      squareMeshes.forEach((sq) => {
        const algebraic = coordsToSquare(sq.row, sq.col);
        const mat = sq.mesh.material as THREE.MeshStandardMaterial;

        // Visual coloring hierarchy
        if (sSel === algebraic) {
          mat.color.set('#3b82f6'); // bright responsive blue for selection
        } else if (sVal.includes(algebraic)) {
          mat.color.set('#22c55e'); // emerald green target indicators
        } else if (sLast && (sLast.from === algebraic || sLast.to === algebraic)) {
          mat.color.set('#ca8a04'); // sunset gold for latest move tracers
        } else {
          mat.color.copy(sq.defaultColor);
        }
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvasElem.removeEventListener('pointerdown', handlePointerDown);
      canvasElem.removeEventListener('pointerup', handlePointerUp);
      canvasElem.removeEventListener('pointermove', handlePointerMove);

      // Clean geometry resources
      tableGeo.dispose();
      tableRimGeo.dispose();
      squareGeo.dispose();
      matLight.dispose();
      matDark.dispose();
      goldRimMat.dispose();
      woodMat.dispose();

      while (piecesGroup.children.length > 0) {
        piecesGroup.remove(piecesGroup.children[0]);
      }
      while (boardGroup.children.length > 0) {
        boardGroup.remove(boardGroup.children[0]);
      }

      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* 3D View Container */}
      <div ref={containerRef} className="relative w-full flex-grow min-h-[380px] bg-[#0b0f19]">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Dynamic Controls Layout overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            id="btn_auto_rotate"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
              autoRotate
                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="تدوير الكاميرا تلقائياً"
          >
            <Rotate3d className={`w-5 h-5 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn_reset_cam"
            onClick={() => {
              setYaw(playerColor === 'b' ? Math.PI : 0);
              setPitch(0.8);
              setZoom(10.5);
            }}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="إعادة ضبط الكاميرا"
          >
            <Maximize2 className="w-5 h-5" />
          </button>

          <button
            id="btn_help"
            onClick={() => setShowHelpers(!showHelpers)}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
              showHelpers
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Guides & Active Turn HUD Indicator */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none gap-2 z-10">
          <div className="p-2 px-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur text-xs text-slate-300 font-mono shadow-md">
            {playerColor === 'w' ? (
              <span className="text-emerald-400">● دور الأبيض (أنت)</span>
            ) : playerColor === 'b' ? (
              <span className="text-amber-400">● دور الأسود (أنت)</span>
            ) : (
              <span className="text-blue-400">● مشاهدة فقط</span>
            )}
          </div>

          <div className="p-2 px-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur text-xs text-slate-300 font-mono shadow-md">
            {turn === 'w' ? 'دور اللاعب الأبيض الإستراتيجي' : 'دور اللاعب الأسود التكتيكي'}
          </div>
        </div>

        {/* Interactive Guide Banner */}
        {showHelpers && (
          <div className="absolute top-4 left-4 p-3 max-w-[240px] rounded-xl bg-slate-900/90 border border-slate-800/80 backdrop-blur text-[11px] text-slate-300 leading-relaxed shadow-lg select-none z-10 pointer-events-auto">
            <h4 className="font-semibold text-blue-400 mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              أدوات التحكم ثلاثية الأبعاد:
            </h4>
            <p className="mb-1">🖱️ <b>تدوير اللوحة</b>: اسحب بالماوس أو الإصبع لتغيير زاوية العرض.</p>
            <p className="mb-1">👆 <b>نقل القطع</b>: اضغط على قطعة من لونك لتحديدها، ثم اضغط على المربع الملون بالأخضر.</p>
            <p className="border-t border-slate-800 pt-1 mt-1 text-slate-400 text-[10px]">
              اللون الأصفر يشير إلى آخر جولة تم لعبها. الأجرام والشرارات البصرية تظهر عند قنص القطع.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
