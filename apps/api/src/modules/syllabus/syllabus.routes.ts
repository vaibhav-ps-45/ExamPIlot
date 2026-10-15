import { Router } from 'express';
import {
  createSyllabusNodeSchema,
  importSyllabusTemplateSchema,
  reorderSyllabusSchema,
  updateSyllabusNodeSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './syllabus.service.js';

export const syllabusRouter = Router({ mergeParams: true });
syllabusRouter.use(requireAuth);

syllabusRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const nodes = await service.listSyllabus(req.auth!.userId, req.params.assessmentId!);
    res.json({ nodes });
  }),
);

syllabusRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    res.json({ templates: service.listTemplates() });
  }),
);

syllabusRouter.post(
  '/nodes',
  validate(createSyllabusNodeSchema),
  asyncHandler(async (req, res) => {
    const nodes = await service.createSyllabusNode(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ nodes });
  }),
);

syllabusRouter.patch(
  '/nodes/:nodeId',
  validate(updateSyllabusNodeSchema),
  asyncHandler(async (req, res) => {
    const nodes = await service.updateSyllabusNode(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.nodeId!,
      req.body,
    );
    res.json({ nodes });
  }),
);

syllabusRouter.delete(
  '/nodes/:nodeId',
  asyncHandler(async (req, res) => {
    await service.deleteSyllabusNode(req.auth!.userId, req.params.assessmentId!, req.params.nodeId!);
    res.status(204).send();
  }),
);

syllabusRouter.post(
  '/reorder',
  validate(reorderSyllabusSchema),
  asyncHandler(async (req, res) => {
    const nodes = await service.reorderSyllabus(req.auth!.userId, req.params.assessmentId!, req.body);
    res.json({ nodes });
  }),
);

syllabusRouter.post(
  '/import-template',
  validate(importSyllabusTemplateSchema),
  asyncHandler(async (req, res) => {
    const result = await service.importTemplate(
      req.auth!.userId,
      req.params.assessmentId!,
      req.body.templateId,
      req.body.createStudyItems,
      req.body.trackerId,
    );
    const nodes = await service.listSyllabus(req.auth!.userId, req.params.assessmentId!);
    res.status(201).json({ ...result, nodes });
  }),
);
