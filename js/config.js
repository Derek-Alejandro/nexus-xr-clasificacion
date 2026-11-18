export const MESA = Object.freeze({ ancho: 0.74, fondo: 0.92, altura: 0.78, grosor: 0.065 });
export const RECIPIENTE = Object.freeze({ ancho: 0.48, fondo: 0.42, alto: 0.20, grosor: 0.02, z: -0.21 });

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
