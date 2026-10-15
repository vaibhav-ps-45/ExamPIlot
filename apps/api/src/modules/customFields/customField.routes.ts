import { Router } from 'express';
import { customFieldSchema, updateCustomFieldSchema } from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './customField.service.js';

export const customFieldRouter = Router({ mergeParams: true });
customFieldRouter.use(requireAuth);

customFieldRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const customFields = await service.listCustomFields(req.auth!.userId, req.params.assessmentId!);
    res.json({ customFields });
  }),
);

customFieldRouter.post(
  '/',
  validate(customFieldSchema),
  asyncHandler(async (req, res) => {
    const customFields = await service.createCustomField(
      req.auth!.userId,
      req.params.assessmentId!,
      req.body,
    );
    res.status(201).json({ customFields });
  }),
);

customFieldRouter.patch(
  '/:fieldId',
  validate(updateCustomFieldSchema),
  asyncHandler(async (req, res) => {
    const customFields = await service.updateCustomField(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.fieldId!,
      req.body,
    );
    res.json({ customFields });
  }),
);

customFieldRouter.delete(
  '/:fieldId',
  asyncHandler(async (req, res) => {
    await service.deleteCustomField(req.auth!.userId, req.params.assessmentId!, req.params.fieldId!);
    res.status(204).send();
  }),
);
