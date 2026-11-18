import * as THREE from 'three';
import { Body, Box, ConvexPolyhedron, Sphere, Vec3 } from 'cannon-es';
import { CATALOGO } from './config.js';

function crearConvexo(forma) {
  const { ancho, alto, id } = forma;
  const vertices = [];
  const faces = [];
  const anillos = id === 'piramide' ? 1 : 2;
  const lados = anillos === 1 ? 4 : 6;
  const radio = anillos === 1 ? ancho / Math.SQRT2 : ancho / 2;
  const base = anillos === 1 ? -alto / 4 : -alto / 2;

  for (let anillo = 0; anillo < anillos; anillo++) {
    for (let lado = 0; lado < lados; lado++) {
      const angulo = 2 * Math.PI * lado / lados + (anillos === 1 ? Math.PI / 4 : 0);
      vertices.push(new Vec3(radio * Math.cos(angulo), base + anillo * alto, radio * Math.sin(angulo)));
    }
  }
  if (anillos === 1) vertices.push(new Vec3(0, base + alto, 0));
  faces.push(Array.from({ length: lados }, (_, i) => i));
  if (anillos === 2) faces.push(Array.from({ length: lados }, (_, i) => lados * 2 - 1 - i));
  for (let i = 0; i < lados; i++) {
    const siguiente = (i + 1) % lados;
    faces.push(anillos === 1 ? [siguiente, i, lados] : [siguiente, i, i + lados, siguiente + lados]);
  }

  const posiciones = [];
  for (const cara of faces) {
    for (let i = 1; i < cara.length - 1; i++) {
      for (const indice of [cara[0], cara[i], cara[i + 1]]) {
        const { x, y, z } = vertices[indice];
        posiciones.push(x, y, z);
      }
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geometria.computeVertexNormals();
  return { geometria, colisionador: new ConvexPolyhedron({ vertices, faces }), base: -base, radio };
}

function recursosFigura(forma) {
  const { ancho, id } = forma;
  const mitad = ancho / 2;
  if (id === 'esfera') {
    return {
      geometria: new THREE.SphereGeometry(mitad, 24, 16),
      colisionador: new Sphere(mitad), base: mitad, radio: mitad,
    };
  }
  if (id === 'cubo') {
    return {
      geometria: new THREE.BoxGeometry(ancho, ancho, ancho),
      colisionador: new Box(new Vec3(mitad, mitad, mitad)), base: mitad, radio: ancho / Math.SQRT2,
    };
  }
  return crearConvexo(forma);
}

export function crearObjetos(escena, fisica) {
  return CATALOGO.flatMap((forma) => {
    return Array.from({ length: 5 }, (_, i) => {
      const { geometria, colisionador, base, radio } = recursosFigura(forma);
      const id = forma.id + '-' + String(i + 1).padStart(2, '0');
      const material = new THREE.MeshStandardMaterial({ color: forma.color, roughness: 0.48, metalness: 0.12 });
      const malla = new THREE.Mesh(geometria, material);
      malla.name = forma.nombre + ' ' + (i + 1);
      malla.userData = { tipo: 'pieza', id, categoria: forma.id };
      escena.add(malla);

      const cuerpo = new Body({
        mass: forma.masa, shape: colisionador, material: fisica.materiales.pieza,
        linearDamping: 0.18, angularDamping: 0.45, sleepSpeedLimit: 0.07, sleepTimeLimit: 0.7,
      });
      fisica.mundo.addBody(cuerpo);
      return {
        id, categoria: forma.id, recipienteId: 'recipiente-' + forma.id,
        malla, cuerpo, colisionador, base, radio, masa: forma.masa, origen: null,
        get estadoFisico() {
          return cuerpo.sleepState === Body.SLEEPING ? 'reposo' : 'activo';
        },
      };
    });
  });
}

export function sincronizarObjetos(piezas) {
  for (const { malla, cuerpo } of piezas) {
    malla.position.copy(cuerpo.position);
    malla.quaternion.copy(cuerpo.quaternion);
  }
}

export function colocarCuerpo(cuerpo, x, y, z, giro = 0) {
  cuerpo.position.set(x, y, z);
  cuerpo.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), giro);
  cuerpo.previousPosition.copy(cuerpo.position);
  cuerpo.interpolatedPosition.copy(cuerpo.position);
  cuerpo.previousQuaternion.copy(cuerpo.quaternion);
  cuerpo.interpolatedQuaternion.copy(cuerpo.quaternion);
  cuerpo.velocity.setZero();
  cuerpo.angularVelocity.setZero();
  cuerpo.force.setZero();
  cuerpo.torque.setZero();
  cuerpo.updateInertiaWorld();
  cuerpo.aabbNeedsUpdate = true;
  cuerpo.wakeUp();
}
