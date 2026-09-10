import Link from "next/link";

type Props = {
  rol: string;
  titulo: string;
  descripcion: string;
};

export function EncabezadoPantalla({ rol, titulo, descripcion }: Props) {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/"
        className="text-xs font-medium uppercase tracking-widest text-blue-900"
      >
        &larr; {rol}
      </Link>
      <h1 className="text-2xl font-semibold text-balance">{titulo}</h1>
      <p className="text-sm text-gray-600">{descripcion}</p>
    </header>
  );
}
