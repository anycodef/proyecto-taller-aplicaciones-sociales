import { GrupoOpciones } from '@/components/ui';

export interface OpcionCausa {
  valor: string;
  etiqueta: string;
}

export interface PropiedadesSelectorCausa {
  /** Las causas llegan del dominio; el componente no decide cuáles se admiten. */
  causas: readonly OpcionCausa[];
  valor: string | null;
  alCambiar: (causa: string) => void;
  /** null cuando la pantalla ya muestra la pregunta en su propio encabezado. */
  etiqueta?: string | null;
}

export function SelectorCausa({ causas, valor, alCambiar, etiqueta = "¿Por qué faltó?" }: PropiedadesSelectorCausa) {
  return <GrupoOpciones etiqueta={etiqueta ?? undefined} opciones={causas} valor={valor} alCambiar={alCambiar} />;
}
