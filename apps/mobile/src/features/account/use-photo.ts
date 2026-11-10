import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';

// Opens the photo library, uploads the chosen square picture to file storage, and returns where it was stored
// (the key to save on the profile) and its local address (for showing a preview). Returns null if cancelled.
export async function pickAndUpload(token: string, kind: 'photo' | 'logo'): Promise<{ key: string; uri: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  // Only these three kinds are accepted by the server. The picker gives JPEG once it has cropped.
  const mime = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
  const { uploadUrl, key } = await api.presignUpload(token, kind, mime);
  const file = await (await fetch(asset.uri)).blob();
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': mime }, body: file });
  if (!res.ok) throw new Error('upload_failed');
  return { key, uri: asset.uri };
}

// Lets the person pick a picture from their library, uploads it straight to file storage, and saves it on
// their profile. `busy` is true while that happens and `failed` when something went wrong.
export function usePhoto() {
  const { token, user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Professionals add a profile photo; owners add a business logo.
  const kind = user?.role === 'professional' ? 'photo' : 'logo';

  async function pick() {
    if (!token) return;
    setFailed(false);
    setBusy(true);
    try {
      const uploaded = await pickAndUpload(token, kind);
      if (uploaded) {
        await api.savePhoto(token, uploaded.key);
        await refresh();
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token) return;
    setBusy(true);
    setFailed(false);
    try {
      await api.removePhoto(token);
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { pick, remove, busy, failed, kind };
}
