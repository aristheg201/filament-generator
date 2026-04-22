export function pushMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

export function addEdge(map: Map<string, Set<string>>, from: string, to: string): void {
  const list = map.get(from);
  if (list) {
    list.add(to);
  } else {
    map.set(from, new Set([to]));
  }
}
