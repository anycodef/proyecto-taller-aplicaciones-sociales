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
}

export function SelectorCausa({ causas, valor, alCambiar }: PropiedadesSelectorCausa) {
  return <GrupoOpciones etiqueta="¿Por qué faltó?" opciones={causas} valor={valor} alCambiar={alCambiar} />;
}
