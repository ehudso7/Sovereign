// ---------------------------------------------------------------------------
// Connector and skill catalog definitions
// ---------------------------------------------------------------------------

export interface CatalogConnector {
  slug: string;
  name: string;
  description: string;
  category: string;
  trustTier: string;
  authMode: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  scopes: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface CatalogSkill {
  slug: string;
  name: string;
  description: string;
  trustTier: string;
  connectorSlugs: string[];
}

export const BUILTIN_CONNECTORS: CatalogConnector[] = [
  {
    slug: "echo",
    name: "Echo & Utilities",
    description: "A simple utility connector for testing. Echoes messages and provides the current time. No authentication required.",
    category: "utility",
    trustTier: "verified",
    authMode: "none",
    tools: [
      {
        name: "echo",
        description: "Echoes back the input message along with metadata (reversed text, length).",
        parameters: { type: "object", properties: { message: { type: "string", description: "Message to echo" } }, required: ["message"] },
      },
      {
        name: "current_time",
        description: "Returns the current UTC time and unix timestamp.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    ],
    scopes: [
      { id: "echo:read", name: "Echo Read", description: "Echo messages and read time" },
    ],
  },
  {
    slug: "weather",
    name: "Weather Service",
    description: "Get current weather and forecasts for any location. Requires an API key for authentication.",
    category: "data",
    trustTier: "verified",
    authMode: "api_key",
    tools: [
      {
        name: "get_weather",
        description: "Get current weather conditions for a location.",
        parameters: { type: "object", properties: { location: { type: "string", description: "City or location name" } }, required: ["location"] },
      },
      {
        name: "get_forecast",
        description: "Get weather forecast for a location.",
        parameters: { type: "object", properties: { location: { type: "string", description: "City or location name" }, days: { type: "number", description: "Number of forecast days (1-7)" } }, required: ["location"] },
      },
    ],
    scopes: [
      { id: "weather:current", name: "Current Weather", description: "Read current weather data" },
      { id: "weather:forecast", name: "Forecast", description: "Read weather forecasts" },
    ],
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Send messages, manage channels, and interact with Slack workspaces. Enables agents to communicate with teams in real time.",
    category: "communication",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "send_message", description: "Send a message to a Slack channel or user.", parameters: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] } },
      { name: "list_channels", description: "List all channels in the workspace.", parameters: { type: "object", properties: {}, required: [] } },
      { name: "search_messages", description: "Search for messages matching a query.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    ],
    scopes: [
      { id: "slack:read", name: "Read", description: "Read messages and channels" },
      { id: "slack:write", name: "Write", description: "Send messages and manage channels" },
    ],
  },
  {
    slug: "github",
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and code reviews. Automate development workflows with GitHub integration.",
    category: "development",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "list_repos", description: "List repositories for the authenticated user or organization.", parameters: { type: "object", properties: { org: { type: "string", description: "Organization name (optional)" } }, required: [] } },
      { name: "create_issue", description: "Create a new issue in a repository.", parameters: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["repo", "title"] } },
      { name: "list_pull_requests", description: "List open pull requests in a repository.", parameters: { type: "object", properties: { repo: { type: "string" }, state: { type: "string" } }, required: ["repo"] } },
      { name: "search_code", description: "Search for code across repositories.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    ],
    scopes: [
      { id: "github:repos", name: "Repositories", description: "Read and manage repositories" },
      { id: "github:issues", name: "Issues", description: "Create and manage issues" },
      { id: "github:pulls", name: "Pull Requests", description: "Manage pull requests and reviews" },
    ],
  },
  {
    slug: "google-drive",
    name: "Google Drive",
    description: "Search, read, and manage files in Google Drive. Enable agents to work with documents, spreadsheets, and presentations.",
    category: "productivity",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "search_files", description: "Search for files in Google Drive.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
      { name: "read_file", description: "Read the contents of a file.", parameters: { type: "object", properties: { fileId: { type: "string" } }, required: ["fileId"] } },
      { name: "create_file", description: "Create a new file in Google Drive.", parameters: { type: "object", properties: { name: { type: "string" }, content: { type: "string" }, mimeType: { type: "string" } }, required: ["name", "content"] } },
    ],
    scopes: [
      { id: "drive:read", name: "Read", description: "Read files and metadata" },
      { id: "drive:write", name: "Write", description: "Create and modify files" },
    ],
  },
  {
    slug: "gmail",
    name: "Gmail",
    description: "Read, send, and manage emails. Automate email workflows, draft responses, and organize inboxes.",
    category: "communication",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "search_emails", description: "Search emails matching a query.", parameters: { type: "object", properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"] } },
      { name: "send_email", description: "Send an email.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
      { name: "read_email", description: "Read a specific email by ID.", parameters: { type: "object", properties: { messageId: { type: "string" } }, required: ["messageId"] } },
      { name: "create_draft", description: "Create an email draft.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
    ],
    scopes: [
      { id: "gmail:read", name: "Read", description: "Read emails and labels" },
      { id: "gmail:send", name: "Send", description: "Send emails and create drafts" },
    ],
  },
  {
    slug: "hubspot",
    name: "HubSpot CRM",
    description: "Manage contacts, deals, companies, and pipelines in HubSpot. Automate CRM workflows and track customer interactions.",
    category: "crm",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "search_contacts", description: "Search for contacts by name, email, or company.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
      { name: "create_contact", description: "Create a new contact.", parameters: { type: "object", properties: { email: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } }, required: ["email"] } },
      { name: "list_deals", description: "List deals in the pipeline.", parameters: { type: "object", properties: { stage: { type: "string" } }, required: [] } },
      { name: "update_deal", description: "Update a deal's stage or properties.", parameters: { type: "object", properties: { dealId: { type: "string" }, stage: { type: "string" }, amount: { type: "number" } }, required: ["dealId"] } },
    ],
    scopes: [
      { id: "hubspot:contacts", name: "Contacts", description: "Read and manage contacts" },
      { id: "hubspot:deals", name: "Deals", description: "Read and manage deals" },
    ],
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    description: "Access Salesforce CRM data including accounts, contacts, opportunities, and custom objects. Enterprise-grade CRM integration.",
    category: "crm",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "query", description: "Execute a SOQL query against Salesforce.", parameters: { type: "object", properties: { soql: { type: "string" } }, required: ["soql"] } },
      { name: "get_record", description: "Get a specific Salesforce record.", parameters: { type: "object", properties: { objectType: { type: "string" }, recordId: { type: "string" } }, required: ["objectType", "recordId"] } },
      { name: "create_record", description: "Create a new Salesforce record.", parameters: { type: "object", properties: { objectType: { type: "string" }, fields: { type: "object" } }, required: ["objectType", "fields"] } },
    ],
    scopes: [
      { id: "salesforce:read", name: "Read", description: "Read Salesforce data" },
      { id: "salesforce:write", name: "Write", description: "Create and modify records" },
    ],
  },
  {
    slug: "jira",
    name: "Jira",
    description: "Create and manage Jira issues, track sprints, and automate project management workflows across teams.",
    category: "project-management",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "search_issues", description: "Search Jira issues using JQL.", parameters: { type: "object", properties: { jql: { type: "string" }, maxResults: { type: "number" } }, required: ["jql"] } },
      { name: "create_issue", description: "Create a new Jira issue.", parameters: { type: "object", properties: { project: { type: "string" }, summary: { type: "string" }, description: { type: "string" }, issueType: { type: "string" } }, required: ["project", "summary", "issueType"] } },
      { name: "update_issue", description: "Update an existing Jira issue.", parameters: { type: "object", properties: { issueKey: { type: "string" }, fields: { type: "object" } }, required: ["issueKey"] } },
    ],
    scopes: [
      { id: "jira:read", name: "Read", description: "Read issues and projects" },
      { id: "jira:write", name: "Write", description: "Create and update issues" },
    ],
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Read and write Notion pages, databases, and blocks. Build agents that manage knowledge bases and documentation.",
    category: "productivity",
    trustTier: "verified",
    authMode: "oauth2",
    tools: [
      { name: "search", description: "Search across Notion pages and databases.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
      { name: "read_page", description: "Read the content of a Notion page.", parameters: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] } },
      { name: "create_page", description: "Create a new Notion page.", parameters: { type: "object", properties: { parentId: { type: "string" }, title: { type: "string" }, content: { type: "string" } }, required: ["parentId", "title"] } },
      { name: "query_database", description: "Query a Notion database with filters.", parameters: { type: "object", properties: { databaseId: { type: "string" }, filter: { type: "object" } }, required: ["databaseId"] } },
    ],
    scopes: [
      { id: "notion:read", name: "Read", description: "Read pages, databases, and blocks" },
      { id: "notion:write", name: "Write", description: "Create and update content" },
    ],
  },
  {
    slug: "web-search",
    name: "Web Search",
    description: "Search the web using multiple search engines. Get real-time information, news, and web content for research tasks.",
    category: "data",
    trustTier: "verified",
    authMode: "api_key",
    tools: [
      { name: "search", description: "Perform a web search query.", parameters: { type: "object", properties: { query: { type: "string" }, numResults: { type: "number" } }, required: ["query"] } },
      { name: "fetch_page", description: "Fetch and extract text content from a URL.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
    ],
    scopes: [
      { id: "search:read", name: "Search", description: "Perform web searches" },
      { id: "search:fetch", name: "Fetch", description: "Fetch web page content" },
    ],
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases. Run SELECT queries, insert records, and analyze data directly from agents.",
    category: "database",
    trustTier: "verified",
    authMode: "connection_string",
    tools: [
      { name: "query", description: "Execute a read-only SQL query.", parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
      { name: "list_tables", description: "List all tables in the database.", parameters: { type: "object", properties: {}, required: [] } },
      { name: "describe_table", description: "Get column details for a table.", parameters: { type: "object", properties: { table: { type: "string" } }, required: ["table"] } },
    ],
    scopes: [
      { id: "pg:read", name: "Read", description: "Execute read-only queries" },
      { id: "pg:schema", name: "Schema", description: "Read database schema information" },
    ],
  },
];

export const BUILTIN_SKILLS: CatalogSkill[] = [
  {
    slug: "research-assistant",
    name: "Research Assistant",
    description: "A skill that packages echo and weather tools for research tasks. Demonstrates how skills bundle connector capabilities.",
    trustTier: "verified",
    connectorSlugs: ["echo", "weather"],
  },
  {
    slug: "customer-support",
    name: "Customer Support",
    description: "Handle customer inquiries using CRM data, email, and knowledge base. Automatically drafts responses and escalates complex issues.",
    trustTier: "verified",
    connectorSlugs: ["hubspot", "gmail", "notion"],
  },
  {
    slug: "sales-intelligence",
    name: "Sales Intelligence",
    description: "Enrich leads, track deal progress, and generate outreach. Combines CRM data with web research for comprehensive sales insights.",
    trustTier: "verified",
    connectorSlugs: ["salesforce", "web-search", "gmail"],
  },
  {
    slug: "devops-assistant",
    name: "DevOps Assistant",
    description: "Monitor repositories, manage issues, and automate development workflows. Tracks PRs, deployments, and sprint progress.",
    trustTier: "verified",
    connectorSlugs: ["github", "jira", "slack"],
  },
  {
    slug: "knowledge-manager",
    name: "Knowledge Manager",
    description: "Organize and maintain team knowledge bases. Syncs documentation across Notion, Google Drive, and internal wikis.",
    trustTier: "verified",
    connectorSlugs: ["notion", "google-drive", "web-search"],
  },
  {
    slug: "data-analyst",
    name: "Data Analyst",
    description: "Query databases, analyze data, and generate reports. Combines SQL queries with web research for comprehensive analysis.",
    trustTier: "verified",
    connectorSlugs: ["postgresql", "web-search", "google-drive"],
  },
];
