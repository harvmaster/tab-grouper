/**
 * Tab Groups Manager - Background Service
 * 
 * This service is responsible for monitoring tab creation and updates,
 * then automatically organizing tabs into groups based on domain patterns.
 */

interface DomainPattern {
  pattern: RegExp;
  groupName: string;
  color?: chrome.tabGroups.ColorEnum;
}

interface StoredPattern {
  patternStr: string;
  groupName: string;
  color?: chrome.tabGroups.ColorEnum;
}

interface AutoPattern {
  template: string;       // The original template pattern (e.g., ":name.*.example.com")
  regex: RegExp;          // The compiled regex to test against domains
  namePosition: number;   // The position of the capturing group for the name
}

interface UserSettings {
  enableAutoPatterns: boolean;
  autoPatterns: AutoPattern[];
  domainPatterns: StoredPattern[];
}

/**
 * LogManager class handles logging for the extension
 * and allows retrieving logs from the popup
 */
class LogManager {
  private static logs: string[] = [];
  private static maxLogs: number = 100;
  
  /**
   * Logs a message with an optional level
   * @param message The message to log
   * @param level The log level (log, error, warn)
   */
  public static log(message: string, level: 'log' | 'error' | 'warn' = 'log'): void {
    // Add timestamp to message
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    // Log to console
    if (level === 'error') {
      console.error(logMessage);
    } else if (level === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
    
    // Store in log array
    this.logs.unshift(logMessage);
    
    // Trim logs if they exceed max length
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }
  
  /**
   * Gets all stored logs
   * @returns Array of log messages
   */
  public static getLogs(): string[] {
    return [...this.logs];
  }
  
  /**
   * Clears all stored logs
   */
  public static clearLogs(): void {
    this.logs = [];
  }
}

/**
 * TabGroupManager class handles the automatic organization of tabs into groups
 * based on domain patterns defined by the user.
 */
class TabGroupManager {
  private domainPatterns: DomainPattern[] = [];
  private enableAutoPatterns: boolean = true;
  private autoPatterns: AutoPattern[] = [];
  private autoPatternCache: Map<string, string> = new Map(); // Cache for domain -> group name mapping
  private processedUrls: Map<string, string> = new Map(); // Cache for urls -> group name mapping
  
  constructor() {
    LogManager.log("TabGroupManager: Initializing...");
    
    // Load initial patterns from storage
    this.loadPatternsFromStorage();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Loads saved domain patterns from Chrome storage
   */
  private loadPatternsFromStorage(): void {
    LogManager.log("TabGroupManager: Loading patterns from storage...");
    
    // Default patterns (will be replaced with stored patterns if available)
    this.domainPatterns = [];
    
    // Default auto-pattern
    this.autoPatterns = [
      this.createAutoPattern(':name.*')
    ];
    
    // Load patterns and settings from storage
    chrome.storage.local.get(['domainPatterns', 'enableAutoPatterns', 'autoPatterns'], (result) => {
      LogManager.log("TabGroupManager: Storage data retrieved: " + JSON.stringify(result));
      
      if (result.domainPatterns) {
        // Convert stored string patterns back to RegExp objects
        this.domainPatterns = result.domainPatterns.map((p: StoredPattern) => ({
          pattern: new RegExp(p.patternStr),
          groupName: p.groupName,
          color: p.color
        }));
        
        LogManager.log(`TabGroupManager: Loaded ${this.domainPatterns.length} domain patterns`);
      }
      
      if (result.enableAutoPatterns !== undefined) {
        this.enableAutoPatterns = result.enableAutoPatterns;
        LogManager.log(`TabGroupManager: Auto-patterns enabled: ${this.enableAutoPatterns}`);
      }
      
      if (result.autoPatterns && Array.isArray(result.autoPatterns) && result.autoPatterns.length > 0) {
        // Convert stored auto patterns back to functional patterns
        try {
          this.autoPatterns = result.autoPatterns.map((p: any) => ({
            template: p.template,
            regex: new RegExp(p.regexStr),
            namePosition: p.namePosition
          }));
          
          LogManager.log(`TabGroupManager: Loaded ${this.autoPatterns.length} auto-patterns`);
          LogManager.log("TabGroupManager: Auto-patterns loaded: " + JSON.stringify(this.autoPatterns.map(p => p.template)));
        } catch (error: any) {
          LogManager.log("TabGroupManager: Error loading auto-patterns: " + error.message, "error");
          // Fall back to default pattern if there was an error
          this.autoPatterns = [this.createAutoPattern(':name.*')];
        }
      } else {
        LogManager.log("TabGroupManager: No auto-patterns found in storage, using default");
      }
      
      // Apply patterns to existing tabs if auto-patterns are enabled
      if (this.enableAutoPatterns) {
        this.applyAutoPatternToExistingTabs();
      }
    });
  }
  
  /**
   * Creates an AutoPattern object from a template string
   * @param template The template string with placeholders (e.g., ":name.*.example.com")
   * @returns The compiled AutoPattern object
   */
  private createAutoPattern(template: string): AutoPattern {
    LogManager.log(`TabGroupManager: Creating auto-pattern from template: ${template}`);
    
    // Find the position of :name in the template
    const nameIdx = template.indexOf(':name');
    if (nameIdx === -1) {
      throw new Error('Template must contain a :name placeholder');
    }
    
    // Replace placeholders with appropriate regex patterns
    let regexStr = template
      // Escape dots for regex
      .replace(/\./g, '\\.')
      // Replace * with regex wildcard
      .replace(/\*/g, '[^.]+')
      // Replace :name with named capture group
      .replace(/:name/g, '([^.]+)');
    
    // Create the regex object - the ^ and $ ensure we match the whole domain
    const regex = new RegExp(`^${regexStr}$`);
    LogManager.log(`TabGroupManager: Created regex: ${regex.source}`);
    
    // In our approach, it's always the first capturing group because we just have one
    const namePosition = 1;
    
    return {
      template,
      regex,
      namePosition
    };
  }
  
  /**
   * Sets up event listeners for tab events
   */
  private setupEventListeners(): void {
    // Listen for tab creation
    chrome.tabs.onCreated.addListener((tab) => {
      // Only handle the tab if it's not already in a group
      if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
        this.handleTabUpdate(tab);
      }
    });
    
    // Listen for tab updates (e.g., when URL changes)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only process URL changes for tabs not already in a group
      if (changeInfo.url && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
        // Check if this is the active tab
        if (tab.active) {
          LogManager.log(`TabGroupManager: URL changed on active tab ${tabId}: ${changeInfo.url}`);
          this.handleTabUpdate(tab);
        } else {
          // For background tabs, just log but don't process
          LogManager.log(`TabGroupManager: URL changed on background tab ${tabId} (not processing)`, "log");
        }
      }
    });
      
    // Listen for tab activation (when a tab becomes the active/focused tab)
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        // Only handle the tab if it's not already in a group
        if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
          LogManager.log(`TabGroupManager: Tab activated: ${tab.id}`);
          this.handleTabUpdate(tab);
        }
      } catch (error: any) {
        LogManager.log(`TabGroupManager: Error handling tab activation: ${error.message}`, "error");
      }
    });
  }
  
  /**
   * Gets the list of auto patterns
   * @returns The list of auto pattern templates
   */
  public getAutoPatternTemplates(): string[] {
    const templates = this.autoPatterns.map(p => p.template);
    LogManager.log(`TabGroupManager: Getting auto-pattern templates, count: ${templates.length}`);
    LogManager.log("TabGroupManager: Templates: " + JSON.stringify(templates));
    return templates;
  }
  
  /**
   * Handles tab URL updates, applying patterns to organize tabs
   */
  private async handleTabUpdate(tab: chrome.tabs.Tab): Promise<void> {
    // Skip if tab is already in a group
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      LogManager.log(`TabGroupManager: Skipping tab ${tab.id} - already in group ${tab.groupId}`);
      return;
    }
    
    // Skip if no URL or ID
    if (!tab.url || !tab.id) {
      LogManager.log(`TabGroupManager: Skipping tab ${tab.id} - no URL or ID`);
      return;
    }
    
    // Skip internal chrome and brave URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
      LogManager.log(`TabGroupManager: Skipping internal browser URL: ${tab.url}`);
      return;
    }
    
    try {
      // Check the processedUrls cache first for fast lookup
      if (this.processedUrls.has(tab.url)) {
        const cachedGroupName = this.processedUrls.get(tab.url);
        LogManager.log(`TabGroupManager: Cache hit for ${tab.url} -> group: ${cachedGroupName}`);
        
        // If we have a cached group name, use it directly
        if (cachedGroupName) {
          await this.addTabToGroup(tab.id, cachedGroupName);
        }
        // If cached as null/undefined, we know it doesn't match any patterns
        return;
      }
      
      const domain = new URL(tab.url).hostname;
      
      // Check for manual pattern match
      for (const pattern of this.domainPatterns) {
        if (pattern.pattern.test(domain)) {
          LogManager.log(`TabGroupManager: Domain ${domain} matches pattern ${pattern.pattern}`);
          await this.addTabToGroup(tab.id, pattern.groupName, pattern.color);
          // Cache the result
          this.processedUrls.set(tab.url, pattern.groupName);
          return;
        }
      }
      
      // Check for auto-pattern match if enabled
      if (this.enableAutoPatterns) {
        // Try to match with auto-patterns
        const groupName = this.matchAutoPattern(domain);
        if (groupName) {
          LogManager.log(`TabGroupManager: Domain ${domain} matches auto-pattern, group: ${groupName}`);
          // Cache both in the domain cache and URL cache
          this.autoPatternCache.set(domain, groupName);
          this.processedUrls.set(tab.url, groupName);
          await this.addTabToGroup(tab.id, groupName);
          return;
        }
      }
      
      // If no match was found, cache it as empty string to avoid rechecking
      this.processedUrls.set(tab.url, "");
      LogManager.log(`TabGroupManager: No pattern match for ${domain}`);
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error processing tab update: ${error.message}`, "error");
    }
  }
  
  /**
   * Clears the URL cache to force reprocessing of all tabs
   */
  private clearUrlCache(): void {
    LogManager.log("TabGroupManager: Clearing URL cache");
    this.processedUrls.clear();
  }
  
  /**
   * Adds a new domain pattern for tab grouping
   */
  public addPattern(patternStr: string, groupName: string, color?: chrome.tabGroups.ColorEnum): void {
    try {
      LogManager.log(`TabGroupManager: Adding pattern ${patternStr} -> ${groupName}`);
      const pattern = new RegExp(patternStr);
      this.domainPatterns.push({ pattern, groupName, color });
      this.savePatterns();
      
      // Clear URL cache since patterns have changed
      this.clearUrlCache();
      
      // Apply to existing tabs
      this.applyPatternsToExistingTabs();
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error adding pattern: ${error.message}`, "error");
    }
  }
  
  /**
   * Adds a new auto-pattern template
   */
  public addAutoPattern(template: string): boolean {
    LogManager.log(`TabGroupManager: Adding auto-pattern template: ${template}`);
    
    // Validate the template
    if (!template.includes(':name')) {
      LogManager.log(`TabGroupManager: Invalid template, missing :name placeholder: ${template}`, "error");
      return false;
    }
    
    try {
      // Check if this template already exists
      if (this.autoPatterns.some(p => p.template === template)) {
        LogManager.log(`TabGroupManager: Template already exists: ${template}`, "warn");
        return false;
      }
      
      // Create and add the auto-pattern
      const autoPattern = this.createAutoPattern(template);
      this.autoPatterns.push(autoPattern);
      
      // Save settings
      this.saveSettings();
      
      // Clear URL cache since patterns have changed
      this.clearUrlCache();
      
      // Apply to existing tabs if auto-patterns are enabled
      if (this.enableAutoPatterns) {
        this.applyAutoPatternToExistingTabs();
      }
      
      return true;
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error adding auto-pattern: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Removes an auto-pattern template
   */
  public removeAutoPattern(template: string): boolean {
    LogManager.log(`TabGroupManager: Removing auto-pattern template: ${template}`);
    
    try {
      const initialLength = this.autoPatterns.length;
      this.autoPatterns = this.autoPatterns.filter(p => p.template !== template);
      
      if (this.autoPatterns.length < initialLength) {
        // Pattern was removed, save settings
        this.saveSettings();
        
        // Clear the URL and auto-pattern caches
        this.clearUrlCache();
        this.autoPatternCache.clear();
        
        return true;
      }
      
      LogManager.log(`TabGroupManager: Auto-pattern template not found: ${template}`, "warn");
      return false;
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error removing auto-pattern: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Sets whether auto-patterns are enabled
   * @param enabled Whether auto-patterns should be enabled
   */
  public setAutoPatterns(enabled: boolean): void {
    LogManager.log(`TabGroupManager: Setting auto-patterns enabled: ${enabled}`);
    this.enableAutoPatterns = enabled;
    
    // Save settings
    this.saveSettings();
    
    // Clear URL cache since behavior has changed
    this.clearUrlCache();
    
    // Apply to existing tabs if enabling
    if (enabled) {
      this.applyAutoPatternToExistingTabs();
    }
  }
  
  /**
   * Gets whether auto-patterns are enabled
   * @returns Whether auto-patterns are enabled
   */
  public getAutoPatterns(): boolean {
    return this.enableAutoPatterns;
  }
  
  /**
   * Applies current patterns to all existing tabs
   */
  private async applyPatternsToExistingTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    
    LogManager.log(`TabGroupManager: Applying patterns to ${tabs.length} existing tabs`);
    
    for (const tab of tabs) {
      this.handleTabUpdate(tab);
    }
  }
  
  /**
   * Applies auto-pattern grouping to all existing tabs
   */
  private async applyAutoPatternToExistingTabs(): Promise<void> {
    if (!this.enableAutoPatterns) return;
    
    LogManager.log("TabGroupManager: Applying auto-patterns to existing tabs");
    
    const tabs = await chrome.tabs.query({});
    LogManager.log(`TabGroupManager: Found ${tabs.length} tabs to process`);
    
    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;
      
      const domain = new URL(tab.url).hostname;
      
      // Skip if the tab already matches a manual pattern
      const matchingPattern = this.domainPatterns.find(p => p.pattern.test(domain));
      if (matchingPattern) continue;
      
      // Try to match with auto patterns
      const groupName = this.matchAutoPattern(domain);
      if (groupName) {
        LogManager.log(`TabGroupManager: Auto-grouped tab ${tab.id} (${domain}) to ${groupName}`);
        this.autoPatternCache.set(domain, groupName);
        await this.addTabToGroup(tab.id, groupName);
      }
    }
  }
  
  /**
   * Matches a domain against the auto-patterns
   * @param domain The domain to match
   * @returns The extracted group name or null if no match
   */
  private matchAutoPattern(domain: string): string | null {
    for (const pattern of this.autoPatterns) {
      const match = domain.match(pattern.regex);
      if (match && match[pattern.namePosition]) {
        // Extract the matched name and capitalize it
        const name = match[pattern.namePosition];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    
    return null;
  }
  
  /**
   * Saves all settings to Chrome storage
   * This includes both auto-patterns and the enableAutoPatterns flag
   */
  private saveSettings(): void {
    LogManager.log("TabGroupManager: Saving settings to storage...");
    
    // Save auto patterns
    const autoPatternsToSave = this.autoPatterns.map(p => ({
      template: p.template,
      regexStr: p.regex.source,
      namePosition: p.namePosition
    }));
    
    LogManager.log(`TabGroupManager: Saving ${this.autoPatterns.length} auto-patterns`);
    LogManager.log("TabGroupManager: Auto-patterns to save: " + JSON.stringify(autoPatternsToSave));
    
    // Save all settings
    chrome.storage.local.set({
      autoPatterns: autoPatternsToSave,
      enableAutoPatterns: this.enableAutoPatterns
    }, () => {
      if (chrome.runtime.lastError) {
        LogManager.log("TabGroupManager: Error saving settings: " + chrome.runtime.lastError.message, "error");
      } else {
        LogManager.log("TabGroupManager: Auto-pattern settings saved successfully");
      }
    });
  }
  
  /**
   * Applies auto patterns to all existing tabs
   * Public method that can be called from message handlers
   */
  public applyAutoPatternsToTabs(): void {
    LogManager.log("TabGroupManager: Public method - applying auto patterns to tabs");
    if (!this.enableAutoPatterns) {
      LogManager.log("TabGroupManager: Auto patterns are disabled, skipping application");
      return;
    }
    
    // Call the internal implementation via setTimeout to prevent blocking
    setTimeout(async () => {
      try {
        const tabs = await chrome.tabs.query({});
        LogManager.log(`TabGroupManager: Found ${tabs.length} tabs to process`);
        
        for (const tab of tabs) {
          if (!tab.url || !tab.id) continue;
          
          const domain = new URL(tab.url).hostname;
          
          // Skip if the tab already matches a manual pattern
          const matchingPattern = this.domainPatterns.find(p => p.pattern.test(domain));
          if (matchingPattern) continue;
          
          // Try to match with auto patterns
          const groupName = this.matchAutoPattern(domain);
          if (groupName) {
            LogManager.log(`TabGroupManager: Auto-grouped tab ${tab.id} (${domain}) to ${groupName}`);
            this.autoPatternCache.set(domain, groupName);
            await this.addTabToGroup(tab.id, groupName);
          }
        }
      } catch (error: any) {
        LogManager.log(`TabGroupManager: Error applying auto patterns: ${error.message}`, "error");
      }
    }, 0);
  }
  
  /**
   * Groups all existing ungrouped tabs using the defined patterns
   * Optimized to avoid grouping tabs that are already in groups
   */
  public async groupAllExistingTabs(): Promise<number> {
    LogManager.log("TabGroupManager: Grouping all existing ungrouped tabs");
    
    try {
      // Get all tabs in all windows
      const tabs = await chrome.tabs.query({});
      
      // Filter only ungrouped tabs
      const ungroupedTabs = tabs.filter(tab => 
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE && 
        tab.url && 
        !tab.url.includes('chrome://') && 
        !tab.url.includes('brave://')
      );
      
      LogManager.log(`TabGroupManager: Found ${ungroupedTabs.length} ungrouped tabs to process`);
      
      let groupedCount = 0;
      
      // Process each tab
      for (const tab of ungroupedTabs) {
        try {
          if (!tab.url || !tab.id) continue;
          
          const domain = new URL(tab.url).hostname;
          if (!domain) continue;
          
          // Check for manual pattern match
          const matchingPattern = this.domainPatterns.find(p => p.pattern.test(domain));
          if (matchingPattern) {
            LogManager.log(`TabGroupManager: Grouping tab ${tab.id} to ${matchingPattern.groupName} (manual pattern)`);
            await this.addTabToGroup(tab.id, matchingPattern.groupName, matchingPattern.color);
            groupedCount++;
            continue;
          }
          
          // Check for auto-pattern match if enabled
          if (this.enableAutoPatterns) {
            // Check cache first
            if (this.autoPatternCache.has(domain)) {
              const groupName = this.autoPatternCache.get(domain);
              if (groupName) {
                LogManager.log(`TabGroupManager: Grouping tab ${tab.id} to ${groupName} (from cache)`);
                await this.addTabToGroup(tab.id, groupName);
                groupedCount++;
                continue;
              }
            }
            
            // Try to match with auto-patterns
            const groupName = this.matchAutoPattern(domain);
            if (groupName) {
              LogManager.log(`TabGroupManager: Grouping tab ${tab.id} to ${groupName} (auto-pattern)`);
              this.autoPatternCache.set(domain, groupName);
              await this.addTabToGroup(tab.id, groupName);
              groupedCount++;
            }
          }
        } catch (error: any) {
          LogManager.log(`TabGroupManager: Error processing tab ${tab.id}: ${error.message}`, "error");
        }
      }
      
      LogManager.log(`TabGroupManager: Successfully grouped ${groupedCount} tabs`);
      return groupedCount;
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error grouping tabs: ${error.message}`, "error");
      return 0;
    }
  }
  
  /**
   * Adds a tab to a group, creating the group if it doesn't exist
   * @param tabId ID of the tab to group
   * @param groupName Name for the group
   * @param color Color for the group
   */
  private async addTabToGroup(tabId: number, groupName: string, color?: chrome.tabGroups.ColorEnum): Promise<void> {
    try {
      // Get current window
      const currentWindow = await this.getCurrentWindow();
      if (!currentWindow.id) return;
      
      // Check if a group with this name already exists
      const groups = await chrome.tabGroups.query({
        windowId: currentWindow.id,
        title: groupName
      });
      
      let groupId: number;
      
      if (groups.length > 0) {
        // Group exists, add tab to it
        groupId = groups[0].id;
        await chrome.tabs.group({
          groupId,
          tabIds: tabId
        });
      } else {
        // Create new group
        groupId = await chrome.tabs.group({
          tabIds: tabId
        });
        
        // Set title and color for the new group
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: color || "grey"
        });
      }
    } catch (error) {
      console.error("Error grouping tab:", error);
    }
  }
  
  /**
   * Gets the current browser window
   * @returns Promise resolving to the current window
   */
  private async getCurrentWindow(): Promise<chrome.windows.Window> {
    return new Promise((resolve) => {
      chrome.windows.getCurrent((window) => {
        resolve(window);
      });
    });
  }
  
  /**
   * Refreshes patterns from storage
   */
  public refreshPatterns(): void {
    this.loadPatternsFromStorage();
  }
  
  /**
   * Saves current patterns to Chrome storage
   */
  private savePatterns(): void {
    const patternsToSave = this.domainPatterns.map(p => ({
      patternStr: p.pattern.source,
      groupName: p.groupName,
      color: p.color
    }));
    
    LogManager.log(`TabGroupManager: Saving ${patternsToSave.length} manual patterns to storage`);
    
    chrome.storage.local.set({ domainPatterns: patternsToSave }, () => {
      if (chrome.runtime.lastError) {
        LogManager.log("TabGroupManager: Error saving patterns: " + chrome.runtime.lastError.message, "error");
      } else {
        LogManager.log("TabGroupManager: Manual patterns saved successfully");
      }
    });
  }
}

// Initialize the manager when the extension loads
const tabGroupManager = new TabGroupManager();

/**
 * Helper function to ensure safe response handling for chrome.runtime.sendMessage
 * Prevents "The message port closed before a response was received" error
 */
const safeResponse = (responseData: any, sendResponse: (response: any) => void) => {
  try {
    LogManager.log(`TabGroupManager: Sending response: ${JSON.stringify(responseData)}`);
    sendResponse(responseData);
  } catch (error) {
    LogManager.log("Error sending response: " + (error as Error).message, "error");
  }
};

// Listen for messages from the popup
// @ts-ignore
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  LogManager.log("TabGroupManager: Received message: " + JSON.stringify(message));
  
  // Handle messages that need immediate responses first
  if (message.action === "getLogs") {
    // Quickly return logs to the popup
    const logs = LogManager.getLogs();
    LogManager.log(`TabGroupManager: Sending ${logs.length} logs to popup`);
    try {
      sendResponse({ logs: logs });
    } catch (error) {
      LogManager.log("Error sending logs: " + (error as Error).message, "error");
    }
    return true;
  }
  
  if (message.action === "getAutoPatternTemplates") {
    const templates = tabGroupManager.getAutoPatternTemplates();
    LogManager.log("TabGroupManager: Sending templates to popup: " + JSON.stringify(templates));
    safeResponse({ templates: templates }, sendResponse);
    return true;
  }
  
  if (message.action === "getAutoPatterns") {
    const enabled = tabGroupManager.getAutoPatterns();
    LogManager.log("TabGroupManager: Auto-patterns enabled: " + enabled);
    safeResponse({ enabled: enabled }, sendResponse);
    return true;
  }
  
  if (message.action === "addAutoPattern") {
    LogManager.log(`TabGroupManager: Adding auto-pattern from popup: ${message.template}`);
    
    // First, validate the template
    if (!message.template || !message.template.includes(':name')) {
      LogManager.log("TabGroupManager: Invalid template format", "error");
      safeResponse({ success: false, error: "Invalid template format" }, sendResponse);
      return true;
    }
    
    // Try to add the pattern - respond immediately with the result
    try {
      const success = tabGroupManager.addAutoPattern(message.template);
      
      // Double-check that the pattern was added
      const templates = tabGroupManager.getAutoPatternTemplates();
      const wasAdded = templates.includes(message.template);
      LogManager.log(`TabGroupManager: Was ${message.template} added? ${wasAdded}`);
      
      safeResponse({ success: wasAdded }, sendResponse);
      
      // Apply patterns in the background after responding
      if (wasAdded && tabGroupManager.getAutoPatterns()) {
        setTimeout(() => {
          LogManager.log("TabGroupManager: Applying pattern in background");
          tabGroupManager.applyAutoPatternsToTabs();
        }, 100);
      }
    } catch (error: any) {
      LogManager.log(`TabGroupManager: Error in addAutoPattern: ${error.message}`, "error");
      safeResponse({ success: false, error: error.message }, sendResponse);
    }
    
    return true;
  }
  
  // Handle other messages
  try {
    if (message.action === "clearLogs") {
      LogManager.clearLogs();
      LogManager.log("Logs cleared by popup request");
      safeResponse({ success: true }, sendResponse);
      return true;
    }
    
    if (message.action === "addPattern") {
      LogManager.log(`TabGroupManager: Adding manual pattern: ${message.pattern} -> ${message.groupName}`);
      tabGroupManager.addPattern(
        message.pattern,
        message.groupName,
        message.color
      );
      safeResponse({ success: true }, sendResponse);
      return true;
    } 
    
    if (message.action === "refreshPatterns") {
      LogManager.log("TabGroupManager: Refreshing patterns");
      tabGroupManager.refreshPatterns();
      safeResponse({ success: true }, sendResponse);
      return true;
    } 
    
    if (message.action === "setAutoPatterns") {
      LogManager.log(`TabGroupManager: Setting auto-patterns enabled: ${message.enabled}`);
      tabGroupManager.setAutoPatterns(message.enabled);
      safeResponse({ success: true }, sendResponse);
      return true;
    } 
    
    if (message.action === "removeAutoPattern") {
      LogManager.log(`TabGroupManager: Removing auto-pattern: ${message.template}`);
      const success = tabGroupManager.removeAutoPattern(message.template);
      
      // Double-check that the pattern was removed
      const templates = tabGroupManager.getAutoPatternTemplates();
      const wasRemoved = !templates.includes(message.template);
      LogManager.log(`TabGroupManager: Was ${message.template} removed? ${wasRemoved}`);
      
      safeResponse({ success: wasRemoved }, sendResponse);
      
      // Apply remaining patterns in the background after responding
      if (wasRemoved && tabGroupManager.getAutoPatterns()) {
        setTimeout(() => {
          LogManager.log("TabGroupManager: Applying patterns after removal");
          tabGroupManager.applyAutoPatternsToTabs();
        }, 100);
      }
      
      return true;
    }
    
    if (message.action === 'groupExistingTabs') {
      // Immediately respond that we received the message
      LogManager.log(`Background: Received request to group existing tabs`);
      
      // Group existing tabs in the background
      tabGroupManager.groupAllExistingTabs()
        .then(groupedCount => {
          // Try to send a follow-up message with the result
          try {
            if (chrome.runtime.lastError) {
              LogManager.log(`Cannot send result: ${chrome.runtime.lastError.message}`, "error");
              return;
            }
            
            // Only send response if we haven't already
            if (sendResponse) {
              sendResponse({ success: true, groupedCount });
              LogManager.log(`Background: Grouped ${groupedCount} tabs successfully`);
            }
          } catch (error: any) {
            LogManager.log(`Error sending group result: ${error.message}`, "error");
          }
        })
        .catch(error => {
          LogManager.log(`Error grouping tabs: ${error.message}`, "error");
          // Try to send error response
          try {
            if (sendResponse) {
              sendResponse({ success: false, error: error.message });
            }
          } catch (e) {
            LogManager.log(`Could not send error response: ${e}`, "error");
          }
        });
      
      // Return true to indicate we'll respond asynchronously
      return true;
    }
    
    LogManager.log(`TabGroupManager: Unknown message action: ${message.action}`, "warn");
    safeResponse({ success: false, error: "Unknown action" }, sendResponse);
  } catch (error: any) {
    LogManager.log("TabGroupManager: Error handling message: " + error.message, "error");
    safeResponse({ success: false, error: error.message || "Unknown error" }, sendResponse);
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
}); 