export function createLatestRequestGate() {
  let generation = 0;
  return Object.freeze({
    begin() {
      const ownGeneration = ++generation;
      return Object.freeze({
        isCurrent: () => ownGeneration === generation,
      });
    },
    invalidate() {
      generation += 1;
    },
  });
}

export function createSingleFlightGate() {
  let active = false;
  return Object.freeze({
    tryStart() {
      if (active) return false;
      active = true;
      return true;
    },
    finish() {
      active = false;
    },
    isActive() {
      return active;
    },
  });
}
