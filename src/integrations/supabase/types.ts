export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          country: string
          created_at: string
          deal_id: string | null
          id: string
          listing_id: string | null
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          listing_id?: string | null
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          listing_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comuni: {
        Row: {
          cms: string | null
          docs_found: number
          istat: string
          last_crawl: string | null
          name: string
          note: string | null
          province: string | null
          region: string | null
          site: string | null
        }
        Insert: {
          cms?: string | null
          docs_found?: number
          istat: string
          last_crawl?: string | null
          name: string
          note?: string | null
          province?: string | null
          region?: string | null
          site?: string | null
        }
        Update: {
          cms?: string | null
          docs_found?: number
          istat?: string
          last_crawl?: string | null
          name?: string
          note?: string | null
          province?: string | null
          region?: string | null
          site?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          comune: string | null
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string
          organisation: string | null
          pec: string | null
          phone: string | null
          region: string | null
          register_name: string | null
          register_ref: string | null
          register_verified: boolean
          stats: Json
        }
        Insert: {
          comune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind: string
          name: string
          organisation?: string | null
          pec?: string | null
          phone?: string | null
          region?: string | null
          register_name?: string | null
          register_ref?: string | null
          register_verified?: boolean
          stats?: Json
        }
        Update: {
          comune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string
          organisation?: string | null
          pec?: string | null
          phone?: string | null
          region?: string | null
          register_name?: string | null
          register_ref?: string | null
          register_verified?: boolean
          stats?: Json
        }
        Relationships: []
      }
      cost_estimates: {
        Row: {
          assumptions: Json
          created_at: string
          high_eur: number
          id: string
          items: Json
          listing_id: string
          low_eur: number
          price_list: string | null
          price_list_url: string | null
          scenario: string
          user_id: string | null
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          high_eur: number
          id?: string
          items?: Json
          listing_id: string
          low_eur: number
          price_list?: string | null
          price_list_url?: string | null
          scenario: string
          user_id?: string | null
        }
        Update: {
          assumptions?: Json
          created_at?: string
          high_eur?: number
          id?: string
          items?: Json
          listing_id?: string
          low_eur?: number
          price_list?: string | null
          price_list_url?: string | null
          scenario?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          deal_id: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          deal_id: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          deal_id?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tasks: {
        Row: {
          created_at: string
          deal_id: string
          detail_en: string | null
          due_at: string | null
          id: string
          kind: string
          official_url: string | null
          sort: number
          status: string
          title_en: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          detail_en?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          official_url?: string | null
          sort?: number
          status?: string
          title_en: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          detail_en?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          official_url?: string | null
          sort?: number
          status?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          autonomy: string
          created_at: string
          id: string
          listing_id: string
          max_bid_eur: number | null
          notes: string | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy?: string
          created_at?: string
          id?: string
          listing_id: string
          max_bid_eur?: number | null
          notes?: string | null
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy?: string
          created_at?: string
          id?: string
          listing_id?: string
          max_bid_eur?: number | null
          notes?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          error: string | null
          fetched_at: string
          id: string
          language: string
          meta: Json
          part: string
          published_at: string | null
          source_id: string
          status: string
          storage_path: string | null
          text_content: string | null
          title: string | null
          url: string
        }
        Insert: {
          error?: string | null
          fetched_at?: string
          id?: string
          language?: string
          meta?: Json
          part?: string
          published_at?: string | null
          source_id: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          title?: string | null
          url: string
        }
        Update: {
          error?: string | null
          fetched_at?: string
          id?: string
          language?: string
          meta?: Json
          part?: string
          published_at?: string | null
          source_id?: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          checked_at: string
          conditions_en: string | null
          country: string
          id: string
          max_eur: number | null
          name: string
          pct: number | null
          region: string | null
          requires_residency: boolean
          source_url: string
          summary_en: string
          valid_until: string | null
        }
        Insert: {
          checked_at: string
          conditions_en?: string | null
          country?: string
          id?: string
          max_eur?: number | null
          name: string
          pct?: number | null
          region?: string | null
          requires_residency?: boolean
          source_url: string
          summary_en: string
          valid_until?: string | null
        }
        Update: {
          checked_at?: string
          conditions_en?: string | null
          country?: string
          id?: string
          max_eur?: number | null
          name?: string
          pct?: number | null
          region?: string | null
          requires_residency?: boolean
          source_url?: string
          summary_en?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      listing_facts: {
        Row: {
          id: string
          key: string
          label_en: string
          listing_id: string
          page: number | null
          quote: string
          quote_en: string | null
          value_num: number | null
          value_text: string | null
          verified: boolean
        }
        Insert: {
          id?: string
          key: string
          label_en: string
          listing_id: string
          page?: number | null
          quote: string
          quote_en?: string | null
          value_num?: number | null
          value_text?: string | null
          verified?: boolean
        }
        Update: {
          id?: string
          key?: string
          label_en?: string
          listing_id?: string
          page?: number | null
          quote?: string
          quote_en?: string | null
          value_num?: number | null
          value_text?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listing_facts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_facts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_grants: {
        Row: {
          fit: string
          grant_id: string
          listing_id: string
          reason_en: string
        }
        Insert: {
          fit: string
          grant_id: string
          listing_id: string
          reason_en: string
        }
        Update: {
          fit?: string
          grant_id?: string
          listing_id?: string
          reason_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_grants_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_grants_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          caption_en: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          listing_id: string
          prompt: string | null
          storage_path: string
        }
        Insert: {
          caption_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          listing_id: string
          prompt?: string | null
          storage_path: string
        }
        Update: {
          caption_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          listing_id?: string
          prompt?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_dives: {
        Row: {
          done_at: string | null
          flags: number | null
          listing_id: string
          note: string | null
          pages: number | null
          requested_at: string
          status: string
        }
        Insert: {
          done_at?: string | null
          flags?: number | null
          listing_id: string
          note?: string | null
          pages?: number | null
          requested_at?: string
          status?: string
        }
        Update: {
          done_at?: string | null
          flags?: number | null
          listing_id?: string
          note?: string | null
          pages?: number | null
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
      listing_translations: {
        Row: {
          advice: Json
          created_at: string
          lang: string
          listing_id: string
          translation: string
        }
        Insert: {
          advice?: Json
          created_at?: string
          lang: string
          listing_id: string
          translation: string
        }
        Update: {
          advice?: Json
          created_at?: string
          lang?: string
          listing_id?: string
          translation?: string
        }
        Relationships: []
      }
      listing_red_flags: {
        Row: {
          doc_url: string | null
          flag_en: string
          id: string
          listing_id: string
          origin: string
          page: number | null
          quote: string
          quote_en: string | null
          severity: string
        }
        Insert: {
          doc_url?: string | null
          flag_en: string
          id?: string
          listing_id: string
          origin?: string
          page?: number | null
          quote: string
          quote_en?: string | null
          severity?: string
        }
        Update: {
          flag_en?: string
          id?: string
          listing_id?: string
          quote?: string
          quote_en?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_red_flags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_red_flags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          appraisal_eur: number | null
          attachments: Json
          case_ref: string | null
          contacts: Json
          court: string | null
          discount_pct: number | null
          external_id: string | null
          min_offer_eur: number | null
          photo_urls: Json
          sale_mode: string | null
          address: string | null
          auction_at: string | null
          condition: string | null
          comune: string | null
          country: string
          created_at: string
          deadline_at: string | null
          deposit_eur: number | null
          document_id: string | null
          hero_image_path: string | null
          id: string
          is_demo: boolean
          land_sqm: number | null
          lat: number | null
          lng: number | null
          lot: string | null
          occupancy: string | null
          previous_auction_failed: boolean | null
          price_eur: number | null
          property_type: string | null
          province: string | null
          region: string | null
          sale_type: string | null
          score: number | null
          score_reasons: Json
          status: string
          summary_en: string | null
          surface_sqm: number | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          appraisal_eur?: number | null
          attachments?: Json
          case_ref?: string | null
          contacts?: Json
          court?: string | null
          discount_pct?: number | null
          external_id?: string | null
          min_offer_eur?: number | null
          photo_urls?: Json
          sale_mode?: string | null
          address?: string | null
          auction_at?: string | null
          condition?: string | null
          comune?: string | null
          country?: string
          created_at?: string
          deadline_at?: string | null
          deposit_eur?: number | null
          document_id?: string | null
          hero_image_path?: string | null
          id?: string
          is_demo?: boolean
          land_sqm?: number | null
          lat?: number | null
          lng?: number | null
          lot?: string | null
          occupancy?: string | null
          previous_auction_failed?: boolean | null
          price_eur?: number | null
          property_type?: string | null
          province?: string | null
          region?: string | null
          sale_type?: string | null
          score?: number | null
          score_reasons?: Json
          status?: string
          summary_en?: string | null
          surface_sqm?: number | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          appraisal_eur?: number | null
          attachments?: Json
          case_ref?: string | null
          contacts?: Json
          court?: string | null
          discount_pct?: number | null
          external_id?: string | null
          min_offer_eur?: number | null
          photo_urls?: Json
          sale_mode?: string | null
          address?: string | null
          auction_at?: string | null
          condition?: string | null
          comune?: string | null
          country?: string
          created_at?: string
          deadline_at?: string | null
          deposit_eur?: number | null
          document_id?: string | null
          hero_image_path?: string | null
          id?: string
          is_demo?: boolean
          land_sqm?: number | null
          lat?: number | null
          lng?: number | null
          lot?: string | null
          occupancy?: string | null
          previous_auction_failed?: boolean | null
          price_eur?: number | null
          property_type?: string | null
          province?: string | null
          region?: string | null
          sale_type?: string | null
          score?: number | null
          score_reasons?: Json
          status?: string
          summary_en?: string | null
          surface_sqm?: number | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_generated: boolean
          approved_at: string | null
          approved_by: string | null
          attachments: Json
          body_en: string | null
          body_original: string
          created_at: string
          direction: string
          id: string
          is_binding: boolean
          language: string
          sent_at: string | null
          status: string
          subject: string | null
          thread_id: string
        }
        Insert: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          body_en?: string | null
          body_original: string
          created_at?: string
          direction: string
          id?: string
          is_binding?: boolean
          language?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          thread_id: string
        }
        Update: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          body_en?: string | null
          body_original?: string
          created_at?: string
          direction?: string
          id?: string
          is_binding?: boolean
          language?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          budget_max_eur: number | null
          can_move_residency: boolean | null
          created_at: string
          full_name: string | null
          has_codice_fiscale: boolean
          has_pec: boolean
          home_country: string | null
          id: string
          intent: string | null
          languages: string[]
          onboarded: boolean
          plan: string
          preferred_regions: string[]
          property_types: string[]
          renovation_budget_eur: number | null
          updated_at: string
        }
        Insert: {
          budget_max_eur?: number | null
          can_move_residency?: boolean | null
          created_at?: string
          full_name?: string | null
          has_codice_fiscale?: boolean
          has_pec?: boolean
          home_country?: string | null
          id: string
          intent?: string | null
          languages?: string[]
          onboarded?: boolean
          plan?: string
          preferred_regions?: string[]
          property_types?: string[]
          renovation_budget_eur?: number | null
          updated_at?: string
        }
        Update: {
          budget_max_eur?: number | null
          can_move_residency?: boolean | null
          created_at?: string
          full_name?: string | null
          has_codice_fiscale?: boolean
          has_pec?: boolean
          home_country?: string | null
          id?: string
          intent?: string | null
          languages?: string[]
          onboarded?: boolean
          plan?: string
          preferred_regions?: string[]
          property_types?: string[]
          renovation_budget_eur?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          amount_eur: number | null
          available_from: string | null
          contact_id: string | null
          created_at: string
          deal_id: string
          id: string
          scope_en: string | null
          service_en: string
          source_message_id: string | null
          status: string
          valid_until: string | null
          vat_included: boolean | null
        }
        Insert: {
          amount_eur?: number | null
          available_from?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id: string
          id?: string
          scope_en?: string | null
          service_en: string
          source_message_id?: string | null
          status?: string
          valid_until?: string | null
          vat_included?: boolean | null
        }
        Update: {
          amount_eur?: number | null
          available_from?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          scope_en?: string | null
          service_en?: string
          source_message_id?: string | null
          status?: string
          valid_until?: string | null
          vat_included?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          listing_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          last_notified_at: string | null
          name: string
          notify_email: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          last_notified_at?: string | null
          name: string
          notify_email?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string | null
          name?: string
          notify_email?: boolean
          user_id?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          country: string
          description_en: string | null
          homepage: string | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          country?: string
          description_en?: string | null
          homepage?: string | null
          id: string
          kind: string
          name: string
        }
        Update: {
          country?: string
          description_en?: string | null
          homepage?: string | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          deal_id: string
          id: string
          last_message_at: string | null
          purpose_en: string | null
          status: string
          subject: string | null
          summary_en: string | null
        }
        Insert: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          deal_id: string
          id?: string
          last_message_at?: string | null
          purpose_en?: string | null
          status?: string
          subject?: string | null
          summary_en?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          last_message_at?: string | null
          purpose_en?: string | null
          status?: string
          subject?: string | null
          summary_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          kind: string
          label: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          kind: string
          label?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          kind?: string
          label?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      listing_feed: {
        Row: {
          appraisal_eur: number | null
          attachments: Json | null
          case_ref: string | null
          contacts: Json | null
          court: string | null
          discount_pct: number | null
          external_id: string | null
          min_offer_eur: number | null
          photo_urls: Json | null
          sale_mode: string | null
          address: string | null
          auction_at: string | null
          condition: string | null
          comune: string | null
          country: string | null
          created_at: string | null
          days_left: number | null
          deadline_at: string | null
          deposit_eur: number | null
          document_id: string | null
          hero_image_path: string | null
          id: string | null
          is_demo: boolean | null
          land_sqm: number | null
          lat: number | null
          latest_render_path: string | null
          lng: number | null
          lot: string | null
          occupancy: string | null
          previous_auction_failed: boolean | null
          price_eur: number | null
          price_per_sqm: number | null
          property_type: string | null
          province: string | null
          red_flag_count: number | null
          region: string | null
          sale_type: string | null
          score: number | null
          score_reasons: Json | null
          source_id: string | null
          source_published_at: string | null
          source_title: string | null
          source_url: string | null
          status: string | null
          summary_en: string | null
          surface_sqm: number | null
          title_en: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      owns_deal: { Args: { d: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
