import { GrupoOpciones } from "@/components/ui";
import { CAUSAS, ETIQUETAS_CAUSA, esCausaValida } from "@/lib/justificaciones/causas";
import type { Causa } from "@/lib/justificaciones/tipos";

export interface PropiedadesSelectorCausa {
  valor: Causa | null;
  alCambiar: (causa: Causa) => void;
}

const OPCIONES = CAUSAS.map((causa) => ({ valor: causa, etiqueta: ETIQUETAS_CAUSA[causa] }));

/** Las tres causas de la ficha de compromiso; viajes o fiestas no justifican (RF-402). */
export function SelectorCausa({ valor, alCambiar }: PropiedadesSelectorCausa) {
  return (
    <GrupoOpciones
      etiqueta="Motivo de la ausencia"
      opciones={OPCIONES}
      valor={valor}
      alCambiar={(elegido) => {
        if (esCausaValida(elegido)) alCambiar(elegido);
      }}
    />
  );
}
