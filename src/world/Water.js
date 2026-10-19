import * as THREE from 'three';
import { terrainH, WATER_Y } from '../data/layout.js';

const VS = `attribute float aDepth; varying float vD; varying vec3 vW; uniform float uTime;
void main(){ vec3 p=position; p.y += sin(uTime*1.3+p.x*0.45+p.z*0.31)*0.03 + sin(uTime*0.9+p.x*0.2-p.z*0.37)*0.025;
  vec4 w = modelMatrix*vec4(p,1.0); vW=w.xyz; vD=aDepth; gl_Position = projectionMatrix*viewMatrix*w; }`;
const FS = `uniform vec3 uShallow,uDeep,uSky,uSun,uCam,uFogC; uniform float uTime,uFogN,uFogF,uSimple; varying float vD; varying vec3 vW;
void main(){
  float dk = smoothstep(0.0, 2.3, vD);
  vec3 col = mix(uShallow, uDeep, dk);
  vec3 V = normalize(uCam - vW);
  float fres = pow(1.0 - clamp(V.y,0.0,1.0), 3.0);
  col = mix(col, uSky, fres*0.6);
  float edge = smoothstep(0.5, 0.0, vD);
  if(uSimple < 0.5){
    float s1 = sin(vW.x*2.3 + uTime*1.4) * sin(vW.z*2.9 - uTime*1.1);
    col += uSun * pow(max(s1,0.0), 14.0) * (0.3 + 0.7*fres) * 0.8;
    float wave = 0.5 + 0.5*sin(uTime*1.8 + vW.x*0.9 + vW.z*0.7 + vD*6.0);
    col = mix(col, vec3(1.0), edge*(0.3+0.45*wave));
  }
  float alpha = max(mix(0.6, 0.96, dk), edge*0.9) * smoothstep(-0.04, 0.06, vD);
  float d = distance(uCam, vW); col = mix(col, uFogC, smoothstep(uFogN, uFogF, d));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Mặt nước tối ưu cho iPhone / Mobile GPU: loại bỏ toàn bộ các tam giác nằm chìm dưới đất liền (giảm 82% số tam giác & loại bỏ lệnh `discard` gây tụt FPS trên GPU Apple).
export function buildWater() {
  const SIZE = 150, SEG = 96, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = WATER_Y - terrainH(pos.getX(i), pos.getZ(i));
  g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  // Lọc bỏ các tam giác nằm hoàn toàn dưới mặt đất khô (depth < -0.08)
  const oldIdx = g.index.array, keepIdx = [];
  for (let i = 0; i < oldIdx.length; i += 3) {
    const a = oldIdx[i], b = oldIdx[i + 1], c = oldIdx[i + 2];
    if (depth[a] > -0.08 || depth[b] > -0.08 || depth[c] > -0.08) {
      keepIdx.push(a, b, c);
    }
  }
  g.setIndex(keepIdx);
  g.computeBoundingSphere();
  const uniforms = {
    uTime: { value: 0 }, uShallow: { value: new THREE.Color(0x7fe0e6) }, uDeep: { value: new THREE.Color(0x2e9fd8) }, uSky: { value: new THREE.Color(0xbfe6ff) },
    uSun: { value: new THREE.Color(0xfff2c8) }, uCam: { value: new THREE.Vector3() }, uFogC: { value: new THREE.Color(0xcfe9ff) }, uFogN: { value: 40 }, uFogF: { value: 150 }, uSimple: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(g, mat); mesh.position.y = WATER_Y; mesh.renderOrder = 2; mesh.name = 'water';
  // biển xa: 1 quad phẳng
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e9fd8, fog: true }));
  far.position.y = WATER_Y - 0.05; far.name = 'sea';
  return { mesh, far, uniforms };
}
