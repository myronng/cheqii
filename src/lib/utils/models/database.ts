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
      cheque_item_splits: {
        Row: {
          cheque_id: string;
          col_hlc: Json;
          hlc: string;
          id: string;
          is_stub: boolean;
          item_id: string | null;
          person_id: string | null;
          ratio: number;
          updated_at: string;
        };
        Insert: {
          cheque_id: string;
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          item_id?: string | null;
          person_id?: string | null;
          ratio?: number;
          updated_at?: string;
        };
        Update: {
          cheque_id?: string;
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          item_id?: string | null;
          person_id?: string | null;
          ratio?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cheque_item_splits_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_item_splits_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "cheque_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_item_splits_person_id_cheque_id_fkey";
            columns: ["person_id", "cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheque_people";
            referencedColumns: ["id", "cheque_id"];
          },
        ];
      };
      cheque_items: {
        Row: {
          cheque_id: string;
          col_hlc: Json;
          cost: number;
          hlc: string;
          id: string;
          is_stub: boolean;
          name: string;
          person_id: string | null;
          sort: number;
          updated_at: string;
        };
        Insert: {
          cheque_id: string;
          col_hlc?: Json;
          cost?: number;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          person_id?: string | null;
          sort?: number;
          updated_at?: string;
        };
        Update: {
          cheque_id?: string;
          col_hlc?: Json;
          cost?: number;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          person_id?: string | null;
          sort?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cheque_items_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_items_person_id_cheque_id_fkey";
            columns: ["person_id", "cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheque_people";
            referencedColumns: ["id", "cheque_id"];
          },
        ];
      };
      cheque_people: {
        Row: {
          cheque_id: string;
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
          cheque_id: string;
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
          cheque_id?: string;
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
            foreignKeyName: "cheque_people_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_people_linked_user_id_fkey";
            columns: ["linked_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cheque_users: {
        Row: {
          cheque_id: string;
          claim_dismissed: boolean;
          col_hlc: Json;
          hlc: string;
          payment_id: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          role: Database["public"]["Enums"]["cheque_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cheque_id: string;
          claim_dismissed?: boolean;
          col_hlc?: Json;
          hlc?: string;
          payment_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role: Database["public"]["Enums"]["cheque_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cheque_id?: string;
          claim_dismissed?: boolean;
          col_hlc?: Json;
          hlc?: string;
          payment_id?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          role?: Database["public"]["Enums"]["cheque_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cheque_users_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cheques: {
        Row: {
          col_hlc: Json;
          hlc: string;
          id: string;
          is_stub: boolean;
          name: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["cheque_visibility"];
        };
        Insert: {
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["cheque_visibility"];
        };
        Update: {
          col_hlc?: Json;
          hlc?: string;
          id?: string;
          is_stub?: boolean;
          name?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["cheque_visibility"];
        };
        Relationships: [];
      };
      invites: {
        Row: {
          cheque_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          max_uses: number | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["cheque_role"];
          uses: number;
        };
        Insert: {
          cheque_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["cheque_role"];
          uses?: number;
        };
        Update: {
          cheque_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["cheque_role"];
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invites_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
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
          default_visibility: Database["public"]["Enums"]["cheque_visibility"];
          hlc: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          col_hlc?: Json;
          default_payment_id?: string | null;
          default_payment_method?: Database["public"]["Enums"]["payment_method"];
          default_visibility?: Database["public"]["Enums"]["cheque_visibility"];
          hlc?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          col_hlc?: Json;
          default_payment_id?: string | null;
          default_payment_method?: Database["public"]["Enums"]["payment_method"];
          default_visibility?: Database["public"]["Enums"]["cheque_visibility"];
          hlc?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      ordered_cheque_splits: {
        Row: {
          cheque_id: string | null;
          id: string | null;
          item_id: string | null;
          item_name: string | null;
          item_sort_order: number | null;
          person_id: string | null;
          person_name: string | null;
          person_sort_order: number | null;
          ratio: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cheque_item_splits_cheque_id_fkey";
            columns: ["cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_item_splits_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "cheque_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cheque_item_splits_person_id_cheque_id_fkey";
            columns: ["person_id", "cheque_id"];
            isOneToOne: false;
            referencedRelation: "cheque_people";
            referencedColumns: ["id", "cheque_id"];
          },
        ];
      };
    };
    Functions: {
      _cheque_role_rank: {
        Args: { r: Database["public"]["Enums"]["cheque_role"] };
        Returns: number;
      };
      _ensure_stub_cheque: { Args: { p_cheque: string }; Returns: undefined };
      _ensure_stub_item: {
        Args: { p_cheque: string; p_id: string };
        Returns: undefined;
      };
      _ensure_stub_person: {
        Args: { p_cheque: string; p_id: string };
        Returns: undefined;
      };
      _upsert_split: {
        Args: {
          p_cheque: string;
          p_created_at: string;
          p_hlc: string;
          p_id: string;
          p_item: string;
          p_person: string;
          p_ratio: number;
        };
        Returns: undefined;
      };
      check_user_has_cheque_read_access: {
        Args: { p_cheque_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_user_has_cheque_write_access: {
        Args: { p_cheque_id: string; p_user_id: string };
        Returns: boolean;
      };
      compact_cheque: { Args: { p_cheque_id: string }; Returns: boolean };
      compact_stale_cheques: { Args: { p_threshold?: number }; Returns: number };
      compaction_health: { Args: { p_threshold?: number }; Returns: Json };
      get_invite_preview: {
        Args: { p_cheque_id: string; p_invite_id: string };
        Returns: {
          item_count: number;
          name: string;
          people_count: number;
        }[];
      };
      is_cheque_owner: {
        Args: { p_cheque_id: string; p_user_id: string };
        Returns: boolean;
      };
      join_cheque_via_invite: {
        Args: { p_cheque_id: string; p_invite_id: string; p_user_id: string };
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
      sync_add_person: {
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
      sync_create_cheque: {
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
      sync_delete_cheque: {
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
      sync_delete_cheque_user: {
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
      sync_delete_person: {
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
      sync_update_cheque: {
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
      sync_update_cheque_user: {
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
      sync_update_person: {
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
      cheque_role: "owner" | "editor" | "viewer";
      cheque_visibility: "private" | "public_read";
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
      cheque_role: ["owner", "editor", "viewer"],
      cheque_visibility: ["private", "public_read"],
      payment_method: ["etransfer", "payPal"],
    },
  },
} as const;
