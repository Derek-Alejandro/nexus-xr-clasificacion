import * as THREE from 'three';
import { CATALOGO, MESA, MESAS, RECIPIENTE } from './config.js';
import { agregarCaja } from './fisica.js';
import { crearSuperficieTexto } from './panel-vr.js';

export function crearMobiliario(escena, fisica) {
  const caja = new THREE.BoxGeometry(1, 1, 1);
  const grafito = new THREE.MeshStandardMaterial({ color: 0x283d53, roughness: 0.75 });
  const azul = new THREE.MeshStandardMaterial({ color: 0x142436, roughness: 0.85 });
  const cian = new THREE.MeshBasicMaterial({ color: 0x45cfe3 });
  const superficies = [];
  const cuerposMesas = [];
  const recipientes = [];

  function bloque(material, ancho, alto, fondo, x, y, z, bloqueaRayo = false) {
    const malla = new THREE.Mesh(caja, material);
    malla.scale.set(ancho, alto, fondo);
    malla.position.set(x, y, z);
    escena.add(malla);
    if (bloqueaRayo) superficies.push(malla);
  }

  bloque(azul, 8, 0.16, 8, 0, -0.08, -1);
  const piso = fisica.agregarEstatico(0, -0.08, -1);
  agregarCaja(piso, 8, 0.16, 8);

  bloque(azul, 8, 2.8, 0.1, 0, 1.4, -3.2);
  bloque(grafito, 4.8, 1.8, 0.06, 0, 1.42, -3.12);
  bloque(cian, 4.8, 0.009, 0.02, 0, 2.33, -3.08);
  const cuadricula = new THREE.GridHelper(7, 28, 0x30516a, 0x23394e);
  cuadricula.position.set(0, 0.001, -0.28);
  escena.add(cuadricula);

  for (const mesa of MESAS) {
    const { x, z } = mesa;
    const yCubierta = MESA.altura - MESA.grosor / 2;
    bloque(grafito, MESA.ancho, MESA.grosor, MESA.fondo, x, yCubierta, z, true);
    const soporte = fisica.agregarEstatico(x, yCubierta, z);
    cuerposMesas.push(soporte);
    agregarCaja(soporte, MESA.ancho, MESA.grosor, MESA.fondo);

    for (const lado of [-1, 1]) {
      const xPata = lado * 0.26;
      const altoPata = MESA.altura - MESA.grosor;
      bloque(azul, 0.095, altoPata, 0.68, x + xPata, altoPata / 2, z, true);
      agregarCaja(soporte, 0.095, altoPata, 0.68, xPata, altoPata / 2 - yCubierta);
    }
    bloque(cian, 0.68, 0.008, 0.008, x, MESA.altura - 0.025, z + MESA.fondo / 2 + 0.002);

    const categoria = CATALOGO.find(({ id }) => id === mesa.categoria);
    const { ancho, fondo, alto, grosor } = RECIPIENTE;
    const y = MESA.altura;
    const centroZ = z + RECIPIENTE.z;
    const cuerpo = fisica.agregarEstatico(x, y, centroZ, fisica.materiales.recipiente);
    const material = new THREE.MeshStandardMaterial({ color: categoria.color, roughness: 0.62, metalness: 0.18 });
    const colorEtiqueta = '#' + categoria.color.toString(16).padStart(6, '0');

    function lado(materialLado, anchoLado, altoLado, fondoLado, dx, dy, dz) {
      bloque(materialLado, anchoLado, altoLado, fondoLado, x + dx, y + dy, centroZ + dz, true);
      agregarCaja(cuerpo, anchoLado, altoLado, fondoLado, dx, dy, dz);
    }

    lado(azul, ancho + 2 * grosor, grosor, fondo + 2 * grosor, 0, grosor / 2, 0);
    for (const signo of [-1, 1]) {
      lado(material, grosor, alto, fondo, signo * (ancho + grosor) / 2, grosor + alto / 2, 0);
      lado(material, ancho + 2 * grosor, alto, grosor, 0, grosor + alto / 2, signo * (fondo + grosor) / 2);
    }

    const { malla } = crearSuperficieTexto(0.46, 0.085, 480, (ctx, w, h) => {
      ctx.fillStyle = '#101c2d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colorEtiqueta;
      ctx.font = 'bold 33px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(categoria.simbolo + '  ' + categoria.nombre, w / 2, h / 2, w - 24);
    });
    malla.position.set(x, y + grosor + alto * 0.60, centroZ + fondo / 2 + grosor + 0.001);
    escena.add(malla);

    const interior = {
      min: { x: -ancho / 2, y: grosor, z: -fondo / 2 },
      max: { x: ancho / 2, y: grosor + alto, z: fondo / 2 },
    };
    recipientes.push({
      id: 'recipiente-' + categoria.id, categoria: categoria.id, mesaId: mesa.id, cuerpo, material, interior,
      volumen: {
        min: { x: x + interior.min.x, y: y + interior.min.y, z: centroZ + interior.min.z },
        max: { x: x + interior.max.x, y: y + interior.max.y, z: centroZ + interior.max.z },
      },
    });
  }
  return { piso, cuerposMesas, recipientes, superficies };
}
