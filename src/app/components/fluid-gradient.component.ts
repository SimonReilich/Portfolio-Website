import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, AfterViewInit, computed } from '@angular/core';
import { extend, NGT_STORE, NgtState, injectBeforeRender } from 'angular-three';
import * as THREE from 'three';

extend(THREE);

const simVertex = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const simFragment = `
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    uniform float uDecay;
    uniform float uBrushSize;
    uniform float uBrushStrength;
    varying vec2 vUv;

    uniform vec2 uRandomPos;
    uniform float uRandomBrushSize;
    uniform float uRandomBrushStrength;

    void main() {
        vec4 color = texture2D(uTexture, vUv) * uDecay;
        
        vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
        vec2 currentUv = vUv * aspect;
        
        vec2 mouseUv = uMouse * aspect;
        float dist = distance(currentUv, mouseUv);
        
        if (dist < uBrushSize) {
            float intensity = smoothstep(uBrushSize, 0.0, dist);
            color.r += intensity * uBrushStrength;
        }

        vec2 randomUv = uRandomPos * aspect;
        float randomDist = distance(currentUv, randomUv);
        if (randomDist < uRandomBrushSize) {
            float intensity = smoothstep(uRandomBrushSize, 0.0, randomDist);
            color.r += intensity * uRandomBrushStrength;
        }

        gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
    }
`;

const displayVertex = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const displayFragment = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform sampler2D uFluid;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    varying vec2 vUv;

    void main() {
        float fluid = texture2D(uFluid, vUv).r;
        
        vec2 distortedUv = vUv + vec2(fluid * 0.1, fluid * 0.1);
        
        float t = uTime * 0.2;

        float zoom = 60.0; 
        
        float n1 = sin(distortedUv.x * zoom + t) * 0.5 + 0.5;
        float n2 = cos(distortedUv.y * (zoom * 1.2) - t * 0.8) * 0.5 + 0.5;
        float n3 = sin((distortedUv.x + distortedUv.y) * (zoom * 0.8) + t) * 0.5 + 0.5;

        vec3 colA = mix(uColor1, uColor2, n1);
        vec3 colB = mix(uColor3, uColor4, n2);
        vec3 finalColor = mix(colA, colB, n3);
        
        gl_FragColor = vec4(finalColor + (fluid * 0.03), 1.0);
    }
`;

@Component({
    selector: 'fluid-scene',
    standalone: true,
    template: `
    <ngt-mesh [scale]="viewport().factor">
      <ngt-plane-geometry [args]="[1, 1]" />
      <ngt-shader-material
        [uniforms]="displayUniforms"
        [vertexShader]="displayVertex"
        [fragmentShader]="displayFragment"
      />
    </ngt-mesh>
  `,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FluidScene implements AfterViewInit {
    private store = inject(NGT_STORE);
    viewport = computed(() => this.store.snapshot.viewport);

    colors = input<string[]>(['#4a00e0', '#8e2de2', '#f12711', '#f5af19']);

    protected readonly displayVertex = displayVertex;
    protected readonly displayFragment = displayFragment;

    private targetA!: THREE.WebGLRenderTarget;
    private targetB!: THREE.WebGLRenderTarget;
    private simScene = new THREE.Scene();
    private simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private simMaterial!: THREE.ShaderMaterial;

    displayUniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uFluid: { value: null as THREE.Texture | null },
        uColor1: { value: new THREE.Color() },
        uColor2: { value: new THREE.Color() },
        uColor3: { value: new THREE.Color() },
        uColor4: { value: new THREE.Color() },
    };

    private simUniforms = {
        uResolution: { value: new THREE.Vector2() },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uTexture: { value: null as THREE.Texture | null },
        uDecay: { value: 0.98 },
        uBrushSize: { value: 0.15 },
        uBrushStrength: { value: 0.5 },
        uRandomPos: { value: new THREE.Vector2(0.5, 0.5) },
        uRandomBrushSize: { value: 0.2 },
        uRandomBrushStrength: { value: 0.02 },
    };

    constructor() {
        this.simMaterial = new THREE.ShaderMaterial({
            uniforms: this.simUniforms,
            vertexShader: simVertex,
            fragmentShader: simFragment,
        });
        this.simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial));

        injectBeforeRender((state) => {
            this.onAnimate(state);
        });

        effect(() => {
            const c = this.colors();
            if (c?.length === 4) {
                this.displayUniforms.uColor1.value.set(c[0]);
                this.displayUniforms.uColor2.value.set(c[1]);
                this.displayUniforms.uColor3.value.set(c[2]);
                this.displayUniforms.uColor4.value.set(c[3]);
            }
        });
    }

    ngAfterViewInit() {
        const { width, height } = this.store.snapshot.size;
        this.initRenderTargets(width, height);
    }

    private initRenderTargets(w: number, h: number) {
        const options = {
            type: THREE.HalfFloatType,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            stencilBuffer: false,
            depthBuffer: false,
        };

        this.targetA = new THREE.WebGLRenderTarget(w, h, options);
        this.targetB = this.targetA.clone();

        this.simUniforms.uResolution.value.set(w, h);
        this.displayUniforms.uResolution.value.set(w, h);
    }

    private smoothedMouse = new THREE.Vector2(0.5, 0.5);
    private lerpFactor = 0.01;
    private lastMouse = new THREE.Vector2(0.5, 0.5);
    private maxVelocity = 0.005;

    onAnimate(state: NgtState) {
        const { gl, pointer, clock, size } = state;

        if (size.width !== this.simUniforms.uResolution.value.x) {
            this.initRenderTargets(size.width, size.height);
        }

        const targetX = (pointer.x + 1) * 0.5;
        const targetY = (pointer.y + 1) * 0.5;

        this.smoothedMouse.x += (targetX - this.smoothedMouse.x) * this.lerpFactor;
        this.smoothedMouse.y += (targetY - this.smoothedMouse.y) * this.lerpFactor;

        const mouseDistance = this.smoothedMouse.distanceTo(this.lastMouse);

        const velocityStrength = Math.min(mouseDistance, this.maxVelocity) * 10.0;

        this.simUniforms.uMouse.value.copy(this.smoothedMouse);
        this.simUniforms.uBrushStrength.value = velocityStrength;

        this.lastMouse.copy(this.smoothedMouse);

        const time = clock.getElapsedTime();
        const randomX = (Math.sin(time * 0.2) + 1) / 2;
        const randomY = (Math.cos(time * 0.3) + 1) / 2;
        this.simUniforms.uRandomPos.value.set(randomX, randomY);

        this.displayUniforms.uTime.value = clock.getElapsedTime();

        const writeBuffer = this.targetA;
        const readBuffer = this.targetB;

        this.simUniforms.uTexture.value = readBuffer.texture;

        gl.setRenderTarget(writeBuffer);
        gl.render(this.simScene, this.simCamera);

        this.displayUniforms.uFluid.value = writeBuffer.texture;
        gl.setRenderTarget(null);

        this.targetB = writeBuffer;
        this.targetA = readBuffer;
    }
}