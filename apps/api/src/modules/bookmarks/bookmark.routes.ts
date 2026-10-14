import { Router } from 'express';
import { bookmarkListQuerySchema, createBookmarkSchema, updateBookmarkSchema } from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './bookmark.service.js';

export const bookmarkRouter = Router();
bookmarkRouter.use(requireAuth);

bookmarkRouter.get(
  '/',
  validate(bookmarkListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listBookmarks(req.auth!.userId, req.query as never);
    res.json(result);
  }),
);

bookmarkRouter.post(
  '/',
  validate(createBookmarkSchema),
  asyncHandler(async (req, res) => {
    const bookmark = await service.createBookmark(req.auth!.userId, req.body);
    res.status(201).json({ bookmark });
  }),
);

bookmarkRouter.patch(
  '/:bookmarkId',
  validate(updateBookmarkSchema),
  asyncHandler(async (req, res) => {
    const bookmark = await service.updateBookmark(req.auth!.userId, req.params.bookmarkId!, req.body);
    res.json({ bookmark });
  }),
);

bookmarkRouter.delete(
  '/:bookmarkId',
  asyncHandler(async (req, res) => {
    await service.deleteBookmark(req.auth!.userId, req.params.bookmarkId!);
    res.status(204).send();
  }),
);
