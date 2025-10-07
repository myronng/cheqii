export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      bill_contributors: {
        Row: {
          bill_id: string;
          id: string;
          name: string;
          sort: number;
          updated_at: string;
        };
        Insert: {
          bill_id?: string;
          id?: string;
          name?: string;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          id?: string;
          name?: string;
          sort?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_contributors_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_item_splits: {
        Row: {
          bill_id: string;
          contributor_id: string;
          id: string;
          item_id: string;
          ratio: number;
          updated_at: string;
        };
        Insert: {
          bill_id?: string;
          contributor_id?: string;
          id?: string;
          item_id?: string;
          ratio?: number;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          contributor_id?: string;
          id?: string;
          item_id?: string;
          ratio?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_item_splits_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_item_splits_contributor_id_fkey";
            columns: ["contributor_id"];
            isOneToOne: false;
            referencedRelation: "bill_contributors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_item_splits_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "bill_items";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_items: {
        Row: {
          buyer: string | null;
          bill_id: string;
          cost: number;
          id: string;
          name: string;
          sort: number;
          split: number[];
          updated_at: string;
        };
        Insert: {
          buyer?: string | null;
          bill_id?: string;
          cost?: number;
          id?: string;
          name?: string;
          sort: number;
          split?: number[];
          updated_at?: string;
        };
        Update: {
          buyer?: string | null;
          bill_id?: string;
          cost?: number;
          id?: string;
          name?: string;
          sort?: number;
          split?: number[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_users: {
        Row: {
          authority: string;
          bill_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          authority?: string;
          bill_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          authority?: string;
          bill_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_users_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bill_users_user_id_fkey1";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: {
          id: string;
          invite_id: string;
          invite_required: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invite_id?: string;
          invite_required?: boolean;
          title?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invite_id?: string;
          invite_required?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          invite_default: boolean;
          payment_id: string | null;
          payment_method: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invite_default?: boolean;
          payment_id?: string | null;
          payment_method?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invite_default?: boolean;
          payment_id?: string | null;
          payment_method?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_bill_allows_any_access: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_user_has_bill_read_access: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_user_has_bill_write_access: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
