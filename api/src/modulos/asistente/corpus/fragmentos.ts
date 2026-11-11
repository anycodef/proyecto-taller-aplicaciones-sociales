import type { Corpus } from "@/lib/asistente";

export const VERSION_CORPUS = "2026-11-10.1";

const VERSION = VERSION_CORPUS;
const FUENTE_BIBLIA = "https://ebible.org/spaRV1909/";
const FUENTE_TRADICION = "Tradición cristiana; texto de dominio público";

export const CORPUS_ASISTENTE: Corpus = {
  version: VERSION_CORPUS,
  fragmentos: [
    {
      id: "padre-nuestro",
      documento: "Sagrada Escritura",
      seccion: "Padre Nuestro (Mateo 6:9-13)",
      texto:
        "Vosotros, pues, oraréis así: Padre nuestro que estás en los cielos, santificado sea tu nombre. Venga tu reino. Sea hecha tu voluntad, como en el cielo, así también en la tierra. El pan nuestro de cada día, dánoslo hoy. Y perdónanos nuestras deudas, como también nosotros perdonamos a nuestros deudores. Y no nos metas en tentación, mas líbranos del mal.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "ave-maria",
      documento: "Oraciones tradicionales",
      seccion: "Ave María",
      texto:
        "Dios te salve, María, llena eres de gracia; el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén.",
      fuente: FUENTE_TRADICION,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "credo-apostoles",
      documento: "Símbolo de los Apóstoles",
      seccion: "Credo de los Apóstoles",
      texto:
        "Creo en Dios Padre todopoderoso, creador del cielo y de la tierra. Creo en Jesucristo, su único Hijo, nuestro Señor, que fue concebido por obra y gracia del Espíritu Santo, nació de Santa María Virgen, padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado, descendió a los infiernos, al tercer día resucitó de entre los muertos, subió a los cielos y está sentado a la derecha de Dios, Padre todopoderoso. Desde allí ha de venir a juzgar a los vivos y a los muertos. Creo en el Espíritu Santo, la santa Iglesia católica, la comunión de los santos, el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén.",
      fuente: FUENTE_TRADICION,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "bautismo",
      documento: "Sagrada Escritura",
      seccion: "Bautismo (Mateo 28:19-20)",
      texto:
        "Por tanto, id, y doctrinad a todos los Gentiles, bautizándolos en el nombre del Padre, y del Hijo, y del Espíritu Santo: enseñándoles que guarden todas las cosas que os he mandado: y he aquí, yo estoy con vosotros todos los días, hasta el fin del mundo. Amén.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "confirmacion",
      documento: "Sagrada Escritura",
      seccion: "Confirmación (Hechos 8:14-17)",
      texto:
        "Y como los apóstoles que estaban en Jerusalem oyeron que Samaria había recibido la palabra de Dios, enviaron allá a Pedro y a Juan; los cuales venidos, oraron por ellos, para que recibiesen el Espíritu Santo; (porque aún no había descendido sobre ninguno de ellos, mas solamente eran bautizados en el nombre de Jesús.) Entonces les impusieron las manos, y recibieron el Espíritu Santo.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "eucaristia",
      documento: "Sagrada Escritura",
      seccion: "Eucaristía (1 Corintios 11:23-26)",
      texto:
        "Porque yo recibí del Señor lo que también os he enseñado: Que el Señor Jesús, la noche que fue entregado, tomó pan; y habiendo dado gracias, lo partió, y dijo: Tomad, comed: esto es mi cuerpo que por vosotros es partido: haced esto en memoria de mí. Asimismo tomó también la copa, después de haber cenado, diciendo: Esta copa es el nuevo pacto en mi sangre: haced esto todas las veces que bebiereis, en memoria de mí. Porque todas las veces que comiereis este pan, y bebiereis esta copa, la muerte del Señor anunciáis hasta que venga.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "reconciliacion",
      documento: "Sagrada Escritura",
      seccion: "Reconciliación (Juan 20:21-23)",
      texto:
        "Entonces Jesús les dijo otra vez: Paz a vosotros. Como me envió el Padre, así también yo os envío. Y como hubo dicho esto, sopló, y dijo: Tomad el Espíritu Santo. A los que remitiereis los pecados, les son remitidos; y a quienes los retuviereis, serán retenidos.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "uncion-enfermos",
      documento: "Sagrada Escritura",
      seccion: "Unción de los enfermos (Santiago 5:14-15)",
      texto:
        "¿Está alguno enfermo entre vosotros? Llame a los ancianos de la iglesia, y oren por él, ungiéndole con aceite en el nombre del Señor. Y la oración de fe salvará al enfermo, y el Señor lo levantará; y si hubiere cometido pecados, le serán perdonados.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "mandamientos",
      documento: "Sagrada Escritura",
      seccion: "Mandamientos (Mateo 22:37-40)",
      texto:
        "Y Jesús le dijo: Amarás al Señor tu Dios de todo tu corazón, y de toda tu alma, y de toda tu mente. Este es el primero y el grande mandamiento. Y el segundo es semejante a éste: Amarás a tu prójimo como a ti mismo. De estos dos mandamientos depende toda la ley y los profetas.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
    {
      id: "bienaventuranzas",
      documento: "Sagrada Escritura",
      seccion: "Bienaventuranzas (Mateo 5:3-10)",
      texto:
        "Bienaventurados los pobres en espíritu: porque de ellos es el reino de los cielos. Bienaventurados los que lloran: porque ellos recibirán consolación. Bienaventurados los mansos: porque ellos recibirán la tierra por heredad. Bienaventurados los que tienen hambre y sed de justicia: porque ellos serán saciados. Bienaventurados los misericordiosos: porque ellos alcanzarán misericordia. Bienaventurados los limpios de corazón: porque ellos verán a Dios. Bienaventurados los pacificadores: porque ellos serán llamados hijos de Dios. Bienaventurados los que padecen persecución por causa de la justicia: porque de ellos es el reino de los cielos.",
      fuente: FUENTE_BIBLIA,
      licencia: "Dominio público",
      version: VERSION,
    },
  ],
};
