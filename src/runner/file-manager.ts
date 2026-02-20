import fs from 'node:fs';

export class FileManager {
  private backups = new Map<string, string>();

  backup(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.backups.set(filePath, content);
  }

  applyMutation(filePath: string, mutatedContent: string): void {
    if (!this.backups.has(filePath)) {
      throw new Error(`No backup exists for ${filePath}. Call backup() first.`);
    }
    fs.writeFileSync(filePath, mutatedContent, 'utf-8');
  }

  restore(filePath: string): void {
    const original = this.backups.get(filePath);
    if (original === undefined) {
      throw new Error(`No backup exists for ${filePath}`);
    }
    fs.writeFileSync(filePath, original, 'utf-8');
  }

  restoreAll(): void {
    for (const [filePath, content] of this.backups) {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch {
        // Best-effort restore
      }
    }
    this.backups.clear();
  }
}
