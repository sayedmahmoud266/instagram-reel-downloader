import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { InstagramAPI, InstagramMediaInfo } from './instagram-api';

/**
 * Options for the downloader
 */
export interface DownloaderOptions {
  /**
   * Directory to save downloaded files
   */
  outputDir?: string;
  
  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
  
  /**
   * Directory to save debug information
   */
  debugDir?: string;
}

/**
 * Class to handle downloading Instagram reels
 */
export class Downloader {
  private outputDir: string;
  private debug: boolean;
  private debugDir: string;

  /**
   * Constructor
   * @param options Downloader options or output directory string
   */
  constructor(options: string | DownloaderOptions = './downloads') {
    if (typeof options === 'string') {
      this.outputDir = options;
      this.debug = false;
      this.debugDir = './debug';
    } else {
      this.outputDir = options.outputDir || './downloads';
      this.debug = options.debug || false;
      this.debugDir = options.debugDir || './debug';
      
      // Configure the Instagram API
      InstagramAPI.configure({
        debug: this.debug,
        debugDir: this.debugDir
      });
    }
  }

  /**
   * Generate a unique filename to avoid overwriting existing files
   * @param basePath Base path for the file
   * @param fileName Original filename
   * @returns Unique filename that doesn't exist yet
   */
  private async generateUniqueFilename(basePath: string, fileName: string): Promise<string> {
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    let filePath = path.join(basePath, fileName);
    let counter = 1;
    
    // Check if file exists and generate a new name if it does
    while (await fs.pathExists(filePath)) {
      const newFileName = `${name}_${counter}${ext}`;
      filePath = path.join(basePath, newFileName);
      counter++;
    }
    
    return path.basename(filePath);
  }
  
  /**
   * Download a file from a URL with progress tracking
   * @param url URL to download from
   * @param fileName Name to save the file as
   * @param silent Whether to suppress progress output
   * @returns Path to the downloaded file
   */
  private async downloadFile(url: string, fileName: string, silent: boolean = false): Promise<string> {
    try {
      // Create output directory if it doesn't exist
      await fs.ensureDir(this.outputDir);
      
      // Generate a unique filename to avoid overwriting existing files
      const uniqueFileName = await this.generateUniqueFilename(this.outputDir, fileName);
      const filePath = path.join(this.outputDir, uniqueFileName);
      
      // If the filename was changed, log it
      if (uniqueFileName !== fileName && !silent) {
        console.log(`File already exists. Using unique filename: ${uniqueFileName}`);
      }
      
      // Download the file
      console.log(`Downloading from: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'video',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
      }
      
      // Get content length for progress tracking
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      let downloadedBytes = 0;
      let lastLoggedPercent = 0;
      
      // Create a write stream to save the file
      const fileStream = fs.createWriteStream(filePath);
      
      await new Promise<void>((resolve, reject) => {
        if (!response.body) {
          reject(new Error('No response body'));
          return;
        }
        
        // Track download progress
        if (contentLength > 0) {
          response.body.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            const percent = Math.round((downloadedBytes / contentLength) * 100);
            
            // Log progress at 10% intervals to avoid console spam
            if (percent >= lastLoggedPercent + 10 || percent === 100) {
              console.log(`Download progress: ${percent}% (${downloadedBytes} / ${contentLength} bytes)`);
              lastLoggedPercent = Math.floor(percent / 10) * 10; // Round to nearest 10%
            }
          });
        } else {
          console.log('Content length not available, download progress cannot be tracked');
        }
        
        response.body.pipe(fileStream);
        
        fileStream.on('finish', () => {
          console.log(`Download completed: ${fileName}`);
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(err);
        });
        
        // Handle potential timeouts or connection issues
        response.body.on('error', (err) => {
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(new Error(`Connection error during download: ${err.message}`));
        });
      });
      
      // Verify the downloaded file exists and has content
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        await fs.unlink(filePath); // Remove empty file
        throw new Error('Downloaded file is empty');
      }
      
      return filePath;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to download file: ${error.message}`);
      }
      throw new Error('Failed to download file: Unknown error');
    }
  }

  /**
   * Download a reel from an Instagram URL
   * @param url Instagram reel URL
   * @returns Path to the downloaded file
   */
  public async downloadReel(url: string): Promise<string> {
    try {
      console.log(`Fetching information for: ${url}`);
      
      // Get media information with debug mode if enabled
      const mediaInfo = await InstagramAPI.getMediaInfo(url, {
        debug: this.debug,
        debugDir: this.debugDir
      });
      
      console.log(`Downloading reel: ${mediaInfo.fileName}`);
      
      // Log additional information if available
      if (mediaInfo.username) {
        console.log(`Creator: ${mediaInfo.username}`);
      }
      
      if (mediaInfo.caption) {
        const shortCaption = mediaInfo.caption.length > 50 
          ? mediaInfo.caption.substring(0, 50) + '...' 
          : mediaInfo.caption;
        console.log(`Caption: ${shortCaption}`);
      }
      
      // Download the file
      const filePath = await this.downloadFile(mediaInfo.videoUrl, mediaInfo.fileName);
      
      // Download thumbnail if available
      if (mediaInfo.thumbnailUrl) {
        try {
          const thumbnailFileName = mediaInfo.fileName.replace('.mp4', '.jpg');
          const thumbnailPath = await this.downloadFile(
            mediaInfo.thumbnailUrl, 
            thumbnailFileName,
            true // Silent mode for thumbnail
          );
          console.log(`Thumbnail saved to: ${thumbnailPath}`);
        } catch (err) {
          // Just log the error but don't fail the whole process
          console.log(`Failed to download thumbnail: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      console.log(`Successfully downloaded to: ${filePath}`);
      
      return filePath;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to download reel: ${error.message}`);
      }
      throw new Error('Failed to download reel: Unknown error');
    }
  }

  /**
   * Download multiple reels from Instagram URLs
   * @param urls Array of Instagram reel URLs
   * @returns Array of paths to the downloaded files
   */
  public async downloadReels(urls: string[]): Promise<string[]> {
    const results: string[] = [];
    const errors: { url: string, error: string }[] = [];
    
    for (const url of urls) {
      try {
        const filePath = await this.downloadReel(url);
        results.push(filePath);
      } catch (error) {
        if (error instanceof Error) {
          errors.push({ url, error: error.message });
        } else {
          errors.push({ url, error: 'Unknown error' });
        }
      }
    }
    
    // Log any errors
    if (errors.length > 0) {
      console.error('Errors occurred while downloading reels:');
      errors.forEach(({ url, error }) => {
        console.error(`- ${url}: ${error}`);
      });
    }
    
    return results;
  }
}
