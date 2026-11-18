import { Body, PointToPointConstraint, Vec3 } from 'cannon-es';
import { PASO_FISICO } from './fisica.js';

const VELOCIDAD_ANCLA = 1.15;
const VELOCIDAD_SUJETA = 1.45;
const VELOCIDAD_LIBRE = 1.2;
const VELOCIDAD_ANGULAR = 5;
const FUERZA_POR_EJE = 18;

function limitar(vector, maximo) {
  const magnitud = vector.length();
  if (magnitud > maximo) vector.scale(maximo / magnitud, vector);
}

export function crearAgarres(mundo) {
  const porMano = new Map();
  const piezasSujetadas = new Set();

  return {
    estaSujeta(pieza) {
      return piezasSujetadas.has(pieza);
    },
    iniciar(mano, pieza, punto) {
      if (porMano.has(mano) || piezasSujetadas.has(pieza) || pieza.cuerpo.type !== Body.DYNAMIC) return false;
      const cuerpo = pieza.cuerpo;
      const objetivo = new Vec3(punto.x, punto.y, punto.z);
      const pivote = cuerpo.pointToLocalFrame(objetivo);
      const ancla = new Body({
        type: Body.KINEMATIC, position: objetivo, collisionFilterMask: 0, allowSleep: false,
      });
      // GSSolver limita el impulso del subpaso en cada ecuación.
      const restriccion = new PointToPointConstraint(cuerpo, pivote, ancla, new Vec3(), FUERZA_POR_EJE * PASO_FISICO);
      mundo.addBody(ancla);
      mundo.addConstraint(restriccion);
      porMano.set(mano, { pieza, ancla, restriccion, objetivo });
      piezasSujetadas.add(pieza);
      cuerpo.wakeUp();
      return true;
    },
    apuntar(mano, punto) {
      const agarre = porMano.get(mano);
      if (agarre && Number.isFinite(punto.x) && Number.isFinite(punto.y) && Number.isFinite(punto.z)) {
        agarre.objetivo.set(punto.x, Math.max(0.10, Math.min(2.7, punto.y)), punto.z);
      }
    },
    antesDePaso(dt) {
      for (const { pieza, ancla, objetivo } of porMano.values()) {
        // La velocidad integra la trayectoria del ancla en el mismo paso que las colisiones.
        objetivo.vsub(ancla.position, ancla.velocity);
        ancla.velocity.scale(-Math.expm1(-14 * dt) / dt, ancla.velocity);
        limitar(ancla.velocity, VELOCIDAD_ANCLA);
        pieza.cuerpo.wakeUp();
      }
    },
    despuesDePaso() {
      for (const { cuerpo } of piezasSujetadas) {
        limitar(cuerpo.velocity, VELOCIDAD_SUJETA);
        limitar(cuerpo.angularVelocity, VELOCIDAD_ANGULAR);
      }
    },
    terminar(mano, voluntario) {
      const agarre = porMano.get(mano);
      if (!agarre) return false;
      const { pieza, restriccion, ancla } = agarre;
      mundo.removeConstraint(restriccion);
      mundo.removeBody(ancla);
      porMano.delete(mano);
      piezasSujetadas.delete(pieza);
      const { cuerpo } = pieza;
      if (voluntario) {
        limitar(cuerpo.velocity, VELOCIDAD_LIBRE);
        limitar(cuerpo.angularVelocity, VELOCIDAD_ANGULAR);
      } else {
        cuerpo.velocity.setZero();
        cuerpo.angularVelocity.setZero();
      }
      cuerpo.wakeUp();
      return true;
    },
    cancelarTodo() {
      for (const mano of porMano.keys()) this.terminar(mano, false);
    },
  };
}
