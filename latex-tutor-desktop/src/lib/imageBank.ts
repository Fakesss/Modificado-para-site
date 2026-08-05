import type { ImageInfo } from "../types/global";

let current: ImageInfo[] = [];
const listeners = new Set<(images: ImageInfo[]) => void>();

export function getImageBank(): ImageInfo[] {
  return current;
}

export function getImageNames(): string[] {
  return current.map((i) => i.name);
}

export async function loadImageBank() {
  current = await window.api.images.list();
  listeners.forEach((l) => l(current));
}

export async function addImagesToBank(): Promise<number> {
  const result = await window.api.images.add();
  current = result.images;
  listeners.forEach((l) => l(current));
  return result.added;
}

export async function deleteImageFromBank(name: string) {
  current = await window.api.images.delete(name);
  listeners.forEach((l) => l(current));
}

export function subscribeImageBank(cb: (images: ImageInfo[]) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
