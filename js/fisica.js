import { Body, Box, ContactMaterial, Material, Vec3, World } from 'cannon-es';

export const PASO_FISICO = 1 / 60;
const MAX_SUBPASOS = 4;

export function agregarCaja(cuerpo, ancho, alto, fondo, x = 0, y = 0, z = 0) {
  cuerpo.addShape(new Box(new Vec3(ancho / 2, alto / 2, fondo / 2)), new Vec3(x, y, z));
}

export function crearFisica() {
  const mundo = new World({ gravity: new Vec3(0, -9.81, 0), allowSleep: true });
  const materiales = {
    pieza: new Material('figura'),
    soporte: new Material('mesa y piso'),
    recipiente: new Material('recipiente'),
  };
  for (const [superficie, friction, restitution] of [
    [materiales.pieza, 0.33, 0.16],
    [materiales.soporte, 0.55, 0.14],
    [materiales.recipiente, 0.48, 0.10],
  ]) {
    mundo.addContactMaterial(new ContactMaterial(materiales.pieza, superficie, { friction, restitution }));
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
      if (!Number.isFinite(delta) || delta < 0 || delta > 0.25) {
        acumulado = 0;
        return false;
      }
      acumulado = Math.min(acumulado + delta, PASO_FISICO * MAX_SUBPASOS);
      let subpasos = 0;
      while (acumulado + 1e-9 >= PASO_FISICO && subpasos < MAX_SUBPASOS) {
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
