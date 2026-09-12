import {
  downloadImageBlob,
  privateQuoteImageReference,
  privateQuoteImagePath,
  publicUrl as storagePublicUrl,
  storagePathFromPublicUrl,
} from '@/services/supabase/imagesRepo';
import { getImage, getQuoteImage, imageBlobCacheActive } from '@/lib/media/imageStorage';

export const DEFAULT_LOGO_PATH = 'owin-user-assets/logo/logo.webp';
const STATIC_PUBLIC_PREFIXES = ['owin-user-assets/'];

function appBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function withBasePath(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${appBase()}${clean}`;
}

export function normalizeImagePath(path: string | null | undefined): string | null {
  const raw = String(path || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const normalized = raw
    .replace(/^\/api\/images\/+/, '')
    .replace(/^api\/images\/+/, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (STATIC_PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return withBasePath(normalized);
  return normalized;
}

export function imageStoreKeyFromPath(path: string | null | undefined): string | null {
  const normalized = normalizeImagePath(path);
  if (!normalized) return null;
  if (privateQuoteImagePath(normalized)) return normalized;
  const storagePath = storagePathFromPublicUrl(normalized);
  if (/^https?:/i.test(normalized)) return storagePath;
  if (/^(data:|blob:)/i.test(normalized)) return null;
  if (normalized.startsWith(appBase())) return null;
  return storagePath || normalized;
}

export function productCoverPath(code: string, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeCode = code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'product';
  return `products/${safeCode}-${slug || 'item'}/images/cover.webp`;
}

/**
 * URL bản thumbnail (list) của 1 ảnh master trên Supabase Storage.
 * Quy ước: master ở `.../product-images/img/<hash>`, thumb ở `.../product-images/thumb/<hash>`.
 * Trả null nếu URL không phải ảnh master Supabase (không có thumb tương ứng).
 * Lightbox / export / form luôn dùng master (URL gốc), không dùng thumb.
 */
export function thumbUrlFor(url: string | null | undefined): string | null {
  if (!url || !url.includes('/product-images/img/')) return null;
  return url.replace('/product-images/img/', '/product-images/thumb/');
}

export function quoteItemImagePath(quoteId: string, itemCode: string, extension = 'webp'): string {
  const safeQuote = quoteId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'draft';
  const safeItem = itemCode.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'item';
  const safeExt = extension.replace(/^\./, '').replace(/[^a-zA-Z0-9]+/g, '') || 'webp';
  return privateQuoteImageReference(`quotes/${safeQuote}/items/${safeItem}/cover.${safeExt}`);
}

/**
 * Bản đồng bộ của `resolveImageUrl`: ảnh công khai (sản phẩm, bảng giá, asset
 * tĩnh) chỉ là phép ghép chuỗi nên dựng được ngay trong lúc render.
 *
 * Trả `null` khi buộc phải tải blob — chỉ ảnh báo giá riêng tư — để phía gọi
 * biết là phải đi đường async. Nhờ đó danh sách vài trăm ảnh không còn tốn mỗi
 * ảnh một effect + một lần commit riêng của React.
 */
export function resolveImageUrlSync(path: string | null | undefined): string | null {
  const normalized = normalizeImagePath(path);
  if (!normalized) return withBasePath(DEFAULT_LOGO_PATH);
  if (/^(https?:|data:|blob:)/i.test(normalized) || normalized.startsWith(appBase())) {
    return normalized;
  }
  if (privateQuoteImagePath(normalized)) return null;

  const key = imageStoreKeyFromPath(normalized);
  if (!key) return withBasePath(DEFAULT_LOGO_PATH);
  return storagePublicUrl(key);
}

export async function resolveImageUrl(path: string | null | undefined): Promise<{
  url: string;
  revoke: boolean;
}> {
  const direct = resolveImageUrlSync(path);
  if (direct !== null) return { url: direct, revoke: false };

  // Chỉ còn đúng một nhánh cần async: ảnh báo giá riêng tư phải tải blob.
  const blob = await downloadImageBlob(normalizeImagePath(path) as string);
  return blob
    ? { url: URL.createObjectURL(blob), revoke: true }
    : { url: withBasePath(DEFAULT_LOGO_PATH), revoke: false };
}

/**
 * Ảnh tĩnh dùng chung (logo dự phòng) chỉ đọc một lần cho cả phiên: mỗi dòng
 * thiếu ảnh trước đây lại tải và mã hoá lại đúng file logo đó.
 */
const publicDataUrlCache = new Map<string, Promise<string | null>>();

async function fetchPublicDataUrl(publicPath: string): Promise<string | null> {
  const cached = publicDataUrlCache.get(publicPath);
  if (cached) return cached;
  const request = (async () => {
    try {
      const response = await fetch(withBasePath(publicPath.replace(/^\/+/, '')));
      if (!response.ok) return null;
      return blobToDataUrl(await response.blob());
    } catch {
      return null;
    }
  })();
  publicDataUrlCache.set(publicPath, request);
  request.then((value) => {
    if (value === null) publicDataUrlCache.delete(publicPath);
  });
  return request;
}

/**
 * Đi qua bộ nhớ đệm blob của `imageStorage` trước, để lần xuất file thứ hai (và
 * các dòng trùng ảnh trong cùng một lần xuất) không phải tải lại từ Storage.
 */
async function fetchDataUrl(source: string): Promise<string | null> {
  if (imageBlobCacheActive()) {
    const isQuotePrivate = source.startsWith('quotes/') || Boolean(privateQuoteImagePath(source));
    const cached = await (isQuotePrivate ? getQuoteImage(source) : getImage(source));
    return cached ? blobToDataUrl(cached) : null;
  }
  const blob = await downloadImageBlob(source);
  return blob ? blobToDataUrl(blob) : null;
}

/**
 * Load image as data URL for DOCX embedding.
 * Falls back to OWIN logo when path is missing or unreadable.
 */
export async function getImageDataUrlByPath(
  path: string | null | undefined,
  options?: { fallbackLogo?: boolean },
): Promise<string | null> {
  const useFallback = options?.fallbackLogo !== false;
  const normalized = normalizeImagePath(path);

  const load = async (): Promise<string | null> => {
    if (!normalized) return null;
    if (normalized.startsWith('data:')) return normalized;
    if (/^(https?:|blob:)/i.test(normalized)) return fetchDataUrl(normalized);
    if (normalized.startsWith(appBase())) {
      try {
        const response = await fetch(normalized);
        if (!response.ok) return null;
        return blobToDataUrl(await response.blob());
      } catch {
        return null;
      }
    }
    const key = imageStoreKeyFromPath(normalized);
    if (!key) return null;
    return fetchDataUrl(key);
  };

  const dataUrl = await load();
  if (dataUrl) return dataUrl;
  if (!useFallback) return null;
  return fetchPublicDataUrl(DEFAULT_LOGO_PATH);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
