export const MESA = Object.freeze({ ancho: 0.74, fondo: 0.92, altura: 0.78, grosor: 0.065 });
export const RECIPIENTE = Object.freeze({ ancho: 0.48, fondo: 0.42, alto: 0.20, grosor: 0.02, z: -0.21 });

export const FISICA = Object.freeze({
  gravedad: -9.81, paso: 1 / 60, subpasos: 4, saltoMaximo: 0.25,
  amortiguacionLineal: 0.33, amortiguacionAngular: 0.58,
  velocidadReposo: 0.07, tiempoReposo: 0.7,
  contactos: Object.freeze({
    pieza: [0.38, 0.10], soporte: [0.62, 0.08], recipiente: [0.55, 0.04],
  }),
  agarre: Object.freeze({
    velocidadAncla: 0.95, velocidadSujeta: 1.45, velocidadLibre: 1.5,
    velocidadAngular: 3.5, velocidadAngularLibre: 2.5,
    inerciaLiberacion: 0.78, fuerzaPorEje: 14, suavizado: 12,
    alturaMinima: 0.10, alturaMaxima: 2.7,
  }),
  recuperacion: Object.freeze({
    alturaPiso: 0.21, velocidadPiso: 0.30, esperaPiso: 0.8,
    yMin: -0.25, xMax: 4.1, zMin: -5.1, zMax: 3.1,
  }),
});

export const CLASIFICACION = Object.freeze({
  tolerancia: 0.006, estabilidad: 0.5, velocidad: 0.05, velocidadAngular: 0.25, avisoMs: 2200,
});

export const MESAS = Object.freeze([
  { id: 'm1', x: -1.22, z: -1.24, categoria: 'esfera' },
  { id: 'm2', x: -0.41, z: -1.58, categoria: 'cubo' },
  { id: 'm3', x: 0.41, z: -1.58, categoria: 'piramide' },
  { id: 'm4', x: 1.22, z: -1.24, categoria: 'prisma' },
]);

export const CATALOGO = Object.freeze([
  { id: 'esfera', nombre: 'Esfera', simbolo: '●', color: 0x46dfee, ancho: 0.12, alto: 0.12, masa: 0.20 },
  { id: 'cubo', nombre: 'Cubo', simbolo: '■', color: 0xffb747, ancho: 0.12, alto: 0.12, masa: 0.24 },
  { id: 'piramide', nombre: 'Pirámide', simbolo: '▲', color: 0xf45cc7, ancho: 0.13, alto: 0.14, masa: 0.18 },
  { id: 'prisma', nombre: 'Prisma hexagonal', simbolo: '⬢', color: 0xb190ff, ancho: 0.13, alto: 0.12, masa: 0.22 },
]);
