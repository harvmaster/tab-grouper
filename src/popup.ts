/**
 * Tab Groups Manager - Popup UI
 * 
 * This handles the UI for adding and managing domain patterns
 * for tab grouping.
 */

interface StoredPattern {
  patternStr: string;
  groupName: string;
  color?: chrome.tabGroups.ColorEnum;
}

/**
 * PopupManager class handles the UI interactions in the popup
 */
class PopupManager {
  private patternInput: HTMLInputElement;
  private groupNameInput: HTMLInputElement;
  private colorSelect: HTMLSelectElement;
  private addButton: HTMLButtonElement;
  private patternList: HTMLDivElement;
  private autoPatternToggle: HTMLInputElement;
  private autoPatternTemplateInput: HTMLInputElement;
  private addAutoPatternButton: HTMLButtonElement;
  private autoPatternList: HTMLDivElement;
  private refreshLogsButton: HTMLButtonElement;
  private clearLogsButton: HTMLButtonElement;
  private groupExistingTabsButton: HTMLButtonElement;
  private logContainer: HTMLDivElement;
  private patterns: StoredPattern[] = [];
  private autoPatterns: string[] = [];
  private logRefreshInterval: number | null = null;
  
  constructor() {
    console.log("PopupManager: Initializing...");
    
    // Get UI elements
    this.patternInput = document.getElementById('pattern') as HTMLInputElement;
    this.groupNameInput = document.getElementById('groupName') as HTMLInputElement;
    this.colorSelect = document.getElementById('color') as HTMLSelectElement;
    this.addButton = document.getElementById('addPattern') as HTMLButtonElement;
    this.patternList = document.getElementById('patternList') as HTMLDivElement;
    this.autoPatternToggle = document.getElementById('autoPatterns') as HTMLInputElement;
    this.autoPatternTemplateInput = document.getElementById('autoPatternTemplate') as HTMLInputElement;
    this.addAutoPatternButton = document.getElementById('addAutoPattern') as HTMLButtonElement;
    this.autoPatternList = document.getElementById('autoPatternList') as HTMLDivElement;
    this.refreshLogsButton = document.getElementById('refreshLogs') as HTMLButtonElement;
    this.clearLogsButton = document.getElementById('clearLogs') as HTMLButtonElement;
    this.groupExistingTabsButton = document.getElementById('groupExistingTabs') as HTMLButtonElement;
    this.logContainer = document.getElementById('logContainer') as HTMLDivElement;
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load patterns from storage
    this.loadPatterns();
    
    // Load auto-pattern setting
    this.loadAutoPatternSetting();
    
    // Load auto-pattern templates
    this.loadAutoPatternTemplates();
    
    // Load logs
    this.loadLogs();
    
    // Start auto-refresh for logs
    this.startLogRefresh();
  }
  
  /**
   * Sets up event listeners for UI elements
   */
  private setupEventListeners(): void {
    console.log("PopupManager: Setting up event listeners");
    
    this.addButton.addEventListener('click', () => {
      this.addPattern();
    });
    
    this.autoPatternToggle.addEventListener('change', () => {
      this.toggleAutoPatterns();
    });
    
    this.addAutoPatternButton.addEventListener('click', () => {
      this.addAutoPattern();
    });
    
    this.refreshLogsButton.addEventListener('click', () => {
      this.loadLogs();
    });
    
    this.clearLogsButton.addEventListener('click', () => {
      this.clearLogs();
    });
    
    this.groupExistingTabsButton.addEventListener('click', () => {
      this.groupExistingTabs();
    });
  }
  
  /**
   * Starts automatic log refresh
   */
  private startLogRefresh(): void {
    console.log("PopupManager: Starting log refresh interval");
    
    // Clear any existing interval
    this.stopLogRefresh();
    
    // Refresh logs every 3 seconds
    this.logRefreshInterval = window.setInterval(() => {
      this.loadLogs();
    }, 3000);
  }
  
  /**
   * Stops automatic log refresh
   */
  private stopLogRefresh(): void {
    if (this.logRefreshInterval !== null) {
      window.clearInterval(this.logRefreshInterval);
      this.logRefreshInterval = null;
    }
  }
  
  /**
   * Loads logs from the background script
   */
  private loadLogs(): void {
    console.log("PopupManager: Loading logs from background");
    
    try {
      chrome.runtime.sendMessage({ action: 'getLogs' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('PopupManager: Error getting logs:', chrome.runtime.lastError);
          // Add a log entry in the UI to show the error
          const errorLogEntry = document.createElement('div');
          errorLogEntry.className = 'log-entry error';
          errorLogEntry.textContent = `[Error] Failed to get logs: ${chrome.runtime.lastError.message || 'Unknown error'}`;
          this.logContainer.appendChild(errorLogEntry);
          return;
        }
        
        if (response && response.logs) {
          this.renderLogs(response.logs);
        } else {
          console.warn('PopupManager: Received empty logs response');
          // Show a warning in the UI
          const warningLogEntry = document.createElement('div');
          warningLogEntry.className = 'log-entry warn';
          warningLogEntry.textContent = '[Warning] No logs received from background script';
          this.logContainer.appendChild(warningLogEntry);
        }
      });
    } catch (error) {
      console.error('PopupManager: Exception loading logs:', error);
      // Show the error in the UI
      const errorLogEntry = document.createElement('div');
      errorLogEntry.className = 'log-entry error';
      errorLogEntry.textContent = `[Error] ${error}`;
      this.logContainer.appendChild(errorLogEntry);
    }
  }
  
  /**
   * Clears logs in the background script
   */
  private clearLogs(): void {
    console.log("PopupManager: Clearing logs");
    
    chrome.runtime.sendMessage({ action: 'clearLogs' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error clearing logs:', chrome.runtime.lastError);
        return;
      }
      
      // Clear the log container
      this.logContainer.innerHTML = '';
    });
  }
  
  /**
   * Renders logs in the UI
   * @param logs The logs to render
   */
  private renderLogs(logs: string[]): void {
    console.log(`PopupManager: Rendering ${logs.length} logs`);
    
    // Clear existing logs
    this.logContainer.innerHTML = '';
    
    if (logs.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'log-entry';
      emptyMessage.textContent = 'No logs available.';
      this.logContainer.appendChild(emptyMessage);
      return;
    }
    
    // Add each log entry
    logs.forEach((log) => {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      
      // Apply styling based on log level
      if (log.includes('error')) {
        logEntry.classList.add('error');
      } else if (log.includes('warn')) {
        logEntry.classList.add('warn');
      }
      
      logEntry.textContent = log;
      this.logContainer.appendChild(logEntry);
    });
    
    // Scroll to the most recent log
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }
  
  /**
   * Loads the auto-pattern setting from the background script
   */
  private loadAutoPatternSetting(): void {
    console.log("PopupManager: Loading auto-pattern setting");
    
    chrome.runtime.sendMessage({ action: 'getAutoPatterns' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error getting auto-pattern setting:', chrome.runtime.lastError);
        return;
      }
      
      console.log("PopupManager: Auto-patterns enabled:", response?.enabled);
      this.autoPatternToggle.checked = response?.enabled || false;
    });
  }
  
  /**
   * Loads auto-pattern templates from the background script
   */
  private loadAutoPatternTemplates(): void {
    console.log("PopupManager: Loading auto-pattern templates");
    
    chrome.runtime.sendMessage({ action: 'getAutoPatternTemplates' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error getting auto-pattern templates:', chrome.runtime.lastError);
        return;
      }
      
      console.log("PopupManager: Received templates:", response?.templates);
      
      if (Array.isArray(response?.templates)) {
        this.autoPatterns = response.templates;
        this.renderAutoPatterns();
      } else {
        console.error('PopupManager: Invalid templates response:', response);
      }
    });
  }
  
  /**
   * Adds a new auto-pattern template
   */
  private addAutoPattern(): void {
    const template = this.autoPatternTemplateInput.value.trim();
    console.log(`PopupManager: Adding auto-pattern template: ${template}`);
    
    // Log the action in the UI directly
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${new Date().toISOString()}] Attempting to add auto-pattern: ${template}`;
    this.logContainer.appendChild(logEntry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    
    if (!template) {
      alert('Please enter a pattern template.');
      return;
    }
    
    if (!template.includes(':name')) {
      alert('Pattern must include a :name placeholder.');
      return;
    }
    
    // Send to background script with short timeout
    const addPatternPromise = new Promise<boolean>((resolve) => {
      try {
        chrome.runtime.sendMessage({
          action: 'addAutoPattern',
          template
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('PopupManager: Error adding auto-pattern:', chrome.runtime.lastError);
            
            // Log the error in the UI
            const errorLogEntry = document.createElement('div');
            errorLogEntry.className = 'log-entry error';
            errorLogEntry.textContent = `[Error] Failed to add auto-pattern: ${chrome.runtime.lastError.message || 'Unknown error'}`;
            this.logContainer.appendChild(errorLogEntry);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
            
            resolve(false);
            return;
          }
          
          console.log("PopupManager: Add auto-pattern response:", response);
          
          // Log the response in the UI
          const responseLogEntry = document.createElement('div');
          responseLogEntry.className = 'log-entry';
          responseLogEntry.textContent = `[Response] Add auto-pattern: ${JSON.stringify(response)}`;
          this.logContainer.appendChild(responseLogEntry);
          this.logContainer.scrollTop = this.logContainer.scrollHeight;
          
          resolve(response?.success === true);
        });
      } catch (error) {
        console.error('PopupManager: Exception sending message:', error);
        
        // Log the exception in the UI
        const errorLogEntry = document.createElement('div');
        errorLogEntry.className = 'log-entry error';
        errorLogEntry.textContent = `[Exception] ${error}`;
        this.logContainer.appendChild(errorLogEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        resolve(false);
      }
      
      // Set a timeout in case the response never comes
      setTimeout(() => {
        console.warn('PopupManager: Timeout waiting for addAutoPattern response');
        
        // Log the timeout in the UI
        const timeoutLogEntry = document.createElement('div');
        timeoutLogEntry.className = 'log-entry warn';
        timeoutLogEntry.textContent = '[Timeout] No response received from background script';
        this.logContainer.appendChild(timeoutLogEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        resolve(false);
      }, 2000); // Increased timeout to 2 seconds
    });
    
    // Handle the result
    addPatternPromise.then((success) => {
      if (success) {
        // Clear input field
        this.autoPatternTemplateInput.value = '';
        
        // Reload templates
        this.loadAutoPatternTemplates();
        
        // Log success in the UI
        const successLogEntry = document.createElement('div');
        successLogEntry.className = 'log-entry';
        successLogEntry.textContent = `[Success] Added auto-pattern: ${template}`;
        this.logContainer.appendChild(successLogEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
      } else {
        alert('Error adding pattern. Check the logs for details.');
        
        // Force a refresh of logs
        setTimeout(() => this.loadLogs(), 500);
      }
    });
  }
  
  /**
   * Removes an auto-pattern template
   * @param template The template to remove
   */
  private removeAutoPattern(template: string): void {
    console.log(`PopupManager: Removing auto-pattern template: ${template}`);
    
    // Send to background script with short timeout
    const removePatternPromise = new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage({
        action: 'removeAutoPattern',
        template
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('PopupManager: Error removing auto-pattern:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        console.log("PopupManager: Remove auto-pattern response:", response);
        resolve(response?.success === true);
      });
      
      // Set a timeout in case the response never comes
      setTimeout(() => resolve(false), 1000);
    });
    
    // Handle the result
    removePatternPromise.then((success) => {
      if (success) {
        // Reload templates
        this.loadAutoPatternTemplates();
      } else {
        alert('Error removing pattern. Please check the console for details.');
      }
    });
  }
  
  /**
   * Renders the auto-pattern template list
   */
  private renderAutoPatterns(): void {
    console.log(`PopupManager: Rendering ${this.autoPatterns.length} auto-patterns`);
    
    this.autoPatternList.innerHTML = '';
    
    if (this.autoPatterns.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'pattern-item';
      emptyMessage.textContent = 'No auto-patterns defined.';
      this.autoPatternList.appendChild(emptyMessage);
      return;
    }
    
    this.autoPatterns.forEach((template) => {
      const patternItem = document.createElement('div');
      patternItem.className = 'pattern-item';
      
      const patternInfo = document.createElement('div');
      patternInfo.className = 'pattern-info';
      patternInfo.textContent = template;
      
      const patternActions = document.createElement('div');
      patternActions.className = 'pattern-actions';
      
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        this.removeAutoPattern(template);
      });
      
      patternActions.appendChild(removeButton);
      patternItem.appendChild(patternInfo);
      patternItem.appendChild(patternActions);
      
      this.autoPatternList.appendChild(patternItem);
    });
  }
  
  /**
   * Toggles the auto-pattern feature
   */
  private toggleAutoPatterns(): void {
    const enabled = this.autoPatternToggle.checked;
    console.log(`PopupManager: Toggling auto-patterns to ${enabled}`);
    
    // Send to background script with short timeout
    const togglePromise = new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'setAutoPatterns',
        enabled
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('PopupManager: Error setting auto-pattern:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        console.log("PopupManager: Set auto-patterns response:", response);
        resolve(response?.success === true);
      });
      
      // Set a timeout in case the response never comes
      setTimeout(() => resolve(false), 1000);
    });
    
    // Handle the result
    togglePromise.then((success) => {
      if (!success) {
        // Reset toggle to previous state on error
        this.loadAutoPatternSetting();
      }
    });
  }
  
  /**
   * Adds a new pattern based on user input
   */
  private addPattern(): void {
    const patternStr = this.patternInput.value.trim();
    const groupName = this.groupNameInput.value.trim();
    const color = this.colorSelect.value as chrome.tabGroups.ColorEnum;
    
    console.log(`PopupManager: Adding manual pattern: ${patternStr} -> ${groupName} (${color})`);
    
    if (!patternStr || !groupName) {
      alert('Please enter both a pattern and a group name.');
      return;
    }
    
    try {
      // Test if the pattern is valid
      new RegExp(patternStr);
      
      // Add to list
      const pattern: StoredPattern = {
        patternStr,
        groupName,
        color
      };
      
      // Send to background script with short timeout
      const addPatternPromise = new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'addPattern',
          pattern: patternStr,
          groupName,
          color
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('PopupManager: Error sending message:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          console.log("PopupManager: Add pattern response:", response);
          resolve(response?.success === true);
        });
        
        // Set a timeout in case the response never comes
        setTimeout(() => resolve(false), 1000);
      });
      
      // Handle the result
      addPatternPromise.then((success) => {
        if (success) {
          // Save to storage and update UI
          this.patterns.push(pattern);
          this.savePatterns();
          this.renderPatterns();
          
          // Clear input fields
          this.patternInput.value = '';
          this.groupNameInput.value = '';
        } else {
          alert('Error adding pattern. Please check the console for details.');
        }
      });
    } catch (error) {
      console.error('PopupManager: Invalid regex:', error);
      alert('Invalid regular expression pattern: ' + error);
    }
  }
  
  /**
   * Loads saved patterns from Chrome storage
   */
  private loadPatterns(): void {
    console.log("PopupManager: Loading manual patterns from storage");
    
    chrome.storage.local.get(['domainPatterns'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error loading patterns:', chrome.runtime.lastError);
        return;
      }
      
      if (result.domainPatterns) {
        console.log(`PopupManager: Loaded ${result.domainPatterns.length} manual patterns`);
        this.patterns = result.domainPatterns;
        this.renderPatterns();
      }
    });
  }
  
  /**
   * Saves patterns to Chrome storage
   */
  private savePatterns(): void {
    console.log("PopupManager: Saving manual patterns to storage");
    
    chrome.storage.local.set({ domainPatterns: this.patterns }, () => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error saving patterns:', chrome.runtime.lastError);
      } else {
        console.log('PopupManager: Patterns saved successfully');
      }
    });
  }
  
  /**
   * Removes a pattern by index
   * @param index The index of the pattern to remove
   */
  private removePattern(index: number): void {
    console.log(`PopupManager: Removing manual pattern at index ${index}`);
    
    this.patterns.splice(index, 1);
    this.savePatterns();
    this.renderPatterns();
    
    // Send message to background script to refresh patterns
    chrome.runtime.sendMessage({
      action: 'refreshPatterns'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('PopupManager: Error refreshing patterns:', chrome.runtime.lastError);
      } else {
        console.log('PopupManager: Patterns refreshed successfully');
      }
    });
  }
  
  /**
   * Renders the pattern list in the UI
   */
  private renderPatterns(): void {
    console.log(`PopupManager: Rendering ${this.patterns.length} manual patterns`);
    
    this.patternList.innerHTML = '';
    
    if (this.patterns.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'pattern-item';
      emptyMessage.textContent = 'No patterns defined.';
      this.patternList.appendChild(emptyMessage);
      return;
    }
    
    this.patterns.forEach((pattern, index) => {
      const patternItem = document.createElement('div');
      patternItem.className = 'pattern-item';
      
      const patternInfo = document.createElement('div');
      patternInfo.className = 'pattern-info';
      
      const colorPreview = document.createElement('span');
      colorPreview.className = 'color-preview';
      colorPreview.style.backgroundColor = pattern.color || 'grey';
      
      patternInfo.appendChild(colorPreview);
      patternInfo.appendChild(document.createTextNode(
        `${pattern.groupName}: /${pattern.patternStr}/`
      ));
      
      const patternActions = document.createElement('div');
      patternActions.className = 'pattern-actions';
      
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        this.removePattern(index);
      });
      
      patternActions.appendChild(removeButton);
      patternItem.appendChild(patternInfo);
      patternItem.appendChild(patternActions);
      
      this.patternList.appendChild(patternItem);
    });
  }
  
  /**
   * Groups existing tabs using the defined patterns
   */
  private groupExistingTabs(): void {
    console.log("PopupManager: Grouping existing tabs");
    
    // Log the action in the UI directly
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${new Date().toISOString()}] Grouping existing tabs...`;
    this.logContainer.appendChild(logEntry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    
    // Disable the button while processing
    this.groupExistingTabsButton.disabled = true;
    this.groupExistingTabsButton.textContent = 'Processing...';
    
    // Send to background script with short timeout
    const groupPromise = new Promise<boolean>((resolve) => {
      try {
        chrome.runtime.sendMessage({
          action: 'groupExistingTabs'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('PopupManager: Error grouping tabs:', chrome.runtime.lastError);
            
            // Log the error in the UI
            const errorLogEntry = document.createElement('div');
            errorLogEntry.className = 'log-entry error';
            errorLogEntry.textContent = `[Error] Failed to group tabs: ${chrome.runtime.lastError.message || 'Unknown error'}`;
            this.logContainer.appendChild(errorLogEntry);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
            
            resolve(false);
            return;
          }
          
          console.log("PopupManager: Group existing tabs response:", response);
          
          // Log the response in the UI
          const responseLogEntry = document.createElement('div');
          responseLogEntry.className = 'log-entry';
          if (response && response.success) {
            responseLogEntry.textContent = `[Success] Grouped ${response.count || 0} tabs`;
          } else {
            responseLogEntry.className += ' warn';
            responseLogEntry.textContent = `[Warning] No tabs were grouped`;
          }
          this.logContainer.appendChild(responseLogEntry);
          this.logContainer.scrollTop = this.logContainer.scrollHeight;
          
          resolve(true);
        });
      } catch (error) {
        console.error('PopupManager: Exception sending message:', error);
        
        // Log the exception in the UI
        const errorLogEntry = document.createElement('div');
        errorLogEntry.className = 'log-entry error';
        errorLogEntry.textContent = `[Exception] ${error}`;
        this.logContainer.appendChild(errorLogEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        resolve(false);
      }
      
      // Set a timeout in case the response never comes
      setTimeout(() => {
        console.warn('PopupManager: Timeout waiting for groupExistingTabs response');
        
        // Log the timeout in the UI
        const timeoutLogEntry = document.createElement('div');
        timeoutLogEntry.className = 'log-entry warn';
        timeoutLogEntry.textContent = '[Timeout] No response received from background script';
        this.logContainer.appendChild(timeoutLogEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        resolve(false);
      }, 5000); // 5 second timeout for this operation as it can take longer
    });
    
    // Handle the result and re-enable the button
    groupPromise.then(() => {
      // Re-enable the button
      this.groupExistingTabsButton.disabled = false;
      this.groupExistingTabsButton.textContent = 'Group Existing Tabs';
      
      // Force a refresh of logs
      setTimeout(() => this.loadLogs(), 500);
    });
  }
}

// Initialize the popup manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("PopupManager: DOM loaded, initializing popup");
  new PopupManager();
}); 