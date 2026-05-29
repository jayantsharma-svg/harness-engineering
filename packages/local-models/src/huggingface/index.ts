/**
 * HuggingFace integration — public barrel.
 *
 * Phase 2a exposes the client, cache, and shared types. Phase 2c will add
 * benchmark source adapters that ride on top of this surface.
 */

export { HuggingFaceClient, HuggingFaceClientError } from './client.js';

export { HuggingFaceCache, DEFAULT_CACHE_PATH } from './cache.js';
export type { CacheEntry, CacheFilesystem, HuggingFaceCacheOptions } from './cache.js';

export type {
  HuggingFaceClientOptions,
  HuggingFaceErrorCode,
  HuggingFaceFetcher,
  HuggingFaceFetchResponse,
  HuggingFaceListOptions,
  HuggingFaceModel,
  HuggingFaceModelDetail,
} from './types.js';
