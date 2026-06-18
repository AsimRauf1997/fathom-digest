// Central query key factory for React Query cache entries.
export const queryKeys = {
  meetingsByDate: (date: string) => ["meetings", "date", date] as const,
};
