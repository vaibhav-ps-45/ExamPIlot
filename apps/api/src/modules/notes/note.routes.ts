import { Router } from 'express';
import { createNoteSchema, noteListQuerySchema, updateNoteSchema } from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './note.service.js';

export const noteRouter = Router({ mergeParams: true });
noteRouter.use(requireAuth);

noteRouter.get(
  '/',
  validate(noteListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listNotes(req.auth!.userId, req.params.assessmentId!, req.query as never);
    res.json(result);
  }),
);

noteRouter.post(
  '/',
  validate(createNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await service.createNote(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ note });
  }),
);

noteRouter.get(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const note = await service.getNote(req.auth!.userId, req.params.assessmentId!, req.params.noteId!);
    res.json({ note });
  }),
);

noteRouter.patch(
  '/:noteId',
  validate(updateNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await service.updateNote(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.noteId!,
      req.body,
    );
    res.json({ note });
  }),
);

noteRouter.delete(
  '/:noteId',
  asyncHandler(async (req, res) => {
    await service.deleteNote(req.auth!.userId, req.params.assessmentId!, req.params.noteId!);
    res.status(204).send();
  }),
);
