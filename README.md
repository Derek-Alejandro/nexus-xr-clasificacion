# NEXUS XR 3.2 — Interacción virtual

**Laboratorio Inmersivo de Clasificación Geométrica con Física**

El laboratorio tiene cuatro mesas, veinte figuras dinámicas y cuatro recipientes abiertos. En escritorio puedes inspeccionar el escenario, observar caídas y generar otra distribución. En VR, apunta con cualquiera de las manos, junta pulgar e índice para agarrar, desplaza la mano y abre la pinza para soltar. Los botones **Reiniciar** y **Salir de VR** se activan con el mismo rayo y gesto.

## Ejecutar en Google Chrome con Live Server

1. Abre la carpeta `nexus-xr-clasificacion-32` en Visual Studio Code.
2. Abre `index.html` con **Open with Live Server** y visita en Google Chrome la dirección local que muestra la extensión.
3. Espera el indicador **Three.js y cannon-es cargados · Simulación física activa**. Se requiere acceso a jsDelivr para Three.js 0.183.0, cannon-es 0.20.0 y Bootstrap 5.3.8.
4. Arrastra para orbitar y usa la rueda o un gesto de dos dedos para acercarte. **Pantalla completa** amplía la vista.
5. Usa **Probar caída** para colocar una figura sobre cada boca y observar cómo cae y descansa por efecto de la simulación. **Redistribuir** devuelve las veinte figuras a las cubiertas en una disposición nueva.

Los módulos son nativos del navegador y se publican como archivos estáticos, sin instalación de dependencias ni compilación. Para WebXR en Quest 3, sirve la carpeta independiente por HTTPS, por ejemplo mediante GitHub Pages. La dirección HTTP de la computadora en la red local sirve para inspección de escritorio. WebXR requiere un contexto seguro.

## Implementación física

- El mundo de cannon-es aplica gravedad de −4,2 m/s² y avanza a 1/60 s con hasta cuatro subpasos por cuadro. Las figuras pesan entre 0,08 y 0,14 kg, con amortiguación lineal de 0,05, angular de 0,08 y restitución de 0,10 en los recipientes. Los valores se ajustan en `js/config.js`.
- El piso, las mesas y los recipientes son estáticos. Cada recipiente tiene cinco colisionadores, una base y cuatro paredes. El volumen útil es un conjunto de coordenadas para la etapa 5.
- Hay cinco esferas cian, cinco cubos ámbar, cinco pirámides magenta y cinco prismas hexagonales violetas. Cada figura conserva su ID. Las esferas y los cubos usan primitivas. La pirámide y el prisma usan poliedros convexos definidos por los mismos vértices que su malla.
- Cada mesa recibe una figura de cada categoría y una adicional. El generador por semilla baraja la categoría extra, los IDs, las posiciones y las orientaciones, verificando las huellas antes de colocar los cuerpos. El reinicio reutiliza los cuerpos y las mallas.
- La pinza conserva el punto de contacto y la distancia inicial del rayo. El ancla cinemática se aproxima al objetivo a un máximo de 1,65 m/s. La restricción limita el impulso según la masa y conserva los contactos. Al soltar, se limita la velocidad lineal a 1,6 m/s y la angular a 2,5 rad/s. Ante pérdida de seguimiento se retira la restricción y se anulan las velocidades antes de que actúe la gravedad.
- Si una figura libre sale de los límites del escenario o se estabiliza en el suelo, vuelve a una posición libre de su mesa de origen. Si la mesa está temporalmente ocupada, espera a que haya espacio. Las figuras depositadas en recipientes se mantienen allí mediante colisión.

## Clasificación y cronómetro

Pulsa **Comenzar** en VR. Puedes soltar la figura dentro del recipiente o por encima de la boca. El HUD confirma el depósito tras 0,25 s de permanencia, con una tolerancia espacial de 2,5 cm y velocidades residuales admisibles. Una figura apoyada contra una pared interior puede contar. Cada acierto suma al progreso y cada error confirmado resta un punto de los 20 disponibles. Las caídas fuera de un recipiente no cuentan como intentos.

El cronómetro se pausa al salir u ocultar la sesión, se reanuda al volver y se detiene al llegar a 20 aciertos. Cada recipiente muestra **Pendiente** hasta su quinto acierto. **Reiniciar** genera otra distribución y restaura las métricas.

Consulta [PRUEBAS.md](./PRUEBAS.md) para ejecutar la suite y repetir la verificación en Quest 3.

## Créditos

Derek Alejandro Vargas Meneses · ITIC · No. de Control 22200792 · TecNM Campus Pachuca.
