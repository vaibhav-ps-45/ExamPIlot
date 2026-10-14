import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@exampilot/shared';

export interface Page {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const toSkipTake = ({ page, pageSize }: Page): { skip: number; take: number } => {
  const safeSize = Math.min(Math.max(pageSize || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page || 1, 1);
  return { skip: (safePage - 1) * safeSize, take: safeSize };
};

export const paginate = <T>(items: T[], total: number, page: Page): Paginated<T> => ({
  items,
  total,
  page: Math.max(page.page || 1, 1),
  pageSize: Math.min(Math.max(page.pageSize || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
});
