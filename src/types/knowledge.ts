/**
 * MoKnowledge - Knowledge Base Type Definitions
 * Covers baseline categories + extended fields for content generation.
 */

export interface CompanyFoundation {
  overview?: string;
  website?: string;
  industry?: string;
  businessModel?: string;
  companyRole?: string;
  yearFounded?: string;
  legalEntityType?: string;
  employeeCount?: string;
  mainAddress?: string;
  phone?: string;
  email?: string;
  otherLocations?: string[];
  serviceLocations?: string[];
  alternativeNames?: string[];
}

export interface Positioning {
  companyPitch?: string;
  foundingStory?: string;
}

export interface MarketCustomers {
  targetBuyers?: string[];
  customerNeeds?: string[];
  idealCustomerPersona?: string;
  industryGroupings?: string[];
  industryOutlook?: string;
  channels?: string[];
  funnels?: string[];
  ctas?: string[];
  suppliersPartners?: string[];
}

export interface BrandingStyle {
  writingStyle?: string;
  artStyle?: string;
  fonts?: string[];
  brandColors?: string[];
  logoUrls?: string[];
}

export interface OnlinePresence {
  linkedIn?: string;
  facebook?: string;
  instagram?: string;
  twitterX?: string;
  youtube?: string;
  otherSocial?: Record<string, string>;
}

export interface KeyPerson {
  name: string;
  title?: string;
  role?: string;
  gender?: string;
  description?: string;
  email?: string;
  phone?: string;
}

export interface Offering {
  name: string;
  type: "product" | "service" | "other";
  description?: string;
  features?: string[];
  pricing?: string;
  category?: string;
}

/** Extended categories (Think Bigger) */
export interface ExtendedKnowledge {
  competitors?: string[];
  contentThemes?: string[];
  testimonials?: string[];
  certificationsAwards?: string[];
  faq?: { question: string; answer: string }[];
  usp?: string[];
  seasonalMessaging?: string[];
  legalCompliance?: string[];
  pressMentions?: string[];
  valuesCommunity?: string[];
  /** Short summary of what the customer gets (offerings in one line) */
  customerGets?: string;
}

export interface KnowledgeBase {
  id: string;
  sourceUrl: string;
  scrapedAt: string;
  companyFoundation: CompanyFoundation;
  positioning: Positioning;
  marketCustomers: MarketCustomers;
  brandingStyle: BrandingStyle;
  onlinePresence: OnlinePresence;
  keyPeople: KeyPerson[];
  offerings: Offering[];
  extended?: ExtendedKnowledge;
}

export type KnowledgeBaseUpdate = Partial<Omit<KnowledgeBase, "id" | "scrapedAt">>;
