import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const THUMB_SIZE = 128;

// 为给定的 .glb/.gltf Blob 生成 128×128 PNG 缩略图（Blob）
export async function generateThumbnail(modelBlob: Blob): Promise<Blob | undefined> {
  const url = URL.createObjectURL(modelBlob);
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e293b');

    // 尺寸归一化 + 居中
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxDim;
    cloned.scale.setScalar(scale);

    // 统一材质，和主应用的紫色调保持一致
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#818cf8',
          metalness: 0.2,
          roughness: 0.4,
        });
      }
    });
    scene.add(cloned);

    scene.add(new THREE.AmbientLight('#f8fafc', 0.7));
    const dir = new THREE.DirectionalLight('#ffffff', 0.9);
    dir.position.set(3, 4, 5);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(3, 2.5, 3.5);
    camera.lookAt(0, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    renderer.render(scene, camera);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );

    renderer.dispose();

    return blob ?? undefined;
  } catch (err) {
    console.warn('[thumbnail] failed', err);
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}
