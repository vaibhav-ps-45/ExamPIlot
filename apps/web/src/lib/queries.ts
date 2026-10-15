import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, toQueryString } from './api';
import type {
  Assessment,
  AssessmentAnalytics,
  Bookmark,
  CustomField,
  GlobalOverview,
  MockTest,
  MockTestSummary,
  Note,
  Paginated,
  PracticeAttempt,
  Reminder,
  SavedView,
  SessionRecord,
  Settings,
  StudyItem,
  StudySession,
  SyllabusNode,
  SyllabusTemplateSummary,
  Tracker,
  User,
} from './types';

/**
 * Query keys are built from small factory functions so an invalidation can
 * target exactly the right slice — for example, editing one study item must not
 * refetch the whole assessment list.
 */
export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  sessions: ['settings', 'sessions'] as const,
  assessments: (params?: Record<string, unknown>) => ['assessments', params ?? {}] as const,
  assessment: (id: string) => ['assessment', id] as const,
  syllabus: (id: string) => ['assessment', id, 'syllabus'] as const,
  templates: ['syllabus', 'templates'] as const,
  trackers: (id: string) => ['assessment', id, 'trackers'] as const,
  tracker: (id: string, trackerId: string) => ['assessment', id, 'tracker', trackerId] as const,
  trackerViews: (id: string, trackerId: string) => ['assessment', id, 'tracker', trackerId, 'views'] as const,
  items: (id: string, params?: Record<string, unknown>) => ['assessment', id, 'items', params ?? {}] as const,
  item: (id: string, itemId: string) => ['assessment', id, 'item', itemId] as const,
  attempts: (id: string, itemId: string) => ['assessment', id, 'item', itemId, 'attempts'] as const,
  studySessions: (id: string, params?: Record<string, unknown>) =>
    ['assessment', id, 'sessions', params ?? {}] as const,
  bookmarks: (params?: Record<string, unknown>) => ['bookmarks', params ?? {}] as const,
  notes: (id: string, params?: Record<string, unknown>) => ['assessment', id, 'notes', params ?? {}] as const,
  mockTests: (id: string, params?: Record<string, unknown>) => ['assessment', id, 'mockTests', params ?? {}] as const,
  mockSummary: (id: string) => ['assessment', id, 'mockTests', 'summary'] as const,
  reminders: (params?: Record<string, unknown>) => ['reminders', params ?? {}] as const,
  analytics: (id: string) => ['assessment', id, 'analytics'] as const,
  overview: ['overview'] as const,
  customFields: (id: string) => ['assessment', id, 'customFields'] as const,
};

type QueryOpts<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>;

// ------------------------------------------------------------------ auth ----

export const useMe = (options?: QueryOpts<User>) =>
  useQuery({
    queryKey: keys.me,
    queryFn: async () => (await api.get<{ user: User }>('/api/auth/me')).user,
    retry: false,
    ...options,
  });

// ----------------------------------------------------------- assessments ----

export const useAssessments = (params: Record<string, unknown> = {}, options?: QueryOpts<Assessment[]>) =>
  useQuery({
    queryKey: keys.assessments(params),
    queryFn: async () =>
      (await api.get<{ items: Assessment[] }>(`/api/assessments${toQueryString(params)}`)).items,
    ...options,
  });

export const useAssessment = (id: string | undefined, options?: QueryOpts<Assessment>) =>
  useQuery({
    queryKey: keys.assessment(id ?? ''),
    queryFn: async () => (await api.get<{ assessment: Assessment }>(`/api/assessments/${id}`)).assessment,
    enabled: Boolean(id),
    ...options,
  });

export const useCreateAssessment = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ assessment: Assessment }>('/api/assessments', input)).assessment,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['assessments'] });
      void client.invalidateQueries({ queryKey: keys.overview });
    },
  });
};

export const useUpdateAssessment = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.patch<{ assessment: Assessment }>(`/api/assessments/${id}`, input)).assessment,
    onSuccess: (assessment) => {
      client.setQueryData(keys.assessment(id), assessment);
      void client.invalidateQueries({ queryKey: ['assessments'] });
      void client.invalidateQueries({ queryKey: keys.overview });
    },
  });
};

export const useDeleteAssessment = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assessments/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['assessments'] });
      void client.invalidateQueries({ queryKey: keys.overview });
    },
  });
};

// --------------------------------------------------------------- syllabus ----

export const useSyllabus = (assessmentId: string | undefined, options?: QueryOpts<SyllabusNode[]>) =>
  useQuery({
    queryKey: keys.syllabus(assessmentId ?? ''),
    queryFn: async () =>
      (await api.get<{ nodes: SyllabusNode[] }>(`/api/assessments/${assessmentId}/syllabus`)).nodes,
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useSyllabusTemplates = (options?: QueryOpts<SyllabusTemplateSummary[]>) =>
  useQuery({
    queryKey: keys.templates,
    queryFn: async () =>
      (await api.get<{ templates: SyllabusTemplateSummary[] }>('/api/assessments/x/syllabus/templates')).templates,
    ...options,
  });

export const useSyllabusMutation = (assessmentId: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.syllabus(assessmentId) });
    void client.invalidateQueries({ queryKey: keys.assessment(assessmentId) });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ nodes: SyllabusNode[] }>(`/api/assessments/${assessmentId}/syllabus/nodes`, input)).nodes,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ nodeId, ...input }: { nodeId: string } & Record<string, unknown>) =>
      (await api.patch<{ nodes: SyllabusNode[] }>(
        `/api/assessments/${assessmentId}/syllabus/nodes/${nodeId}`,
        input,
      )).nodes,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (nodeId: string) =>
      api.delete(`/api/assessments/${assessmentId}/syllabus/nodes/${nodeId}`),
    onSuccess: invalidate,
  });

  const importTemplate = useMutation({
    mutationFn: async (input: { templateId: string; createStudyItems: boolean }) =>
      api.post<{ importedNodes: number; importedItems: number }>(
        `/api/assessments/${assessmentId}/syllabus/import-template`,
        input,
      ),
    onSuccess: () => {
      invalidate();
      void client.invalidateQueries({ queryKey: keys.items(assessmentId) });
      // Importing must not have created reminders; refetch to prove the list is
      // still empty rather than assuming it.
      void client.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  return { create, update, remove, importTemplate };
};

// --------------------------------------------------------------- trackers ----

export const useTrackers = (assessmentId: string | undefined, options?: QueryOpts<Tracker[]>) =>
  useQuery({
    queryKey: keys.trackers(assessmentId ?? ''),
    queryFn: async () =>
      (await api.get<{ trackers: Tracker[] }>(`/api/assessments/${assessmentId}/trackers`)).trackers,
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useTracker = (assessmentId: string | undefined, trackerId: string | undefined, options?: QueryOpts<Tracker>) =>
  useQuery({
    queryKey: keys.tracker(assessmentId ?? '', trackerId ?? ''),
    queryFn: async () =>
      (await api.get<{ tracker: Tracker }>(`/api/assessments/${assessmentId}/trackers/${trackerId}`)).tracker,
    enabled: Boolean(assessmentId && trackerId),
    ...options,
  });

export const useTrackerMutations = (assessmentId: string, trackerId?: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.trackers(assessmentId) });
    if (trackerId) void client.invalidateQueries({ queryKey: keys.tracker(assessmentId, trackerId) });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ tracker: Tracker }>(`/api/assessments/${assessmentId}/trackers`, input)).tracker,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ tracker: Tracker }>(`/api/assessments/${assessmentId}/trackers/${id}`, input)).tracker,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assessments/${assessmentId}/trackers/${id}`),
    onSuccess: () => {
      invalidate();
      void client.invalidateQueries({ queryKey: keys.items(assessmentId) });
    },
  });

  /**
   * Switching layout never loses item data. When fields cannot be shown by the
   * target layout they are hidden (and reported back) unless the caller opts in
   * to dropping them.
   */
  const switchLayout = useMutation({
    mutationFn: async ({
      id,
      layout,
      dropUnsupportedFields = false,
    }: {
      id: string;
      layout: string;
      dropUnsupportedFields?: boolean;
    }) =>
      api.post<{ tracker: Tracker; hiddenFields: string[] }>(
        `/api/assessments/${assessmentId}/trackers/${id}/layout`,
        { layout, dropUnsupportedFields },
      ),
    onSuccess: invalidate,
  });

  const addColumn = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.post<{ tracker: Tracker }>(`/api/assessments/${assessmentId}/trackers/${id}/columns`, input)).tracker,
    onSuccess: invalidate,
  });

  const updateColumn = useMutation({
    mutationFn: async ({
      id,
      columnId,
      ...input
    }: { id: string; columnId: string } & Record<string, unknown>) =>
      (await api.patch<{ tracker: Tracker }>(
        `/api/assessments/${assessmentId}/trackers/${id}/columns/${columnId}`,
        input,
      )).tracker,
    onSuccess: invalidate,
  });

  const removeColumn = useMutation({
    mutationFn: async ({ id, columnId }: { id: string; columnId: string }) =>
      api.delete(`/api/assessments/${assessmentId}/trackers/${id}/columns/${columnId}`),
    onSuccess: invalidate,
  });

  const reorderColumns = useMutation({
    mutationFn: async ({ id, orderedIds }: { id: string; orderedIds: string[] }) =>
      (await api.post<{ tracker: Tracker }>(
        `/api/assessments/${assessmentId}/trackers/${id}/columns/reorder`,
        { orderedIds },
      )).tracker,
    onSuccess: invalidate,
  });

  const saveView = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.post<SavedView>(`/api/assessments/${assessmentId}/trackers/${id}/views`, input),
    onSuccess: () => {
      invalidate();
      if (trackerId) void client.invalidateQueries({ queryKey: keys.trackerViews(assessmentId, trackerId) });
    },
  });

  const deleteView = useMutation({
    mutationFn: async ({ id, viewId }: { id: string; viewId: string }) =>
      api.delete(`/api/assessments/${assessmentId}/trackers/${id}/views/${viewId}`),
    onSuccess: () => {
      invalidate();
      if (trackerId) void client.invalidateQueries({ queryKey: keys.trackerViews(assessmentId, trackerId) });
    },
  });

  return {
    create,
    update,
    remove,
    switchLayout,
    addColumn,
    updateColumn,
    removeColumn,
    reorderColumns,
    saveView,
    deleteView,
  };
};

export const useTrackerViews = (assessmentId: string | undefined, trackerId: string | undefined) =>
  useQuery({
    queryKey: keys.trackerViews(assessmentId ?? '', trackerId ?? ''),
    queryFn: async () =>
      (await api.get<{ views: SavedView[] }>(
        `/api/assessments/${assessmentId}/trackers/${trackerId}/views`,
      )).views,
    enabled: Boolean(assessmentId && trackerId),
  });

// ------------------------------------------------------------ study items ----

export const useStudyItems = (
  assessmentId: string | undefined,
  params: Record<string, unknown> = {},
  options?: QueryOpts<Paginated<StudyItem>>,
) =>
  useQuery({
    queryKey: keys.items(assessmentId ?? '', params),
    queryFn: async () =>
      api.get<Paginated<StudyItem>>(`/api/assessments/${assessmentId}/items${toQueryString(params)}`),
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useStudyItem = (assessmentId: string | undefined, itemId: string | undefined) =>
  useQuery({
    queryKey: keys.item(assessmentId ?? '', itemId ?? ''),
    queryFn: async () =>
      (await api.get<{ item: StudyItem }>(`/api/assessments/${assessmentId}/items/${itemId}`)).item,
    enabled: Boolean(assessmentId && itemId),
  });

export const useStudyItemMutations = (assessmentId: string, itemId?: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    void client.invalidateQueries({ queryKey: keys.overview });
    void client.invalidateQueries({ queryKey: ['bookmarks'] });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ item: StudyItem }>(`/api/assessments/${assessmentId}/items`, input)).item,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ item: StudyItem }>(`/api/assessments/${assessmentId}/items/${id}`, input)).item,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assessments/${assessmentId}/items/${id}`),
    onSuccess: invalidate,
  });

  /**
   * The ONLY path that changes planned dates. It is called from an explicit user
   * action in the UI, and the backend records the previous values plus a reason.
   */
  const reschedule = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.post<{ item: StudyItem }>(`/api/assessments/${assessmentId}/items/${id}/reschedule`, input))
        .item,
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) =>
      api.post(`/api/assessments/${assessmentId}/items/reorder`, { orderedIds }),
    onSuccess: invalidate,
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) =>
      (await api.patch<{ item: StudyItem }>(`/api/assessments/${assessmentId}/items/${id}`, { completed })).item,
    onSuccess: invalidate,
  });

  const toggleBookmark = useMutation({
    mutationFn: async ({
      item,
      bookmarked,
    }: {
      item: StudyItem;
      bookmarked: boolean;
    }): Promise<void> => {
      if (bookmarked) {
        const existing = await api.get<Paginated<Bookmark>>(
          `/api/bookmarks${toQueryString({ pageSize: 100 })}`,
        );
        const match = existing.items.find((entry) => entry.targetId === item.id && entry.targetType === 'STUDY_ITEM');
        if (match) {
          await api.delete(`/api/bookmarks/${match.id}`);
          return;
        }
        await api.post('/api/bookmarks', {
          targetType: 'STUDY_ITEM',
          studyItemId: item.id,
          label: 'IMPORTANT',
        });
        return;
      }
      const existing = await api.get<Paginated<Bookmark>>(`/api/bookmarks${toQueryString({ pageSize: 100 })}`);
      const match = existing.items.find((entry) => entry.targetId === item.id && entry.targetType === 'STUDY_ITEM');
      if (match) await api.delete(`/api/bookmarks/${match.id}`);
    },
    onSuccess: invalidate,
  });

  const attemptsQuery = useQuery({
    queryKey: keys.attempts(assessmentId, itemId ?? ''),
    queryFn: async () =>
      (await api.get<{ attempts: PracticeAttempt[] }>(
        `/api/assessments/${assessmentId}/items/${itemId}/attempts`,
      )).attempts,
    enabled: Boolean(assessmentId && itemId),
  });

  const createAttempt = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ attempt: PracticeAttempt }>(
        `/api/assessments/${assessmentId}/items/${itemId}/attempts`,
        input,
      )).attempt,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.attempts(assessmentId, itemId ?? '') });
      void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    },
  });

  const deleteAttempt = useMutation({
    mutationFn: async (attemptId: string) =>
      api.delete(`/api/assessments/${assessmentId}/items/${itemId}/attempts/${attemptId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.attempts(assessmentId, itemId ?? '') });
      void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    },
  });

  return {
    create,
    update,
    remove,
    reschedule,
    reorder,
    toggleComplete,
    toggleBookmark,
    attemptsQuery,
    createAttempt,
    deleteAttempt,
  };
};

// ---------------------------------------------------------- study sessions ----

export const useStudySessions = (
  assessmentId: string | undefined,
  params: Record<string, unknown> = {},
  options?: QueryOpts<Paginated<StudySession> & { totalMinutes: number }>,
) =>
  useQuery({
    queryKey: keys.studySessions(assessmentId ?? '', params),
    queryFn: async () =>
      api.get<Paginated<StudySession> & { totalMinutes: number }>(
        `/api/assessments/${assessmentId}/sessions${toQueryString(params)}`,
      ),
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useStudySessionMutations = (assessmentId: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    void client.invalidateQueries({ queryKey: keys.overview });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ session: StudySession }>(`/api/assessments/${assessmentId}/sessions`, input)).session,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (sessionId: string) =>
      api.delete(`/api/assessments/${assessmentId}/sessions/${sessionId}`),
    onSuccess: invalidate,
  });

  return { create, remove };
};

// -------------------------------------------------------------- bookmarks ----

export const useBookmarks = (params: Record<string, unknown> = {}, options?: QueryOpts<Paginated<Bookmark>>) =>
  useQuery({
    queryKey: keys.bookmarks(params),
    queryFn: async () => api.get<Paginated<Bookmark>>(`/api/bookmarks${toQueryString(params)}`),
    ...options,
  });

export const useBookmarkMutations = () => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['bookmarks'] });
    void client.invalidateQueries({ queryKey: ['assessment'] });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ bookmark: Bookmark }>('/api/bookmarks', input)).bookmark,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ bookmark: Bookmark }>(`/api/bookmarks/${id}`, input)).bookmark,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/bookmarks/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
};

// ------------------------------------------------------------------ notes ----

export const useNotes = (
  assessmentId: string | undefined,
  params: Record<string, unknown> = {},
  options?: QueryOpts<Paginated<Note>>,
) =>
  useQuery({
    queryKey: keys.notes(assessmentId ?? '', params),
    queryFn: async () =>
      api.get<Paginated<Note>>(`/api/assessments/${assessmentId}/notes${toQueryString(params)}`),
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useNoteMutations = (assessmentId: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    void client.invalidateQueries({ queryKey: ['bookmarks'] });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ note: Note }>(`/api/assessments/${assessmentId}/notes`, input)).note,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ note: Note }>(`/api/assessments/${assessmentId}/notes/${id}`, input)).note,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assessments/${assessmentId}/notes/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
};

// ------------------------------------------------------------- mock tests ----

export const useMockTests = (
  assessmentId: string | undefined,
  params: Record<string, unknown> = {},
  options?: QueryOpts<Paginated<MockTest>>,
) =>
  useQuery({
    queryKey: keys.mockTests(assessmentId ?? '', params),
    queryFn: async () =>
      api.get<Paginated<MockTest>>(`/api/assessments/${assessmentId}/mock-tests${toQueryString(params)}`),
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useMockTestSummary = (assessmentId: string | undefined, options?: QueryOpts<MockTestSummary>) =>
  useQuery({
    queryKey: keys.mockSummary(assessmentId ?? ''),
    queryFn: async () =>
      (await api.get<{ summary: MockTestSummary }>(`/api/assessments/${assessmentId}/mock-tests/summary`)).summary,
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useMockTestMutations = (assessmentId: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ mockTest: MockTest }>(`/api/assessments/${assessmentId}/mock-tests`, input)).mockTest,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ mockTest: MockTest }>(`/api/assessments/${assessmentId}/mock-tests/${id}`, input))
        .mockTest,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assessments/${assessmentId}/mock-tests/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
};

// -------------------------------------------------------------- reminders ----

export const useReminders = (params: Record<string, unknown> = {}, options?: QueryOpts<Paginated<Reminder>>) =>
  useQuery({
    queryKey: keys.reminders(params),
    queryFn: async () => api.get<Paginated<Reminder>>(`/api/reminders${toQueryString(params)}`),
    ...options,
  });

export const useReminderMutations = (assessmentId?: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['reminders'] });
    if (assessmentId) void client.invalidateQueries({ queryKey: ['assessment', assessmentId] });
  };

  /**
   * The only way a reminder is ever created. Every caller in this app is an
   * explicit user action — an opt-in checkbox or a submit button.
   */
  const create = useMutation({
    mutationFn: async ({ assessmentId: id, ...input }: { assessmentId: string } & Record<string, unknown>) =>
      (await api.post<{ reminder: Reminder }>(`/api/assessments/${id}/reminders`, input)).reminder,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.patch<{ reminder: Reminder }>(`/api/reminders/${id}`, input)).reminder,
    onSuccess: invalidate,
  });

  const action = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      (await api.post<{ reminder: Reminder }>(`/api/reminders/${id}/action`, input)).reminder,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/reminders/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, action, remove };
};

// -------------------------------------------------------------- analytics ----

export const useAnalytics = (assessmentId: string | undefined, options?: QueryOpts<AssessmentAnalytics>) =>
  useQuery({
    queryKey: keys.analytics(assessmentId ?? ''),
    queryFn: async () =>
      (await api.get<{ analytics: AssessmentAnalytics }>(`/api/assessments/${assessmentId}/analytics`)).analytics,
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useOverview = (options?: QueryOpts<GlobalOverview>) =>
  useQuery({
    queryKey: keys.overview,
    queryFn: async () => api.get<GlobalOverview>('/api/analytics/overview'),
    ...options,
  });

// ---------------------------------------------------------------- settings ----

export const useSettings = (options?: QueryOpts<Settings>) =>
  useQuery({
    queryKey: keys.settings,
    queryFn: async () => (await api.get<{ settings: Settings }>('/api/settings')).settings,
    ...options,
  });

export const useUpdateSettings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.patch<{ settings: Settings }>('/api/settings', input)).settings,
    onSuccess: (settings) => client.setQueryData(keys.settings, settings),
  });
};

export const useUpdateProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.patch<{ user: User }>('/api/settings/profile', input)).user,
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });
};

export const useAccountSessions = (options?: QueryOpts<SessionRecord[]>) =>
  useQuery({
    queryKey: keys.sessions,
    queryFn: async () => (await api.get<{ sessions: SessionRecord[] }>('/api/settings/sessions')).sessions,
    ...options,
  });

export const useRevokeSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => api.delete(`/api/settings/sessions/${sessionId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.sessions }),
  });
};

// ----------------------------------------------------------- custom fields ----

export const useCustomFields = (assessmentId: string | undefined, options?: QueryOpts<CustomField[]>) =>
  useQuery({
    queryKey: keys.customFields(assessmentId ?? ''),
    queryFn: async () =>
      (await api.get<{ customFields: CustomField[] }>(`/api/assessments/${assessmentId}/custom-fields`))
        .customFields,
    enabled: Boolean(assessmentId),
    ...options,
  });

export const useCustomFieldMutations = (assessmentId: string) => {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.customFields(assessmentId) });
    void client.invalidateQueries({ queryKey: keys.items(assessmentId) });
  };

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await api.post<{ customFields: CustomField[] }>(`/api/assessments/${assessmentId}/custom-fields`, input))
        .customFields,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ fieldId, ...input }: { fieldId: string } & Record<string, unknown>) =>
      (await api.patch<{ customFields: CustomField[] }>(
        `/api/assessments/${assessmentId}/custom-fields/${fieldId}`,
        input,
      )).customFields,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (fieldId: string) =>
      api.delete(`/api/assessments/${assessmentId}/custom-fields/${fieldId}`),
    onSuccess: () => {
      invalidate();
      void client.invalidateQueries({ queryKey: keys.trackers(assessmentId) });
    },
  });

  return { create, update, remove };
};

export type { User };
