import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
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
  
  /**
   * Whether to save reel metadata as JSON file
   */
  saveMetadata?: boolean;
  
  /**
   * Whether to enable verbose logging
   */
  verbose?: boolean;
  
  /**
   * Whether to skip existing files
   */
  skipExisting?: boolean;
}

/**
 * Class to handle downloading Instagram reels
 */
export class Downloader {
  private outputDir: string;
  private debug: boolean;
  private debugDir: string;
  private saveMetadata: boolean;
  private verbose: boolean;
  private skipExisting: boolean;

  /**
   * Constructor
   * @param options Downloader options or output directory string
   */
  constructor(options: string | DownloaderOptions = './downloads') {
    if (typeof options === 'string') {
      this.outputDir = options;
      this.debug = false;
      this.debugDir = './debug';
      this.saveMetadata = false;
      this.verbose = false;
      this.skipExisting = false;
    } else {
      this.outputDir = options.outputDir || './downloads';
      this.debug = options.debug || false;
      this.debugDir = options.debugDir || './debug';
      this.saveMetadata = options.saveMetadata || false;
      this.verbose = options.verbose || false;
      this.skipExisting = options.skipExisting || false;
      
      // Configure the Instagram API
      InstagramAPI.configure({
        debug: this.debug,
        debugDir: this.debugDir
      });
    }
  }

  /**
   * Save metadata as JSON file
   * @param mediaInfo Media information from Instagram API
   * @param videoFilePath Path to the downloaded video file
   */
  private async saveMetadataFile(mediaInfo: InstagramMediaInfo, videoFilePath: string): Promise<void> {
    if (!this.saveMetadata) {
      return;
    }

    try {
      // Generate metadata file path (same name as video but with .json extension)
      const videoFileName = path.basename(videoFilePath, path.extname(videoFilePath));
      const metadataFileName = `${videoFileName}.json`;
      const metadataFilePath = path.join(this.outputDir, metadataFileName);

      // Create metadata object
      const metadata = {
        originalUrl: mediaInfo.originalUrl,
        owner: mediaInfo.username,
        likes: mediaInfo.likes || 0,
        comments: mediaInfo.comments || 0,
        views: mediaInfo.views || 0,
        caption: mediaInfo.caption || '',
        downloadedAt: new Date().toISOString(),
        videoFileName: path.basename(videoFilePath),
        thumbnailUrl: mediaInfo.thumbnailUrl || ''
      };

      // Save metadata to JSON file
      await fs.writeJson(metadataFilePath, metadata, { spaces: 2 });
      if (this.verbose) {
        console.log(`${chalk.gray('📄 Metadata saved to:')} ${metadataFilePath}`);
      }
    } catch (error) {
      console.error(`⚠️  Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Check if files already exist for a given base name
   * @param baseName Base name without extension
   * @returns Object indicating which files exist
   */
  private async checkExistingFiles(baseName: string): Promise<{ video: boolean; metadata: boolean; thumbnail: boolean }> {
    const videoPath = path.join(this.outputDir, `${baseName}.mp4`);
    const metadataPath = path.join(this.outputDir, `${baseName}.json`);
    const thumbnailPath = path.join(this.outputDir, `${baseName}.jpg`);
    
    return {
      video: await fs.pathExists(videoPath),
      metadata: await fs.pathExists(metadataPath),
      thumbnail: await fs.pathExists(thumbnailPath)
    };
  }

  /**
   * Download a file from a URL with progress tracking
   * @param url URL to download from
   * @param fileName Name to save the file as
   * @param silent Whether to suppress progress output
   * @param progressBar Optional progress bar instance
   * @returns Path to the downloaded file
   */
  private async downloadFile(url: string, fileName: string, silent: boolean = false, progressBar?: cliProgress.SingleBar): Promise<string> {
    try {
      // Create output directory if it doesn't exist
      await fs.ensureDir(this.outputDir);
      
      // Generate a unique filename to avoid overwriting existing files
      const uniqueFileName = await this.generateUniqueFilename(this.outputDir, fileName);
      const filePath = path.join(this.outputDir, uniqueFileName);
      
      // If the filename was changed, log it
      if (uniqueFileName !== fileName && !silent && this.verbose) {
        console.log(`File already exists. Using unique filename: ${uniqueFileName}`);
      }
      
      // Download the file
      if (this.verbose) {
        console.log(`Downloading from: ${url}`);
      }
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
      
      // Create progress bar if not silent and no external progress bar provided
      let fileProgressBar: cliProgress.SingleBar | undefined;
      if (!silent && !progressBar && contentLength > 0) {
        fileProgressBar = new cliProgress.SingleBar({
          format: `${chalk.cyan('Downloading')} ${chalk.yellow(fileName)} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} bytes`,
          barCompleteChar: '█',
          barIncompleteChar: '░',
          hideCursor: true
        });
        fileProgressBar.start(contentLength, 0);
      }
      
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
            
            // Update progress bars
            if (fileProgressBar) {
              fileProgressBar.update(downloadedBytes);
            }
            if (progressBar) {
              progressBar.increment(chunk.length);
            }
          });
        } else if (this.verbose) {
          console.log('Content length not available, download progress cannot be tracked');
        }
        
        response.body.pipe(fileStream);
        
        fileStream.on('finish', () => {
          if (fileProgressBar) {
            fileProgressBar.stop();
          }
          if (!silent && this.verbose) {
            console.log(`✅ Download completed: ${fileName}`);
          }
          resolve();
        });
        
        fileStream.on('error', (err) => {
          if (fileProgressBar) {
            fileProgressBar.stop();
          }
          fs.unlink(filePath).catch(() => {}); // Clean up partial file
          reject(err);
        });
        
        // Handle potential timeouts or connection issues
        response.body.on('error', (err) => {
          if (fileProgressBar) {
            fileProgressBar.stop();
          }
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
   * @param globalProgressBar Optional global progress bar for batch operations
   * @returns Path to the downloaded file
   */
  public async downloadReel(url: string, globalProgressBar?: cliProgress.SingleBar): Promise<string> {
    try {
      if (this.verbose) {
        console.log(`Fetching information for: ${url}`);
      }
      
      // Get media information with debug mode if enabled
      const mediaInfo = await InstagramAPI.getMediaInfo(url, {
        debug: this.debug,
        debugDir: this.debugDir
      });
      
      const baseName = path.basename(mediaInfo.fileName, '.mp4');
      
      // Check if files already exist when skip existing is enabled
      if (this.skipExisting) {
        const existingFiles = await this.checkExistingFiles(baseName);
        
        // If both video and metadata exist (when metadata is enabled), skip
        const shouldSkip = existingFiles.video && (!this.saveMetadata || existingFiles.metadata);
        
        if (shouldSkip) {
          console.log(`${chalk.yellow('⏭️  Skipping')} ${baseName} - files already exist`);
          return path.join(this.outputDir, mediaInfo.fileName);
        }
      }
      
      console.log(`${chalk.green('📥 Downloading')} ${chalk.bold(baseName)}`);
      
      // Log additional information if available and verbose mode is on
      if (this.verbose) {
        if (mediaInfo.username) {
          console.log(`Creator: ${mediaInfo.username}`);
        }
        
        if (mediaInfo.caption) {
          const shortCaption = mediaInfo.caption.length > 50 
            ? mediaInfo.caption.substring(0, 50) + '...' 
            : mediaInfo.caption;
          console.log(`Caption: ${shortCaption}`);
        }
      }
      
      // Download the file
      const filePath = await this.downloadFile(mediaInfo.videoUrl, mediaInfo.fileName, false, globalProgressBar);
      
      // Download thumbnail if available
      if (mediaInfo.thumbnailUrl) {
        try {
          const thumbnailFileName = mediaInfo.fileName.replace('.mp4', '.jpg');
          const thumbnailPath = await this.downloadFile(
            mediaInfo.thumbnailUrl, 
            thumbnailFileName,
            true // Silent mode for thumbnail
          );
          if (this.verbose) {
            console.log(`Thumbnail saved to: ${thumbnailPath}`);
          }
        } catch (err) {
          // Just log the error but don't fail the whole process
          if (this.verbose) {
            console.log(`Failed to download thumbnail: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }
      
      // Save metadata if enabled
      await this.saveMetadataFile(mediaInfo, filePath);
      
      console.log(`${chalk.green('✅ Successfully downloaded')} ${chalk.bold(baseName)}`);
      
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
    
    // Create global progress bar for batch operations
    const globalProgressBar = new cliProgress.SingleBar({
      format: `${chalk.magenta('Batch Progress')} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} reels`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });
    
    globalProgressBar.start(urls.length, 0);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        console.log(`\n${chalk.blue(`[${i + 1}/${urls.length}]`)} Processing reel...`);
        const filePath = await this.downloadReel(url);
        results.push(filePath);
        globalProgressBar.update(i + 1);
      } catch (error) {
        globalProgressBar.update(i + 1);
        if (error instanceof Error) {
          errors.push({ url, error: error.message });
          console.error(`${chalk.red('❌ Error:')} ${error.message}`);
        } else {
          errors.push({ url, error: 'Unknown error' });
          console.error(`${chalk.red('❌ Error:')} Unknown error`);
        }
      }
    }
    
    globalProgressBar.stop();
    
    // Summary
    console.log(`\n${chalk.green('📊 Batch Download Summary:')}`);
    console.log(`${chalk.green('✅ Successful:')} ${results.length}`);
    console.log(`${chalk.red('❌ Failed:')} ${errors.length}`);
    
    // Log any errors
    if (errors.length > 0) {
      console.log(`\n${chalk.red('❌ Errors occurred:')}`);
      errors.forEach(({ url, error }) => {
        const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
        console.error(`${chalk.red('•')} ${shortUrl}: ${error}`);
      });
    }
    
    return results;
  }

  /**
   * Download reels from a file containing URLs
   * @param filePath Path to file containing URLs
   * @returns Array of paths to the downloaded files
   */
  public async downloadReelsFromFile(filePath: string): Promise<string[]> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const urls = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Filter empty lines and comments
        .filter(line => line.includes('instagram.com')); // Basic Instagram URL validation
      
      if (urls.length === 0) {
        throw new Error('No valid Instagram URLs found in the file');
      }
      
      console.log(`${chalk.blue('📂 Found')} ${urls.length} URLs in file`);
      
      return await this.downloadReels(urls);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read URLs from file: ${error.message}`);
      }
      throw new Error('Failed to read URLs from file: Unknown error');
    }
  }
}
