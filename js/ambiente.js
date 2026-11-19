import * as THREE from 'three';
import { MESA, MESAS } from './config.js';

export function crearAmbiente() {
  const grupo = new THREE.Group();
  grupo.name = 'Ambiente NEXUS XR';

  const cielo = new THREE.SphereGeometry(18, 24, 12);
  const posiciones = cielo.attributes.position;
  const colores = [];
  const azul = new THREE.Color(0x050c1c);
  const violeta = new THREE.Color(0x29224c);
  const mezcla = new THREE.Color();
  for (let i = 0; i < posiciones.count; i++) {
    const altura = Math.max(0, posiciones.getY(i) / 13 + 0.20);
    mezcla.copy(azul).lerp(violeta, Math.min(1, altura));
    colores.push(mezcla.r, mezcla.g, mezcla.b);
  }
  cielo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  const fondo = new THREE.Mesh(cielo, new THREE.MeshBasicMaterial({
    side: THREE.BackSide, vertexColors: true, toneMapped: false,
  }));
  grupo.add(fondo);

  const pared = new THREE.PlaneGeometry(7.4, 3.35, 1, 4);
  const colorPared = [];
  const base = new THREE.Color(0x08162a);
  const techo = new THREE.Color(0x211f42);
  for (let i = 0; i < pared.attributes.position.count; i++) {
    mezcla.copy(base).lerp(techo, pared.attributes.position.getY(i) / 3.35 + 0.5);
    colorPared.push(mezcla.r, mezcla.g, mezcla.b);
  }
  pared.setAttribute('color', new THREE.Float32BufferAttribute(colorPared, 3));
  const muro = new THREE.Mesh(pared, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  muro.position.set(0, 1.675, -3.35);
  grupo.add(muro);

  const geometria = new THREE.BoxGeometry(1, 1, 1);
  const perfil = new THREE.Object3D();
  const estructuras = [];
  const leds = [];
  for (const lado of [-1, 1]) {
    estructuras.push(
      [lado * 2.93, 1.54, -3.26, 0.28, 2.75, 0.12],
      [lado * 2.06, 1.64, -3.31, 1.34, 1.65, 0.045],
      [lado * 2.15, 0.31, -3.20, 1.38, 0.40, 0.19],
    );
    leds.push(
      [lado * 2.92, 1.54, -3.19, 0.012, 2.38, 0.009],
      [lado * 2.06, 2.48, -3.28, 1.32, 0.012, 0.009],
      [lado * 3.01, 0.004, -1.12, 0.015, 0.008, 3.3],
    );
    for (let i = 0; i < 5; i++) {
      leds.push([lado * (1.66 + i * 0.19), 0.38, -3.095, 0.09, 0.018, 0.01]);
    }
  }
  estructuras.push([0, 2.92, -3.26, 5.72, 0.15, 0.14]);
  leds.push([0, 2.89, -3.18, 5.65, 0.018, 0.012]);
  for (const mesa of MESAS) {
    leds.push([mesa.x, 0.005, mesa.z + MESA.fondo / 2 + 0.095, 0.63, 0.009, 0.014]);
  }

  function instalarInstancias(datos, color) {
    const malla = new THREE.InstancedMesh(geometria, new THREE.MeshBasicMaterial({ color }), datos.length);
    datos.forEach(([x, y, z, ancho, alto, fondo], indice) => {
      perfil.position.set(x, y, z);
      perfil.scale.set(ancho, alto, fondo);
      perfil.updateMatrix();
      malla.setMatrixAt(indice, perfil.matrix);
    });
    malla.instanceMatrix.needsUpdate = true;
    grupo.add(malla);
  }
  instalarInstancias(estructuras, 0x142a49);
  instalarInstancias(leds, 0x338fc7);

  const segmentos = [];
  for (const lado of [-1, 1]) {
    const x = lado * 2.06;
    for (const radio of [0.25, 0.40, 0.53]) {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const b = a + Math.PI / 3;
        segmentos.push(x + radio * Math.cos(a), 1.64 + radio * Math.sin(a), -3.275);
        segmentos.push(x + radio * Math.cos(b), 1.64 + radio * Math.sin(b), -3.275);
      }
    }
    segmentos.push(x - 0.10, 1.64, -3.275, x + 0.10, 1.64, -3.275);
    segmentos.push(x, 1.54, -3.275, x, 1.74, -3.275);
  }
  const trazos = new THREE.BufferGeometry();
  trazos.setAttribute('position', new THREE.Float32BufferAttribute(segmentos, 3));
  grupo.add(new THREE.LineSegments(trazos, new THREE.LineBasicMaterial({ color: 0x479fbf })));

  grupo.add(new THREE.HemisphereLight(0xd7efff, 0x71668c, 1.75));
  const luz = new THREE.DirectionalLight(0xecfaff, 1.95);
  luz.position.set(2, 4, 1);
  grupo.add(luz);
  return grupo;
}
