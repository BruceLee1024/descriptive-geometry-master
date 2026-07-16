import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export function exportGeometryAsSTL(geometry: THREE.BufferGeometry, name: string): Blob {
  const mesh = new THREE.Mesh(geometry);
  mesh.name = name;
  const exporter = new STLExporter();
  const text = exporter.parse(mesh, { binary: false }) as string;
  return new Blob([text], { type: 'model/stl' });
}

export function exportGeometryAsGLB(geometry: THREE.BufferGeometry, name: string): Promise<Blob> {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: '#818cf8', roughness: 0.45, metalness: 0.1 })
  );
  mesh.name = name;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        } else {
          resolve(new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }));
        }
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
