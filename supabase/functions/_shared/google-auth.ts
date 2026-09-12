import { JWT } from "npm:google-auth-library@9";

export class GoogleApiClient {
  private client: JWT;

  constructor(serviceAccountJson: any, adminEmail: string) {
    this.client = new JWT({
      email: serviceAccountJson.client_email,
      key: serviceAccountJson.private_key,
      subject: adminEmail,
      scopes: [
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/admin.directory.user.security",
        "https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly",
        "https://www.googleapis.com/auth/admin.directory.group.readonly",
        "https://www.googleapis.com/auth/apps.groups.settings",
        "https://www.googleapis.com/auth/admin.directory.device.mobile.readonly",
        "https://www.googleapis.com/auth/admin.directory.domain.readonly",
        "https://www.googleapis.com/auth/admin.reports.audit.readonly",
        "https://www.googleapis.com/auth/admin.reports.usage.readonly",
        "https://www.googleapis.com/auth/apps.alerts",
      ],
    });
  }

  async fetch(url: string, params?: Record<string, string>): Promise<any> {
    try {
      const urlObj = new URL(url);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          urlObj.searchParams.append(key, value);
        });
      }
      
      const res = await this.client.request({
        url: urlObj.toString(),
        method: "GET",
      });
      return res.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  async fetchPaginated(url: string, params: Record<string, string>, pageToken?: string): Promise<any> {
    const fetchParams = { ...params };
    if (pageToken) {
      fetchParams.pageToken = pageToken;
    }
    return this.fetch(url, fetchParams);
  }
}
