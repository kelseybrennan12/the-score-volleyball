import type { AnnouncementRepo } from "@/backend/runtime/adapters/announcements/port";
import type { Announcement } from "@/shared/domain/announcement";

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
