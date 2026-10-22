export type StoredUpload = {
  storageKey: string;
  expiresAt: Date;
};

export function createTemporaryUploadRecord(storageKey: string, now = new Date()): StoredUpload {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 1);
  return { storageKey, expiresAt };
}
