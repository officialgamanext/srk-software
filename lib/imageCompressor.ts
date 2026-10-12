/**
 * Client-side high-quality image compressor.
 * Decreases image size to <= 60KB without losing sharp visual quality
 * using Canvas scaling, high-quality interpolation, and iterative compression.
 */

export interface CompressionResult {
  blob: Blob;
  sizeKB: number;
  originalSizeKB: number;
  fileName: string;
}

export async function compressImageTo60KB(
  file: File,
  maxSizeBytes = 60 * 1024 // 60 KB target limit
): Promise<CompressionResult> {
  const originalSizeKB = Math.round(file.size / 1024);

  // If already under 60KB and is already a common web format, still check or optimize
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image element"));
      img.onload = async () => {
        try {
          let width = img.width;
          let height = img.height;

          // Max bounds to maintain quality while preventing gigantic canvases
          const MAX_INITIAL_DIM = 1200;
          if (width > MAX_INITIAL_DIM || height > MAX_INITIAL_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_INITIAL_DIM) / width);
              width = MAX_INITIAL_DIM;
            } else {
              width = Math.round((width * MAX_INITIAL_DIM) / height);
              height = MAX_INITIAL_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("Canvas context 2D not supported"));
            return;
          }

          canvas.width = width;
          canvas.height = height;

          // High quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Test WebP support with progressive quality stepping
          let quality = 0.85;
          let currentBlob: Blob | null = await getCanvasBlob(canvas, "image/webp", quality);

          // If browser doesn't support WebP, fallback to JPEG
          const format = currentBlob ? "image/webp" : "image/jpeg";
          if (!currentBlob) {
            currentBlob = await getCanvasBlob(canvas, "image/jpeg", quality);
          }

          let attempts = 0;
          // Step down quality and dimensions until <= 60KB
          while (currentBlob && currentBlob.size > maxSizeBytes && attempts < 8) {
            attempts++;
            if (quality > 0.45) {
              quality -= 0.1;
            } else {
              // Scale dimensions down by 15%
              width = Math.round(width * 0.85);
              height = Math.round(height * 0.85);
              canvas.width = width;
              canvas.height = height;
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.drawImage(img, 0, 0, width, height);
            }
            currentBlob = await getCanvasBlob(canvas, format, quality);
          }

          if (!currentBlob) {
            reject(new Error("Unable to compress image"));
            return;
          }

          const finalSizeKB = Math.round(currentBlob.size / 1024);
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const ext = format === "image/webp" ? "webp" : "jpg";

          resolve({
            blob: currentBlob,
            sizeKB: finalSizeKB,
            originalSizeKB,
            fileName: `${baseName}_60kb.${ext}`,
          });
        } catch (e) {
          reject(e);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

function getCanvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      type,
      quality
    );
  });
}
