# Tab Groups Manager

A browser extension for Brave (and other Chromium-based browsers) that automatically creates tab groups based on domain patterns.

## Features

- Automatically organize tabs into groups based on domain patterns
- Create custom domain patterns using regular expressions
- Choose custom names and colors for each group
- Preferences are saved and persisted between browser sessions

## Installation

### Development Mode

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. Open your Brave browser and navigate to `brave://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the extension's root directory
7. The extension should now be installed and active

### From Web Store (Coming Soon)

Once the extension is published to the Chrome Web Store, you can install it directly from there.

## Usage

1. Click on the extension icon in your browser toolbar to open the popup
2. To add a new domain pattern:
   - Enter a regular expression pattern in the "Domain Pattern" field (e.g., `github\.com`)
   - Enter a name for the group in the "Group Name" field (e.g., "GitHub")
   - Select a color for the group
   - Click "Add Pattern"
3. Any tabs matching the pattern will be automatically grouped
4. You can remove patterns by clicking the "Remove" button next to the pattern in the list

## Pattern Examples

Here are some examples of patterns you might use:

- `github\.com` - Matches github.com domains
- `google\.com` - Matches google.com domains
- `mail\.google\.com` - Matches Gmail specifically
- `.*\.google\.com` - Matches all Google subdomains
- `(github|gitlab)\.com` - Matches both GitHub and GitLab

## Auto-Pattern Templates

The extension offers a powerful dynamic pattern matching system that allows you to create flexible rules for grouping tabs by domain structure:

### How Auto-Patterns Work

Auto-patterns use a special template syntax that automatically extracts the group name from the domain itself, allowing more dynamic grouping:

- **`:name` placeholder**: Designates which part of the domain becomes the group name
- **`*` wildcard**: Matches any subdomain segment (similar to `.*` in regex but simpler)

### Examples of Auto-Pattern Templates

- `:name.example.com` - Groups all example.com domains using the subdomain as the group name
  - `dev.example.com` → "dev" group
  - `staging.example.com` → "staging" group
  
- `:name.*.example.com` - Groups multi-level subdomains using the first level as the name
  - `project.dev.example.com` → "project" group
  - `app.staging.example.com` → "app" group

- `*.example.:name` - Groups by TLD with the same domain name
  - `example.com` → "com" group
  - `example.org` → "org" group

### Benefits Over Regular Patterns

- **Reduced Configuration**: Create one template instead of multiple specific patterns
- **Self-Organizing**: New subdomains are automatically grouped without additional configuration
- **Context Preservation**: Keeps domain context in the group name for better organization

### Manual Grouping Control

For more control over tab grouping:

- Use the "Group Existing Tabs" button to manually trigger grouping for all ungrouped tabs
- This is useful when you want to batch-process tabs without waiting for automatic grouping
- The extension only processes ungrouped tabs, preserving your manual organization

## Performance Optimizations

The extension includes several performance optimizations:

### URL Caching

- The extension caches processed URLs to avoid redundant pattern matching
- When tabs are dragged or moved, the cache eliminates processing lag by:
  - Storing the result of each URL's pattern matching
  - Immediately retrieving cached results for previously seen URLs
  - Skipping pattern evaluation for cached domains

### Smart Tab Processing

- Only processes ungrouped tabs, leaving your manually grouped tabs untouched
- Skips internal browser pages (`chrome://`, `brave://`)
- Focuses primarily on the active tab for URL changes
- Groups tabs in the background to keep the UI responsive

The cache is automatically cleared when patterns change or settings are updated, ensuring accurate grouping while maintaining performance.

## Browser Compatibility

This extension has been tested on:
- Brave Browser
- Google Chrome

It should work on any Chromium-based browser that supports the Tab Groups API.

## Development

To work on this extension:

1. Run the watch script to automatically rebuild on changes:
   ```
   npm run watch
   ```

2. After making changes, refresh the extension in the extensions page

## License

ISC License 