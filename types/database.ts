export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          request_count: number;
          scope: string;
          subject_hash: string;
          updated_at: string;
          window_end: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          request_count?: number;
          scope: string;
          subject_hash: string;
          updated_at?: string;
          window_end: string;
          window_start: string;
        };
        Update: {
          request_count?: number;
          scope?: string;
          subject_hash?: string;
          updated_at?: string;
          window_end?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      learning_activity: {
        Row: {
          activity_context: string | null;
          activity_type: string;
          correct_count: number | null;
          created_at: string;
          id: string;
          lesson_slug: string;
          lesson_title: string;
          passed: boolean | null;
          response_preview: string | null;
          source_event_id: string | null;
          total_questions: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_context?: string | null;
          activity_type: string;
          correct_count?: number | null;
          created_at?: string;
          id?: string;
          lesson_slug: string;
          lesson_title: string;
          passed?: boolean | null;
          response_preview?: string | null;
          source_event_id?: string | null;
          total_questions?: number | null;
          user_id: string;
        };
        Update: {
          activity_context?: string | null;
          activity_type?: string;
          correct_count?: number | null;
          created_at?: string;
          id?: string;
          lesson_slug?: string;
          lesson_title?: string;
          passed?: boolean | null;
          response_preview?: string | null;
          source_event_id?: string | null;
          total_questions?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          completed_at: string;
          lesson_slug: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string;
          lesson_slug: string;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          lesson_slug?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lesson_videos: {
        Row: {
          captions_key: string | null;
          captions_label: string;
          captions_language: string;
          created_at: string;
          duration_seconds: number | null;
          is_available: boolean;
          lesson_slug: string;
          updated_at: string;
          video_key: string;
        };
        ComputedFields: never;
        Insert: {
          captions_key?: string | null;
          captions_label?: string;
          captions_language?: string;
          created_at?: string;
          duration_seconds?: number | null;
          is_available?: boolean;
          lesson_slug: string;
          updated_at?: string;
          video_key: string;
        };
        Update: {
          captions_key?: string | null;
          captions_label?: string;
          captions_language?: string;
          created_at?: string;
          duration_seconds?: number | null;
          is_available?: boolean;
          lesson_slug?: string;
          updated_at?: string;
          video_key?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          stripe_customer_id: string | null;
          timezone: string | null;
          welcome_email_claimed_at: string | null;
          welcome_email_eligible_at: string | null;
          welcome_email_sent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          stripe_customer_id?: string | null;
          timezone?: string | null;
          welcome_email_claimed_at?: string | null;
          welcome_email_eligible_at?: string | null;
          welcome_email_sent_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          stripe_customer_id?: string | null;
          timezone?: string | null;
          welcome_email_claimed_at?: string | null;
          welcome_email_eligible_at?: string | null;
          welcome_email_sent_at?: string | null;
        };
        Relationships: [];
      };
      purchase_events: {
        Row: {
          amount_cents: number | null;
          created_at: string;
          currency: string | null;
          event_type: string;
          id: string;
          status: string | null;
          stripe_checkout_session_id: string | null;
          stripe_event_id: string | null;
          stripe_invoice_id: string | null;
          subscription_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents?: number | null;
          created_at?: string;
          currency?: string | null;
          event_type: string;
          id?: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_event_id?: string | null;
          stripe_invoice_id?: string | null;
          subscription_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_cents?: number | null;
          created_at?: string;
          currency?: string | null;
          event_type?: string;
          id?: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_event_id?: string | null;
          stripe_invoice_id?: string | null;
          subscription_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      stripe_webhook_events: {
        Row: {
          attempt_count: number;
          claimed_at: string;
          event_id: string;
          event_type: string;
          last_error: string | null;
          processed_at: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          claimed_at?: string;
          event_id: string;
          event_type: string;
          last_error?: string | null;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          claimed_at?: string;
          event_id?: string;
          event_type?: string;
          last_error?: string | null;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          plan_slug: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan_slug?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan_slug?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      video_progress: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duration_seconds: number;
          lesson_slug: string;
          position_seconds: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duration_seconds: number;
          lesson_slug: string;
          position_seconds?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number;
          lesson_slug?: string;
          position_seconds?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_stripe_webhook_event: {
        Args: { target_event_id: string; target_event_type: string };
        Returns: boolean;
      };
      claim_welcome_email: { Args: { target_user_id: string }; Returns: boolean };
      complete_stripe_webhook_event: { Args: { target_event_id: string }; Returns: undefined };
      consume_api_rate_limit: {
        Args: {
          target_limit: number;
          target_scope: string;
          target_subject_hash: string;
          target_window_end: string;
          target_window_start: string;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: string;
        }[];
      };
      fail_stripe_webhook_event: {
        Args: { target_error: string; target_event_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
