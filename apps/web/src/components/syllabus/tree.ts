import type { SyllabusNode } from '@/lib/types';

export interface FlatNode {
  node: SyllabusNode;
  depth: number;
}

/** Depth-first list of every node, used for the "Parent" picker. */
export const flatten = (nodes: SyllabusNode[], depth = 0): FlatNode[] =>
  nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);

export const descendantIds = (node: SyllabusNode): Set<string> => {
  const ids = new Set<string>();
  const walk = (current: SyllabusNode) => {
    for (const child of current.children) {
      ids.add(child.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
};

export const countDescendants = (node: SyllabusNode): number => descendantIds(node).size;

/** Items directly attached to a node plus everything beneath it. */
export const totalItems = (node: SyllabusNode): number =>
  node.studyItemCount + node.children.reduce((sum, child) => sum + totalItems(child), 0);

/**
 * Keeps a node when its title matches, or when any descendant matches. A
 * matching node keeps its whole subtree so you can see what sits beneath it.
 */
export const filterTree = (nodes: SyllabusNode[], query: string): SyllabusNode[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const walk = (list: SyllabusNode[]): SyllabusNode[] =>
    list.flatMap((node) => {
      if (node.title.toLowerCase().includes(needle)) return [node];
      const kept = walk(node.children);
      return kept.length > 0 ? [{ ...node, children: kept }] : [];
    });
  return walk(nodes);
};

export const findNode = (nodes: SyllabusNode[], id: string): SyllabusNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
};

export const parentOf = (nodes: SyllabusNode[], id: string): SyllabusNode | null => {
  for (const node of nodes) {
    if (node.children.some((child) => child.id === id)) return node;
    const found = parentOf(node.children, id);
    if (found) return found;
  }
  return null;
};
