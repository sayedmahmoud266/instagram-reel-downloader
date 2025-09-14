#!/usr/bin/env node

import { Command } from 'commander';
import { Downloader } from './downloader';
import path from 'path';

// Create a new command program
const program = new Command();

// Set up program metadata
program
  .name('instagram-reel-downloader')
  .description('Download Instagram reels from URLs')
  .version('1.0.0');

// Add command to download a single reel
program
  .command('download')
  .description('Download a single Instagram reel')
  .argument('<url>', 'Instagram reel URL')
  .option('-o, --output <directory>', 'Output directory', './downloads')
  .option('-q, --quiet', 'Suppress progress output', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (url: string, options: { output: string, quiet: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
    try {
      // Display a welcome message
      if (!options.quiet) {
        console.log('\n📱 Instagram Reel Downloader');
        console.log('============================');
        console.log(`🔗 URL: ${url}`);
        console.log(`📁 Output directory: ${options.output}`);
        if (options.debug) {
          console.log(`🔍 Debug mode: Enabled (${options.debugDir})`);
        }
        console.log('============================\n');
      }
      
      // Create the downloader and start the download
      const downloader = new Downloader({
        outputDir: options.output,
        debug: options.debug,
        debugDir: options.debugDir,
        saveMetadata: options.saveMetadata
      });
      console.log('🔍 Analyzing Instagram URL...');
      const filePath = await downloader.downloadReel(url);
      
      // Show success message with file details
      const stats = await import('fs-extra').then(fs => fs.stat(filePath));
      const fileSize = (stats.size / (1024 * 1024)).toFixed(2); // Convert to MB
      
      console.log('\n✅ Download completed successfully!');
      console.log(`📂 File saved to: ${filePath}`);
      console.log(`📊 File size: ${fileSize} MB`);
    } catch (error) {
      console.error('\n❌ Download failed!');
      
      if (error instanceof Error) {
        // Format error message for better readability
        const errorLines = error.message.split('\n');
        errorLines.forEach(line => console.error(`   ${line}`));
        
        // Provide troubleshooting tips based on error message
        if (error.message.includes('Could not extract shortcode')) {
          console.error('\n💡 Tip: Make sure you are using a valid Instagram URL. Example: https://www.instagram.com/reel/ABC123xyz/');
        } else if (error.message.includes('Could not find video URL')) {
          console.error('\n💡 Tip: This might be a private post or not a video/reel. Make sure the content is public.');
        } else if (error.message.includes('Failed to fetch')) {
          console.error('\n💡 Tip: Check your internet connection or try again later. Instagram might be rate-limiting requests.');
        }
        
        if (options.debug) {
          console.error('\n🔍 Debug mode is enabled. Check the debug directory for more information.');
        } else {
          console.error('\n💡 Tip: Try again with --debug flag for more detailed error information.');
        }
      } else {
        console.error('   An unknown error occurred');
      }
      
      process.exit(1);
    }
  });

// Add command to download multiple reels
program
  .command('batch')
  .description('Download multiple Instagram reels')
  .argument('<urls...>', 'Instagram reel URLs (space-separated)')
  .option('-o, --output <directory>', 'Output directory', './downloads')
  .option('-q, --quiet', 'Suppress progress output', false)
  .option('-c, --continue-on-error', 'Continue downloading if one URL fails', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (urls: string[], options: { output: string, quiet: boolean, continueOnError: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
    try {
      // Display a welcome message
      if (!options.quiet) {
        console.log('\n📱 Instagram Reel Downloader - Batch Mode');
        console.log('=======================================');
        console.log(`🔢 Total URLs: ${urls.length}`);
        console.log(`📁 Output directory: ${options.output}`);
        console.log(`⚙️ Continue on error: ${options.continueOnError ? 'Yes' : 'No'}`);
        if (options.debug) {
          console.log(`🔍 Debug mode: Enabled (${options.debugDir})`);
        }
        console.log('=======================================\n');
      }
      
      const downloader = new Downloader({
        outputDir: options.output,
        debug: options.debug,
        debugDir: options.debugDir,
        saveMetadata: options.saveMetadata
      });
      
      // Process URLs one by one with status updates
      const results: { url: string, filePath: string, success: boolean, error?: string }[] = [];
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
        
        try {
          const filePath = await downloader.downloadReel(url);
          results.push({ url, filePath, success: true });
          console.log(`✅ Success: ${url} -> ${filePath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ url, filePath: '', success: false, error: errorMessage });
          console.error(`❌ Failed: ${url} - ${errorMessage}`);
          
          if (!options.continueOnError) {
            console.error('\n❌ Stopping batch process due to error. Use --continue-on-error to ignore failures.');
            break;
          }
        }
      }
      
      // Show summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log('\n📊 Batch Download Summary');
      console.log('=======================');
      console.log(`✅ Successfully downloaded: ${successful} out of ${urls.length} reels`);
      
      if (failed > 0) {
        console.log(`❌ Failed downloads: ${failed}`);
        console.log('\n📋 Failed URLs:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`  - ${result.url} (${result.error})`);
        });
      }
      
      if (successful > 0) {
        console.log('\n📂 Successful downloads:');
        results.filter(r => r.success).forEach(result => {
          console.log(`  - ${result.filePath}`);
        });
      }
      
      // Exit with error code if any downloads failed
      if (failed > 0 && successful === 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Batch process failed!');
      
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
        
        if (options.debug) {
          console.error('\n🔍 Debug mode is enabled. Check the debug directory for more information.');
        } else {
          console.error('\n💡 Tip: Try again with --debug flag for more detailed error information.');
        }
      } else {
        console.error('   An unknown error occurred');
      }
      
      process.exit(1);
    }
  });

// Add command to download reels from a file containing URLs
program
  .command('from-file')
  .description('Download Instagram reels from a file containing URLs (one per line)')
  .argument('<file>', 'Path to file containing URLs')
  .option('-o, --output <directory>', 'Output directory', './downloads')
  .option('-q, --quiet', 'Suppress progress output', false)
  .option('-c, --continue-on-error', 'Continue downloading if one URL fails', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (file: string, options: { output: string, quiet: boolean, continueOnError: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
    try {
      // Read the file and extract URLs
      const fs = await import('fs-extra');
      
      // Check if file exists
      if (!await fs.pathExists(file)) {
        console.error(`\n❌ Error: File not found: ${file}`);
        process.exit(1);
      }
      
      const content = await fs.readFile(file, 'utf-8');
      const fileExt = path.extname(file).toLowerCase();
      
      let urls: string[] = [];
      
      // Process file based on its extension
      if (fileExt === '.json') {
        try {
          // Parse JSON file
          const jsonData = JSON.parse(content);
          
          // Handle different JSON structures
          if (Array.isArray(jsonData)) {
            // Simple array of URLs
            urls = jsonData.filter(url => typeof url === 'string' && url.includes('instagram.com'));
          } else if (typeof jsonData === 'object' && jsonData !== null) {
            // Object with URLs as values
            const possibleUrlArrays = Object.values(jsonData).filter(val => Array.isArray(val));
            if (possibleUrlArrays.length > 0) {
              // Use the first array found
              urls = possibleUrlArrays[0].filter(url => typeof url === 'string' && url.includes('instagram.com'));
            } else {
              // Look for URL strings in the object
              urls = Object.values(jsonData)
                .filter((val): val is string => typeof val === 'string' && val.includes('instagram.com'));
            }
          }
        } catch (err) {
          console.error(`\n❌ Error: Invalid JSON format in file: ${file}`);
          process.exit(1);
        }
      } else if (fileExt === '.csv') {
        // Process CSV file
        // Split by lines and then by commas
        const lines = content.split('\n');
        
        for (const line of lines) {
          // Split by comma and trim each value
          const values = line.split(',').map(val => val.trim());
          
          // Add any value that looks like an Instagram URL
          urls.push(...values.filter(val => val.includes('instagram.com')));
        }
      } else {
        // Default: treat as text file with one URL per line
        urls = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && line.includes('instagram.com'));
      }
      
      if (urls.length === 0) {
        console.error('\n❌ No valid Instagram URLs found in the file');
        console.error('\n💡 Tip: Each line should contain a single Instagram URL');
        console.error('   Example: https://www.instagram.com/reel/ABC123xyz/');
        process.exit(1);
      }
      
      // Display a welcome message
      if (!options.quiet) {
        console.log('\n📱 Instagram Reel Downloader - File Mode');
        console.log('======================================');
        console.log(`📄 Input file: ${file}`);
        console.log(`🔢 Total URLs found: ${urls.length}`);
        console.log(`📁 Output directory: ${options.output}`);
        console.log(`⚙️ Continue on error: ${options.continueOnError ? 'Yes' : 'No'}`);
        if (options.debug) {
          console.log(`🔍 Debug mode: Enabled (${options.debugDir})`);
        }
        console.log('======================================\n');
      }
      
      const downloader = new Downloader({
        outputDir: options.output,
        debug: options.debug,
        debugDir: options.debugDir,
        saveMetadata: options.saveMetadata
      });
      
      // Process URLs one by one with status updates
      const results: { url: string, filePath: string, success: boolean, error?: string }[] = [];
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
        
        try {
          const filePath = await downloader.downloadReel(url);
          results.push({ url, filePath, success: true });
          console.log(`✅ Success: ${url} -> ${filePath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ url, filePath: '', success: false, error: errorMessage });
          console.error(`❌ Failed: ${url} - ${errorMessage}`);
          
          if (!options.continueOnError) {
            console.error('\n❌ Stopping process due to error. Use --continue-on-error to ignore failures.');
            break;
          }
        }
      }
      
      // Show summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log('\n📊 File Download Summary');
      console.log('=======================');
      console.log(`✅ Successfully downloaded: ${successful} out of ${urls.length} reels`);
      
      if (failed > 0) {
        console.log(`❌ Failed downloads: ${failed}`);
        console.log('\n📋 Failed URLs:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`  - ${result.url} (${result.error})`);
        });
      }
      
      if (successful > 0) {
        console.log('\n📂 Successful downloads:');
        results.filter(r => r.success).forEach(result => {
          console.log(`  - ${result.filePath}`);
        });
      }
      
      // Exit with error code if all downloads failed
      if (failed > 0 && successful === 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ File processing failed!');
      
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
        
        if (options.debug) {
          console.error('\n🔍 Debug mode is enabled. Check the debug directory for more information.');
        } else {
          console.error('\n💡 Tip: Try again with --debug flag for more detailed error information.');
        }
      } else {
        console.error('   An unknown error occurred');
      }
      
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
