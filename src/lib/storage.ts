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
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  HOMEWORK: {
    maxBytes: 15 * 1024 * 1024, // 15MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
  MATERIAL: {
    maxBytes: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "video/mp4",
      "audio/mpeg",
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
]);

export function validateFileUpload(options: FileValidationOptions): FileValidationResult {
  const { fileName, contentType, sizeBytes, category } = options;
  const config = CATEGORY_LIMITS[category];

  if (!config) {
    throw new StorageValidationError(`Unknown storage category: ${category}`);
  }

  // 1. Sanitize file name
  const baseName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = baseName.split(".").pop()?.toLowerCase() || "";

  if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
    throw new StorageValidationError(`File type .${ext} is not allowed for security reasons`);
  }

  // 2. Validate MIME type
  if (!config.allowedTypes.includes(contentType.toLowerCase())) {
    throw new StorageValidationError(
      `Content-Type ${contentType} is not permitted for category ${category}`
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

export interface PresignedUrlOptions extends FileValidationOptions {
  centerId: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

export async function generatePresignedUploadUrl(
  options: PresignedUrlOptions
): Promise<PresignedUrlResult> {
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

  const provider = (process.env.STORAGE_PROVIDER || "memory").toLowerCase();

  if (provider === "s3" || provider === "r2") {
    const bucket = process.env.STORAGE_BUCKET || "e-darschi-uploads";
    const endpoint = (process.env.STORAGE_ENDPOINT || "https://s3.amazonaws.com").replace(/\/$/, "");
    const uploadUrl = `${endpoint}/${bucket}/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock-presigned-sig`;

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
    };
  }

  // Fallback / memory / local driver
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const uploadUrl = `${baseUrl}/api/upload/direct?key=${encodeURIComponent(key)}&token=mock-token-${timestamp}`;

  return {
    uploadUrl,
    fileUrl,
    key,
    expiresIn,
  };
}
