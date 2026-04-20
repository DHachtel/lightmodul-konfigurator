const STORAGE_KEY = 'artmodul_offer_items';

/** Einzelnes Warenkorb-Element mit Menge */
export interface CartItem {
  code: number;
  qty: number;
}

/** Liest Cart-Items aus localStorage; migriert automatisch vom alten number[]-Format */
function read(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    // Rückwärts-Kompatibilität: altes Format war number[]
    if (arr.length > 0 && typeof arr[0] === 'number') {
      const migrated: CartItem[] = (arr as number[])
        .filter((v): v is number => typeof v === 'number')
        .map(code => ({ code, qty: 1 }));
      write(migrated);
      return migrated;
    }

    // Neues Format: CartItem[]
    return arr.filter(
      (v): v is CartItem =>
        typeof v === 'object' && v !== null &&
        typeof (v as CartItem).code === 'number' &&
        typeof (v as CartItem).qty === 'number',
    );
  } catch {
    return [];
  }
}

function write(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Gibt alle Warenkorb-Einträge mit Mengen zurück */
export function getOfferItems(): CartItem[] {
  return read();
}

/** Fügt Code hinzu (qty=1) oder erhöht Menge wenn bereits vorhanden */
export function addOfferItem(code: number): void {
  const items = read();
  const existing = items.find(i => i.code === code);
  if (existing) {
    existing.qty += 1;
    write(items);
  } else {
    write([...items, { code, qty: 1 }]);
  }
}

/** Entfernt Eintrag komplett */
export function removeOfferItem(code: number): void {
  write(read().filter(i => i.code !== code));
}

/** Setzt Menge; entfernt bei qty <= 0 */
export function setItemQty(code: number, qty: number): void {
  if (qty <= 0) {
    removeOfferItem(code);
    return;
  }
  const items = read();
  const existing = items.find(i => i.code === code);
  if (existing) {
    existing.qty = qty;
    write(items);
  }
}

/** Leert den gesamten Warenkorb */
export function clearOfferItems(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Anzahl einzigartiger Möbel im Warenkorb */
export function getOfferCount(): number {
  return read().length;
}
