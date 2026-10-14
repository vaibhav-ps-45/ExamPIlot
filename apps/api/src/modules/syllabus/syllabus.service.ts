import type { CreateSyllabusNodeInput, ReorderSyllabusInput, UpdateSyllabusNodeInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';
import { GATE_CS_TEMPLATE } from './templates/gate-cs.js';

export interface SyllabusNodeView {
  id: string;
  assessmentId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  weight: number | null;
  sortOrder: number;
  depth: number;
  studyItemCount: number;
  children: SyllabusNodeView[];
}

type FlatNode = {
  id: string;
  assessmentId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  weight: number | null;
  sortOrder: number;
  _count: { studyItems: number };
};

/** Turns the flat rows into a tree, preserving sortOrder at every level. */
export const buildTree = (rows: FlatNode[]): SyllabusNodeView[] => {
  const byId = new Map<string, SyllabusNodeView>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      assessmentId: row.assessmentId,
      parentId: row.parentId,
      title: row.title,
      description: row.description,
      weight: row.weight,
      sortOrder: row.sortOrder,
      depth: 0,
      studyItemCount: row._count.studyItems,
      children: [],
    });
  }

  const roots: SyllabusNodeView[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      const parent = byId.get(node.parentId)!;
      parent.children.push(node);
    } else {
      // A node whose parent is missing (or which has none) is a root.
      roots.push(node);
    }
  }

  const assignDepth = (nodes: SyllabusNodeView[], depth: number): void => {
    for (const node of nodes) {
      node.depth = depth;
      node.children.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
      assignDepth(node.children, depth + 1);
    }
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  assignDepth(roots, 0);

  return roots;
};

export const listSyllabus = async (userId: string, assessmentId: string): Promise<SyllabusNodeView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  const rows = await prisma.syllabusNode.findMany({
    where: { assessmentId },
    select: {
      id: true,
      assessmentId: true,
      parentId: true,
      title: true,
      description: true,
      weight: true,
      sortOrder: true,
      _count: { select: { studyItems: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  return buildTree(rows);
};

/** Validates that a parent exists, belongs to this assessment, and is not the node itself. */
const assertValidParent = async (
  assessmentId: string,
  parentId: string | null,
  selfId?: string,
): Promise<void> => {
  if (!parentId) return;
  if (selfId && parentId === selfId) {
    throw AppError.validation('A node cannot be its own parent', [{ path: 'parentId', message: 'Invalid parent' }]);
  }
  const parent = await prisma.syllabusNode.findUnique({
    where: { id: parentId },
    select: { assessmentId: true, parentId: true },
  });
  if (!parent || parent.assessmentId !== assessmentId) {
    throw AppError.validation('Parent node does not belong to this assessment', [
      { path: 'parentId', message: 'Unknown parent node' },
    ]);
  }
  // Walk up from the new parent: if we reach selfId, the move would create a cycle.
  if (selfId) {
    let cursor: string | null = parent.parentId;
    const seen = new Set<string>([parentId]);
    while (cursor) {
      if (cursor === selfId) {
        throw AppError.validation('This move would create a cycle in the syllabus tree', [
          { path: 'parentId', message: 'Descendant cannot become the parent' },
        ]);
      }
      if (seen.has(cursor)) break; // pre-existing cycle guard
      seen.add(cursor);
      const next: { parentId: string | null } | null = await prisma.syllabusNode.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
    }
  }
};

export const createSyllabusNode = async (
  userId: string,
  assessmentId: string,
  input: CreateSyllabusNodeInput,
): Promise<SyllabusNodeView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertValidParent(assessmentId, input.parentId);

  const sortOrder =
    input.sortOrder ??
    ((await prisma.syllabusNode.aggregate({
      where: { assessmentId, parentId: input.parentId },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? -1) + 1;

  await prisma.syllabusNode.create({
    data: {
      assessmentId,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      weight: input.weight,
      sortOrder,
    },
  });

  return listSyllabus(userId, assessmentId);
};

export const updateSyllabusNode = async (
  userId: string,
  assessmentId: string,
  nodeId: string,
  input: UpdateSyllabusNodeInput,
): Promise<SyllabusNodeView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  const node = await prisma.syllabusNode.findUnique({
    where: { id: nodeId },
    select: { assessmentId: true },
  });
  if (!node || node.assessmentId !== assessmentId) throw AppError.notFound('Syllabus node');

  if ('parentId' in input) await assertValidParent(assessmentId, input.parentId ?? null, nodeId);

  await prisma.syllabusNode.update({
    where: { id: nodeId },
    data: {
      ...('parentId' in input ? { parentId: input.parentId ?? null } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...('description' in input ? { description: input.description ?? null } : {}),
      ...('weight' in input ? { weight: input.weight ?? null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  return listSyllabus(userId, assessmentId);
};

export const deleteSyllabusNode = async (
  userId: string,
  assessmentId: string,
  nodeId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const node = await prisma.syllabusNode.findUnique({
    where: { id: nodeId },
    select: { assessmentId: true },
  });
  if (!node || node.assessmentId !== assessmentId) throw AppError.notFound('Syllabus node');
  // Children cascade. Study items are detached (SetNull), never deleted, so a
  // syllabus edit cannot silently destroy the user's tracked work.
  await prisma.syllabusNode.delete({ where: { id: nodeId } });
};

export const reorderSyllabus = async (
  userId: string,
  assessmentId: string,
  input: ReorderSyllabusInput,
): Promise<SyllabusNodeView[]> => {
  await getAssessmentForUser(userId, assessmentId);

  const nodes = await prisma.syllabusNode.findMany({
    where: { id: { in: input.orderedIds }, assessmentId },
    select: { id: true },
  });
  if (nodes.length !== input.orderedIds.length) {
    throw AppError.validation('One or more nodes do not belong to this assessment');
  }

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.syllabusNode.update({
        where: { id },
        data: { parentId: input.parentId, sortOrder: index },
      }),
    ),
  );

  return listSyllabus(userId, assessmentId);
};

export const listTemplates = () => [
  {
    id: GATE_CS_TEMPLATE.id,
    name: GATE_CS_TEMPLATE.name,
    description: GATE_CS_TEMPLATE.description,
    nodeCount: GATE_CS_TEMPLATE.countNodes(),
  },
];

/**
 * Explicit, user-triggered template import. It creates syllabus nodes only.
 * It NEVER creates reminders, due dates or study items unless the caller asks
 * for study items explicitly (createStudyItems: true), and even then those
 * items are created with no dates and no reminders.
 */
export const importTemplate = async (
  userId: string,
  assessmentId: string,
  templateId: string,
  createStudyItems: boolean,
): Promise<{ importedNodes: number; importedItems: number }> => {
  await getAssessmentForUser(userId, assessmentId);

  const template = GATE_CS_TEMPLATE.id === templateId ? GATE_CS_TEMPLATE : null;
  if (!template) throw AppError.notFound('Syllabus template');

  let importedNodes = 0;
  let importedItems = 0;

  await prisma.$transaction(async (tx) => {
    const insert = async (nodes: typeof template.nodes, parentId: string | null): Promise<void> => {
      for (const [index, node] of nodes.entries()) {
        const created = await tx.syllabusNode.create({
          data: {
            assessmentId,
            parentId,
            title: node.title,
            description: node.description ?? null,
            sortOrder: index,
          },
          select: { id: true },
        });
        importedNodes += 1;

        if (createStudyItems && !node.children?.length) {
          await tx.studyItem.create({
            data: {
              assessmentId,
              syllabusNodeId: created.id,
              name: node.title,
              subject: null,
              topic: null,
              subtopic: null,
              // No dates, no reminders: the user schedules their own work.
            },
          });
          importedItems += 1;
        }

        if (node.children?.length) await insert(node.children, created.id);
      }
    };
    await insert(template.nodes, null);
  });

  return { importedNodes, importedItems };
};
