import cleanFixture from './fixtures/microsoft-clean.json' with { type: 'json' };
import messyFixture from './fixtures/microsoft-messy.json' with { type: 'json' };

export type MockVariant = 'clean' | 'messy';

export class MicrosoftMockApiClient {
  private variant: MockVariant;
  private fixtureData: Record<string, any>;

  constructor(variant: MockVariant = 'clean') {
    this.variant = variant;
    this.fixtureData = variant === 'messy' ? messyFixture : cleanFixture;
  }

  async fetch(url: string, params?: Record<string, string>): Promise<any> {
    const urlObj = new URL(url);
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

    if (this.fixtureData[cleanUrl]) {
      return JSON.parse(JSON.stringify(this.fixtureData[cleanUrl]));
    }

    for (const [key, value] of Object.entries(this.fixtureData)) {
      if (cleanUrl.endsWith(key) || key.endsWith(urlObj.pathname)) {
        return JSON.parse(JSON.stringify(value));
      }
    }

    return { value: [] };
  }
}
