import { MESA, MESAS, RECIPIENTE } from './config.js';
import { distribuirPiezas } from './distribucion.js';
import { colocarCuerpo, sincronizarObjetos } from './objetos.js';

export function crearLaboratorio(fisica, piezas, mobiliario, semillaInicial) {
  let semilla = semillaInicial ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const { recipientes } = mobiliario;
  const piezasPorId = new Map(piezas.map((pieza) => [pieza.id, pieza]));
  const tiempoEnPiso = new Map();

  function redistribuir() {
    tiempoEnPiso.clear();
    distribuirPiezas(piezas, semilla);
    fisica.interrumpir();
  }

  function fueraDeSala({ x, y, z }) {
    return y < -0.25 || Math.abs(x) > 4.1 || z < -5.1 || z > 3.1;
  }

  function recuperar(pieza) {
    const mesa = MESAS.find(({ id }) => id === pieza.origen.mesaId);
    // Las poses de partida ya están separadas de las paredes y los recipientes.
    const poses = [pieza.origen, ...piezas.filter((otra) => otra !== pieza && otra.origen.mesaId === pieza.origen.mesaId)
      .map(({ origen }) => origen)];
    for (const { x, z, giro } of poses) {
      const radio = pieza.radio + 0.008;
      const zLocal = z - mesa.z;
      if (Math.abs(x - mesa.x) + radio > MESA.ancho / 2 || zLocal + radio > MESA.fondo / 2
        || zLocal - radio < RECIPIENTE.z + RECIPIENTE.fondo / 2 + RECIPIENTE.grosor) continue;
      const libre = piezas.every((otra) => {
        if (otra === pieza) return true;
        const { cuerpo } = otra;
        if (cuerpo.aabbNeedsUpdate) cuerpo.updateAABB();
        const { lowerBound: min, upperBound: max } = cuerpo.aabb;
        return max.x < x - radio || min.x > x + radio || max.z < z - radio || min.z > z + radio
          || max.y < pieza.origen.y - pieza.base || min.y > pieza.origen.y + 0.15;
      });
      if (!libre) continue;
      colocarCuerpo(pieza.cuerpo, x, pieza.origen.y, z, giro);
      tiempoEnPiso.delete(pieza);
      console.info('NEXUS XR · Figura recuperada en su mesa de origen', pieza.id);
      return;
    }
  }

  function recuperarFueraDeMesa(dt, agarres) {
    for (const pieza of piezas) {
      const { position, velocity } = pieza.cuerpo;
      if (agarres?.estaSujeta(pieza) || (position.y > 0.21 && !fueraDeSala(position))) {
        tiempoEnPiso.delete(pieza);
        continue;
      }
      if (fueraDeSala(position)) {
        recuperar(pieza);
      } else if (velocity.lengthSquared() < 0.09) {
        const espera = (tiempoEnPiso.get(pieza) ?? 0) + dt;
        tiempoEnPiso.set(pieza, espera);
        if (espera >= 0.8) recuperar(pieza);
      } else {
        tiempoEnPiso.delete(pieza);
      }
    }
  }

  redistribuir();
  return {
    piezas, piezasPorId, ...mobiliario,
    get semilla() { return semilla; },
    reiniciar() {
      semilla = (semilla + 1) >>> 0;
      redistribuir();
    },
    paso(tiempo, agarres) {
      if (piezas.every(({ estadoFisico, cuerpo }) =>
        estadoFisico === 'reposo' && cuerpo.position.y > 0.21 && !fueraDeSala(cuerpo.position))) {
        fisica.interrumpir();
        return false;
      }
      if (!fisica.avanzar(tiempo, agarres?.antesDePaso, (dt) => {
        agarres?.despuesDePaso();
        recuperarFueraDeMesa(dt, agarres);
      })) return false;
      sincronizarObjetos(piezas);
      return true;
    },
    probarCaida() {
      const ocupadas = recipientes.some(({ volumen: { min, max } }) => piezas.some(({ cuerpo }) => {
        if (cuerpo.aabbNeedsUpdate) cuerpo.updateAABB();
        const { lowerBound, upperBound } = cuerpo.aabb;
        return upperBound.x > min.x && lowerBound.x < max.x
          && upperBound.z > min.z && lowerBound.z < max.z
          && upperBound.y > min.y && lowerBound.y < max.y + 0.45;
      }));
      if (ocupadas) return false;
      for (const { categoria, volumen } of recipientes) {
        const { min, max } = volumen;
        const pieza = piezas.find((figura) => figura.categoria === categoria);
        colocarCuerpo(pieza.cuerpo, (min.x + max.x) / 2, max.y + 0.28, (min.z + max.z) / 2, pieza.origen.giro);
      }
      sincronizarObjetos(piezas);
      fisica.interrumpir();
      return true;
    },
  };
}
