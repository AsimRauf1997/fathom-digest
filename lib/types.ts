// Shapes shared between the API routes and the UI.

export interface ActionItem {
  description: string;
  assignee?: string;
  completed?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  startedAt: string | null;
  summaryMarkdown: string;
  actionItems: ActionItem[];
  url: string | null;
  shareUrl: string | null;
}

export interface TranscriptItem {
  speaker: string;
  text: string;
  timestamp: string;
}
