export const BUSINESS_TIME_ZONE = "America/Santiago";

const formatter = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function businessDate(value = new Date()) {
  if (value == null || value === "") throw new Error("Fecha inválida");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha inválida");
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Usa una fecha YYYY-MM-DD");
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Fecha de calendario inválida");
  return date;
}

const dateKey = (date) => date.toISOString().slice(0, 10);

// Aritmética de calendario, sin asumir que todos los días locales duran 24 horas.
export function createPeriod({ type, date = businessDate(), endDate } = {}) {
  const start = calendarDate(date);
  const end = new Date(start);
  if (type === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (type === "month") {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (type === "range") {
    end.setTime(calendarDate(endDate).getTime());
    if (end < start) throw new Error("El fin del período no puede preceder al inicio");
  } else if (type !== "day") {
    throw new Error("Período inválido");
  }
  return { type, startDate: dateKey(start), endDate: dateKey(end), timeZone: BUSINESS_TIME_ZONE };
}

export function isInPeriod(instant, period) {
  if (!instant) return false;
  const date = businessDate(instant);
  return date >= period.startDate && date <= period.endDate;
}
