import { describe, expect, it } from 'vitest';
import type { SyllabusNode } from '@/lib/types';
import { countDescendants, filterTree, flatten, parentOf, totalItems } from './tree';

const node = (id: string, title: string, children: SyllabusNode[] = [], studyItemCount = 0): SyllabusNode => ({
  id,
  assessmentId: 'a',
  parentId: null,
  title,
  description: null,
  weight: null,
  sortOrder: 0,
  depth: 0,
  studyItemCount,
  children,
});

const tree = [
  node('m', 'Maths', [node('d', 'Discrete', [node('g', 'Graph Theory', [], 2), node('l', 'Logic', [], 1)]), node('la', 'Linear Algebra', [], 3)]),
  node('c', 'Compilers', [node('p', 'Parsing', [], 1)]),
];

describe('syllabus tree helpers', () => {
  it('flattens depth first with depth', () => {
    expect(flatten(tree).map((entry) => `${entry.depth}:${entry.node.title}`)).toEqual([
      '0:Maths',
      '1:Discrete',
      '2:Graph Theory',
      '2:Logic',
      '1:Linear Algebra',
      '0:Compilers',
      '1:Parsing',
    ]);
  });

  it('counts descendants and nested items', () => {
    expect(countDescendants(tree[0]!)).toBe(4);
    expect(totalItems(tree[0]!)).toBe(6);
  });

  it('keeps ancestors of a match and the whole subtree of a matching node', () => {
    const result = filterTree(tree, 'graph');
    expect(result.map((entry) => entry.title)).toEqual(['Maths']);
    expect(result[0]!.children.map((entry) => entry.title)).toEqual(['Discrete']);
    expect(result[0]!.children[0]!.children.map((entry) => entry.title)).toEqual(['Graph Theory']);
    expect(filterTree(tree, 'compilers')[0]!.children).toHaveLength(1);
  });

  it('returns the tree untouched for an empty query and nothing for no match', () => {
    expect(filterTree(tree, '  ')).toBe(tree);
    expect(filterTree(tree, 'zzz')).toEqual([]);
  });

  it('finds a parent', () => {
    expect(parentOf(tree, 'g')?.title).toBe('Discrete');
    expect(parentOf(tree, 'm')).toBeNull();
  });
});
