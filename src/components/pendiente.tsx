/**
 * Marca una pantalla que ya tiene ruta y contrato de datos definidos, pero
 * cuya implementacion llega en la fase de prototipado.
 */
export function Pendiente({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-dashed border-gray-300 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Pendiente de prototipado
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
        {items.map((item) => (
          <li key={item}>&bull; {item}</li>
        ))}
      </ul>
    </section>
  );
}
