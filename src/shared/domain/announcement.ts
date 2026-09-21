export interface Announcement {
  message: string; // plain text, trimmed; 1..200 chars when enabled, may be empty when disabled
  enabled: boolean;
  version: number; // dismissal identity; bumps only on publish-as-new
  updatedAt: string; // ISO timestamp of the last save of any kind
}

export const ANNOUNCEMENT_MAX_LENGTH = 200;
