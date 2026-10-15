import { ArrowDown, ArrowUp, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StudyItem } from '@/lib/types';
import type { LayoutContext } from './shared';

export const ItemMenu = ({ item, ctx }: { item: StudyItem; ctx: LayoutContext }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Actions for ${item.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenuItem onSelect={() => ctx.onOpen(item)}>
        <Eye /> Details and attempts
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => ctx.onEdit(item)}>
        <Pencil /> Edit
      </DropdownMenuItem>
      {ctx.onMove && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => ctx.onMove?.(item, -1)}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ctx.onMove?.(item, 1)}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={() => ctx.onDelete(item)}>
        <Trash2 /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
