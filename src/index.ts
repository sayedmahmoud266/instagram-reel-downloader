#!/usr/bin/env node

import { Command } from 'commander';
import { Downloader } from './downloader';
import path from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const getVersion = (): string => {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    // Fallback version if package.json can't be read
    return '1.0.0';
  }
};

// Create a new command program
const program = new Command();

// Set up program metadata
program
  .name('instagram-reel-downloader')
  .description('Download Instagram reels from URLs')
  .version(getVersion());

// Add command to download a single reel
program
  .command('download')
  .description('Download a single Instagram reel')
  .argument('<url>', 'Instagram reel URL')
  .option('-o, --output <directory>', 'Output directory', './downloads')
  .option('-q, --quiet', 'Suppress progress output', false)
  .option('-v, --verbose', 'Enable verbose logging (shows URLs and detailed info)', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (url: string, options: { output: string, quiet: boolean, verbose: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
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
        saveMetadata: options.saveMetadata,
        verbose: options.verbose
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
  .option('-v, --verbose', 'Enable verbose logging (shows URLs and detailed info)', false)
  .option('-s, --skip-existing', 'Skip downloading if video and metadata files already exist', false)
  .option('-c, --continue-on-error', 'Continue downloading if one URL fails', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (urls: string[], options: { output: string, quiet: boolean, verbose: boolean, skipExisting: boolean, continueOnError: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
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
        saveMetadata: options.saveMetadata,
        verbose: options.verbose,
        skipExisting: options.skipExisting
      });
      
      // Use the enhanced batch download method
      const results = await downloader.downloadReels(urls);
      
      // Exit with error code if no files were downloaded
      if (results.length === 0) {
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
  .option('-v, --verbose', 'Enable verbose logging (shows URLs and detailed info)', false)
  .option('-s, --skip-existing', 'Skip downloading if video and metadata files already exist', false)
  .option('-c, --continue-on-error', 'Continue downloading if one URL fails', false)
  .option('-d, --debug', 'Enable debug mode for troubleshooting', false)
  .option('--debug-dir <directory>', 'Directory to save debug information', './debug')
  .option('-m, --save-metadata', 'Save reel metadata as JSON file', false)
  .action(async (file: string, options: { output: string, quiet: boolean, verbose: boolean, skipExisting: boolean, continueOnError: boolean, debug: boolean, debugDir: string, saveMetadata: boolean }) => {
    try {
      // Display a welcome message
      if (!options.quiet) {
        console.log('\n📱 Instagram Reel Downloader - File Mode');
        console.log('======================================');
        console.log(`📄 Input file: ${file}`);
        console.log(`📁 Output directory: ${options.output}`);
        if (options.skipExisting) {
          console.log(`⏭️  Skip existing: Enabled`);
        }
        if (options.debug) {
          console.log(`🔍 Debug mode: Enabled (${options.debugDir})`);
        }
        console.log('======================================\n');
      }
      
      const downloader = new Downloader({
        outputDir: options.output,
        debug: options.debug,
        debugDir: options.debugDir,
        saveMetadata: options.saveMetadata,
        verbose: options.verbose,
        skipExisting: options.skipExisting
      });
      
      // Use the enhanced file-based download method
      const results = await downloader.downloadReelsFromFile(file);
      
      // Exit with error code if no files were downloaded
      if (results.length === 0) {
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
