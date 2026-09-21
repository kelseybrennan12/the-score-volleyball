import type { Announcement } from "@/shared/domain/announcement";

/**
 * The stored Announcement lives in the same private store as the snapshots. At
 * most one exists at a time, so the port is just read/write of the single record.
 */
export interface AnnouncementRepo {
  read(): Promise<Announcement | null>;
  write(announcement: Announcement): Promise<void>;
}
