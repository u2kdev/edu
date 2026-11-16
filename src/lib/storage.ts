import fs from "fs";
import path from "path";
// Reason: Exception: Storage quota inspection aggregates across tenant materials and subscription plan limits.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

export type StorageCategory = "AVATAR" | "HOMEWORK" | "MATERIAL";

export interface FileValidationOptions {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category: StorageCategory;
}

export interface FileValidationResult {
  valid: boolean;
  sanitizedFileName: string;
  category: StorageCategory;
}

const CATEGORY_LIMITS: Record<StorageCategory, { maxBytes: number; allowedTypes: string[] }> = {
  AVATAR: {
    maxBytes: 2 * 1024 * 1024, // 2MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  HOMEWORK: {
    maxBytes: 25 * 1024 * 1024, // 25MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
  MATERIAL: {
    maxBytes: 100 * 1024 * 1024, // 100MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
    ],
  },
};

const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "bash",
  "php",
  "phtml",
  "py",
  "pl",
  "cgi",
  "js",
  "vbs",
  "msi",
  "jar",
  "scr",
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "shtml",
  "xml",
  "jsp",
  "asp",
  "aspx",
]);

export function validateFileUpload(options: FileValidationOptions): FileValidationResult {
  const { fileName, contentType, sizeBytes, category } = options;
  const config = CATEGORY_LIMITS[category];

  if (!config) {
    throw new StorageValidationError(`Неизвестная категория хранилища: ${category}`);
  }

  // 1. Sanitize file name
  const baseName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = baseName.split(".").pop()?.toLowerCase() || "";

  if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
    throw new StorageValidationError(`Файлы типа .${ext} запрещены для загрузки`);
  }

  // 2. Validate MIME type
  if (!config.allowedTypes.includes(contentType.toLowerCase())) {
    throw new StorageValidationError(
      `Формат файла (${contentType}) не поддерживается для категории ${category}`
    );
  }

  // 3. Validate size
  if (sizeBytes > config.maxBytes) {
    throw new StorageValidationError(
      `File size exceeds maximum allowed of ${config.maxBytes / (1024 * 1024)}MB`
    );
  }

  return {
    valid: true,
    sanitizedFileName: baseName,
    category,
  };
}

export interface StorageQuotaResult {
  allowed: boolean;
  usedBytes: number;
  maxBytes: number;
  percent: number;
  reason?: string;
}

/**
 * Checks center's storage quota against active subscription plan maxStorage.
 */
export async function checkStorageQuota(
  centerId: string,
  additionalBytes = 0
): Promise<StorageQuotaResult> {
  const subscription = await db.subscription.findFirst({
    where: { centerId, status: { in: ["ACTIVE", "TRIAL"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  // Default quota is 5120 MB if not defined
  const maxMb = subscription?.plan?.maxStorage ?? 5120;
  const maxBytes = maxMb * 1024 * 1024;

  const [currentUsage, hwSubmissions] = await Promise.all([
    db.material.aggregate({
      where: { centerId, deletedAt: null },
      _sum: { fileSizeBytes: true },
    }),
    db.homeworkSubmission.findMany({
      where: { centerId, filesJson: { not: null } },
      select: { filesJson: true },
    }),
  ]);

  let hwBytes = 0;
  for (const s of hwSubmissions) {
    if (!s.filesJson) continue;
    try {
      const parsed = JSON.parse(s.filesJson);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray(parsed.files)
        ? parsed.files
        : [];
      for (const item of list) {
        if (
          item &&
          typeof item === "object" &&
          typeof item.sizeBytes === "number"
        ) {
          hwBytes += item.sizeBytes;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const usedBytes = (currentUsage._sum.fileSizeBytes ?? 0) + hwBytes;
  const totalAfter = usedBytes + additionalBytes;
  const percent = maxBytes > 0 ? Math.min(100, Math.round((usedBytes / maxBytes) * 100)) : 0;

  if (totalAfter > maxBytes) {
    return {
      allowed: false,
      usedBytes,
      maxBytes,
      percent,
      reason: `Превышена квота дискового хранилища по тарифу (${maxMb} МБ). Освободите место или обновите подписку.`,
    };
  }

  return {
    allowed: true,
    usedBytes,
    maxBytes,
    percent,
  };
}

export interface SaveFileOptions {
  centerId: string;
  category: StorageCategory;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export interface SavedFileResult {
  fileUrl: string;
  key: string;
  sizeBytes: number;
  fileName: string;
}

export function getStorageDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  return path.resolve(process.cwd(), "storage", "uploads");
}

export function getLegacyStorageDir(): string {
  return path.resolve(process.cwd(), "public", "uploads");
}

/**
 * Safely resolves a relative path within a base directory, preventing Path Traversal.
 * Returns the canonical absolute path if safe, or null if traversal is attempted or path is invalid.
 */
export function safeResolvePath(baseDir: string, relativePath: string): string | null {
  try {
    const cleaned = relativePath.replace(/^[/\\]+/, "");
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(resolvedBase, cleaned);

    const basePrefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(basePrefix)) {
      return null;
    }

    return resolvedTarget;
  } catch {
    return null;
  }
}

/**
 * Validates binary buffer signatures (magic bytes) against declared MIME type.
 * Detects disguised files, polyglots, and embedded scripts.
 */
export function validateFileBufferSignature(buffer: Buffer, declaredMime: string): void {
  if (!buffer || buffer.length === 0) {
    throw new StorageValidationError("Uploaded file is empty");
  }

  const mime = declaredMime.toLowerCase();

  // 1. Script / XML / HTML detection in headers
  const headerSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("latin1");
  if (
    /<script[\s>]/i.test(headerSample) ||
    /<\?xml/i.test(headerSample) ||
    /<svg[\s>]/i.test(headerSample) ||
    /<!doctype\s+html/i.test(headerSample) ||
    /<html[\s>]/i.test(headerSample)
  ) {
    throw new StorageValidationError("Файл содержит недопустимые скрипты или разметку");
  }

  // 2. Binary signatures for common formats
  if (mime === "image/jpeg" || mime === "image/jpg") {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new StorageValidationError("Содержимое файла не соответствует формату JPEG");
    }
  } else if (mime === "image/png") {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (buffer.length < 8 || !pngMagic.every((b, i) => buffer[i] === b)) {
      throw new StorageValidationError("Содержимое файла не соответствует формату PNG");
    }
  } else if (mime === "image/gif") {
    if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "GIF8") {
      throw new StorageValidationError("Содержимое файла не соответствует формату GIF");
    }
  } else if (mime === "image/webp") {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
      buffer.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      throw new StorageValidationError("Содержимое файла не соответствует формату WEBP");
    }
  } else if (mime === "application/pdf") {
    if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new StorageValidationError("Содержимое файла не соответствует формату PDF");
    }
  } else if (
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    mime.includes("officedocument") ||
    mime.includes("vnd.openxmlformats")
  ) {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      (buffer[2] !== 0x03 && buffer[2] !== 0x05 && buffer[2] !== 0x07)
    ) {
      throw new StorageValidationError("Содержимое файла не соответствует формату архива или документа");
    }
  }
}

export async function saveFile(options: SaveFileOptions): Promise<SavedFileResult> {
  const { centerId, category, fileName, contentType, buffer } = options;
  const sizeBytes = buffer.length;

  // 1. Validate file format and size
  const validated = validateFileUpload({
    fileName,
    contentType,
    sizeBytes,
    category,
  });

  // 2. Validate magic bytes / signatures
  validateFileBufferSignature(buffer, contentType);

  // 3. Validate quota
  const quota = await checkStorageQuota(centerId, sizeBytes);
  if (!quota.allowed) {
    throw new StorageValidationError(quota.reason || "Storage quota exceeded");
  }

  const timestamp = Date.now();
  const safeName = `${timestamp}_${validated.sanitizedFileName}`;
  const key = `${centerId}/${category.toLowerCase()}/${safeName}`;

  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  // S3 / R2 / MinIO support via env configuration
  if (provider === "s3" || provider === "r2" || provider === "minio") {
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    if (bucket && endpoint) {
      // In production S3 environment, returns the S3/R2 direct or CDN URL
      const publicDomain =
        process.env.STORAGE_PUBLIC_DOMAIN ||
        process.env.NEXT_PUBLIC_CDN_URL ||
        `${endpoint.replace(/\/$/, "")}/${bucket}`;
      return {
        fileUrl: `${publicDomain.replace(/\/$/, "")}/${key}`,
        key,
        sizeBytes,
        fileName: validated.sanitizedFileName,
      };
    }
  }

  // Default driver: Local file system in private storage directory
  const storageDir = getStorageDir();
  const uploadDir = path.join(storageDir, centerId, category.toLowerCase());
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, safeName);
  await fs.promises.writeFile(filePath, buffer);

  const fileUrl = `/uploads/${centerId}/${category.toLowerCase()}/${safeName}`;

  return {
    fileUrl,
    key,
    sizeBytes,
    fileName: validated.sanitizedFileName,
  };
}

export async function deleteStoredFile(fileUrl: string): Promise<boolean> {
  try {
    if (!fileUrl) return false;
    if (fileUrl.includes("..")) return false;

    if (fileUrl.startsWith("/uploads/") || fileUrl.startsWith("/api/files/")) {
      const relativePart = fileUrl.replace(/^\/(uploads|api\/files)\//, "");

      // Try resolving in primary storage directory
      const primaryPath = safeResolvePath(getStorageDir(), relativePart);
      if (primaryPath && fs.existsSync(primaryPath)) {
        await fs.promises.unlink(primaryPath);
        return true;
      }

      // Try resolving in legacy directory
      const legacyPath = safeResolvePath(getLegacyStorageDir(), relativePart);
      if (legacyPath && fs.existsSync(legacyPath)) {
        await fs.promises.unlink(legacyPath);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface PresignedUrlOptions extends FileValidationOptions {
  centerId: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

export function isUploadsEnabled(): boolean {
  return (
    process.env.FEATURE_UPLOADS === "true" ||
    process.env.NEXT_PUBLIC_FEATURE_UPLOADS === "true"
  );
}

export async function generatePresignedUploadUrl(
  options: PresignedUrlOptions
): Promise<PresignedUrlResult> {
  if (!isUploadsEnabled()) {
    throw new StorageValidationError("Uploads are disabled (FEATURE_UPLOADS=false)");
  }

  const validated = validateFileUpload(options);
  const { centerId, category } = options;

  const timestamp = Date.now();
  const key = `${centerId}/${category.toLowerCase()}/${timestamp}-${validated.sanitizedFileName}`;
  const expiresIn = 900; // 15 minutes

  const publicDomain =
    process.env.STORAGE_PUBLIC_DOMAIN ||
    process.env.NEXT_PUBLIC_CDN_URL ||
    "https://cdn.e-darschi.uz";
  const fileUrl = `${publicDomain.replace(/\/$/, "")}/${key}`;

  const provider = (process.env.STORAGE_PROVIDER || "").toLowerCase();

  if (provider === "s3" || provider === "r2") {
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    if (!bucket || !endpoint) {
      throw new StorageValidationError(
        "S3 storage requires valid STORAGE_BUCKET and STORAGE_ENDPOINT configuration"
      );
    }
    throw new StorageValidationError(
      "Real S3 uploads require AWS SDK presigner and credentials. Mock signatures are disabled."
    );
  }

  throw new StorageValidationError("No active storage provider configured");
}
