export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
          col_hlc: Json;
          hlc: string;
          id: string;
          is_stub: boolean;
          linked_user_id: string | null;
          name: string;
          sort: number;
          updated_at: string;
        };
        Insert: {
          bill_id: string;
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          linked_user_id?: string | null;
          name?: string;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          linked_user_id?: string | null;
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
          {
            foreignKeyName: "bill_contributors_linked_user_id_fkey";
            columns: ["linked_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_item_splits: {
        Row: {
          bill_id: string;
          col_hlc: Json;
          contributor_id: string | null;
          hlc: string;
          id: string;
          is_stub: boolean;
          item_id: string | null;
          ratio: number;
          updated_at: string;
        };
        Insert: {
          bill_id: string;
          col_hlc?: Json;
          contributor_id?: string | null;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          item_id?: string | null;
          ratio?: number;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          col_hlc?: Json;
          contributor_id?: string | null;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          item_id?: string | null;
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
            foreignKeyName: "bill_item_splits_contributor_id_bill_id_fkey";
            columns: ["contributor_id", "bill_id"];
            isOneToOne: false;
            referencedRelation: "bill_contributors";
            referencedColumns: ["id", "bill_id"];
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
          bill_id: string;
          col_hlc: Json;
          contributor_id: string | null;
          cost: number;
          hlc: string;
          id: string;
          is_stub: boolean;
          name: string;
          sort: number;
          updated_at: string;
        };
        Insert: {
          bill_id: string;
          col_hlc?: Json;
          contributor_id?: string | null;
          cost?: number;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          bill_id?: string;
          col_hlc?: Json;
          contributor_id?: string | null;
          cost?: number;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          sort?: number;
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
          {
            foreignKeyName: "bill_items_contributor_id_bill_id_fkey";
            columns: ["contributor_id", "bill_id"];
            isOneToOne: false;
            referencedRelation: "bill_contributors";
            referencedColumns: ["id", "bill_id"];
          },
        ];
      };
      bill_users: {
        Row: {
          bill_id: string;
          col_hlc: Json;
          hlc: string;
          payment_id: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          role: Database["public"]["Enums"]["bill_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bill_id: string;
          col_hlc?: Json;
          hlc?: string;
          payment_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role: Database["public"]["Enums"]["bill_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bill_id?: string;
          col_hlc?: Json;
          hlc?: string;
          payment_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role?: Database["public"]["Enums"]["bill_role"];
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
            foreignKeyName: "bill_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: {
          col_hlc: Json;
          currency: string;
          hlc: string;
          id: string;
          is_stub: boolean;
          name: string;
          tax: number;
          tip: number;
          updated_at: string;
          visibility: Database["public"]["Enums"]["bill_visibility"];
        };
        Insert: {
          col_hlc?: Json;
          currency?: string;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          tax?: number;
          tip?: number;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["bill_visibility"];
        };
        Update: {
          col_hlc?: Json;
          currency?: string;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          tax?: number;
          tip?: number;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["bill_visibility"];
        };
        Relationships: [];
      };
      invites: {
        Row: {
          bill_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          max_uses: number | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["bill_role"];
          uses: number;
        };
        Insert: {
          bill_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["bill_role"];
          uses?: number;
        };
        Update: {
          bill_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["bill_role"];
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invites_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      mutation_logs: {
        Row: {
          created_at: string;
          entity_id: string;
          hlc: string;
          id: string;
          payload: Json;
          seq_id: number;
          type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          hlc: string;
          id: string;
          payload: Json;
          seq_id?: never;
          type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          hlc?: string;
          id?: string;
          payload?: Json;
          seq_id?: never;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mutation_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          col_hlc: Json;
          default_payment_id: string | null;
          default_payment_method: Database["public"]["Enums"]["payment_method"];
          default_visibility: Database["public"]["Enums"]["bill_visibility"];
          hlc: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          col_hlc?: Json;
          default_payment_id?: string | null;
          default_payment_method?: Database["public"]["Enums"]["payment_method"];
          default_visibility?: Database["public"]["Enums"]["bill_visibility"];
          hlc?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          col_hlc?: Json;
          default_payment_id?: string | null;
          default_payment_method?: Database["public"]["Enums"]["payment_method"];
          default_visibility?: Database["public"]["Enums"]["bill_visibility"];
          hlc?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      ordered_bill_splits: {
        Row: {
          bill_id: string | null;
          contributor_id: string | null;
          contributor_name: string | null;
          contributor_sort_order: number | null;
          id: string | null;
          item_id: string | null;
          item_name: string | null;
          item_sort_order: number | null;
          ratio: number | null;
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
            foreignKeyName: "bill_item_splits_contributor_id_bill_id_fkey";
            columns: ["contributor_id", "bill_id"];
            isOneToOne: false;
            referencedRelation: "bill_contributors";
            referencedColumns: ["id", "bill_id"];
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
    };
    Functions: {
      _bill_role_rank: {
        Args: { r: Database["public"]["Enums"]["bill_role"] };
        Returns: number;
      };
      _ensure_stub_bill: { Args: { p_bill: string }; Returns: undefined };
      _ensure_stub_contributor: {
        Args: { p_bill: string; p_id: string };
        Returns: undefined;
      };
      _ensure_stub_item: {
        Args: { p_bill: string; p_id: string };
        Returns: undefined;
      };
      _upsert_split: {
        Args: {
          p_bill: string;
          p_contrib: string;
          p_created_at: string;
          p_hlc: string;
          p_id: string;
          p_item: string;
          p_ratio: number;
        };
        Returns: undefined;
      };
      check_user_has_bill_read_access: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_user_has_bill_write_access: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_bill_owner: {
        Args: { p_bill_id: string; p_user_id: string };
        Returns: boolean;
      };
      join_bill_via_invite: {
        Args: { p_bill_id: string; p_invite_id: string; p_user_id: string };
        Returns: undefined;
      };
      log_mutation: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_id: string;
          p_payload: Json;
          p_type: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      sync_add_contributor: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_add_item: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_add_split: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_create_bill: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_delete_bill: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_delete_bill_user: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_delete_contributor: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_delete_item: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_delete_user: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_bill: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_bill_user: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_contributor: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_item: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_split: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      sync_update_user: {
        Args: {
          p_created_at: string;
          p_entity_id: string;
          p_hlc: string;
          p_mutation_id: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      bill_role: "owner" | "editor" | "viewer";
      bill_visibility: "private" | "public_read";
      payment_method: "etransfer" | "payPal";
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
    Enums: {
      bill_role: ["owner", "editor", "viewer"],
      bill_visibility: ["private", "public_read"],
      payment_method: ["etransfer", "payPal"],
    },
  },
} as const;
