/**
 * DESKTOP FILE SAVE WRAPPER
 * 
 * Provides a unified save interface that:
 * - When running inside Tauri: opens a native Save dialog and writes via Tauri FS
 * - When running in a browser: falls back to the existing anchor-click download mechanism
 * 
 * This wrapper ensures the existing export engine remains untouched —
 * only the final file delivery mechanism is adapted for desktop.
 */

/**
 * Detects whether the application is running inside a Tauri desktop shell.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Opens a project file using the native OS dialog in Tauri, or returns null if cancelled/unsupported.
 */
export async function openProjectDialog(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readFile } = await import('@tauri-apps/plugin-fs');

      const selected = await open({
        multiple: false,
        filters: [
          { name: 'StickerCut Project', extensions: ['stickerproj', 'json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Open StickerCut Project',
      });

      if (selected && typeof selected === 'string') {
        const bytes = await readFile(selected);
        return new TextDecoder().decode(bytes);
      }
    } catch (err) {
      console.warn('Native open dialog failed:', err);
    }
  }
  return null;
}

/**
 * Save a file using the best available mechanism.
 * 
 * In Tauri: opens a native OS Save dialog → writes the file to the chosen path.
 * In Browser: creates a temporary <a> element and triggers a download.
 */
export async function saveFile(
  blobOrString: Blob | string,
  suggestedFilename: string,
  mimeType: string
): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await saveViaTauri(blobOrString, suggestedFilename, mimeType);
      return;
    } catch (err) {
      console.warn('Tauri save failed, falling back to browser download:', err);
      // Fall through to browser mechanism
    }
  }

  // Browser fallback (also works in Tauri webview as last resort)
  downloadViaBrowser(blobOrString, suggestedFilename, mimeType);
}

/**
 * Native Tauri save: dialog → filesystem write
 */
async function saveViaTauri(
  blobOrString: Blob | string,
  suggestedFilename: string,
  mimeType: string
): Promise<void> {
  // Dynamic imports to avoid bundling errors when running in browser
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  // Determine file extension filters
  const ext = suggestedFilename.split('.').pop()?.toLowerCase() || '';
  const filterMap: Record<string, { name: string; extensions: string[] }> = {
    pdf: { name: 'PDF Document', extensions: ['pdf'] },
    svg: { name: 'SVG Vector', extensions: ['svg'] },
    json: { name: 'JSON File', extensions: ['json'] },
    stickerproj: { name: 'StickerCut Project', extensions: ['stickerproj'] },
  };

  const filters = filterMap[ext]
    ? [filterMap[ext]]
    : [{ name: 'All Files', extensions: ['*'] }];

  const filePath = await save({
    defaultPath: suggestedFilename,
    filters,
    title: 'Save Production File',
  });

  if (!filePath) {
    // User cancelled the dialog
    return;
  }

  // Convert content to Uint8Array for Tauri FS
  let bytes: Uint8Array;
  if (typeof blobOrString === 'string') {
    const encoder = new TextEncoder();
    bytes = encoder.encode(blobOrString);
  } else {
    const arrayBuffer = await blobOrString.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);
  }

  await writeFile(filePath, bytes);
}

/**
 * Browser download via temporary anchor element (existing mechanism).
 * This is the same logic as the original downloadFile() in exportEngine.ts.
 */
function downloadViaBrowser(
  blobOrString: Blob | string,
  filename: string,
  mimeType: string
): void {
  const blob =
    typeof blobOrString === 'string'
      ? new Blob([blobOrString], { type: mimeType })
      : blobOrString;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
