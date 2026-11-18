import * as SecureStore from 'expo-secure-store';

const keyFor = (userId: string) => `meraceo.dobDraft.${encodeURIComponent(userId)}`;

export const getDateOfBirthDraft = (userId: string) => SecureStore.getItemAsync(keyFor(userId));
export const saveDateOfBirthDraft = (userId: string, value: string) => SecureStore.setItemAsync(keyFor(userId), value);
export const clearDateOfBirthDraft = (userId: string) => SecureStore.deleteItemAsync(keyFor(userId));
