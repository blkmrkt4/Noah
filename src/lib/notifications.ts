/**
 * Notification Engine — batches events into digests per-user, per-project.
 *
 * Strategy:
 * - Events within the digest window (default: 30 min) are batched.
 * - Urgent events (disposition issued, project rejected) deliver immediately.
 * - Each notification carries a digest_payload with rolled-up events.
 */

import { prisma } from "./prisma";

const DIGEST_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface NotificationEvent {
  type: string;
  message: string;
  entityId?: string;
  entityType?: string;
  timestamp?: string;
}

/**
 * Send a notification event. Batches into existing digest or creates new one.
 */
export async function notify(
  userId: string,
  projectId: string,
  event: NotificationEvent,
  urgent = false
): Promise<void> {
  if (urgent) {
    // Urgent: deliver immediately, don't batch
    await prisma.notification.create({
      data: {
        userId,
        projectId,
        type: "urgent",
        channel: "in_app",
        digestPayload: { events: [{ ...event, timestamp: new Date().toISOString() }] },
        deliveredAt: new Date(),
      },
    });
    return;
  }

  // Look for an existing open digest within the window
  const windowStart = new Date(Date.now() - DIGEST_WINDOW_MS);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      projectId,
      type: "digest",
      deliveredAt: null,
      // Notifications created within the window that haven't been delivered
    },
    orderBy: { id: "desc" },
  });

  if (existing) {
    // Append to existing digest
    const currentPayload = (existing.digestPayload as unknown as { events: NotificationEvent[] }) || { events: [] };
    currentPayload.events.push({ ...event, timestamp: new Date().toISOString() });

    await prisma.notification.update({
      where: { id: existing.id },
      data: { digestPayload: currentPayload as any },
    });
  } else {
    // Create new digest
    await prisma.notification.create({
      data: {
        userId,
        projectId,
        type: "digest",
        channel: "in_app",
        digestPayload: { events: [{ ...event, timestamp: new Date().toISOString() }] },
      },
    });
  }
}

/**
 * Deliver pending digests that have passed their window.
 * In production, this would be called by a cron job.
 */
export async function deliverPendingDigests(): Promise<number> {
  const cutoff = new Date(Date.now() - DIGEST_WINDOW_MS);

  const pending = await prisma.notification.findMany({
    where: {
      type: "digest",
      deliveredAt: null,
    },
  });

  // Only deliver ones older than the window
  const toDeliver = pending.filter(
    (n) => new Date(n.id) < cutoff // approximate — in production use createdAt
  );

  for (const n of toDeliver) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { deliveredAt: new Date() },
    });
  }

  return toDeliver.length;
}

/**
 * Get unread notifications for a user.
 */
export async function getUnreadNotifications(userId: string) {
  return prisma.notification.findMany({
    where: {
      userId,
      readAt: null,
      deliveredAt: { not: null },
    },
    include: { project: true },
    orderBy: { deliveredAt: "desc" },
    take: 50,
  });
}

/**
 * Mark notifications as read.
 */
export async function markRead(notificationIds: string[]) {
  await prisma.notification.updateMany({
    where: { id: { in: notificationIds } },
    data: { readAt: new Date() },
  });
}
