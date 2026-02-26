/* Storage simples (POC) para CRUD mock em localStorage */

const PocStore = (() => {
  const PREFIX = "poc_store_v1:";

  function key(entity) {
    return `${PREFIX}${entity}`;
  }

  function load(entity) {
    try {
      const raw = localStorage.getItem(key(entity));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(entity, list) {
    localStorage.setItem(key(entity), JSON.stringify(list || []));
  }

  function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function add(entity, item) {
    const list = load(entity);
    const now = new Date().toISOString();
    const newItem = { id: uid(), createdAt: now, ...item };
    list.unshift(newItem);
    save(entity, list);
    return newItem;
  }

  function update(entity, id, data) {
    const list = load(entity);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    save(entity, list);
    return true;
  }

  function remove(entity, id) {
    const list = load(entity);
    const next = list.filter((x) => x.id !== id);
    save(entity, next);
    return next.length !== list.length;
  }

  function clear(entity) {
    localStorage.removeItem(key(entity));
  }

  return { load, save, add, remove, update, clear };
})();


