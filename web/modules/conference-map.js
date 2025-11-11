/**
 * Small focused module to manage conference maps.
 *
 * Exported API:
 * - createConferenceMap(conferences): pure function returning a new map object
 * - setConferenceMap(conferences): stores a frozen snapshot for backwards compat
 * - getConferenceMap([conferences]): returns fresh map if conferences passed,
 *   otherwise returns stored snapshot or {}
 */

export function createConferenceMap(conferences) {
  const map = {};
  for (const conf of conferences || []) {
    map[conf.id] = { shortName: conf.shortName, name: conf.name };
  }
  return map;
}

let _snapshot = null;

export function setConferenceMap(conferences) {
  _snapshot = Object.freeze(createConferenceMap(conferences));
}

export function getConferenceMap(conferences) {
  if (conferences) return createConferenceMap(conferences);
  return _snapshot || {};
}

export default {
  createConferenceMap,
  setConferenceMap,
  getConferenceMap,
};
