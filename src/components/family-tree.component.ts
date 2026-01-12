
import { Component, ElementRef, input, effect, OnDestroy, OnInit, viewChild, ChangeDetectionStrategy, NgZone, output } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import * as d3 from 'd3';
import { gsap } from 'gsap';

@Component({
  selector: 'app-family-tree',
  template: `
    <div #container class="w-full h-full relative">
      <div #labels class="absolute inset-0 pointer-events-none label-container"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full',
    '(window:keydown)': 'onKeyDown($event)',
    '(window:keyup)': 'onKeyUp($event)'
  }
})
export class FamilyTreeComponent implements OnInit, OnDestroy {
  data = input.required<any>();
  search = input<string>('');
  maxGen = input<number>(8);
  autoRotate = input<boolean>(false);
  spinSpeed = input<number>(4);
  
  nodeSelected = output<any>();

  container = viewChild<ElementRef>('container');

  private scene!: THREE.Scene;
  private treeGroup!: THREE.Group;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private labelRenderer!: CSS2DRenderer;
  private controls!: OrbitControls;
  private frameId: number | null = null;
  private nodes: THREE.Mesh[] = [];
  private edges: THREE.Line[] = [];
  private labels: CSS2DObject[] = [];
  private resizeObserver?: ResizeObserver;
  private selectedMesh: THREE.Mesh | null = null;
  
  private starfield!: THREE.Points;
  private dustMotes!: THREE.Points;
  private unionNodes: THREE.Mesh[] = [];
  private geometricNodes: THREE.Mesh[] = [];

  private keys: Record<string, boolean> = {};
  private isTransitioning = false;
  private moveSpeed = 65; 
  private rotSpeed = 0.04;

  constructor(private zone: NgZone) {
    effect(() => {
      this.updateHighlight(this.search());
    });

    effect(() => {
      this.updateVisibility(this.maxGen());
    });

    effect(() => {
      const rotate = this.autoRotate();
      const speed = this.spinSpeed();
      if (this.controls) {
        this.controls.autoRotate = rotate;
        this.controls.autoRotateSpeed = speed;
      }
    });
  }

  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      const el = this.container()!.nativeElement;
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && !this.scene) {
            this.initThree();
            this.buildTree();
            this.animate();
          } else if (this.scene) {
            this.onResize();
          }
        }
      });
      this.resizeObserver.observe(el);
    });
  }

  ngOnDestroy() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.labelRenderer?.domElement.remove();
  }

  onKeyDown(event: KeyboardEvent) {
    this.keys[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event: KeyboardEvent) {
    this.keys[event.code] = false;
  }

  private initThree() {
    const el = this.container()!.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.0004);

    this.treeGroup = new THREE.Group();
    this.scene.add(this.treeGroup);

    this.camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 1, 20000);
    this.camera.position.set(4000, 2500, 4000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(el.clientWidth, el.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    el.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 14000;
    this.controls.minDistance = 100;
    this.controls.target.set(0, 500, 0);
    this.controls.autoRotate = this.autoRotate();
    this.controls.autoRotateSpeed = this.spinSpeed();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const mainLight = new THREE.PointLight(0x6366f1, 2, 8000);
    mainLight.position.set(0, 2000, 0);
    this.scene.add(mainLight);

    this.addAtmosphere();
  }

  private addAtmosphere() {
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 12000; i++) {
      starVerts.push(THREE.MathUtils.randFloatSpread(16000));
      starVerts.push(THREE.MathUtils.randFloatSpread(16000));
      starVerts.push(THREE.MathUtils.randFloatSpread(16000));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    this.starfield = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.5, color: 0x666688, transparent: true, opacity: 0.4 }));
    this.scene.add(this.starfield);

    const moteGeo = new THREE.BufferGeometry();
    const moteVerts = [];
    for (let i = 0; i < 600; i++) {
      moteVerts.push(THREE.MathUtils.randFloatSpread(5000));
      moteVerts.push(THREE.MathUtils.randFloatSpread(5000) + 500);
      moteVerts.push(THREE.MathUtils.randFloatSpread(5000));
    }
    moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(moteVerts, 3));
    this.dustMotes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 8, color: 0x818cf8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dustMotes);
  }

  private buildTree() {
    const root = d3.hierarchy(this.data());
    const treeLayout = (d3 as any).tree().size([2 * Math.PI, 1800]);
    treeLayout(root);

    this.nodes.forEach(n => this.treeGroup.remove(n));
    this.edges.forEach(e => this.treeGroup.remove(e));
    this.nodes = [];
    this.edges = [];
    this.labels = [];
    this.unionNodes = [];
    this.geometricNodes = [];

    const generationGap = 450;
    const baseRadius = 300;
    
    root.descendants().forEach((d: any) => {
      const angle = d.x;
      const radius = d.depth * generationGap + baseRadius;
      const yPos = 1800 - (d.depth * generationGap);
      const xPos = Math.cos(angle) * radius;
      const zPos = Math.sin(angle) * radius;
      const pos = new THREE.Vector3(xPos, yPos, zPos);
      d.pos = pos;

      const type = d.data.type || '';
      const isUnion = type === 'union_link';
      const isLeaf = !d.children;
      const nodeColor = this.getNodeColor(d);
      
      let nodeGeo: THREE.BufferGeometry;
      let isSpecial = true;

      switch (type) {
        case 'root': 
          nodeGeo = new THREE.OctahedronGeometry(48); 
          break;
        case 'patriarch':
        case 'matriarch': 
          nodeGeo = new THREE.DodecahedronGeometry(38); 
          break;
        case 'maternal_root':
        case 'paternal_root':
        case 'root_ancestor':
          nodeGeo = new THREE.TetrahedronGeometry(42);
          break;
        case 'maternal_group':
          nodeGeo = new THREE.TorusKnotGeometry(22, 6, 128, 16);
          break;
        case 'cluster':
          nodeGeo = new THREE.TorusGeometry(20, 7, 16, 100);
          break;
        case 'union_link': 
          nodeGeo = new THREE.IcosahedronGeometry(32); 
          break;
        default: 
          if (isLeaf) {
            nodeGeo = new THREE.CapsuleGeometry(10, 15, 4, 12);
            isSpecial = false;
          } else {
            nodeGeo = new THREE.BoxGeometry(28, 28, 28);
          }
      }

      const nodeMat = new THREE.MeshPhongMaterial({ 
        color: nodeColor, 
        emissive: nodeColor, 
        emissiveIntensity: isUnion ? 1.8 : 0.45,
        shininess: isSpecial ? 200 : 100,
        specular: 0xffffff
      });
      
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.copy(pos);
      nodeMesh.userData = { data: d.data, depth: d.depth, isUnion, isSpecial };
      
      if (isUnion) this.unionNodes.push(nodeMesh);
      if (isSpecial) this.geometricNodes.push(nodeMesh);

      this.treeGroup.add(nodeMesh);
      this.nodes.push(nodeMesh);

      const labelDiv = document.createElement('div');
      labelDiv.className = `node-label ${isUnion ? 'union-label' : ''}`;
      labelDiv.innerHTML = `
        <div class="flex flex-col text-center">
          <span class="text-[10px] font-black">${d.data.name}</span>
          ${type ? `<span class="text-[6px] opacity-60 uppercase tracking-tighter">${type.replace('_', ' ')}</span>` : ''}
        </div>
      `;
      labelDiv.onclick = (e) => { e.stopPropagation(); this.focusNode(nodeMesh); this.nodeSelected.emit(d.data); };
      
      const label = new CSS2DObject(labelDiv);
      label.position.set(0, 50, 0);
      nodeMesh.add(label);
      (label as any).nodeData = d.data;
      this.labels.push(label);

      if (d.children) {
        d.children.forEach((child: any) => {
          const cPos = new THREE.Vector3(
            Math.cos(child.x) * (child.depth * generationGap + baseRadius),
            1800 - (child.depth * generationGap),
            Math.sin(child.x) * (child.depth * generationGap + baseRadius)
          );
          this.drawEdge(pos, cPos, nodeColor, d.depth, child.depth);
        });
      }
    });
    this.resetZoom();
  }

  private drawEdge(start: THREE.Vector3, end: THREE.Vector3, color: string, startDepth: number, endDepth: number) {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    mid.y += 150; 
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const points = curve.getPoints(30);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, opacity: 0.15, transparent: true }));
    line.userData = { endDepth };
    this.treeGroup.add(line);
    this.edges.push(line);
  }

  private getNodeColor(d: any): string {
    const type = d.data.type || '';
    if (type === 'union_link') return '#e879f9'; 
    if (type === 'root') return '#fbbf24'; 
    let curr = d;
    while (curr.parent) {
      if (curr.data.type?.includes('maternal')) return '#f43f5e';
      if (curr.data.type?.includes('paternal')) return '#10b981';
      curr = curr.parent;
    }
    return '#6366f1';
  }

  private updateVisibility(maxGen: number) {
    if (!this.nodes.length) return;
    this.nodes.forEach(n => n.visible = n.userData['depth'] <= maxGen);
    this.edges.forEach(e => e.visible = e.userData['endDepth'] <= maxGen);
  }

  public focusNode(mesh: THREE.Mesh) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    const target = mesh.getWorldPosition(new THREE.Vector3());
    this.selectedMesh = mesh;
    
    const direction = target.clone().normalize();
    const camPos = target.clone().add(new THREE.Vector3(direction.x * 800, 300, direction.z * 800));

    const tl = gsap.timeline({ onComplete: () => this.isTransitioning = false });
    tl.to(this.camera.position, { x: camPos.x, y: camPos.y, z: camPos.z, duration: 2.5, ease: "expo.inOut" }, 0);
    tl.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration: 2.5, ease: "expo.inOut", onUpdate: () => this.controls.update() }, 0);
  }

  public resetZoom() {
    this.isTransitioning = true;
    const tl = gsap.timeline({ onComplete: () => this.isTransitioning = false });
    tl.to(this.treeGroup.rotation, { x: 0, y: 0, z: 0, duration: 2.5, ease: "power2.inOut" }, 0);
    tl.to(this.camera.position, { x: 4000, y: 2500, z: 4000, duration: 3, ease: "power3.inOut" }, 0);
    tl.to(this.controls.target, { x: 0, y: 500, z: 0, duration: 3, ease: "power3.inOut", onUpdate: () => this.controls.update() }, 0);
  }

  private updateHighlight(term: string) {
    if (!this.labels) return;
    const lower = term.toLowerCase();
    this.labels.forEach((l: any) => {
      const match = term && (l.nodeData.name?.toLowerCase().includes(lower) || l.nodeData.spouse?.toLowerCase().includes(lower));
      l.element.classList.toggle('highlighted', !!match);
    });
  }

  private onResize() {
    const el = this.container()!.nativeElement;
    if (!el || el.clientWidth === 0) return;
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.labelRenderer.setSize(el.clientWidth, el.clientHeight);
  }

  private updateKeyboardNavigation() {
    if (this.isTransitioning) return;

    const isShift = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const isAlt = this.keys['AltLeft'] || this.keys['AltRight'];
    
    const moveVector = new THREE.Vector3(0, 0, 0);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    if (isShift) {
      if (this.keys['ArrowLeft']) this.treeGroup.rotation.y -= this.rotSpeed;
      if (this.keys['ArrowRight']) this.treeGroup.rotation.y += this.rotSpeed;
      if (this.keys['ArrowUp']) this.treeGroup.rotation.x -= this.rotSpeed;
      if (this.keys['ArrowDown']) this.treeGroup.rotation.x += this.rotSpeed;
    } 
    else if (isAlt) {
      if (this.keys['ArrowUp']) moveVector.add(camForward.clone().multiplyScalar(this.moveSpeed));
      if (this.keys['ArrowDown']) moveVector.add(camForward.clone().multiplyScalar(-this.moveSpeed));
      if (this.keys['ArrowLeft']) moveVector.add(camRight.clone().multiplyScalar(-this.moveSpeed));
      if (this.keys['ArrowRight']) moveVector.add(camRight.clone().multiplyScalar(this.moveSpeed));
    } 
    else {
      if (this.keys['ArrowLeft']) moveVector.add(camRight.clone().multiplyScalar(-this.moveSpeed));
      if (this.keys['ArrowRight']) moveVector.add(camRight.clone().multiplyScalar(this.moveSpeed));
      if (this.keys['ArrowUp']) moveVector.add(camUp.clone().multiplyScalar(this.moveSpeed));
      if (this.keys['ArrowDown']) moveVector.add(camUp.clone().multiplyScalar(-this.moveSpeed));
    }

    if (moveVector.length() > 0) {
      this.camera.position.add(moveVector);
      this.controls.target.add(moveVector);
    }

    if (this.keys['Space']) this.resetZoom();

    this.controls.update();
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate());
    if (this.starfield) this.starfield.rotation.y += 0.0001;
    if (this.dustMotes) this.dustMotes.rotation.y -= 0.0002;
    
    this.geometricNodes.forEach(n => {
      n.rotation.y += 0.01;
      n.rotation.x += 0.005;
    });

    const time = Date.now() * 0.001;
    this.unionNodes.forEach(n => {
      const s = 1 + Math.sin(time * 3) * 0.1;
      n.scale.set(s, s, s);
    });

    this.updateKeyboardNavigation();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}
