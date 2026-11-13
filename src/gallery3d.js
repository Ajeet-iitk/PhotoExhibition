import * as THREE from 'three';
import { featuredArtworks, wings } from './data/galleryData.js';
import { soundManager } from './audio/soundManager.js';

export class Gallery3D {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.onSelectArtwork = options.onSelectArtwork || (() => {});
    this.onWingChange = options.onWingChange || (() => {});
    this.onHoverArtwork = options.onHoverArtwork || (() => {});

    // State
    this.isNightMode = false;
    this.currentLanguage = options.language || 'en';
    this.isPointerLocked = false;
    this.isTourActive = false;
    this.tourProgress = 0;
    this.tourSpeed = 0.00035;
    this.activeArtwork = null;
    this.hoveredArtwork = null;

    // Movement state
    this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
    this.moveVector = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.userSpeed = 7.5;
    this.footstepDistance = 0;

    // Mobile touch joystick
    this.touchJoystick = { active: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 };
    this.touchLook = { active: false, lastX: 0, lastY: 0 };

    // Camera angles
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.minPolarAngle = 0.05;
    this.maxPolarAngle = Math.PI - 0.05;

    // Setup Three.js
    this.initScene();
    this.initLights();
    this.initArchitecture();
    this.initArtworks();
    this.initParticles();
    this.initTourPath();
    this.initEventListeners();

    // Start render loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f3ef);
    this.scene.fog = new THREE.FogExp2(0xf5f3ef, 0.015);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 1.7, 8); // Start in central rotunda facing entrance

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.artworkMeshes = [];
  }

  initLights() {
    this.lightsGroup = new THREE.Group();
    this.scene.add(this.lightsGroup);

    // Hemisphere light (sky & ground ambient)
    this.hemiLight = new THREE.HemisphereLight(0xfff8f0, 0xd0c8b8, 0.85);
    this.hemiLight.position.set(0, 20, 0);
    this.lightsGroup.add(this.hemiLight);

    // Main central directional sunlight / skylight
    this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    this.sunLight.position.set(10, 25, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 70;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0005;
    this.lightsGroup.add(this.sunLight);

    // Central Rotunda Chandelier / Crystal Glow
    this.crystalLight = new THREE.PointLight(0xffd700, 1.2, 18);
    this.crystalLight.position.set(0, 4.5, 0);
    this.lightsGroup.add(this.crystalLight);

    // Wing ambient spotlights
    this.wingSpotlights = [];
    const wingPositions = [
      { x: 26, y: 4.8, z: 0, color: 0xffeedd },   // East (Parents)
      { x: -26, y: 4.8, z: 0, color: 0xffeedd },  // West (Ajeet)
      { x: 0, y: 4.8, z: 26, color: 0xffeedd },   // South (Siblings)
      { x: 0, y: 4.8, z: -26, color: 0xffeedd }   // North (Vintage)
    ];

    wingPositions.forEach(pos => {
      const pLight = new THREE.PointLight(pos.color, 1.0, 22);
      pLight.position.set(pos.x, pos.y, pos.z);
      this.lightsGroup.add(pLight);
      this.wingSpotlights.push(pLight);
    });
  }

  // Generates procedural floor tile texture
  createFloorTexture(isNight = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base background
    ctx.fillStyle = isNight ? '#0f172a' : '#f8f6f0';
    ctx.fillRect(0, 0, 1024, 1024);

    // Large marble / parquet grid tiles
    const tileSize = 128;
    for (let x = 0; x < 1024; x += tileSize) {
      for (let y = 0; y < 1024; y += tileSize) {
        const isAlternate = (x / tileSize + y / tileSize) % 2 === 0;
        ctx.fillStyle = isNight
          ? (isAlternate ? '#1e293b' : '#0f172a')
          : (isAlternate ? '#ffffff' : '#f1ede4');
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        // Gilded/accent border for luxury museum feel
        ctx.strokeStyle = isNight ? 'rgba(56, 189, 248, 0.15)' : 'rgba(217, 119, 6, 0.15)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
  }

  initArchitecture() {
    this.architectureGroup = new THREE.Group();
    this.scene.add(this.architectureGroup);

    // 1. Grand Floor (covers full exhibition cross)
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(false),
      roughness: 0.25,
      metalness: 0.1
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.architectureGroup.add(this.floor);

    // 2. Ceiling & Vaulted Roofs
    const ceilingGeo = new THREE.PlaneGeometry(80, 80);
    this.ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xefede8,
      roughness: 0.8
    });
    this.ceiling = new THREE.Mesh(ceilingGeo, this.ceilingMat);
    this.ceiling.position.y = 5.2;
    this.ceiling.rotation.x = Math.PI / 2;
    this.architectureGroup.add(this.ceiling);

    // 3. Central Rotunda Skylight Dome Ring
    const domeGeo = new THREE.CylinderGeometry(14, 14, 0.6, 32, 1, true);
    this.domeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.6
    });
    const domeRing = new THREE.Mesh(domeGeo, this.domeMat);
    domeRing.position.y = 5.0;
    this.architectureGroup.add(domeRing);

    // Glass dome center
    const glassGeo = new THREE.CircleGeometry(13.8, 32);
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.85,
      opacity: 0.6,
      transparent: true,
      roughness: 0.1,
      ior: 1.5
    });
    const glassDome = new THREE.Mesh(glassGeo, this.glassMat);
    glassDome.position.y = 5.3;
    glassDome.rotation.x = Math.PI / 2;
    this.architectureGroup.add(glassDome);

    // 4. Central Monument / Floating Crystal Memorial
    this.initCentralMonument();

    // 5. Walls & Corridors
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3f0e8,
      roughness: 0.75
    });
    this.accentWallMat = new THREE.MeshStandardMaterial({
      color: 0xe2dcd0,
      roughness: 0.6
    });

    this.buildMuseumWalls();
  }

  initCentralMonument() {
    this.monumentGroup = new THREE.Group();
    this.monumentGroup.position.set(0, 0, 0);

    // Pedestal base
    const baseGeo = new THREE.CylinderGeometry(2.4, 2.8, 0.5, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.2, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.receiveShadow = true;
    this.monumentGroup.add(base);

    // Secondary pedestal
    const subBaseGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.4, 8);
    const subBase = new THREE.Mesh(subBaseGeo, baseMat);
    subBase.position.y = 0.6;
    this.monumentGroup.add(subBase);

    // Floating Crystal
    const crystalGeo = new THREE.OctahedronGeometry(1.0, 0);
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xd97706,
      emissiveIntensity: 0.5
    });
    this.crystal = new THREE.Mesh(crystalGeo, this.crystalMat);
    this.crystal.position.y = 2.2;
    this.crystal.castShadow = true;
    this.monumentGroup.add(this.crystal);

    // Orbiting Golden Rings
    const ringGeo1 = new THREE.TorusGeometry(1.4, 0.04, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
    this.orbitRing1 = new THREE.Mesh(ringGeo1, ringMat);
    this.orbitRing1.position.y = 2.2;
    this.orbitRing1.rotation.x = Math.PI / 3;
    this.monumentGroup.add(this.orbitRing1);

    const ringGeo2 = new THREE.TorusGeometry(1.7, 0.03, 16, 64);
    this.orbitRing2 = new THREE.Mesh(ringGeo2, ringMat);
    this.orbitRing2.position.y = 2.2;
    this.orbitRing2.rotation.y = Math.PI / 4;
    this.monumentGroup.add(this.orbitRing2);

    // Inscribed Brass Plaque on Base
    const plaqueGeo = new THREE.BoxGeometry(1.2, 0.35, 0.05);
    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.7, 1.82);
    plaque.rotation.x = -Math.PI / 12;
    this.monumentGroup.add(plaque);

    this.architectureGroup.add(this.monumentGroup);
  }

  buildMuseumWalls() {
    const wallHeight = 5.2;

    // Helper to add a wall box
    const addWall = (x, z, w, d, rotY = 0, mat = this.wallMat) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.architectureGroup.add(mesh);
      return mesh;
    };

    // Central Rotunda outer boundary wall segments (allowing 4 grand arched openings at 0, 90, 180, 270 deg)
    // 8 diagonal wall sections for the octagonal rotunda
    const rotundaRadius = 14.0;
    const angles = [Math.PI / 8, 3 * Math.PI / 8, 5 * Math.PI / 8, 7 * Math.PI / 8, 9 * Math.PI / 8, 11 * Math.PI / 8, 13 * Math.PI / 8, 15 * Math.PI / 8];
    angles.forEach((ang) => {
      const x = Math.sin(ang) * rotundaRadius;
      const z = Math.cos(ang) * rotundaRadius;
      addWall(x, z, 7.5, 0.6, ang + Math.PI / 2);
    });

    // Outer corridor walls for 4 Wings:
    // East Wing (Parents, X: +14 to +36, width 14m, walls at Z = +7 and Z = -7)
    addWall(25, -7.2, 24, 0.6); // North wall of East wing
    addWall(25, 7.2, 24, 0.6);  // South wall of East wing
    addWall(37, 0, 0.6, 15);    // East end wall

    // West Wing (Ajeet, X: -14 to -36, walls at Z = +7 and Z = -7)
    addWall(-25, -7.2, 24, 0.6);
    addWall(-25, 7.2, 24, 0.6);
    addWall(-37, 0, 0.6, 15);

    // South Wing (Siblings, Z: +14 to +36, walls at X = +7 and X = -7)
    addWall(-7.2, 25, 0.6, 24);
    addWall(7.2, 25, 0.6, 24);
    addWall(0, 37, 15, 0.6);

    // North Wing (Vintage & Heritage, Z: -14 to -36, walls at X = +7 and X = -7)
    addWall(-7.2, -25, 0.6, 24);
    addWall(7.2, -25, 0.6, 24);
    addWall(0, -37, 15, 0.6);

    // Architectural Pillars at Wing Entrances
    const pillarPositions = [
      [-5, -12], [5, -12], // North entrance
      [-5, 12], [5, 12],   // South entrance
      [-12, -5], [-12, 5], // West entrance
      [12, -5], [12, 5]    // East entrance
    ];
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, wallHeight, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2dcd0, roughness: 0.4 });
    pillarPositions.forEach(p => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(p[0], wallHeight / 2, p[1]);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.architectureGroup.add(pillar);
    });
  }

  // Load and mount all 36 3D Artworks with bevelled frames, matting, plaques, and spot-lighting
  initArtworks() {
    this.artworksGroup = new THREE.Group();
    this.scene.add(this.artworksGroup);

    const textureLoader = new THREE.TextureLoader();

    featuredArtworks.forEach((art, index) => {
      const artGroup = new THREE.Group();
      artGroup.position.set(art.position[0], art.position[1], art.position[2]);
      artGroup.rotation.set(art.rotation[0], art.rotation[1], art.rotation[2]);

      const w = art.width;
      const h = art.height;
      const frameDepth = 0.12;

      // 1. Picture Frame (Outer bevelled dark mahogany / black titanium)
      const frameGeo = new THREE.BoxGeometry(w + 0.35, h + 0.35, frameDepth);
      const frameMat = new THREE.MeshStandardMaterial({
        color: this.isNightMode ? 0x18181b : 0x2e1a0e,
        roughness: 0.35,
        metalness: 0.4
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.castShadow = true;
      artGroup.add(frameMesh);

      // 2. Golden Gilded Inner Bevel Trim
      const trimGeo = new THREE.BoxGeometry(w + 0.12, h + 0.12, frameDepth + 0.02);
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.85,
        roughness: 0.2
      });
      const trimMesh = new THREE.Mesh(trimGeo, trimMat);
      artGroup.add(trimMesh);

      // 3. Museum Matting (Off-white pass-partout board)
      const mattingGeo = new THREE.BoxGeometry(w + 0.06, h + 0.06, frameDepth + 0.03);
      const mattingMat = new THREE.MeshStandardMaterial({
        color: 0xfcfaf7,
        roughness: 0.95
      });
      const mattingMesh = new THREE.Mesh(mattingGeo, mattingMat);
      artGroup.add(mattingMesh);

      // 4. Photo Canvas Plane (Interactive clickable target)
      const canvasGeo = new THREE.PlaneGeometry(w, h);
      const photoMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.05
      });

      // Load texture with error fallback
      const imgPath = art.localUrl || art.remoteThumbUrl;
      textureLoader.load(
        imgPath,
        (tex) => {
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          photoMat.map = tex;
          photoMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Fallback to Google Drive CDN
          textureLoader.load(art.fullUrl, (fallbackTex) => {
            photoMat.map = fallbackTex;
            photoMat.needsUpdate = true;
          });
        }
      );

      const canvasMesh = new THREE.Mesh(canvasGeo, photoMat);
      canvasMesh.position.z = frameDepth / 2 + 0.02;
      canvasMesh.userData = { artwork: art, index };
      artGroup.add(canvasMesh);
      this.artworkMeshes.push(canvasMesh);

      // 5. Interactive Proximity Glow Halo (Hidden by default, lights up on focus)
      const glowGeo = new THREE.PlaneGeometry(w + 0.6, h + 0.6);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.z = -0.01;
      artGroup.add(glowMesh);
      artGroup.userData.glowMesh = glowMesh;

      // 6. Brass Name Plaque Mounted Below Frame
      const plaqueCanvas = document.createElement('canvas');
      plaqueCanvas.width = 512;
      plaqueCanvas.height = 128;
      const pctx = plaqueCanvas.getContext('2d');
      pctx.fillStyle = '#b45309';
      pctx.fillRect(0, 0, 512, 128);
      pctx.strokeStyle = '#fef3c7';
      pctx.lineWidth = 6;
      pctx.strokeRect(6, 6, 500, 116);
      pctx.fillStyle = '#ffffff';
      pctx.font = 'bold 36px "Segoe UI", sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText(`[ ${art.spot} ] ${art.title.en}`, 256, 54);
      pctx.fillStyle = '#fde68a';
      pctx.font = '24px "Segoe UI", sans-serif';
      pctx.fillText(art.category, 256, 96);

      const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
      const plaqueMeshGeo = new THREE.PlaneGeometry(w * 0.75, 0.35);
      const plaqueMeshMat = new THREE.MeshStandardMaterial({
        map: plaqueTex,
        metalness: 0.7,
        roughness: 0.3
      });
      const plaqueMesh = new THREE.Mesh(plaqueMeshGeo, plaqueMeshMat);
      plaqueMesh.position.set(0, -(h / 2 + 0.32), frameDepth / 2 + 0.01);
      artGroup.add(plaqueMesh);
      artGroup.userData.plaqueMesh = plaqueMesh;
      artGroup.userData.plaqueCanvas = plaqueCanvas;
      artGroup.userData.plaqueTex = plaqueTex;

      // 7. Focused Overhead Spotlight
      const spotLight = new THREE.SpotLight(0xfff5e6, 2.2, 10, Math.PI / 5, 0.4, 1.2);
      spotLight.position.set(0, (h / 2 + 0.8), frameDepth + 0.8);
      spotLight.target = canvasMesh;
      artGroup.add(spotLight);
      artGroup.add(spotLight.target);
      artGroup.userData.spotLight = spotLight;

      this.artworksGroup.add(artGroup);
    });
  }

  // Update plaques when language changes
  updatePlaqueLanguages(lang) {
    this.currentLanguage = lang;
    this.artworksGroup.children.forEach(group => {
      const mesh = group.children.find(c => c.userData && c.userData.artwork);
      if (!mesh) return;
      const art = mesh.userData.artwork;
      const plaqueCanvas = group.userData.plaqueCanvas;
      const plaqueTex = group.userData.plaqueTex;
      if (!plaqueCanvas || !plaqueTex) return;

      const pctx = plaqueCanvas.getContext('2d');
      pctx.fillStyle = '#b45309';
      pctx.fillRect(0, 0, 512, 128);
      pctx.strokeStyle = '#fef3c7';
      pctx.lineWidth = 6;
      pctx.strokeRect(6, 6, 500, 116);
      pctx.fillStyle = '#ffffff';
      pctx.font = 'bold 34px "Segoe UI", sans-serif';
      pctx.textAlign = 'center';
      const titleStr = art.title[lang] || art.title.en;
      pctx.fillText(`[ ${art.spot} ] ${titleStr}`, 256, 54);
      pctx.fillStyle = '#fde68a';
      pctx.font = '24px "Segoe UI", sans-serif';
      pctx.fillText(art.category, 256, 96);
      plaqueTex.needsUpdate = true;
    });
  }

  initParticles() {
    // Ambient floating dust motes / memory sparks
    const particleCount = 200;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 50;
      positions[i + 1] = Math.random() * 4.8 + 0.2;
      positions[i + 2] = (Math.random() - 0.5) * 50;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geo, this.particleMat);
    this.scene.add(this.particles);
  }

  initTourPath() {
    // CatmullRom spline path weaving through all 5 wings and rotunda
    const tourPoints = [
      new THREE.Vector3(0, 1.7, 8),     // Central entrance
      new THREE.Vector3(5, 1.7, 5),     // Central C-1
      new THREE.Vector3(8, 1.7, -4),    // Central East approach
      new THREE.Vector3(20, 1.7, 0),    // Parents Sanctuary entry
      new THREE.Vector3(26, 1.7, -4),   // Parents North wall
      new THREE.Vector3(26, 1.7, 4),    // Parents South wall
      new THREE.Vector3(16, 1.7, 0),    // Returning to center
      new THREE.Vector3(0, 1.7, 0),     // Rotunda Center monument
      new THREE.Vector3(0, 1.7, 18),    // Siblings entry
      new THREE.Vector3(-4, 1.7, 26),   // Siblings West wall
      new THREE.Vector3(4, 1.7, 26),    // Siblings East wall
      new THREE.Vector3(0, 1.7, 16),    // Leaving siblings
      new THREE.Vector3(-14, 1.7, 0),   // Approaching West Wing
      new THREE.Vector3(-26, 1.7, -4),  // Ajeet Milestones North
      new THREE.Vector3(-26, 1.7, 4),   // Ajeet Milestones South
      new THREE.Vector3(-14, 1.7, 0),   // Leaving Ajeet wing
      new THREE.Vector3(0, 1.7, -16),   // Entering North Heritage Vault
      new THREE.Vector3(-4, 1.7, -26),  // Vintage West
      new THREE.Vector3(4, 1.7, -26),   // Vintage East
      new THREE.Vector3(0, 1.7, -12),   // Exiting vintage
      new THREE.Vector3(0, 1.7, 8)      // Back to Grand Rotunda
    ];

    this.tourCurve = new THREE.CatmullRomCurve3(tourPoints, true);
  }

  // Day & Night mode smooth transition
  setNightMode(isNight) {
    this.isNightMode = isNight;
    const targetBg = isNight ? 0x090d16 : 0xf5f3ef;
    const targetFog = isNight ? 0x090d16 : 0xf5f3ef;

    this.scene.background.set(targetBg);
    this.scene.fog.color.set(targetFog);

    if (isNight) {
      this.hemiLight.color.set(0x38bdf8);
      this.hemiLight.groundColor.set(0x0284c7);
      this.hemiLight.intensity = 0.35;
      this.sunLight.color.set(0x818cf8);
      this.sunLight.intensity = 0.45;
      this.crystalLight.color.set(0x38bdf8);
      this.crystalLight.intensity = 2.0;

      this.wallMat.color.set(0x1e293b);
      this.ceilingMat.color.set(0x0f172a);
      this.floorMat.map = this.createFloorTexture(true);
      this.floorMat.needsUpdate = true;
      this.particleMat.color.set(0x38bdf8);
    } else {
      this.hemiLight.color.set(0xfff8f0);
      this.hemiLight.groundColor.set(0xd0c8b8);
      this.hemiLight.intensity = 0.85;
      this.sunLight.color.set(0xfffaf0);
      this.sunLight.intensity = 1.2;
      this.crystalLight.color.set(0xffd700);
      this.crystalLight.intensity = 1.2;

      this.wallMat.color.set(0xf3f0e8);
      this.ceilingMat.color.set(0xefede8);
      this.floorMat.map = this.createFloorTexture(false);
      this.floorMat.needsUpdate = true;
      this.particleMat.color.set(0xf59e0b);
    }
  }

  teleportToWing(wingId) {
    const wing = wings.find(w => w.id === wingId);
    if (!wing) return;

    soundManager.playTeleport();
    this.isTourActive = false;

    // Smooth transition
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(wing.teleport.x, wing.teleport.y, wing.teleport.z);
    const lookAtPos = new THREE.Vector3(wing.teleport.lookAt.x, wing.teleport.lookAt.y, wing.teleport.lookAt.z);

    let progress = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    const animStep = (now) => {
      progress = Math.min(1, (now - startTime) / duration);
      // smooth easeInOutCubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.camera.lookAt(lookAtPos);

      // sync euler
      this.euler.setFromQuaternion(this.camera.quaternion);

      if (progress < 1) {
        requestAnimationFrame(animStep);
      } else {
        this.camera.position.copy(endPos);
        this.onWingChange(wing);
      }
    };
    requestAnimationFrame(animStep);
  }

  teleportToSpot(spotId) {
    const art = featuredArtworks.find(a => a.spot === spotId);
    if (!art) return;

    soundManager.playTeleport();
    this.isTourActive = false;

    // Stand 2.8 meters in front of the painting looking directly at it
    const artPos = new THREE.Vector3(art.position[0], art.position[1], art.position[2]);
    const rotY = art.rotation[1];
    const offsetDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const targetCamPos = artPos.clone().add(offsetDir.multiplyScalar(2.8));
    targetCamPos.y = 1.7;

    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(artPos);
    this.euler.setFromQuaternion(this.camera.quaternion);
  }

  toggleGuidedTour() {
    this.isTourActive = !this.isTourActive;
    return this.isTourActive;
  }

  initEventListeners() {
    // Keyboard handlers
    window.addEventListener('keydown', (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        this.keys[e.key.toLowerCase()] = true;
        this.keys[e.key] = true;
        if (this.isTourActive) this.isTourActive = false;
      }
      if (e.key === 'e' || e.key === 'E') {
        if (this.hoveredArtwork) {
          this.selectArtwork(this.hoveredArtwork);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        this.keys[e.key.toLowerCase()] = false;
        this.keys[e.key] = false;
      }
    });

    // Mouse movement (drag look & pointer lock)
    this.isMouseDown = false;
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.mouseStartX = e.clientX;
        this.mouseStartY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      // Raycasting for hover
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkArtworkHover();

      // Look rotation
      if (this.isPointerLocked) {
        this.euler.y -= e.movementX * 0.0022;
        this.euler.x -= e.movementY * 0.0022;
        this.euler.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
      } else if (this.isMouseDown) {
        const deltaX = e.clientX - this.mouseStartX;
        const deltaY = e.clientY - this.mouseStartY;
        this.mouseStartX = e.clientX;
        this.mouseStartY = e.clientY;

        this.euler.y -= deltaX * 0.0025;
        this.euler.x -= deltaY * 0.0025;
        this.euler.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
      }
    });

    // Click to inspect artwork
    this.renderer.domElement.addEventListener('click', (e) => {
      if (this.hoveredArtwork) {
        this.selectArtwork(this.hoveredArtwork);
      }
    });

    // Resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  checkArtworkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.artworkMeshes);

    if (intersects.length > 0 && intersects[0].distance < 8.0) {
      const hit = intersects[0].object;
      const art = hit.userData.artwork;
      if (this.hoveredArtwork !== art) {
        this.hoveredArtwork = art;
        this.onHoverArtwork(art);
        // Highlight glow
        const group = hit.parent;
        if (group && group.userData.glowMesh) {
          group.userData.glowMesh.material.opacity = 0.55;
        }
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredArtwork) {
        // Reset old glow
        this.artworksGroup.children.forEach(g => {
          if (g.userData.glowMesh) g.userData.glowMesh.material.opacity = 0;
        });
        this.hoveredArtwork = null;
        this.onHoverArtwork(null);
        document.body.style.cursor = 'default';
      }
    }
  }

  selectArtwork(art) {
    soundManager.playCameraShutter();
    this.activeArtwork = art;
    this.onSelectArtwork(art);
  }

  // Update physical movement & collision bounds
  updateMovement(delta) {
    if (this.isTourActive) {
      // Advance along tour path
      this.tourProgress += this.tourSpeed * (delta * 60);
      if (this.tourProgress > 1) this.tourProgress = 0;

      const currentPos = this.tourCurve.getPointAt(this.tourProgress);
      const lookPos = this.tourCurve.getPointAt((this.tourProgress + 0.02) % 1);

      this.camera.position.copy(currentPos);
      this.camera.lookAt(lookPos);
      this.euler.setFromQuaternion(this.camera.quaternion);

      // Footstep audio during tour
      this.footstepDistance += delta * 4;
      if (this.footstepDistance > 1.8) {
        soundManager.playFootstep();
        this.footstepDistance = 0;
      }
      return;
    }

    // Normal player movement
    this.moveVector.set(0, 0, 0);

    // Keyboard inputs
    if (this.keys.w || this.keys.ArrowUp) this.moveVector.z -= 1;
    if (this.keys.s || this.keys.ArrowDown) this.moveVector.z += 1;
    if (this.keys.a || this.keys.ArrowLeft) this.moveVector.x -= 1;
    if (this.keys.d || this.keys.ArrowRight) this.moveVector.x += 1;

    // Mobile touch joystick input
    if (this.touchJoystick.active) {
      this.moveVector.x += this.touchJoystick.deltaX;
      this.moveVector.z += this.touchJoystick.deltaY;
    }

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize();

      // Transform according to camera yaw (Y rotation)
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.euler.y);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.euler.y);

      const displacement = new THREE.Vector3()
        .addScaledVector(forward, -this.moveVector.z)
        .addScaledVector(right, this.moveVector.x)
        .multiplyScalar(this.userSpeed * delta);

      const nextPos = this.camera.position.clone().add(displacement);

      // Collision boundaries (cross shape gallery)
      // Rotunda: within radius 13.5
      // East Wing: X in [0, 36], Z in [-6.5, 6.5]
      // West Wing: X in [-36, 0], Z in [-6.5, 6.5]
      // South Wing: Z in [0, 36], X in [-6.5, 6.5]
      // North Wing: Z in [-36, 0], X in [-6.5, 6.5]
      const distFromCenter = Math.hypot(nextPos.x, nextPos.z);
      const inRotunda = distFromCenter < 13.2;
      const inEast = nextPos.x >= 0 && nextPos.x <= 35.5 && Math.abs(nextPos.z) <= 6.3;
      const inWest = nextPos.x <= 0 && nextPos.x >= -35.5 && Math.abs(nextPos.z) <= 6.3;
      const inSouth = nextPos.z >= 0 && nextPos.z <= 35.5 && Math.abs(nextPos.x) <= 6.3;
      const inNorth = nextPos.z <= 0 && nextPos.z >= -35.5 && Math.abs(nextPos.x) <= 6.3;

      if (inRotunda || inEast || inWest || inSouth || inNorth) {
        this.camera.position.copy(nextPos);

        // Footstep cadence
        this.footstepDistance += displacement.length();
        if (this.footstepDistance > 1.8) {
          soundManager.playFootstep();
          this.footstepDistance = 0;
        }
      }
    }

    // Keep human eye height fixed at 1.7m
    this.camera.position.y = 1.7;
  }

  // Determine which wing the player is currently inside
  getCurrentWing() {
    const x = this.camera.position.x;
    const z = this.camera.position.z;

    if (x > 12) return wings.find(w => w.id === 'parents');
    if (x < -12) return wings.find(w => w.id === 'ajeet');
    if (z > 12) return wings.find(w => w.id === 'siblings');
    if (z < -12) return wings.find(w => w.id === 'vintage');
    return wings.find(w => w.id === 'central');
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update player movement
    this.updateMovement(delta);

    // Animate central crystal & rings
    if (this.crystal) {
      this.crystal.rotation.y += delta * 0.6;
      this.crystal.position.y = 2.2 + Math.sin(this.clock.getElapsedTime() * 1.5) * 0.12;
    }
    if (this.orbitRing1) this.orbitRing1.rotation.z += delta * 0.4;
    if (this.orbitRing2) this.orbitRing2.rotation.x -= delta * 0.35;

    // Animate dust particles
    if (this.particles) {
      this.particles.rotation.y += delta * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
