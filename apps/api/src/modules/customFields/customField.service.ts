import type { CustomFieldInput, UpdateCustomFieldInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';

export interface CustomFieldView {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  sortOrder: number;
}

const toView = (row: {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  sortOrder: number;
}): CustomFieldView => ({
  id: row.id,
  key: row.key,
  label: row.label,
  type: row.type,
  options: row.options,
  required: row.required,
  sortOrder: row.sortOrder,
});

export const listCustomFields = async (userId: string, assessmentId: string): Promise<CustomFieldView[]> => {
  await getAssessmentForUser(userId, assessmentId);
  const rows = await prisma.assessmentCustomField.findMany({
    where: { assessmentId },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rows.map(toView);
};

export const createCustomField = async (
  userId: string,
  assessmentId: string,
  input: CustomFieldInput,
): Promise<CustomFieldView[]> => {
  await getAssessmentForUser(userId, assessmentId);

  if (input.type === 'SELECT' && input.options.length === 0) {
    throw AppError.validation('A select field needs at least one option', [
      { path: 'options', message: 'At least one option is required' },
    ]);
  }

  const max = await prisma.assessmentCustomField.aggregate({
    where: { assessmentId },
    _max: { sortOrder: true },
  });

  await prisma.assessmentCustomField.create({
    data: {
      assessmentId,
      key: input.key,
      label: input.label,
      type: input.type,
      options: input.options,
      required: input.required,
      sortOrder: input.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
    },
  });

  return listCustomFields(userId, assessmentId);
};

export const updateCustomField = async (
  userId: string,
  assessmentId: string,
  fieldId: string,
  input: UpdateCustomFieldInput,
): Promise<CustomFieldView[]> => {
  await getAssessmentForUser(userId, assessmentId);

  const field = await prisma.assessmentCustomField.findUnique({
    where: { id: fieldId },
    select: { assessmentId: true, type: true },
  });
  if (!field || field.assessmentId !== assessmentId) throw AppError.notFound('Custom field');

  // Changing a field's type would silently invalidate stored values, so it is
  // refused outright rather than migrated behind the user's back.
  if (input.type !== undefined && input.type !== field.type) {
    throw AppError.validation(
      'A custom field\'s type cannot be changed after it is created. Delete it and add a new one.',
      [{ path: 'type', message: 'Type is immutable' }],
    );
  }

  await prisma.assessmentCustomField.update({
    where: { id: fieldId },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  return listCustomFields(userId, assessmentId);
};

export const deleteCustomField = async (
  userId: string,
  assessmentId: string,
  fieldId: string,
): Promise<void> => {
  await getAssessmentForUser(userId, assessmentId);
  const field = await prisma.assessmentCustomField.findUnique({
    where: { id: fieldId },
    select: { assessmentId: true },
  });
  if (!field || field.assessmentId !== assessmentId) throw AppError.notFound('Custom field');
  // Values cascade with the definition; the study items themselves are untouched.
  await prisma.assessmentCustomField.delete({ where: { id: fieldId } });
};
