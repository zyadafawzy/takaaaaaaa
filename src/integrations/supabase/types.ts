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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_master_config: {
        Row: {
          failed_attempts: number
          id: boolean
          locked_until: string | null
          owner_email: string
          passphrase_hash: string
          passphrase_salt: string
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          id?: boolean
          locked_until?: string | null
          owner_email: string
          passphrase_hash: string
          passphrase_salt: string
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          id?: boolean
          locked_until?: string | null
          owner_email?: string
          passphrase_hash?: string
          passphrase_salt?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean | null
          content: string
          created_at: string | null
          ends_at: string | null
          id: string
          starts_at: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          type?: string | null
        }
        Relationships: []
      }
      anonymous_carts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          session_token: string
          store_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          session_token: string
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          session_token?: string
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anonymous_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anonymous_carts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string
          allow_negative_stock: boolean
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          allow_negative_stock?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          allow_negative_stock?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_store_id: string | null
          published: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_store_id?: string | null
          published?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_store_id?: string | null
          published?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_owner_store_id_fkey"
            columns: ["owner_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          product_id: string
          quantity: number | null
        }
        Insert: {
          bundle_id: string
          product_id: string
          quantity?: number | null
        }
        Update: {
          bundle_id?: string
          product_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          note: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          note?: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          note?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "anonymous_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          branch_id: string | null
          cashier_id: string
          closed_at: string | null
          closing_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          status: string
          store_id: string
        }
        Insert: {
          branch_id?: string | null
          cashier_id: string
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          store_id: string
        }
        Update: {
          branch_id?: string | null
          cashier_id?: string
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          duplicate_count: number
          failed_count: number
          id: string
          images_bucket_id: string
          images_path_prefix: string
          imported_count: number
          index_file_bucket_id: string | null
          index_file_format: string | null
          index_file_hash: string | null
          index_file_name: string | null
          index_file_path: string | null
          index_rows_count: number
          kind: Database["public"]["Enums"]["import_source_kind"]
          label: string
          last_progress_at: string | null
          max_sequence_no: number | null
          min_sequence_no: number | null
          missing_sequence_numbers: number[]
          needs_review_count: number
          notes: string
          published_count: number
          report_path: string | null
          run_message: string
          run_state: Database["public"]["Enums"]["import_run_state"]
          scan_report_path: string | null
          selected_count: number
          status: Database["public"]["Enums"]["import_batch_status"]
          total_bytes: number
          updated_at: string
          uploaded_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          duplicate_count?: number
          failed_count?: number
          id?: string
          images_bucket_id?: string
          images_path_prefix?: string
          imported_count?: number
          index_file_bucket_id?: string | null
          index_file_format?: string | null
          index_file_hash?: string | null
          index_file_name?: string | null
          index_file_path?: string | null
          index_rows_count?: number
          kind?: Database["public"]["Enums"]["import_source_kind"]
          label?: string
          last_progress_at?: string | null
          max_sequence_no?: number | null
          min_sequence_no?: number | null
          missing_sequence_numbers?: number[]
          needs_review_count?: number
          notes?: string
          published_count?: number
          report_path?: string | null
          run_message?: string
          run_state?: Database["public"]["Enums"]["import_run_state"]
          scan_report_path?: string | null
          selected_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_bytes?: number
          updated_at?: string
          uploaded_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          duplicate_count?: number
          failed_count?: number
          id?: string
          images_bucket_id?: string
          images_path_prefix?: string
          imported_count?: number
          index_file_bucket_id?: string | null
          index_file_format?: string | null
          index_file_hash?: string | null
          index_file_name?: string | null
          index_file_path?: string | null
          index_rows_count?: number
          kind?: Database["public"]["Enums"]["import_source_kind"]
          label?: string
          last_progress_at?: string | null
          max_sequence_no?: number | null
          min_sequence_no?: number | null
          missing_sequence_numbers?: number[]
          needs_review_count?: number
          notes?: string
          published_count?: number
          report_path?: string | null
          run_message?: string
          run_state?: Database["public"]["Enums"]["import_run_state"]
          scan_report_path?: string | null
          selected_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_bytes?: number
          updated_at?: string
          uploaded_count?: number
        }
        Relationships: []
      }
      catalog_import_rows: {
        Row: {
          batch_id: string
          confidence: string
          created_at: string
          created_product_id: string | null
          error_message: string
          id: string
          match_method: string
          match_reason: string
          matched_asset_id: string | null
          needs_visual_review: boolean
          normalized_data: Json
          raw_data: Json
          row_number: number
          source_file_name: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          confidence?: string
          created_at?: string
          created_product_id?: string | null
          error_message?: string
          id?: string
          match_method?: string
          match_reason?: string
          matched_asset_id?: string | null
          needs_visual_review?: boolean
          normalized_data?: Json
          raw_data?: Json
          row_number: number
          source_file_name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          confidence?: string
          created_at?: string
          created_product_id?: string | null
          error_message?: string
          id?: string
          match_method?: string
          match_reason?: string
          matched_asset_id?: string | null
          needs_visual_review?: boolean
          normalized_data?: Json
          raw_data?: Json
          row_number?: number
          source_file_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_matched_asset_id_fkey"
            columns: ["matched_asset_id"]
            isOneToOne: false
            referencedRelation: "storage_asset_index"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          owner_store_id: string | null
          published: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          owner_store_id?: string | null
          published?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          owner_store_id?: string | null
          published?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_owner_store_id_fkey"
            columns: ["owner_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_accounts: {
        Row: {
          credit_limit: number
          current_balance: number
          customer_id: string
          id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          credit_limit?: number
          current_balance?: number
          customer_id: string
          id?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          credit_limit?: number
          current_balance?: number
          customer_id?: string
          id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger_entries: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string
          credit: number
          customer_id: string
          debit: number
          entry_type: string
          id: string
          invoice_id: string | null
          notes: string | null
          store_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by: string
          credit?: number
          customer_id: string
          debit?: number
          entry_type: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          store_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string
          credit?: number
          customer_id?: string
          debit?: number
          entry_type?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          store_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          store_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_closings: {
        Row: {
          branch_id: string | null
          closed_at: string
          closed_by: string
          closing_date: string
          id: string
          invoices_count: number
          net_sales: number
          notes: string | null
          store_id: string
          total_card: number
          total_cash: number
          total_refunds: number
          total_sales: number
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string
          closed_by: string
          closing_date: string
          id?: string
          invoices_count?: number
          net_sales?: number
          notes?: string | null
          store_id: string
          total_card?: number
          total_cash?: number
          total_refunds?: number
          total_sales?: number
        }
        Update: {
          branch_id?: string | null
          closed_at?: string
          closed_by?: string
          closing_date?: string
          id?: string
          invoices_count?: number
          net_sales?: number
          notes?: string | null
          store_id?: string
          total_card?: number
          total_cash?: number
          total_refunds?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_closings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      damaged_items: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          qty: number
          reason: string | null
          recorded_by: string
          store_id: string
          variant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          qty: number
          reason?: string | null
          recorded_by: string
          store_id: string
          variant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          qty?: number
          reason?: string | null
          recorded_by?: string
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "damaged_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          available: boolean
          created_at: string
          fee: number
          free_delivery_threshold: number | null
          governorate: string
          id: string
          minimum_order: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          fee?: number
          free_delivery_threshold?: number | null
          governorate?: string
          id?: string
          minimum_order?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          fee?: number
          free_delivery_threshold?: number | null
          governorate?: string
          id?: string
          minimum_order?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expired_items: {
        Row: {
          branch_id: string | null
          disposed_at: string
          disposed_by: string
          expiry_date: string | null
          id: string
          qty: number
          store_id: string
          variant_id: string
        }
        Insert: {
          branch_id?: string | null
          disposed_at?: string
          disposed_by: string
          expiry_date?: string | null
          id?: string
          qty: number
          store_id: string
          variant_id: string
        }
        Update: {
          branch_id?: string | null
          disposed_at?: string
          disposed_by?: string
          expiry_date?: string | null
          id?: string
          qty?: number
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expired_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expired_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expired_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          variant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason?: string
          reference_id?: string | null
          variant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          branch_id: string | null
          id: string
          qty_on_hand: number
          store_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          branch_id?: string | null
          id?: string
          qty_on_hand?: number
          store_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          branch_id?: string | null
          id?: string
          qty_on_hand?: number
          store_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          barcode_scanned: string | null
          cost_price_snapshot: number | null
          created_at: string
          discount_pct: number
          id: string
          invoice_id: string
          line_total: number
          product_id: string
          product_name_snapshot: string
          qty: number
          sell_price_snapshot: number
          unit_label_snapshot: string
          variant_id: string
        }
        Insert: {
          barcode_scanned?: string | null
          cost_price_snapshot?: number | null
          created_at?: string
          discount_pct?: number
          id?: string
          invoice_id: string
          line_total: number
          product_id: string
          product_name_snapshot: string
          qty: number
          sell_price_snapshot: number
          unit_label_snapshot?: string
          variant_id: string
        }
        Update: {
          barcode_scanned?: string | null
          cost_price_snapshot?: number | null
          created_at?: string
          discount_pct?: number
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string
          product_name_snapshot?: string
          qty?: number
          sell_price_snapshot?: number
          unit_label_snapshot?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          original_invoice_id: string
          processed_by: string
          reason: string
          refund_invoice_id: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          original_invoice_id: string
          processed_by: string
          reason: string
          refund_invoice_id?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          original_invoice_id?: string
          processed_by?: string
          reason?: string
          refund_invoice_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_refunds_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_refunds_refund_invoice_id_fkey"
            columns: ["refund_invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          customer_id: string
          id: string
          lifetime_points: number
          points_balance: number
          store_id: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          id?: string
          lifetime_points?: number
          points_balance?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          balance_after: number
          created_at: string
          id: string
          invoice_id: string | null
          loyalty_account_id: string
          notes: string | null
          points: number
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          loyalty_account_id: string
          notes?: string | null
          points: number
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          loyalty_account_id?: string
          notes?: string | null
          points?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string
          actor_user_id: string | null
          created_at: string
          id: string
          is_customer_visible: boolean
          label: string
          order_id: string
        }
        Insert: {
          actor?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_customer_visible?: boolean
          label: string
          order_id: string
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_customer_visible?: boolean
          label?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          line_total: number
          note: string
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string
          quantity: number
          size_label: string
          unit: Database["public"]["Enums"]["sell_unit"]
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          line_total: number
          note?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug?: string
          quantity: number
          size_label?: string
          unit?: Database["public"]["Enums"]["sell_unit"]
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          line_total?: number
          note?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string
          quantity?: number
          size_label?: string
          unit?: Database["public"]["Enums"]["sell_unit"]
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_name: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          author_name?: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          building: string
          created_at: string
          customer_first_name: string
          customer_notes: string
          customer_phone: string
          customer_whatsapp: string
          delivery_fee: number
          discount_total: number
          fulfillment: Database["public"]["Enums"]["fulfillment_method"]
          governorate: string
          grand_total: number
          id: string
          items_total: number
          landmark: string
          order_number: string
          payment: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          street: string
          substitution: Database["public"]["Enums"]["substitution_policy"]
          token: string
          updated_at: string
          whatsapp_link_opened_at: string | null
          zone_id: string | null
          zone_name: string
        }
        Insert: {
          building?: string
          created_at?: string
          customer_first_name: string
          customer_notes?: string
          customer_phone: string
          customer_whatsapp?: string
          delivery_fee?: number
          discount_total?: number
          fulfillment?: Database["public"]["Enums"]["fulfillment_method"]
          governorate?: string
          grand_total?: number
          id?: string
          items_total?: number
          landmark?: string
          order_number?: string
          payment?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          street?: string
          substitution?: Database["public"]["Enums"]["substitution_policy"]
          token: string
          updated_at?: string
          whatsapp_link_opened_at?: string | null
          zone_id?: string | null
          zone_name?: string
        }
        Update: {
          building?: string
          created_at?: string
          customer_first_name?: string
          customer_notes?: string
          customer_phone?: string
          customer_whatsapp?: string
          delivery_fee?: number
          discount_total?: number
          fulfillment?: Database["public"]["Enums"]["fulfillment_method"]
          governorate?: string
          grand_total?: number
          id?: string
          items_total?: number
          landmark?: string
          order_number?: string
          payment?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          street?: string
          substitution?: Database["public"]["Enums"]["substitution_policy"]
          token?: string
          updated_at?: string
          whatsapp_link_opened_at?: string | null
          zone_id?: string | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
          type: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
          type: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_audit_logs: {
        Row: {
          action: string
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          performed_by: string | null
          record_id: string | null
          store_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id?: string | null
          store_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id?: string | null
          store_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      pos_inventory_movements: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          id: string
          movement_type: string
          notes: string | null
          qty_after: number
          qty_before: number
          qty_change: number
          reference_id: string | null
          reference_type: string | null
          store_id: string
          variant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          movement_type: string
          notes?: string | null
          qty_after: number
          qty_before: number
          qty_change: number
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          variant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: string
          notes?: string | null
          qty_after?: number
          qty_before?: number
          qty_change?: number
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_invoices: {
        Row: {
          branch_id: string | null
          cashier_id: string
          change_amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string | null
          delivery_order_id: string | null
          discount_amount: number
          id: string
          invoice_number: string
          notes: string | null
          paid_amount: number
          sale_source: string
          shift_id: string | null
          status: string
          store_id: string
          subtotal: number
          tax_amount: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id?: string | null
          cashier_id: string
          change_amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_order_id?: string | null
          discount_amount?: number
          id?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number
          sale_source?: string
          shift_id?: string | null
          status?: string
          store_id: string
          subtotal?: number
          tax_amount?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string | null
          cashier_id?: string
          change_amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_order_id?: string | null
          discount_amount?: number
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number
          sale_source?: string
          shift_id?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_invoices_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_members: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["pos_role"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["pos_role"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["pos_role"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      print_logs: {
        Row: {
          document_type: string
          id: string
          invoice_id: string | null
          printed_at: string
          printed_by: string | null
          printer_name: string | null
          store_id: string
        }
        Insert: {
          document_type: string
          id?: string
          invoice_id?: string | null
          printed_at?: string
          printed_by?: string | null
          printer_name?: string | null
          store_id: string
        }
        Update: {
          document_type?: string
          id?: string
          invoice_id?: string | null
          printed_at?: string
          printed_by?: string | null
          printer_name?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pos_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          created_at: string
          id: string
          is_primary: boolean
          store_id: string
          variant_id: string
        }
        Insert: {
          barcode: string
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id: string
          variant_id: string
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bundles: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string
          asset_index_id: string | null
          asset_version: number
          bucket_id: string
          content_type: string
          created_at: string
          height: number | null
          id: string
          product_id: string
          published: boolean
          sort_order: number
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          asset_index_id?: string | null
          asset_version?: number
          bucket_id: string
          content_type?: string
          created_at?: string
          height?: number | null
          id?: string
          product_id: string
          published?: boolean
          sort_order?: number
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          asset_index_id?: string | null
          asset_version?: number
          bucket_id?: string
          content_type?: string
          created_at?: string
          height?: number | null
          id?: string
          product_id?: string
          published?: boolean
          sort_order?: number
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          actor_email: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_compare_at_price: number | null
          new_price: number
          old_compare_at_price: number | null
          old_price: number | null
          product_id: string
          reason: string
          variant_id: string | null
        }
        Insert: {
          actor_email?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_compare_at_price?: number | null
          new_price: number
          old_compare_at_price?: number | null
          old_price?: number | null
          product_id: string
          reason?: string
          variant_id?: string | null
        }
        Update: {
          actor_email?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_compare_at_price?: number | null
          new_price?: number
          old_compare_at_price?: number | null
          old_price?: number | null
          product_id?: string
          reason?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recommendations: {
        Row: {
          confidence_score: number | null
          product_id: string
          recommended_id: string
        }
        Insert: {
          confidence_score?: number | null
          product_id: string
          recommended_id: string
        }
        Update: {
          confidence_score?: number | null
          product_id?: string
          recommended_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recommendations_recommended_id_fkey"
            columns: ["recommended_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          created_at: string
          handled_by: string | null
          id: string
          note: string
          phone: string
          product_name: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handled_by?: string | null
          id?: string
          note?: string
          phone?: string
          product_name: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handled_by?: string | null
          id?: string
          note?: string
          phone?: string
          product_name?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean
          allow_backorder: boolean
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          id: string
          is_default: boolean
          low_stock_threshold: number
          min_stock_qty: number
          price: number
          product_id: string
          size_label: string
          sku: string
          sort_order: number
          stock_quantity: number
          store_id: string | null
          unit_label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_backorder?: boolean
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          low_stock_threshold?: number
          min_stock_qty?: number
          price: number
          product_id: string
          size_label?: string
          sku: string
          sort_order?: number
          stock_quantity?: number
          store_id?: string | null
          unit_label?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_backorder?: boolean
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          low_stock_threshold?: number
          min_stock_qty?: number
          price?: number
          product_id?: string
          size_label?: string
          sku?: string
          sort_order?: number
          stock_quantity?: number
          store_id?: string | null
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string
          display_order: number | null
          featured: boolean
          featured_until: string | null
          id: string
          is_complete: boolean
          is_featured: boolean
          is_fresh: boolean
          is_hidden: boolean | null
          name: string
          needs_review: boolean
          offer_until: string | null
          owner_store_id: string | null
          published_at: string | null
          review_note: string
          search_text: string
          sku: string
          slug: string
          sort_order: number | null
          source_url: string
          status: Database["public"]["Enums"]["product_status"]
          unit: Database["public"]["Enums"]["sell_unit"]
          updated_at: string
          visible: boolean
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          available?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          display_order?: number | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          is_complete?: boolean
          is_featured?: boolean
          is_fresh?: boolean
          is_hidden?: boolean | null
          name: string
          needs_review?: boolean
          offer_until?: string | null
          owner_store_id?: string | null
          published_at?: string | null
          review_note?: string
          search_text?: string
          sku: string
          slug: string
          sort_order?: number | null
          source_url?: string
          status?: Database["public"]["Enums"]["product_status"]
          unit?: Database["public"]["Enums"]["sell_unit"]
          updated_at?: string
          visible?: boolean
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          available?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          display_order?: number | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          is_complete?: boolean
          is_featured?: boolean
          is_fresh?: boolean
          is_hidden?: boolean | null
          name?: string
          needs_review?: boolean
          offer_until?: string | null
          owner_store_id?: string | null
          published_at?: string | null
          review_note?: string
          search_text?: string
          sku?: string
          slug?: string
          sort_order?: number | null
          source_url?: string
          status?: Database["public"]["Enums"]["product_status"]
          unit?: Database["public"]["Enums"]["sell_unit"]
          updated_at?: string
          visible?: boolean
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_owner_store_id_fkey"
            columns: ["owner_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          branch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          status: string
          store_id: string
          supplier_id: string
          total: number
        }
        Insert: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          status?: string
          store_id: string
          supplier_id: string
          total?: number
        }
        Update: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          status?: string
          store_id?: string
          supplier_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          cost_price: number
          expiry_date: string | null
          id: string
          line_total: number
          product_name_snapshot: string
          purchase_invoice_id: string
          qty: number
          variant_id: string
        }
        Insert: {
          cost_price: number
          expiry_date?: string | null
          id?: string
          line_total: number
          product_name_snapshot: string
          purchase_invoice_id: string
          qty: number
          variant_id: string
        }
        Update: {
          cost_price?: number
          expiry_date?: string | null
          id?: string
          line_total?: number
          product_name_snapshot?: string
          purchase_invoice_id?: string
          qty?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      search_aliases: {
        Row: {
          created_at: string | null
          id: string
          locale: string | null
          match_type: string
          normalized_term: string
          review_status: string | null
          search_term: string
          sku: string
          source: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          locale?: string | null
          match_type: string
          normalized_term: string
          review_status?: string | null
          search_term: string
          sku: string
          source?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string | null
          match_type?: string
          normalized_term?: string
          review_status?: string | null
          search_term?: string
          sku?: string
          source?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      search_events: {
        Row: {
          clicked_sku: string | null
          created_at: string | null
          id: string
          query_normalized_term: string
          query_original: string
          results_count: number | null
        }
        Insert: {
          clicked_sku?: string | null
          created_at?: string | null
          id?: string
          query_normalized_term: string
          query_original: string
          results_count?: number | null
        }
        Update: {
          clicked_sku?: string | null
          created_at?: string | null
          id?: string
          query_normalized_term?: string
          query_original?: string
          results_count?: number | null
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          alert_type: string
          branch_id: string | null
          id: string
          is_active: boolean
          resolved_at: string | null
          store_id: string
          triggered_at: string
          variant_id: string
        }
        Insert: {
          alert_type: string
          branch_id?: string | null
          id?: string
          is_active?: boolean
          resolved_at?: string | null
          store_id: string
          triggered_at?: string
          variant_id: string
        }
        Update: {
          alert_type?: string
          branch_id?: string | null
          id?: string
          is_active?: boolean
          resolved_at?: string | null
          store_id?: string
          triggered_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_asset_index: {
        Row: {
          batch_id: string | null
          bucket_id: string
          byte_size: number
          content_hash: string | null
          created_at: string
          etag: string | null
          file_name: string
          folder_hint: string
          id: string
          linked_product_id: string | null
          metadata: Json
          mime_type: string
          original_file_name: string
          published: boolean
          relative_path: string
          scan_message: string
          scan_status: Database["public"]["Enums"]["asset_scan_status"]
          sequence_no: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          bucket_id: string
          byte_size?: number
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          file_name: string
          folder_hint?: string
          id?: string
          linked_product_id?: string | null
          metadata?: Json
          mime_type: string
          original_file_name: string
          published?: boolean
          relative_path?: string
          scan_message?: string
          scan_status?: Database["public"]["Enums"]["asset_scan_status"]
          sequence_no?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          bucket_id?: string
          byte_size?: number
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          file_name?: string
          folder_hint?: string
          id?: string
          linked_product_id?: string | null
          metadata?: Json
          mime_type?: string
          original_file_name?: string
          published?: boolean
          relative_path?: string
          scan_message?: string
          scan_status?: Database["public"]["Enums"]["asset_scan_status"]
          sequence_no?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_asset_index_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_asset_index_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_activity_log: {
        Row: {
          action: string
          actor_email: string
          actor_user_id: string | null
          created_at: string
          detail: Json
          id: string
          store_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_activity_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_announcements: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_announcements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_branches: {
        Row: {
          active: boolean
          address: string
          created_at: string
          id: string
          name: string
          opening_hours: string
          phone: string
          pickup_enabled: boolean
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          active?: boolean
          address?: string
          created_at?: string
          id?: string
          name: string
          opening_hours?: string
          phone?: string
          pickup_enabled?: boolean
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          id?: string
          name?: string
          opening_hours?: string
          phone?: string
          pickup_enabled?: boolean
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      store_branding: {
        Row: {
          accent_color: string
          background_color: string
          border_color: string
          color_mode: string
          danger_color: string
          density: string
          font_family: string
          header_style: string
          hero_image_url: string | null
          hero_subtitle: string
          hero_title: string
          muted_color: string
          primary_color: string
          product_card_style: string
          radius_style: string
          secondary_color: string
          store_id: string
          success_color: string
          surface_color: string
          text_color: string
          theme_preset: string
          updated_at: string
          warning_color: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          border_color?: string
          color_mode?: string
          danger_color?: string
          density?: string
          font_family?: string
          header_style?: string
          hero_image_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          muted_color?: string
          primary_color?: string
          product_card_style?: string
          radius_style?: string
          secondary_color?: string
          store_id: string
          success_color?: string
          surface_color?: string
          text_color?: string
          theme_preset?: string
          updated_at?: string
          warning_color?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          border_color?: string
          color_mode?: string
          danger_color?: string
          density?: string
          font_family?: string
          header_style?: string
          hero_image_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          muted_color?: string
          primary_color?: string
          product_card_style?: string
          radius_style?: string
          secondary_color?: string
          store_id?: string
          success_color?: string
          surface_color?: string
          text_color?: string
          theme_preset?: string
          updated_at?: string
          warning_color?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_branding_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_delivery_zones: {
        Row: {
          available: boolean
          created_at: string
          fee: number
          free_delivery_threshold: number | null
          governorate: string
          id: string
          minimum_order: number
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          fee?: number
          free_delivery_threshold?: number | null
          governorate?: string
          id?: string
          minimum_order?: number
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          fee?: number
          free_delivery_threshold?: number | null
          governorate?: string
          id?: string
          minimum_order?: number
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_delivery_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_counters: {
        Row: {
          last_number: number
          prefix: string
          scope: string
          updated_at: string
        }
        Insert: {
          last_number?: number
          prefix?: string
          scope: string
          updated_at?: string
        }
        Update: {
          last_number?: number
          prefix?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          compare_at_override: number | null
          created_at: string
          enabled: boolean
          featured: boolean
          id: string
          price_override: number | null
          product_id: string
          sort_order: number
          stock_override: number | null
          store_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          compare_at_override?: number | null
          created_at?: string
          enabled?: boolean
          featured?: boolean
          id?: string
          price_override?: number | null
          product_id: string
          sort_order?: number
          stock_override?: number | null
          store_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          compare_at_override?: number | null
          created_at?: string
          enabled?: boolean
          featured?: boolean
          id?: string
          price_override?: number | null
          product_id?: string
          sort_order?: number
          stock_override?: number | null
          store_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accepting_orders: boolean
          closed_message: string
          cod_enabled: boolean
          contact_email: string
          created_at: string
          default_currency: string
          facebook_url: string
          instagram_url: string
          online_payment_enabled: boolean
          order_whatsapp_template: string
          pickup_enabled: boolean
          privacy_text: string
          store_id: string
          substitution_policy_text: string
          terms_text: string
          tiktok_url: string
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          closed_message?: string
          cod_enabled?: boolean
          contact_email?: string
          created_at?: string
          default_currency?: string
          facebook_url?: string
          instagram_url?: string
          online_payment_enabled?: boolean
          order_whatsapp_template?: string
          pickup_enabled?: boolean
          privacy_text?: string
          store_id: string
          substitution_policy_text?: string
          terms_text?: string
          tiktok_url?: string
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          closed_message?: string
          cod_enabled?: boolean
          contact_email?: string
          created_at?: string
          default_currency?: string
          facebook_url?: string
          instagram_url?: string
          online_payment_enabled?: boolean
          order_whatsapp_template?: string
          pickup_enabled?: boolean
          privacy_text?: string
          store_id?: string
          substitution_policy_text?: string
          terms_text?: string
          tiktok_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          admin_password_hash: string | null
          business_hours: string
          contact_name: string
          created_at: string
          description: string
          favicon_url: string | null
          features: Json
          governorate: string
          id: string
          is_maintenance: boolean
          is_master: boolean
          logo_url: string | null
          maintenance_message: string
          name: string
          owner_name: string
          phone: string
          plan: string
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          support_number: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          address?: string
          admin_password_hash?: string | null
          business_hours?: string
          contact_name?: string
          created_at?: string
          description?: string
          favicon_url?: string | null
          features?: Json
          governorate?: string
          id?: string
          is_maintenance?: boolean
          is_master?: boolean
          logo_url?: string | null
          maintenance_message?: string
          name: string
          owner_name?: string
          phone?: string
          plan?: string
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          support_number?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          address?: string
          admin_password_hash?: string | null
          business_hours?: string
          contact_name?: string
          created_at?: string
          description?: string
          favicon_url?: string | null
          features?: Json
          governorate?: string
          id?: string
          is_maintenance?: boolean
          is_master?: boolean
          logo_url?: string | null
          maintenance_message?: string
          name?: string
          owner_name?: string
          phone?: string
          plan?: string
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          support_number?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      supplier_ledger_entries: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string
          credit: number
          debit: number
          entry_type: string
          id: string
          notes: string | null
          purchase_invoice_id: string | null
          store_id: string
          supplier_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by: string
          credit?: number
          debit?: number
          entry_type: string
          id?: string
          notes?: string | null
          purchase_invoice_id?: string | null
          store_id: string
          supplier_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string
          credit?: number
          debit?: number
          entry_type?: string
          id?: string
          notes?: string | null
          purchase_invoice_id?: string | null
          store_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ledger_entries_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          store_id: string
          tax_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          store_id: string
          tax_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          store_id?: string
          tax_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      unknown_scan_items: {
        Row: {
          barcode: string
          branch_id: string | null
          id: string
          notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          scanned_at: string
          scanned_by: string | null
          session_id: string | null
          store_id: string
        }
        Insert: {
          barcode: string
          branch_id?: string | null
          id?: string
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scanned_at?: string
          scanned_by?: string | null
          session_id?: string | null
          store_id: string
        }
        Update: {
          barcode?: string
          branch_id?: string | null
          id?: string
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scanned_at?: string
          scanned_by?: string | null
          session_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unknown_scan_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unknown_scan_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_first_super_admin: {
        Args: { _email: string; _full_name?: string; _user_id: string }
        Returns: Json
      }
      generate_invoice_number: {
        Args: { p_branch_id?: string; p_store_id: string }
        Returns: string
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_published_catalog: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      next_order_number: { Args: { _store_id: string }; Returns: string }
      pos_apply_stock: {
        Args: {
          p_allow_negative: boolean
          p_branch_id: string
          p_delta: number
          p_notes?: string
          p_ref_id: string
          p_ref_type: string
          p_store_id: string
          p_type: string
          p_user_id: string
          p_variant_id: string
        }
        Returns: number
      }
      pos_can_manage_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      pos_can_read_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      pos_can_stock_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      pos_can_write_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      pos_has_store_role: {
        Args: {
          _roles: Database["public"]["Enums"]["pos_role"][]
          _store_id: string
          _user_id: string
        }
        Returns: boolean
      }
      pos_is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      product_is_sellable: { Args: { _product_id: string }; Returns: boolean }
      rpc_adjust_stock: {
        Args: {
          p_branch_id: string
          p_qty_new: number
          p_reason: string
          p_store_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      rpc_close_shift: {
        Args: { p_closing_amount: number; p_shift_id: string }
        Returns: Json
      }
      rpc_confirm_invoice: { Args: { p_invoice_id: string }; Returns: Json }
      rpc_confirm_purchase: { Args: { p_purchase_id: string }; Returns: Json }
      rpc_customer_payment: {
        Args: { p_amount: number; p_customer_id: string; p_notes?: string }
        Returns: Json
      }
      rpc_scan_barcode: {
        Args: {
          p_barcode: string
          p_branch_id?: string
          p_session_id?: string
          p_store_id: string
        }
        Returns: Json
      }
      rpc_void_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      store_has_role: {
        Args: {
          _roles: Database["public"]["Enums"]["store_role"][]
          _store_id: string
          _user_id: string
        }
        Returns: boolean
      }
      upsert_app_setting: {
        Args: { p_is_public?: boolean; p_key: string; p_value: Json }
        Returns: undefined
      }
      user_can_access_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "store_manager"
        | "inventory_operator"
        | "order_operator"
        | "ceo_viewer"
      asset_scan_status: "pending" | "ok" | "rejected" | "duplicate"
      fulfillment_method: "delivery" | "pickup"
      import_batch_status:
        | "open"
        | "files_uploaded"
        | "awaiting_index_file"
        | "ready_for_scan"
        | "scanned"
        | "imported"
        | "failed"
        | "cancelled"
      import_run_state:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      import_source_kind: "images" | "index_file" | "mixed"
      order_status:
        | "new"
        | "awaiting_whatsapp"
        | "needs_call"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "cod"
      pos_role:
        | "store_owner"
        | "branch_manager"
        | "cashier"
        | "inventory_clerk"
        | "viewer"
      product_status: "draft" | "published" | "archived"
      sell_unit: "piece" | "kg" | "pack" | "bundle" | "liter"
      store_role: "store_admin" | "store_staff"
      store_status: "draft" | "active" | "suspended"
      substitution_policy: "substitute" | "call_me" | "remove"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "store_manager",
        "inventory_operator",
        "order_operator",
        "ceo_viewer",
      ],
      asset_scan_status: ["pending", "ok", "rejected", "duplicate"],
      fulfillment_method: ["delivery", "pickup"],
      import_batch_status: [
        "open",
        "files_uploaded",
        "awaiting_index_file",
        "ready_for_scan",
        "scanned",
        "imported",
        "failed",
        "cancelled",
      ],
      import_run_state: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      import_source_kind: ["images", "index_file", "mixed"],
      order_status: [
        "new",
        "awaiting_whatsapp",
        "needs_call",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod"],
      pos_role: [
        "store_owner",
        "branch_manager",
        "cashier",
        "inventory_clerk",
        "viewer",
      ],
      product_status: ["draft", "published", "archived"],
      sell_unit: ["piece", "kg", "pack", "bundle", "liter"],
      store_role: ["store_admin", "store_staff"],
      store_status: ["draft", "active", "suspended"],
      substitution_policy: ["substitute", "call_me", "remove"],
    },
  },
} as const
