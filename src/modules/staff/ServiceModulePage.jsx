import StaffShell from "./StaffShell";
import { FilterBar, RecordList, StateMessage } from "../../shared/ui";
import { useSession } from "./SessionContext";

export default function ServiceModulePage({ title, description, resource }) {
  const { records, status } = resource;
  const { views, updateView } = useSession();
  const query = views[title]?.query ?? "";
  const setQuery = (value) => updateView(title, { query: value });
  const filtered = records.filter((record) => String(record.number ?? record.name ?? record.id).toLowerCase().includes(query.toLowerCase()));
  return <StaffShell title={title} description={description} back="/staff/admin"><FilterBar query={query} onQueryChange={setQuery} label="Buscar registro" />{status === "loading" ? <StateMessage title="Cargando registros…" /> : status === "error" ? <StateMessage title="No se pudieron cargar los registros" kind="error">Vuelve al panel e inténtalo nuevamente.</StateMessage> : <RecordList items={filtered} emptyTitle={query ? "Sin coincidencias" : "Todavía no hay registros"} emptyMessage="Este módulo está preparado para incorporar la gestión en su etapa correspondiente." renderItem={(record) => <span>{record.number ?? record.name ?? record.id}</span>} />}</StaffShell>;
}
