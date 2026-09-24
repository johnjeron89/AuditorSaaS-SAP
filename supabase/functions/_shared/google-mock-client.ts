import { GoogleApiClient } from './google-auth.ts';
import cleanFixture from './fixtures/google-clean.json' with { type: 'json' };
import messyFixture from './fixtures/google-messy.json' with { type: 'json' };

export type MockVariant = 'clean' | 'messy';

export class GoogleMockApiClient extends GoogleApiClient {
  private variant: MockVariant;
  private fixtureData: Record<string, any>;

  constructor(variant: MockVariant = 'clean') {
    // Pass empty credentials since we override fetch and fetchPaginated
    super({ client_email: '', private_key: '' }, '');
    this.variant = variant;
    this.fixtureData = variant === 'messy' ? messyFixture : cleanFixture;
  }

  async fetch(url: string, params?: Record<string, string>): Promise<any> {
    const urlObj = new URL(url);
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

    // 1. Direct exact match by origin + pathname
    if (this.fixtureData[cleanUrl]) {
      return JSON.parse(JSON.stringify(this.fixtureData[cleanUrl]));
    }

    // 2. Partial match on common path patterns
    for (const [key, value] of Object.entries(this.fixtureData)) {
      if (cleanUrl.endsWith(key) || key.endsWith(urlObj.pathname)) {
        return JSON.parse(JSON.stringify(value));
      }
    }

    // Fallback: match by known endpoints
    if (urlObj.pathname.includes('/users')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/directory/v1/users'] || { users: [] }));
    }
    if (urlObj.pathname.includes('/drive')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/drive'] || { items: [] }));
    }
    if (urlObj.pathname.includes('/admin')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/admin'] || { items: [] }));
    }
    if (urlObj.pathname.includes('/token')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/token'] || { items: [] }));
    }
    if (urlObj.pathname.includes('/login')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/login'] || { items: [] }));
    }
    if (urlObj.pathname.includes('/mobile')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/directory/v1/customer/my_customer/devices/mobile'] || { result: [] }));
    }

    return { items: [], users: [] };
  }

  async fetchPaginated(url: string, params: Record<string, string>, pageToken?: string): Promise<any> {
    // For fixtures, return full dataset without pagination (nextPageToken undefined)
    return this.fetch(url, params);
  }
}
