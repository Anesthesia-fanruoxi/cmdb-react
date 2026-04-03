/**
 * 下载工具函数
 * 支持进度监控的文件下载
 */

export interface DownloadProgress {
  loaded: number;      // 已下载字节数
  total: number;       // 总字节数
  percentage: number;  // 下载百分比 (0-100)
  speed: number;       // 下载速度 (字节/秒)
}

export interface DownloadResult {
  filePath: string;    // 保存的文件路径
  filename: string;    // 文件名
}

export interface DownloadOptions {
  url: string;
  filename?: string;
  onProgress?: (progress: DownloadProgress) => void;
  onSuccess?: (result: DownloadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化下载速度
 */
export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * 从 URL 或响应头中提取文件名
 */
function extractFilename(url: string, contentDisposition?: string | null): string {
  // 尝试从 Content-Disposition 头中提取
  if (contentDisposition) {
    // 处理标准格式: filename="xxx" 或 filename=xxx
    let filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      let filename = filenameMatch[1].replace(/['"]/g, '').trim();
      
      // 处理 UTF-8 编码的文件名: filename*=UTF-8''xxx
      if (filename.includes('UTF-8')) {
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
        if (utf8Match && utf8Match[1]) {
          try {
            filename = decodeURIComponent(utf8Match[1]);
          } catch (e) {
            console.error('解码文件名失败:', e);
          }
        }
      }
      
      // 如果成功提取到文件名，返回
      if (filename && filename !== 'UTF-8') {
        return filename;
      }
    }
  }
  
  // 从 URL 中提取，尝试解码
  try {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const filenameWithQuery = lastPart.split('?')[0];
    
    // 尝试 URL 解码
    const decoded = decodeURIComponent(filenameWithQuery);
    
    // 如果解码后的文件名有效且包含扩展名，使用它
    if (decoded && (decoded.includes('.xlsx') || decoded.includes('.xls') || decoded.includes('.csv'))) {
      return decoded;
    }
    
    // 否则返回原始文件名
    if (filenameWithQuery) {
      return filenameWithQuery;
    }
  } catch (e) {
    console.error('从 URL 提取文件名失败:', e);
  }
  
  // 如果都失败了，生成默认文件名
  return `download_${Date.now()}.xlsx`;
}

/**
 * 使用 fetch 下载文件，支持进度监控
 */
export async function downloadWithProgress(options: DownloadOptions): Promise<void> {
  const { url, filename, onProgress, onSuccess, onError } = options;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (!response.body) {
      throw new Error('响应体为空');
    }
    
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let startTime = Date.now();
    let lastTime = startTime;
    let lastLoaded = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      // 计算下载速度
      const currentTime = Date.now();
      const timeDiff = (currentTime - lastTime) / 1000; // 转换为秒
      const loadedDiff = loaded - lastLoaded;
      const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
      
      // 更新进度
      if (onProgress) {
        onProgress({
          loaded,
          total,
          percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
          speed,
        });
      }
      
      lastTime = currentTime;
      lastLoaded = loaded;
    }
    
    // 合并所有数据块
    const blob = new Blob(chunks as BlobPart[]);
    
    // 提取文件名
    const contentDisposition = response.headers.get('content-disposition');
    let finalFilename = filename || extractFilename(url, contentDisposition);
    
    // 如果文件名包含路径，只保留文件名部分
    if (finalFilename.includes('/')) {
      const parts = finalFilename.split('/');
      finalFilename = parts[parts.length - 1];
    }
    if (finalFilename.includes('\\')) {
      const parts = finalFilename.split('\\');
      finalFilename = parts[parts.length - 1];
    }
    
    // 创建下载链接
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 释放 blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    
    // 返回文件信息
    onSuccess?.({ 
      filePath: finalFilename,  // 浏览器下载无法获取完整路径，只返回文件名
      filename: finalFilename 
    });
  } catch (error) {
    console.error('下载失败:', error);
    onError?.(error as Error);
  }
}

/**
 * 简单下载（无进度监控）
 */
export function simpleDownload(url: string, filename?: string): void {
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.download = filename;
  }
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
