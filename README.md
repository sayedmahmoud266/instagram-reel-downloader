# Instagram Reel Downloader

A simple Node.js application built with TypeScript that allows you to download Instagram reels from URLs. The application is designed to be resilient to Instagram API changes and provides helpful debugging tools.

## Disclaimer

This is an open-source project provided for **personal use only**. It is not intended for commercial use or profit. Please respect Instagram's terms of service and only download content that you have the right to access. The developers of this tool are not responsible for any misuse or violation of Instagram's terms of service.

## Features

- Download a single Instagram reel
- Download multiple Instagram reels at once
- Download reels from a file containing URLs (one per line)
- Customizable output directory
- Debug mode for troubleshooting Instagram API changes
- Automatic thumbnail extraction
- Resilient to Instagram API changes
- Detailed error messages with troubleshooting tips
- Automatic handling of duplicate filenames
- Progress tracking during downloads
- Batch download with continue-on-error option
- Metadata extraction and saving as JSON files

## Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

## Installation

### Global Installation (Recommended)

Install globally via npm to use the CLI from anywhere:

```bash
npm install -g instagram-reel-downloader
```

After installation, you can use any of these commands:
- `instareels` (recommended - short and easy)
- `instagram-reel-downloader` 
- `insta-dl`

### Local Development Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/sayedmahmoud266/instagram-reel-downloader.git
   cd instagram-reel-downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

## Usage

### Command Line Interface

#### Download a single reel:

**Global installation:**
```bash
instareels download <instagram-reel-url> [options]
```

**Local development:**
```bash
npm start -- download <instagram-reel-url> [options]
```

Examples:
```bash
# Using global installation (recommended)
instareels download https://www.instagram.com/reel/ABC123xyz/ --output ./my-reels

# With metadata extraction
instareels download https://www.instagram.com/reel/ABC123xyz/ --save-metadata

# With debug mode
instareels download https://www.instagram.com/reel/ABC123xyz/ --debug --debug-dir ./debug-logs

# Local development
npm start -- download https://www.instagram.com/reel/ABC123xyz/ --output ./my-reels
```

#### Download multiple reels:

**Global installation:**
```bash
instareels batch <instagram-reel-url1> <instagram-reel-url2> ... [options]
```

**Local development:**
```bash
npm start -- batch <instagram-reel-url1> <instagram-reel-url2> ... [options]
```

Examples:
```bash
# Using global installation
instareels batch https://www.instagram.com/reel/ABC123xyz/ https://www.instagram.com/reel/DEF456uvw/ --output ./my-reels

# With continue-on-error option
instareels batch https://www.instagram.com/reel/ABC123xyz/ https://www.instagram.com/reel/DEF456uvw/ --continue-on-error

# With metadata extraction
instareels batch https://www.instagram.com/reel/ABC123xyz/ https://www.instagram.com/reel/DEF456uvw/ --save-metadata

# Local development
npm start -- batch https://www.instagram.com/reel/ABC123xyz/ https://www.instagram.com/reel/DEF456uvw/ --output ./my-reels
```

#### Download reels from a file:

**Global installation:**
```bash
instareels from-file <path-to-file> [options]
```

**Local development:**
```bash
npm start -- from-file <path-to-file> [options]
```

Examples:
```bash
# Using global installation
instareels from-file urls.txt --output ./my-reels

# With metadata extraction
instareels from-file urls.txt --save-metadata

# With continue-on-error option
instareels from-file urls.txt --continue-on-error

# Local development
npm start -- from-file urls.txt --output ./my-reels
```

The tool supports multiple file formats:

- **Text files (.txt)**: One URL per line
  ```
  https://www.instagram.com/reel/ABC123xyz/
  https://www.instagram.com/p/DEF456uvw/
  ```

- **CSV files (.csv)**: URLs can be in any column
  ```
  1,https://www.instagram.com/reel/ABC123xyz/,Example Reel
  2,https://www.instagram.com/p/DEF456uvw/,Another Reel
  ```

- **JSON files (.json)**: Several formats supported
  ```json
  // Simple array of URLs
  [
    "https://www.instagram.com/reel/ABC123xyz/",
    "https://www.instagram.com/p/DEF456uvw/"
  ]
  
  // Or object with URL properties
  {
    "reel1": "https://www.instagram.com/reel/ABC123xyz/",
    "reel2": "https://www.instagram.com/p/DEF456uvw/"
  }
  
  // Or object with URL array
  {
    "reels": [
      "https://www.instagram.com/reel/ABC123xyz/",
      "https://www.instagram.com/p/DEF456uvw/"
    ]
  }
  ```

The tool automatically detects the file format based on the file extension.

### Metadata Extraction

Use the `--save-metadata` flag to save reel information as JSON files alongside the downloaded videos:

**Global installation:**
```bash
instareels download https://www.instagram.com/reel/ABC123xyz/ --save-metadata
```

**Local development:**
```bash
npm start -- download https://www.instagram.com/reel/ABC123xyz/ --save-metadata
```

The metadata JSON file will have the same name as the video file but with a `.json` extension. For example, if the video is saved as `ABC123xyz.mp4`, the metadata will be saved as `ABC123xyz.json`.

The metadata file includes:
- **originalUrl**: The original Instagram URL
- **owner**: Username of the account that posted the reel
- **likes**: Number of likes (if available)
- **comments**: Number of comments (if available)
- **views**: Number of views (if available)
- **caption**: Reel description/caption
- **downloadedAt**: Timestamp when the reel was downloaded
- **videoFileName**: Name of the downloaded video file
- **thumbnailUrl**: URL of the reel thumbnail (if available)

Example metadata JSON:
```json
{
  "originalUrl": "https://www.instagram.com/reel/ABC123xyz/",
  "owner": "username",
  "likes": 1234,
  "comments": 56,
  "views": 12345,
  "caption": "Check out this amazing reel!",
  "downloadedAt": "2025-01-15T10:30:00.000Z",
  "videoFileName": "ABC123xyz.mp4",
  "thumbnailUrl": "https://instagram.com/..."
}
```

### Command Options

| Option | Description |
|--------|-------------|
| `-o, --output <directory>` | Directory to save downloaded files (default: `./downloads`) |
| `-q, --quiet` | Suppress progress output |
| `-c, --continue-on-error` | Continue downloading if one URL fails (batch and from-file only) |
| `-d, --debug` | Enable debug mode for troubleshooting |
| `--debug-dir <directory>` | Directory to save debug information (default: `./debug`) |
| `-m, --save-metadata` | Save reel metadata as JSON file alongside the video |

### Using as a Library

You can also use this package as a library in your own projects:

```typescript
import { Downloader } from './dist/downloader';

async function downloadReels() {
  const downloader = new Downloader('./downloads');
  
  // Download a single reel
  const filePath = await downloader.downloadReel('https://www.instagram.com/reel/ABC123xyz/');
  console.log(`Downloaded to: ${filePath}`);
  
  // Download multiple reels
  const urls = [
    'https://www.instagram.com/reel/ABC123xyz/',
    'https://www.instagram.com/reel/DEF456uvw/'
  ];
  const filePaths = await downloader.downloadReels(urls);
  console.log(`Downloaded ${filePaths.length} reels`);
}

downloadReels().catch(console.error);
```

## Limitations

- This tool relies on Instagram's web interface, which may change over time. If Instagram updates their website structure, this tool may need to be updated.
- Instagram may rate-limit or block requests if too many are made in a short period of time.
- This tool is intended for personal use only. Please respect Instagram's terms of service.

## Troubleshooting

If you encounter issues downloading reels, try the following:

1. **Enable debug mode**: Use the `--debug` flag to save detailed information about the Instagram API response.
   ```bash
   # Global installation
   instareels download <url> --debug
   
   # Local development
   npm start -- download <url> --debug
   ```

2. **Check if the reel is private**: This tool can only download public reels.

3. **Try different URL formats**: Sometimes using a different URL format can help:
   - `https://www.instagram.com/p/CODE/`
   - `https://www.instagram.com/reel/CODE/`
   - `https://www.instagram.com/tv/CODE/`

4. **Rate limiting**: If you're getting errors about failed requests, Instagram might be rate-limiting your IP address. Wait a while before trying again.

5. **Check debug logs**: If you used the `--debug` flag, check the debug directory for JSON files containing the Instagram API responses. These can help identify why the download failed.

6. **403 Forbidden errors**: If you're getting 403 Forbidden errors, it might be because Instagram is blocking your requests. Try using a different IP address or wait a while before trying again.

7. **Continue on error**: When downloading multiple reels, use the `--continue-on-error` flag to continue downloading even if some reels fail.
   ```bash
   # Global installation
   instareels batch <url1> <url2> --continue-on-error
   
   # Local development
   npm start -- batch <url1> <url2> --continue-on-error
   ```

## Handling Instagram API Changes

Instagram frequently changes their API and website structure to prevent scraping. This tool is designed to be resilient to these changes by:

1. **Multiple extraction methods**: The tool tries multiple methods to extract the video URL from Instagram's response.

2. **Debug mode**: When enabled, the tool saves detailed information about Instagram's responses, which can help identify changes in their API structure.

3. **Regular updates**: If the tool stops working due to Instagram API changes, check for updates or submit an issue on GitHub.

4. **Custom headers**: The tool uses custom headers to mimic a real browser, which helps avoid being blocked by Instagram.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

This is free and open-source software. You are free to use, modify, and distribute it for personal use only.

## Acknowledgments

This project was vibe coded with the help of Windsurf and Claude 3.7 Sonnet.
