import axios from 'axios';
import { URL } from 'url';
import * as fs from 'fs-extra';
import * as path from 'path';

interface InstagramMediaInfo {
  videoUrl: string;
  fileName: string;
  thumbnailUrl?: string;
  caption?: string;
  username?: string;
}

interface InstagramApiOptions {
  /**
   * Whether to save debug information to a file
   */
  debug?: boolean;
  
  /**
   * Directory to save debug information
   */
  debugDir?: string;
  
  /**
   * Custom user agent to use for requests
   */
  userAgent?: string;
}

/**
 * Class to handle Instagram API requests
 */
export class InstagramAPI {
  private static readonly DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private static readonly MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  
  private static debug: boolean = false;
  private static debugDir: string = './debug';
  private static userAgent: string = InstagramAPI.DEFAULT_USER_AGENT;

  /**
   * Extract the shortcode from an Instagram URL
   * @param url Instagram URL
   * @returns Shortcode
   */
  private static extractShortcode(url: string): string {
    try {
      // Validate that the URL is from Instagram
      if (!url.includes('instagram.com')) {
        throw new Error(`Not an Instagram URL: ${url}`);
      }
      
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      
      // Remove trailing slash if exists
      const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
      
      // Get the segments of the path
      const segments = cleanPath.split('/');
      
      // Handle different Instagram URL formats
      // Format: instagram.com/p/{shortcode}
      // Format: instagram.com/reel/{shortcode}
      // Format: instagram.com/tv/{shortcode}
      if (segments.length >= 3) {
        const pathType = segments[segments.length - 2];
        if (['p', 'reel', 'tv'].includes(pathType)) {
          return segments[segments.length - 1];
        }
      }
      
      // If we can't determine the shortcode from the URL format
      throw new Error(`Could not extract shortcode from URL: ${url}. Please use a direct link to an Instagram post, reel, or TV.`);
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Re-throw if it's already our custom error
      }
      throw new Error(`Invalid Instagram URL: ${url}`);
    }
  }

  /**
   * Configure the Instagram API
   * @param options Configuration options
   */
  public static configure(options: InstagramApiOptions): void {
    if (options.debug !== undefined) {
      this.debug = options.debug;
    }
    
    if (options.debugDir) {
      this.debugDir = options.debugDir;
    }
    
    if (options.userAgent) {
      this.userAgent = options.userAgent;
    }
    
    // Create debug directory if needed
    if (this.debug) {
      fs.ensureDirSync(this.debugDir);
      console.log(`Debug mode enabled. Debug files will be saved to: ${this.debugDir}`);
    }
  }
  
  /**
   * Save debug information to a file
   * @param name Name of the debug file
   * @param content Content to save
   */
  private static saveDebugInfo(name: string, content: any): void {
    if (!this.debug) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}-${name}.json`;
      const filePath = path.join(this.debugDir, fileName);
      
      fs.writeFileSync(
        filePath,
        typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      );
      
      console.log(`Debug info saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save debug info:', error);
    }
  }
  
  /**
   * Get media information from an Instagram reel URL
   * @param url Instagram reel URL
   * @param options Optional configuration options
   * @returns Media information
   */
  public static async getMediaInfo(url: string, options?: InstagramApiOptions): Promise<InstagramMediaInfo> {
    try {
      // Apply options if provided
      if (options) {
        this.configure(options);
      }
      
      const shortcode = this.extractShortcode(url);
      console.log(`Extracted shortcode: ${shortcode}`);
      
      // Try different URL formats to increase chances of success
      const urlFormats = [
        { url: `https://www.instagram.com/p/${shortcode}/`, userAgent: this.DEFAULT_USER_AGENT },
        { url: `https://www.instagram.com/reel/${shortcode}/`, userAgent: this.DEFAULT_USER_AGENT },
        { url: `https://www.instagram.com/p/${shortcode}/`, userAgent: this.MOBILE_USER_AGENT },
        { url: `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`, userAgent: this.MOBILE_USER_AGENT }
      ];
      
      let response;
      let successUrl = '';
      let usedUserAgent = '';
      
      // Try each URL format until one works
      for (const { url: formatUrl, userAgent } of urlFormats) {
        try {
          console.log(`Trying URL format: ${formatUrl} with ${userAgent.substring(0, 20)}...`);
          response = await axios.get(formatUrl, {
            headers: {
              'User-Agent': userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Referer': 'https://www.instagram.com/',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'same-origin',
              'sec-fetch-user': '?1',
              'upgrade-insecure-requests': '1'
            },
            timeout: 15000 // 15 seconds timeout
          });
          successUrl = formatUrl;
          usedUserAgent = userAgent;
          break;
        } catch (err) {
          console.log(`Failed to fetch ${formatUrl}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Continue to the next URL format
        }
      }
      
      if (!response || !successUrl) {
        throw new Error(`Failed to fetch Instagram content for shortcode: ${shortcode}`);
      }
      
      console.log(`Successfully fetched content from: ${successUrl}`);
      
      // Save the raw HTML response for debugging if enabled
      if (this.debug) {
        this.saveDebugInfo(`raw-response-${shortcode}`, response.data);
      }

      // Try different patterns to extract JSON data
      const jsonDataPatterns = [
        // Standard web patterns
        /<script type="application\/json" data-sjs>(.*?)<\/script>/,
        /window\.__additionalDataLoaded\('.*?',(.*?)\);/,
        /<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/,
        // New pattern for 2023-2024
        /window\.__APOLLO_STATE__ = (.*?);<\/script>/,
        /window\.__INITIAL_DATA__ = (.*?);<\/script>/,
        // API response pattern
        /^\{"items":/,
        // Last resort - look for any JSON object with media data
        /\{"graphql":\{"shortcode_media":/
      ];
      
      // Also look for direct video URLs in the HTML content
      const directVideoUrlPatterns = [
        /"video_versions":\[\{"width":\d+,"height":\d+,"url":"(https:\/\/[^"]+)"/,
        /"video_url":"(https:\/\/[^"]+)"/,
        /property="og:video" content="(https:\/\/[^"]+)"/,
        /property="og:video:secure_url" content="(https:\/\/[^"]+)"/,
        /"contentUrl":"(https:\/\/[^"]+\.mp4[^"]*)"/,
        /url":"(https:\/\/[^"]+\.mp4[^"]*)"/,
        /url":\s*"([^"]+\.mp4[^"]*)"/,
        /"url":\s*"([^"]+\.mp4[^"]*)"/
      ];
      
      let jsonData = null;
      let usedPattern = '';
      
      // First try the direct API response if it's a JSON response
      if (successUrl.includes('?__a=1') && response.headers['content-type']?.includes('application/json')) {
        try {
          jsonData = response.data;
          usedPattern = 'direct-api-response';
          console.log('Successfully extracted JSON data from direct API response');
        } catch (err) {
          console.log(`Failed to parse direct API JSON data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      // If we don't have JSON data yet, try the patterns
      if (!jsonData) {
        for (const pattern of jsonDataPatterns) {
          try {
            // For the direct JSON pattern, we check if the response starts with it
            if (pattern.toString().includes('^{"items":')) {
              if (typeof response.data === 'string' && response.data.trim().startsWith('{"items":')) {
                jsonData = JSON.parse(response.data);
                usedPattern = 'direct-json';
                console.log('Successfully extracted JSON data using direct JSON pattern');
                break;
              }
              continue;
            }
            
            const match = typeof response.data === 'string' ? response.data.match(pattern) : null;
            if (match && match[1]) {
              jsonData = JSON.parse(match[1]);
              usedPattern = pattern.toString();
              console.log('Successfully extracted JSON data using pattern:', pattern);
              break;
            }
          } catch (err) {
            console.log(`Failed to parse JSON data with pattern ${pattern}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }
      
      // If we couldn't extract JSON data, try to find direct video URLs in the HTML content
      if (!jsonData) {
        console.log('Could not extract JSON data, trying to find direct video URLs in HTML content...');
        
        if (typeof response.data === 'string') {
          // Try to find direct video URLs in the HTML content
          for (const pattern of directVideoUrlPatterns) {
            const match = response.data.match(pattern);
            if (match && match[1]) {
              // Clean up the URL by removing escape characters
              let videoUrl = match[1]
                .replace(/\\u0025/g, '%')
                .replace(/\\u002F/g, '/')
                .replace(/\\u003A/g, ':')
                .replace(/\\u003F/g, '?')
                .replace(/\\u003D/g, '=')
                .replace(/\\u0026/g, '&')
                .replace(/\\/g, ''); // Remove all remaining backslashes
              
              console.log('Found direct video URL in HTML content:', videoUrl.substring(0, 100) + '...');
              
              // Create a simple JSON structure with the video URL
              jsonData = {
                directVideoUrl: videoUrl,
                shortcode: shortcode
              };
              
              usedPattern = 'direct-video-url-pattern';
              break;
            }
          }
        }
        
        // If we still don't have JSON data or direct video URL, save debug info and throw error
        if (!jsonData) {
          if (this.debug) {
            this.saveDebugInfo(`failed-extraction-${shortcode}`, {
              url: successUrl,
              userAgent: usedUserAgent,
              responseHeaders: response.headers,
              responsePreview: typeof response.data === 'string' ? response.data.substring(0, 1000) : 'Non-string response'
            });
          }
          
          throw new Error('Could not extract JSON data or video URL from Instagram page. Instagram may have changed their page structure.');
        }
      }
      
      // Save the extracted JSON data for debugging if enabled
      if (this.debug) {
        this.saveDebugInfo(`extracted-json-${shortcode}-${usedPattern}`, jsonData);
      }
      
      // Try different JSON structures to find the video URL
      let videoUrl = '';
      let fileName = '';
      let thumbnailUrl = '';
      let caption = '';
      let username = '';
      
      // Check if we have a direct video URL
      if (jsonData.directVideoUrl) {
        videoUrl = jsonData.directVideoUrl;
        fileName = `${shortcode}.mp4`;
        console.log('Using direct video URL from HTML content');
      }
      
      // Structure 1: PostPage format
      if (!videoUrl && jsonData.require) {
        const mediaData = jsonData.require.find((item: any) => 
          item[0] === 'PostPage' || 
          (Array.isArray(item) && item.some((subItem: any) => subItem && subItem.shortcode === shortcode))
        );
        
        if (mediaData) {
          // Format 1.1
          if (mediaData[1] && mediaData[1].graphql && mediaData[1].graphql.shortcode_media) {
            const media = mediaData[1].graphql.shortcode_media;
            if (media.is_video && media.video_url) {
              videoUrl = media.video_url;
              fileName = `${shortcode}.mp4`;
              thumbnailUrl = media.display_url || media.thumbnail_src;
              caption = media.edge_media_to_caption?.edges[0]?.node?.text || '';
              username = media.owner?.username || '';
              console.log('Found video URL in graphql structure');
            }
          }
          // Format 1.2
          else if (mediaData[1] && mediaData[1].items && mediaData[1].items[0]) {
            const media = mediaData[1].items[0];
            if (media.video_versions && media.video_versions.length > 0) {
              videoUrl = media.video_versions[0].url;
              fileName = `${shortcode}.mp4`;
              thumbnailUrl = media.image_versions2?.candidates[0]?.url || '';
              caption = media.caption?.text || '';
              username = media.user?.username || '';
              console.log('Found video URL in items structure');
            }
          }
        }
      }
      
      // Structure 2: SharedData format
      if (!videoUrl && jsonData.entry_data && jsonData.entry_data.PostPage) {
        const media = jsonData.entry_data.PostPage[0]?.graphql?.shortcode_media;
        if (media && media.is_video && media.video_url) {
          videoUrl = media.video_url;
          fileName = `${shortcode}.mp4`;
          thumbnailUrl = media.display_url || media.thumbnail_src;
          caption = media.edge_media_to_caption?.edges[0]?.node?.text || '';
          username = media.owner?.username || '';
          console.log('Found video URL in entry_data structure');
        }
      }
      
      // Structure 3: Direct media format
      if (!videoUrl && jsonData.items && jsonData.items[0]) {
        const media = jsonData.items[0];
        if (media.video_versions && media.video_versions.length > 0) {
          videoUrl = media.video_versions[0].url;
          fileName = `${shortcode}.mp4`;
          thumbnailUrl = media.image_versions2?.candidates[0]?.url || '';
          caption = media.caption?.text || '';
          username = media.user?.username || '';
          console.log('Found video URL in direct items structure');
        }
      }
      
      // Structure 4: Apollo State format (newer Instagram structure)
      if (!videoUrl && jsonData.ROOT_QUERY) {
        // Find the media in the Apollo state
        const mediaKeys = Object.keys(jsonData).filter(key => 
          key.includes(`Media:${shortcode}`) || 
          key.includes(`ShortcodeMedia:${shortcode}`)
        );
        
        if (mediaKeys.length > 0) {
          const media = jsonData[mediaKeys[0]];
          if (media) {
            // Try to find video URL in different possible locations
            if (media.video_url) {
              videoUrl = media.video_url;
              fileName = `${shortcode}.mp4`;
              thumbnailUrl = media.display_url || media.thumbnail_src;
              caption = media.edge_media_to_caption?.edges[0]?.node?.text || '';
              username = media.owner?.username || '';
              console.log('Found video URL in Apollo state structure');
            } else if (media.videoUrl) {
              videoUrl = media.videoUrl;
              fileName = `${shortcode}.mp4`;
              thumbnailUrl = media.displayUrl || media.thumbnailSrc;
              caption = media.caption || '';
              username = media.owner?.username || '';
              console.log('Found video URL in Apollo state structure (camelCase)');
            }
          }
        }
      }
      
      // Structure 5: Direct API response format
      if (!videoUrl && jsonData.graphql && jsonData.graphql.shortcode_media) {
        const media = jsonData.graphql.shortcode_media;
        if (media.is_video && media.video_url) {
          videoUrl = media.video_url;
          fileName = `${shortcode}.mp4`;
          thumbnailUrl = media.display_url || media.thumbnail_src;
          caption = media.edge_media_to_caption?.edges[0]?.node?.text || '';
          username = media.owner?.username || '';
          console.log('Found video URL in direct API response');
        }
      }
      
      // Structure 6: Check for video_versions in the response
      if (!videoUrl && typeof response.data === 'string') {
        // Try different patterns to find the video URL
        const videoPatterns = [
          /"video_versions":\[\{[^\}]*"url":"([^"]+)"/i,
          /"url":"(https:\/\/[^"]+\.mp4[^"]*)"/i,
          /url":"(https:\/\/[^"]+\.mp4[^"]*)"/i,
          /"url":\s*"([^"]+\.mp4[^"]*)"/i,
          /url:\s*"([^"]+\.mp4[^"]*)"/i,
          /"contentUrl":"([^"]+\.mp4[^"]*)"/i
        ];
        
        for (const pattern of videoPatterns) {
          const match = response.data.match(pattern);
          if (match && match[1]) {
            videoUrl = match[1].replace(/\\u0025/g, '%')
                               .replace(/\\u002F/g, '/')
                               .replace(/\\u003A/g, ':')
                               .replace(/\\u003F/g, '?')
                               .replace(/\\u003D/g, '=')
                               .replace(/\\u0026/g, '&');
            fileName = `${shortcode}.mp4`;
            console.log(`Found video URL with pattern: ${pattern}`);
            break;
          }
        }
        
        // If still no video URL, try to extract from the PolarisPostRootQueryRelayPreloader
        if (!videoUrl) {
          const preloaderMatch = response.data.match(/PolarisPostRootQueryRelayPreloader_[^"]+",(\{"__bbox":\{"complete":true,"result":\{"data":\{"xdt_api__v1__media__shortcode__web_info":\{"items":\[\{[^\}]+\}\]\}\}\}\}\})/);
          if (preloaderMatch && preloaderMatch[1]) {
            try {
              const preloaderData = JSON.parse(preloaderMatch[1]);
              const items = preloaderData?.__bbox?.result?.data?.xdt_api__v1__media__shortcode__web_info?.items;
              
              if (items && items.length > 0 && items[0].video_versions && items[0].video_versions.length > 0) {
                videoUrl = items[0].video_versions[0].url;
                fileName = `${shortcode}.mp4`;
                console.log('Found video URL in PolarisPostRootQueryRelayPreloader');
              }
            } catch (err) {
              console.log(`Failed to parse PolarisPostRootQueryRelayPreloader data: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        }
      }

      if (!videoUrl) {
        if (this.debug) {
          this.saveDebugInfo(`no-video-url-${shortcode}`, jsonData);
        }
        
        throw new Error(
          'Could not find video URL in Instagram response. ' +
          'This could be due to: ' +
          '1. The post is not a video/reel ' +
          '2. The post is private ' +
          '3. Instagram has changed their API structure ' +
          'Please ensure you are using a public video/reel URL.'
        );
      }

      return {
        videoUrl,
        fileName,
        thumbnailUrl,
        caption,
        username
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get media info: ${error.message}`);
      }
      throw new Error('Failed to get media info: Unknown error');
    }
  }
}

export { InstagramMediaInfo };
