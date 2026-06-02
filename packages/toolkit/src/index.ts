// Config
export { loadConfig } from "./config.js";
export type { Config } from "./config.js";

// Types
export type {
  DomainOwner, Domain, Mailbox, MailboxDetails,
  ToolResult, ToolAnnotations, ToolDefinition,
} from "./types.js";

// Mailpool API
export { listMailboxes, getMailboxById, getMailboxByEmail } from "./mailpool.js";

// IMAP
export {
  normalizeSubject, extractEmail,
  listAllThreads, filterByTagExpression,
  findSentFolder, resolveFolder, listFolders,
  fetchEmails, fetchSentEmails, appendToSent,
  setEmailFlag, removeEmailFlag, countByKeyword,
  addAudienceSegments, removeAudienceSegments,
  removeContactMarkerSegments, listAudienceSegments,
  upsertContactMarker, listContactMarkers,
  getContactMetadataByEmails, listAudienceSegmentsWithContacts,
  fetchUnclassifiedEmails,
  fetchEmailByUid, fetchEmailRawByUid, deleteEmail, getEmailHeaders,
  fetchDrafts, saveDraft, deleteDraft, fetchAttachmentByUid,
  findDraftsFolder, resolveDraftsFolder,
  saveCampaignConfig, loadCampaignConfig, listCampaignConfigs, deleteCampaignConfig,
} from "./imap.js";
export type {
  ThreadMessage, ThreadSummary, ListAllThreadsResult,
  EmailMessage, EmailAttachmentMeta, EmailDetail,
  EmailHeaders, EmailPage, AudienceSegment, ContactMetadata,
  CampaignVariant, CampaignStep, CampaignConfig,
} from "./imap.js";

// SMTP
export { sendEmail, composeDraft } from "./smtp.js";

// Schemas
export {
  ListEmailAccountsInput,
  ListReceivedEmailsInput,
  SendEmailInput,
  ListSentEmailsInput,
  ListThreadsInput,
  GetEmailAccountAnalyticsInput,
  AddEmailTagInput,
  RemoveEmailTagInput,
  AddToAudienceInput,
  RemoveFromAudienceInput,
  ListAudiencesInput,
  GetEmailInput,
  GetEmailRawInput,
  ReplyToEmailInput,
  ReplyAllToEmailInput,
  ForwardEmailInput,
  DeleteEmailInput,
  GetThreadInput,
  GetAttachmentInput,
  ListDraftsInput,
  GetDraftInput,
  CreateDraftInput,
  UpdateDraftInput,
  DeleteDraftInput,
  SendDraftInput,
  ListReplyStatusesInput,
  SetReplyStatusInput,
  GetCampaignAnalyticsInput,
  CreateCampaignInput,
  ListCampaignsInput,
  GetCampaignInput,
  DeleteCampaignInput,
  StartCampaignInput,
  PingInput,
} from "./schemas.js";

// Tools
export { tools, toolsByName } from "./tools.js";

// Functions
export {
  list_email_accounts,
  list_received_emails,
  send_email,
  list_sent_emails,
  list_threads,
  get_email_account_analytics,
  add_email_tag,
  remove_email_tag,
  add_to_audience,
  remove_from_audience,
  list_audiences,
  get_email,
  get_email_raw,
  reply_to_email,
  reply_all_to_email,
  forward_email,
  delete_email_fn,
  get_thread,
  get_attachment,
  list_drafts,
  get_draft,
  create_draft,
  update_draft,
  delete_draft_fn,
  send_draft,
  list_reply_statuses,
  set_reply_status,
  get_campaign_analytics,
  create_campaign,
  list_campaigns,
  get_campaign,
  delete_campaign_fn,
  start_campaign,
  ping,
  functionMap,
  REPLY_STATUSES,
  STATUS_TAGS,
  TERMINAL_STATUSES,
} from "./functions.js";
