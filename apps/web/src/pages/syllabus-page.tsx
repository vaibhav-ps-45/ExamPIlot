import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileDown,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AssessmentGate } from '@/components/layout/app-shell';
import { ImportTemplateDialog } from '@/components/syllabus/import-template-dialog';
import { NodeDialog, type NodeDialogState } from '@/components/syllabus/node-dialog';
import { NodeItemDialog } from '@/components/syllabus/node-item-dialog';
import { countDescendants, filterTree, flatten, parentOf, totalItems } from '@/components/syllabus/tree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useSyllabus, useSyllabusMutation } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Assessment, SyllabusNode } from '@/lib/types';

export const SyllabusPage = () => (
  <AssessmentGate title="the syllabus">
    {(assessment) => <SyllabusContent assessment={assessment} />}
  </AssessmentGate>
);

interface RowActions {
  onAddChild: (node: SyllabusNode) => void;
  onAddItem: (node: SyllabusNode) => void;
  onEdit: (node: SyllabusNode) => void;
  onDelete: (node: SyllabusNode) => void;
  onMove: (node: SyllabusNode, siblings: SyllabusNode[], direction: -1 | 1) => void;
}

const NodeRow = ({
  node,
  siblings,
  collapsed,
  toggle,
  forceOpen,
  actions,
  assessmentId,
  highlightId,
}: {
  node: SyllabusNode;
  siblings: SyllabusNode[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  forceOpen: boolean;
  actions: RowActions;
  assessmentId: string;
  highlightId: string | null;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const highlighted = highlightId === node.id;
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);
  const hasChildren = node.children.length > 0;
  const open = forceOpen || !collapsed.has(node.id);
  const index = siblings.findIndex((entry) => entry.id === node.id);
  const itemTotal = totalItems(node);

  return (
    <li>
      <div
        ref={rowRef}
        className={cn(
          'group flex items-center gap-1 rounded-md py-1 pl-1 pr-1 hover:bg-accent/40',
          highlighted && 'bg-primary/10 ring-2 ring-primary/60',
        )}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={`syl-${node.id}`}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.title}`}
            onClick={() => toggle(node.id)}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="inline-block size-7 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm', hasChildren ? 'font-semibold' : 'font-medium')}>{node.title}</p>
          {node.description && <p className="truncate text-xs text-muted-foreground">{node.description}</p>}
        </div>

        {node.weight !== null && <Badge variant="outline">{`Weight ${node.weight}`}</Badge>}
        {itemTotal > 0 ? (
          <Link
            to={`/assessments/${assessmentId}/trackers`}
            className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            title="Study items under this topic"
          >
            {`${itemTotal} item${itemTotal === 1 ? '' : 's'}`}
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">No items</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${node.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onAddItem(node)}>
              <ListPlus /> Add study item
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onAddChild(node)}>
              <Plus /> Add sub-topic
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit(node)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index <= 0} onSelect={() => actions.onMove(node, siblings, -1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index < 0 || index >= siblings.length - 1} onSelect={() => actions.onMove(node, siblings, 1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => actions.onDelete(node)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && open && (
        <ul id={`syl-${node.id}`} className="ml-3 border-l border-border pl-2">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              siblings={node.children}
              collapsed={collapsed}
              toggle={toggle}
              forceOpen={forceOpen}
              actions={actions}
              assessmentId={assessmentId}
              highlightId={highlightId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const SyllabusContent = ({ assessment }: { assessment: Assessment }) => {
  const assessmentId = assessment.id;
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('node');
  const syllabus = useSyllabus(assessmentId);
  const { remove, reorder } = useSyllabusMutation(assessmentId);
  const tree = useMemo(() => syllabus.data ?? [], [syllabus.data]);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodeDialog, setNodeDialog] = useState<NodeDialogState>(null);
  const [itemNode, setItemNode] = useState<SyllabusNode | null>(null);
  const [deleting, setDeleting] = useState<SyllabusNode | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const allNodes = useMemo(() => flatten(tree), [tree]);
  const searching = query.trim().length > 0;
  const visible = useMemo(() => filterTree(tree, query), [tree, query]);

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actions: RowActions = {
    onAddChild: (node) => setNodeDialog({ mode: 'create', parentId: node.id }),
    onAddItem: (node) => setItemNode(node),
    onEdit: (node) => setNodeDialog({ mode: 'edit', node }),
    onDelete: (node) => setDeleting(node),
    onMove: async (node, siblings, direction) => {
      const ids = siblings.map((entry) => entry.id);
      const index = ids.indexOf(node.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
      try {
        await reorder.mutateAsync({ parentId: node.parentId, orderedIds: ids });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not reorder');
      }
    },
  };

  if (syllabus.isLoading) return <ListSkeleton rows={8} />;
  if (syllabus.error) return <ErrorState error={syllabus.error} onRetry={() => void syllabus.refetch()} />;

  const itemSubject = itemNode ? parentOf(tree, itemNode.id)?.title ?? null : null;
  const topLevelItems = tree.reduce((sum, node) => sum + totalItems(node), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Syllabus</h1>
          <p className="text-sm text-muted-foreground">
            {allNodes.length === 0
              ? 'Organise what you need to cover. Start empty or import a template.'
              : `${allNodes.length} topics · ${topLevelItems} study items linked`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileDown /> Import template
          </Button>
          <Button onClick={() => setNodeDialog({ mode: 'create', parentId: null })}>
            <Plus /> Add topic
          </Button>
        </div>
      </header>

      {allNodes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="No syllabus yet"
          description="Add topics one at a time, or import the optional GATE Computer Science template. Nothing is scheduled or reminded automatically."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileDown /> Import a template
              </Button>
              <Button onClick={() => setNodeDialog({ mode: 'create', parentId: null })}>
                <Plus /> Add a topic
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                type="search"
                placeholder="Search topics"
                aria-label="Search topics"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
              Expand all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(new Set(allNodes.filter(({ node }) => node.children.length > 0).map(({ node }) => node.id)))}
            >
              Collapse all
            </Button>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="No topics match your search" description="Try a different word." />
          ) : (
            <ul className="rounded-lg border border-border bg-card p-2" aria-label="Syllabus topics">
              {visible.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  siblings={tree}
                  collapsed={collapsed}
                  toggle={toggle}
                  forceOpen={searching}
                  actions={actions}
                  assessmentId={assessment.id}
                  highlightId={highlightId}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <NodeDialog state={nodeDialog} onClose={() => setNodeDialog(null)} assessmentId={assessmentId} tree={tree} />
      <NodeItemDialog node={itemNode} subject={itemSubject} assessmentId={assessmentId} onClose={() => setItemNode(null)} />
      <ImportTemplateDialog open={importOpen} onOpenChange={setImportOpen} assessmentId={assessmentId} existingNodeCount={allNodes.length} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ''}"?`}
        description={
          deleting
            ? `${countDescendants(deleting) > 0 ? `Its ${countDescendants(deleting)} sub-topics are deleted too. ` : ''}Study items linked to it are kept and simply unlinked from the syllabus.`
            : ''
        }
        confirmLabel="Delete topic"
        onConfirm={async () => {
          if (deleting) {
            try {
              await remove.mutateAsync(deleting.id);
              toast.success('Topic deleted');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not delete the topic');
            }
          }
          setDeleting(null);
        }}
      />
    </div>
  );
};
