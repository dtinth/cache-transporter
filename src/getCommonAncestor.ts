import { resolve, relative, sep } from "path";

export function getCommonAncestor(absolutePaths: string[]) {
  const pairwise = (a: string, b: string): string => {
    return relative(a, b)
      .split(sep)
      .reduce((x, y) => (y === ".." ? resolve(x, y) : x), a);
  };
  return absolutePaths.reduce(pairwise);
}
