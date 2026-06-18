/**
 * Parse prefix and group keys into folders and objects
 * Simulates folder structure based on '/' delimiter
 */
export function parsePrefixFolders(
  keys: string[],
  prefix: string
): { folders: string[]; objects: string[] } {
  const folders = new Set<string>();
  const objects: string[] = [];

  // Normalize prefix (ensure it doesn't start with /)
  const normalizedPrefix = prefix.replace(/^\/+/, '');
  const prefixDepth = normalizedPrefix ? normalizedPrefix.split('/').length : 0;

  keys.forEach(key => {
    // Skip keys that don't match prefix
    if (normalizedPrefix && !key.startsWith(normalizedPrefix)) {
      return;
    }

    // Get the part after the prefix
    const relativePath = normalizedPrefix
      ? key.substring(normalizedPrefix.length)
      : key;

    // Split by '/' to check depth
    const parts = relativePath.split('/').filter(p => p.length > 0);

    if (parts.length === 0) {
      // This is a file at the exact prefix level
      objects.push(key);
    } else if (parts.length === 1) {
      // This is a file directly under this prefix
      objects.push(key);
    } else {
      // This is a nested path - extract the folder
      const folderName = normalizedPrefix + parts[0] + '/';
      folders.add(folderName);
    }
  });

  return {
    folders: Array.from(folders).sort(),
    objects: objects.sort(),
  };
}

/**
 * Extract common prefixes (folders) from object keys
 */
export function extractCommonPrefixes(keys: string[], delimiter: string = '/'): string[] {
  const prefixes = new Set<string>();

  keys.forEach(key => {
    const delimiterIndex = key.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      const prefix = key.substring(0, delimiterIndex + 1);
      prefixes.add(prefix);
    }
  });

  return Array.from(prefixes).sort();
}
