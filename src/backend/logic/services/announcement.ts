import type { AnnouncementRepo } from "@/backend/runtime/adapters/announcements/port";
import { ANNOUNCEMENT_MAX_LENGTH, type Announcement } from "@/shared/domain/announcement";

/**
 * The read seam for the Viewer. Returns the current Announcement or nothing, and
 * swallows and logs read failures (missing store, corrupt file) so the page
 * always renders rather than erroring on a problem with the announcement.
 */
export async function readAnnouncement(repo: AnnouncementRepo): Promise<Announcement | null> {
  try {
    return await repo.read();
  } catch (err) {
    console.error("Failed to read announcement", err);
    return null;
  }
}

export interface SaveAnnouncementInput {
  message: string;
  enabled: boolean;
  publishAsNew: boolean;
  repo: AnnouncementRepo;
  now?: () => Date;
}

export interface SaveAnnouncementResult {
  status: 200 | 400;
  body: Announcement | { error: string };
}

/**
 * The save seam for Admin. Trims the message, validates it, applies the version
 * rule (bump only on publish-as-new), writes, and returns the stored record.
 *
 * The version is the Dismissal identity: "Save edits" and the on/off switch
 * leave it alone so existing dismissals hold, while "Publish as new" increments
 * it so everyone sees the announcement again.
 */
export async function saveAnnouncement({
  message,
  enabled,
  publishAsNew,
  repo,
  now = () => new Date(),
}: SaveAnnouncementInput): Promise<SaveAnnouncementResult> {
  const trimmed = message.trim();

  if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
    return {
      status: 400,
      body: { error: `Message must be ${ANNOUNCEMENT_MAX_LENGTH} characters or fewer.` },
    };
  }
  if (enabled && trimmed.length === 0) {
    return {
      status: 400,
      body: { error: "Message is required to enable the announcement." },
    };
  }

  const current = await readAnnouncement(repo);
  const baseVersion = current?.version ?? 0;
  const stored: Announcement = {
    message: trimmed,
    enabled,
    version: publishAsNew ? baseVersion + 1 : baseVersion,
    updatedAt: now().toISOString(),
  };
  await repo.write(stored);
  return { status: 200, body: stored };
}
