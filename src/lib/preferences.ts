const NOTIFICATION_PREFS_KEY = 'rcp_notification_prefs';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  statusUpdates: boolean;
  contactEmail: string;
  contactPhone: string;
  reminderDaysBefore: number;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email: true,
  sms: false,
  statusUpdates: true,
  contactEmail: '',
  contactPhone: '',
  reminderDaysBefore: 3,
};

export function getNotificationPrefs(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFS, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PREFS;
}

export function saveNotificationPrefs(
  prefs: Partial<NotificationPreferences>
): NotificationPreferences {
  const current = getNotificationPrefs();
  const updated = { ...current, ...prefs };
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors (quota, private mode, etc.)
  }
  return updated;
}

export function getAfterPhotoKey(reportId: string): string {
  return `rcp_after_photo_${reportId}`;
}

export function saveAfterPhoto(reportId: string, dataUrl: string): void {
  try {
    localStorage.setItem(getAfterPhotoKey(reportId), dataUrl);
  } catch {
    // ignore storage errors
  }
}

export function loadAfterPhoto(reportId: string): string | null {
  try {
    return localStorage.getItem(getAfterPhotoKey(reportId));
  } catch {
    return null;
  }
}

export function clearAfterPhoto(reportId: string): void {
  try {
    localStorage.removeItem(getAfterPhotoKey(reportId));
  } catch {
    // ignore storage errors
  }
}