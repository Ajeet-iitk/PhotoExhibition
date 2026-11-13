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
    this.onTourStopChange = options.onTourStopChange || (() => {});

    // State
    this.isNightMode = false;
    this.currentLanguage = options.language || 'en';
    this.isPointerLocked = false;
    this.activeArtwork = null;
    this.hoveredArtwork = null;

    // Smooth Free-Roam Movement state
    this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
    this.moveVector = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.maxSpeed = 6.5;
    this.footstepDistance = 0;

    // Mobile touch joystick
    this.touchJoystick = { active: false, deltaX: 0, deltaY: 0 };
    this.touchLook = { active: false, lastX: 0, lastY: 0 };

    // Camera angles & smooth orientation
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.targetEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.targetQuaternion = new THREE.Quaternion();
    this.currentQuaternion = new THREE.Quaternion();

    // Cinematic Tour Engine State
    this.isTourActive = false;
    this.isTourPaused = false;
    this.tourStopIndex = 0;
    this.tourPhase = 'gliding'; // 'gliding' | 'viewing'
    this.tourTransitionTime = 0;
    this.tourTotalTransitionTime = 3.0; // seconds
    this.tourViewTime = 0;
    this.tourTotalViewTime = 3.6; // seconds viewing painting
    this.tourStartPos = new THREE.Vector3();
    this.tourEndPos = new THREE.Vector3();
    this.tourStartQuat = new THREE.Quaternion();
    this.tourEndQuat = new THREE.Quaternion();

    // Setup Three.js
    this.initScene();
    this.initLights();
    this.initArchitecture();
    this.initArtworks();
    this.initParticles();
    this.initTourWaypoints();
    this.initEventListeners();

    // Start render loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f3ef);
    this.scene.fog = new THREE.FogExp2(0xf5f3ef, 0.014);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 1.7, 7.5);
    this.camera.rotation.y = Math.PI; // Face inward toward rotunda

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.artworkMeshes = [];
  }

  initLights() {
    this.lightsGroup = new THREE.Group();
    this.scene.add(this.lightsGroup);

    // Hemisphere light
    this.hemiLight = new THREE.HemisphereLight(0xfff8f0, 0xd0c8b8, 0.9);
    this.hemiLight.position.set(0, 20, 0);
    this.lightsGroup.add(this.hemiLight);

    // Main directional sunlight
    this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.25);
    this.sunLight.position.set(12, 24, 14);
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

    // Central Rotunda Chandelier
    this.crystalLight = new THREE.PointLight(0xffd700, 1.3, 20);
    this.crystalLight.position.set(0, 4.5, 0);
    this.lightsGroup.add(this.crystalLight);

    // 4 Wing ambient lights
    this.wingSpotlights = [];
    const wingPositions = [
      { x: 26, y: 4.8, z: 0, color: 0xffeedd },   // East (Parents)
      { x: -26, y: 4.8, z: 0, color: 0xffeedd },  // West (Ajeet)
      { x: 0, y: 4.8, z: 26, color: 0xffeedd },   // South (Siblings)
      { x: 0, y: 4.8, z: -26, color: 0xffeedd }   // North (Vintage)
    ];

    wingPositions.forEach(pos => {
      const pLight = new THREE.PointLight(pos.color, 1.1, 24);
      pLight.position.set(pos.x, pos.y, pos.z);
      this.lightsGroup.add(pLight);
      this.wingSpotlights.push(pLight);
    });
  }

  createFloorTexture(isNight = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isNight ? '#0b1120' : '#f8f6f0';
    ctx.fillRect(0, 0, 1024, 1024);

    const tileSize = 128;
    for (let x = 0; x < 1024; x += tileSize) {
      for (let y = 0; y < 1024; y += tileSize) {
        const isAlternate = (x / tileSize + y / tileSize) % 2 === 0;
        ctx.fillStyle = isNight
          ? (isAlternate ? '#1e293b' : '#0f172a')
          : (isAlternate ? '#ffffff' : '#f1ede4');
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        ctx.strokeStyle = isNight ? 'rgba(56, 189, 248, 0.18)' : 'rgba(217, 119, 6, 0.18)';
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

    // Floor
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(false),
      roughness: 0.22,
      metalness: 0.12
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.architectureGroup.add(this.floor);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(80, 80);
    this.ceilingMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.85 });
    this.ceiling = new THREE.Mesh(ceilingGeo, this.ceilingMat);
    this.ceiling.position.y = 5.2;
    this.ceiling.rotation.x = Math.PI / 2;
    this.architectureGroup.add(this.ceiling);

    // Central Dome Ring
    const domeGeo = new THREE.CylinderGeometry(14, 14, 0.6, 32, 1, true);
    this.domeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.6 });
    const domeRing = new THREE.Mesh(domeGeo, this.domeMat);
    domeRing.position.y = 5.0;
    this.architectureGroup.add(domeRing);

    // Glass Skylight
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

    // Monument & Walls
    this.initCentralMonument();

    this.wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.75 });
    this.buildMuseumWalls();
  }

  initCentralMonument() {
    this.monumentGroup = new THREE.Group();
    this.monumentGroup.position.set(0, 0, 0);

    const baseGeo = new THREE.CylinderGeometry(2.4, 2.8, 0.5, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.2, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.receiveShadow = true;
    this.monumentGroup.add(base);

    const subBaseGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.4, 8);
    const subBase = new THREE.Mesh(subBaseGeo, baseMat);
    subBase.position.y = 0.6;
    this.monumentGroup.add(subBase);

    const crystalGeo = new THREE.OctahedronGeometry(1.0, 0);
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xd97706,
      emissiveIntensity: 0.55
    });
    this.crystal = new THREE.Mesh(crystalGeo, this.crystalMat);
    this.crystal.position.y = 2.2;
    this.crystal.castShadow = true;
    this.monumentGroup.add(this.crystal);

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

    this.architectureGroup.add(this.monumentGroup);
  }

  buildMuseumWalls() {
    const wallHeight = 5.2;

    const addWall = (x, z, w, d, rotY = 0) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, this.wallMat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.architectureGroup.add(mesh);
    };

    // Rotunda octagonal perimeter
    const rotundaRadius = 14.0;
    const angles = [Math.PI / 8, 3 * Math.PI / 8, 5 * Math.PI / 8, 7 * Math.PI / 8, 9 * Math.PI / 8, 11 * Math.PI / 8, 13 * Math.PI / 8, 15 * Math.PI / 8];
    angles.forEach((ang) => {
      const x = Math.sin(ang) * rotundaRadius;
      const z = Math.cos(ang) * rotundaRadius;
      addWall(x, z, 7.5, 0.6, ang + Math.PI / 2);
    });

    // 4 Wing outer boundaries
    addWall(25, -7.2, 24, 0.6); // East North
    addWall(25, 7.2, 24, 0.6);  // East South
    addWall(37, 0, 0.6, 15);    // East End

    addWall(-25, -7.2, 24, 0.6); // West North
    addWall(-25, 7.2, 24, 0.6);  // West South
    addWall(-37, 0, 0.6, 15);    // West End

    addWall(-7.2, 25, 0.6, 24); // South West
    addWall(7.2, 25, 0.6, 24);  // South East
    addWall(0, 37, 15, 0.6);    // South End

    addWall(-7.2, -25, 0.6, 24); // North West
    addWall(7.2, -25, 0.6, 24);  // North East
    addWall(0, -37, 15, 0.6);    // North End
  }

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

      // Frame
      const frameGeo = new THREE.BoxGeometry(w + 0.35, h + 0.35, frameDepth);
      const frameMat = new THREE.MeshStandardMaterial({
        color: this.isNightMode ? 0x18181b : 0x2e1a0e,
        roughness: 0.35,
        metalness: 0.4
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.castShadow = true;
      artGroup.add(frameMesh);

      // Gilded Trim
      const trimGeo = new THREE.BoxGeometry(w + 0.12, h + 0.12, frameDepth + 0.02);
      const trimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
      const trimMesh = new THREE.Mesh(trimGeo, trimMat);
      artGroup.add(trimMesh);

      // Matting
      const mattingGeo = new THREE.BoxGeometry(w + 0.06, h + 0.06, frameDepth + 0.03);
      const mattingMat = new THREE.MeshStandardMaterial({ color: 0xfcfaf7, roughness: 0.95 });
      const mattingMesh = new THREE.Mesh(mattingGeo, mattingMat);
      artGroup.add(mattingMesh);

      // Photo Canvas
      const canvasGeo = new THREE.PlaneGeometry(w, h);
      const photoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.05 });

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

      // Glow Halo
      const glowGeo = new THREE.PlaneGeometry(w + 0.6, h + 0.6);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.z = -0.01;
      artGroup.add(glowMesh);
      artGroup.userData.glowMesh = glowMesh;

      // Brass Name Plaque
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
      const plaqueMeshMat = new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.7, roughness: 0.3 });
      const plaqueMesh = new THREE.Mesh(plaqueMeshGeo, plaqueMeshMat);
      plaqueMesh.position.set(0, -(h / 2 + 0.32), frameDepth / 2 + 0.01);
      artGroup.add(plaqueMesh);
      artGroup.userData.plaqueMesh = plaqueMesh;
      artGroup.userData.plaqueCanvas = plaqueCanvas;
      artGroup.userData.plaqueTex = plaqueTex;

      // Overhead Spotlight
      const spotLight = new THREE.SpotLight(0xfff5e6, 2.2, 10, Math.PI / 5, 0.4, 1.2);
      spotLight.position.set(0, (h / 2 + 0.8), frameDepth + 0.8);
      spotLight.target = canvasMesh;
      artGroup.add(spotLight);
      artGroup.add(spotLight.target);
      artGroup.userData.spotLight = spotLight;

      this.artworksGroup.add(artGroup);
    });
  }

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

  // Curated Cinematic Tour Waypoints:
  // Instead of a blind wild spline, the tour visits signature artworks with smooth glides & pauses!
  initTourWaypoints() {
    const stopsList = [
      'C-1', 'C-3', 'C-5', 'C-7', // Central Rotunda
      'P-1', 'P-3', 'P-5', 'P-7', // Parents Sanctuary
      'S-1', 'S-3', 'S-5', 'S-7', // Sibling Chronicles
      'A-1', 'A-2', 'A-4', 'A-6', // Ajeet Milestones
      'V-1', 'V-3', 'V-4', 'V-6'  // Heritage Vault
    ];

    this.tourWaypoints = [];

    stopsList.forEach(spot => {
      const art = featuredArtworks.find(a => a.spot === spot);
      if (!art) return;

      const artPos = new THREE.Vector3(art.position[0], art.position[1], art.position[2]);
      const rotY = art.rotation[1];
      // Stand 2.8m in front of the artwork looking directly at the painting center
      const offsetDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
      const camPos = artPos.clone().add(offsetDir.multiplyScalar(2.9));
      camPos.y = 1.7;

      // Compute exact orientation facing the artwork
      const tempCam = new THREE.PerspectiveCamera();
      tempCam.position.copy(camPos);
      tempCam.lookAt(artPos);
      const quat = tempCam.quaternion.clone();

      this.tourWaypoints.push({
        spot,
        artwork: art,
        camPos,
        lookTarget: artPos,
        quaternion: quat
      });
    });
  }

  startTour(startIndex = 0) {
    this.isTourActive = true;
    this.isTourPaused = false;
    this.tourStopIndex = startIndex % this.tourWaypoints.length;
    this.setupTourLeg(this.camera.position.clone(), this.camera.quaternion.clone(), this.tourWaypoints[this.tourStopIndex]);
  }

  stopTour() {
    this.isTourActive = false;
    this.isTourPaused = false;
    // reset glows
    this.artworksGroup.children.forEach(g => {
      if (g.userData.glowMesh) g.userData.glowMesh.material.opacity = 0;
    });
    this.onTourStopChange(null);
  }

  toggleGuidedTour() {
    if (this.isTourActive) {
      this.stopTour();
      return false;
    } else {
      this.startTour(0);
      return true;
    }
  }

  nextTourStop() {
    if (!this.isTourActive) return;
    this.tourStopIndex = (this.tourStopIndex + 1) % this.tourWaypoints.length;
    this.setupTourLeg(this.camera.position.clone(), this.camera.quaternion.clone(), this.tourWaypoints[this.tourStopIndex]);
  }

  prevTourStop() {
    if (!this.isTourActive) return;
    this.tourStopIndex = (this.tourStopIndex - 1 + this.tourWaypoints.length) % this.tourWaypoints.length;
    this.setupTourLeg(this.camera.position.clone(), this.camera.quaternion.clone(), this.tourWaypoints[this.tourStopIndex]);
  }

  setupTourLeg(fromPos, fromQuat, targetWaypoint) {
    this.tourPhase = 'gliding';
    this.tourTransitionTime = 0;

    // Reset old glow
    this.artworksGroup.children.forEach(g => {
      if (g.userData.glowMesh) g.userData.glowMesh.material.opacity = 0;
    });

    this.tourStartPos.copy(fromPos);
    this.tourEndPos.copy(targetWaypoint.camPos);
    this.tourStartQuat.copy(fromQuat);
    this.tourEndQuat.copy(targetWaypoint.quaternion);

    // Compute distance to set a smooth, comfortable glide speed
    const dist = this.tourStartPos.distanceTo(this.tourEndPos);
    this.tourTotalTransitionTime = Math.max(2.2, Math.min(4.5, dist * 0.16));

    this.onTourStopChange({
      spot: targetWaypoint.spot,
      artwork: targetWaypoint.artwork,
      index: this.tourStopIndex + 1,
      total: this.tourWaypoints.length,
      phase: 'gliding'
    });
  }

  updateCinematicTour(delta) {
    if (!this.isTourActive || this.isTourPaused) return;

    const currentWaypoint = this.tourWaypoints[this.tourStopIndex];
    if (!currentWaypoint) return;

    if (this.tourPhase === 'gliding') {
      this.tourTransitionTime += delta;
      const progress = Math.min(1.0, this.tourTransitionTime / this.tourTotalTransitionTime);

      // Smooth Quintic Ease-In-Out for buttery cinematic motion
      const ease = progress < 0.5
        ? 16 * Math.pow(progress, 5)
        : 1 - Math.pow(-2 * progress + 2, 5) / 2;

      // Smooth Position Interpolation
      this.camera.position.lerpVectors(this.tourStartPos, this.tourEndPos, ease);

      // Smooth Rotation Slerp
      this.camera.quaternion.slerpQuaternions(this.tourStartQuat, this.tourEndQuat, ease);

      // Footstep audio during travel
      this.footstepDistance += delta * 3.5;
      if (this.footstepDistance > 1.8) {
        soundManager.playFootstep();
        this.footstepDistance = 0;
      }

      if (progress >= 1.0) {
        this.camera.position.copy(this.tourEndPos);
        this.camera.quaternion.copy(this.tourEndQuat);
        this.euler.setFromQuaternion(this.camera.quaternion);

        // Switch to Viewing Phase
        this.tourPhase = 'viewing';
        this.tourViewTime = 0;

        // Highlight the artwork being presented
        const mesh = this.artworkMeshes.find(m => m.userData && m.userData.artwork && m.userData.artwork.spot === currentWaypoint.spot);
        if (mesh && mesh.parent && mesh.parent.userData.glowMesh) {
          mesh.parent.userData.glowMesh.material.opacity = 0.65;
        }

        this.onTourStopChange({
          spot: currentWaypoint.spot,
          artwork: currentWaypoint.artwork,
          index: this.tourStopIndex + 1,
          total: this.tourWaypoints.length,
          phase: 'viewing'
        });
      }
    } else if (this.tourPhase === 'viewing') {
      this.tourViewTime += delta;

      // Gentle floating micro-motion while viewing (subtle luxury gallery feel)
      const drift = Math.sin(this.tourViewTime * 1.5) * 0.04;
      this.camera.position.y = 1.7 + drift;

      if (this.tourViewTime >= this.tourTotalViewTime) {
        // Advance to next showcase artwork!
        this.nextTourStop();
      }
    }
  }

  // Smooth Free-Roaming Movement with Wall-Sliding Physics
  updateFreeMovement(delta) {
    this.moveVector.set(0, 0, 0);

    if (this.keys.w || this.keys.ArrowUp) this.moveVector.z -= 1;
    if (this.keys.s || this.keys.ArrowDown) this.moveVector.z += 1;
    if (this.keys.a || this.keys.ArrowLeft) this.moveVector.x -= 1;
    if (this.keys.d || this.keys.ArrowRight) this.moveVector.x += 1;

    if (this.touchJoystick.active) {
      this.moveVector.x += this.touchJoystick.deltaX;
      this.moveVector.z += this.touchJoystick.deltaY;
    }

    // Apply Acceleration
    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize();

      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.euler.y);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.euler.y);

      const targetDir = new THREE.Vector3()
        .addScaledVector(forward, -this.moveVector.z)
        .addScaledVector(right, this.moveVector.x)
        .multiplyScalar(this.maxSpeed);

      // Smooth velocity acceleration
      this.velocity.lerp(targetDir, 1 - Math.exp(-12 * delta));
    } else {
      // Smooth deceleration/friction
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-10 * delta));
    }

    if (this.velocity.lengthSq() > 0.001) {
      const currentX = this.camera.position.x;
      const currentZ = this.camera.position.z;
      const nextX = currentX + this.velocity.x * delta;
      const nextZ = currentZ + this.velocity.z * delta;

      // Independent X and Z wall-sliding collision checks
      const canMoveX = this.isPositionInsideMuseum(nextX, currentZ);
      const canMoveZ = this.isPositionInsideMuseum(currentX, nextZ);

      if (canMoveX) this.camera.position.x = nextX;
      else this.velocity.x = 0;

      if (canMoveZ) this.camera.position.z = nextZ;
      else this.velocity.z = 0;

      // Footstep audio cadence
      const stepDist = Math.hypot(canMoveX ? this.velocity.x * delta : 0, canMoveZ ? this.velocity.z * delta : 0);
      this.footstepDistance += stepDist;
      if (this.footstepDistance > 1.8) {
        soundManager.playFootstep();
        this.footstepDistance = 0;
      }
    }

    this.camera.position.y = 1.7;
  }

  isPositionInsideMuseum(x, z) {
    const distFromCenter = Math.hypot(x, z);
    const inRotunda = distFromCenter < 13.2;
    const inEast = x >= 0 && x <= 35.5 && Math.abs(z) <= 6.3;
    const inWest = x <= 0 && x >= -35.5 && Math.abs(z) <= 6.3;
    const inSouth = z >= 0 && z <= 35.5 && Math.abs(x) <= 6.3;
    const inNorth = z <= 0 && z >= -35.5 && Math.abs(x) <= 6.3;

    // Obstacle: Don't walk through the center monument
    const inMonument = distFromCenter < 2.5;

    return (inRotunda || inEast || inWest || inSouth || inNorth) && !inMonument;
  }

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
      this.hemiLight.intensity = 0.9;
      this.sunLight.color.set(0xfffaf0);
      this.sunLight.intensity = 1.25;
      this.crystalLight.color.set(0xffd700);
      this.crystalLight.intensity = 1.3;

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
    this.stopTour();

    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(wing.teleport.x, wing.teleport.y, wing.teleport.z);
    const lookAtPos = new THREE.Vector3(wing.teleport.lookAt.x, wing.teleport.lookAt.y, wing.teleport.lookAt.z);

    const tempCam = new THREE.PerspectiveCamera();
    tempCam.position.copy(endPos);
    tempCam.lookAt(lookAtPos);
    const endQuat = tempCam.quaternion.clone();
    const startQuat = this.camera.quaternion.clone();

    let progress = 0;
    const duration = 750;
    const startTime = performance.now();

    const animStep = (now) => {
      progress = Math.min(1, (now - startTime) / duration);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.camera.quaternion.slerpQuaternions(startQuat, endQuat, ease);
      this.euler.setFromQuaternion(this.camera.quaternion);

      if (progress < 1) {
        requestAnimationFrame(animStep);
      } else {
        this.camera.position.copy(endPos);
        this.camera.quaternion.copy(endQuat);
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.onWingChange(wing);
      }
    };
    requestAnimationFrame(animStep);
  }

  teleportToSpot(spotId) {
    const art = featuredArtworks.find(a => a.spot === spotId);
    if (!art) return;

    soundManager.playTeleport();
    this.stopTour();

    const artPos = new THREE.Vector3(art.position[0], art.position[1], art.position[2]);
    const rotY = art.rotation[1];
    const offsetDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const targetCamPos = artPos.clone().add(offsetDir.multiplyScalar(2.9));
    targetCamPos.y = 1.7;

    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();

    const tempCam = new THREE.PerspectiveCamera();
    tempCam.position.copy(targetCamPos);
    tempCam.lookAt(artPos);
    const endQuat = tempCam.quaternion.clone();

    let progress = 0;
    const duration = 750;
    const startTime = performance.now();

    const animStep = (now) => {
      progress = Math.min(1, (now - startTime) / duration);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPos, targetCamPos, ease);
      this.camera.quaternion.slerpQuaternions(startQuat, endQuat, ease);
      this.euler.setFromQuaternion(this.camera.quaternion);

      if (progress < 1) {
        requestAnimationFrame(animStep);
      } else {
        this.camera.position.copy(targetCamPos);
        this.camera.quaternion.copy(endQuat);
        this.euler.setFromQuaternion(this.camera.quaternion);
      }
    };
    requestAnimationFrame(animStep);
  }

  initEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        this.keys[e.key.toLowerCase()] = true;
        this.keys[e.key] = true;
        if (this.isTourActive) this.stopTour();
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
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkArtworkHover();

      if (this.isTourActive) return; // Free look locked during guided tour for cinematic stability

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

    this.renderer.domElement.addEventListener('click', () => {
      if (this.hoveredArtwork) {
        this.selectArtwork(this.hoveredArtwork);
      }
    });

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
        const group = hit.parent;
        if (group && group.userData.glowMesh) {
          group.userData.glowMesh.material.opacity = 0.55;
        }
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredArtwork) {
        this.artworksGroup.children.forEach(g => {
          if (g.userData.glowMesh && (!this.isTourActive || this.tourPhase !== 'viewing')) {
            g.userData.glowMesh.material.opacity = 0;
          }
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
    const delta = Math.min(this.clock.getDelta(), 0.08);

    if (this.isTourActive) {
      this.updateCinematicTour(delta);
    } else {
      this.updateFreeMovement(delta);
    }

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
