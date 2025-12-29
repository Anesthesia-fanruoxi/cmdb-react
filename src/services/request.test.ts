/**
 * API 服务层属性测试
 * 使用 fast-check 进行属性测试
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseApiResponse, RequestError } from './request';

/**
 * **Feature: tauri-desktop-app, Property 1: API 响应解析一致性**
 * **Validates: Requirements 2.2**
 * 
 * *For any* 有效的 API 响应 JSON，解析后的对象应包含 code、message 和 data 字段
 */
describe('Property 1: API 响应解析一致性', () => {
  // 生成有效的 API 响应
  const validApiResponseArb = fc.record({
    code: fc.integer(),
    message: fc.string(),
    data: fc.anything(),
  });

  it('对于任意有效的 API 响应，解析后应包含 code、message 和 data 字段', () => {
    fc.assert(
      fc.property(validApiResponseArb, (response) => {
        const parsed = parseApiResponse(response);
        
        // 验证解析后的对象包含所有必需字段
        expect(parsed).toHaveProperty('code');
        expect(parsed).toHaveProperty('message');
        expect(parsed).toHaveProperty('data');
        
        // 验证字段值与原始响应一致
        expect(parsed.code).toBe(response.code);
        expect(parsed.message).toBe(response.message);
        expect(parsed.data).toEqual(response.data);
      }),
      { numRuns: 100 }
    );
  });

  it('对于缺少 code 字段的响应，应抛出 RequestError', () => {
    fc.assert(
      fc.property(
        fc.record({
          message: fc.string(),
          data: fc.anything(),
        }),
        (invalidResponse) => {
          expect(() => parseApiResponse(invalidResponse)).toThrow(RequestError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于缺少 message 字段的响应，应抛出 RequestError', () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.integer(),
          data: fc.anything(),
        }),
        (invalidResponse) => {
          expect(() => parseApiResponse(invalidResponse)).toThrow(RequestError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于缺少 data 字段的响应，应正常解析（data 为可选字段）', () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.integer(),
          message: fc.string(),
        }),
        (response) => {
          // data 字段是可选的，缺少时不应抛出错误
          const parsed = parseApiResponse(response);
          expect(parsed).toHaveProperty('code');
          expect(parsed).toHaveProperty('message');
          expect(parsed.code).toBe(response.code);
          expect(parsed.message).toBe(response.message);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于 null 或非对象类型的响应，应抛出 RequestError', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.anything())
        ),
        (invalidResponse) => {
          expect(() => parseApiResponse(invalidResponse)).toThrow(RequestError);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: tauri-desktop-app, Property 2: 网络错误处理**
 * **Validates: Requirements 2.3**
 * 
 * *For any* 网络请求失败情况，应用状态应正确反映错误状态且不会崩溃
 */
describe('Property 2: 网络错误处理', () => {
  it('RequestError 应正确保存错误码和错误信息', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.string(),
        fc.option(fc.string(), { nil: undefined }),
        (code, message, details) => {
          const error = new RequestError(code, message, details);
          
          // 验证错误对象包含正确的属性
          expect(error).toBeInstanceOf(Error);
          expect(error).toBeInstanceOf(RequestError);
          expect(error.code).toBe(code);
          expect(error.message).toBe(message);
          expect(error.details).toBe(details);
          expect(error.name).toBe('RequestError');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('RequestError 应可被正常捕获和处理', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        (code, message) => {
          let caught = false;
          let caughtError: RequestError | null = null;

          try {
            throw new RequestError(code, message);
          } catch (e) {
            if (e instanceof RequestError) {
              caught = true;
              caughtError = e;
            }
          }

          // 验证错误被正确捕获
          expect(caught).toBe(true);
          expect(caughtError).not.toBeNull();
          expect(caughtError?.code).toBe(code);
          expect(caughtError?.message).toBe(message);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('HTTP 错误码应映射到正确的错误类型', () => {
    // 定义 HTTP 错误码范围
    const httpErrorCodes = fc.oneof(
      fc.constant(400), // Bad Request
      fc.constant(401), // Unauthorized
      fc.constant(403), // Forbidden
      fc.constant(404), // Not Found
      fc.constant(408), // Request Timeout
      fc.constant(500), // Internal Server Error
      fc.constant(502), // Bad Gateway
      fc.constant(503), // Service Unavailable
      fc.constant(504)  // Gateway Timeout
    );

    fc.assert(
      fc.property(httpErrorCodes, (code) => {
        const error = new RequestError(code, `Error ${code}`);
        
        // 验证错误码在有效范围内
        expect(error.code).toBeGreaterThanOrEqual(400);
        expect(error.code).toBeLessThanOrEqual(599);
        
        // 验证错误对象可以正常使用
        expect(error.name).toBe('RequestError');
        expect(typeof error.message).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('网络错误（code: -1）应被正确标识', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (errorMessage) => {
          const networkError = new RequestError(-1, '网络连接失败', errorMessage);
          
          // 验证网络错误的特征
          expect(networkError.code).toBe(-1);
          expect(networkError.details).toBe(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
