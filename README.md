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