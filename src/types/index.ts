export type ListingType = 'SERVICE_OFFER' | 'SERVICE_REQUEST' | 'JOB_OPENING' | 'JOB_SEEKER';

export type PriceType = 'FIXED' | 'FROM' | 'RANGE' | 'NEGOTIABLE' | 'FREE';

export type SalaryType = 'SALARY_FIXED' | 'SALARY_RANGE' | 'SALARY_NEGOTIABLE';

export type ContactTime = 'ANY_TIME' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';

export type WorkFormat = 'ONSITE' | 'REMOTE' | 'HYBRID';

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type BanType = 'NONE' | 'TEMPORARY' | 'PERMANENT';

export interface User {
  id: string;
  telegram_id: string;
  telegram_username?: string;
  name: string;
  profile_photo_url?: string;
  phone?: string;
  bio?: string;
  region_id?: string;
  region_name?: string;
  district_id?: string;
  district_name?: string;
  latitude?: number;
  longitude?: number;
  role: UserRole;
  is_banned: number;
  ban_type: BanType;
  ban_reason?: string;
  ban_end_date?: string;
  created_at: string;
  active_listing_count?: number;
  archived_listing_count?: number;
  follower_count?: number;
  following_count?: number;
  is_profile_complete?: boolean;
  is_followed?: boolean;
}

export interface Region {
  id: string;
  name_uz: string;
  code: string;
  sort_order: number;
}

export interface District {
  id: string;
  region_id: string;
  name_uz: string;
  latitude: number;
  longitude: number;
  sort_order: number;
}

export interface Catalog {
  id: string;
  name_uz: string;
  slug: string;
  icon: string;
  description?: string;
  listing_types: string;
  sort_order: number;
  is_active: number;
  categories_count?: number;
  listings_count?: number;
}

export interface Category {
  id: string;
  catalog_id?: string;
  name_uz: string;
  slug: string;
  icon: string;
  parent_id?: string;
  is_active: number;
  sort_order: number;
  active_count?: number;
  subs?: Category[];
}

export interface Listing {
  id: string;
  owner_user_id: string;
  organization_id?: string;
  catalog_id?: string;
  type: ListingType;
  title: string;
  description: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
  region_id: string;
  region_name?: string;
  district_id: string;
  district_name?: string;
  latitude?: number;
  longitude?: number;
  price_type: PriceType;
  price_min?: number;
  price_max?: number;
  currency: string;
  salary_type?: SalaryType;
  salary_min?: number;
  salary_max?: number;
  work_format?: WorkFormat;
  experience_level?: string;
  skills?: string | string[];
  contact_time: ContactTime;
  contact_custom_text?: string;
  status: 'ACTIVE' | 'HIDDEN' | 'ARCHIVED' | 'REMOVED';
  created_at: string;
  updated_at: string;
  expires_at: string;
  archived_at?: string;
  renewed_at?: string;
  images: string[];
  owner_name?: string;
  owner_username?: string;
  owner_photo_url?: string;
  owner_bio?: string;
  owner_phone?: string;
  owner_registered_at?: string;
  owner_active_listing_count?: number;
  owner_followers_count?: number;
  organization_name?: string;
  organization_logo_url?: string;
  organization_description?: string;
  organization_phone?: string;
  organization_website?: string;
  organization_address?: string;
  organization_verification_status?: 'UNVERIFIED' | 'VERIFIED';
  is_saved?: boolean;
  is_followed?: boolean;
  is_profile_complete?: boolean;
  distance_km?: number | null;
  employer_rating?: number | null;
  employer_review_count?: number;
}

export interface Review {
  id: string;
  author_user_id: string;
  author_name: string;
  author_photo_url?: string;
  author_username?: string;
  target_user_id: string;
  listing_id?: string;
  listing_title?: string;
  rating: number; // 1-5
  comment: string;
  employer_reply?: string;
  employer_reply_at?: string;
  employer_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RatingSummary {
  average_rating: number; // 0 to 5.0
  total_reviews: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  phone?: string;
  website?: string;
  region_id?: string;
  region_name?: string;
  district_id?: string;
  district_name?: string;
  address?: string;
  owner_user_id: string;
  owner_name?: string;
  verification_status: 'UNVERIFIED' | 'VERIFIED';
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  listings?: Listing[];
  user_membership_role?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
}

export interface Conversation {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_type: ListingType;
  listing_cover_image?: string;
  partner_id: string;
  partner_name: string;
  partner_photo?: string;
  last_message_text: string;
  last_message_time: string;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_name?: string;
  sender_photo?: string;
  message_type: 'TEXT' | 'IMAGE';
  text?: string;
  attachment_url?: string;
  created_at: string;
  read_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_user_id: string;
  reporter_name?: string;
  reporter_username?: string;
  target_type: 'LISTING' | 'USER' | 'ORGANIZATION' | 'MESSAGE' | 'CONVERSATION';
  target_id: string;
  reason: string;
  description?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  reviewed_by?: string;
  reviewer_name?: string;
  action_taken?: string;
  created_at: string;
  target_data?: any;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: string;
  created_at: string;
}
