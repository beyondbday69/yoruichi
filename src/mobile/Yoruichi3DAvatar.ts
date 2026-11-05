import * as THREE from 'three';

export interface YoruichiAvatarOptions {
  canvas: HTMLCanvasElement;
  quality?: string;
  onReady?: () => void;
}

export interface FrameInput {
  activity?: 'idle' | 'listening' | 'talking';
  emotion?: string;
  outputAnalyser?: AnalyserNode | null;
  inputAnalyser?: AnalyserNode | null;
}

/**
 * Real-time 3D Holographic Cyber-Anime Avatar for Yoruichi.
 * Interactive 3D scene with eye-tracking, breathing, audio-reactive waveform ring,
 * blinking, gesture animations, and orbiting holographic runes.
 */
export class Yoruichi3DAvatar {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private disposed = false;
  private running = false;
  private animId = 0;

  // 3D Objects
  private rootGroup = new THREE.Group();
  private characterGroup = new THREE.Group();
  private headGroup = new THREE.Group();
  private torsoGroup = new THREE.Group();
  private hairGroup = new THREE.Group();
  private leftEye: THREE.Mesh;
  private rightEye: THREE.Mesh;
  private leftPupil: THREE.Mesh;
  private rightPupil: THREE.Mesh;
  private leftEyelid: THREE.Mesh;
  private rightEyelid: THREE.Mesh;
  private mouth: THREE.Mesh;
  private ringOuter: THREE.Mesh;
  private ringInner: THREE.Mesh;
  private particleSystem: THREE.Points;
  private waveformRings: THREE.Line[] = [];

  // Audio Analysers
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private audioData = new Uint8Array(64);

  // Animation State
  private clock = new THREE.Clock();
  private targetPointer = new THREE.Vector2(0, 0);
  private currentPointer = new THREE.Vector2(0, 0);
  private eyeTracking = true;
  private isBlinking = false;
  private blinkTimer = 0;
  private nextBlink = 3;
  private isWaving = false;
  private waveProgress = 0;
  private isSmiling = false;
  private smileTimer = 0;
  private currentActivity: 'idle' | 'listening' | 'talking' = 'idle';
  private cameraDistance = 3.6;
  private targetCameraY = 1.25;

  constructor(options: YoruichiAvatarOptions) {
    this.canvas = options.canvas;
    const width = this.canvas.clientWidth || 360;
    const height = this.canvas.clientHeight || 480;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, this.targetCameraY, this.cameraDistance);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: options.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.quality === 'high' ? 2 : 1.5));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 3. Lighting
    this.setupLighting();

    // 4. Build 3D Hologram
    this.buildAvatar();
    this.scene.add(this.rootGroup);

    // 5. Pointer Tracking Events
    this.setupPointerEvents();

    if (options.onReady) options.onReady();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0x7c3aed, 0.9);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfef08a, 1.4);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 2.0);
    rimLight.position.set(-3, 2, -2);
    this.scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xfbbf24, 1.2, 8);
    fillLight.position.set(0, 0.5, 2);
    this.scene.add(fillLight);
  }

  private buildAvatar() {
    // Holographic anime shader material
    const holoMaterial = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      emissive: 0x581c87,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    });

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a373, // Warm anime tone
      roughness: 0.6,
      metalness: 0.05,
    });

    // --- Torso & Neck ---
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.8, 16);
    const torso = new THREE.Mesh(torsoGeo, holoMaterial);
    torso.position.y = 0.4;
    this.torsoGroup.add(torso);

    // Collar / Ninja Accent
    const collarGeo = new THREE.TorusGeometry(0.24, 0.04, 8, 24);
    const collar = new THREE.Mesh(collarGeo, goldMaterial);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.82;
    this.torsoGroup.add(collar);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 16);
    const neck = new THREE.Mesh(neckGeo, skinMaterial);
    neck.position.y = 0.92;
    this.torsoGroup.add(neck);

    // --- Head ---
    const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
    headGeo.scale(1, 1.15, 0.95);
    const head = new THREE.Mesh(headGeo, skinMaterial);
    head.position.y = 1.35;
    this.headGroup.add(head);

    // Chin / Face contour
    const chinGeo = new THREE.ConeGeometry(0.26, 0.3, 16);
    chinGeo.rotateX(Math.PI);
    const chin = new THREE.Mesh(chinGeo, skinMaterial);
    chin.position.set(0, 1.1, 0.05);
    this.headGroup.add(chin);

    // --- Eyes (Golden glowing Yoruichi eyes) ---
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xb45309 });
    const eyelidMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.5 });

    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    eyeGeo.scale(1, 1.4, 0.5);

    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.14, 1.38, 0.32);
    this.leftEye.rotation.y = 0.15;
    this.headGroup.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.14, 1.38, 0.32);
    this.rightEye.rotation.y = -0.15;
    this.headGroup.add(this.rightEye);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.045, 12, 12);
    pupilGeo.scale(1, 1.3, 0.3);
    this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.leftPupil.position.set(-0.14, 1.38, 0.36);
    this.headGroup.add(this.leftPupil);

    this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.rightPupil.position.set(0.14, 1.38, 0.36);
    this.headGroup.add(this.rightPupil);

    // Eyelids for blinking
    const eyelidGeo = new THREE.SphereGeometry(0.088, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    eyelidGeo.scale(1, 1.45, 0.55);
    this.leftEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
    this.leftEyelid.position.set(-0.14, 1.38, 0.32);
    this.leftEyelid.visible = false;
    this.headGroup.add(this.leftEyelid);

    this.rightEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
    this.rightEyelid.position.set(0.14, 1.38, 0.32);
    this.rightEyelid.visible = false;
    this.headGroup.add(this.rightEyelid);

    // --- Mouth ---
    const mouthGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x9f1239 });
    this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
    this.mouth.position.set(0, 1.18, 0.35);
    this.mouth.rotation.x = -0.2;
    this.headGroup.add(this.mouth);

    // --- Signature Hair (Deep Purple Anime Hair with Ponytail) ---
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764, // Deep royal anime purple
      emissive: 0x581c87,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });

    // Hair cap
    const hairCapGeo = new THREE.SphereGeometry(0.42, 20, 20);
    hairCapGeo.scale(1.02, 1.1, 1.05);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.set(0, 1.42, -0.05);
    this.hairGroup.add(hairCap);

    // Bangs / Strands
    for (let i = -2; i <= 2; i++) {
      const bangGeo = new THREE.ConeGeometry(0.06, 0.38, 8);
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(i * 0.09, 1.55 - Math.abs(i) * 0.05, 0.32);
      bang.rotation.z = i * -0.15;
      bang.rotation.x = -0.3;
      this.hairGroup.add(bang);
    }

    // High Ponytail
    const ponytailGeo = new THREE.ConeGeometry(0.14, 1.1, 12);
    ponytailGeo.rotateX(Math.PI * 0.85);
    const ponytail = new THREE.Mesh(ponytailGeo, hairMat);
    ponytail.position.set(0, 1.68, -0.45);
    this.hairGroup.add(ponytail);

    // Golden Hair Ribbon
    const ribbonGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 16);
    const ribbon = new THREE.Mesh(ribbonGeo, goldMaterial);
    ribbon.position.set(0, 1.72, -0.35);
    ribbon.rotation.x = 0.5;
    this.hairGroup.add(ribbon);

    // Cat-Ear Hologram Hair Accents (Iconic Yoruichi feline motif)
    for (const side of [-1, 1]) {
      const earGeo = new THREE.ConeGeometry(0.1, 0.26, 4);
      const ear = new THREE.Mesh(earGeo, goldMaterial);
      ear.position.set(side * 0.28, 1.82, 0.02);
      ear.rotation.z = side * -0.35;
      ear.rotation.y = side * 0.2;
      this.hairGroup.add(ear);
    }

    this.headGroup.add(this.hairGroup);
    this.characterGroup.add(this.torsoGroup);
    this.characterGroup.add(this.headGroup);
    this.rootGroup.add(this.characterGroup);

    // --- Orbiting Holographic Rings ---
    const ringGeo = new THREE.TorusGeometry(1.2, 0.015, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6 });
    this.ringOuter = new THREE.Mesh(ringGeo, ringMat);
    this.ringOuter.rotation.x = Math.PI * 0.45;
    this.ringOuter.position.y = 1.0;
    this.rootGroup.add(this.ringOuter);

    const innerGeo = new THREE.TorusGeometry(0.9, 0.01, 8, 36);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.5 });
    this.ringInner = new THREE.Mesh(innerGeo, innerMat);
    this.ringInner.rotation.x = -Math.PI * 0.4;
    this.ringInner.position.y = 1.1;
    this.rootGroup.add(this.ringInner);

    // --- Audio Waveform Base Equalizer ---
    for (let i = 0; i < 3; i++) {
      const radius = 0.7 + i * 0.25;
      const wavePoints: THREE.Vector3[] = [];
      const segments = 48;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        wavePoints.push(new THREE.Vector3(Math.cos(theta) * radius, 0.05, Math.sin(theta) * radius));
      }
      const waveGeo = new THREE.BufferGeometry().setFromPoints(wavePoints);
      const waveLine = new THREE.Line(
        waveGeo,
        new THREE.LineBasicMaterial({ color: i === 0 ? 0xfbbf24 : 0xa855f7, transparent: true, opacity: 0.5 - i * 0.12 })
      );
      this.waveformRings.push(waveLine);
      this.rootGroup.add(waveLine);
    }

    // --- Particle Constellation Field ---
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 3.5;
      positions[i + 1] = Math.random() * 2.8;
      positions[i + 2] = (Math.random() - 0.5) * 2.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.04,
      transparent: true,
      opacity: 0.75,
    });
    this.particleSystem = new THREE.Points(particleGeo, particleMat);
    this.rootGroup.add(this.particleSystem);
  }

  private setupPointerEvents() {
    const handleMove = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      this.targetPointer.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    };

    window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  public setFrameInput(input: FrameInput) {
    if (input.activity) this.currentActivity = input.activity;
    if (input.outputAnalyser) this.outputAnalyser = input.outputAnalyser;
    if (input.inputAnalyser) this.inputAnalyser = input.inputAnalyser;
    if (input.emotion === 'happy') this.smile();
  }

  public setEyeTracking(enabled: boolean) {
    this.eyeTracking = enabled;
  }

  public frameFullBody() {
    this.cameraDistance = 4.2;
    this.targetCameraY = 1.0;
  }

  public framePortrait() {
    this.cameraDistance = 3.2;
    this.targetCameraY = 1.35;
  }

  public wave() {
    this.isWaving = true;
    this.waveProgress = 0;
    this.smile();
  }

  public smile() {
    this.isSmiling = true;
    this.smileTimer = 2.5;
  }

  public sit(_options?: any) {
    this.cameraDistance = 3.8;
    this.targetCameraY = 1.1;
  }

  public stand() {
    this.cameraDistance = 3.6;
    this.targetCameraY = 1.25;
  }

  public playBehaviour(name: string) {
    if (name === 'wave') this.wave();
    else if (name === 'happy') this.smile();
  }

  public resize(width: number, height: number) {
    if (this.disposed || !this.renderer) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  public stop() {
    this.running = false;
    cancelAnimationFrame(this.animId);
  }

  private loop = () => {
    if (!this.running || this.disposed) return;
    this.animId = requestAnimationFrame(this.loop);
    this.update();
    this.renderer.render(this.scene, this.camera);
  };

  private update() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    // 1. Pointer smoothing (Parallax Eye/Head tracking)
    this.currentPointer.lerp(this.targetPointer, delta * 4);

    if (this.eyeTracking) {
      this.headGroup.rotation.y = this.currentPointer.x * 0.35;
      this.headGroup.rotation.x = -this.currentPointer.y * 0.22;
      this.leftPupil.position.x = -0.14 + this.currentPointer.x * 0.02;
      this.rightPupil.position.x = 0.14 + this.currentPointer.x * 0.02;
    }

    // 2. Idle Breathing & Sway
    const breath = Math.sin(elapsed * 2.2) * 0.025;
    this.torsoGroup.position.y = breath;
    this.headGroup.position.y = breath * 0.8;
    this.characterGroup.rotation.z = Math.sin(elapsed * 0.8) * 0.015;

    // 3. Hair secondary motion
    this.hairGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.04 - this.headGroup.rotation.y * 0.15;
    this.hairGroup.rotation.x = Math.cos(elapsed * 1.2) * 0.03;

    // 4. Natural Blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > this.nextBlink) {
      this.isBlinking = true;
      this.leftEyelid.visible = true;
      this.rightEyelid.visible = true;
      if (this.blinkTimer > this.nextBlink + 0.15) {
        this.isBlinking = false;
        this.leftEyelid.visible = false;
        this.rightEyelid.visible = false;
        this.blinkTimer = 0;
        this.nextBlink = 2.5 + Math.random() * 3.5;
      }
    }

    // 5. Smiling expression
    if (this.isSmiling) {
      this.smileTimer -= delta;
      this.mouth.scale.set(1.4, 1.4, 1.4);
      if (this.smileTimer <= 0) {
        this.isSmiling = false;
        this.mouth.scale.set(1, 1, 1);
      }
    }

    // 6. Waving Gesture
    if (this.isWaving) {
      this.waveProgress += delta * 3.5;
      this.characterGroup.rotation.z = Math.sin(this.waveProgress * 3) * 0.08;
      if (this.waveProgress > Math.PI * 2) {
        this.isWaving = false;
        this.characterGroup.rotation.z = 0;
      }
    }

    // 7. Audio Reactivity (Talking / Listening / Lip Sync)
    let audioLevel = 0;
    const activeAnalyser = this.currentActivity === 'talking' ? this.outputAnalyser : this.inputAnalyser;
    if (activeAnalyser) {
      activeAnalyser.getByteFrequencyData(this.audioData);
      let sum = 0;
      for (let i = 0; i < 16; i++) sum += this.audioData[i];
      audioLevel = sum / (16 * 255);
    } else if (this.currentActivity === 'talking') {
      audioLevel = 0.2 + Math.abs(Math.sin(elapsed * 10)) * 0.4;
    }

    if (this.currentActivity === 'talking' || audioLevel > 0.05) {
      const mouthOpen = 0.8 + audioLevel * 1.2;
      this.mouth.scale.set(1.2, mouthOpen, 1);
    } else if (!this.isSmiling) {
      this.mouth.scale.set(1, 1, 1);
    }

    // 8. Orbiting Rings Animation
    if (this.ringOuter) {
      this.ringOuter.rotation.z += delta * (0.4 + audioLevel * 1.5);
      this.ringOuter.rotation.y += delta * 0.2;
    }
    if (this.ringInner) {
      this.ringInner.rotation.z -= delta * (0.6 + audioLevel * 1.8);
      this.ringInner.rotation.x -= delta * 0.15;
    }

    // 9. Waveform Base Rings
    this.waveformRings.forEach((ring, idx) => {
      const scale = 1 + audioLevel * (0.4 + idx * 0.2) + Math.sin(elapsed * 3 + idx) * 0.03;
      ring.scale.set(scale, 1, scale);
    });

    // 10. Particle System Drift
    if (this.particleSystem) {
      this.particleSystem.rotation.y = elapsed * 0.05;
    }

    // 11. Smooth Camera Zoom
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.cameraDistance, delta * 3);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.targetCameraY, delta * 3);
  }

  public dispose() {
    this.disposed = true;
    this.stop();
    this.scene.clear();
    this.renderer.dispose();
  }
}
