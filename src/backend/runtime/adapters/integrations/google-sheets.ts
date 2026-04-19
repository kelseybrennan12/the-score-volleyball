export interface SheetsFetcher {
  fetchXlsx(sheetId: string): Promise<Buffer>;
}

export function createSheetsFetcher(): SheetsFetcher {
  return {
    async fetchXlsx(sheetId: string): Promise<Buffer> {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`XLSX export failed for ${sheetId}: HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    },
  };
}
