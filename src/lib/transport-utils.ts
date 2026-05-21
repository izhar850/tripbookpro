export type SortDirection = "asc" | "desc";

export type SortConfig<TKey extends string> = {
  key: TKey;
  direction: SortDirection;
};

type SortValue = string | number | Date | null | undefined;

export function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeMultiline(value: unknown) {
  return String(value ?? "").trim().replace(/[ \t]+/g, " ");
}

export function normalizeVehicleNo(value: unknown) {
  return normalizeText(value).toUpperCase();
}

export function normalizeGstNo(value: unknown) {
  return normalizeText(value).toUpperCase();
}

export function isValidGstNo(value: unknown) {
  const gstNo = normalizeGstNo(value);
  if (!gstNo) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNo);
}

export function isValidMobile(value: unknown) {
  const mobile = normalizeText(value);
  if (!mobile) return true;
  return /^\d{10}$/.test(mobile);
}

export function isValidDateInput(value: unknown) {
  const date = normalizeText(value);
  if (!date) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isRequiredNumeric(value: unknown) {
  const text = normalizeText(value);
  return text !== "" && Number.isFinite(Number(text));
}

export function isOptionalNumeric(value: unknown) {
  const text = normalizeText(value);
  return text === "" || Number.isFinite(Number(text));
}

export function getTimestampMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareSortValues(a: SortValue, b: SortValue) {
  const aTime = a instanceof Date ? a.getTime() : typeof a === "object" ? getTimestampMillis(a) : 0;
  const bTime = b instanceof Date ? b.getTime() : typeof b === "object" ? getTimestampMillis(b) : 0;
  if (aTime || bTime) return aTime - bTime;

  if (typeof a === "number" || typeof b === "number") {
    return Number(a || 0) - Number(b || 0);
  }

  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortRows<T, TKey extends string>(
  rows: T[],
  sort: SortConfig<TKey>,
  getters: Record<TKey, (row: T) => SortValue>
) {
  const getValue = getters[sort.key];
  return [...rows].sort((a, b) => {
    const result = compareSortValues(getValue(a), getValue(b));
    return sort.direction === "asc" ? result : -result;
  });
}

export function nextSortDirection<TKey extends string>(
  current: SortConfig<TKey>,
  key: TKey
): SortDirection {
  return current.key === key && current.direction === "asc" ? "desc" : "asc";
}
