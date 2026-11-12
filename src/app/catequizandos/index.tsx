import { Redirect, type Href } from "expo-router";

/** Antes listaba solo grupos y, al tocar uno, se reabría a sí misma. La lista real de niños es «Mis catequizandos». */
export default function ListaCatequizandos() {
  return <Redirect href={"/mis-catequizandos" as Href} />;
}
