import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Rotate3d, Maximize2, Zap, HelpCircle, Lock, Unlock } from 'lucide-react';
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
  const [zoom, setZoom] = useState<number>(12.0); // camera distance (pulled back for complete board visibility)
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showHelpers, setShowHelpers] = useState<boolean>(true);
  const [cameraLocked, setCameraLocked] = useState<boolean>(true); // Locked by default for absolute stability on touch/drag

  // References to communicate with Three.js loops
  const stateRef = useRef({
    yaw: playerColor === 'b' ? Math.PI : 0,
    pitch: 0.8,
    zoom: 12.0,
    autoRotate: false,
    cameraLocked: true,
    selectedSquare: null as string | null,
    validMoves: [] as string[],
    playerColor: playerColor,
    fen: fen,
    lastMove: lastMove as LastMove | null,
    onMove: onMove,
    setSelectedSquare: setSelectedSquare,
  });

  // Sync props to stateRef
  useEffect(() => {
    stateRef.current.fen = fen;
    stateRef.current.playerColor = playerColor;
    stateRef.current.selectedSquare = selectedSquare;
    stateRef.current.validMoves = validMoves;
    stateRef.current.lastMove = lastMove;
    stateRef.current.onMove = onMove;
    stateRef.current.setSelectedSquare = setSelectedSquare;
  }, [fen, playerColor, selectedSquare, validMoves, lastMove, onMove, setSelectedSquare]);

  // Handle Drag / Pointer coordinates to rotate camera
  useEffect(() => {
    stateRef.current.yaw = yaw;
    stateRef.current.pitch = pitch;
    stateRef.current.zoom = zoom;
    stateRef.current.autoRotate = autoRotate;
    stateRef.current.cameraLocked = cameraLocked;
  }, [yaw, pitch, zoom, autoRotate, cameraLocked]);

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
        color: color === 'w' ? '#fafaf5' : '#1e1c19', // Elegant Warm Ivory and Rich Ebony Charcoal
        roughness: color === 'w' ? 0.08 : 0.12,
        metalness: color === 'w' ? 0.05 : 0.25,
        clearcoat: 0.9,
        clearcoatRoughness: 0.05,
      });

      // Luxurious golden trims highlighting majestic curves
      const metalBandMat = new THREE.MeshStandardMaterial({
        color: color === 'w' ? '#b45309' : '#fbbf24', // Amber gold and Bright yellow gold
        roughness: 0.08,
        metalness: 0.95,
      });

      // Slit or negative spacer material for the classic bishop mitre cut
      const cutoutMat = new THREE.MeshBasicMaterial({
        color: color === 'w' ? '#78716c' : '#030712',
      });

      // Proportional dimensions for realistic Staunton Chess set
      let rTop = 0.26;
      let rBot = 0.34;
      let bHeight = 0.12;
      let colRadius = 0.28;

      if (type === 'k') {
        rTop = 0.34; rBot = 0.42; bHeight = 0.15; colRadius = 0.37;
      } else if (type === 'q') {
        rTop = 0.32; rBot = 0.40; bHeight = 0.14; colRadius = 0.34;
      } else if (type === 'b') {
        rTop = 0.26; rBot = 0.34; bHeight = 0.13; colRadius = 0.29;
      } else if (type === 'n') {
        rTop = 0.26; rBot = 0.34; bHeight = 0.13; colRadius = 0.29;
      } else if (type === 'r') {
        rTop = 0.26; rBot = 0.34; bHeight = 0.13; colRadius = 0.29;
      } else if (type === 'p') {
        rTop = 0.20; rBot = 0.28; bHeight = 0.10; colRadius = 0.22;
      }

      // 1. Bottom master base (slanted with chamfer)
      const baseGeo = new THREE.CylinderGeometry(rTop, rBot, bHeight, 20);
      const basePiece = new THREE.Mesh(baseGeo, baseMat);
      basePiece.position.y = bHeight / 2;
      basePiece.castShadow = true;
      basePiece.receiveShadow = true;
      pGroup.add(basePiece);

      // 2. Middle decorative bead/fillet
      const stepGeo = new THREE.CylinderGeometry(rTop - 0.02, rTop, 0.045, 20);
      const baseStep = new THREE.Mesh(stepGeo, baseMat);
      baseStep.position.y = bHeight + 0.022;
      baseStep.castShadow = true;
      baseStep.receiveShadow = true;
      pGroup.add(baseStep);

      // 3. Shining gold accent collar separating base from stem
      const collarY = bHeight + 0.045 + 0.02;
      const collarGeo = new THREE.CylinderGeometry(colRadius, colRadius, 0.035, 20);
      const collar = new THREE.Mesh(collarGeo, metalBandMat);
      collar.position.y = collarY;
      collar.castShadow = true;
      collar.receiveShadow = true;
      pGroup.add(collar);

      switch (type) {
        case 'p': {
          // Pawn: Elegant curved lower torso cone + top neck band + classic sphere head
          const stemGeo = new THREE.CylinderGeometry(0.12, 0.20, 0.38, 16);
          const stem = new THREE.Mesh(stemGeo, baseMat);
          stem.position.y = collarY + 0.19; // center at Y=0.37
          stem.castShadow = true;
          stem.receiveShadow = true;
          pGroup.add(stem);

          // Top Neck Band
          const neckBandGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16);
          const neckBand = new THREE.Mesh(neckBandGeo, baseMat);
          neckBand.position.y = collarY + 0.38; // Y=0.56
          neckBand.castShadow = true;
          pGroup.add(neckBand);

          // Head pedestal
          const pedGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16);
          const ped = new THREE.Mesh(pedGeo, metalBandMat);
          ped.position.y = collarY + 0.41; // Y=0.59
          ped.castShadow = true;
          pGroup.add(ped);

          // Beautiful glossy head sphere
          const headGeo = new THREE.SphereGeometry(0.20, 24, 24);
          const head = new THREE.Mesh(headGeo, baseMat);
          head.position.y = collarY + 0.58; // Y=0.76
          head.castShadow = true;
          head.receiveShadow = true;
          pGroup.add(head);
          break;
        }

        case 'r': {
          // Rook: Castle tower column tapering thin at top + top flared capital + crenellated crown
          const columnGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.50, 20);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = collarY + 0.25; // center at Y=0.45
          column.castShadow = true;
          column.receiveShadow = true;
          pGroup.add(column);

          // Crown ring flare
          const capGeo = new THREE.CylinderGeometry(0.28, 0.21, 0.06, 20);
          const capital = new THREE.Mesh(capGeo, baseMat);
          capital.position.y = collarY + 0.53; // Y=0.73
          capital.castShadow = true;
          pGroup.add(capital);

          // Gold border below battlements
          const goldCapRingGeo = new THREE.CylinderGeometry(0.285, 0.285, 0.02, 20);
          const goldCapRing = new THREE.Mesh(goldCapRingGeo, metalBandMat);
          goldCapRing.position.y = collarY + 0.56; // Y=0.76
          pGroup.add(goldCapRing);

          // Castle Cup crown
          const crownGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 20);
          const crown = new THREE.Mesh(crownGeo, baseMat);
          crown.position.y = collarY + 0.65; // Y=0.85
          crown.castShadow = true;
          crown.receiveShadow = true;
          pGroup.add(crown);

          // Physical battlements/crenellations: 4 small rectangular columns on outer rim
          const cY = collarY + 0.73; // release Y=0.93
          const teethGeo = new THREE.BoxGeometry(0.08, 0.07, 0.08);

          // Front teeth
          const toothF = new THREE.Mesh(teethGeo, baseMat);
          toothF.position.set(0, cY, 0.21);
          toothF.castShadow = true;
          pGroup.add(toothF);

          // Back teeth
          const toothB = new THREE.Mesh(teethGeo, baseMat);
          toothB.position.set(0, cY, -0.21);
          toothB.castShadow = true;
          pGroup.add(toothB);

          // Left teeth
          const toothL = new THREE.Mesh(teethGeo, baseMat);
          toothL.position.set(-0.21, cY, 0);
          toothL.castShadow = true;
          pGroup.add(toothL);

          // Right teeth
          const toothR = new THREE.Mesh(teethGeo, baseMat);
          toothR.position.set(0.21, cY, 0);
          toothR.castShadow = true;
          pGroup.add(toothR);
          break;
        }

        case 'n': {
          // Knight: Exquisite organic handcrafted-looking horse silhouette (Staunton style)
          // Tilted arched chest cylinder
          const chestGeo = new THREE.CylinderGeometry(0.16, 0.25, 0.44, 16);
          const chest = new THREE.Mesh(chestGeo, baseMat);
          chest.position.set(0, collarY + 0.20, -0.04);
          chest.rotation.x = -0.12; // curve head forward
          chest.castShadow = true;
          chest.receiveShadow = true;
          pGroup.add(chest);

          // Muzzle snout pointing downwards elegantly forward
          const snoutGeo = new THREE.CylinderGeometry(0.10, 0.07, 0.32, 12);
          const snout = new THREE.Mesh(snoutGeo, baseMat);
          snout.position.set(0, collarY + 0.45, 0.12);
          snout.rotation.x = 0.62; // tilt down
          snout.castShadow = true;
          pGroup.add(snout);

          // Circular horse cheeks
          const cheekGeo = new THREE.SphereGeometry(0.13, 16, 16);
          const cheekL = new THREE.Mesh(cheekGeo, baseMat);
          cheekL.scale.set(1.0, 1.0, 0.35); // flatten to disk
          cheekL.position.set(-0.10, collarY + 0.36, 0.02);
          cheekL.castShadow = true;
          pGroup.add(cheekL);

          const cheekR = cheekL.clone();
          cheekR.position.x = 0.10;
          pGroup.add(cheekR);

          // Points representing high horse ears
          const earGeo = new THREE.ConeGeometry(0.04, 0.14, 8);
          const earL = new THREE.Mesh(earGeo, baseMat);
          earL.position.set(-0.07, collarY + 0.58, -0.05);
          earL.rotation.z = 0.1;
          earL.rotation.x = -0.15;
          earL.castShadow = true;
          pGroup.add(earL);

          const earR = earL.clone();
          earR.position.x = 0.07;
          earR.rotation.z = -0.1;
          pGroup.add(earR);

          // Distinctive horse mane on back of neck
          const maneGeo = new THREE.BoxGeometry(0.035, 0.30, 0.10);
          const mane = new THREE.Mesh(maneGeo, metalBandMat);
          mane.position.set(0, collarY + 0.24, -0.14);
          mane.rotation.x = -0.12;
          mane.castShadow = true;
          pGroup.add(mane);

          // Little gold rein detail to look extremely premium
          const reinGeo = new THREE.TorusGeometry(0.15, 0.015, 6, 16, Math.PI);
          const rein = new THREE.Mesh(reinGeo, metalBandMat);
          rein.position.set(0, collarY + 0.42, 0.08);
          rein.rotation.y = Math.PI / 2;
          rein.rotation.x = 0.3;
          pGroup.add(rein);
          break;
        }

        case 'b': {
          // Bishop: Slender stems + decorative spacer ring + pointed bishop mitre with visual slit
          const columnGeo = new THREE.CylinderGeometry(0.12, 0.21, 0.55, 16);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = collarY + 0.275; // center at Y=0.475
          column.castShadow = true;
          column.receiveShadow = true;
          pGroup.add(column);

          // Multi-layer collars separating the head mitre
          const neckRing1Geo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16);
          const neckRing1 = new THREE.Mesh(neckRing1Geo, baseMat);
          neckRing1.position.y = collarY + 0.57; // Y=0.77
          neckRing1.castShadow = true;
          pGroup.add(neckRing1);

          const goldRingGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16);
          const goldRing = new THREE.Mesh(goldRingGeo, metalBandMat);
          goldRing.position.y = collarY + 0.60; // Y=0.80
          pGroup.add(goldRing);

          // Pointed teardrop Bishop mitre sphere scaled vertically
          const mitreGeo = new THREE.SphereGeometry(0.195, 24, 24);
          const mitre = new THREE.Mesh(mitreGeo, baseMat);
          mitre.scale.set(1.0, 1.45, 1.0);
          mitre.position.y = collarY + 0.78; // Y=0.98
          mitre.castShadow = true;
          mitre.receiveShadow = true;
          pGroup.add(mitre);

          // Sliced bishop slit: dark cutout box overlay to construct authentic bishop cut
          const slitBoxGeo = new THREE.BoxGeometry(0.022, 0.25, 0.15);
          const slitBox = new THREE.Mesh(slitBoxGeo, cutoutMat);
          slitBox.position.set(0.07, collarY + 0.82, 0.04);
          slitBox.rotation.z = Math.PI / 5; // slant angle
          slitBox.rotation.y = Math.PI / 6;
          pGroup.add(slitBox);

          // Golden finial globule at the very top tip of the mitre
          const topGlobuleGeo = new THREE.SphereGeometry(0.048, 12, 12);
          const topGlobule = new THREE.Mesh(topGlobuleGeo, metalBandMat);
          topGlobule.position.y = collarY + 1.05; // Y=1.25
          topGlobule.castShadow = true;
          pGroup.add(topGlobule);
          break;
        }

        case 'q': {
          // Queen: Tall waisted stem + gold ornamental capital + flared crenellated crown + top orb
          const columnGeo = new THREE.CylinderGeometry(0.13, 0.24, 0.70, 20);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = collarY + 0.35; // center at Y=0.55
          column.castShadow = true;
          column.receiveShadow = true;
          pGroup.add(column);

          // Imperial Queen neck ring
          const neckGeo = new THREE.CylinderGeometry(0.23, 0.18, 0.05, 20);
          const neck = new THREE.Mesh(neckGeo, baseMat);
          neck.position.y = collarY + 0.72; // Y=0.92
          neck.castShadow = true;
          pGroup.add(neck);

          const goldNeckGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.025, 20);
          const goldNeck = new THREE.Mesh(goldNeckGeo, metalBandMat);
          goldNeck.position.y = collarY + 0.75; // Y=0.95
          goldNeck.castShadow = true;
          pGroup.add(goldNeck);

          // Flared crown / coronet cup
          const coronetGeo = new THREE.CylinderGeometry(0.27, 0.19, 0.20, 20);
          const coronet = new THREE.Mesh(coronetGeo, baseMat);
          coronet.position.y = collarY + 0.86; // Y=1.06
          coronet.castShadow = true;
          coronet.receiveShadow = true;
          pGroup.add(coronet);

          // Exquisite coronet crown beads (8 surrounding golden jewels typical for royalty)
          const beadGeo = new THREE.SphereGeometry(0.028, 8, 8);
          const bRadius = 0.24;
          const bY = collarY + 0.96; // Y=1.16

          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const bead = new THREE.Mesh(beadGeo, metalBandMat);
            bead.position.set(Math.cos(angle) * bRadius, bY, Math.sin(angle) * bRadius);
            bead.castShadow = true;
            pGroup.add(bead);
          }

          // Central royal orb at the top
          const centralOrbGeo = new THREE.SphereGeometry(0.06, 12, 12);
          const centralOrb = new THREE.Mesh(centralOrbGeo, metalBandMat);
          centralOrb.position.y = collarY + 0.97; // Y=1.17
          centralOrb.castShadow = true;
          pGroup.add(centralOrb);
          break;
        }

        case 'k': {
          // King: Tall, heavy column + sovereign capital + imperial crown pedestal + golden cross
          const columnGeo = new THREE.CylinderGeometry(0.15, 0.27, 0.80, 20);
          const column = new THREE.Mesh(columnGeo, baseMat);
          column.position.y = collarY + 0.40; // center Y=0.60
          column.castShadow = true;
          column.receiveShadow = true;
          pGroup.add(column);

          // Majestic collar
          const collarKingGeo = new THREE.CylinderGeometry(0.26, 0.20, 0.06, 20);
          const collarKing = new THREE.Mesh(collarKingGeo, baseMat);
          collarKing.position.y = collarY + 0.83; // Y=1.03
          collarKing.castShadow = true;
          pGroup.add(collarKing);

          const goldCollarKing = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 20), metalBandMat);
          goldCollarKing.position.y = collarY + 0.86; // Y=1.06
          goldCollarKing.castShadow = true;
          pGroup.add(goldCollarKing);

          // Pedestal dome representing monarch crown
          const domeGeo = new THREE.SphereGeometry(0.21, 16, 16);
          const dome = new THREE.Mesh(domeGeo, baseMat);
          dome.scale.set(1.0, 0.70, 1.0); // flat dome
          dome.position.y = collarY + 0.94; // Y=1.14
          dome.castShadow = true;
          pGroup.add(dome);

          // Slanted imperial crown rim cap
          const capGeo = new THREE.CylinderGeometry(0.23, 0.21, 0.10, 20);
          const cap = new THREE.Mesh(capGeo, baseMat);
          cap.position.y = collarY + 1.04; // Y=1.24
          cap.castShadow = true;
          pGroup.add(cap);

          // Sovereign Gold Cross Topper standing tall on top of the dome
          const crossGroup = new THREE.Group();
          crossGroup.position.set(0, collarY + 1.18, 0); // Y=1.38

          const vBarGeo = new THREE.BoxGeometry(0.045, 0.18, 0.045);
          const vBar = new THREE.Mesh(vBarGeo, metalBandMat);
          vBar.castShadow = true;
          crossGroup.add(vBar);

          const hBarGeo = new THREE.BoxGeometry(0.14, 0.045, 0.045);
          const hBar = new THREE.Mesh(hBarGeo, metalBandMat);
          hBar.position.y = 0.04; // vertically centered offset
          hBar.castShadow = true;
          crossGroup.add(hBar);

          pGroup.add(crossGroup);
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
            const logicalRow = 7 - r;
            const zPos = (3.5 - logicalRow) * 1.1; // row 0 ranks 8 at top (Z = -3.85)
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

    // Register Pointer Events for clicking or dragging pieces and squares
    let dragActive = false;
    let isDraggingPiece = false;
    let dragStartSquare: string | null = null;
    let initX = 0;
    let initY = 0;
    let downX = 0; // The true initial press X coordinate
    let downY = 0; // The true initial press Y coordinate

    const handlePointerDown = (e: PointerEvent) => {
      dragActive = true;
      initX = e.clientX;
      initY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      
      const sq = getRaycastSquare(e);
      dragStartSquare = sq;
      isDraggingPiece = false;
      
      if (sq) {
        const userColor = stateRef.current.playerColor;
        const pieceOnSq = activePieces.find((p) => p.square === sq);
        if (pieceOnSq && pieceOnSq.color === userColor && userColor !== null) {
          isDraggingPiece = true;
          // Pre-select this square on pointer down to make the drag feedback instantaneous
          stateRef.current.setSelectedSquare(sq);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragActive) return;
      if (e.cancelable) {
        e.preventDefault(); // prevent browser default scrolls on mobile while dragging board
      }
      
      // If we are dragging a piece OR camera is locked, don't spin the camera
      if (!isDraggingPiece && !stateRef.current.cameraLocked) {
        const dx = e.clientX - initX;
        const dy = e.clientY - initY;

        // Adjust camera yaw and pitch
        setYaw((y) => y - dx * 0.006);
        setPitch((p) => Math.max(0.12, Math.min(Math.PI / 2 - 0.08, p - dy * 0.006)));
      }

      initX = e.clientX;
      initY = e.clientY;
    };

    const handlePointerCancel = (e: PointerEvent) => {
      dragActive = false;
      isDraggingPiece = false;
      dragStartSquare = null;
    };

    const handlePointerUp = (e: PointerEvent) => {
      dragActive = false;
      const totalDelta = Math.hypot(e.clientX - downX, e.clientY - downY);
      const clickedSq = getRaycastSquare(e);

      // If they were actively dragging a piece and released it on a target square (drag-and-drop)
      if (isDraggingPiece && dragStartSquare && clickedSq && clickedSq !== dragStartSquare && totalDelta >= 15) {
        const valid = stateRef.current.validMoves;
        if (valid.includes(clickedSq)) {
          stateRef.current.onMove(dragStartSquare, clickedSq);
          stateRef.current.setSelectedSquare(null);
        } else {
          // If illegal square, reset selection
          stateRef.current.setSelectedSquare(null);
        }
      } else {
        // Fallback to Click-to-Move (taps or swift click-releases)
        if (totalDelta < 25) {
          if (clickedSq) {
            const selected = stateRef.current.selectedSquare;
            const valid = stateRef.current.validMoves;
            const userColor = stateRef.current.playerColor;

            // Check if it was a movement click to a valid candidate square
            if (selected && valid.includes(clickedSq)) {
              stateRef.current.onMove(selected, clickedSq);
              stateRef.current.setSelectedSquare(null);
            } else {
              // Else handle selection
              const pieceOnSq = activePieces.find((p) => p.square === clickedSq);
              if (pieceOnSq) {
                // Ensure player only highlights their own legal pieces
                if (userColor === null) {
                  stateRef.current.setSelectedSquare(null);
                } else if (pieceOnSq.color === userColor) {
                  stateRef.current.setSelectedSquare(clickedSq);
                } else {
                  stateRef.current.setSelectedSquare(null);
                }
              } else {
                stateRef.current.setSelectedSquare(null);
              }
            }
          } else {
            stateRef.current.setSelectedSquare(null);
          }
        }
      }

      isDraggingPiece = false;
      dragStartSquare = null;
    };

    const canvasElem = canvasRef.current;
    canvasElem.addEventListener('pointerdown', handlePointerDown);
    canvasElem.addEventListener('pointerup', handlePointerUp, { passive: true } as any);
    canvasElem.addEventListener('pointermove', handlePointerMove);
    canvasElem.addEventListener('pointercancel', handlePointerCancel);

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

      // Automatically adjust camera zoom factor depending on aspect ratio to fit the entire table/board neatly without cutting edges
      const aspect = w / h;
      if (aspect >= 1) {
        // Landscape wide screens: height is the limiting dimension. Expand slightly if container is short.
        stateRef.current.zoom = Math.max(12.0, 11.5 + (600 - h) * 0.008);
      } else {
        // Portrait narrow screens: width is the limiting dimension. Scale pull-back inversely with aspect ratio
        // to guarantee that the whole chessboard (width ~10) is always 100% visible on any small phone screen.
        stateRef.current.zoom = Math.max(12.5, 11.2 / aspect);
      }

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
      canvasElem.removeEventListener('pointercancel', handlePointerCancel);

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
      <div ref={containerRef} className="relative w-full flex-grow min-h-[250px] sm:min-h-[350px] md:min-h-[380px] bg-[#0b0f19]">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Dynamic Controls Layout overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            id="btn_lock_cam"
            onClick={() => setCameraLocked(!cameraLocked)}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
              cameraLocked
                ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/25'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title={cameraLocked ? "قفل اتجاه اللوحة (ثابت)" : "فتح زوايا الكاميرا (حر)"}
          >
            {cameraLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>

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
              setZoom(12.0);
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
