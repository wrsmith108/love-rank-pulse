import {
  ApiResponse as BaseApiResponse,
  PaginatedApiResponse as BasePaginatedApiResponse,
  PaginationMeta
} from '../../types/api';

/**
 * Extended API Response interface with additional error properties
 */
export interface ApiResponse<T> extends BaseApiResponse<T> {
  errorCode?: string;
  details?: any;
}

/**
 * Extended Paginated API Response interface
 */
export interface PaginatedApiResponse<T> extends BasePaginatedApiResponse<T> {
  errorCode?: string;
  details?: any;
}

export type { PaginationMeta };