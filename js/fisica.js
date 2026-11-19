import { Body, Box, ContactMaterial, Material, Vec3, World } from 'cannon-es';
import { FISICA } from './config.js';

export const PASO_FISICO = FISICA.paso;

export function agregarCaja(cuerpo, ancho, alto, fondo, x = 0, y = 0, z = 0) {
  cuerpo.addShape(new Box(new Vec3(ancho / 2, alto / 2, fondo / 2)), new Vec3(x, y, z));
}

export function crearFisica() {
  const mundo = new World({ gravity: new Vec3(0, FISICA.gravedad, 0), allowSleep: true });
  const materiales = {
    pieza: new Material('figura'),
    soporte: new Material('mesa y piso'),
    recipiente: new Material('recipiente'),
  };
  for (const [tipo, [friction, restitution]] of Object.entries(FISICA.contactos)) {
    mundo.addContactMaterial(new ContactMaterial(materiales.pieza, materiales[tipo], { friction, restitution }));
  }

  let anterior = null;
  let acumulado = 0;

  function agregarEstatico(x, y, z, material = materiales.soporte) {
    const cuerpo = new Body({ mass: 0, material, position: new Vec3(x, y, z) });
    mundo.addBody(cuerpo);
    return cuerpo;
  }

  return {
    mundo, materiales, agregarEstatico,
    interrumpir() {
      anterior = null;
      acumulado = 0;
    },
    avanzar(tiempo, antesDePaso, despuesDePaso) {
      const delta = anterior === null ? 0 : (tiempo - anterior) / 1000;
      anterior = tiempo;
      if (!Number.isFinite(delta) || delta < 0 || delta > FISICA.saltoMaximo) {
        acumulado = 0;
        return false;
      }
      acumulado = Math.min(acumulado + delta, PASO_FISICO * FISICA.subpasos);
      let subpasos = 0;
      while (acumulado + 1e-9 >= PASO_FISICO && subpasos < FISICA.subpasos) {
        antesDePaso?.(PASO_FISICO);
        mundo.step(PASO_FISICO);
        despuesDePaso?.(PASO_FISICO);
        acumulado -= PASO_FISICO;
        subpasos++;
      }
      return subpasos > 0;
    },
    liberar() {
      for (const cuerpo of [...mundo.bodies]) mundo.removeBody(cuerpo);
    },
  };
}
