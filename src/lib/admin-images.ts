import "server-only";
import { saveImage } from "@/lib/storage";

export type UploadedImage = { url: string; width: number | null; height: number | null };

/** Saves every `files` entry from an uploader form. Dimensions are measured in the browser. */
export async function saveUploadedImages(formData: FormData, folder: string): Promise<UploadedImage[]> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one image.");
  const widths = formData.getAll("widths").map(Number);
  const heights = formData.getAll("heights").map(Number);
  const saved: UploadedImage[] = [];
  for (const [i, file] of files.entries()) {
    const url = await saveImage(file, folder);
    saved.push({
      url,
      width: Number.isFinite(widths[i]) && widths[i] > 0 ? widths[i] : null,
      height: Number.isFinite(heights[i]) && heights[i] > 0 ? heights[i] : null,
    });
  }
  return saved;
}
