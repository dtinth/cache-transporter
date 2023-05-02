export const createTimer = (start = performance.now()) => {
  return () => {
    const elapsed = performance.now() - start;
    return `${(elapsed / 1000).toFixed(3)}s`;
  };
};
