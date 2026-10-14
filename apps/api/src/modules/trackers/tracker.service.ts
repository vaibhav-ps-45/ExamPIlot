import { Prisma } from '@prisma/client';
import type { CreateTrackerInput, SaveTrackerViewInput, SwitchLayoutInput, UpdateTrackerInput } from '@exampilot/shared';
import {
  DEFAULT_VIEW_CONFIG,
  IMPLEMENTED_LAYOUTS,
  LAYOUT_SUPPORTED_FIELDS,
  type TrackerLayout,
} from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

export interface TrackerColumnView {
  id: string;
  fieldKey: string;
  customFieldId: string | null;
  label: string | null;
  width: number | null;
  visible: boolean;
  sortOrder: number;
}

export interface TrackerView {
  id: string;
  assessmentId: string;
  name: string;
  layout: string;
  accentColor: string | null;
  density: string;
  viewConfig: typeof DEFAULT_VIEW_CONFIG;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  columns: TrackerColumnView[];
  itemCount: number;
  savedViews: Array<{ id: string; name: string; isDefault: boolean }>;
}

type TrackerRow = {
  id: string;
  assessmentId: string;
  name: string;
  layout: string;
  accentColor: string | null;
  density: string;
  viewConfig: Prisma.JsonValue;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  columns: Array<{
    id: string;
    fieldKey: string;
    customFieldId: string | null;
    label: string | null;
    width: number | null;
    visible: boolean;
    sortOrder: number;
  }>;
  views: Array<{ id: string; name: string; isDefault: boolean }>;
  _count: { studyItems: number };
};

const TRACKER_SELECT = {
  id: true,
  assessmentId: true,
  name: true,
  layout: true,
  accentColor: true,
  density: true,
  viewConfig: true,
  isDefault: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  columns: {
    select: {
      id: true,
      fieldKey: true,
      customFieldId: true,
      label: true,
      width: true,
      visible: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
  views: { select: { id: true, name: true, isDefault: true } },
  _count: { select: { studyItems: true } },
} satisfies Prisma.TrackerSelect;

/** Merges stored config with defaults so a partial config is always complete. */
const resolveViewConfig = (raw: Prisma.JsonValue): typeof DEFAULT_VIEW_CONFIG => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_VIEW_CONFIG };
  const value = raw as Partial<typeof DEFAULT_VIEW_CONFIG>;
  return {
    attemptSlots: value.attemptSlots ?? DEFAULT_VIEW_CONFIG.attemptSlots,
    showCompleted: value.showCompleted ?? DEFAULT_VIEW_CONFIG.showCompleted,
    groupBySubject: value.groupBySubject ?? DEFAULT_VIEW_CONFIG.groupBySubject,
    notesBoardColumns: value.notesBoardColumns ?? DEFAULT_VIEW_CONFIG.notesBoardColumns,
  };
};

const toView = (row: TrackerRow): TrackerView => ({
  id: row.id,
  assessmentId: row.assessmentId,
  name: row.name,
  layout: row.layout,
  accentColor: row.accentColor,
  density: row.density,
  viewConfig: resolveViewConfig(row.viewConfig),
  isDefault: row.isDefault,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  columns: row.columns.map((column) => ({ ...column })),
  itemCount: row._count.studyItems,
  savedViews: row.views.map((view) => ({ id: view.id, name: view.name, isDefault: view.isDefault })),
});

/** Default columns used when the client does not supply a layout. */
export const defaultColumnsFor = (
  layout: TrackerLayout,
): Array<{ fieldKey: string; label: string | null; width: number | null; sortOrder: number; visible: boolean }> => {
  const supported = LAYOUT_SUPPORTED_FIELDS[layout];
  const preferred: Array<{ fieldKey: string; label: string | null; width: number | null }> = [
    { fieldKey: 'NAME', label: null, width: 260 },
    { fieldKey: 'SUBJECT', label: null, width: 160 },
    { fieldKey: 'PRIORITY', label: null, width: 110 },
    { fieldKey: 'DUE_DATE', label: 'Due', width: 140 },
    { fieldKey: 'ESTIMATED_MINUTES', label: 'Est.', width: 100 },
    { fieldKey: 'ACTUAL_MINUTES', label: 'Actual', width: 100 },
    { fieldKey: 'ATTEMPTS', label: 'Attempts', width: 110 },
    { fieldKey: 'BOOKMARK', label: 'Saved', width: 90 },
  ];
  return preferred
    .filter((column) => supported.includes(column.fieldKey as never))
    .map((column, index) => ({ ...column, sortOrder: index, visible: true }));
};

export const listTrackers = async (userId: string, assessmentId: string): Promise<TrackerView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  const rows = await prisma.tracker.findMany({
    where: { assessmentId },
    select: TRACKER_SELECT,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toView);
};

const assertTrackerOwned = async (assessmentId: string, trackerId: string) => {
  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    select: { id: true, assessmentId: true, layout: true, viewConfig: true },
  });
  if (!tracker || tracker.assessmentId !== assessmentId) throw AppError.notFound('Tracker');
  return tracker;
};

export const getTracker = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);
  const row = await prisma.tracker.findUnique({ where: { id: trackerId }, select: TRACKER_SELECT });
  if (!row) throw AppError.notFound('Tracker');
  return toView(row);
};

export const createTracker = async (
  userId: string,
  assessmentId: string,
  input: CreateTrackerInput,
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);

  if (!IMPLEMENTED_LAYOUTS.includes(input.layout)) {
    throw AppError.validation(`Layout ${input.layout} is not implemented yet`, [
      { path: 'layout', message: `Available layouts: ${IMPLEMENTED_LAYOUTS.join(', ')}` },
    ]);
  }

  const columns: Array<{
    fieldKey: string;
    customFieldId?: string | null;
    label?: string | null;
    width?: number | null;
    visible?: boolean;
    sortOrder?: number;
  }> = input.columns?.length ? input.columns : defaultColumnsFor(input.layout);

  const existingCount = await prisma.tracker.count({ where: { assessmentId } });

  const created = await prisma.tracker.create({
    data: {
      assessmentId,
      name: input.name,
      layout: input.layout,
      accentColor: input.accentColor,
      density: input.density,
      viewConfig: { ...DEFAULT_VIEW_CONFIG, ...(input.viewConfig ?? {}) } as Prisma.InputJsonValue,
      sortOrder: existingCount,
      isDefault: existingCount === 0,
      columns: {
        create: columns.map((column, index) => ({
          fieldKey: column.fieldKey as never,
          customFieldId: column.customFieldId ?? null,
          label: column.label ?? null,
          width: column.width ?? null,
          visible: column.visible ?? true,
          sortOrder: column.sortOrder ?? index,
        })),
      },
    },
    select: TRACKER_SELECT,
  });

  return toView(created);
};

export const updateTracker = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  input: UpdateTrackerInput,
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);
  const current = await assertTrackerOwned(assessmentId, trackerId);

  if (input.layout && !IMPLEMENTED_LAYOUTS.includes(input.layout)) {
    throw AppError.validation(`Layout ${input.layout} is not implemented yet`, [
      { path: 'layout', message: `Available layouts: ${IMPLEMENTED_LAYOUTS.join(', ')}` },
    ]);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.tracker.updateMany({
        where: { assessmentId, id: { not: trackerId } },
        data: { isDefault: false },
      });
    }
    const mergedConfig = {
      ...resolveViewConfig(current.viewConfig),
      ...(input.viewConfig ?? {}),
    };
    return tx.tracker.update({
      where: { id: trackerId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.layout !== undefined ? { layout: input.layout } : {}),
        ...('accentColor' in input ? { accentColor: input.accentColor ?? null } : {}),
        ...(input.density !== undefined ? { density: input.density } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.viewConfig ? { viewConfig: mergedConfig as Prisma.InputJsonValue } : {}),
      },
      select: TRACKER_SELECT,
    });
  });

  return toView(updated);
};

/**
 * Layout switching is lossless by design: the underlying StudyItem rows are
 * untouched, and unsupported columns are only removed when the caller
 * explicitly passes dropUnsupportedFields. Otherwise they are hidden, so
 * switching back restores them.
 */
export const switchLayout = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  input: SwitchLayoutInput,
): Promise<{ tracker: TrackerView; hiddenFields: string[] }> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);

  const supported = LAYOUT_SUPPORTED_FIELDS[input.layout];
  const columns = await prisma.trackerColumn.findMany({
    where: { trackerId },
    select: { id: true, fieldKey: true },
  });

  const unsupported = columns.filter((column) => !supported.includes(column.fieldKey as never));

  const updated = await prisma.$transaction(async (tx) => {
    if (unsupported.length) {
      if (input.dropUnsupportedFields) {
        await tx.trackerColumn.deleteMany({ where: { id: { in: unsupported.map((c) => c.id) } } });
      } else {
        await tx.trackerColumn.updateMany({
          where: { id: { in: unsupported.map((c) => c.id) } },
          data: { visible: false },
        });
      }
    }
    const restore = columns.filter((column) => supported.includes(column.fieldKey as never));
    if (restore.length) {
      await tx.trackerColumn.updateMany({
        where: { id: { in: restore.map((c) => c.id) } },
        data: { visible: true },
      });
    }
    return tx.tracker.update({
      where: { id: trackerId },
      data: { layout: input.layout },
      select: TRACKER_SELECT,
    });
  });

  return {
    tracker: toView(updated),
    hiddenFields: input.dropUnsupportedFields ? [] : unsupported.map((column) => column.fieldKey),
  };
};

export const deleteTracker = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const tracker = await assertTrackerOwned(assessmentId, trackerId);

  await prisma.$transaction(async (tx) => {
    // Items survive their tracker: they are detached, not deleted.
    await tx.studyItem.updateMany({ where: { trackerId }, data: { trackerId: null } });
    await tx.tracker.delete({ where: { id: trackerId } });
    if (tracker) {
      const remaining = await tx.tracker.findFirst({
        where: { assessmentId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, isDefault: true },
      });
      if (remaining && !remaining.isDefault) {
        await tx.tracker.update({ where: { id: remaining.id }, data: { isDefault: true } });
      }
    }
  });
};

// ------------------------------ columns -------------------------------------

export const addColumn = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  input: { fieldKey: string; label?: string | null; width?: number | null; visible?: boolean; options?: unknown },
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);

  const max = await prisma.trackerColumn.aggregate({
    where: { trackerId },
    _max: { sortOrder: true },
  });

  await prisma.trackerColumn.create({
    data: {
      trackerId,
      fieldKey: input.fieldKey as never,
      label: input.label ?? null,
      width: input.width ?? null,
      visible: input.visible ?? true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      ...(input.options === undefined || input.options === null
        ? {}
        : { options: input.options as Prisma.InputJsonValue }),
    },
  });

  return getTracker(userId, assessmentId, trackerId);
};

export const updateColumn = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  columnId: string,
  input: { label?: string | null; width?: number | null; visible?: boolean },
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);

  const column = await prisma.trackerColumn.findUnique({
    where: { id: columnId },
    select: { trackerId: true },
  });
  if (!column || column.trackerId !== trackerId) throw AppError.notFound('Tracker column');

  await prisma.trackerColumn.update({
    where: { id: columnId },
    data: {
      ...('label' in input ? { label: input.label ?? null } : {}),
      ...('width' in input ? { width: input.width ?? null } : {}),
      ...(input.visible !== undefined ? { visible: input.visible } : {}),
    },
  });

  return getTracker(userId, assessmentId, trackerId);
};

export const deleteColumn = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  columnId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);
  const column = await prisma.trackerColumn.findUnique({
    where: { id: columnId },
    select: { trackerId: true },
  });
  if (!column || column.trackerId !== trackerId) throw AppError.notFound('Tracker column');
  await prisma.trackerColumn.delete({ where: { id: columnId } });
};

export const reorderColumns = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  orderedIds: string[],
): Promise<TrackerView> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);

  const found = await prisma.trackerColumn.findMany({
    where: { id: { in: orderedIds }, trackerId },
    select: { id: true },
  });
  if (found.length !== orderedIds.length) {
    throw AppError.validation('One or more columns do not belong to this tracker');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.trackerColumn.update({ where: { id }, data: { sortOrder: index } })),
  );

  return getTracker(userId, assessmentId, trackerId);
};

// ------------------------------ saved views ---------------------------------

export const saveView = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  input: SaveTrackerViewInput,
) => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);

  const view = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.trackerView.updateMany({ where: { trackerId }, data: { isDefault: false } });
    }
    return tx.trackerView.upsert({
      where: { id: `${trackerId}:${input.name}`.slice(0, 30) },
      create: {
        id: `${trackerId}:${input.name}`.slice(0, 30),
        trackerId,
        name: input.name,
        isDefault: input.isDefault,
        layout: (input.layout ?? undefined) as never,
        density: (input.density ?? undefined) as never,
        filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        sorts: (input.sorts ?? undefined) as Prisma.InputJsonValue | undefined,
        searchTerm: input.searchTerm ?? null,
      },
      update: {
        isDefault: input.isDefault,
        layout: (input.layout ?? undefined) as never,
        density: (input.density ?? undefined) as never,
        filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        sorts: (input.sorts ?? undefined) as Prisma.InputJsonValue | undefined,
        searchTerm: input.searchTerm ?? null,
      },
    });
  });

  return {
    id: view.id,
    name: view.name,
    isDefault: view.isDefault,
    layout: view.layout,
    density: view.density,
    filters: view.filters,
    sorts: view.sorts,
    searchTerm: view.searchTerm,
  };
};

export const listViews = async (userId: string, assessmentId: string, trackerId: string) => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);
  const views = await prisma.trackerView.findMany({
    where: { trackerId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return views.map((view) => ({
    id: view.id,
    name: view.name,
    isDefault: view.isDefault,
    layout: view.layout,
    density: view.density,
    filters: view.filters,
    sorts: view.sorts,
    searchTerm: view.searchTerm,
  }));
};

export const deleteView = async (
  userId: string,
  assessmentId: string,
  trackerId: string,
  viewId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  await assertTrackerOwned(assessmentId, trackerId);
  const view = await prisma.trackerView.findUnique({ where: { id: viewId }, select: { trackerId: true } });
  if (!view || view.trackerId !== trackerId) throw AppError.notFound('Saved view');
  await prisma.trackerView.delete({ where: { id: viewId } });
};
